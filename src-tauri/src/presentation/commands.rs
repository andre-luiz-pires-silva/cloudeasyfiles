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
            let progress_percent = if total_bytes > 0 {
                (bytes_received as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AwsDownloadEvent {
                operation_id: operation_id_for_progress.clone(),
                transfer_kind: "cache".to_string(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: bucket_name_for_progress.clone(),
                object_key: object_key_for_progress.clone(),
                target_path: Some(local_path.to_string()),
                bytes_received,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(download_result) => {
            emit_event(AwsDownloadEvent {
                operation_id: operation_id.clone(),
                transfer_kind: "cache".to_string(),
                connection_id: connection_id.clone(),
                bucket_name,
                object_key,
                target_path: Some(download_result.local_path),
                bytes_received: download_result.bytes_written,
                total_bytes: download_result.bytes_written,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(operation_id)
        }
        Err(error) => {
            eprintln!(
                "[commands] start_aws_cache_download failed for operation_id={} error={}",
                operation_id, error
            );

            let state = if is_cancelled_download_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AwsDownloadEvent {
                operation_id: operation_id.clone(),
                transfer_kind: "cache".to_string(),
                connection_id,
                bucket_name,
                object_key,
                target_path: None,
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_received as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AwsDownloadEvent {
                operation_id: operation_id_for_progress.clone(),
                transfer_kind: "direct".to_string(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: bucket_name_for_progress.clone(),
                object_key: object_key_for_progress.clone(),
                target_path: Some(target_path.to_string()),
                bytes_received,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(target_path) => {
            emit_event(AwsDownloadEvent {
                operation_id,
                transfer_kind: "direct".to_string(),
                connection_id,
                bucket_name,
                object_key,
                target_path: Some(target_path.clone()),
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(target_path)
        }
        Err(error) => {
            eprintln!(
                "[commands] download_aws_object_to_path failed with error={}",
                error
            );

            let state = if is_cancelled_download_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AwsDownloadEvent {
                operation_id,
                transfer_kind: "direct".to_string(),
                connection_id,
                bucket_name,
                object_key,
                target_path: None,
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_received as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AzureDownloadEvent {
                operation_id: operation_id_for_progress.clone(),
                transfer_kind: "cache".to_string(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: container_name_for_progress.clone(),
                object_key: blob_name_for_progress.clone(),
                target_path: Some(local_path.to_string()),
                bytes_received,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(AzureCacheDownloadResult {
            local_path,
            bytes_written,
        }) => {
            emit_event(AzureDownloadEvent {
                operation_id: operation_id.clone(),
                transfer_kind: "cache".to_string(),
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                target_path: Some(local_path),
                bytes_received: bytes_written,
                total_bytes: bytes_written,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(operation_id)
        }
        Err(error) => {
            let state = if is_cancelled_azure_download_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AzureDownloadEvent {
                operation_id: operation_id.clone(),
                transfer_kind: "cache".to_string(),
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                target_path: None,
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_received as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AzureDownloadEvent {
                operation_id: operation_id_for_progress.clone(),
                transfer_kind: "direct".to_string(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: container_name_for_progress.clone(),
                object_key: blob_name_for_progress.clone(),
                target_path: Some(target_path.to_string()),
                bytes_received,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(target_path) => {
            emit_event(AzureDownloadEvent {
                operation_id,
                transfer_kind: "direct".to_string(),
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                target_path: Some(target_path.clone()),
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(target_path)
        }
        Err(error) => {
            let state = if is_cancelled_azure_download_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AzureDownloadEvent {
                operation_id,
                transfer_kind: "direct".to_string(),
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                target_path: None,
                bytes_received: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_transferred as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AwsUploadEvent {
                operation_id: operation_id_for_progress.clone(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: bucket_name_for_progress.clone(),
                object_key: object_key_for_progress.clone(),
                local_file_path: local_file_path_for_progress.clone(),
                bytes_transferred,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(local_file_path) => {
            emit_event(AwsUploadEvent {
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path: local_file_path.clone(),
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(local_file_path)
        }
        Err(error) => {
            let state = if is_cancelled_upload_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AwsUploadEvent {
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path,
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_transferred as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AwsUploadEvent {
                operation_id: operation_id_for_progress.clone(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: bucket_name_for_progress.clone(),
                object_key: object_key_for_progress.clone(),
                local_file_path: file_name_for_progress.clone(),
                bytes_transferred,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(returned_file_name) => {
            emit_event(AwsUploadEvent {
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path: returned_file_name.clone(),
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(returned_file_name)
        }
        Err(error) => {
            let state = if is_cancelled_upload_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AwsUploadEvent {
                operation_id,
                connection_id,
                bucket_name,
                object_key,
                local_file_path: file_name,
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_transferred as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AzureUploadEvent {
                operation_id: operation_id_for_progress.clone(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: container_name_for_progress.clone(),
                object_key: blob_name_for_progress.clone(),
                local_file_path: local_file_path_for_progress.clone(),
                bytes_transferred,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(local_file_path) => {
            emit_event(AzureUploadEvent {
                operation_id,
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                local_file_path: local_file_path.clone(),
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(local_file_path)
        }
        Err(error) => {
            let state = if is_cancelled_azure_upload_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AzureUploadEvent {
                operation_id,
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                local_file_path,
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
            let progress_percent = if total_bytes > 0 {
                (bytes_transferred as f64 / total_bytes as f64) * 100.0
            } else {
                0.0
            };

            emit_event(AzureUploadEvent {
                operation_id: operation_id_for_progress.clone(),
                connection_id: connection_id_for_progress.clone(),
                bucket_name: container_name_for_progress.clone(),
                object_key: blob_name_for_progress.clone(),
                local_file_path: file_name_for_progress.clone(),
                bytes_transferred,
                total_bytes,
                progress_percent,
                state: "progress".to_string(),
                error: None,
            })
        },
    )
    .await;

    match result {
        Ok(returned_file_name) => {
            emit_event(AzureUploadEvent {
                operation_id,
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                local_file_path: returned_file_name.clone(),
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 100.0,
                state: "completed".to_string(),
                error: None,
            })?;

            Ok(returned_file_name)
        }
        Err(error) => {
            let state = if is_cancelled_azure_upload_error(&error) {
                "cancelled"
            } else {
                "failed"
            };

            emit_event(AzureUploadEvent {
                operation_id,
                connection_id,
                bucket_name: container_name,
                object_key: blob_name,
                local_file_path: file_name,
                bytes_transferred: 0,
                total_bytes: 0,
                progress_percent: 0.0,
                state: state.to_string(),
                error: Some(error.clone()),
            })?;

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
