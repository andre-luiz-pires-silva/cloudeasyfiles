use crate::application::services::aws_connection_service::{
    AwsConnectionService, DOWNLOAD_CANCELLED_ERROR,
};
use crate::application::services::aws_connection_secret_service::AwsConnectionSecretService;
use crate::application::services::greeting_service::GreetingService;
use crate::domain::aws_connection::{
    AwsBucketItemsResult, AwsBucketSummary, AwsConnectionTestInput, AwsConnectionTestResult,
};
use crate::domain::connection_secrets::{AwsConnectionSecretsInput, AwsConnectionSecretsOutput};
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
    continuation_token: Option<String>,
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
        continuation_token,
    )
    .await;

    if let Err(error) = &result {
        eprintln!("[commands] list_aws_bucket_items failed with error={}", error);
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
pub async fn cancel_aws_download(operation_id: String) -> Result<(), String> {
    let _was_cancelled = AwsConnectionService::cancel_download(operation_id)?;

    Ok(())
}
