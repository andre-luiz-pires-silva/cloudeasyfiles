use crate::application::services::aws_connection_secret_service::AwsConnectionSecretService;
use crate::application::services::aws_connection_service::{
    AwsConnectionService, DOWNLOAD_CANCELLED_ERROR, UPLOAD_CANCELLED_ERROR,
};
use crate::application::services::azure_connection_secret_service::AzureConnectionSecretService;
use crate::application::services::azure_connection_service::{
    AzureConnectionService, AZURE_DOWNLOAD_CANCELLED_ERROR, AZURE_UPLOAD_CANCELLED_ERROR,
};
use crate::application::services::greeting_service::GreetingService;
use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
    AwsDeleteResult, AwsObjectPreviewResult,
};
use crate::domain::azure_connection::{
    AzureBlobPreviewResult, AzureConnectionTestInput, AzureConnectionTestResult, AzureContainerItemsResult,
    AzureContainerSummary, AzureDeleteResult,
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

fn resolve_cache_download_outcome<Event, BuildEvent>(
    result: Result<(String, i64), String>,
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    is_cancelled_error: fn(&str) -> bool,
    build_event: BuildEvent,
) -> (Result<String, String>, Event)
where
    BuildEvent:
        FnOnce(String, String, String, String, Option<String>, i64, &str, Option<String>) -> Event,
{
    match result {
        Ok((local_path, bytes_written)) => {
            let event = build_event(
                operation_id.clone(),
                connection_id,
                bucket_name,
                object_key,
                Some(local_path),
                bytes_written,
                "completed",
                None,
            );

            (Ok(operation_id), event)
        }
        Err(error) => {
            let state = download_terminal_state(&error, is_cancelled_error);
            let event = build_event(
                operation_id.clone(),
                connection_id,
                bucket_name,
                object_key,
                None,
                0,
                &state,
                Some(error.clone()),
            );

            (Err(error), event)
        }
    }
}

fn resolve_direct_download_outcome<Event, BuildEvent>(
    result: Result<String, String>,
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    is_cancelled_error: fn(&str) -> bool,
    build_event: BuildEvent,
) -> (Result<String, String>, Event)
where
    BuildEvent:
        FnOnce(String, String, String, String, Option<String>, &str, Option<String>) -> Event,
{
    match result {
        Ok(target_path) => {
            let event = build_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                Some(target_path.clone()),
                "completed",
                None,
            );

            (Ok(target_path), event)
        }
        Err(error) => {
            let state = download_terminal_state(&error, is_cancelled_error);
            let event = build_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                None,
                &state,
                Some(error.clone()),
            );

            (Err(error), event)
        }
    }
}

fn resolve_upload_outcome<Event, BuildEvent>(
    result: Result<String, String>,
    operation_id: String,
    connection_id: String,
    bucket_name: String,
    object_key: String,
    local_file_path: String,
    is_cancelled_error: fn(&str) -> bool,
    build_event: BuildEvent,
) -> (Result<String, String>, Event)
where
    BuildEvent: FnOnce(String, String, String, String, String, &str, Option<String>) -> Event,
{
    match result {
        Ok(returned_path) => {
            let event = build_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                returned_path.clone(),
                "completed",
                None,
            );

            (Ok(returned_path), event)
        }
        Err(error) => {
            let state = upload_terminal_state(&error, is_cancelled_error);
            let event = build_event(
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path,
                &state,
                Some(error.clone()),
            );

            (Err(error), event)
        }
    }
}

fn dispatch_aws_cache_download_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    bucket_name: &str,
    object_key: &str,
    bytes_received: i64,
    total_bytes: i64,
    local_path: &str,
) -> Result<(), String>
where
    F: Fn(AwsDownloadEvent) -> Result<(), String>,
{
    emit_event(build_aws_cache_download_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        bucket_name.to_string(),
        object_key.to_string(),
        local_path.to_string(),
        bytes_received,
        total_bytes,
    ))
}

fn dispatch_aws_direct_download_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    bucket_name: &str,
    object_key: &str,
    bytes_received: i64,
    total_bytes: i64,
    target_path: &str,
) -> Result<(), String>
where
    F: Fn(AwsDownloadEvent) -> Result<(), String>,
{
    emit_event(build_aws_direct_download_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        bucket_name.to_string(),
        object_key.to_string(),
        target_path.to_string(),
        bytes_received,
        total_bytes,
    ))
}

fn dispatch_aws_upload_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    bucket_name: &str,
    object_key: &str,
    local_file_path: &str,
    bytes_transferred: i64,
    total_bytes: i64,
) -> Result<(), String>
where
    F: Fn(AwsUploadEvent) -> Result<(), String>,
{
    emit_event(build_aws_upload_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        bucket_name.to_string(),
        object_key.to_string(),
        local_file_path.to_string(),
        bytes_transferred,
        total_bytes,
    ))
}

fn dispatch_azure_cache_download_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    container_name: &str,
    blob_name: &str,
    bytes_received: i64,
    total_bytes: i64,
    local_path: &str,
) -> Result<(), String>
where
    F: Fn(AzureDownloadEvent) -> Result<(), String>,
{
    emit_event(build_azure_cache_download_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        container_name.to_string(),
        blob_name.to_string(),
        local_path.to_string(),
        bytes_received,
        total_bytes,
    ))
}

fn dispatch_azure_direct_download_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    container_name: &str,
    blob_name: &str,
    bytes_received: i64,
    total_bytes: i64,
    target_path: &str,
) -> Result<(), String>
where
    F: Fn(AzureDownloadEvent) -> Result<(), String>,
{
    emit_event(build_azure_direct_download_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        container_name.to_string(),
        blob_name.to_string(),
        target_path.to_string(),
        bytes_received,
        total_bytes,
    ))
}

fn dispatch_azure_upload_progress<F>(
    emit_event: &F,
    operation_id: &str,
    connection_id: &str,
    container_name: &str,
    blob_name: &str,
    local_file_path: &str,
    bytes_transferred: i64,
    total_bytes: i64,
) -> Result<(), String>
where
    F: Fn(AzureUploadEvent) -> Result<(), String>,
{
    emit_event(build_azure_upload_progress_event(
        operation_id.to_string(),
        connection_id.to_string(),
        container_name.to_string(),
        blob_name.to_string(),
        local_file_path.to_string(),
        bytes_transferred,
        total_bytes,
    ))
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
pub async fn preview_azure_blob(
    storage_account_name: String,
    account_key: String,
    container_name: String,
    blob_name: String,
    blob_size: i64,
    max_bytes: i64,
) -> Result<AzureBlobPreviewResult, String> {
    AzureConnectionService::preview_blob(
        AzureConnectionTestInput {
            storage_account_name,
            account_key,
        },
        container_name,
        blob_name,
        blob_size,
        max_bytes,
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
pub async fn preview_aws_object(
    access_key_id: String,
    secret_access_key: String,
    bucket_name: String,
    object_key: String,
    object_size: i64,
    max_bytes: i64,
    bucket_region: Option<String>,
    restricted_bucket_name: Option<String>,
) -> Result<AwsObjectPreviewResult, String> {
    AwsConnectionService::preview_object(
        AwsConnectionTestInput {
            access_key_id,
            secret_access_key,
            restricted_bucket_name,
        },
        bucket_name,
        object_key,
        object_size,
        max_bytes,
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
            dispatch_aws_cache_download_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &bucket_name_for_progress,
                &object_key_for_progress,
                bytes_received,
                total_bytes,
                local_path,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_cache_download_outcome(
        result.map(|download_result| (download_result.local_path, download_result.bytes_written)),
        operation_id.clone(),
        connection_id,
        bucket_name,
        object_key,
        is_cancelled_download_error,
        build_aws_cache_download_terminal_event,
    );

    if let Err(error) = &command_result {
        eprintln!(
            "[commands] start_aws_cache_download failed for operation_id={} error={}",
            operation_id, error
        );
    }

    emit_event(terminal_event)?;
    command_result
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
            dispatch_aws_direct_download_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &bucket_name_for_progress,
                &object_key_for_progress,
                bytes_received,
                total_bytes,
                target_path,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_direct_download_outcome(
        result,
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        is_cancelled_download_error,
        build_aws_direct_download_terminal_event,
    );

    if let Err(error) = &command_result {
        eprintln!(
            "[commands] download_aws_object_to_path failed with error={}",
            error
        );
    }

    emit_event(terminal_event)?;
    command_result
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
            dispatch_azure_cache_download_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &container_name_for_progress,
                &blob_name_for_progress,
                bytes_received,
                total_bytes,
                local_path,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_cache_download_outcome(
        result.map(|download_result| (download_result.local_path, download_result.bytes_written)),
        operation_id,
        connection_id,
        container_name,
        blob_name,
        is_cancelled_azure_download_error,
        build_azure_cache_download_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
            dispatch_azure_direct_download_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &container_name_for_progress,
                &blob_name_for_progress,
                bytes_received,
                total_bytes,
                target_path,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_direct_download_outcome(
        result,
        operation_id,
        connection_id,
        container_name,
        blob_name,
        is_cancelled_azure_download_error,
        build_azure_direct_download_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
            dispatch_aws_upload_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &bucket_name_for_progress,
                &object_key_for_progress,
                &local_file_path_for_progress,
                bytes_transferred,
                total_bytes,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_upload_outcome(
        result,
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        local_file_path,
        is_cancelled_upload_error,
        build_aws_upload_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
            dispatch_aws_upload_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &bucket_name_for_progress,
                &object_key_for_progress,
                &file_name_for_progress,
                bytes_transferred,
                total_bytes,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_upload_outcome(
        result,
        operation_id,
        connection_id,
        bucket_name,
        object_key,
        file_name,
        is_cancelled_upload_error,
        build_aws_upload_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
            dispatch_azure_upload_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &container_name_for_progress,
                &blob_name_for_progress,
                &local_file_path_for_progress,
                bytes_transferred,
                total_bytes,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_upload_outcome(
        result,
        operation_id,
        connection_id,
        container_name,
        blob_name,
        local_file_path,
        is_cancelled_azure_upload_error,
        build_azure_upload_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
            dispatch_azure_upload_progress(
                &emit_event,
                &operation_id_for_progress,
                &connection_id_for_progress,
                &container_name_for_progress,
                &blob_name_for_progress,
                &file_name_for_progress,
                bytes_transferred,
                total_bytes,
            )
        },
    )
    .await;

    let (command_result, terminal_event) = resolve_upload_outcome(
        result,
        operation_id,
        connection_id,
        container_name,
        blob_name,
        file_name,
        is_cancelled_azure_upload_error,
        build_azure_upload_terminal_event,
    );

    emit_event(terminal_event)?;
    command_result
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
        build_aws_upload_terminal_event, build_azure_cache_download_progress_event,
        build_azure_cache_download_terminal_event, build_azure_direct_download_progress_event,
        build_azure_direct_download_terminal_event, build_azure_download_event,
        build_azure_upload_event, build_azure_upload_progress_event,
        aws_object_exists, build_azure_upload_terminal_event, calculate_progress_percent,
        cancel_aws_download, cancel_aws_upload, cancel_azure_download, cancel_azure_upload,
        change_aws_object_storage_class, change_azure_blob_access_tier, create_aws_folder,
        create_azure_folder, delete_aws_objects, delete_aws_prefix, delete_azure_objects,
        delete_azure_prefix,
        dispatch_aws_cache_download_progress, dispatch_aws_direct_download_progress,
        dispatch_aws_upload_progress, dispatch_azure_cache_download_progress,
        dispatch_azure_direct_download_progress, dispatch_azure_upload_progress,
        download_terminal_state, find_aws_cached_objects, find_azure_cached_objects,
        get_aws_bucket_region, get_greeting, is_cancelled_azure_download_error,
        is_cancelled_azure_upload_error, is_cancelled_download_error, is_cancelled_upload_error,
        list_aws_bucket_items, list_azure_container_items, list_azure_containers,
        open_aws_cached_object, open_aws_cached_object_parent, open_azure_cached_object,
        open_azure_cached_object_parent, open_external_url, preview_aws_object,
        preview_azure_blob, rehydrate_azure_blob, request_aws_object_restore,
        resolve_cache_download_outcome,
        resolve_direct_download_outcome, resolve_upload_outcome, test_azure_connection,
        upload_terminal_state, validate_local_mapping_directory, azure_blob_exists,
        AZURE_DOWNLOAD_CANCELLED_ERROR, AZURE_UPLOAD_CANCELLED_ERROR, DOWNLOAD_CANCELLED_ERROR,
        UPLOAD_CANCELLED_ERROR,
    };
    use std::fs::{self, File};
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_path(suffix: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "cloudeasyfiles-commands-tests-{timestamp}-{suffix}"
        ))
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
        assert!(is_cancelled_azure_download_error(
            AZURE_DOWNLOAD_CANCELLED_ERROR
        ));
        assert!(!is_cancelled_azure_download_error(
            "azure_download_cancelled"
        ));
        assert!(!is_cancelled_azure_download_error("network error"));

        assert!(is_cancelled_azure_upload_error(
            AZURE_UPLOAD_CANCELLED_ERROR
        ));
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
        assert_eq!(
            aws_completed.target_path.as_deref(),
            Some("/tmp/report.txt")
        );

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
        assert_eq!(
            azure_progress.target_path.as_deref(),
            Some("/tmp/archive.zip")
        );
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
        assert_eq!(
            azure_progress.target_path.as_deref(),
            Some("/tmp/archive.zip")
        );
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

    #[test]
    fn resolves_cache_download_outcomes_into_terminal_events() {
        let (aws_success_result, aws_success_event) = resolve_cache_download_outcome(
            Ok(("/tmp/report.txt".to_string(), 640)),
            "op-aws-cache".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            is_cancelled_download_error,
            build_aws_cache_download_terminal_event,
        );
        assert_eq!(aws_success_result, Ok("op-aws-cache".to_string()));
        assert_eq!(aws_success_event.state, "completed");
        assert_eq!(
            aws_success_event.target_path.as_deref(),
            Some("/tmp/report.txt")
        );
        assert_eq!(aws_success_event.bytes_received, 640);
        assert_eq!(aws_success_event.total_bytes, 640);

        let (azure_cancelled_result, azure_cancelled_event) = resolve_cache_download_outcome(
            Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string()),
            "op-az-cache".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            is_cancelled_azure_download_error,
            build_azure_cache_download_terminal_event,
        );
        assert_eq!(
            azure_cancelled_result,
            Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string())
        );
        assert_eq!(azure_cancelled_event.state, "cancelled");
        assert_eq!(azure_cancelled_event.target_path, None);
        assert_eq!(azure_cancelled_event.bytes_received, 0);
        assert_eq!(
            azure_cancelled_event.error.as_deref(),
            Some(AZURE_DOWNLOAD_CANCELLED_ERROR)
        );
    }

    #[test]
    fn resolves_direct_download_outcomes_into_terminal_events() {
        let (aws_success_result, aws_success_event) = resolve_direct_download_outcome(
            Ok("/tmp/report.txt".to_string()),
            "op-aws-direct".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            is_cancelled_download_error,
            build_aws_direct_download_terminal_event,
        );
        assert_eq!(aws_success_result, Ok("/tmp/report.txt".to_string()));
        assert_eq!(aws_success_event.state, "completed");
        assert_eq!(aws_success_event.progress_percent, 100.0);
        assert_eq!(
            aws_success_event.target_path.as_deref(),
            Some("/tmp/report.txt")
        );

        let (azure_failed_result, azure_failed_event) = resolve_direct_download_outcome(
            Err("network error".to_string()),
            "op-az-direct".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            is_cancelled_azure_download_error,
            build_azure_direct_download_terminal_event,
        );
        assert_eq!(azure_failed_result, Err("network error".to_string()));
        assert_eq!(azure_failed_event.state, "failed");
        assert_eq!(azure_failed_event.progress_percent, 0.0);
        assert_eq!(azure_failed_event.target_path, None);
        assert_eq!(azure_failed_event.error.as_deref(), Some("network error"));
    }

    #[test]
    fn resolves_upload_outcomes_into_terminal_events() {
        let (aws_success_result, aws_success_event) = resolve_upload_outcome(
            Ok("/tmp/report.txt".to_string()),
            "op-aws-upload".to_string(),
            "conn-1".to_string(),
            "bucket-a".to_string(),
            "docs/report.txt".to_string(),
            "/tmp/fallback.txt".to_string(),
            is_cancelled_upload_error,
            build_aws_upload_terminal_event,
        );
        assert_eq!(aws_success_result, Ok("/tmp/report.txt".to_string()));
        assert_eq!(aws_success_event.state, "completed");
        assert_eq!(aws_success_event.progress_percent, 100.0);
        assert_eq!(aws_success_event.local_file_path, "/tmp/report.txt");

        let (azure_cancelled_result, azure_cancelled_event) = resolve_upload_outcome(
            Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string()),
            "op-az-upload".to_string(),
            "conn-2".to_string(),
            "container-a".to_string(),
            "archive.zip".to_string(),
            "archive.zip".to_string(),
            is_cancelled_azure_upload_error,
            build_azure_upload_terminal_event,
        );
        assert_eq!(
            azure_cancelled_result,
            Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string())
        );
        assert_eq!(azure_cancelled_event.state, "cancelled");
        assert_eq!(azure_cancelled_event.progress_percent, 0.0);
        assert_eq!(azure_cancelled_event.local_file_path, "archive.zip");
        assert_eq!(
            azure_cancelled_event.error.as_deref(),
            Some(AZURE_UPLOAD_CANCELLED_ERROR)
        );
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
        assert!(!validate_local_mapping_directory("   ".to_string())
            .await
            .expect("empty path should return false"));
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

    #[tokio::test]
    async fn delegates_cached_object_queries_to_provider_services() {
        let temp_root = unique_temp_path("cache-wrapper");
        let aws_object_path = temp_root
            .join("Primary Connection")
            .join("bucket-a")
            .join("docs")
            .join("report.txt");
        let azure_blob_path = temp_root
            .join("Primary Connection")
            .join("container-a")
            .join("docs")
            .join("report.txt");

        fs::create_dir_all(aws_object_path.parent().unwrap()).expect("aws cache dir should exist");
        fs::create_dir_all(azure_blob_path.parent().unwrap())
            .expect("azure cache dir should exist");
        fs::write(&aws_object_path, b"aws-cached").expect("aws cache file should exist");
        fs::write(&azure_blob_path, b"azure-cached").expect("azure cache file should exist");

        let aws_cached = find_aws_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            vec![
                "docs/report.txt".to_string(),
                "docs/missing.txt".to_string(),
            ],
        )
        .await
        .expect("aws cached lookup should succeed");
        assert_eq!(aws_cached, vec!["docs/report.txt"]);

        let azure_cached = find_azure_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            vec![
                "docs/report.txt".to_string(),
                "docs/missing.txt".to_string(),
            ],
        )
        .await
        .expect("azure cached lookup should succeed");
        assert_eq!(azure_cached, vec!["docs/report.txt"]);

        fs::remove_dir_all(&temp_root).expect("temp root should be removed");
    }

    #[tokio::test]
    async fn surfaces_cached_object_open_failures_from_provider_services() {
        let temp_root = unique_temp_path("open-wrapper");
        fs::create_dir_all(&temp_root).expect("temp root should exist");

        let aws_open_error = open_aws_cached_object(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            "docs/missing.txt".to_string(),
        )
        .await
        .expect_err("aws open should fail for missing cache");
        assert!(aws_open_error.contains("not available in the local cache"));

        let aws_parent_error = open_aws_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            "docs/missing.txt".to_string(),
        )
        .await
        .expect_err("aws parent open should fail for missing cache");
        assert!(aws_parent_error.contains("not available in the local cache"));

        let azure_open_error = open_azure_cached_object(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            "docs/missing.txt".to_string(),
        )
        .await
        .expect_err("azure open should fail for missing cache");
        assert!(azure_open_error.contains("not available in the local cache"));

        let azure_parent_error = open_azure_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().into_owned(),
            "docs/missing.txt".to_string(),
        )
        .await
        .expect_err("azure parent open should fail for missing cache");
        assert!(azure_parent_error.contains("not available in the local cache"));

        fs::remove_dir_all(&temp_root).expect("temp root should be removed");
    }

    #[tokio::test]
    async fn cancel_commands_are_idempotent_for_missing_operations() {
        cancel_aws_download("missing-aws-download".to_string())
            .await
            .expect("missing aws download should still succeed");
        cancel_azure_download("missing-azure-download".to_string())
            .await
            .expect("missing azure download should still succeed");
        cancel_aws_upload("missing-aws-upload".to_string())
            .await
            .expect("missing aws upload should still succeed");
        cancel_azure_upload("missing-azure-upload".to_string())
            .await
            .expect("missing azure upload should still succeed");
    }

    #[tokio::test]
    async fn provider_mutation_command_wrappers_surface_local_guard_errors() {
        assert_eq!(
            aws_object_exists(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                "   ".to_string(),
                None,
                None,
            )
            .await
            .unwrap_err(),
            "Object key is required."
        );
        assert_eq!(
            request_aws_object_restore(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                "docs/archive.zip".to_string(),
                Some("GLACIER".to_string()),
                None,
                "Standard".to_string(),
                0,
                None,
            )
            .await
            .unwrap_err(),
            "Restore retention days must be between 1 and 365."
        );
        assert_eq!(
            create_aws_folder(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                None,
                "bad/name".to_string(),
                None,
                None,
            )
            .await
            .unwrap_err(),
            "Folder name cannot contain path separators."
        );
        assert_eq!(
            delete_aws_objects(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                vec!["   ".to_string()],
                None,
                None,
            )
            .await
            .unwrap_err(),
            "At least one object key is required for delete requests."
        );
        assert_eq!(
            delete_aws_prefix(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                " / ".to_string(),
                None,
                None,
            )
            .await
            .unwrap_err(),
            "Directory prefix is required for recursive delete requests."
        );
        assert_eq!(
            change_aws_object_storage_class(
                "access-key".to_string(),
                "secret-key".to_string(),
                "bucket-a".to_string(),
                "   ".to_string(),
                "STANDARD_IA".to_string(),
                None,
                None,
            )
            .await
            .unwrap_err(),
            "Object key is required for storage class changes."
        );

        assert!(
            !azure_blob_exists(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "   ".to_string(),
            )
            .await
            .expect("blank azure blob name should return false")
        );
        assert_eq!(
            create_azure_folder(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                None,
                "bad/name".to_string(),
            )
            .await
            .unwrap_err(),
            "Folder name cannot contain path separators."
        );
        assert_eq!(
            delete_azure_objects(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                vec!["   ".to_string()],
            )
            .await
            .unwrap_err(),
            "At least one blob name is required for delete requests."
        );
        assert_eq!(
            delete_azure_prefix(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                " / ".to_string(),
            )
            .await
            .unwrap_err(),
            "Directory prefix is required for recursive delete requests."
        );
        assert_eq!(
            change_azure_blob_access_tier(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/blob.txt".to_string(),
                "Premium".to_string(),
            )
            .await
            .unwrap_err(),
            "Unsupported Azure upload access tier."
        );
        assert_eq!(
            rehydrate_azure_blob(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/archive.zip".to_string(),
                "Archive".to_string(),
                "High".to_string(),
            )
            .await
            .unwrap_err(),
            "Unsupported Azure rehydration target tier."
        );
    }

    #[tokio::test]
    async fn read_command_wrappers_surface_local_guard_errors_before_network() {
        assert_eq!(
            get_aws_bucket_region(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            list_aws_bucket_items(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                None,
                Some("us-east-1".to_string()),
                None,
                Some("allowed-bucket".to_string()),
                Some(25),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );

        assert_eq!(
            test_azure_connection("   ".to_string(), "unused-key".to_string())
                .await
                .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            list_azure_containers("   ".to_string(), "unused-key".to_string())
                .await
                .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            list_azure_container_items(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "   ".to_string(),
                None,
                None,
                Some(25),
            )
            .await
            .unwrap_err(),
            "The Azure container name is required."
        );
        assert_eq!(
            list_azure_container_items(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                None,
                None,
                Some(25),
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );

        assert_eq!(
            preview_aws_object(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                "docs/report.txt".to_string(),
                128,
                1024,
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            preview_aws_object(
                "access-key".to_string(),
                "secret-key".to_string(),
                "allowed-bucket".to_string(),
                "docs/report.txt".to_string(),
                2048,
                1024,
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "File is too large to preview."
        );
        assert_eq!(
            preview_azure_blob(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                128,
                1024,
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            preview_azure_blob(
                "storageacct".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                2048,
                1024,
            )
            .await
            .unwrap_err(),
            "File is too large to preview."
        );
    }

    #[tokio::test]
    async fn mutation_command_wrappers_surface_restriction_and_account_guards_before_network() {
        assert_eq!(
            request_aws_object_restore(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                "docs/archive.zip".to_string(),
                Some("GLACIER".to_string()),
                Some("us-east-1".to_string()),
                "Standard".to_string(),
                7,
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            create_aws_folder(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                None,
                "reports".to_string(),
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            delete_aws_objects(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                vec!["docs/report.txt".to_string()],
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            delete_aws_prefix(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                "docs".to_string(),
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );
        assert_eq!(
            change_aws_object_storage_class(
                "access-key".to_string(),
                "secret-key".to_string(),
                "other-bucket".to_string(),
                "docs/report.txt".to_string(),
                "STANDARD_IA".to_string(),
                Some("us-east-1".to_string()),
                Some("allowed-bucket".to_string()),
            )
            .await
            .unwrap_err(),
            "AWS_S3_RESTRICTED_BUCKET_MISMATCH"
        );

        assert_eq!(
            create_azure_folder(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                None,
                "reports".to_string(),
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            delete_azure_objects(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                vec!["docs/report.txt".to_string()],
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            delete_azure_prefix(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs".to_string(),
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            change_azure_blob_access_tier(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "Cool".to_string(),
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            rehydrate_azure_blob(
                "   ".to_string(),
                "unused-key".to_string(),
                "container-a".to_string(),
                "docs/archive.zip".to_string(),
                "Cool".to_string(),
                "Standard".to_string(),
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
    }

    #[tokio::test]
    async fn surfaces_non_http_url_and_blank_cache_errors_from_command_wrappers() {
        let invalid_url_error = open_external_url("ftp://example.com/file.txt".to_string())
            .await
            .expect_err("non-http url should fail");
        assert!(invalid_url_error.contains("Only HTTP and HTTPS URLs are supported"));

        let aws_blank_cache = find_aws_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            "   ".to_string(),
            vec!["docs/report.txt".to_string()],
        )
        .await
        .expect("blank aws cache directory should yield empty result");
        assert!(aws_blank_cache.is_empty());

        let azure_blank_cache = find_azure_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            "   ".to_string(),
            vec!["docs/report.txt".to_string()],
        )
        .await
        .expect("blank azure cache directory should yield empty result");
        assert!(azure_blank_cache.is_empty());

        let aws_open_error = open_aws_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "bucket-a".to_string(),
            "   ".to_string(),
            "docs/report.txt".to_string(),
        )
        .await
        .expect_err("blank aws cache dir should fail");
        assert!(aws_open_error.contains("Local cache directory is not configured"));

        let azure_open_error = open_azure_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            "   ".to_string(),
            "docs/report.txt".to_string(),
        )
        .await
        .expect_err("blank azure cache dir should fail");
        assert!(
            azure_open_error.contains("not available in the local cache")
                || azure_open_error.contains("Local cache directory is not configured")
        );
    }

    #[test]
    fn dispatch_progress_helpers_emit_correct_events_for_all_providers() {
        use std::cell::RefCell;

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_aws_cache_download_progress(
                &emit,
                "op-aws-cache",
                "conn-1",
                "bucket-a",
                "docs/report.txt",
                50,
                200,
                "/tmp/report.txt",
            )
            .expect("aws cache dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].transfer_kind, "cache");
        assert_eq!(events[0].progress_percent, 25.0);
        assert_eq!(events[0].target_path.as_deref(), Some("/tmp/report.txt"));
        assert_eq!(events[0].operation_id, "op-aws-cache");

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_aws_direct_download_progress(
                &emit,
                "op-aws-direct",
                "conn-2",
                "bucket-b",
                "archive.zip",
                100,
                400,
                "/home/user/archive.zip",
            )
            .expect("aws direct dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].transfer_kind, "direct");
        assert_eq!(events[0].progress_percent, 25.0);
        assert_eq!(
            events[0].target_path.as_deref(),
            Some("/home/user/archive.zip")
        );

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_azure_cache_download_progress(
                &emit,
                "op-azure-cache",
                "conn-3",
                "container-a",
                "blob.zip",
                75,
                300,
                "/tmp/blob.zip",
            )
            .expect("azure cache dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].transfer_kind, "cache");
        assert_eq!(events[0].progress_percent, 25.0);
        assert_eq!(events[0].target_path.as_deref(), Some("/tmp/blob.zip"));

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_azure_direct_download_progress(
                &emit,
                "op-azure-direct",
                "conn-4",
                "container-b",
                "archive.tar",
                10,
                100,
                "/home/user/archive.tar",
            )
            .expect("azure direct dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].transfer_kind, "direct");
        assert_eq!(events[0].progress_percent, 10.0);
        assert_eq!(
            events[0].target_path.as_deref(),
            Some("/home/user/archive.tar")
        );

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_aws_upload_progress(
                &emit,
                "op-aws-upload",
                "conn-5",
                "bucket-c",
                "upload.txt",
                "/local/upload.txt",
                200,
                800,
            )
            .expect("aws upload dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].progress_percent, 25.0);
        assert_eq!(events[0].local_file_path, "/local/upload.txt");

        let emitted: RefCell<Vec<_>> = RefCell::new(Vec::new());
        {
            let emit = |event| {
                emitted.borrow_mut().push(event);
                Ok(())
            };
            dispatch_azure_upload_progress(
                &emit,
                "op-azure-upload",
                "conn-6",
                "container-c",
                "upload.bin",
                "/local/upload.bin",
                50,
                50,
            )
            .expect("azure upload dispatch should succeed");
        }
        let events = emitted.into_inner();
        assert_eq!(events[0].state, "progress");
        assert_eq!(events[0].progress_percent, 100.0);
        assert_eq!(events[0].local_file_path, "/local/upload.bin");
    }

    #[test]
    fn dispatch_progress_helpers_propagate_emit_errors() {
        let result = dispatch_aws_cache_download_progress(
            &|_| Err("window unavailable".to_string()),
            "op-1",
            "conn-1",
            "bucket-a",
            "file.txt",
            0,
            0,
            "/tmp/file.txt",
        );
        assert_eq!(result, Err("window unavailable".to_string()));

        let result = dispatch_aws_direct_download_progress(
            &|_| Err("emit failed".to_string()),
            "op-2",
            "conn-2",
            "bucket-b",
            "file.txt",
            0,
            0,
            "/tmp/file.txt",
        );
        assert_eq!(result, Err("emit failed".to_string()));

        let result = dispatch_azure_cache_download_progress(
            &|_| Err("window unavailable".to_string()),
            "op-3",
            "conn-3",
            "container-a",
            "blob.txt",
            0,
            0,
            "/tmp/blob.txt",
        );
        assert_eq!(result, Err("window unavailable".to_string()));

        let result = dispatch_azure_direct_download_progress(
            &|_| Err("emit failed".to_string()),
            "op-4",
            "conn-4",
            "container-b",
            "blob.txt",
            0,
            0,
            "/tmp/blob.txt",
        );
        assert_eq!(result, Err("emit failed".to_string()));

        let result = dispatch_aws_upload_progress(
            &|_| Err("window unavailable".to_string()),
            "op-5",
            "conn-5",
            "bucket-c",
            "upload.txt",
            "/local/upload.txt",
            0,
            0,
        );
        assert_eq!(result, Err("window unavailable".to_string()));

        let result = dispatch_azure_upload_progress(
            &|_| Err("emit failed".to_string()),
            "op-6",
            "conn-6",
            "container-c",
            "upload.bin",
            "/local/upload.bin",
            0,
            0,
        );
        assert_eq!(result, Err("emit failed".to_string()));
    }
}
