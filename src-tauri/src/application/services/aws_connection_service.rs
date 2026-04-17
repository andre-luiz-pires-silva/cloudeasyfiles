use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::BucketLocationConstraint;
use aws_sdk_s3::types::CompletedMultipartUpload;
use aws_sdk_s3::types::CompletedPart;
use aws_sdk_s3::types::Delete;
use aws_sdk_s3::types::GlacierJobParameters;
use aws_sdk_s3::types::ObjectIdentifier;
use aws_sdk_s3::types::OptionalObjectAttributes;
use aws_sdk_s3::types::RestoreRequest;
use aws_sdk_s3::types::StorageClass;
use aws_sdk_s3::types::Tier;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_sts::error::ProvideErrorMetadata;
use aws_sdk_sts::operation::RequestId;
use aws_sdk_sts::Client;
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;

use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsCacheDownloadResult, AwsConnectionTestInput,
    AwsConnectionTestResult, AwsDeleteResult, AwsObjectSummary, AwsVirtualDirectorySummary,
};

pub struct AwsConnectionService;
const MISSING_MINIMUM_S3_PERMISSION_ERROR: &str = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
const RESTRICTED_BUCKET_MISMATCH_ERROR: &str = "AWS_S3_RESTRICTED_BUCKET_MISMATCH";
pub const DOWNLOAD_CANCELLED_ERROR: &str = "DOWNLOAD_CANCELLED";
pub const UPLOAD_CANCELLED_ERROR: &str = "UPLOAD_CANCELLED";
const DEFAULT_S3_LISTING_PAGE_SIZE: i32 = 200;
const MAX_S3_LISTING_PAGE_SIZE: i32 = 1000;
const S3_DELETE_BATCH_SIZE: usize = 1000;
const MULTIPART_UPLOAD_CHUNK_SIZE: usize = 8 * 1024 * 1024;
const S3_COPY_OBJECT_MAX_SIZE: u64 = 5 * 1024 * 1024 * 1024;
const S3_MULTIPART_MAX_PARTS: u64 = 10_000;
const AWS_DEFAULT_REGION: &str = "us-east-1";
const COPY_SOURCE_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'?')
    .add(b'[')
    .add(b'\\')
    .add(b']')
    .add(b'^')
    .add(b'`')
    .add(b'{')
    .add(b'|')
    .add(b'}');
const S3_TAGGING_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'&')
    .add(b'+')
    .add(b'=')
    .add(b'?');

struct AwsGlobalAccessContext {
    identity: AwsConnectionTestResult,
    s3_client: S3Client,
}

struct DownloadCancellationGuard {
    operation_id: String,
}

struct UploadCancellationGuard {
    operation_id: String,
}

static DOWNLOAD_CANCELLATIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static UPLOAD_CANCELLATIONS: LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

impl Drop for DownloadCancellationGuard {
    fn drop(&mut self) {
        if let Ok(mut cancellations) = DOWNLOAD_CANCELLATIONS.lock() {
            cancellations.remove(&self.operation_id);
        }
    }
}

impl Drop for UploadCancellationGuard {
    fn drop(&mut self) {
        if let Ok(mut cancellations) = UPLOAD_CANCELLATIONS.lock() {
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
        return format!(
            "{}: {} (request id: {})",
            error_code, error_message, request_id
        );
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

fn parse_upload_storage_class(value: Option<&str>) -> Result<Option<StorageClass>, String> {
    let Some(value) = value
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    StorageClass::try_parse(value)
        .map(Some)
        .map_err(|_| "Unsupported AWS upload storage class.".to_string())
}

fn parse_required_storage_class(value: &str) -> Result<StorageClass, String> {
    StorageClass::try_parse(value.trim()).map_err(|_| "Unsupported AWS storage class.".to_string())
}

fn build_copy_source(bucket_name: &str, object_key: &str) -> String {
    let encoded_object_key = utf8_percent_encode(object_key, COPY_SOURCE_ENCODE_SET).to_string();

    format!("{bucket_name}/{encoded_object_key}")
}

fn build_tagging_header(tag_set: &[aws_sdk_s3::types::Tag]) -> String {
    tag_set
        .iter()
        .map(|tag| {
            let key = tag.key();
            let value = tag.value();
            let encoded_key = utf8_percent_encode(key, S3_TAGGING_ENCODE_SET).to_string();
            let encoded_value = utf8_percent_encode(value, S3_TAGGING_ENCODE_SET).to_string();

            format!("{encoded_key}={encoded_value}")
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn calculate_multipart_copy_chunk_size(object_size: u64) -> u64 {
    let minimum_chunk_size = MULTIPART_UPLOAD_CHUNK_SIZE as u64;
    let required_chunk_size = object_size.div_ceil(S3_MULTIPART_MAX_PARTS);

    minimum_chunk_size.max(required_chunk_size)
}

fn normalize_listing_page_size(page_size: Option<i32>) -> i32 {
    match page_size.unwrap_or(DEFAULT_S3_LISTING_PAGE_SIZE) {
        value if value < 1 => 1,
        value if value > MAX_S3_LISTING_PAGE_SIZE => MAX_S3_LISTING_PAGE_SIZE,
        value => value,
    }
}

fn validate_restore_tier_for_storage_class(
    storage_class: Option<&str>,
    restore_tier: &Tier,
) -> Result<(), String> {
    let normalized_storage_class = storage_class
        .unwrap_or_default()
        .trim()
        .to_ascii_uppercase();

    if normalized_storage_class.contains("DEEP_ARCHIVE") && matches!(restore_tier, Tier::Expedited)
    {
        return Err(
            "Expedited restore is not supported for S3 Deep Archive objects. Choose Standard or Bulk."
                .to_string(),
        );
    }

    Ok(())
}

fn normalize_delete_object_keys(object_keys: Vec<String>) -> Vec<String> {
    let mut seen_keys = HashSet::new();
    let mut normalized_keys = Vec::new();

    for object_key in object_keys {
        let normalized_key = object_key.trim().trim_start_matches('/').to_string();

        if normalized_key.is_empty() {
            continue;
        }

        if seen_keys.insert(normalized_key.clone()) {
            normalized_keys.push(normalized_key);
        }
    }

    normalized_keys
}

fn validate_mutation_bucket_and_object(
    bucket_name: &str,
    object_key: &str,
    operation: &str,
) -> Result<(), String> {
    if bucket_name.trim().is_empty() {
        return Err(format!("Bucket name is required for {operation}."));
    }

    if object_key.trim().is_empty() {
        return Err(format!("Object key is required for {operation}."));
    }

    Ok(())
}

fn validate_restore_retention_days(days: i32) -> Result<(), String> {
    if !(1..=365).contains(&days) {
        return Err("Restore retention days must be between 1 and 365.".to_string());
    }

    Ok(())
}

fn normalize_recursive_delete_prefix(prefix: &str) -> Result<String, String> {
    let normalized_prefix = prefix
        .trim()
        .trim_start_matches('/')
        .trim_end_matches('/')
        .to_string();

    if normalized_prefix.is_empty() {
        return Err("Directory prefix is required for recursive delete requests.".to_string());
    }

    Ok(format!("{normalized_prefix}/"))
}

fn has_more_listing_results(
    is_truncated: Option<bool>,
    continuation_token: Option<&str>,
) -> bool {
    is_truncated.unwrap_or(false)
        && continuation_token
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false)
}

fn chunk_delete_object_keys(object_keys: &[String]) -> Vec<Vec<String>> {
    object_keys
        .chunks(S3_DELETE_BATCH_SIZE)
        .map(|chunk| chunk.to_vec())
        .collect()
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
        connection_name: &str,
    ) -> Result<PathBuf, String> {
        let normalized_connection_name = connection_name.trim();

        if normalized_connection_name.is_empty() {
            return Err("Connection name is required for local cache operations.".to_string());
        }

        Ok(
            PathBuf::from(global_local_cache_directory).join(Self::normalize_cache_path_segment(
                normalized_connection_name,
            )),
        )
    }

    fn build_primary_cache_object_path(
        global_local_cache_directory: &str,
        connection_name: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        if object_key.is_empty() {
            return Err("Object key is required for local cache operations.".to_string());
        }

        let normalized_object_path = object_key.split('/').fold(PathBuf::new(), |path, segment| {
            path.join(Self::normalize_cache_path_segment(segment))
        });

        Ok(
            Self::build_connection_cache_root(global_local_cache_directory, connection_name)?
                .join(bucket_name)
                .join(normalized_object_path),
        )
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

        let encoded_object_path = object_key.split('/').fold(PathBuf::new(), |path, segment| {
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

        let normalized_object_path = object_key.split('/').fold(PathBuf::new(), |path, segment| {
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
            connection_name,
            bucket_name,
            object_key,
        )?);

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
        connection_name: &str,
        bucket_name: &str,
        object_key: &str,
    ) -> Result<PathBuf, String> {
        let cache_object_path = Self::build_primary_cache_object_path(
            global_local_cache_directory,
            connection_name,
            bucket_name,
            object_key,
        )?;
        let connection_cache_root =
            Self::build_connection_cache_root(global_local_cache_directory, connection_name)?;
        let relative_path = cache_object_path
            .strip_prefix(&connection_cache_root)
            .map_err(|error| error.to_string())?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();

        Ok(PathBuf::from(global_local_cache_directory)
            .join(Self::CACHE_TEMP_DIRECTORY)
            .join(Self::normalize_cache_path_segment(connection_name.trim()))
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
        let (client, s3_client) = Self::build_clients(
            AWS_DEFAULT_REGION,
            access_key_id.to_string(),
            secret_access_key.to_string(),
        )
        .await;

        let identity_response = client.get_caller_identity().send().await.map_err(|error| {
            let error_message = error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string());

            eprintln!(
                "[aws_connection_service] STS caller identity failed for region={} error={}",
                AWS_DEFAULT_REGION, error_message
            );

            error_message
        })?;

        s3_client.list_buckets().send().await.map_err(|error| {
            let error_code = error
                .as_service_error()
                .and_then(ProvideErrorMetadata::code);
            let error_message = error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string());

            eprintln!(
                "[aws_connection_service] S3 list buckets failed for region={} error={}",
                AWS_DEFAULT_REGION, error_message
            );

            if matches!(
                error_code,
                Some("AccessDenied") | Some("UnauthorizedAccess")
            ) {
                return MISSING_MINIMUM_S3_PERMISSION_ERROR.to_string();
            }

            error_message
        })?;

        let identity = AwsConnectionTestResult {
            account_id: identity_response.account().unwrap_or_default().to_string(),
            arn: identity_response.arn().unwrap_or_default().to_string(),
            user_id: identity_response.user_id().unwrap_or_default().to_string(),
        };

        eprintln!(
            "[aws_connection_service] AWS global access flow succeeded with region={} account_id={}",
            AWS_DEFAULT_REGION, identity.account_id
        );

        Ok(AwsGlobalAccessContext {
            identity,
            s3_client,
        })
    }

    fn normalize_restricted_bucket_name(value: Option<String>) -> Option<String> {
        value.and_then(|value| {
            let trimmed = value.trim().to_string();
            (!trimmed.is_empty()).then_some(trimmed)
        })
    }

    fn validate_bucket_matches_restriction(
        bucket_name: &str,
        restricted_bucket_name: Option<&str>,
    ) -> Result<(), String> {
        if let Some(restricted_bucket_name) = restricted_bucket_name {
            if bucket_name != restricted_bucket_name {
                return Err(RESTRICTED_BUCKET_MISMATCH_ERROR.to_string());
            }
        }

        Ok(())
    }

    async fn resolve_identity(
        access_key_id: &str,
        secret_access_key: &str,
    ) -> Result<AwsConnectionTestResult, String> {
        let (client, _) = Self::build_clients(
            AWS_DEFAULT_REGION,
            access_key_id.to_string(),
            secret_access_key.to_string(),
        )
        .await;
        let identity_response = client.get_caller_identity().send().await.map_err(|error| {
            error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string())
        })?;

        Ok(AwsConnectionTestResult {
            account_id: identity_response.account().unwrap_or_default().to_string(),
            arn: identity_response.arn().unwrap_or_default().to_string(),
            user_id: identity_response.user_id().unwrap_or_default().to_string(),
        })
    }

    async fn verify_restricted_bucket_access(
        access_key_id: &str,
        secret_access_key: &str,
        bucket_name: &str,
    ) -> Result<AwsConnectionTestResult, String> {
        let identity = Self::resolve_identity(access_key_id, secret_access_key).await?;
        let resolved_bucket_region =
            Self::resolve_bucket_region(access_key_id, secret_access_key, bucket_name, None, None)
                .await?;
        let (_, s3_client) = Self::build_clients(
            &resolved_bucket_region,
            access_key_id.to_string(),
            secret_access_key.to_string(),
        )
        .await;

        s3_client
            .list_objects_v2()
            .bucket(bucket_name)
            .max_keys(1)
            .send()
            .await
            .map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

        Ok(identity)
    }

    async fn resolve_bucket_region(
        access_key_id: &str,
        secret_access_key: &str,
        bucket_name: &str,
        bucket_region: Option<String>,
        restricted_bucket_name: Option<String>,
    ) -> Result<String, String> {
        Self::validate_bucket_matches_restriction(bucket_name, restricted_bucket_name.as_deref())?;

        if let Some(bucket_region) = bucket_region {
            if !bucket_region.trim().is_empty() && bucket_region != "..." {
                return Ok(bucket_region);
            }
        }

        let (_, s3_client) = Self::build_clients(
            AWS_DEFAULT_REGION,
            access_key_id.to_string(),
            secret_access_key.to_string(),
        )
        .await;
        let bucket_location = s3_client
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

        Ok(normalize_bucket_region(
            bucket_location.location_constraint(),
        ))
    }

    pub async fn test_connection(
        input: AwsConnectionTestInput,
    ) -> Result<AwsConnectionTestResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        eprintln!("[aws_connection_service] testing AWS connection");

        if let Some(restricted_bucket_name) = restricted_bucket_name {
            let identity = Self::verify_restricted_bucket_access(
                &access_key_id,
                &secret_access_key,
                &restricted_bucket_name,
            )
            .await?;

            eprintln!(
                "[aws_connection_service] AWS restricted bucket access test succeeded for account_id={} bucket={}",
                identity.account_id, restricted_bucket_name
            );

            return Ok(identity);
        }

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
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        eprintln!("[aws_connection_service] listing S3 buckets");

        if let Some(restricted_bucket_name) = restricted_bucket_name {
            Self::verify_restricted_bucket_access(
                &access_key_id,
                &secret_access_key,
                &restricted_bucket_name,
            )
            .await?;

            return Ok(vec![AwsBucketSummary {
                name: restricted_bucket_name,
            }]);
        }

        let context =
            Self::resolve_global_access_context(&access_key_id, &secret_access_key).await?;
        let response = context
            .s3_client
            .list_buckets()
            .send()
            .await
            .map_err(|error| {
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
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
        let bucket_name = bucket_name.trim().to_string();

        eprintln!(
            "[aws_connection_service] resolving S3 bucket region for bucket={}",
            bucket_name
        );

        Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            None,
            restricted_bucket_name,
        )
        .await
        .map_err(|error_message| {
            eprintln!(
                "[aws_connection_service] failed to resolve region for bucket={} error={}",
                bucket_name, error_message
            );

            error_message
        })
    }

    pub async fn list_bucket_items(
        input: AwsConnectionTestInput,
        bucket_name: String,
        prefix: Option<String>,
        bucket_region: Option<String>,
        continuation_token: Option<String>,
        page_size: Option<i32>,
    ) -> Result<AwsBucketItemsResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let prefix = prefix.unwrap_or_default();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        eprintln!(
            "[aws_connection_service] listing S3 objects for bucket={} prefix={}",
            bucket_name, prefix
        );

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;
        let page_size = normalize_listing_page_size(page_size);

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let mut seen_directories = HashSet::new();
        let mut seen_files = HashSet::new();
        let mut directories = Vec::new();
        let mut files = Vec::new();
        let response = s3_client
            .list_objects_v2()
            .bucket(bucket_name.clone())
            .delimiter("/")
            .max_keys(page_size)
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
                    restore_in_progress: restore_status
                        .and_then(|status| status.is_restore_in_progress()),
                    restore_expiry_date: restore_status
                        .and_then(|status| status.restore_expiry_date())
                        .map(ToString::to_string),
                });
            }
        }

        let next_continuation_token = response.next_continuation_token().map(ToString::to_string);
        let has_more =
            has_more_listing_results(response.is_truncated(), next_continuation_token.as_deref());

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
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        validate_mutation_bucket_and_object(&bucket_name, &object_key, "restore requests")?;
        validate_restore_retention_days(days)?;

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
            restricted_bucket_name,
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

    pub async fn create_folder(
        input: AwsConnectionTestInput,
        bucket_name: String,
        parent_path: Option<String>,
        folder_name: String,
        bucket_region: Option<String>,
    ) -> Result<(), String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let folder_name = folder_name.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
        let normalized_parent_path = parent_path
            .unwrap_or_default()
            .trim()
            .trim_matches('/')
            .to_string();

        if bucket_name.is_empty() {
            return Err("Bucket name is required for folder creation.".to_string());
        }

        if folder_name.is_empty() {
            return Err("Folder name is required.".to_string());
        }

        if folder_name.contains('/') || folder_name.contains('\\') {
            return Err("Folder name cannot contain path separators.".to_string());
        }

        let folder_key = if normalized_parent_path.is_empty() {
            format!("{folder_name}/")
        } else {
            format!("{normalized_parent_path}/{folder_name}/")
        };

        eprintln!(
            "[aws_connection_service] creating S3 folder marker for bucket={} key={}",
            bucket_name, folder_key
        );

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        s3_client
            .put_object()
            .bucket(bucket_name.clone())
            .key(folder_key.clone())
            .body(ByteStream::from(Vec::<u8>::new()))
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to create S3 folder marker for bucket={} key={} error={}",
                    bucket_name, folder_key, error_message
                );

                error_message
            })?;

        Ok(())
    }

    pub async fn change_object_storage_class(
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        target_storage_class: String,
        bucket_region: Option<String>,
    ) -> Result<(), String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        validate_mutation_bucket_and_object(
            &bucket_name,
            &object_key,
            "storage class changes",
        )?;

        let storage_class = parse_required_storage_class(&target_storage_class)?;

        eprintln!(
            "[aws_connection_service] changing S3 storage class for bucket={} object_key={} target_storage_class={}",
            bucket_name, object_key, target_storage_class
        );

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let head_object_output = s3_client
            .head_object()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to read S3 object metadata for bucket={} object_key={} error={}",
                    bucket_name, object_key, error_message
                );

                error_message
            })?;

        let object_size = u64::try_from(head_object_output.content_length().ok_or_else(|| {
            "AWS S3 did not return the object size for storage class changes.".to_string()
        })?)
        .map_err(|_| {
            "AWS S3 returned an invalid object size for storage class changes.".to_string()
        })?;

        if object_size <= S3_COPY_OBJECT_MAX_SIZE {
            s3_client
                .copy_object()
                .bucket(bucket_name.clone())
                .key(object_key.clone())
                .copy_source(build_copy_source(&bucket_name, &object_key))
                .storage_class(storage_class)
                .metadata_directive(aws_sdk_s3::types::MetadataDirective::Copy)
                .send()
                .await
                .map_err(|error| {
                    let error_message = error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string());

                    eprintln!(
                        "[aws_connection_service] failed to change S3 storage class for bucket={} object_key={} error={}",
                        bucket_name, object_key, error_message
                    );

                    error_message
                })?;

            return Ok(());
        }

        let existing_tagging = s3_client
            .get_object_tagging()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .send()
            .await
            .map(|output| build_tagging_header(output.tag_set()))
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to read S3 object tags for bucket={} object_key={} error={}",
                    bucket_name, object_key, error_message
                );

                error_message
            })?;

        let mut create_multipart_upload_request = s3_client
            .create_multipart_upload()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .storage_class(storage_class);

        if !existing_tagging.is_empty() {
            create_multipart_upload_request =
                create_multipart_upload_request.tagging(existing_tagging);
        }

        if let Some(cache_control) = head_object_output.cache_control() {
            create_multipart_upload_request =
                create_multipart_upload_request.cache_control(cache_control);
        }

        if let Some(content_disposition) = head_object_output.content_disposition() {
            create_multipart_upload_request =
                create_multipart_upload_request.content_disposition(content_disposition);
        }

        if let Some(content_encoding) = head_object_output.content_encoding() {
            create_multipart_upload_request =
                create_multipart_upload_request.content_encoding(content_encoding);
        }

        if let Some(content_language) = head_object_output.content_language() {
            create_multipart_upload_request =
                create_multipart_upload_request.content_language(content_language);
        }

        if let Some(content_type) = head_object_output.content_type() {
            create_multipart_upload_request =
                create_multipart_upload_request.content_type(content_type);
        }

        if let Some(metadata) = head_object_output.metadata() {
            create_multipart_upload_request =
                create_multipart_upload_request.set_metadata(Some(metadata.clone()));
        }

        if let Some(website_redirect_location) = head_object_output.website_redirect_location() {
            create_multipart_upload_request = create_multipart_upload_request
                .website_redirect_location(website_redirect_location);
        }

        let multipart_upload = create_multipart_upload_request.send().await.map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());

                eprintln!(
                    "[aws_connection_service] failed to change S3 storage class for bucket={} object_key={} error={}",
                    bucket_name, object_key, error_message
                );

                error_message
            })?;

        let upload_id = multipart_upload
            .upload_id()
            .map(|value| value.to_string())
            .ok_or_else(|| {
                "AWS S3 did not return an upload identifier for multipart copy.".to_string()
            })?;
        let copy_source = build_copy_source(&bucket_name, &object_key);
        let part_size = calculate_multipart_copy_chunk_size(object_size);
        let mut completed_parts = Vec::new();
        let mut part_number = 1_i32;
        let mut range_start = 0_u64;

        while range_start < object_size {
            let range_end = (range_start + part_size).min(object_size) - 1;
            let copy_range = format!("bytes={range_start}-{range_end}");

            let upload_part_copy_output = match s3_client
                .upload_part_copy()
                .bucket(bucket_name.clone())
                .key(object_key.clone())
                .upload_id(upload_id.clone())
                .part_number(part_number)
                .copy_source(copy_source.clone())
                .copy_source_range(copy_range)
                .send()
                .await
            {
                Ok(output) => output,
                Err(error) => {
                    let _ = s3_client
                        .abort_multipart_upload()
                        .bucket(bucket_name.clone())
                        .key(object_key.clone())
                        .upload_id(upload_id.clone())
                        .send()
                        .await;

                    let error_message = error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string());

                    eprintln!(
                        "[aws_connection_service] failed to copy multipart chunk for bucket={} object_key={} part_number={} error={}",
                        bucket_name, object_key, part_number, error_message
                    );

                    return Err(error_message);
                }
            };

            let e_tag = upload_part_copy_output
                .copy_part_result()
                .and_then(|result| result.e_tag())
                .map(|value| value.to_string())
                .ok_or_else(|| {
                    "AWS S3 did not return an ETag for a multipart copied part.".to_string()
                })?;

            completed_parts.push(
                CompletedPart::builder()
                    .part_number(part_number)
                    .e_tag(e_tag)
                    .build(),
            );

            range_start = range_end + 1;
            part_number += 1;
        }

        let completed_upload = CompletedMultipartUpload::builder()
            .set_parts(Some(completed_parts))
            .build();

        if let Err(error) = s3_client
            .complete_multipart_upload()
            .bucket(bucket_name.clone())
            .key(object_key.clone())
            .upload_id(upload_id.clone())
            .multipart_upload(completed_upload)
            .send()
            .await
        {
            let _ = s3_client
                .abort_multipart_upload()
                .bucket(bucket_name.clone())
                .key(object_key.clone())
                .upload_id(upload_id)
                .send()
                .await;

            let error_message = error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string());

            eprintln!(
                "[aws_connection_service] failed to complete multipart copy for bucket={} object_key={} error={}",
                bucket_name, object_key, error_message
            );

            return Err(error_message);
        }

        Ok(())
    }

    async fn delete_object_keys(
        s3_client: &S3Client,
        bucket_name: &str,
        object_keys: &[String],
    ) -> Result<(), String> {
        for key_batch in chunk_delete_object_keys(object_keys) {
            let object_identifiers = key_batch
                .iter()
                .map(|object_key| ObjectIdentifier::builder().key(object_key).build())
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| error.to_string())?;
            let delete_request = Delete::builder()
                .set_objects(Some(object_identifiers))
                .quiet(true)
                .build()
                .map_err(|error| error.to_string())?;

            let response = s3_client
                .delete_objects()
                .bucket(bucket_name)
                .delete(delete_request)
                .send()
                .await
                .map_err(|error| {
                    error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string())
                })?;

            let delete_errors = response.errors();

            if !delete_errors.is_empty() {
                let error_descriptions = delete_errors
                    .iter()
                    .map(|error| {
                        let object_key = error.key().unwrap_or("<unknown>");
                        let code = error.code().unwrap_or("UnknownError");
                        let message = error
                            .message()
                            .filter(|message| !message.trim().is_empty())
                            .unwrap_or("The provider returned an error without details.");

                        format!("{object_key}: {code}: {message}")
                    })
                    .collect::<Vec<_>>()
                    .join("; ");

                return Err(format!(
                    "Failed to delete one or more AWS S3 objects. {error_descriptions}"
                ));
            }
        }

        Ok(())
    }

    pub async fn delete_objects(
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_keys: Vec<String>,
        bucket_region: Option<String>,
    ) -> Result<AwsDeleteResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let normalized_object_keys = normalize_delete_object_keys(object_keys);
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        if bucket_name.is_empty() {
            return Err("Bucket name is required for delete requests.".to_string());
        }

        if normalized_object_keys.is_empty() {
            return Err("At least one object key is required for delete requests.".to_string());
        }

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        Self::delete_object_keys(&s3_client, &bucket_name, &normalized_object_keys).await?;

        Ok(AwsDeleteResult {
            deleted_object_count: normalized_object_keys.len() as i64,
            deleted_directory_count: 0,
        })
    }

    pub async fn delete_prefix(
        input: AwsConnectionTestInput,
        bucket_name: String,
        prefix: String,
        bucket_region: Option<String>,
    ) -> Result<AwsDeleteResult, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
        if bucket_name.is_empty() {
            return Err("Bucket name is required for delete requests.".to_string());
        }

        let recursive_prefix = normalize_recursive_delete_prefix(&prefix)?;

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        let mut continuation_token = None;
        let mut object_keys = Vec::new();

        loop {
            let response = s3_client
                .list_objects_v2()
                .bucket(bucket_name.clone())
                .max_keys(DEFAULT_S3_LISTING_PAGE_SIZE)
                .set_prefix(Some(recursive_prefix.clone()))
                .set_continuation_token(continuation_token.clone())
                .send()
                .await
                .map_err(|error| {
                    error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string())
                })?;

            object_keys.extend(
                response
                    .contents()
                    .iter()
                    .filter_map(|object| object.key().map(ToString::to_string)),
            );

            let next_continuation_token =
                response.next_continuation_token().map(ToString::to_string);

            if !response.is_truncated().unwrap_or(false) || next_continuation_token.is_none() {
                break;
            }

            continuation_token = next_continuation_token;
        }

        object_keys.push(recursive_prefix.clone());

        let normalized_object_keys = normalize_delete_object_keys(object_keys);
        Self::delete_object_keys(&s3_client, &bucket_name, &normalized_object_keys).await?;

        Ok(AwsDeleteResult {
            deleted_object_count: normalized_object_keys.len() as i64,
            deleted_directory_count: 1,
        })
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
        let _connection_id = connection_id.trim().to_string();
        let connection_name = connection_name.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
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
            restricted_bucket_name,
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
            &connection_name,
            &bucket_name,
            &object_key,
        )?;
        let temp_path = Self::build_cache_temp_object_path(
            &global_local_cache_directory,
            &connection_name,
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

        while let Some(chunk) = stream.try_next().await.map_err(|error| error.to_string())? {
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
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
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
            restricted_bucket_name,
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

        while let Some(chunk) = stream.try_next().await.map_err(|error| error.to_string())? {
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

    pub async fn object_exists(
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        bucket_region: Option<String>,
    ) -> Result<bool, String> {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);

        if object_key.is_empty() {
            return Err("Object key is required.".to_string());
        }

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        match s3_client
            .head_object()
            .bucket(bucket_name)
            .key(object_key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(error) => {
                if let Some(service_error) = error.as_service_error() {
                    if service_error.code() == Some("NotFound") {
                        return Ok(false);
                    }
                }

                Err(error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string()))
            }
        }
    }

    pub async fn upload_object_from_path<F>(
        operation_id: String,
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        local_file_path: String,
        storage_class: Option<String>,
        bucket_region: Option<String>,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64) -> Result<(), String>,
    {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let local_file_path = local_file_path.trim().to_string();
        let storage_class = parse_upload_storage_class(storage_class.as_deref())?;
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
        let (cancellation_flag, _cancellation_guard) =
            Self::register_upload_cancellation(&operation_id)?;

        if object_key.is_empty() {
            return Err("Object key is required for uploads.".to_string());
        }

        if local_file_path.is_empty() {
            return Err("Local file path is required for uploads.".to_string());
        }

        let file_path = PathBuf::from(&local_file_path);
        let metadata = fs::metadata(&file_path)
            .await
            .map_err(|error| error.to_string())?;

        if !metadata.is_file() {
            return Err("The selected local path is not a regular file.".to_string());
        }

        let total_bytes = i64::try_from(metadata.len())
            .map_err(|_| "The selected file is too large to upload.".to_string())?;

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(UPLOAD_CANCELLED_ERROR.to_string());
        }

        if metadata.len() <= MULTIPART_UPLOAD_CHUNK_SIZE as u64 {
            let body = ByteStream::from_path(&file_path)
                .await
                .map_err(|error| error.to_string())?;

            let mut request = s3_client
                .put_object()
                .bucket(bucket_name)
                .key(object_key)
                .body(body);

            if let Some(storage_class) = storage_class {
                request = request.storage_class(storage_class);
            }

            request.send().await.map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

            // Single-request uploads cannot be interrupted once the provider call is in flight.
            // If the request succeeded, treat it as completed even if a local cancel was requested
            // while waiting for the response.
            on_progress(total_bytes, total_bytes)?;

            return Ok(local_file_path);
        }

        let mut create_request = s3_client
            .create_multipart_upload()
            .bucket(bucket_name.clone())
            .key(object_key.clone());

        if let Some(storage_class) = storage_class.clone() {
            create_request = create_request.storage_class(storage_class);
        }

        let multipart_upload = create_request.send().await.map_err(|error| {
            error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string())
        })?;

        let upload_id = multipart_upload
            .upload_id()
            .map(|value| value.to_string())
            .ok_or_else(|| "AWS S3 did not return an upload identifier.".to_string())?;
        let mut file = fs::File::open(&file_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut completed_parts = Vec::new();
        let mut next_part_number = 1_i32;
        let mut transferred_bytes = 0_i64;
        let mut chunk_buffer = vec![0_u8; MULTIPART_UPLOAD_CHUNK_SIZE];

        loop {
            if cancellation_flag.load(Ordering::SeqCst) {
                let _ = s3_client
                    .abort_multipart_upload()
                    .bucket(bucket_name.clone())
                    .key(object_key.clone())
                    .upload_id(upload_id.clone())
                    .send()
                    .await;

                return Err(UPLOAD_CANCELLED_ERROR.to_string());
            }

            let bytes_read = file
                .read(&mut chunk_buffer)
                .await
                .map_err(|error| error.to_string())?;

            if bytes_read == 0 {
                break;
            }

            let body = ByteStream::from(chunk_buffer[..bytes_read].to_vec());
            let upload_part_output = match s3_client
                .upload_part()
                .bucket(bucket_name.clone())
                .key(object_key.clone())
                .upload_id(upload_id.clone())
                .part_number(next_part_number)
                .body(body)
                .send()
                .await
            {
                Ok(output) => output,
                Err(error) => {
                    let _ = s3_client
                        .abort_multipart_upload()
                        .bucket(bucket_name.clone())
                        .key(object_key.clone())
                        .upload_id(upload_id.clone())
                        .send()
                        .await;

                    return Err(error
                        .as_service_error()
                        .map(format_provider_service_error)
                        .unwrap_or_else(|| error.to_string()));
                }
            };

            let e_tag = upload_part_output
                .e_tag()
                .map(|value| value.to_string())
                .ok_or_else(|| "AWS S3 did not return an ETag for an uploaded part.".to_string())?;
            let completed_part = CompletedPart::builder()
                .e_tag(e_tag)
                .part_number(next_part_number)
                .build();

            completed_parts.push(completed_part);
            transferred_bytes += bytes_read as i64;
            on_progress(transferred_bytes, total_bytes)?;
            next_part_number += 1;
        }

        if cancellation_flag.load(Ordering::SeqCst) {
            let _ = s3_client
                .abort_multipart_upload()
                .bucket(bucket_name.clone())
                .key(object_key.clone())
                .upload_id(upload_id.clone())
                .send()
                .await;

            return Err(UPLOAD_CANCELLED_ERROR.to_string());
        }

        let completed_upload = CompletedMultipartUpload::builder()
            .set_parts(Some(completed_parts))
            .build();

        s3_client
            .complete_multipart_upload()
            .bucket(bucket_name)
            .key(object_key)
            .upload_id(upload_id)
            .multipart_upload(completed_upload)
            .send()
            .await
            .map_err(|error| {
                error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string())
            })?;

        Ok(local_file_path)
    }

    pub async fn upload_object_from_bytes<F>(
        operation_id: String,
        input: AwsConnectionTestInput,
        bucket_name: String,
        object_key: String,
        file_name: String,
        file_bytes: Vec<u8>,
        storage_class: Option<String>,
        bucket_region: Option<String>,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64) -> Result<(), String>,
    {
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();
        let bucket_name = bucket_name.trim().to_string();
        let object_key = object_key.trim().to_string();
        let file_name = file_name.trim().to_string();
        let storage_class = parse_upload_storage_class(storage_class.as_deref())?;
        let restricted_bucket_name =
            Self::normalize_restricted_bucket_name(input.restricted_bucket_name);
        let (cancellation_flag, _cancellation_guard) =
            Self::register_upload_cancellation(&operation_id)?;

        if object_key.is_empty() {
            return Err("Object key is required for uploads.".to_string());
        }

        if file_name.is_empty() {
            return Err("File name is required for uploads.".to_string());
        }

        let total_bytes = i64::try_from(file_bytes.len())
            .map_err(|_| "The selected file is too large to upload.".to_string())?;

        let resolved_bucket_region = Self::resolve_bucket_region(
            &access_key_id,
            &secret_access_key,
            &bucket_name,
            bucket_region,
            restricted_bucket_name,
        )
        .await?;

        let (_, s3_client) =
            Self::build_clients(&resolved_bucket_region, access_key_id, secret_access_key).await;

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(UPLOAD_CANCELLED_ERROR.to_string());
        }

        let mut request = s3_client
            .put_object()
            .bucket(bucket_name)
            .key(object_key)
            .body(ByteStream::from(file_bytes));

        if let Some(storage_class) = storage_class {
            request = request.storage_class(storage_class);
        }

        request.send().await.map_err(|error| {
            error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string())
        })?;

        // Byte-backed uploads use the same single-request PutObject path and share the same
        // cancellation limitation as small path uploads.
        on_progress(total_bytes, total_bytes)?;

        Ok(file_name)
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
        let object_path = Self::resolve_cached_object_path(
            connection_id,
            connection_name,
            bucket_name,
            global_local_cache_directory,
            object_key,
        )
        .await?;

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

    pub async fn open_cached_object(
        connection_id: String,
        connection_name: String,
        bucket_name: String,
        global_local_cache_directory: String,
        object_key: String,
    ) -> Result<(), String> {
        let object_path = Self::resolve_cached_object_path(
            connection_id,
            connection_name,
            bucket_name,
            global_local_cache_directory,
            object_key,
        )
        .await?;

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("cmd");
            command.args(["/C", "start", "", object_path.to_string_lossy().as_ref()]);
            command
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut command = Command::new("open");
            command.arg(&object_path);
            command
        };

        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut command = Command::new("xdg-open");
            command.arg(&object_path);
            command
        };

        command.spawn().map_err(|error| error.to_string())?;

        Ok(())
    }

    async fn resolve_cached_object_path(
        connection_id: String,
        connection_name: String,
        bucket_name: String,
        global_local_cache_directory: String,
        object_key: String,
    ) -> Result<PathBuf, String> {
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
        Ok(object_path)
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

    fn register_upload_cancellation(
        operation_id: &str,
    ) -> Result<(Arc<AtomicBool>, UploadCancellationGuard), String> {
        let cancellation_flag = Arc::new(AtomicBool::new(false));
        let mut cancellations = UPLOAD_CANCELLATIONS
            .lock()
            .map_err(|_| "Unable to access upload cancellation state.".to_string())?;

        cancellations.insert(operation_id.to_string(), cancellation_flag.clone());

        Ok((
            cancellation_flag,
            UploadCancellationGuard {
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

    pub fn cancel_upload(operation_id: String) -> Result<bool, String> {
        let cancellations = UPLOAD_CANCELLATIONS
            .lock()
            .map_err(|_| "Unable to access upload cancellation state.".to_string())?;

        let Some(cancellation_flag) = cancellations.get(&operation_id) else {
            return Ok(false);
        };

        cancellation_flag.store(true, Ordering::SeqCst);

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::Ordering;

    #[test]
    fn normalizes_listing_page_size_with_bounds() {
        assert_eq!(normalize_listing_page_size(None), DEFAULT_S3_LISTING_PAGE_SIZE);
        assert_eq!(normalize_listing_page_size(Some(0)), 1);
        assert_eq!(normalize_listing_page_size(Some(5000)), MAX_S3_LISTING_PAGE_SIZE);
        assert_eq!(normalize_listing_page_size(Some(250)), 250);
    }

    #[test]
    fn normalizes_delete_object_keys() {
        let normalized = normalize_delete_object_keys(vec![
            " docs/file.txt ".to_string(),
            "/docs/file.txt".to_string(),
            "".to_string(),
            "   ".to_string(),
            "docs/other.txt".to_string(),
        ]);

        assert_eq!(normalized, vec!["docs/file.txt", "docs/other.txt"]);
    }

    #[test]
    fn validates_restore_tier_for_storage_class() {
        assert!(validate_restore_tier_for_storage_class(Some("GLACIER"), &Tier::Expedited).is_ok());
        assert!(
            validate_restore_tier_for_storage_class(Some("DEEP_ARCHIVE"), &Tier::Expedited)
                .is_err()
        );
        assert!(validate_restore_tier_for_storage_class(Some("DEEP_ARCHIVE"), &Tier::Bulk).is_ok());
    }

    #[test]
    fn builds_copy_source_with_expected_encoding() {
        let value = build_copy_source("bucket-a", "folder name/file#1?.txt");
        assert_eq!(value, "bucket-a/folder%20name/file%231%3F.txt");
    }

    #[test]
    fn builds_tagging_header_with_expected_encoding() {
        let tag_a = aws_sdk_s3::types::Tag::builder()
            .key("team name")
            .value("ops & finance")
            .build()
            .expect("valid tag");
        let tag_b = aws_sdk_s3::types::Tag::builder()
            .key("env")
            .value("prod=blue")
            .build()
            .expect("valid tag");

        let header = build_tagging_header(&[tag_a, tag_b]);

        assert_eq!(header, "team%20name=ops%20%26%20finance&env=prod%3Dblue");
    }

    #[test]
    fn calculates_multipart_copy_chunk_size_without_exceeding_limits() {
        assert_eq!(
            calculate_multipart_copy_chunk_size(1024),
            MULTIPART_UPLOAD_CHUNK_SIZE as u64
        );

        let very_large_object = S3_MULTIPART_MAX_PARTS * MULTIPART_UPLOAD_CHUNK_SIZE as u64 * 2;
        assert_eq!(
            calculate_multipart_copy_chunk_size(very_large_object),
            very_large_object.div_ceil(S3_MULTIPART_MAX_PARTS)
        );
    }

    #[test]
    fn normalizes_cache_paths_and_rejects_empty_object_keys() {
        let reserved = AwsConnectionService::normalize_cache_path_segment("..");
        assert!(reserved.starts_with(AwsConnectionService::CACHE_ESCAPED_SEGMENT_PREFIX));

        let path = AwsConnectionService::build_primary_cache_object_path(
            "/tmp/cache",
            " Primary Connection ",
            "bucket-a",
            "docs/report.txt",
        )
        .unwrap();

        assert_eq!(
            path,
            PathBuf::from("/tmp/cache")
                .join("Primary Connection")
                .join("bucket-a")
                .join("docs")
                .join("report.txt")
        );

        assert!(
            AwsConnectionService::build_primary_cache_object_path(
                "/tmp/cache",
                "Primary Connection",
                "bucket-a",
                "",
            )
            .is_err()
        );
    }

    #[test]
    fn builds_cache_path_candidates_and_temp_files_with_expected_structure() {
        let candidates = AwsConnectionService::build_cache_object_path_candidates(
            "/tmp/cache",
            "connection-123",
            "Primary Connection",
            "bucket-a",
            "docs/report.txt",
        )
        .unwrap();

        assert_eq!(candidates.len(), 4);
        assert_eq!(
            candidates[0],
            PathBuf::from("/tmp/cache")
                .join("Primary Connection")
                .join("bucket-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[1],
            PathBuf::from("/tmp/cache")
                .join("bucket-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[2],
            PathBuf::from("/tmp/cache")
                .join("connection-123")
                .join("bucket-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[3],
            PathBuf::from("/tmp/cache")
                .join("connection-123")
                .join("bucket-a")
                .join(AwsConnectionService::encode_cache_path_segment("docs"))
                .join(AwsConnectionService::encode_cache_path_segment("report.txt"))
        );

        let temp_cache_path = AwsConnectionService::build_cache_temp_object_path(
            "/tmp/cache",
            "Primary Connection",
            "bucket-a",
            "docs/report.txt",
        )
        .unwrap();

        assert!(temp_cache_path.starts_with(
            PathBuf::from("/tmp/cache")
                .join(AwsConnectionService::CACHE_TEMP_DIRECTORY)
                .join("Primary Connection")
        ));
        assert_eq!(
            temp_cache_path.file_stem().and_then(|value| value.to_str()),
            Some("report")
        );
        assert!(
            temp_cache_path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.starts_with("part-"))
        );

        let temp_file_path =
            AwsConnectionService::build_temp_file_path(Path::new("/tmp/downloads/report.txt"))
                .unwrap();
        let temp_file_name = temp_file_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap();
        let temp_directory_path =
            AwsConnectionService::build_temp_file_path(Path::new("/tmp/downloads")).unwrap();
        let temp_directory_name = temp_directory_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap();

        assert!(temp_file_path.starts_with("/tmp/downloads"));
        assert!(temp_file_name.starts_with(".report.txt.cloudeasyfiles.part-"));
        assert!(temp_directory_path.starts_with("/tmp"));
        assert!(temp_directory_name.starts_with(".downloads.cloudeasyfiles.part-"));
    }

    #[test]
    fn parses_storage_classes_restore_tiers_and_directory_names() {
        assert_eq!(build_directory_name("docs/reports/"), "reports");
        assert_eq!(build_directory_name("/"), "/");
        assert_eq!(
            normalize_bucket_region(Some(&BucketLocationConstraint::Eu)),
            "eu-west-1"
        );
        assert_eq!(normalize_bucket_region(None), "us-east-1");

        assert!(matches!(parse_restore_tier(" expedited "), Ok(Tier::Expedited)));
        assert!(matches!(
            parse_upload_storage_class(Some(" STANDARD_IA ")),
            Ok(Some(StorageClass::StandardIa))
        ));
        assert!(matches!(
            parse_required_storage_class("GLACIER"),
            Ok(StorageClass::Glacier)
        ));
        assert!(parse_restore_tier("instant").is_err());
        assert!(parse_upload_storage_class(Some("invalid-tier")).is_err());
        assert!(parse_required_storage_class("invalid-tier").is_err());
        assert_eq!(parse_upload_storage_class(None).unwrap(), None);
    }

    #[test]
    fn normalizes_and_enforces_restricted_bucket_names() {
        assert_eq!(
            AwsConnectionService::normalize_restricted_bucket_name(Some(" bucket-a ".to_string())),
            Some("bucket-a".to_string())
        );
        assert_eq!(
            AwsConnectionService::normalize_restricted_bucket_name(Some("   ".to_string())),
            None
        );
        assert!(
            AwsConnectionService::validate_bucket_matches_restriction(
                "bucket-a",
                Some("bucket-a")
            )
            .is_ok()
        );
        assert!(
            AwsConnectionService::validate_bucket_matches_restriction(
                "bucket-b",
                Some("bucket-a")
            )
            .is_err()
        );
    }

    #[test]
    fn validates_mutation_inputs_for_restore_tier_change_and_delete() {
        assert!(
            validate_mutation_bucket_and_object("bucket-a", "docs/file.txt", "restore requests")
                .is_ok()
        );
        assert!(
            validate_mutation_bucket_and_object("", "docs/file.txt", "restore requests").is_err()
        );
        assert!(
            validate_mutation_bucket_and_object("bucket-a", "   ", "storage class changes")
                .is_err()
        );

        assert!(validate_restore_retention_days(1).is_ok());
        assert!(validate_restore_retention_days(365).is_ok());
        assert!(validate_restore_retention_days(0).is_err());
        assert!(validate_restore_retention_days(366).is_err());

        assert_eq!(
            normalize_recursive_delete_prefix(" /docs/reports/ ").unwrap(),
            "docs/reports/"
        );
        assert!(normalize_recursive_delete_prefix(" / ").is_err());
    }

    #[test]
    fn handles_listing_pagination_and_delete_batch_chunking() {
        assert!(has_more_listing_results(Some(true), Some("cursor-1")));
        assert!(!has_more_listing_results(Some(false), Some("cursor-1")));
        assert!(!has_more_listing_results(Some(true), Some("   ")));
        assert!(!has_more_listing_results(None, None));

        let object_keys = (0..(S3_DELETE_BATCH_SIZE + 3))
            .map(|index| format!("docs/file-{index}.txt"))
            .collect::<Vec<_>>();
        let batches = chunk_delete_object_keys(&object_keys);

        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].len(), S3_DELETE_BATCH_SIZE);
        assert_eq!(batches[1].len(), 3);
        assert_eq!(batches[0][0], "docs/file-0.txt");
        assert_eq!(batches[1][2], format!("docs/file-{}.txt", S3_DELETE_BATCH_SIZE + 2));
    }

    #[tokio::test]
    async fn resolves_cached_object_path_and_cleans_up_temp_files() {
        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-aws-cache-test-{}",
            std::process::id()
        ));
        let recent_legacy_path = AwsConnectionService::build_recent_legacy_cache_object_path(
            temp_root.to_str().unwrap(),
            "bucket-a",
            "docs/report.txt",
        )
        .unwrap();

        fs::create_dir_all(recent_legacy_path.parent().unwrap())
            .await
            .unwrap();
        fs::write(&recent_legacy_path, b"cached")
            .await
            .unwrap();

        let resolved = AwsConnectionService::resolve_cached_object_path(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/report.txt".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(resolved, recent_legacy_path);

        let temp_file = temp_root.join("downloads").join(".report.txt.part");
        fs::create_dir_all(temp_file.parent().unwrap()).await.unwrap();
        fs::write(&temp_file, b"partial").await.unwrap();

        AwsConnectionService::remove_temp_file_if_exists(&temp_file)
            .await
            .unwrap();
        assert!(!fs::try_exists(&temp_file).await.unwrap());
        AwsConnectionService::remove_temp_file_if_exists(&temp_file)
            .await
            .unwrap();

        let missing = AwsConnectionService::resolve_cached_object_path(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/missing.txt".to_string(),
        )
        .await;
        assert!(missing.is_err());

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[test]
    fn rejects_non_http_external_urls() {
        assert!(AwsConnectionService::open_external_url("   file:///tmp/report.txt   ".to_string())
            .is_err());
        assert!(AwsConnectionService::open_external_url("mailto:user@example.com".to_string())
            .is_err());
    }

    #[tokio::test]
    async fn finds_cached_objects_from_available_candidates() {
        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-aws-find-cache-test-{}",
            std::process::id()
        ));
        let existing_primary = AwsConnectionService::build_primary_cache_object_path(
            temp_root.to_str().unwrap(),
            "Primary Connection",
            "bucket-a",
            "docs/report.txt",
        )
        .unwrap();
        let existing_legacy = AwsConnectionService::build_legacy_raw_cache_object_path(
            temp_root.to_str().unwrap(),
            "connection-123",
            "bucket-a",
            "docs/archive.zip",
        )
        .unwrap();

        fs::create_dir_all(existing_primary.parent().unwrap())
            .await
            .unwrap();
        fs::create_dir_all(existing_legacy.parent().unwrap())
            .await
            .unwrap();
        fs::write(&existing_primary, b"cached-primary").await.unwrap();
        fs::write(&existing_legacy, b"cached-legacy").await.unwrap();

        let cached = AwsConnectionService::find_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            vec![
                " docs/report.txt ".to_string(),
                "docs/archive.zip".to_string(),
                "".to_string(),
                "docs/missing.txt".to_string(),
            ],
        )
        .await
        .unwrap();

        assert_eq!(cached, vec!["docs/report.txt", "docs/archive.zip"]);
        assert!(
            AwsConnectionService::find_cached_objects(
                "connection-123".to_string(),
                "Primary Connection".to_string(),
                "bucket-a".to_string(),
                "   ".to_string(),
                vec!["docs/report.txt".to_string()],
            )
            .await
            .unwrap()
            .is_empty()
        );

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[test]
    fn registers_and_cancels_transfers() {
        let download_operation_id = format!("download-{}", std::process::id());
        let upload_operation_id = format!("upload-{}", std::process::id());

        {
            let (download_flag, download_guard) =
                AwsConnectionService::register_download_cancellation(&download_operation_id)
                    .unwrap();
            let (upload_flag, upload_guard) =
                AwsConnectionService::register_upload_cancellation(&upload_operation_id).unwrap();

            assert!(AwsConnectionService::cancel_download(download_operation_id.clone()).unwrap());
            assert!(AwsConnectionService::cancel_upload(upload_operation_id.clone()).unwrap());
            assert!(download_flag.load(Ordering::SeqCst));
            assert!(upload_flag.load(Ordering::SeqCst));

            drop(download_guard);
            drop(upload_guard);
        }

        assert!(!AwsConnectionService::cancel_download(download_operation_id).unwrap());
        assert!(!AwsConnectionService::cancel_upload(upload_operation_id).unwrap());
    }
}
