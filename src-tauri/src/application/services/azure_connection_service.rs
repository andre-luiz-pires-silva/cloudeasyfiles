use crate::domain::azure_connection::{
    AzureBlobSummary, AzureCacheDownloadResult, AzureConnectionTestInput,
    AzureConnectionTestResult, AzureContainerItemsResult, AzureContainerSummary, AzureDeleteResult,
    AzureVirtualDirectorySummary,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::Utc;
use hmac::{Hmac, Mac};
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use quick_xml::de::from_str;
use reqwest::{Client, Method, Response, StatusCode, Url};
use serde::Deserialize;
use sha2::Sha256;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;

const AZURE_BLOB_API_VERSION: &str = "2023-11-03";
const DEFAULT_MAX_RESULTS: usize = 200;
const MAX_LISTING_PAGE_SIZE: usize = 1000;
const AZURE_UPLOAD_BLOCK_SIZE: usize = 8 * 1024 * 1024;
pub const AZURE_DOWNLOAD_CANCELLED_ERROR: &str = "DOWNLOAD_CANCELLED";
pub const AZURE_UPLOAD_CANCELLED_ERROR: &str = "UPLOAD_CANCELLED";
const AZURE_FOLDER_PLACEHOLDER_METADATA_KEY: &str = "hdi_isfolder";
const AZURE_FOLDER_PLACEHOLDER_METADATA_VALUE: &str = "true";
const AZURE_BLOB_PATH_ENCODE_SET: &AsciiSet = &CONTROLS
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

type HmacSha256 = Hmac<Sha256>;

struct DownloadCancellationGuard {
    operation_id: String,
}

struct UploadCancellationGuard {
    operation_id: String,
}

static DOWNLOAD_CANCELLATIONS: LazyLock<Mutex<BTreeMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(BTreeMap::new()));
static UPLOAD_CANCELLATIONS: LazyLock<Mutex<BTreeMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(BTreeMap::new()));

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

#[derive(Debug, Deserialize)]
struct ListContainersEnvelope {
    #[serde(rename = "Containers")]
    containers: Option<ListContainersNode>,
    #[serde(rename = "NextMarker")]
    next_marker: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListContainersNode {
    #[serde(rename = "Container", default)]
    containers: Vec<ListContainerNode>,
}

#[derive(Debug, Deserialize)]
struct ListContainerNode {
    #[serde(rename = "Name")]
    name: String,
}

#[derive(Debug, Deserialize)]
struct ListBlobsEnvelope {
    #[serde(rename = "Blobs")]
    blobs: Option<ListBlobsNode>,
    #[serde(rename = "NextMarker")]
    next_marker: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListBlobsNode {
    #[serde(rename = "$value", default)]
    entries: Vec<ListBlobsEntry>,
}

#[derive(Debug, Deserialize)]
enum ListBlobsEntry {
    #[serde(rename = "BlobPrefix")]
    Prefix(ListBlobPrefixNode),
    #[serde(rename = "Blob")]
    Blob(ListBlobNode),
}

#[derive(Debug, Deserialize)]
struct ListBlobPrefixNode {
    #[serde(rename = "Name")]
    name: String,
}

#[derive(Debug, Deserialize)]
struct ListBlobNode {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Properties")]
    properties: Option<ListBlobPropertiesNode>,
    #[serde(rename = "Metadata")]
    metadata: Option<ListBlobMetadataNode>,
}

#[derive(Debug, Deserialize)]
struct ListBlobPropertiesNode {
    #[serde(rename = "Content-Length")]
    content_length: Option<i64>,
    #[serde(rename = "Last-Modified")]
    last_modified: Option<String>,
    #[serde(rename = "Etag")]
    e_tag: Option<String>,
    #[serde(rename = "AccessTier")]
    access_tier: Option<String>,
    #[serde(rename = "ArchiveStatus")]
    archive_status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListBlobMetadataNode {
    #[serde(rename = "hdi_isfolder")]
    hdi_isfolder: Option<String>,
}

pub struct AzureConnectionService;

impl AzureConnectionService {
    const CACHE_TEMP_DIRECTORY: &'static str = ".cloudeasyfiles-tmp";
    const CACHE_ESCAPED_SEGMENT_PREFIX: &'static str = ".cloudeasyfiles-segment-";

    pub async fn test_connection(
        input: AzureConnectionTestInput,
    ) -> Result<AzureConnectionTestResult, String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let client = Client::new();

        Self::list_containers_internal(
            &client,
            &storage_account_name,
            &input.account_key,
            None,
            Some(1),
        )
        .await?;

        Ok(AzureConnectionTestResult {
            storage_account_name: storage_account_name.clone(),
            account_url: build_account_url(&storage_account_name),
        })
    }

    pub async fn list_containers(
        input: AzureConnectionTestInput,
    ) -> Result<Vec<AzureContainerSummary>, String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let client = Client::new();
        let (containers, _) = Self::list_containers_internal(
            &client,
            &storage_account_name,
            &input.account_key,
            None,
            Some(DEFAULT_MAX_RESULTS),
        )
        .await?;

        Ok(containers)
    }

    pub async fn list_container_items(
        input: AzureConnectionTestInput,
        container_name: String,
        prefix: Option<String>,
        continuation_token: Option<String>,
        page_size: Option<i32>,
    ) -> Result<AzureContainerItemsResult, String> {
        let prepared = prepare_list_container_items_request(
            input,
            container_name,
            prefix,
            continuation_token,
            page_size,
        )?;
        let client = Client::new();
        let url = build_container_url(
            &prepared.storage_account_name,
            &prepared.normalized_container_name,
            &prepared.query,
        )?;
        let response_text = execute_signed_get(
            &client,
            &prepared.storage_account_name,
            &prepared.account_key,
            url,
            format!("/{}", prepared.normalized_container_name),
        )
        .await?;
        parse_blob_listing_response(&response_text, prepared.normalized_prefix.as_deref())
    }

    pub async fn blob_exists(
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
    ) -> Result<bool, String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();
        let normalized_blob_name = blob_name.trim().to_string();

        if normalized_container_name.is_empty() || normalized_blob_name.is_empty() {
            return Ok(false);
        }

        let client = Client::new();
        let url = build_blob_url(
            &storage_account_name,
            &normalized_container_name,
            &normalized_blob_name,
            &[],
        )?;
        let response = execute_signed_request(
            &client,
            Method::HEAD,
            &storage_account_name,
            &input.account_key,
            url,
            format!("/{normalized_container_name}/{normalized_blob_name}"),
            None,
            Vec::new(),
        )
        .await?;

        if response.status() == StatusCode::NOT_FOUND {
            return Ok(false);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.map_err(|error| error.to_string())?;
            return Err(format!(
                "Azure Blob Storage request failed ({status}): {body}"
            ));
        }

        Ok(true)
    }

    pub async fn create_folder(
        input: AzureConnectionTestInput,
        container_name: String,
        parent_path: Option<String>,
        folder_name: String,
    ) -> Result<(), String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();

        if normalized_container_name.is_empty() {
            return Err("The Azure container name is required.".to_string());
        }

        let folder_blob_name = build_folder_blob_name(parent_path.as_deref(), &folder_name)?;

        let client = Client::new();
        upload_blob_single_request(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &folder_blob_name,
            Vec::new(),
            None,
            Some(vec![(
                format!("x-ms-meta-{AZURE_FOLDER_PLACEHOLDER_METADATA_KEY}"),
                AZURE_FOLDER_PLACEHOLDER_METADATA_VALUE.to_string(),
            )]),
        )
        .await
    }

    pub async fn delete_objects(
        input: AzureConnectionTestInput,
        container_name: String,
        object_keys: Vec<String>,
    ) -> Result<AzureDeleteResult, String> {
        let prepared = prepare_delete_objects_request(input, container_name, object_keys)?;

        let client = Client::new();
        delete_blob_names(
            &client,
            &prepared.storage_account_name,
            &prepared.account_key,
            &prepared.normalized_container_name,
            &prepared.normalized_object_keys,
        )
        .await?;

        Ok(AzureDeleteResult {
            deleted_object_count: prepared.normalized_object_keys.len() as i64,
            deleted_directory_count: 0,
        })
    }

    pub async fn delete_prefix(
        input: AzureConnectionTestInput,
        container_name: String,
        prefix: String,
    ) -> Result<AzureDeleteResult, String> {
        let prepared = prepare_delete_prefix_request(input, container_name, prefix)?;

        let client = Client::new();
        let mut marker = None;
        let mut object_keys = Vec::new();

        loop {
            let (mut batch, next_marker) = list_blob_names_with_prefix(
                &client,
                &prepared.storage_account_name,
                &prepared.account_key,
                &prepared.normalized_container_name,
                &prepared.recursive_prefix,
                marker.clone(),
            )
            .await?;
            object_keys.append(&mut batch);

            if !has_next_marker(next_marker.as_deref()) {
                break;
            }

            marker = next_marker;
        }

        object_keys.push(prepared.recursive_prefix);

        let normalized_object_keys = normalize_delete_object_keys(object_keys);
        delete_blob_names(
            &client,
            &prepared.storage_account_name,
            &prepared.account_key,
            &prepared.normalized_container_name,
            &normalized_object_keys,
        )
        .await?;

        Ok(AzureDeleteResult {
            deleted_object_count: normalized_object_keys.len() as i64,
            deleted_directory_count: 1,
        })
    }

    pub async fn download_blob_to_cache<F>(
        operation_id: String,
        input: AzureConnectionTestInput,
        connection_id: String,
        connection_name: String,
        container_name: String,
        blob_name: String,
        global_local_cache_directory: String,
        mut on_progress: F,
    ) -> Result<AzureCacheDownloadResult, String>
    where
        F: FnMut(i64, i64, &str) -> Result<(), String>,
    {
        let _connection_id = connection_id.trim().to_string();
        let connection_name = connection_name.trim().to_string();
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();
        let normalized_blob_name = blob_name.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_download_cancellation(&operation_id)?;

        if global_local_cache_directory.is_empty() {
            return Err("Local cache directory is required for tracked downloads.".to_string());
        }

        let client = Client::new();
        let response = download_blob_response(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
        )
        .await?;
        let total_bytes = response.content_length().unwrap_or(0) as i64;
        let final_path = Self::build_primary_cache_object_path(
            &global_local_cache_directory,
            &connection_name,
            &normalized_container_name,
            &normalized_blob_name,
        )?;
        let temp_path = Self::build_cache_temp_object_path(
            &global_local_cache_directory,
            &connection_name,
            &normalized_container_name,
            &normalized_blob_name,
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
        let mut response = response;
        let mut written_bytes = 0_i64;
        let final_path_string = final_path.to_string_lossy().to_string();

        if ensure_download_not_cancelled(&cancellation_flag).is_err() {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
            if ensure_download_not_cancelled(&cancellation_flag).is_err() {
                drop(file);
                Self::remove_temp_file_if_exists(&temp_path).await?;
                return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
            }

            file.write_all(&chunk)
                .await
                .map_err(|error| error.to_string())?;

            written_bytes += chunk.len() as i64;
            on_progress(written_bytes, total_bytes, &final_path_string)?;
        }

        file.flush().await.map_err(|error| error.to_string())?;
        drop(file);

        if ensure_download_not_cancelled(&cancellation_flag).is_err() {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
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

        Ok(AzureCacheDownloadResult {
            local_path: final_path_string,
            bytes_written: written_bytes,
        })
    }

    pub async fn download_blob_to_path<F>(
        operation_id: String,
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
        destination_path: String,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64, &str) -> Result<(), String>,
    {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();
        let normalized_blob_name = blob_name.trim().to_string();
        let destination_path = destination_path.trim().to_string();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_download_cancellation(&operation_id)?;

        if destination_path.is_empty() {
            return Err("Destination path is required for direct downloads.".to_string());
        }

        let client = Client::new();
        let response = download_blob_response(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
        )
        .await?;
        let final_path = PathBuf::from(&destination_path);
        let temp_path = Self::build_temp_file_path(&final_path)?;
        let total_bytes = response.content_length().unwrap_or(0) as i64;

        if let Some(parent_directory) = final_path.parent() {
            fs::create_dir_all(parent_directory)
                .await
                .map_err(|error| error.to_string())?;
        }

        let mut file = fs::File::create(&temp_path)
            .await
            .map_err(|error| error.to_string())?;
        let mut response = response;
        let mut written_bytes = 0_i64;

        if ensure_download_not_cancelled(&cancellation_flag).is_err() {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
        }

        while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
            if ensure_download_not_cancelled(&cancellation_flag).is_err() {
                drop(file);
                Self::remove_temp_file_if_exists(&temp_path).await?;
                return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
            }

            file.write_all(&chunk)
                .await
                .map_err(|error| error.to_string())?;

            written_bytes += chunk.len() as i64;
            on_progress(written_bytes, total_bytes, &destination_path)?;
        }

        file.flush().await.map_err(|error| error.to_string())?;
        drop(file);

        if ensure_download_not_cancelled(&cancellation_flag).is_err() {
            Self::remove_temp_file_if_exists(&temp_path).await?;
            return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
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

    pub async fn change_blob_access_tier(
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
        target_tier: String,
    ) -> Result<(), String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name =
            normalize_container_name_for_operation(&container_name, "access tier changes")?;
        let normalized_blob_name =
            normalize_blob_name_for_operation(&blob_name, "access tier changes")?;
        let normalized_target_tier = parse_access_tier(Some(target_tier.as_str()))?
            .ok_or_else(|| "A target Azure access tier is required.".to_string())?;
        let client = Client::new();

        set_blob_access_tier(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
            &normalized_target_tier,
            None,
        )
        .await
    }

    pub async fn rehydrate_blob(
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
        target_tier: String,
        priority: String,
    ) -> Result<(), String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name =
            normalize_container_name_for_operation(&container_name, "rehydration requests")?;
        let normalized_blob_name =
            normalize_blob_name_for_operation(&blob_name, "rehydration requests")?;
        let normalized_target_tier = parse_rehydration_target_tier(target_tier.as_str())?;
        let normalized_priority = parse_rehydration_priority(priority.as_str())?;
        let client = Client::new();

        set_blob_access_tier(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
            &normalized_target_tier,
            Some(normalized_priority.as_str()),
        )
        .await
    }

    pub async fn find_cached_objects(
        connection_id: String,
        connection_name: String,
        container_name: String,
        global_local_cache_directory: String,
        blob_names: Vec<String>,
    ) -> Result<Vec<String>, String> {
        let connection_id = connection_id.trim().to_string();
        let connection_name = connection_name.trim().to_string();
        let container_name = container_name.trim().to_string();
        let global_local_cache_directory = global_local_cache_directory.trim().to_string();

        if global_local_cache_directory.is_empty() {
            return Ok(Vec::new());
        }

        let mut cached_blob_names = Vec::new();

        for blob_name in blob_names {
            let normalized_blob_name = blob_name.trim().to_string();

            if normalized_blob_name.is_empty() {
                continue;
            }

            let blob_paths = Self::build_cache_object_path_candidates(
                &global_local_cache_directory,
                &connection_id,
                &connection_name,
                &container_name,
                &normalized_blob_name,
            )?;

            for blob_path in blob_paths {
                let exists = fs::try_exists(&blob_path)
                    .await
                    .map_err(|error| error.to_string())?;

                if exists {
                    cached_blob_names.push(normalized_blob_name.clone());
                    break;
                }
            }
        }

        Ok(cached_blob_names)
    }

    pub async fn open_cached_object_parent(
        connection_id: String,
        connection_name: String,
        container_name: String,
        global_local_cache_directory: String,
        blob_name: String,
    ) -> Result<(), String> {
        let object_path = Self::resolve_cached_object_path(
            connection_id,
            connection_name,
            container_name,
            global_local_cache_directory,
            blob_name,
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
        container_name: String,
        global_local_cache_directory: String,
        blob_name: String,
    ) -> Result<(), String> {
        let object_path = Self::resolve_cached_object_path(
            connection_id,
            connection_name,
            container_name,
            global_local_cache_directory,
            blob_name,
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

    pub async fn upload_blob_from_path<F>(
        operation_id: String,
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
        local_file_path: String,
        access_tier: Option<String>,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64) -> Result<(), String>,
    {
        let local_file_path = local_file_path.trim().to_string();

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

        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();
        let normalized_blob_name = blob_name.trim().to_string();
        let normalized_access_tier = parse_access_tier(access_tier.as_deref())?;
        let total_bytes = i64::try_from(metadata.len())
            .map_err(|_| "The selected file is too large to upload.".to_string())?;
        let client = Client::new();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_upload_cancellation(&operation_id)?;

        if normalized_container_name.is_empty() {
            return Err("The Azure container name is required.".to_string());
        }

        if normalized_blob_name.is_empty() {
            return Err("Blob name is required for uploads.".to_string());
        }

        ensure_upload_not_cancelled(&cancellation_flag)?;

        let mut file = fs::File::open(&file_path)
            .await
            .map_err(|error| error.to_string())?;

        if should_use_single_request_upload(metadata.len() as usize) {
            let mut file_bytes = Vec::with_capacity(metadata.len() as usize);
            file.read_to_end(&mut file_bytes)
                .await
                .map_err(|error| error.to_string())?;
            upload_blob_single_request(
                &client,
                &storage_account_name,
                &input.account_key,
                &normalized_container_name,
                &normalized_blob_name,
                file_bytes,
                normalized_access_tier.as_deref(),
                None,
            )
            .await?;
            on_progress(total_bytes, total_bytes)?;
            return Ok(local_file_path);
        }

        let mut transferred_bytes = 0_i64;
        let mut block_ids = Vec::new();
        let mut chunk_buffer = vec![0_u8; AZURE_UPLOAD_BLOCK_SIZE];
        let mut next_block_index = 0_usize;

        loop {
            ensure_upload_not_cancelled(&cancellation_flag)?;

            let bytes_read = file
                .read(&mut chunk_buffer)
                .await
                .map_err(|error| error.to_string())?;

            if bytes_read == 0 {
                break;
            }

            let block_id = build_block_id(next_block_index);
            upload_blob_block(
                &client,
                &storage_account_name,
                &input.account_key,
                &normalized_container_name,
                &normalized_blob_name,
                &block_id,
                chunk_buffer[..bytes_read].to_vec(),
            )
            .await?;
            block_ids.push(block_id);
            transferred_bytes +=
                i64::try_from(bytes_read).map_err(|_| "Chunk too large.".to_string())?;
            on_progress(transferred_bytes, total_bytes)?;
            next_block_index += 1;
        }

        ensure_upload_not_cancelled(&cancellation_flag)?;

        commit_blob_blocks(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
            &block_ids,
            normalized_access_tier.as_deref(),
        )
        .await?;

        Ok(local_file_path)
    }

    pub async fn upload_blob_from_bytes<F>(
        operation_id: String,
        input: AzureConnectionTestInput,
        container_name: String,
        blob_name: String,
        file_name: String,
        file_bytes: Vec<u8>,
        access_tier: Option<String>,
        mut on_progress: F,
    ) -> Result<String, String>
    where
        F: FnMut(i64, i64) -> Result<(), String>,
    {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();
        let normalized_blob_name = blob_name.trim().to_string();
        let normalized_file_name = file_name.trim().to_string();
        let normalized_access_tier = parse_access_tier(access_tier.as_deref())?;
        let total_bytes = i64::try_from(file_bytes.len())
            .map_err(|_| "The selected file is too large to upload.".to_string())?;
        let client = Client::new();
        let (cancellation_flag, _cancellation_guard) =
            Self::register_upload_cancellation(&operation_id)?;

        if normalized_container_name.is_empty() {
            return Err("The Azure container name is required.".to_string());
        }

        if normalized_blob_name.is_empty() {
            return Err("Blob name is required for uploads.".to_string());
        }

        if normalized_file_name.is_empty() {
            return Err("File name is required for uploads.".to_string());
        }

        ensure_upload_not_cancelled(&cancellation_flag)?;

        if should_use_single_request_upload(file_bytes.len()) {
            upload_blob_single_request(
                &client,
                &storage_account_name,
                &input.account_key,
                &normalized_container_name,
                &normalized_blob_name,
                file_bytes,
                normalized_access_tier.as_deref(),
                None,
            )
            .await?;
            on_progress(total_bytes, total_bytes)?;
            return Ok(normalized_file_name);
        }

        let mut transferred_bytes = 0_i64;
        let mut block_ids = Vec::new();

        for (index, chunk) in file_bytes.chunks(AZURE_UPLOAD_BLOCK_SIZE).enumerate() {
            ensure_upload_not_cancelled(&cancellation_flag)?;

            let block_id = build_block_id(index);
            upload_blob_block(
                &client,
                &storage_account_name,
                &input.account_key,
                &normalized_container_name,
                &normalized_blob_name,
                &block_id,
                chunk.to_vec(),
            )
            .await?;
            block_ids.push(block_id);
            transferred_bytes +=
                i64::try_from(chunk.len()).map_err(|_| "Chunk too large.".to_string())?;
            on_progress(transferred_bytes, total_bytes)?;
        }

        ensure_upload_not_cancelled(&cancellation_flag)?;

        commit_blob_blocks(
            &client,
            &storage_account_name,
            &input.account_key,
            &normalized_container_name,
            &normalized_blob_name,
            &block_ids,
            normalized_access_tier.as_deref(),
        )
        .await?;

        Ok(normalized_file_name)
    }

    async fn list_containers_internal(
        client: &Client,
        storage_account_name: &str,
        account_key: &str,
        marker: Option<String>,
        max_results: Option<usize>,
    ) -> Result<(Vec<AzureContainerSummary>, Option<String>), String> {
        let mut query = vec![("comp".to_string(), "list".to_string())];

        if let Some(marker_value) = marker.filter(|value| !value.trim().is_empty()) {
            query.push(("marker".to_string(), marker_value));
        }

        if let Some(max_results_value) = max_results {
            query.push(("maxresults".to_string(), max_results_value.to_string()));
        }

        let url = build_service_url(storage_account_name, &query)?;
        let response_text = execute_signed_get(
            client,
            storage_account_name,
            account_key,
            url,
            "/".to_string(),
        )
        .await?;
        parse_container_listing_response(&response_text)
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

        #[cfg(target_os = "windows")]
        {
            let normalized = segment.trim_end_matches([' ', '.']);

            if normalized.is_empty() {
                return Self::encode_cache_path_segment(segment);
            }

            let uppercase = normalized.to_ascii_uppercase();
            let reserved_names = [
                "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
                "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
                "LPT9",
            ];

            if reserved_names.contains(&uppercase.as_str()) {
                return Self::encode_cache_path_segment(segment);
            }

            return normalized.to_string();
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
        container_name: &str,
        blob_name: &str,
    ) -> Result<PathBuf, String> {
        if blob_name.is_empty() {
            return Err("Blob name is required for local cache operations.".to_string());
        }

        let normalized_object_path = blob_name.split('/').fold(PathBuf::new(), |path, segment| {
            path.join(Self::normalize_cache_path_segment(segment))
        });

        Ok(
            Self::build_connection_cache_root(global_local_cache_directory, connection_name)?
                .join(container_name)
                .join(normalized_object_path),
        )
    }

    fn build_legacy_raw_cache_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        container_name: &str,
        blob_name: &str,
    ) -> Result<PathBuf, String> {
        if blob_name.is_empty() {
            return Err("Blob name is required for local cache operations.".to_string());
        }

        Ok(PathBuf::from(global_local_cache_directory)
            .join(connection_id)
            .join(container_name)
            .join(blob_name))
    }

    fn build_legacy_encoded_cache_object_path(
        global_local_cache_directory: &str,
        connection_id: &str,
        container_name: &str,
        blob_name: &str,
    ) -> Result<PathBuf, String> {
        if blob_name.is_empty() {
            return Err("Blob name is required for local cache operations.".to_string());
        }

        let encoded_object_path = blob_name.split('/').fold(PathBuf::new(), |path, segment| {
            path.join(Self::encode_cache_path_segment(segment))
        });

        Ok(PathBuf::from(global_local_cache_directory)
            .join(connection_id)
            .join(container_name)
            .join(encoded_object_path))
    }

    fn build_recent_legacy_cache_object_path(
        global_local_cache_directory: &str,
        container_name: &str,
        blob_name: &str,
    ) -> Result<PathBuf, String> {
        if blob_name.is_empty() {
            return Err("Blob name is required for local cache operations.".to_string());
        }

        let normalized_object_path = blob_name.split('/').fold(PathBuf::new(), |path, segment| {
            path.join(Self::normalize_cache_path_segment(segment))
        });

        Ok(PathBuf::from(global_local_cache_directory)
            .join(container_name)
            .join(normalized_object_path))
    }

    fn build_cache_object_path_candidates(
        global_local_cache_directory: &str,
        connection_id: &str,
        connection_name: &str,
        container_name: &str,
        blob_name: &str,
    ) -> Result<Vec<PathBuf>, String> {
        let mut paths = Vec::new();

        paths.push(Self::build_primary_cache_object_path(
            global_local_cache_directory,
            connection_name,
            container_name,
            blob_name,
        )?);

        let recent_legacy_path = Self::build_recent_legacy_cache_object_path(
            global_local_cache_directory,
            container_name,
            blob_name,
        )?;

        if !paths.contains(&recent_legacy_path) {
            paths.push(recent_legacy_path);
        }

        let legacy_raw_path = Self::build_legacy_raw_cache_object_path(
            global_local_cache_directory,
            connection_id,
            container_name,
            blob_name,
        )?;

        if !paths.contains(&legacy_raw_path) {
            paths.push(legacy_raw_path);
        }

        let legacy_encoded_path = Self::build_legacy_encoded_cache_object_path(
            global_local_cache_directory,
            connection_id,
            container_name,
            blob_name,
        )?;

        if !paths.contains(&legacy_encoded_path) {
            paths.push(legacy_encoded_path);
        }

        Ok(paths)
    }

    fn build_cache_temp_object_path(
        global_local_cache_directory: &str,
        connection_name: &str,
        container_name: &str,
        blob_name: &str,
    ) -> Result<PathBuf, String> {
        let cache_object_path = Self::build_primary_cache_object_path(
            global_local_cache_directory,
            connection_name,
            container_name,
            blob_name,
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
            .with_extension(format!("part-{}-{timestamp}", std::process::id())))
    }

    fn build_temp_file_path(final_path: &std::path::Path) -> Result<PathBuf, String> {
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

    async fn remove_temp_file_if_exists(path: &PathBuf) -> Result<(), String> {
        if fs::try_exists(path)
            .await
            .map_err(|error| error.to_string())?
        {
            fs::remove_file(path)
                .await
                .map_err(|error| error.to_string())?;
        }

        Ok(())
    }

    async fn resolve_cached_object_path(
        connection_id: String,
        connection_name: String,
        container_name: String,
        global_local_cache_directory: String,
        blob_name: String,
    ) -> Result<PathBuf, String> {
        let object_paths = Self::build_cache_object_path_candidates(
            global_local_cache_directory.trim(),
            connection_id.trim(),
            connection_name.trim(),
            container_name.trim(),
            blob_name.trim(),
        )?;

        for object_path in object_paths {
            let exists = fs::try_exists(&object_path)
                .await
                .map_err(|error| error.to_string())?;

            if exists {
                return Ok(object_path);
            }
        }

        Err("The requested file is not available in the local cache.".to_string())
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
}

fn normalize_storage_account_name(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Err("The Azure storage account name is required.".to_string());
    }

    Ok(normalized)
}

fn normalize_prefix(prefix: Option<String>) -> Option<String> {
    prefix
        .map(|value| value.trim().trim_start_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .map(|value| {
            if value.ends_with('/') {
                value
            } else {
                format!("{value}/")
            }
        })
}

struct PreparedAzureListContainerItemsRequest {
    storage_account_name: String,
    account_key: String,
    normalized_container_name: String,
    normalized_prefix: Option<String>,
    query: Vec<(String, String)>,
}

struct PreparedAzureDeleteObjectsRequest {
    storage_account_name: String,
    account_key: String,
    normalized_container_name: String,
    normalized_object_keys: Vec<String>,
}

struct PreparedAzureDeletePrefixRequest {
    storage_account_name: String,
    account_key: String,
    normalized_container_name: String,
    recursive_prefix: String,
}

fn prepare_list_container_items_request(
    input: AzureConnectionTestInput,
    container_name: String,
    prefix: Option<String>,
    continuation_token: Option<String>,
    page_size: Option<i32>,
) -> Result<PreparedAzureListContainerItemsRequest, String> {
    let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
    let normalized_container_name = container_name.trim().to_string();

    if normalized_container_name.is_empty() {
        return Err("The Azure container name is required.".to_string());
    }

    let normalized_prefix = normalize_prefix(prefix);
    let mut query = vec![
        ("restype".to_string(), "container".to_string()),
        ("comp".to_string(), "list".to_string()),
        ("delimiter".to_string(), "/".to_string()),
        ("include".to_string(), "metadata".to_string()),
        (
            "maxresults".to_string(),
            normalize_listing_page_size(page_size).to_string(),
        ),
    ];

    if let Some(prefix_value) = normalized_prefix.clone() {
        query.push(("prefix".to_string(), prefix_value));
    }

    if let Some(marker_value) = continuation_token.filter(|value| !value.trim().is_empty()) {
        query.push(("marker".to_string(), marker_value));
    }

    Ok(PreparedAzureListContainerItemsRequest {
        storage_account_name,
        account_key: input.account_key,
        normalized_container_name,
        normalized_prefix,
        query,
    })
}

fn prepare_delete_objects_request(
    input: AzureConnectionTestInput,
    container_name: String,
    object_keys: Vec<String>,
) -> Result<PreparedAzureDeleteObjectsRequest, String> {
    let normalized_object_keys = normalize_delete_object_keys(object_keys);

    if normalized_object_keys.is_empty() {
        return Err("At least one blob name is required for delete requests.".to_string());
    }

    Ok(PreparedAzureDeleteObjectsRequest {
        storage_account_name: normalize_storage_account_name(&input.storage_account_name)?,
        account_key: input.account_key,
        normalized_container_name: normalize_container_name_for_operation(
            &container_name,
            "delete requests",
        )?,
        normalized_object_keys,
    })
}

fn prepare_delete_prefix_request(
    input: AzureConnectionTestInput,
    container_name: String,
    prefix: String,
) -> Result<PreparedAzureDeletePrefixRequest, String> {
    Ok(PreparedAzureDeletePrefixRequest {
        storage_account_name: normalize_storage_account_name(&input.storage_account_name)?,
        account_key: input.account_key,
        normalized_container_name: normalize_container_name_for_operation(
            &container_name,
            "delete requests",
        )?,
        recursive_prefix: normalize_recursive_delete_prefix(&prefix)?,
    })
}

fn normalize_delete_object_keys(object_keys: Vec<String>) -> Vec<String> {
    let mut normalized_object_keys = Vec::new();
    let mut seen_object_keys = BTreeMap::<String, ()>::new();

    for object_key in object_keys {
        let normalized_object_key = object_key.trim().trim_start_matches('/').to_string();

        if normalized_object_key.is_empty() {
            continue;
        }

        if seen_object_keys
            .insert(normalized_object_key.clone(), ())
            .is_none()
        {
            normalized_object_keys.push(normalized_object_key);
        }
    }

    normalized_object_keys
}

fn normalize_container_name_for_operation(
    container_name: &str,
    operation: &str,
) -> Result<String, String> {
    let normalized_container_name = container_name.trim().to_string();

    if normalized_container_name.is_empty() {
        return Err(format!(
            "The Azure container name is required for {operation}."
        ));
    }

    Ok(normalized_container_name)
}

fn normalize_blob_name_for_operation(blob_name: &str, operation: &str) -> Result<String, String> {
    let normalized_blob_name = blob_name.trim().to_string();

    if normalized_blob_name.is_empty() {
        return Err(format!("The Azure blob name is required for {operation}."));
    }

    Ok(normalized_blob_name)
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

fn build_folder_blob_name(parent_path: Option<&str>, folder_name: &str) -> Result<String, String> {
    let normalized_folder_name = folder_name.trim();
    let normalized_parent_path = parent_path.unwrap_or_default().trim().trim_matches('/');

    if normalized_folder_name.is_empty() {
        return Err("Folder name is required.".to_string());
    }

    if normalized_folder_name.contains('/') || normalized_folder_name.contains('\\') {
        return Err("Folder name cannot contain path separators.".to_string());
    }

    if normalized_parent_path.is_empty() {
        Ok(format!("{normalized_folder_name}/"))
    } else {
        Ok(format!(
            "{normalized_parent_path}/{normalized_folder_name}/"
        ))
    }
}

fn parse_container_listing_response(
    response_text: &str,
) -> Result<(Vec<AzureContainerSummary>, Option<String>), String> {
    let parsed: ListContainersEnvelope = from_str(response_text)
        .map_err(|error| format!("Failed to parse Azure container listing XML: {error}"))?;
    let containers = parsed
        .containers
        .map(|node| {
            node.containers
                .into_iter()
                .map(|container| AzureContainerSummary {
                    name: container.name,
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok((
        containers,
        parsed.next_marker.filter(|value| !value.is_empty()),
    ))
}

fn parse_blob_listing_response(
    response_text: &str,
    normalized_prefix: Option<&str>,
) -> Result<AzureContainerItemsResult, String> {
    let parsed: ListBlobsEnvelope = from_str(response_text)
        .map_err(|error| format!("Failed to parse Azure blob listing XML: {error}"))?;
    let blobs_node = parsed.blobs.unwrap_or(ListBlobsNode {
        entries: Vec::new(),
    });
    let mut blob_entries = Vec::new();
    let mut directories = Vec::new();

    for entry in blobs_node.entries {
        match entry {
            ListBlobsEntry::Prefix(prefix) => {
                directories.push(AzureVirtualDirectorySummary {
                    name: get_leaf_name(&prefix.name),
                    path: prefix.name,
                });
            }
            ListBlobsEntry::Blob(blob) => {
                blob_entries.push(blob);
            }
        }
    }

    let mut seen_directory_paths = directories
        .iter()
        .map(|directory| (directory.path.clone(), ()))
        .collect::<BTreeMap<_, _>>();
    let files = blob_entries
        .into_iter()
        .filter_map(|blob| {
            let is_folder_placeholder = blob
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.hdi_isfolder.as_deref())
                .map(|value| value.eq_ignore_ascii_case(AZURE_FOLDER_PLACEHOLDER_METADATA_VALUE))
                .unwrap_or(false);

            if is_folder_placeholder {
                if normalized_prefix == Some(blob.name.as_str()) {
                    return None;
                }

                if seen_directory_paths.insert(blob.name.clone(), ()).is_none() {
                    directories.push(AzureVirtualDirectorySummary {
                        name: get_leaf_name(&blob.name),
                        path: blob.name,
                    });
                }

                return None;
            }

            let properties = blob.properties.unwrap_or(ListBlobPropertiesNode {
                content_length: None,
                last_modified: None,
                e_tag: None,
                access_tier: None,
                archive_status: None,
            });

            Some(AzureBlobSummary {
                name: blob.name.clone(),
                size: properties.content_length.unwrap_or(0),
                e_tag: properties.e_tag,
                last_modified: properties.last_modified,
                storage_class: properties.access_tier,
                restore_in_progress: properties
                    .archive_status
                    .as_ref()
                    .map(|status| status.to_ascii_lowercase().contains("rehydrate-pending")),
                restore_expiry_date: None,
            })
        })
        .collect::<Vec<_>>();

    Ok(AzureContainerItemsResult {
        directories,
        files,
        continuation_token: parsed.next_marker.clone().filter(|value| !value.is_empty()),
        has_more: parsed
            .next_marker
            .as_ref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
    })
}

fn build_account_url(storage_account_name: &str) -> String {
    format!("https://{storage_account_name}.blob.core.windows.net")
}

fn build_service_url(
    storage_account_name: &str,
    query: &[(String, String)],
) -> Result<Url, String> {
    let mut url = Url::parse(&format!("{}/", build_account_url(storage_account_name)))
        .map_err(|error| error.to_string())?;
    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in query {
            pairs.append_pair(key, value);
        }
    }
    Ok(url)
}

fn build_container_url(
    storage_account_name: &str,
    container_name: &str,
    query: &[(String, String)],
) -> Result<Url, String> {
    let mut url = Url::parse(&format!(
        "{}/{container_name}",
        build_account_url(storage_account_name)
    ))
    .map_err(|error| error.to_string())?;
    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in query {
            pairs.append_pair(key, value);
        }
    }
    Ok(url)
}

fn build_blob_url(
    storage_account_name: &str,
    container_name: &str,
    blob_name: &str,
    query: &[(String, String)],
) -> Result<Url, String> {
    let mut url =
        Url::parse(&build_account_url(storage_account_name)).map_err(|error| error.to_string())?;
    let mut path = format!(
        "/{}/{}",
        utf8_percent_encode(container_name, AZURE_BLOB_PATH_ENCODE_SET),
        blob_name
            .split('/')
            .filter(|segment| !segment.is_empty())
            .map(|segment| utf8_percent_encode(segment, AZURE_BLOB_PATH_ENCODE_SET).to_string())
            .collect::<Vec<_>>()
            .join("/")
    );

    if blob_name.ends_with('/') && !path.ends_with('/') {
        path.push('/');
    }

    url.set_path(&path);

    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in query {
            pairs.append_pair(key, value);
        }
    }
    Ok(url)
}

async fn execute_signed_get(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    url: Url,
    _canonicalized_resource_path: String,
) -> Result<String, String> {
    let response = execute_signed_request(
        client,
        Method::GET,
        storage_account_name,
        account_key,
        url,
        String::new(),
        None,
        Vec::new(),
    )
    .await?;
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;

    if !status.is_success() {
        return Err(format!(
            "Azure Blob Storage request failed ({status}): {body}"
        ));
    }

    Ok(body)
}

async fn execute_signed_request(
    client: &Client,
    method: Method,
    storage_account_name: &str,
    account_key: &str,
    url: Url,
    _canonicalized_resource_path: String,
    body: Option<Vec<u8>>,
    extra_headers: Vec<(String, String)>,
) -> Result<Response, String> {
    let canonicalized_resource_path = url.path().to_string();
    let requires_zero_content_length =
        body.is_none() && (method == Method::PUT || method == Method::POST);
    let request_date = Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    let content_length = body.as_ref().map(|value| value.len() as u64);
    let content_length_header = content_length
        .filter(|value| *value > 0)
        .map(|value| value.to_string());
    let content_type = if body.is_some() {
        Some("application/octet-stream".to_string())
    } else {
        None
    };
    let mut canonicalized_ms_headers = vec![
        ("x-ms-date".to_string(), request_date.clone()),
        (
            "x-ms-version".to_string(),
            AZURE_BLOB_API_VERSION.to_string(),
        ),
    ];
    canonicalized_ms_headers.extend(extra_headers.clone());
    let authorization = build_shared_key_authorization(
        storage_account_name,
        account_key,
        method.as_str(),
        &canonicalized_ms_headers,
        content_length_header.as_deref(),
        content_type.as_deref(),
        &canonicalized_resource_path,
        url.query(),
    )?;

    let mut request = client.request(method, url);
    request = request.header("x-ms-date", request_date);
    request = request.header("x-ms-version", AZURE_BLOB_API_VERSION);
    request = request.header("Authorization", authorization);

    for (key, value) in extra_headers {
        request = request.header(&key, value);
    }

    if let Some(content_type_value) = content_type {
        request = request.header("Content-Type", content_type_value);
    }

    if let Some(content_length_value) = content_length {
        request = request.header("Content-Length", content_length_value);
    } else if requires_zero_content_length {
        request = request.header("Content-Length", 0);
    }

    if let Some(body_bytes) = body {
        request = request.body(body_bytes);
    }

    request.send().await.map_err(|error| error.to_string())
}

fn build_shared_key_authorization(
    storage_account_name: &str,
    account_key: &str,
    method: &str,
    ms_headers: &[(String, String)],
    content_length: Option<&str>,
    content_type: Option<&str>,
    canonicalized_resource_path: &str,
    query: Option<&str>,
) -> Result<String, String> {
    let canonicalized_headers = build_canonicalized_headers(ms_headers);
    let canonicalized_resource =
        build_canonicalized_resource(storage_account_name, canonicalized_resource_path, query)?;
    let string_to_sign = format!(
        "{method}\n\n\n{}\n\n{}\n\n\n\n\n\n\n{canonicalized_headers}{canonicalized_resource}",
        content_length.unwrap_or(""),
        content_type.unwrap_or("")
    );
    let key = BASE64_STANDARD
        .decode(account_key.trim())
        .map_err(|error| format!("Invalid Azure account key: {error}"))?;
    let mut mac = HmacSha256::new_from_slice(&key)
        .map_err(|error| format!("Invalid Azure account key: {error}"))?;
    mac.update(string_to_sign.as_bytes());
    let signature = BASE64_STANDARD.encode(mac.finalize().into_bytes());

    Ok(format!("SharedKey {storage_account_name}:{signature}"))
}

fn build_canonicalized_headers(ms_headers: &[(String, String)]) -> String {
    let mut sorted_headers = ms_headers
        .iter()
        .map(|(key, value)| (key.to_ascii_lowercase(), value.trim().to_string()))
        .filter(|(key, _)| key.starts_with("x-ms-"))
        .collect::<Vec<_>>();
    sorted_headers.sort_by(|left, right| left.0.cmp(&right.0));

    sorted_headers
        .into_iter()
        .map(|(key, value)| format!("{key}:{value}\n"))
        .collect::<String>()
}

fn build_canonicalized_resource(
    storage_account_name: &str,
    path: &str,
    query: Option<&str>,
) -> Result<String, String> {
    let mut resource = format!("/{storage_account_name}{path}");

    if let Some(query_value) = query.filter(|value| !value.is_empty()) {
        let query_url = Url::parse(&format!("https://dummy.invalid/?{query_value}"))
            .map_err(|error| error.to_string())?;
        let mut query_map = BTreeMap::<String, Vec<String>>::new();

        for (key, value) in query_url.query_pairs() {
            query_map
                .entry(key.to_string().to_ascii_lowercase())
                .or_default()
                .push(value.to_string());
        }

        for (key, values) in query_map.iter_mut() {
            values.sort();
            resource.push('\n');
            resource.push_str(key);
            resource.push(':');
            resource.push_str(&values.join(","));
        }
    }

    Ok(resource)
}

fn get_leaf_name(path: &str) -> String {
    path.trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn parse_access_tier(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(value) = value
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };

    match value {
        "Hot" | "Cool" | "Cold" | "Archive" => Ok(Some(value.to_string())),
        _ => Err("Unsupported Azure upload access tier.".to_string()),
    }
}

fn parse_rehydration_target_tier(value: &str) -> Result<String, String> {
    match value.trim() {
        "Hot" | "Cool" | "Cold" => Ok(value.trim().to_string()),
        _ => Err("Unsupported Azure rehydration target tier.".to_string()),
    }
}

fn parse_rehydration_priority(value: &str) -> Result<String, String> {
    match value.trim() {
        "Standard" | "High" => Ok(value.trim().to_string()),
        _ => Err("Unsupported Azure rehydration priority.".to_string()),
    }
}

fn normalize_listing_page_size(value: Option<i32>) -> usize {
    match value.unwrap_or(DEFAULT_MAX_RESULTS as i32) {
        value if value < 1 => 1,
        value if value > MAX_LISTING_PAGE_SIZE as i32 => MAX_LISTING_PAGE_SIZE,
        value => value as usize,
    }
}

fn build_access_tier_headers(
    target_tier: &str,
    rehydration_priority: Option<&str>,
) -> Vec<(String, String)> {
    let mut extra_headers = vec![("x-ms-access-tier".to_string(), target_tier.to_string())];

    if let Some(rehydration_priority) = rehydration_priority {
        extra_headers.push((
            "x-ms-rehydrate-priority".to_string(),
            rehydration_priority.to_string(),
        ));
    }

    extra_headers
}

fn build_list_blob_names_query(prefix: &str, marker: Option<String>) -> Vec<(String, String)> {
    let mut query = vec![
        ("restype".to_string(), "container".to_string()),
        ("comp".to_string(), "list".to_string()),
        ("prefix".to_string(), prefix.to_string()),
        ("include".to_string(), "metadata".to_string()),
        ("maxresults".to_string(), DEFAULT_MAX_RESULTS.to_string()),
    ];

    if let Some(marker_value) = marker.filter(|value| !value.trim().is_empty()) {
        query.push(("marker".to_string(), marker_value));
    }

    query
}

fn has_next_marker(marker: Option<&str>) -> bool {
    marker
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn should_use_single_request_upload(byte_count: usize) -> bool {
    byte_count <= AZURE_UPLOAD_BLOCK_SIZE
}

fn ensure_upload_not_cancelled(cancellation_flag: &AtomicBool) -> Result<(), String> {
    if cancellation_flag.load(Ordering::SeqCst) {
        return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
    }

    Ok(())
}

fn ensure_download_not_cancelled(cancellation_flag: &AtomicBool) -> Result<(), String> {
    if cancellation_flag.load(Ordering::SeqCst) {
        return Err(AZURE_DOWNLOAD_CANCELLED_ERROR.to_string());
    }

    Ok(())
}

fn build_block_id(index: usize) -> String {
    BASE64_STANDARD.encode(format!("{index:08}"))
}

async fn upload_blob_single_request(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
    file_bytes: Vec<u8>,
    access_tier: Option<&str>,
    additional_headers: Option<Vec<(String, String)>>,
) -> Result<(), String> {
    let extra_headers = build_single_upload_headers(access_tier, additional_headers);

    let url = build_blob_url(storage_account_name, container_name, blob_name, &[])?;
    let response = execute_signed_request(
        client,
        Method::PUT,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}/{blob_name}"),
        Some(file_bytes),
        extra_headers,
    )
    .await?;
    ensure_success_response(response).await
}

async fn upload_blob_block(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
    block_id: &str,
    file_bytes: Vec<u8>,
) -> Result<(), String> {
    let query = vec![
        ("comp".to_string(), "block".to_string()),
        ("blockid".to_string(), block_id.to_string()),
    ];
    let url = build_blob_url(storage_account_name, container_name, blob_name, &query)?;
    let response = execute_signed_request(
        client,
        Method::PUT,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}/{blob_name}"),
        Some(file_bytes),
        Vec::new(),
    )
    .await?;
    ensure_success_response(response).await
}

async fn commit_blob_blocks(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
    block_ids: &[String],
    access_tier: Option<&str>,
) -> Result<(), String> {
    let extra_headers = build_commit_blob_headers(access_tier);
    let block_list_xml = build_block_list_xml(block_ids);
    let query = vec![("comp".to_string(), "blocklist".to_string())];
    let url = build_blob_url(storage_account_name, container_name, blob_name, &query)?;
    let response = execute_signed_request(
        client,
        Method::PUT,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}/{blob_name}"),
        Some(block_list_xml),
        extra_headers,
    )
    .await?;
    ensure_success_response(response).await
}

fn build_single_upload_headers(
    access_tier: Option<&str>,
    additional_headers: Option<Vec<(String, String)>>,
) -> Vec<(String, String)> {
    let mut extra_headers = vec![("x-ms-blob-type".to_string(), "BlockBlob".to_string())];

    if let Some(access_tier) = access_tier {
        extra_headers.push(("x-ms-access-tier".to_string(), access_tier.to_string()));
    }

    if let Some(mut additional_headers) = additional_headers {
        extra_headers.append(&mut additional_headers);
    }

    extra_headers
}

fn build_commit_blob_headers(access_tier: Option<&str>) -> Vec<(String, String)> {
    let mut extra_headers = vec![(
        "x-ms-blob-content-type".to_string(),
        "application/octet-stream".to_string(),
    )];

    if let Some(access_tier) = access_tier {
        extra_headers.push(("x-ms-access-tier".to_string(), access_tier.to_string()));
    }

    extra_headers
}

fn build_block_list_xml(block_ids: &[String]) -> Vec<u8> {
    format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>{}</BlockList>",
        block_ids
            .iter()
            .map(|block_id| format!("<Latest>{block_id}</Latest>"))
            .collect::<String>()
    )
    .into_bytes()
}

async fn ensure_success_response(response: Response) -> Result<(), String> {
    let status = response.status();

    if status.is_success() {
        return Ok(());
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    Err(format!(
        "Azure Blob Storage request failed ({status}): {body}"
    ))
}

async fn delete_blob_names(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_names: &[String],
) -> Result<(), String> {
    for blob_name in blob_names {
        let url = build_blob_url(storage_account_name, container_name, blob_name, &[])?;
        let response = execute_signed_request(
            client,
            Method::DELETE,
            storage_account_name,
            account_key,
            url,
            format!("/{container_name}/{blob_name}"),
            None,
            vec![("x-ms-delete-snapshots".to_string(), "include".to_string())],
        )
        .await?;

        if response.status() == StatusCode::NOT_FOUND {
            continue;
        }

        ensure_success_response(response).await?;
    }

    Ok(())
}

async fn download_blob_response(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
) -> Result<Response, String> {
    let url = build_blob_url(storage_account_name, container_name, blob_name, &[])?;
    let response = execute_signed_request(
        client,
        Method::GET,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}/{blob_name}"),
        None,
        Vec::new(),
    )
    .await?;
    let status = response.status();

    if status.is_success() {
        return Ok(response);
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    Err(format!(
        "Azure Blob Storage request failed ({status}): {body}"
    ))
}

async fn set_blob_access_tier(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
    target_tier: &str,
    rehydration_priority: Option<&str>,
) -> Result<(), String> {
    let query = vec![("comp".to_string(), "tier".to_string())];
    let url = build_blob_url(storage_account_name, container_name, blob_name, &query)?;
    let extra_headers = build_access_tier_headers(target_tier, rehydration_priority);

    let response = execute_signed_request(
        client,
        Method::PUT,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}/{blob_name}"),
        None,
        extra_headers,
    )
    .await?;

    ensure_success_response(response).await
}

async fn list_blob_names_with_prefix(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    prefix: &str,
    marker: Option<String>,
) -> Result<(Vec<String>, Option<String>), String> {
    let query = build_list_blob_names_query(prefix, marker);
    let url = build_container_url(storage_account_name, container_name, &query)?;
    let response_text = execute_signed_get(
        client,
        storage_account_name,
        account_key,
        url,
        format!("/{container_name}"),
    )
    .await?;
    let parsed: ListBlobsEnvelope = from_str(&response_text)
        .map_err(|error| format!("Failed to parse Azure blob listing XML: {error}"))?;
    let blob_names = parsed
        .blobs
        .map(|node| {
            node.entries
                .into_iter()
                .filter_map(|entry| match entry {
                    ListBlobsEntry::Blob(blob) => Some(blob.name),
                    ListBlobsEntry::Prefix(_) => None,
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok((
        blob_names,
        parsed.next_marker.filter(|value| !value.is_empty()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::atomic::Ordering;

    fn azure_test_input() -> AzureConnectionTestInput {
        AzureConnectionTestInput {
            storage_account_name: "storageacct".to_string(),
            account_key: "unused-key".to_string(),
        }
    }

    #[test]
    fn normalizes_storage_account_name() {
        assert_eq!(
            normalize_storage_account_name("  MyAccount  ").unwrap(),
            "myaccount"
        );
        assert!(normalize_storage_account_name("   ").is_err());
    }

    #[test]
    fn normalizes_listing_page_size_with_bounds() {
        assert_eq!(normalize_listing_page_size(None), DEFAULT_MAX_RESULTS);
        assert_eq!(normalize_listing_page_size(Some(0)), 1);
        assert_eq!(
            normalize_listing_page_size(Some(5000)),
            MAX_LISTING_PAGE_SIZE
        );
        assert_eq!(normalize_listing_page_size(Some(123)), 123);
    }

    #[test]
    fn normalizes_delete_object_keys() {
        let normalized = normalize_delete_object_keys(vec![
            " photos/a.jpg ".to_string(),
            "/photos/a.jpg".to_string(),
            "".to_string(),
            "   ".to_string(),
            "photos/b.jpg".to_string(),
        ]);

        assert_eq!(normalized, vec!["photos/a.jpg", "photos/b.jpg"]);
    }

    #[test]
    fn parses_container_listing_response_with_marker_and_empty_results() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<EnumerationResults>
  <Containers>
    <Container>
      <Name>documents</Name>
    </Container>
    <Container>
      <Name>archive</Name>
    </Container>
  </Containers>
  <NextMarker>cursor-1</NextMarker>
</EnumerationResults>"#;

        let (containers, marker) = parse_container_listing_response(xml).unwrap();

        assert_eq!(containers.len(), 2);
        assert_eq!(containers[0].name, "documents");
        assert_eq!(containers[1].name, "archive");
        assert_eq!(marker.as_deref(), Some("cursor-1"));

        let empty_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<EnumerationResults>
  <NextMarker></NextMarker>
</EnumerationResults>"#;

        let (containers, marker) = parse_container_listing_response(empty_xml).unwrap();

        assert!(containers.is_empty());
        assert_eq!(marker, None);
        assert!(parse_container_listing_response("<EnumerationResults>").is_err());
    }

    #[test]
    fn parses_blob_listing_and_deduplicates_explicit_and_implicit_folders() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<EnumerationResults>
  <Blobs>
    <BlobPrefix>
      <Name>docs/</Name>
    </BlobPrefix>
    <Blob>
      <Name>docs/</Name>
      <Metadata>
        <hdi_isfolder>true</hdi_isfolder>
      </Metadata>
      <Properties>
        <Content-Length>0</Content-Length>
      </Properties>
    </Blob>
    <Blob>
      <Name>reports/annual.pdf</Name>
      <Properties>
        <Content-Length>42</Content-Length>
        <AccessTier>Cool</AccessTier>
        <ArchiveStatus>rehydrate-pending-to-cool</ArchiveStatus>
      </Properties>
    </Blob>
  </Blobs>
  <NextMarker>cursor-1</NextMarker>
</EnumerationResults>"#;

        let result = parse_blob_listing_response(xml, None).unwrap();

        assert_eq!(result.directories.len(), 1);
        assert_eq!(result.directories[0].name, "docs");
        assert_eq!(result.directories[0].path, "docs/");
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].name, "reports/annual.pdf");
        assert_eq!(result.files[0].size, 42);
        assert_eq!(result.files[0].storage_class.as_deref(), Some("Cool"));
        assert_eq!(result.files[0].restore_in_progress, Some(true));
        assert_eq!(result.continuation_token.as_deref(), Some("cursor-1"));
        assert!(result.has_more);
    }

    #[test]
    fn ignores_placeholder_blob_for_current_prefix() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?>
<EnumerationResults>
  <Blobs>
    <Blob>
      <Name>docs/</Name>
      <Metadata>
        <hdi_isfolder>true</hdi_isfolder>
      </Metadata>
    </Blob>
  </Blobs>
  <NextMarker></NextMarker>
</EnumerationResults>"#;

        let result = parse_blob_listing_response(xml, Some("docs/")).unwrap();

        assert!(result.directories.is_empty());
        assert!(result.files.is_empty());
        assert_eq!(result.continuation_token, None);
        assert!(!result.has_more);
        assert!(parse_blob_listing_response("<EnumerationResults>", None).is_err());
    }

    #[test]
    fn builds_canonicalized_headers_and_resource_deterministically() {
        let headers = build_canonicalized_headers(&[
            ("X-Ms-Version".to_string(), " 2023-11-03 ".to_string()),
            ("Content-Type".to_string(), "application/json".to_string()),
            (
                "x-ms-date".to_string(),
                "Tue, 14 Apr 2026 00:00:00 GMT".to_string(),
            ),
        ]);

        assert_eq!(
            headers,
            "x-ms-date:Tue, 14 Apr 2026 00:00:00 GMT\nx-ms-version:2023-11-03\n"
        );

        let resource = build_canonicalized_resource(
            "acct",
            "/container/blob.txt",
            Some("comp=list&prefix=docs/&prefix=logs/&restype=container"),
        )
        .unwrap();

        assert_eq!(
            resource,
            "/acct/container/blob.txt\ncomp:list\nprefix:docs/,logs/\nrestype:container"
        );
        assert_eq!(
            build_canonicalized_resource("acct", "/container/blob.txt", Some("comp=%ZZ"))
                .unwrap(),
            "/acct/container/blob.txt\ncomp:%ZZ"
        );
    }

    #[test]
    fn normalizes_cache_paths_and_rejects_empty_blob_names() {
        let reserved = AzureConnectionService::normalize_cache_path_segment("..");
        assert!(reserved.starts_with(AzureConnectionService::CACHE_ESCAPED_SEGMENT_PREFIX));

        let path = AzureConnectionService::build_primary_cache_object_path(
            "/tmp/cache",
            " Primary Connection ",
            "container-a",
            "docs/report.txt",
        )
        .unwrap();

        assert_eq!(
            path,
            PathBuf::from("/tmp/cache")
                .join("Primary Connection")
                .join("container-a")
                .join("docs")
                .join("report.txt")
        );

        assert!(AzureConnectionService::build_primary_cache_object_path(
            "/tmp/cache",
            "Primary Connection",
            "container-a",
            "",
        )
        .is_err());
        assert_eq!(
            AzureConnectionService::build_connection_cache_root("/tmp/cache", "   ").unwrap_err(),
            "Connection name is required for local cache operations."
        );
        assert_eq!(
            AzureConnectionService::build_legacy_raw_cache_object_path(
                "/tmp/cache",
                "connection-123",
                "container-a",
                "",
            )
            .unwrap_err(),
            "Blob name is required for local cache operations."
        );
        assert_eq!(
            AzureConnectionService::build_legacy_encoded_cache_object_path(
                "/tmp/cache",
                "connection-123",
                "container-a",
                "",
            )
            .unwrap_err(),
            "Blob name is required for local cache operations."
        );
        assert_eq!(
            AzureConnectionService::build_recent_legacy_cache_object_path(
                "/tmp/cache",
                "container-a",
                "",
            )
            .unwrap_err(),
            "Blob name is required for local cache operations."
        );
        assert_eq!(
            AzureConnectionService::build_cache_object_path_candidates(
                "/tmp/cache",
                "connection-123",
                "Primary Connection",
                "container-a",
                "",
            )
            .unwrap_err(),
            "Blob name is required for local cache operations."
        );
        assert_eq!(
            AzureConnectionService::build_cache_temp_object_path(
                "/tmp/cache",
                "   ",
                "container-a",
                "docs/report.txt",
            )
            .unwrap_err(),
            "Connection name is required for local cache operations."
        );
    }

    #[test]
    fn builds_cache_path_candidates_and_temp_files_with_expected_structure() {
        let candidates = AzureConnectionService::build_cache_object_path_candidates(
            "/tmp/cache",
            "connection-123",
            "Primary Connection",
            "container-a",
            "docs/report.txt",
        )
        .unwrap();

        assert_eq!(candidates.len(), 4);
        assert_eq!(
            candidates[0],
            PathBuf::from("/tmp/cache")
                .join("Primary Connection")
                .join("container-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[1],
            PathBuf::from("/tmp/cache")
                .join("container-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[2],
            PathBuf::from("/tmp/cache")
                .join("connection-123")
                .join("container-a")
                .join("docs")
                .join("report.txt")
        );
        assert_eq!(
            candidates[3],
            PathBuf::from("/tmp/cache")
                .join("connection-123")
                .join("container-a")
                .join(AzureConnectionService::encode_cache_path_segment("docs"))
                .join(AzureConnectionService::encode_cache_path_segment(
                    "report.txt"
                ))
        );

        let temp_cache_path = AzureConnectionService::build_cache_temp_object_path(
            "/tmp/cache",
            "Primary Connection",
            "container-a",
            "docs/report.txt",
        )
        .unwrap();

        assert!(temp_cache_path.starts_with(
            PathBuf::from("/tmp/cache")
                .join(AzureConnectionService::CACHE_TEMP_DIRECTORY)
                .join("Primary Connection")
        ));
        assert_eq!(
            temp_cache_path.file_stem().and_then(|value| value.to_str()),
            Some("report")
        );
        assert!(temp_cache_path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.starts_with("part-")));

        let temp_file_path = AzureConnectionService::build_temp_file_path(std::path::Path::new(
            "/tmp/downloads/report.txt",
        ))
        .unwrap();
        let temp_file_name = temp_file_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap();
        let temp_directory_path =
            AzureConnectionService::build_temp_file_path(std::path::Path::new("/tmp/downloads"))
                .unwrap();
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
    fn normalizes_prefixes_and_parses_tiers() {
        assert_eq!(
            normalize_prefix(Some(" /docs/reports ".to_string())),
            Some("docs/reports/".to_string())
        );
        assert_eq!(normalize_prefix(Some("   ".to_string())), None);
        assert_eq!(get_leaf_name("docs/reports/annual.pdf"), "annual.pdf");
        assert_eq!(get_leaf_name("docs/"), "docs");

        assert_eq!(
            parse_access_tier(Some("Cool")).unwrap(),
            Some("Cool".to_string())
        );
        assert_eq!(parse_access_tier(None).unwrap(), None);
        assert_eq!(parse_rehydration_target_tier("Hot").unwrap(), "Hot");
        assert_eq!(parse_rehydration_priority("High").unwrap(), "High");
        assert!(parse_access_tier(Some("Premium")).is_err());
        assert!(parse_rehydration_target_tier("Archive").is_err());
        assert!(parse_rehydration_priority("Urgent").is_err());
    }

    #[test]
    fn builds_azure_urls_with_expected_normalization() {
        assert_eq!(
            build_account_url("acct"),
            "https://acct.blob.core.windows.net"
        );

        let service_url = build_service_url(
            "acct",
            &[
                ("comp".to_string(), "list".to_string()),
                ("restype".to_string(), "container".to_string()),
            ],
        )
        .unwrap();
        assert_eq!(
            service_url.as_str(),
            "https://acct.blob.core.windows.net/?comp=list&restype=container"
        );

        let container_url = build_container_url(
            "acct",
            "reports",
            &[("restype".to_string(), "container".to_string())],
        )
        .unwrap();
        assert_eq!(
            container_url.as_str(),
            "https://acct.blob.core.windows.net/reports?restype=container"
        );

        let blob_url = build_blob_url(
            "acct",
            "reports",
            "annual files/report #1.csv",
            &[("timeout".to_string(), "30".to_string())],
        )
        .unwrap();
        assert_eq!(
            blob_url.as_str(),
            "https://acct.blob.core.windows.net/reports/annual%20files/report%20%231.csv?timeout=30"
        );

        let folder_blob_url = build_blob_url("acct", "reports", "nested/folder/", &[]).unwrap();
        assert_eq!(
            folder_blob_url.as_str(),
            "https://acct.blob.core.windows.net/reports/nested/folder/?"
        );
    }

    #[test]
    fn builds_shared_key_authorization_and_rejects_invalid_keys() {
        let authorization = build_shared_key_authorization(
            "acct",
            "dGVzdC1rZXk=",
            "GET",
            &[
                (
                    "x-ms-date".to_string(),
                    "Tue, 14 Apr 2026 00:00:00 GMT".to_string(),
                ),
                ("x-ms-version".to_string(), AZURE_BLOB_API_VERSION.to_string()),
            ],
            None,
            None,
            "/reports/blob.txt",
            Some("comp=metadata"),
        )
        .expect("shared key authorization should be generated");

        assert!(authorization.starts_with("SharedKey acct:"));
        assert!(authorization.len() > "SharedKey acct:".len());
        assert!(build_shared_key_authorization(
            "acct",
            "not-base64",
            "GET",
            &[],
            None,
            None,
            "/reports/blob.txt",
            None,
        )
        .is_err());
    }

    #[test]
    fn validates_mutation_inputs_and_access_tier_headers() {
        assert_eq!(
            normalize_container_name_for_operation(" reports ", "delete requests").unwrap(),
            "reports"
        );
        assert!(normalize_container_name_for_operation("   ", "delete requests").is_err());
        assert_eq!(
            normalize_blob_name_for_operation(" docs/file.txt ", "rehydration requests").unwrap(),
            "docs/file.txt"
        );
        assert!(normalize_blob_name_for_operation("   ", "access tier changes").is_err());
        assert_eq!(
            normalize_recursive_delete_prefix(" /docs/reports/ ").unwrap(),
            "docs/reports/"
        );
        assert!(normalize_recursive_delete_prefix(" / ").is_err());
        assert_eq!(
            build_folder_blob_name(None, " reports ").unwrap(),
            "reports/"
        );
        assert_eq!(
            build_folder_blob_name(Some(" /docs/ "), " reports ").unwrap(),
            "docs/reports/"
        );
        assert!(build_folder_blob_name(Some("docs"), "   ").is_err());
        assert!(build_folder_blob_name(Some("docs"), "bad/name").is_err());
        assert!(build_folder_blob_name(Some("docs"), "bad\\name").is_err());

        assert_eq!(
            build_access_tier_headers("Cool", None),
            vec![("x-ms-access-tier".to_string(), "Cool".to_string())]
        );
        assert_eq!(
            build_access_tier_headers("Hot", Some("High")),
            vec![
                ("x-ms-access-tier".to_string(), "Hot".to_string()),
                ("x-ms-rehydrate-priority".to_string(), "High".to_string())
            ]
        );
    }

    #[test]
    fn builds_upload_and_block_commit_payloads() {
        assert_eq!(
            build_single_upload_headers(
                Some("Archive"),
                Some(vec![(
                    "x-ms-meta-hdi_isfolder".to_string(),
                    "true".to_string()
                )])
            ),
            vec![
                ("x-ms-blob-type".to_string(), "BlockBlob".to_string()),
                ("x-ms-access-tier".to_string(), "Archive".to_string()),
                ("x-ms-meta-hdi_isfolder".to_string(), "true".to_string())
            ]
        );
        assert_eq!(
            build_single_upload_headers(None, None),
            vec![("x-ms-blob-type".to_string(), "BlockBlob".to_string())]
        );
        assert_eq!(
            build_commit_blob_headers(Some("Cool")),
            vec![
                (
                    "x-ms-blob-content-type".to_string(),
                    "application/octet-stream".to_string()
                ),
                ("x-ms-access-tier".to_string(), "Cool".to_string())
            ]
        );
        assert_eq!(
            String::from_utf8(build_block_list_xml(&[
                "block-a".to_string(),
                "block-b".to_string()
            ]))
            .unwrap(),
            "<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList><Latest>block-a</Latest><Latest>block-b</Latest></BlockList>"
        );
        assert!(should_use_single_request_upload(AZURE_UPLOAD_BLOCK_SIZE));
        assert!(!should_use_single_request_upload(AZURE_UPLOAD_BLOCK_SIZE + 1));
        assert_eq!(build_block_id(0), "MDAwMDAwMDA=");
        assert_eq!(build_block_id(42), "MDAwMDAwNDI=");
    }

    #[test]
    fn detects_cancelled_uploads_from_atomic_flags() {
        let active = AtomicBool::new(false);
        let cancelled = AtomicBool::new(true);

        assert!(ensure_upload_not_cancelled(&active).is_ok());
        assert_eq!(
            ensure_upload_not_cancelled(&cancelled).unwrap_err(),
            AZURE_UPLOAD_CANCELLED_ERROR
        );
    }

    #[test]
    fn detects_cancelled_downloads_from_atomic_flags() {
        let active = AtomicBool::new(false);
        let cancelled = AtomicBool::new(true);

        assert!(ensure_download_not_cancelled(&active).is_ok());
        assert_eq!(
            ensure_download_not_cancelled(&cancelled).unwrap_err(),
            AZURE_DOWNLOAD_CANCELLED_ERROR
        );
    }

    #[tokio::test]
    async fn rejects_provider_mutation_inputs_before_network() {
        let input = azure_test_input();

        assert!(
            !AzureConnectionService::blob_exists(
                input.clone(),
                "   ".to_string(),
                "docs/file.txt".to_string()
            )
            .await
            .expect("blank container should return false")
        );
        assert_eq!(
            AzureConnectionService::create_folder(
                input.clone(),
                "   ".to_string(),
                None,
                "reports".to_string(),
            )
            .await
            .unwrap_err(),
            "The Azure container name is required."
        );
        assert_eq!(
            AzureConnectionService::delete_objects(
                input.clone(),
                "   ".to_string(),
                vec!["docs/file.txt".to_string()]
            )
            .await
            .unwrap_err(),
            "The Azure container name is required for delete requests."
        );
        assert_eq!(
            AzureConnectionService::delete_objects(
                input.clone(),
                "container-a".to_string(),
                vec!["   ".to_string()]
            )
            .await
            .unwrap_err(),
            "At least one blob name is required for delete requests."
        );
        assert_eq!(
            AzureConnectionService::delete_prefix(
                input.clone(),
                "container-a".to_string(),
                " / ".to_string()
            )
            .await
            .unwrap_err(),
            "Directory prefix is required for recursive delete requests."
        );
        assert_eq!(
            AzureConnectionService::change_blob_access_tier(
                input.clone(),
                "container-a".to_string(),
                "docs/file.txt".to_string(),
                "Premium".to_string()
            )
            .await
            .unwrap_err(),
            "Unsupported Azure upload access tier."
        );
        assert_eq!(
            AzureConnectionService::change_blob_access_tier(
                input.clone(),
                "container-a".to_string(),
                "docs/file.txt".to_string(),
                "   ".to_string(),
            )
            .await
            .unwrap_err(),
            "A target Azure access tier is required."
        );
        assert_eq!(
            AzureConnectionService::rehydrate_blob(
                input.clone(),
                "container-a".to_string(),
                "docs/archive.zip".to_string(),
                "Archive".to_string(),
                "High".to_string()
            )
            .await
            .unwrap_err(),
            "Unsupported Azure rehydration target tier."
        );
        assert_eq!(
            AzureConnectionService::rehydrate_blob(
                input.clone(),
                "container-a".to_string(),
                "docs/archive.zip".to_string(),
                "Cool".to_string(),
                "Urgent".to_string(),
            )
            .await
            .unwrap_err(),
            "Unsupported Azure rehydration priority."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_path(
                "azure-upload-r5-a".to_string(),
                input.clone(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "   ".to_string(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "Local file path is required for uploads."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_bytes(
                "azure-upload-r5-b".to_string(),
                input.clone(),
                "   ".to_string(),
                "docs/report.txt".to_string(),
                "report.txt".to_string(),
                Vec::new(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The Azure container name is required."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_bytes(
                "azure-upload-r5-c".to_string(),
                input.clone(),
                "container-a".to_string(),
                "   ".to_string(),
                "report.txt".to_string(),
                Vec::new(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "Blob name is required for uploads."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_bytes(
                "azure-upload-r5-d".to_string(),
                input,
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "   ".to_string(),
                Vec::new(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "File name is required for uploads."
        );
    }

    #[tokio::test]
    async fn rejects_provider_download_inputs_before_network() {
        let input = azure_test_input();

        assert_eq!(
            AzureConnectionService::download_blob_to_cache(
                "azure-download-r16-a".to_string(),
                AzureConnectionTestInput {
                    storage_account_name: "   ".to_string(),
                    account_key: "unused-key".to_string(),
                },
                "connection-123".to_string(),
                "Primary Connection".to_string(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "/tmp/cache".to_string(),
                |_, _, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            AzureConnectionService::download_blob_to_cache(
                "azure-download-r16-b".to_string(),
                input.clone(),
                "connection-123".to_string(),
                "Primary Connection".to_string(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "   ".to_string(),
                |_, _, _| Ok(())
            )
            .await
            .unwrap_err(),
            "Local cache directory is required for tracked downloads."
        );
        assert_eq!(
            AzureConnectionService::download_blob_to_path(
                "azure-download-r16-c".to_string(),
                input,
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "   ".to_string(),
                |_, _, _| Ok(())
            )
            .await
            .unwrap_err(),
            "Destination path is required for direct downloads."
        );
    }

    #[tokio::test]
    async fn rejects_provider_upload_path_inputs_before_network() {
        let input = azure_test_input();
        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-azure-upload-guard-test-{}",
            std::process::id()
        ));
        let upload_file = temp_root.join("report.txt");
        fs::create_dir_all(&temp_root).await.unwrap();
        fs::write(&upload_file, b"report").await.unwrap();

        assert_eq!(
            AzureConnectionService::upload_blob_from_path(
                "azure-upload-r17-a".to_string(),
                input.clone(),
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                temp_root.to_string_lossy().to_string(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The selected local path is not a regular file."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_path(
                "azure-upload-r17-b".to_string(),
                AzureConnectionTestInput {
                    storage_account_name: "   ".to_string(),
                    account_key: "unused-key".to_string(),
                },
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                upload_file.to_string_lossy().to_string(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_path(
                "azure-upload-r17-c".to_string(),
                input,
                "   ".to_string(),
                "docs/report.txt".to_string(),
                upload_file.to_string_lossy().to_string(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The Azure container name is required."
        );

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[tokio::test]
    async fn rejects_provider_upload_bytes_inputs_before_network() {
        let input = azure_test_input();

        assert_eq!(
            AzureConnectionService::upload_blob_from_bytes(
                "azure-upload-r18-a".to_string(),
                AzureConnectionTestInput {
                    storage_account_name: "   ".to_string(),
                    account_key: "unused-key".to_string(),
                },
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "report.txt".to_string(),
                b"report".to_vec(),
                None,
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "The Azure storage account name is required."
        );
        assert_eq!(
            AzureConnectionService::upload_blob_from_bytes(
                "azure-upload-r18-b".to_string(),
                input,
                "container-a".to_string(),
                "docs/report.txt".to_string(),
                "report.txt".to_string(),
                b"report".to_vec(),
                Some("Premium".to_string()),
                |_, _| Ok(())
            )
            .await
            .unwrap_err(),
            "Unsupported Azure upload access tier."
        );
    }

    #[test]
    fn builds_listing_queries_and_marker_rules() {
        assert_eq!(
            build_list_blob_names_query("docs/", None),
            vec![
                ("restype".to_string(), "container".to_string()),
                ("comp".to_string(), "list".to_string()),
                ("prefix".to_string(), "docs/".to_string()),
                ("include".to_string(), "metadata".to_string()),
                ("maxresults".to_string(), DEFAULT_MAX_RESULTS.to_string())
            ]
        );
        assert_eq!(
            build_list_blob_names_query("docs/", Some("cursor-1".to_string())),
            vec![
                ("restype".to_string(), "container".to_string()),
                ("comp".to_string(), "list".to_string()),
                ("prefix".to_string(), "docs/".to_string()),
                ("include".to_string(), "metadata".to_string()),
                ("maxresults".to_string(), DEFAULT_MAX_RESULTS.to_string()),
                ("marker".to_string(), "cursor-1".to_string())
            ]
        );
        assert!(has_next_marker(Some("cursor-1")));
        assert!(!has_next_marker(Some("   ")));
        assert!(!has_next_marker(None));
    }

    #[test]
    fn prepares_listing_and_delete_requests() {
        let list_prepared = prepare_list_container_items_request(
            AzureConnectionTestInput {
                storage_account_name: " StorageAcct ".to_string(),
                account_key: "unused-key".to_string(),
            },
            " reports ".to_string(),
            Some(" /docs ".to_string()),
            Some("cursor-1".to_string()),
            Some(0),
        )
        .unwrap();
        assert_eq!(list_prepared.storage_account_name, "storageacct");
        assert_eq!(list_prepared.account_key, "unused-key");
        assert_eq!(list_prepared.normalized_container_name, "reports");
        assert_eq!(
            list_prepared.normalized_prefix.as_deref(),
            Some("docs/")
        );
        assert_eq!(
            list_prepared.query,
            vec![
                ("restype".to_string(), "container".to_string()),
                ("comp".to_string(), "list".to_string()),
                ("delimiter".to_string(), "/".to_string()),
                ("include".to_string(), "metadata".to_string()),
                ("maxresults".to_string(), "1".to_string()),
                ("prefix".to_string(), "docs/".to_string()),
                ("marker".to_string(), "cursor-1".to_string()),
            ]
        );

        let delete_prepared = prepare_delete_objects_request(
            AzureConnectionTestInput {
                storage_account_name: " StorageAcct ".to_string(),
                account_key: "unused-key".to_string(),
            },
            " reports ".to_string(),
            vec![" docs/file.txt ".to_string(), "/docs/file.txt".to_string()],
        )
        .unwrap();
        assert_eq!(delete_prepared.normalized_container_name, "reports");
        assert_eq!(delete_prepared.normalized_object_keys, vec!["docs/file.txt"]);

        let prefix_prepared = prepare_delete_prefix_request(
            AzureConnectionTestInput {
                storage_account_name: " StorageAcct ".to_string(),
                account_key: "unused-key".to_string(),
            },
            " reports ".to_string(),
            " /docs/reports/ ".to_string(),
        )
        .unwrap();
        assert_eq!(prefix_prepared.normalized_container_name, "reports");
        assert_eq!(prefix_prepared.recursive_prefix, "docs/reports/");
        assert!(prepare_list_container_items_request(
            azure_test_input(),
            "   ".to_string(),
            None,
            None,
            None,
        )
        .is_err());
        assert!(prepare_delete_objects_request(
            azure_test_input(),
            "reports".to_string(),
            vec!["   ".to_string()],
        )
        .is_err());
        assert!(prepare_delete_prefix_request(
            azure_test_input(),
            "reports".to_string(),
            " / ".to_string(),
        )
        .is_err());
    }

    #[tokio::test]
    async fn resolves_cached_object_path_and_cleans_up_temp_files() {
        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-azure-cache-test-{}",
            std::process::id()
        ));
        let recent_legacy_path = AzureConnectionService::build_recent_legacy_cache_object_path(
            temp_root.to_str().unwrap(),
            "container-a",
            "docs/report.txt",
        )
        .unwrap();

        fs::create_dir_all(recent_legacy_path.parent().unwrap())
            .await
            .unwrap();
        fs::write(&recent_legacy_path, b"cached").await.unwrap();

        let resolved = AzureConnectionService::resolve_cached_object_path(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/report.txt".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(resolved, recent_legacy_path);

        let temp_file = temp_root.join("downloads").join(".report.txt.part");
        fs::create_dir_all(temp_file.parent().unwrap())
            .await
            .unwrap();
        fs::write(&temp_file, b"partial").await.unwrap();

        AzureConnectionService::remove_temp_file_if_exists(&temp_file)
            .await
            .unwrap();
        assert!(!fs::try_exists(&temp_file).await.unwrap());
        AzureConnectionService::remove_temp_file_if_exists(&temp_file)
            .await
            .unwrap();

        let missing = AzureConnectionService::resolve_cached_object_path(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/missing.txt".to_string(),
        )
        .await;
        assert!(missing.is_err());

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[tokio::test]
    async fn finds_cached_objects_from_available_candidates() {
        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-azure-find-cache-test-{}",
            std::process::id()
        ));
        let existing_primary = AzureConnectionService::build_primary_cache_object_path(
            temp_root.to_str().unwrap(),
            "Primary Connection",
            "container-a",
            "docs/report.txt",
        )
        .unwrap();
        let existing_legacy = AzureConnectionService::build_legacy_raw_cache_object_path(
            temp_root.to_str().unwrap(),
            "connection-123",
            "container-a",
            "docs/archive.zip",
        )
        .unwrap();

        fs::create_dir_all(existing_primary.parent().unwrap())
            .await
            .unwrap();
        fs::create_dir_all(existing_legacy.parent().unwrap())
            .await
            .unwrap();
        fs::write(&existing_primary, b"cached-primary")
            .await
            .unwrap();
        fs::write(&existing_legacy, b"cached-legacy").await.unwrap();

        let cached = AzureConnectionService::find_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
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
        assert!(AzureConnectionService::find_cached_objects(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            "   ".to_string(),
            vec!["docs/report.txt".to_string()],
        )
        .await
        .unwrap()
        .is_empty());

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[tokio::test]
    async fn rejects_open_cached_object_requests_when_cache_is_unavailable() {
        let blank_cache_dir_error = AzureConnectionService::open_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            "   ".to_string(),
            "docs/report.txt".to_string(),
        )
        .await
        .unwrap_err();
        assert!(
            blank_cache_dir_error.contains("not available in the local cache")
                || blank_cache_dir_error.contains("Local cache directory is not configured"),
            "unexpected error: {blank_cache_dir_error}"
        );

        let temp_root = std::env::temp_dir().join(format!(
            "cloudeasyfiles-azure-open-cache-test-{}",
            std::process::id()
        ));
        fs::create_dir_all(&temp_root).await.unwrap();

        let missing_open_error = AzureConnectionService::open_cached_object(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/missing.txt".to_string(),
        )
        .await
        .unwrap_err();
        assert!(
            missing_open_error.contains("not available in the local cache"),
            "unexpected error: {missing_open_error}"
        );

        let missing_parent_error = AzureConnectionService::open_cached_object_parent(
            "connection-123".to_string(),
            "Primary Connection".to_string(),
            "container-a".to_string(),
            temp_root.to_string_lossy().to_string(),
            "docs/missing.txt".to_string(),
        )
        .await
        .unwrap_err();
        assert!(
            missing_parent_error.contains("not available in the local cache"),
            "unexpected error: {missing_parent_error}"
        );

        fs::remove_dir_all(&temp_root).await.unwrap();
    }

    #[test]
    fn registers_and_cancels_transfers() {
        let download_operation_id = format!("download-{}", std::process::id());
        let upload_operation_id = format!("upload-{}", std::process::id());

        {
            let (upload_flag, upload_guard) =
                AzureConnectionService::register_upload_cancellation(&upload_operation_id).unwrap();
            let (download_flag, download_guard) =
                AzureConnectionService::register_download_cancellation(&download_operation_id)
                    .unwrap();

            assert!(AzureConnectionService::cancel_upload(upload_operation_id.clone()).unwrap());
            assert!(
                AzureConnectionService::cancel_download(download_operation_id.clone()).unwrap()
            );
            assert!(upload_flag.load(Ordering::SeqCst));
            assert!(download_flag.load(Ordering::SeqCst));

            drop(upload_guard);
            drop(download_guard);
        }

        assert!(!AzureConnectionService::cancel_upload(upload_operation_id).unwrap());
        assert!(!AzureConnectionService::cancel_download(download_operation_id).unwrap());
    }
}
