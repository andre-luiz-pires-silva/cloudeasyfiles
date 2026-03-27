use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::types::BucketLocationConstraint;
use aws_sdk_sts::error::ProvideErrorMetadata;
use aws_sdk_sts::operation::RequestId;
use aws_sdk_sts::Client;

use crate::domain::aws_connection::{
    AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
};

pub struct AwsConnectionService;
const MISSING_MINIMUM_S3_PERMISSION_ERROR: &str = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
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

}
