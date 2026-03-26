use crate::application::services::aws_connection_secret_service::AwsConnectionSecretService;
use crate::application::services::greeting_service::GreetingService;
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
