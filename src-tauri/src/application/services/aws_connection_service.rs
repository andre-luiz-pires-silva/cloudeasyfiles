use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::types::BucketLocationConstraint;
use aws_sdk_s3::types::GlacierJobParameters;
use aws_sdk_s3::types::OptionalObjectAttributes;
use aws_sdk_s3::types::RestoreRequest;
use aws_sdk_s3::types::Tier;
use aws_sdk_sts::error::ProvideErrorMetadata;
use aws_sdk_sts::operation::RequestId;
use aws_sdk_sts::Client;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsCacheDownloadResult, AwsConnectionTestInput,
    AwsConnectionTestResult, AwsObjectSummary, AwsVirtualDirectorySummary,
};

pub struct AwsConnectionService;
const MISSING_MINIMUM_S3_PERMISSION_ERROR: &str = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
pub const DOWNLOAD_CANCELLED_ERROR: &str = "DOWNLOAD_CANCELLED";
const S3_LISTING_PAGE_SIZE: i32 = 200;
const GLOBAL_AWS_REGION_FALLBACKS: &[&str] = &[
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "sa-east-1",
    "ca-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-central-1",
    "eu-central-2",
    "eu-north-1",
    "eu-south-1",
    "eu-south-2",
    "ap-south-1",
    "ap-south-2",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-southeast-3",
    "ap-southeast-4",
    "ap-southeast-5",
    "ap-southeast-6",
    "ap-southeast-7",
    "ap-northeast-1",
    "ap-northeast-2",
    "ap-northeast-3",
    "ap-east-1",
    "ap-east-2",
    "af-south-1",
    "me-south-1",
    "me-central-1",
    "il-central-1",
    "mx-central-1",
];

struct AwsGlobalAccessContext {
    identity: AwsConnectionTestResult,
    s3_client: S3Client,
}

struct DownloadCancellationGuard {
    operation_id: String,
}

static DOWNLOAD_CANCELLATIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

impl Drop for DownloadCancellationGuard {
    fn drop(&mut self) {
        if let Ok(mut cancellations) = DOWNLOAD_CANCELLATIONS.lock() {
            cancellations.remove(&self.operation_id);
        }
    }
}

fn format_provider_service_error<E>(service_error: &E) -> String
where
    E: ProvideErrorMetadata,
{
    let error_code = service_error.code().unwrap_or("UnknownError");
    let error_message = service_error
        .message()
        .filter(|message| !message.trim().is_empty())
        .unwrap_or("The provider returned an error without details.");
    let request_id = service_error.meta().request_id();

    if let Some(request_id) = request_id {
        return format!("{}: {} (request id: {})", error_code, error_message, request_id);
    }

    format!("{}: {}", error_code, error_message)
}

fn normalize_bucket_region(location_constraint: Option<&BucketLocationConstraint>) -> String {
    match location_constraint {
        None => "us-east-1".to_string(),
        Some(BucketLocationConstraint::Eu) => "eu-west-1".to_string(),
        Some(value) => value.as_str().to_string(),
    }
}

fn build_directory_name(path: &str) -> String {
    let trimmed = path.strip_suffix('/').unwrap_or(path);
    let name = trimmed.rsplit('/').next().unwrap_or(trimmed);

    if name.is_empty() {
        return "/".to_string();
    }

    name.to_string()
}

fn parse_restore_tier(value: &str) -> Result<Tier, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "expedited" => Ok(Tier::Expedited),
        "standard" => Ok(Tier::Standard),
        "bulk" => Ok(Tier::Bulk),
        _ => Err("Unsupported AWS restore tier.".to_string()),
    }
}

fn validate_restore_tier_for_storage_class(
    storage_class: Option<&str>,
    restore_tier: &Tier,
) -> Result<(), String> {
    let normalized_storage_class = storage_class.unwrap_or_default().trim().to_ascii_uppercase();

    if normalized_storage_class.contains("DEEP_ARCHIVE") && matches!(restore_tier, Tier::Expedited)
    {
        return Err(
            "Expedited restore is not supported for S3 Deep Archive objects. Choose Standard or Bulk."
                .to_string(),
        );
    }

    Ok(())
}

impl AwsConnectionService {
    const CACHE_TEMP_DIRECTORY: &'static str = ".cloudeasyfiles-tmp";
    const CACHE_ESCAPED_SEGMENT_PREFIX: &'static str = ".cloudeasyfiles-segment-";

    fn encode_cache_path_segment(segment: &str) -> String {
        let mut encoded = String::with_capacity(segment.len() * 2 + 4);
        encoded.push_str(Self::CACHE_ESCAPED_SEGMENT_PREFIX);

        for byte in segment.as_bytes() {
            encoded.push_str(&format!("{byte:02x}"));
        }

        encoded
    }

    fn normalize_cache_path_segment(segment: &str) -> String {
        let is_reserved = segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment == Self::CACHE_TEMP_DIRECTORY
            || segment.starts_with(Self::CACHE_ESCAPED_SEGMENT_PREFIX)
            || segment.contains('\\')
            || segment.contains(':')
            || segment.contains('\0');

        if is_reserved {
            return Self::encode_cache_path_segment(segment);
        }

        segment.to_string()
    }

    fn build_connection_cache_root(
        global_local_cache_directory: &str,
        connection_id: &str,
    ) -> Result<PathBuf, String> {
        let normalized_connection_id = connection_id.trim();

        if normalized_connection_id.is_empty() {
            return Err("Connection id is required for local cache operations.".to_string());
        }

        Ok(PathBuf::from(global_local_cache_directory)
            .join(Self::normalize_cache_path_segment(normalized_connection_id)))
    }

    fn build_primary_cache_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        let normalized_object_path = object_key
            .split('/')
            .fold(PathBuf::new(), |path, segment| {
                path.join(Self::normalize_cache_path_segment(segment))
            });

        Ok(Self::build_connection_cache_root(
            global_local_cache_directory,
            connection_id,
        )?
        .join(bucket_name)
        .join(normalized_object_path))
    }

    fn build_legacy_connection_name_cache_object_path(
        global_local_cache_directory: &str,
        connection_name: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        let normalized_connection_name = connection_name.trim();

        if normalized_connection_name.is_empty() {
            return Err("Connection name is required for local cache operations.".to_string());
        }

        let normalized_object_path = object_key
            .split('/')
            .fold(PathBuf::new(), |path, segment| {
                path.join(Self::normalize_cache_path_segment(segment))
            });

        Ok(PathBuf::from(global_local_cache_directory)
            .join(Self::normalize_cache_path_segment(normalized_connection_name))
            .join(bucket_name)
            .join(normalized_object_path))
    }

    fn build_legacy_raw_cache_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        Ok(PathBuf::from(global_local_cache_directory)
            .join(connection_id)
            .join(bucket_name)
            .join(object_key))
    }

    fn build_legacy_encoded_cache_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        let encoded_object_path = object_key
            .split('/')
            .fold(PathBuf::new(), |path, segment| {
                path.join(Self::encode_cache_path_segment(segment))
            });

        Ok(PathBuf::from(global_local_cache_directory)
            .join(connection_id)
            .join(bucket_name)
            .join(encoded_object_path))
    }

    fn build_recent_legacy_cache_object_path(
        global_local_cache_directory: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        let normalized_object_path = object_key
            .split('/')
            .fold(PathBuf::new(), |path, segment| {
                path.join(Self::normalize_cache_path_segment(segment))
            });

        Ok(PathBuf::from(global_local_cache_directory)
            .join(bucket_name)
            .join(normalized_object_path))
    }

    fn build_cache_object_path_candidates(
        global_local_cache_directory: &str,
        connection_id: &str,
        connection_name: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<Vec<PathBuf>, String> {
        let mut paths = Vec::new();

        paths.push(Self::build_primary_cache_object_path(
            global_local_cache_directory,
            connection_id,
            bucket_name,
            object_key,
        )?);

        let legacy_connection_name_path = Self::build_legacy_connection_name_cache_object_path(
            global_local_cache_directory,
            connection_name,
            bucket_name,
            object_key,
        )?;

        if !paths.contains(&legacy_connection_name_path) {
            paths.push(legacy_connection_name_path);
        }

        let recent_legacy_path = Self::build_recent_legacy_cache_object_path(
            global_local_cache_directory,
            bucket_name,
            object_key,
        )?;

        if !paths.contains(&recent_legacy_path) {
            paths.push(recent_legacy_path);
        }

        let legacy_raw_path = Self::build_legacy_raw_cache_object_path(
            global_local_cache_directory,
            connection_id,
            bucket_name,
            object_key,
        )?;

        if !paths.contains(&legacy_raw_path) {
            paths.push(legacy_raw_path);
        }

        let legacy_encoded_path = Self::build_legacy_encoded_cache_object_path(
            global_local_cache_directory,
            connection_id,
            bucket_name,
            object_key,
        )?;

        if !paths.contains(&legacy_encoded_path) {
            paths.push(legacy_encoded_path);
        }

        Ok(paths)
    }

    fn build_cache_temp_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        let cache_object_path = Self::build_primary_cache_object_path(
            global_local_cache_directory,
            connection_id,
            bucket_name,
            object_key,
        )?;
        let connection_cache_root =
            Self::build_connection_cache_root(global_local_cache_directory, connection_id)?;
        let relative_path = cache_object_path
            .strip_prefix(&connection_cache_root)
            .map_err(|error| error.to_string())?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();

        Ok(PathBuf::from(global_local_cache_directory)
            .join(Self::CACHE_TEMP_DIRECTORY)
            .join(Self::normalize_cache_path_segment(connection_id.trim()))
            .join(relative_path)
            .with_extension(format!("part-{}-{}", std::process::id(), timestamp)))
    }

    fn build_temp_file_path(final_path: &Path) -> Result<PathBuf, String> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let file_name = final_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Unable to resolve a valid destination filename.".to_string())?;

        Ok(final_path.with_file_name(format!(
            ".{file_name}.cloudeasyfiles.part-{}-{timestamp}",
            std::process::id()
        )))
    }

    async fn build_clients(
        region: &str,
        access_key_id: String,
        secret_access_key: String,
    ) -> (Client, S3Client) {
        let credentials = Credentials::new(
            access_key_id,
            secret_access_key,
            None,
            None,
            "CloudEasyFilesConnectionTest",
        );

        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region.to_string()))
            .credentials_provider(credentials)
            .load()
            .await;

        (Client::new(&config), S3Client::new(&config))
    }

    async fn resolve_global_access_context(
        access_key_id: &str,
        secret_access_key: &str,
    ) -> Result<AwsGlobalAccessContext, String> {
        let mut last_error_message: Option<String> = None;
        let mut saw_missing_minimum_permission = false;

        for region in GLOBAL_AWS_REGION_FALLBACKS {
            eprintln!(
                "[aws_connection_service] trying AWS global access flow with region={}",
                region
            );

            let (client, s3_client) = Self::build_clients(
                region,
                access_key_id.to_string(),
                secret_access_key.to_string(),
            )
            .await;

            let identity_response = match client.get_caller_identity().send().await {
                Ok(response) => response,
                Err(error) => {
                    let error_message = error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string());

                    eprintln!(
                        "[aws_connection_service] STS caller identity failed for region={} error={}",
                        region, error_message
                    );

                    last_error_message = Some(error_message);
                    continue;
                }
            };

            match s3_client.list_buckets().send().await {
                Ok(_) => {
                    let identity = AwsConnectionTestResult {
                        account_id: identity_response.account().unwrap_or_default().to_string(),
                        arn: identity_response.arn().unwrap_or_default().to_string(),
                        user_id: identity_response.user_id().unwrap_or_default().to_string(),
                    };

                    eprintln!(
                        "[aws_connection_service] AWS global access flow succeeded with region={} account_id={}",
                        region, identity.account_id
                    );

                    return Ok(AwsGlobalAccessContext {
                        identity,
                        s3_client,
                    });
                }
                Err(error) => {
                    let error_code = error
                        .as_service_error()
                        .and_then(ProvideErrorMetadata::code);
                    let error_message = error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string());

                    eprintln!(
                        "[aws_connection_service] S3 list buckets failed for region={} error={}",
                        region, error_message
                    );

                    if matches!(error_code, Some("AccessDenied") | Some("UnauthorizedAccess")) {
                        saw_missing_minimum_permission = true;
                    }

                    last_error_message = Some(error_message);
                }
            }
        }

        if saw_missing_minimum_permission {
            return Err(MISSING_MINIMUM_S3_PERMISSION_ERROR.to_string());
        }

        Err(last_error_message.unwrap_or_else(|| {
            "Unable to establish a compatible AWS regional endpoint for this connection."
                .to_string()
        }))
    }

    async fn resolve_bucket_region(
        access_key_id: &str,
        secret_access_key: &str,
        bucket_name: &str,
        bucket_region: Option<String>,
    ) -> Result<String, String> {
        if let Some(bucket_region) = bucket_region {
            if !bucket_region.trim().is_empty() && bucket_region != "..." {
                return Ok(bucket_region);
            }
        }

        let context =
            Self::resolve_global_access_context(access_key_id, secret_access_key).await?;
        let bucket_location = context
            .s3_client
            .get_bucket_location()
            .bucket(bucket_name)
            .send()
            .await
            .map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

        Ok(normalize_bucket_region(bucket_location.location_constraint()))
    }

    pub async fn test_connection(
        input: AwsConnectionTestInput,
    ) -> Result<AwsConnectionTestResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();

        eprintln!("[aws_connection_service] testing AWS connection");

        let context =
            Self::resolve_global_access_context(&access_key_id, &secret_access_key).await?;

        eprintln!(
            "[aws_connection_service] AWS connection test succeeded for account_id={} and s3:ListAllMyBuckets is available",
            context.identity.account_id
        );

        Ok(context.identity)
    }

    pub async fn list_buckets(
        input: AwsConnectionTestInput,
    ) -> Result<Vec<AwsBucketSummary>, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();

        eprintln!("[aws_connection_service] listing S3 buckets");

        let context =
            Self::resolve_global_access_context(&access_key_id, &secret_access_key).await?;
        let response = context.s3_client.list_buckets().send().await.map_err(|error| {
            let error_message = error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string());

            eprintln!(
                "[aws_connection_service] failed to list S3 buckets error={}",
                error_message
            );

            error_message
        })?;

        let mut buckets = Vec::new();

        for bucket in response.buckets() {
            let Some(bucket_name) = bucket.name() else {
                continue;
            };

            buckets.push(AwsBucketSummary {
                name: bucket_name.to_string(),
            });
        }

        Ok(buckets)
    }

    pub async fn get_bucket_region(
        input: AwsConnectionTestInput,
        bucket_name: String,
    ) -> Result<String, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();

        eprintln!(
            "[aws_connection_service] resolving S3 bucket region for bucket={}",
            bucket_name
        );

        let context =
            Self::resolve_global_access_context(&access_key_id, &secret_access_key).await?;
        let bucket_location = context
            .s3_client
            .get_bucket_location()
            .bucket(bucket_name.clone())
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to resolve region for bucket={} error={}",
                    bucket_name, error_message
                );

                error_message
            })?;

        Ok(normalize_bucket_region(bucket_location.location_constraint()))
    }

    pub async fn list_bucket_items(
        input: AwsConnectionTestInput,
        bucket_name: String,
        prefix: Option<String>,
        bucket_region: Option<String>,
        continuation_token: Option<String>,
    ) -> Result<AwsBucketItemsResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let prefix = prefix.unwrap_or_default();

        eprintln!(
            "[aws_connection_service] listing S3 objects for bucket={} prefix={}",
            bucket_name, prefix
        );

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
        )
        .await?;

        let (_, s3_client) = Self::build_clients(
            &resolved_bucket_region,
            access_key_id,
            secret_access_key,
        )
        .await;

        let mut seen_directories = HashSet::new();
        let mut seen_files = HashSet::new();
        let mut directories = Vec::new();
        let mut files = Vec::new();
        let response = s3_client
            .list_objects_v2()
            .bucket(bucket_name.clone())
            .delimiter("/")
            .max_keys(S3_LISTING_PAGE_SIZE)
            .optional_object_attributes(OptionalObjectAttributes::RestoreStatus)
            .set_prefix((!prefix.is_empty()).then_some(prefix.clone()))
            .set_continuation_token(continuation_token)
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to list S3 objects for bucket={} prefix={} error={}",
                    bucket_name, prefix, error_message
                );

                error_message
            })?;

        for directory_path in response
            .common_prefixes()
            .iter()
            .filter_map(|common_prefix| common_prefix.prefix())
        {
            if seen_directories.insert(directory_path.to_string()) {
                directories.push(AwsVirtualDirectorySummary {
                    name: build_directory_name(directory_path),
                    path: directory_path.to_string(),
                });
            }
        }

        for object in response.contents().iter() {
            let Some(key) = object.key() else {
                continue;
            };

            if key == prefix || key.ends_with('/') {
                continue;
            }

            if seen_files.insert(key.to_string()) {
                let restore_status = object.restore_status();
                files.push(AwsObjectSummary {
                    key: key.to_string(),
                    size: object.size().unwrap_or_default(),
                    e_tag: object.e_tag().map(ToString::to_string),
                    last_modified: object.last_modified().map(ToString::to_string),
                    storage_class: Some(
                        object
                            .storage_class()
                            .map(|storage_class| storage_class.as_str().to_string())
                            .unwrap_or_else(|| "STANDARD".to_string()),
                    ),
                    restore_in_progress: restore_status.and_then(|status| status.is_restore_in_progress()),
                    restore_expiry_date: restore_status
                        .and_then(|status| status.restore_expiry_date())
                        .map(ToString::to_string),
                });
            }
        }

        let next_continuation_token = response.next_continuation_token().map(ToString::to_string);
        let has_more = response.is_truncated().unwrap_or(false) && next_continuation_token.is_some();

        Ok(AwsBucketItemsResult {
            bucket_region: resolved_bucket_region,
            directories,
            files,
            continuation_token: next_continuation_token,
            has_more,
        })
    }

    pub async fn request_object_restore(
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        storage_class: Option<String>,
        bucket_region: Option<String>,
        restore_tier: String,
        days: i32,
    ) -> Result<(), String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();

        if bucket_name.is_empty() {
            return Err("Bucket name is required for restore requests.".to_string());
        }

        if object_key.is_empty() {
            return Err("Object key is required for restore requests.".to_string());
        }

        if !(1..=365).contains(&days) {
            return Err("Restore retention days must be between 1 and 365.".to_string());
        }

        let tier = parse_restore_tier(&restore_tier)?;
        validate_restore_tier_for_storage_class(storage_class.as_deref(), &tier)?;

        eprintln!(
            "[aws_connection_service] requesting S3 restore for bucket={} object_key={} tier={} days={}",
            bucket_name, object_key, restore_tier, days
        );

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let glacier_job_parameters = GlacierJobParameters::builder()
            .tier(tier)
            .build()
            .map_err(|error| error.to_string())?;
        let restore_request = RestoreRequest::builder()
            .days(days)
            .glacier_job_parameters(glacier_job_parameters)
            .build();

        s3_client
            .restore_object()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .restore_request(restore_request)
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to request S3 restore for bucket={} object_key={} error={}",
                    bucket_name, object_key, error_message
                );

                error_message
            })?;

        Ok(())
    }

    pub async fn download_object_to_cache<F>(
        operation_id: String,
        input: AwsConnectionTestInput,
        connection_id: String,
        connection_name: String,
        bucket_name: String,
        object_key: String,
        bucket_region: Option<String>,
        global_local_cache_directory: String,
        mut on_progress: F,
    ) -> Result<AwsCacheDownloadResult, String>
    where
        F: FnMut(i64, i64, &str) -> Result<(), String>,
    {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let connection_id = connection_id.trim().to_string();
        let _connection_name = connection_name.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_download_cancellation(&operation_id)?;

        if global_local_cache_directory.is_empty() {
            return Err("Local cache directory is required for tracked downloads.".to_string());
        }

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let response = s3_client
            .get_object()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .send()
            .await
            .map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

        let total_bytes = response.content_length().unwrap_or(0).max(0);
        let final_path = Self::build_primary_cache_object_path(
            &global_local_cache_directory,
            &connection_id,
            &bucket_name,
            &object_key,
        )?;
        let temp_path = Self::build_cache_temp_object_path(
            &global_local_cache_directory,
            &connection_id,
            &bucket_name,
            &object_key,
        )?;

        if let Some(parent_directory) = final_path.parent() {
            fs::create_dir_all(parent_directory)
                .await
                .map_err(|error| error.to_string())?;
        }

        if let Some(temp_parent_directory) = temp_path.parent() {
            fs::create_dir_all(temp_parent_directory)
                .await
                .map_err(|error| error.to_string())?;
        }

        let mut file = fs::File::create(&temp_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut stream = response.body;
        let mut written_bytes = 0_i64;
        let final_path_string = final_path.to_string_lossy().to_string();

        if cancellation_flag.load(Ordering::SeqCst) {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        while let Some(chunk) = stream
            .try_next()
            .await
            .map_err(|error| error.to_string())?
        {
            if cancellation_flag.load(Ordering::SeqCst) {
                drop(file);
                Self::remove_temp_file_if_exists(&temp_path).await?;
                return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
            }

            file.write_all(&chunk)
                .await
                .map_err(|error| error.to_string())?;

            written_bytes += chunk.len() as i64;
            on_progress(written_bytes, total_bytes, &final_path_string)?;
        }

        file.flush().await.map_err(|error| error.to_string())?;
        drop(file);

        if cancellation_flag.load(Ordering::SeqCst) {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        if fs::try_exists(&final_path)
            .await
            .map_err(|error| error.to_string())?
        {
            fs::remove_file(&final_path)
                .await
                .map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &final_path)
            .await
            .map_err(|error| error.to_string())?;

        Ok(AwsCacheDownloadResult {
            local_path: final_path_string,
            bytes_written: written_bytes,
        })
    }

    pub async fn download_object_to_path<F>(
        operation_id: String,
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        bucket_region: Option<String>,
        destination_path: String,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64, &str) -> Result<(), String>,
    {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let destination_path = destination_path.trim().to_string();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_download_cancellation(&operation_id)?;

        if destination_path.is_empty() {
            return Err("Destination path is required for direct downloads.".to_string());
        }

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let response = s3_client
            .get_object()
            .bucket(bucket_name)
            .key(object_key)
            .send()
            .await
            .map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

        let final_path = PathBuf::from(&destination_path);
        let temp_path = Self::build_temp_file_path(&final_path)?;
        let total_bytes = response.content_length().unwrap_or(0).max(0);

        if let Some(parent_directory) = final_path.parent() {
            fs::create_dir_all(parent_directory)
                .await
                .map_err(|error| error.to_string())?;
        }

        let mut file = fs::File::create(&temp_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut stream = response.body;
        let mut written_bytes = 0_i64;

        if cancellation_flag.load(Ordering::SeqCst) {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        while let Some(chunk) = stream
            .try_next()
            .await
            .map_err(|error| error.to_string())?
        {
            if cancellation_flag.load(Ordering::SeqCst) {
                drop(file);
                Self::remove_temp_file_if_exists(&temp_path).await?;
                return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
            }

            file.write_all(&chunk)
                .await
                .map_err(|error| error.to_string())?;

            written_bytes += chunk.len() as i64;
            on_progress(written_bytes, total_bytes, &destination_path)?;
        }

        file.flush().await.map_err(|error| error.to_string())?;
        drop(file);

        if cancellation_flag.load(Ordering::SeqCst) {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        if fs::try_exists(&final_path)
            .await
            .map_err(|error| error.to_string())?
        {
            fs::remove_file(&final_path)
                .await
                .map_err(|error| error.to_string())?;
        }

        fs::rename(&temp_path, &final_path)
            .await
            .map_err(|error| error.to_string())?;

        Ok(destination_path)
    }

    pub async fn find_cached_objects(
        connection_id: String,
        connection_name: String,
        bucket_name: String,
        global_local_cache_directory: String,
        object_keys: Vec<String>,
    ) -> Result<Vec<String>, String> {
        let connection_id = connection_id.trim().to_string();
        let connection_name = connection_name.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();

        if global_local_cache_directory.is_empty() {
            return Ok(Vec::new());
        }

        let mut cached_object_keys = Vec::new();

        for object_key in object_keys {
            let normalized_object_key = object_key.trim().to_string();

            if normalized_object_key.is_empty() {
                continue;
            }

            let object_paths = Self::build_cache_object_path_candidates(
                &global_local_cache_directory,
                &connection_id,
                &connection_name,
                &bucket_name,
                &normalized_object_key,
            )?;

            for object_path in object_paths {
                let exists = fs::try_exists(&object_path)
                    .await
                    .map_err(|error| error.to_string())?;

                if exists {
                    cached_object_keys.push(normalized_object_key.clone());
                    break;
                }
            }
        }

        Ok(cached_object_keys)
    }

    pub async fn open_cached_object_parent(
        connection_id: String,
        connection_name: String,
        bucket_name: String,
        global_local_cache_directory: String,
        object_key: String,
    ) -> Result<(), String> {
        let connection_id = connection_id.trim().to_string();
        let connection_name = connection_name.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();
        let object_key = object_key.trim().to_string();

        if global_local_cache_directory.is_empty() {
            return Err("Local cache directory is not configured.".to_string());
        }

        let object_paths = Self::build_cache_object_path_candidates(
            &global_local_cache_directory,
            &connection_id,
            &connection_name,
            &bucket_name,
            &object_key,
        )?;
        let mut existing_object_path = None;

        for object_path in object_paths {
            let exists = fs::try_exists(&object_path)
                .await
                .map_err(|error| error.to_string())?;

            if exists {
                existing_object_path = Some(object_path);
                break;
            }
        }

        let object_path = existing_object_path
            .ok_or_else(|| "The file is not available in the local cache.".to_string())?;

        let parent_directory = object_path
            .parent()
            .ok_or_else(|| "Unable to resolve the local directory for this file.".to_string())?;

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("explorer");
            command.arg(parent_directory);
            command
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut command = Command::new("open");
            command.arg(parent_directory);
            command
        };

        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut command = Command::new("xdg-open");
            command.arg(parent_directory);
            command
        };

        command.spawn().map_err(|error| error.to_string())?;

        Ok(())
    }

    pub fn open_external_url(url: String) -> Result<(), String> {
        let url = url.trim().to_string();

        if !(url.starts_with("https://") || url.starts_with("http://")) {
            return Err("Only HTTP and HTTPS URLs are supported.".to_string());
        }

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("rundll32.exe");
            command.args(["url.dll,FileProtocolHandler", &url]);
            command
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut command = Command::new("open");
            command.arg(&url);
            command
        };

        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut command = Command::new("xdg-open");
            command.arg(&url);
            command
        };

        command.spawn().map_err(|error| error.to_string())?;

        Ok(())
    }

    fn register_download_cancellation(
        operation_id: &str,
    ) -> Result<(Arc<AtomicBool>, DownloadCancellationGuard), String> {
        let cancellation_flag = Arc::new(AtomicBool::new(false));
        let mut cancellations = DOWNLOAD_CANCELLATIONS
            .lock()
            .map_err(|_| "Unable to access download cancellation state.".to_string())?;

        cancellations.insert(operation_id.to_string(), cancellation_flag.clone());

        Ok((
            cancellation_flag,
            DownloadCancellationGuard {
                operation_id: operation_id.to_string(),
            },
        ))
    }

    async fn remove_temp_file_if_exists(temp_path: &Path) -> Result<(), String> {
        if fs::try_exists(temp_path)
            .await
            .map_err(|error| error.to_string())?
        {
            fs::remove_file(temp_path)
                .await
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    pub fn cancel_download(operation_id: String) -> Result<bool, String> {
        let cancellations = DOWNLOAD_CANCELLATIONS
            .lock()
            .map_err(|_| "Unable to access download cancellation state.".to_string())?;

        let Some(cancellation_flag) = cancellations.get(&operation_id) else {
            return Ok(false);
        };

        cancellation_flag.store(true, Ordering::SeqCst);

        Ok(true)
    }
}
