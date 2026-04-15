use crate::application::services::azure_connection_secret_service::AzureConnectionSecretService;
use crate::application::services::azure_connection_service::{
    AzureConnectionService, AZURE_DOWNLOAD_CANCELLED_ERROR, AZURE_UPLOAD_CANCELLED_ERROR,
};
use crate::application::services::aws_connection_secret_service::AwsConnectionSecretService;
use crate::application::services::aws_connection_service::{
    AwsConnectionService, DOWNLOAD_CANCELLED_ERROR, UPLOAD_CANCELLED_ERROR,
};
use crate::application::services::greeting_service::GreetingService;
use crate::domain::azure_connection::{
    AzureCacheDownloadResult, AzureConnectionTestInput, AzureConnectionTestResult,
    AzureContainerItemsResult, AzureContainerSummary, AzureDeleteResult,
};
use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
    AwsDeleteResult,
};
use crate::domain::connection_secrets::{
    AwsConnectionSecretsInput, AwsConnectionSecretsOutput, AzureConnectionSecretsInput,
    AzureConnectionSecretsOutput,
};
use serde::Serialize;
use tauri::{Emitter, Window};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AwsDownloadEvent {
    operation_id: String,
    transfer_kind: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    bytes_received: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: String,
    error: Option<String>,
}

fn is_cancelled_download_error(error: &str) -> bool {
    error == DOWNLOAD_CANCELLED_ERROR
}

fn is_cancelled_upload_error(error: &str) -> bool {
    error == UPLOAD_CANCELLED_ERROR
}

fn is_cancelled_azure_upload_error(error: &str) -> bool {
    error == AZURE_UPLOAD_CANCELLED_ERROR
}

fn is_cancelled_azure_download_error(error: &str) -> bool {
    error == AZURE_DOWNLOAD_CANCELLED_ERROR
}

fn calculate_progress_percent(bytes_transferred: i64, total_bytes: i64) -> f64 {
    if total_bytes > 0 {
        (bytes_transferred as f64 / total_bytes as f64) * 100.0
    } else {
        0.0
    }
}

fn download_terminal_state(error: &str, is_cancelled_error: fn(&str) -> bool) -> String {
    if is_cancelled_error(error) {
        "cancelled".to_string()
    } else {
        "failed".to_string()
    }
}

fn upload_terminal_state(error: &str, is_cancelled_error: fn(&str) -> bool) -> String {
    if is_cancelled_error(error) {
        "cancelled".to_string()
    } else {
        "failed".to_string()
    }
}

fn build_aws_download_event(
    operation_id: String,
    transfer_kind: &str,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    bytes_received: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: &str,
    error: Option<String>,
) -> AwsDownloadEvent {
    AwsDownloadEvent {
        operation_id,
        transfer_kind: transfer_kind.to_string(),
        connection_id,
        bucket_name,
        object_key,
        target_path,
        bytes_received,
        total_bytes,
        progress_percent,
        state: state.to_string(),
        error,
    }
}

fn build_azure_download_event(
    operation_id: String,
    transfer_kind: &str,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    bytes_received: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: &str,
    error: Option<String>,
) -> AzureDownloadEvent {
    AzureDownloadEvent {
        operation_id,
        transfer_kind: transfer_kind.to_string(),
        connection_id,
        bucket_name,
        object_key,
        target_path,
        bytes_received,
        total_bytes,
        progress_percent,
        state: state.to_string(),
        error,
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AwsUploadEvent {
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: String,
    error: Option<String>,
}

fn build_aws_upload_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: &str,
    error: Option<String>,
) -> AwsUploadEvent {
    AwsUploadEvent {
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        bytes_transferred,
        total_bytes,
        progress_percent,
        state: state.to_string(),
        error,
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AzureUploadEvent {
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: String,
    error: Option<String>,
}

fn build_azure_upload_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: &str,
    error: Option<String>,
) -> AzureUploadEvent {
    AzureUploadEvent {
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        bytes_transferred,
        total_bytes,
        progress_percent,
        state: state.to_string(),
        error,
    }
}

fn build_aws_direct_download_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: String,
    bytes_received: i64,
    total_bytes: i64,
) -> AwsDownloadEvent {
    build_aws_download_event(
        operation_id,
        "direct",
        connection_id,
        bucket_name,
        object_key,
        Some(target_path),
        bytes_received,
        total_bytes,
        calculate_progress_percent(bytes_received, total_bytes),
        "progress",
        None,
    )
}

fn build_aws_direct_download_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    state: &str,
    error: Option<String>,
) -> AwsDownloadEvent {
    let progress_percent = if state == "completed" { 100.0 } else { 0.0 };

    build_aws_download_event(
        operation_id,
        "direct",
        connection_id,
        bucket_name,
        object_key,
        target_path,
        0,
        0,
        progress_percent,
        state,
        error,
    )
}

fn build_azure_direct_download_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: String,
    bytes_received: i64,
    total_bytes: i64,
) -> AzureDownloadEvent {
    build_azure_download_event(
        operation_id,
        "direct",
        connection_id,
        bucket_name,
        object_key,
        Some(target_path),
        bytes_received,
        total_bytes,
        calculate_progress_percent(bytes_received, total_bytes),
        "progress",
        None,
    )
}

fn build_azure_direct_download_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    state: &str,
    error: Option<String>,
) -> AzureDownloadEvent {
    let progress_percent = if state == "completed" { 100.0 } else { 0.0 };

    build_azure_download_event(
        operation_id,
        "direct",
        connection_id,
        bucket_name,
        object_key,
        target_path,
        0,
        0,
        progress_percent,
        state,
        error,
    )
}

fn build_aws_cache_download_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_path: String,
    bytes_received: i64,
    total_bytes: i64,
) -> AwsDownloadEvent {
    build_aws_download_event(
        operation_id,
        "cache",
        connection_id,
        bucket_name,
        object_key,
        Some(local_path),
        bytes_received,
        total_bytes,
        calculate_progress_percent(bytes_received, total_bytes),
        "progress",
        None,
    )
}

fn build_aws_cache_download_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_path: Option<String>,
    bytes_written: i64,
    state: &str,
    error: Option<String>,
) -> AwsDownloadEvent {
    let (bytes_received, total_bytes, progress_percent) = if state == "completed" {
        (bytes_written, bytes_written, 100.0)
    } else {
        (0, 0, 0.0)
    };

    build_aws_download_event(
        operation_id,
        "cache",
        connection_id,
        bucket_name,
        object_key,
        local_path,
        bytes_received,
        total_bytes,
        progress_percent,
        state,
        error,
    )
}

fn build_azure_cache_download_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_path: String,
    bytes_received: i64,
    total_bytes: i64,
) -> AzureDownloadEvent {
    build_azure_download_event(
        operation_id,
        "cache",
        connection_id,
        bucket_name,
        object_key,
        Some(local_path),
        bytes_received,
        total_bytes,
        calculate_progress_percent(bytes_received, total_bytes),
        "progress",
        None,
    )
}

fn build_azure_cache_download_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_path: Option<String>,
    bytes_written: i64,
    state: &str,
    error: Option<String>,
) -> AzureDownloadEvent {
    let (bytes_received, total_bytes, progress_percent) = if state == "completed" {
        (bytes_written, bytes_written, 100.0)
    } else {
        (0, 0, 0.0)
    };

    build_azure_download_event(
        operation_id,
        "cache",
        connection_id,
        bucket_name,
        object_key,
        local_path,
        bytes_received,
        total_bytes,
        progress_percent,
        state,
        error,
    )
}

fn build_aws_upload_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
) -> AwsUploadEvent {
    build_aws_upload_event(
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        bytes_transferred,
        total_bytes,
        calculate_progress_percent(bytes_transferred, total_bytes),
        "progress",
        None,
    )
}

fn build_aws_upload_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    state: &str,
    error: Option<String>,
) -> AwsUploadEvent {
    let progress_percent = if state == "completed" { 100.0 } else { 0.0 };

    build_aws_upload_event(
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        0,
        0,
        progress_percent,
        state,
        error,
    )
}

fn build_azure_upload_progress_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    bytes_transferred: i64,
    total_bytes: i64,
) -> AzureUploadEvent {
    build_azure_upload_event(
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        bytes_transferred,
        total_bytes,
        calculate_progress_percent(bytes_transferred, total_bytes),
        "progress",
        None,
    )
}

fn build_azure_upload_terminal_event(
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    state: &str,
    error: Option<String>,
) -> AzureUploadEvent {
    let progress_percent = if state == "completed" { 100.0 } else { 0.0 };

    build_azure_upload_event(
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        0,
        0,
        progress_percent,
        state,
        error,
    )
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AzureDownloadEvent {
    operation_id: String,
    transfer_kind: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    target_path: Option<String>,
    bytes_received: i64,
    total_bytes: i64,
    progress_percent: f64,
    state: String,
    error: Option<String>,
}

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
pub async fn save_azure_connection_secrets(
    connection_id: String,
    account_key: String,
) -> Result<(), String> {
    AzureConnectionSecretService::save(AzureConnectionSecretsInput {
        connection_id,
        account_key,
    })
}

#[tauri::command]
pub async fn load_azure_connection_secrets(
    connection_id: String,
) -> Result<AzureConnectionSecretsOutput, String> {
    AzureConnectionSecretService::load(&connection_id)
}

#[tauri::command]
pub async fn delete_azure_connection_secrets(connection_id: String) -> Result<(), String> {
    AzureConnectionSecretService::delete(&connection_id)
}

#[tauri::command]
pub async fn validate_local_mapping_directory(path: String) -> Result<bool, String> {
    let trimmed_path = path.trim();

    if trimmed_path.is_empty() {
        return Ok(false);
    }

    let metadata = tokio::fs::metadata(trimmed_path)
        .await
        .map_err(|error| error.to_string())?;

    Ok(metadata.is_dir())
}

#[tauri::command]
pub async fn test_aws_connection(
    access_key_id: String,
    secret_access_key: String,
    restricted_bucket_name: Option<String>,
) -> Result<AwsConnectionTestResult, String> {
    eprintln!("[commands] test_aws_connection called");

    let result = AwsConnectionService::test_connection(AwsConnectionTestInput {
        access_key_id,
        secret_access_key,
        restricted_bucket_name,
    })
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] test_aws_connection failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn test_azure_connection(
    storage_account_name: String,
    account_key: String,
) -> Result<AzureConnectionTestResult, String> {
    AzureConnectionService::test_connection(AzureConnectionTestInput {
        storage_account_name,
        account_key,
    })
    .await
}

#[tauri::command]
pub async fn list_azure_containers(
    storage_account_name: String,
    account_key: String,
) -> Result<Vec<AzureContainerSummary>, String> {
    AzureConnectionService::list_containers(AzureConnectionTestInput {
        storage_account_name,
        account_key,
    })
    .await
}

#[tauri::command]
pub async fn list_azure_container_items(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    prefix: Option<String>,
    continuation_token: Option<String>,
    page_size: Option<i32>,
) -> Result<AzureContainerItemsResult, String> {
    AzureConnectionService::list_container_items(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        prefix,
        continuation_token,
        page_size,
    )
    .await
}

#[tauri::command]
pub async fn azure_blob_exists(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    blob_name: String,
) -> Result<bool, String> {
    AzureConnectionService::blob_exists(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        blob_name,
    )
    .await
}

#[tauri::command]
pub async fn create_azure_folder(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    parent_path: Option<String>,
    folder_name: String,
) -> Result<(), String> {
    AzureConnectionService::create_folder(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        parent_path,
        folder_name,
    )
    .await
}

#[tauri::command]
pub async fn delete_azure_objects(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    object_keys: Vec<String>,
) -> Result<AzureDeleteResult, String> {
    AzureConnectionService::delete_objects(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        object_keys,
    )
    .await
}

#[tauri::command]
pub async fn delete_azure_prefix(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    prefix: String,
) -> Result<AzureDeleteResult, String> {
    AzureConnectionService::delete_prefix(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        prefix,
    )
    .await
}

#[tauri::command]
pub async fn change_azure_blob_access_tier(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    blob_name: String,
    target_tier: String,
) -> Result<(), String> {
    AzureConnectionService::change_blob_access_tier(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        blob_name,
        target_tier,
    )
    .await
}

#[tauri::command]
pub async fn rehydrate_azure_blob(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    blob_name: String,
    target_tier: String,
    priority: String,
) -> Result<(), String> {
    AzureConnectionService::rehydrate_blob(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        blob_name,
        target_tier,
        priority,
    )
    .await
}

#[tauri::command]
pub async fn list_aws_buckets(
    access_key_id: String,
    secret_access_key: String,
    restricted_bucket_name: Option<String>,
) -> Result<Vec<AwsBucketSummary>, String> {
    eprintln!("[commands] list_aws_buckets called");

    let result = AwsConnectionService::list_buckets(AwsConnectionTestInput {
        access_key_id,
        secret_access_key,
        restricted_bucket_name,
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
    restricted_bucket_name: Option<String>,
) -> Result<String, String> {
    eprintln!(
        "[commands] get_aws_bucket_region called for bucket_name={}",
        bucket_name
    );

    let result = AwsConnectionService::get_bucket_region(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
    )
    .await;

    if let Err(error) = &result {
        eprintln!(
            "[commands] get_aws_bucket_region failed with error={}",
            error
        );
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
    continuation_token: Option<String>,
    restricted_bucket_name: Option<String>,
    page_size: Option<i32>,
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
            restricted_bucket_name,
        },
        bucket_name,
        prefix,
        bucket_region,
        continuation_token,
        page_size,
    )
    .await;

    if let Err(error) = &result {
        eprintln!(
            "[commands] list_aws_bucket_items failed with error={}",
            error
        );
    }

    result
}

#[tauri::command]
pub async fn aws_object_exists(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    object_key: String,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<bool, String> {
    AwsConnectionService::object_exists(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        object_key,
        bucket_region,
    )
    .await
}

#[tauri::command]
pub async fn request_aws_object_restore(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    object_key: String,
    storage_class: Option<String>,
    bucket_region: Option<String>,
    restore_tier: String,
    days: i32,
    restricted_bucket_name: Option<String>,
) -> Result<(), String> {
    eprintln!(
        "[commands] request_aws_object_restore called for bucket_name={} object_key={} tier={} days={}",
        bucket_name, object_key, restore_tier, days
    );

    let result = AwsConnectionService::request_object_restore(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        object_key,
        storage_class,
        bucket_region,
        restore_tier,
        days,
    )
    .await;

    if let Err(error) = &result {
        eprintln!(
            "[commands] request_aws_object_restore failed with error={}",
            error
        );
    }

    result
}

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    eprintln!("[commands] open_external_url called");

    let result = AwsConnectionService::open_external_url(url);

    if let Err(error) = &result {
        eprintln!("[commands] open_external_url failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn create_aws_folder(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    parent_path: Option<String>,
    folder_name: String,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<(), String> {
    eprintln!(
        "[commands] create_aws_folder called for bucket_name={} parent_path={} folder_name={}",
        bucket_name,
        parent_path.clone().unwrap_or_default(),
        folder_name
    );

    let result = AwsConnectionService::create_folder(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        parent_path,
        folder_name,
        bucket_region,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] create_aws_folder failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn delete_aws_objects(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    object_keys: Vec<String>,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<AwsDeleteResult, String> {
    eprintln!(
        "[commands] delete_aws_objects called for bucket_name={} object_count={}",
        bucket_name,
        object_keys.len()
    );

    let result = AwsConnectionService::delete_objects(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        object_keys,
        bucket_region,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] delete_aws_objects failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn delete_aws_prefix(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    prefix: String,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<AwsDeleteResult, String> {
    eprintln!(
        "[commands] delete_aws_prefix called for bucket_name={} prefix={}",
        bucket_name, prefix
    );

    let result = AwsConnectionService::delete_prefix(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        prefix,
        bucket_region,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] delete_aws_prefix failed with error={}", error);
    }

    result
}

#[tauri::command]
pub async fn change_aws_object_storage_class(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    object_key: String,
    target_storage_class: String,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<(), String> {
    eprintln!(
        "[commands] change_aws_object_storage_class called for bucket_name={} object_key={} target_storage_class={}",
        bucket_name, object_key, target_storage_class
    );

    let result = AwsConnectionService::change_object_storage_class(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        object_key,
        target_storage_class,
        bucket_region,
    )
    .await;

    if let Err(error) = &result {
        eprintln!(
            "[commands] change_aws_object_storage_class failed with error={}",
            error
        );
    }

    result
}

#[tauri::command]
pub async fn start_aws_cache_download(
    window: Window,
    operation_id: String,
    access_key_id: String,
    secret_access_key: String,
    connection_id: String,
    connection_name: String,
    bucket_name: String,
    object_key: String,
    bucket_region: Option<String>,
    global_local_cache_directory: String,
    restricted_bucket_name: Option<String>,
) -> Result<String, String> {
    eprintln!(
        "[commands] start_aws_cache_download called for bucket_name={} object_key={}",
        bucket_name, object_key
    );

    let emit_event = |event: AwsDownloadEvent| -> Result<(), String> {
        window
            .emit("aws-download-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let bucket_name_for_progress = bucket_name.clone();
    let object_key_for_progress = object_key.clone();

    let result = AwsConnectionService::download_object_to_cache(
        operation_id.clone(),
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        connection_id.clone(),
        connection_name,
        bucket_name.clone(),
        object_key.clone(),
        bucket_region,
        global_local_cache_directory,
        |bytes_received, total_bytes, local_path| {
            emit_event(build_aws_cache_download_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                bucket_name_for_progress.clone(),
                object_key_for_progress.clone(),
                local_path.to_string(),
                bytes_received,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(download_result) => {
            emit_event(build_aws_cache_download_terminal_event(
                operation_id.clone(),
                connection_id.clone(),
                bucket_name,
                object_key,
                Some(download_result.local_path),
                download_result.bytes_written,
                "completed",
                None,
            ))?;

            Ok(operation_id)
        }
        Err(error) => {
            eprintln!(
                "[commands] start_aws_cache_download failed for operation_id={} error={}",
                operation_id, error
            );

            let state = download_terminal_state(&error, is_cancelled_download_error);

            emit_event(build_aws_cache_download_terminal_event(
                operation_id.clone(),
                connection_id,
                bucket_name,
                object_key,
                None,
                0,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn download_aws_object_to_path(
    window: Window,
    operation_id: String,
    access_key_id: String,
    secret_access_key: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    bucket_region: Option<String>,
    destination_path: String,
    restricted_bucket_name: Option<String>,
) -> Result<String, String> {
    eprintln!(
        "[commands] download_aws_object_to_path called for bucket_name={} object_key={} destination_path={}",
        bucket_name, object_key, destination_path
    );

    let emit_event = |event: AwsDownloadEvent| -> Result<(), String> {
        window
            .emit("aws-download-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let bucket_name_for_progress = bucket_name.clone();
    let object_key_for_progress = object_key.clone();

    let result = AwsConnectionService::download_object_to_path(
        operation_id.clone(),
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name.clone(),
        object_key.clone(),
        bucket_region,
        destination_path,
        |bytes_received, total_bytes, target_path| {
            emit_event(build_aws_direct_download_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                bucket_name_for_progress.clone(),
                object_key_for_progress.clone(),
                target_path.to_string(),
                bytes_received,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(target_path) => {
            emit_event(build_aws_direct_download_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                Some(target_path.clone()),
                "completed",
                None,
            ))?;

            Ok(target_path)
        }
        Err(error) => {
            eprintln!(
                "[commands] download_aws_object_to_path failed with error={}",
                error
            );

            let state = download_terminal_state(&error, is_cancelled_download_error);

            emit_event(build_aws_direct_download_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                None,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn start_azure_cache_download(
    window: Window,
    operation_id: String,
    storage_account_name: String,
    account_key: String,
    connection_id: String,
    connection_name: String,
    container_name: String,
    blob_name: String,
    global_local_cache_directory: String,
) -> Result<String, String> {
    let emit_event = |event: AzureDownloadEvent| -> Result<(), String> {
        window
            .emit("azure-download-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let container_name_for_progress = container_name.clone();
    let blob_name_for_progress = blob_name.clone();

    let result = AzureConnectionService::download_blob_to_cache(
        operation_id.clone(),
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        connection_id.clone(),
        connection_name,
        container_name.clone(),
        blob_name.clone(),
        global_local_cache_directory,
        |bytes_received, total_bytes, local_path| {
            emit_event(build_azure_cache_download_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                container_name_for_progress.clone(),
                blob_name_for_progress.clone(),
                local_path.to_string(),
                bytes_received,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(AzureCacheDownloadResult {
            local_path,
            bytes_written,
        }) => {
            emit_event(build_azure_cache_download_terminal_event(
                operation_id.clone(),
                connection_id,
                container_name,
                blob_name,
                Some(local_path),
                bytes_written,
                "completed",
                None,
            ))?;

            Ok(operation_id)
        }
        Err(error) => {
            let state = download_terminal_state(&error, is_cancelled_azure_download_error);

            emit_event(build_azure_cache_download_terminal_event(
                operation_id.clone(),
                connection_id,
                container_name,
                blob_name,
                None,
                0,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn download_azure_blob_to_path(
    window: Window,
    operation_id: String,
    storage_account_name: String,
    account_key: String,
    connection_id: String,
    container_name: String,
    blob_name: String,
    destination_path: String,
) -> Result<String, String> {
    let emit_event = |event: AzureDownloadEvent| -> Result<(), String> {
        window
            .emit("azure-download-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let container_name_for_progress = container_name.clone();
    let blob_name_for_progress = blob_name.clone();

    let result = AzureConnectionService::download_blob_to_path(
        operation_id.clone(),
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name.clone(),
        blob_name.clone(),
        destination_path,
        |bytes_received, total_bytes, target_path| {
            emit_event(build_azure_direct_download_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                container_name_for_progress.clone(),
                blob_name_for_progress.clone(),
                target_path.to_string(),
                bytes_received,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(target_path) => {
            emit_event(build_azure_direct_download_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                Some(target_path.clone()),
                "completed",
                None,
            ))?;

            Ok(target_path)
        }
        Err(error) => {
            let state = download_terminal_state(&error, is_cancelled_azure_download_error);

            emit_event(build_azure_direct_download_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                None,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn start_aws_upload(
    window: Window,
    operation_id: String,
    access_key_id: String,
    secret_access_key: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    storage_class: Option<String>,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<String, String> {
    eprintln!(
        "[commands] start_aws_upload called for bucket_name={} object_key={} local_file_path={}",
        bucket_name, object_key, local_file_path
    );

    let emit_event = |event: AwsUploadEvent| -> Result<(), String> {
        window
            .emit("aws-upload-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let bucket_name_for_progress = bucket_name.clone();
    let object_key_for_progress = object_key.clone();
    let local_file_path_for_progress = local_file_path.clone();

    let result = AwsConnectionService::upload_object_from_path(
        operation_id.clone(),
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name.clone(),
        object_key.clone(),
        local_file_path.clone(),
        storage_class,
        bucket_region,
        |bytes_transferred, total_bytes| {
            emit_event(build_aws_upload_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                bucket_name_for_progress.clone(),
                object_key_for_progress.clone(),
                local_file_path_for_progress.clone(),
                bytes_transferred,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(local_file_path) => {
            emit_event(build_aws_upload_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path.clone(),
                "completed",
                None,
            ))?;

            Ok(local_file_path)
        }
        Err(error) => {
            let state = upload_terminal_state(&error, is_cancelled_upload_error);

            emit_event(build_aws_upload_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn start_aws_upload_bytes(
    window: Window,
    operation_id: String,
    access_key_id: String,
    secret_access_key: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    file_name: String,
    file_bytes: Vec<u8>,
    storage_class: Option<String>,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<String, String> {
    eprintln!(
        "[commands] start_aws_upload_bytes called for bucket_name={} object_key={} file_name={}",
        bucket_name, object_key, file_name
    );

    let emit_event = |event: AwsUploadEvent| -> Result<(), String> {
        window
            .emit("aws-upload-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let bucket_name_for_progress = bucket_name.clone();
    let object_key_for_progress = object_key.clone();
    let file_name_for_progress = file_name.clone();

    let result = AwsConnectionService::upload_object_from_bytes(
        operation_id.clone(),
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name.clone(),
        object_key.clone(),
        file_name.clone(),
        file_bytes,
        storage_class,
        bucket_region,
        |bytes_transferred, total_bytes| {
            emit_event(build_aws_upload_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                bucket_name_for_progress.clone(),
                object_key_for_progress.clone(),
                file_name_for_progress.clone(),
                bytes_transferred,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(returned_file_name) => {
            emit_event(build_aws_upload_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                returned_file_name.clone(),
                "completed",
                None,
            ))?;

            Ok(returned_file_name)
        }
        Err(error) => {
            let state = upload_terminal_state(&error, is_cancelled_upload_error);

            emit_event(build_aws_upload_terminal_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                file_name,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn start_azure_upload(
    window: Window,
    operation_id: String,
    storage_account_name: String,
    account_key: String,
    connection_id: String,
    container_name: String,
    blob_name: String,
    local_file_path: String,
    access_tier: Option<String>,
) -> Result<String, String> {
    let emit_event = |event: AzureUploadEvent| -> Result<(), String> {
        window
            .emit("azure-upload-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let container_name_for_progress = container_name.clone();
    let blob_name_for_progress = blob_name.clone();
    let local_file_path_for_progress = local_file_path.clone();

    let result = AzureConnectionService::upload_blob_from_path(
        operation_id.clone(),
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name.clone(),
        blob_name.clone(),
        local_file_path.clone(),
        access_tier,
        |bytes_transferred, total_bytes| {
            emit_event(build_azure_upload_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                container_name_for_progress.clone(),
                blob_name_for_progress.clone(),
                local_file_path_for_progress.clone(),
                bytes_transferred,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(local_file_path) => {
            emit_event(build_azure_upload_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                local_file_path.clone(),
                "completed",
                None,
            ))?;

            Ok(local_file_path)
        }
        Err(error) => {
            let state = upload_terminal_state(&error, is_cancelled_azure_upload_error);

            emit_event(build_azure_upload_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                local_file_path,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn start_azure_upload_bytes(
    window: Window,
    operation_id: String,
    storage_account_name: String,
    account_key: String,
    connection_id: String,
    container_name: String,
    blob_name: String,
    file_name: String,
    file_bytes: Vec<u8>,
    access_tier: Option<String>,
) -> Result<String, String> {
    let emit_event = |event: AzureUploadEvent| -> Result<(), String> {
        window
            .emit("azure-upload-progress", event)
            .map_err(|error| error.to_string())
    };

    let operation_id_for_progress = operation_id.clone();
    let connection_id_for_progress = connection_id.clone();
    let container_name_for_progress = container_name.clone();
    let blob_name_for_progress = blob_name.clone();
    let file_name_for_progress = file_name.clone();

    let result = AzureConnectionService::upload_blob_from_bytes(
        operation_id.clone(),
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name.clone(),
        blob_name.clone(),
        file_name.clone(),
        file_bytes,
        access_tier,
        |bytes_transferred, total_bytes| {
            emit_event(build_azure_upload_progress_event(
                operation_id_for_progress.clone(),
                connection_id_for_progress.clone(),
                container_name_for_progress.clone(),
                blob_name_for_progress.clone(),
                file_name_for_progress.clone(),
                bytes_transferred,
                total_bytes,
            ))
        },
    )
    .await;

    match result {
        Ok(returned_file_name) => {
            emit_event(build_azure_upload_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                returned_file_name.clone(),
                "completed",
                None,
            ))?;

            Ok(returned_file_name)
        }
        Err(error) => {
            let state = upload_terminal_state(&error, is_cancelled_azure_upload_error);

            emit_event(build_azure_upload_terminal_event(
                operation_id,
                connection_id,
                container_name,
                blob_name,
                file_name,
                &state,
                Some(error.clone()),
            ))?;

            Err(error)
        }
    }
}

#[tauri::command]
pub async fn find_aws_cached_objects(
    connection_id: String,
    connection_name: String,
    bucket_name: String,
    global_local_cache_directory: String,
    object_keys: Vec<String>,
) -> Result<Vec<String>, String> {
    AwsConnectionService::find_cached_objects(
        connection_id,
        connection_name,
        bucket_name,
        global_local_cache_directory,
        object_keys,
    )
    .await
}

#[tauri::command]
pub async fn find_azure_cached_objects(
    connection_id: String,
    connection_name: String,
    container_name: String,
    global_local_cache_directory: String,
    blob_names: Vec<String>,
) -> Result<Vec<String>, String> {
    AzureConnectionService::find_cached_objects(
        connection_id,
        connection_name,
        container_name,
        global_local_cache_directory,
        blob_names,
    )
    .await
}

#[tauri::command]
pub async fn open_aws_cached_object_parent(
    connection_id: String,
    connection_name: String,
    bucket_name: String,
    global_local_cache_directory: String,
    object_key: String,
) -> Result<(), String> {
    AwsConnectionService::open_cached_object_parent(
        connection_id,
        connection_name,
        bucket_name,
        global_local_cache_directory,
        object_key,
    )
    .await
}

#[tauri::command]
pub async fn open_azure_cached_object_parent(
    connection_id: String,
    connection_name: String,
    container_name: String,
    global_local_cache_directory: String,
    blob_name: String,
) -> Result<(), String> {
    AzureConnectionService::open_cached_object_parent(
        connection_id,
        connection_name,
        container_name,
        global_local_cache_directory,
        blob_name,
    )
    .await
}

#[tauri::command]
pub async fn open_aws_cached_object(
    connection_id: String,
    connection_name: String,
    bucket_name: String,
    global_local_cache_directory: String,
    object_key: String,
) -> Result<(), String> {
    AwsConnectionService::open_cached_object(
        connection_id,
        connection_name,
        bucket_name,
        global_local_cache_directory,
        object_key,
    )
    .await
}

#[tauri::command]
pub async fn open_azure_cached_object(
    connection_id: String,
    connection_name: String,
    container_name: String,
    global_local_cache_directory: String,
    blob_name: String,
) -> Result<(), String> {
    AzureConnectionService::open_cached_object(
        connection_id,
        connection_name,
        container_name,
        global_local_cache_directory,
        blob_name,
    )
    .await
}

#[tauri::command]
pub async fn cancel_aws_download(operation_id: String) -> Result<(), String> {
    let _was_cancelled = AwsConnectionService::cancel_download(operation_id)?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_azure_download(operation_id: String) -> Result<(), String> {
    let _was_cancelled = AzureConnectionService::cancel_download(operation_id)?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_aws_upload(operation_id: String) -> Result<(), String> {
    let _was_cancelled = AwsConnectionService::cancel_upload(operation_id)?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_azure_upload(operation_id: String) -> Result<(), String> {
    let _was_cancelled = AzureConnectionService::cancel_upload(operation_id)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        build_aws_cache_download_progress_event, build_aws_cache_download_terminal_event,
        build_aws_direct_download_progress_event, build_aws_direct_download_terminal_event,
        build_aws_download_event, build_aws_upload_event, build_aws_upload_progress_event,
        build_aws_upload_terminal_event,
        build_azure_cache_download_progress_event, build_azure_cache_download_terminal_event,
        build_azure_direct_download_progress_event, build_azure_direct_download_terminal_event,
        build_azure_download_event, build_azure_upload_event, build_azure_upload_progress_event,
        build_azure_upload_terminal_event, calculate_progress_percent, download_terminal_state,
        get_greeting, is_cancelled_azure_download_error, is_cancelled_azure_upload_error,
        is_cancelled_download_error, is_cancelled_upload_error, upload_terminal_state,
        validate_local_mapping_directory, AZURE_DOWNLOAD_CANCELLED_ERROR,
        AZURE_UPLOAD_CANCELLED_ERROR, DOWNLOAD_CANCELLED_ERROR, UPLOAD_CANCELLED_ERROR,
    };
    use std::fs::{self, File};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(suffix: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("cloudeasyfiles-commands-tests-{timestamp}-{suffix}"))
    }

    #[test]
    fn classifies_aws_cancellation_errors_exactly() {
        assert!(is_cancelled_download_error(DOWNLOAD_CANCELLED_ERROR));
        assert!(!is_cancelled_download_error("download_cancelled"));
        assert!(!is_cancelled_download_error("network error"));

        assert!(is_cancelled_upload_error(UPLOAD_CANCELLED_ERROR));
        assert!(!is_cancelled_upload_error("upload_cancelled"));
        assert!(!is_cancelled_upload_error("timeout"));
    }

    #[test]
    fn classifies_azure_cancellation_errors_exactly() {
        assert!(is_cancelled_azure_download_error(AZURE_DOWNLOAD_CANCELLED_ERROR));
        assert!(!is_cancelled_azure_download_error("azure_download_cancelled"));
        assert!(!is_cancelled_azure_download_error("network error"));

        assert!(is_cancelled_azure_upload_error(AZURE_UPLOAD_CANCELLED_ERROR));
        assert!(!is_cancelled_azure_upload_error("azure_upload_cancelled"));
        assert!(!is_cancelled_azure_upload_error("timeout"));
    }

    #[test]
    fn calculates_download_progress_and_terminal_states() {
        assert_eq!(calculate_progress_percent(50, 200), 25.0);
        assert_eq!(calculate_progress_percent(10, 0), 0.0);
        assert_eq!(
            download_terminal_state(DOWNLOAD_CANCELLED_ERROR, is_cancelled_download_error),
            "cancelled"
        );
        assert_eq!(
            download_terminal_state("network error", is_cancelled_download_error),
            "failed"
        );
        assert_eq!(
            upload_terminal_state(UPLOAD_CANCELLED_ERROR, is_cancelled_upload_error),
            "cancelled"
        );
        assert_eq!(
            upload_terminal_state("timeout", is_cancelled_upload_error),
            "failed"
        );
    }

    #[test]
    fn builds_download_events_with_expected_payload_mapping() {
        let aws_event = build_aws_download_event(
            "op-1".to_string(),
            "cache",
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            Some("/tmp/report.txt".to_string()),
            10,
            40,
            25.0,
            "progress",
            None,
        );
        assert_eq!(aws_event.operation_id, "op-1");
        assert_eq!(aws_event.transfer_kind, "cache");
        assert_eq!(aws_event.connection_id, "conn-1");
        assert_eq!(aws_event.bucket_name, "bucket-a");
        assert_eq!(aws_event.object_key, "docs/report.txt");
        assert_eq!(aws_event.target_path.as_deref(), Some("/tmp/report.txt"));
        assert_eq!(aws_event.bytes_received, 10);
        assert_eq!(aws_event.total_bytes, 40);
        assert_eq!(aws_event.progress_percent, 25.0);
        assert_eq!(aws_event.state, "progress");
        assert_eq!(aws_event.error, None);

        let azure_event = build_azure_download_event(
            "op-2".to_string(),
            "direct",
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            None,
            0,
            0,
            0.0,
            "failed",
            Some("network error".to_string()),
        );
        assert_eq!(azure_event.operation_id, "op-2");
        assert_eq!(azure_event.transfer_kind, "direct");
        assert_eq!(azure_event.connection_id, "conn-2");
        assert_eq!(azure_event.bucket_name, "container-a");
        assert_eq!(azure_event.object_key, "archive.zip");
        assert_eq!(azure_event.target_path, None);
        assert_eq!(azure_event.bytes_received, 0);
        assert_eq!(azure_event.total_bytes, 0);
        assert_eq!(azure_event.progress_percent, 0.0);
        assert_eq!(azure_event.state, "failed");
        assert_eq!(azure_event.error.as_deref(), Some("network error"));
    }

    #[test]
    fn builds_direct_download_events_with_expected_progress_and_terminal_states() {
        let aws_progress = build_aws_direct_download_progress_event(
            "op-aws-progress".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            50,
            200,
        );
        assert_eq!(aws_progress.transfer_kind, "direct");
        assert_eq!(aws_progress.target_path.as_deref(), Some("/tmp/report.txt"));
        assert_eq!(aws_progress.progress_percent, 25.0);
        assert_eq!(aws_progress.state, "progress");
        assert_eq!(aws_progress.error, None);

        let aws_completed = build_aws_direct_download_terminal_event(
            "op-aws-done".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            Some("/tmp/report.txt".to_string()),
            "completed",
            None,
        );
        assert_eq!(aws_completed.progress_percent, 100.0);
        assert_eq!(aws_completed.state, "completed");
        assert_eq!(aws_completed.target_path.as_deref(), Some("/tmp/report.txt"));

        let aws_failed = build_aws_direct_download_terminal_event(
            "op-aws-failed".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            None,
            "failed",
            Some("network error".to_string()),
        );
        assert_eq!(aws_failed.progress_percent, 0.0);
        assert_eq!(aws_failed.state, "failed");
        assert_eq!(aws_failed.error.as_deref(), Some("network error"));

        let azure_progress = build_azure_direct_download_progress_event(
            "op-az-progress".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "/tmp/archive.zip".to_string(),
            75,
            300,
        );
        assert_eq!(azure_progress.transfer_kind, "direct");
        assert_eq!(azure_progress.target_path.as_deref(), Some("/tmp/archive.zip"));
        assert_eq!(azure_progress.progress_percent, 25.0);
        assert_eq!(azure_progress.state, "progress");

        let azure_cancelled = build_azure_direct_download_terminal_event(
            "op-az-cancelled".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            None,
            "cancelled",
            Some(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string()),
        );
        assert_eq!(azure_cancelled.progress_percent, 0.0);
        assert_eq!(azure_cancelled.state, "cancelled");
        assert_eq!(
            azure_cancelled.error.as_deref(),
            Some(AZURE_DOWNLOAD_CANCELLED_ERROR)
        );
    }

    #[test]
    fn builds_cache_download_events_with_expected_progress_and_terminal_states() {
        let aws_progress = build_aws_cache_download_progress_event(
            "op-aws-progress".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            50,
            200,
        );
        assert_eq!(aws_progress.transfer_kind, "cache");
        assert_eq!(aws_progress.target_path.as_deref(), Some("/tmp/report.txt"));
        assert_eq!(aws_progress.progress_percent, 25.0);
        assert_eq!(aws_progress.state, "progress");

        let aws_completed = build_aws_cache_download_terminal_event(
            "op-aws-complete".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            Some("/tmp/report.txt".to_string()),
            640,
            "completed",
            None,
        );
        assert_eq!(aws_completed.bytes_received, 640);
        assert_eq!(aws_completed.total_bytes, 640);
        assert_eq!(aws_completed.progress_percent, 100.0);
        assert_eq!(aws_completed.state, "completed");

        let aws_failed = build_aws_cache_download_terminal_event(
            "op-aws-failed".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            None,
            0,
            "failed",
            Some("network error".to_string()),
        );
        assert_eq!(aws_failed.bytes_received, 0);
        assert_eq!(aws_failed.total_bytes, 0);
        assert_eq!(aws_failed.progress_percent, 0.0);
        assert_eq!(aws_failed.state, "failed");
        assert_eq!(aws_failed.error.as_deref(), Some("network error"));

        let azure_progress = build_azure_cache_download_progress_event(
            "op-az-progress".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "/tmp/archive.zip".to_string(),
            75,
            300,
        );
        assert_eq!(azure_progress.transfer_kind, "cache");
        assert_eq!(azure_progress.target_path.as_deref(), Some("/tmp/archive.zip"));
        assert_eq!(azure_progress.progress_percent, 25.0);
        assert_eq!(azure_progress.state, "progress");

        let azure_cancelled = build_azure_cache_download_terminal_event(
            "op-az-cancelled".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            None,
            0,
            "cancelled",
            Some(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string()),
        );
        assert_eq!(azure_cancelled.bytes_received, 0);
        assert_eq!(azure_cancelled.total_bytes, 0);
        assert_eq!(azure_cancelled.progress_percent, 0.0);
        assert_eq!(azure_cancelled.state, "cancelled");
        assert_eq!(
            azure_cancelled.error.as_deref(),
            Some(AZURE_DOWNLOAD_CANCELLED_ERROR)
        );
    }

    #[test]
    fn builds_upload_events_with_expected_payload_mapping() {
        let aws_event = build_aws_upload_event(
            "op-1".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            10,
            40,
            25.0,
            "progress",
            None,
        );
        assert_eq!(aws_event.operation_id, "op-1");
        assert_eq!(aws_event.connection_id, "conn-1");
        assert_eq!(aws_event.bucket_name, "bucket-a");
        assert_eq!(aws_event.object_key, "docs/report.txt");
        assert_eq!(aws_event.local_file_path, "/tmp/report.txt");
        assert_eq!(aws_event.bytes_transferred, 10);
        assert_eq!(aws_event.total_bytes, 40);
        assert_eq!(aws_event.progress_percent, 25.0);
        assert_eq!(aws_event.state, "progress");
        assert_eq!(aws_event.error, None);

        let azure_event = build_azure_upload_event(
            "op-2".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "archive.zip".to_string(),
            0,
            0,
            0.0,
            "failed",
            Some("network error".to_string()),
        );
        assert_eq!(azure_event.operation_id, "op-2");
        assert_eq!(azure_event.connection_id, "conn-2");
        assert_eq!(azure_event.bucket_name, "container-a");
        assert_eq!(azure_event.object_key, "archive.zip");
        assert_eq!(azure_event.local_file_path, "archive.zip");
        assert_eq!(azure_event.bytes_transferred, 0);
        assert_eq!(azure_event.total_bytes, 0);
        assert_eq!(azure_event.progress_percent, 0.0);
        assert_eq!(azure_event.state, "failed");
        assert_eq!(azure_event.error.as_deref(), Some("network error"));
    }

    #[test]
    fn builds_upload_progress_and_terminal_events_with_expected_defaults() {
        let aws_progress = build_aws_upload_progress_event(
            "op-aws-progress".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            50,
            200,
        );
        assert_eq!(aws_progress.progress_percent, 25.0);
        assert_eq!(aws_progress.state, "progress");
        assert_eq!(aws_progress.error, None);

        let aws_completed = build_aws_upload_terminal_event(
            "op-aws-complete".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            "completed",
            None,
        );
        assert_eq!(aws_completed.progress_percent, 100.0);
        assert_eq!(aws_completed.state, "completed");

        let aws_cancelled = build_aws_upload_terminal_event(
            "op-aws-cancelled".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/report.txt".to_string(),
            "cancelled",
            Some(UPLOAD_CANCELLED_ERROR.to_string()),
        );
        assert_eq!(aws_cancelled.progress_percent, 0.0);
        assert_eq!(aws_cancelled.state, "cancelled");
        assert_eq!(aws_cancelled.error.as_deref(), Some(UPLOAD_CANCELLED_ERROR));

        let azure_progress = build_azure_upload_progress_event(
            "op-az-progress".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "archive.zip".to_string(),
            90,
            300,
        );
        assert_eq!(azure_progress.progress_percent, 30.0);
        assert_eq!(azure_progress.state, "progress");
        assert_eq!(azure_progress.error, None);

        let azure_failed = build_azure_upload_terminal_event(
            "op-az-failed".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "archive.zip".to_string(),
            "failed",
            Some("network error".to_string()),
        );
        assert_eq!(azure_failed.progress_percent, 0.0);
        assert_eq!(azure_failed.state, "failed");
        assert_eq!(azure_failed.error.as_deref(), Some("network error"));
    }

    #[tokio::test]
    async fn validates_local_mapping_directory_inputs() {
        let temp_dir = unique_temp_path("dir");
        fs::create_dir_all(&temp_dir).expect("temp dir should be created");

        let temp_file = unique_temp_path("file");
        File::create(&temp_file).expect("temp file should be created");

        assert!(
            validate_local_mapping_directory(temp_dir.to_string_lossy().into_owned())
                .await
                .expect("directory validation should succeed")
        );
        assert!(
            !validate_local_mapping_directory("   ".to_string())
                .await
                .expect("empty path should return false")
        );
        assert!(
            !validate_local_mapping_directory(temp_file.to_string_lossy().into_owned())
                .await
                .expect("file path should return false")
        );

        let missing_path = unique_temp_path("missing");
        let error = validate_local_mapping_directory(missing_path.to_string_lossy().into_owned())
            .await
            .expect_err("missing path should fail");
        assert!(
            !error.trim().is_empty(),
            "missing path errors should surface an error message"
        );

        fs::remove_dir_all(&temp_dir).expect("temp dir should be removed");
        fs::remove_file(&temp_file).expect("temp file should be removed");
    }

    #[tokio::test]
    async fn uses_default_locale_for_greeting_when_missing() {
        let default_greeting = get_greeting(None).await;
        let explicit_greeting = get_greeting(Some("en-US".to_string())).await;

        assert_eq!(default_greeting, explicit_greeting);
        assert!(
            !default_greeting.trim().is_empty(),
            "startup greeting should not be empty"
        );
    }
}
