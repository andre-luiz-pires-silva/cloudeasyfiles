use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::types::BucketLocationConstraint;
use aws_sdk_sts::error::ProvideErrorMetadata;
use aws_sdk_sts::operation::RequestId;
use aws_sdk_sts::Client;
use std::collections::HashSet;

use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
    AwsObjectSummary, AwsVirtualDirectorySummary,
};

pub struct AwsConnectionService;
const MISSING_MINIMUM_S3_PERMISSION_ERROR: &str = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
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

impl AwsConnectionService {
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
}
