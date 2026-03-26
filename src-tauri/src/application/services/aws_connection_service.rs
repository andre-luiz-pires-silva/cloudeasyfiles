use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_sts::error::ProvideErrorMetadata;
use aws_sdk_sts::operation::RequestId;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_sts::Client;

use crate::domain::aws_connection::{AwsConnectionTestInput, AwsConnectionTestResult};

pub struct AwsConnectionService;
const MISSING_MINIMUM_S3_PERMISSION_ERROR: &str = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";

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

impl AwsConnectionService {
    pub async fn test_connection(
        input: AwsConnectionTestInput,
    ) -> Result<AwsConnectionTestResult, String> {
        let region = input.region.trim().to_string();
        let access_key_id = input.access_key_id.trim().to_string();
        let secret_access_key = input.secret_access_key.trim().to_string();

        eprintln!(
            "[aws_connection_service] testing AWS connection for region={}",
            region
        );

        let credentials = Credentials::new(
            access_key_id,
            secret_access_key,
            None,
            None,
            "CloudEasyFilesConnectionTest",
        );

        let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region.clone()))
            .credentials_provider(credentials)
            .load()
            .await;

        let client = Client::new(&config);
        let response = client
            .get_caller_identity()
            .send()
            .await
            .map_err(|error| {
                let error_message = error
                    .as_service_error()
                    .map(format_provider_service_error)
                    .unwrap_or_else(|| error.to_string());
                eprintln!(
                    "[aws_connection_service] AWS connection test failed for region={} error={}",
                    region, error_message
                );
                error_message
            })?;

        let s3_client = S3Client::new(&config);
        s3_client.list_buckets().send().await.map_err(|error| {
            let error_code = error
                .as_service_error()
                .and_then(ProvideErrorMetadata::code);
            let error_message = error
                .as_service_error()
                .map(format_provider_service_error)
                .unwrap_or_else(|| error.to_string());

            if matches!(error_code, Some("AccessDenied") | Some("UnauthorizedAccess")) {
                eprintln!(
                    "[aws_connection_service] AWS connection test failed for region={} due to missing s3:ListAllMyBuckets permission error={}",
                    region, error_message
                );

                return MISSING_MINIMUM_S3_PERMISSION_ERROR.to_string();
            }

            eprintln!(
                "[aws_connection_service] AWS connection test failed while listing buckets for region={} error={}",
                region, error_message
            );

            format!(
                "AWS credentials are valid, but listing S3 buckets failed: {}",
                error_message
            )
        })?;

        let account_id = response.account().unwrap_or_default().to_string();
        let arn = response.arn().unwrap_or_default().to_string();
        let user_id = response.user_id().unwrap_or_default().to_string();

        eprintln!(
            "[aws_connection_service] AWS connection test succeeded for region={} account_id={} and s3:ListAllMyBuckets is available",
            region, account_id
        );

        Ok(AwsConnectionTestResult {
            account_id,
            arn,
            user_id,
        })
    }
}
