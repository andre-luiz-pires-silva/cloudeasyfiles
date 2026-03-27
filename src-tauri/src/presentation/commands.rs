use crate::application::services::aws_connection_service::AwsConnectionService;
use crate::application::services::aws_connection_secret_service::AwsConnectionSecretService;
use crate::application::services::greeting_service::GreetingService;
use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
};
use crate::domain::connection_secrets::{AwsConnectionSecretsInput, AwsConnectionSecretsOutput};

#[tauri::command]
pub async fn get_greeting(locale: Option<String>) -> String {
    let locale = locale.unwrap_or_else(|| "en-US".to_string());

    GreetingService::build_startup_greeting(&locale)
        .message()
        .to_string()
}

#[tauri::command]
pub async fn save_aws_connection_secrets(
    connection_id: String,
    access_key_id: String,
    secret_access_key: String,
) -> Result<(), String> {
    eprintln!(
        "[commands] save_aws_connection_secrets called for connection_id={}",
        connection_id
    );

    let result = AwsConnectionSecretService::save(AwsConnectionSecretsInput {
        connection_id,
        access_key_id,
        secret_access_key,
    });

    if let Err(error) = &result {
        eprintln!(
            "[commands] save_aws_connection_secrets failed with error={}",
            error
        );
    }

    result
}

#[tauri::command]
pub async fn load_aws_connection_secrets(
    connection_id: String,
) -> Result<AwsConnectionSecretsOutput, String> {
    eprintln!(
        "[commands] load_aws_connection_secrets called for connection_id={}",
        connection_id
    );

    let result = AwsConnectionSecretService::load(&connection_id);

    if let Err(error) = &result {
        eprintln!(
            "[commands] load_aws_connection_secrets failed for connection_id={} with error={}",
            connection_id, error
        );
    }

    result
}

#[tauri::command]
pub async fn delete_aws_connection_secrets(connection_id: String) -> Result<(), String> {
    eprintln!(
        "[commands] delete_aws_connection_secrets called for connection_id={}",
        connection_id
    );

    let result = AwsConnectionSecretService::delete(&connection_id);

    if let Err(error) = &result {
        eprintln!(
            "[commands] delete_aws_connection_secrets failed for connection_id={} with error={}",
            connection_id, error
        );
    }

    result
}

#[tauri::command]
pub async fn test_aws_connection(
    access_key_id: String,
    secret_access_key: String,
) -> Result<AwsConnectionTestResult, String> {
    eprintln!("[commands] test_aws_connection called");

    let result = AwsConnectionService::test_connection(AwsConnectionTestInput {
        access_key_id,
        secret_access_key,
    })
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] test_aws_connection failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn list_aws_buckets(
    access_key_id: String,
    secret_access_key: String,
) -> Result<Vec<AwsBucketSummary>, String> {
    eprintln!("[commands] list_aws_buckets called");

    let result = AwsConnectionService::list_buckets(AwsConnectionTestInput {
        access_key_id,
        secret_access_key,
    })
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] list_aws_buckets failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn get_aws_bucket_region(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
) -> Result<String, String> {
    eprintln!(
        "[commands] get_aws_bucket_region called for bucket_name={}",
        bucket_name
    );

    let result = AwsConnectionService::get_bucket_region(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
        },
        bucket_name,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] get_aws_bucket_region failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn list_aws_bucket_items(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    prefix: Option<String>,
    bucket_region: Option<String>,
) -> Result<AwsBucketItemsResult, String> {
    eprintln!(
        "[commands] list_aws_bucket_items called for bucket_name={} prefix={}",
        bucket_name,
        prefix.clone().unwrap_or_default()
    );

    let result = AwsConnectionService::list_bucket_items(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
        },
        bucket_name,
        prefix,
        bucket_region,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] list_aws_bucket_items failed with error={}", error);
    }

    result
}
