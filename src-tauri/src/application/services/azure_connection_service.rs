use crate::domain::azure_connection::{
    AzureBlobSummary, AzureConnectionTestInput, AzureConnectionTestResult, AzureContainerItemsResult,
    AzureContainerSummary, AzureVirtualDirectorySummary,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::Utc;
use hmac::{Hmac, Mac};
use quick_xml::de::from_str;
use reqwest::{Client, Method, Response, StatusCode, Url};
use serde::Deserialize;
use sha2::Sha256;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use tokio::fs;
use tokio::io::AsyncReadExt;

const AZURE_BLOB_API_VERSION: &str = "2023-11-03";
const DEFAULT_MAX_RESULTS: usize = 200;
const MAX_LISTING_PAGE_SIZE: usize = 1000;
const AZURE_UPLOAD_BLOCK_SIZE: usize = 8 * 1024 * 1024;
pub const AZURE_UPLOAD_CANCELLED_ERROR: &str = "UPLOAD_CANCELLED";

type HmacSha256 = Hmac<Sha256>;

struct UploadCancellationGuard {
    operation_id: String,
}

static UPLOAD_CANCELLATIONS: LazyLock<Mutex<BTreeMap<String, Arc<AtomicBool>>>> =
    LazyLock::new(|| Mutex::new(BTreeMap::new()));

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
    #[serde(rename = "BlobPrefix", default)]
    prefixes: Vec<ListBlobPrefixNode>,
    #[serde(rename = "Blob", default)]
    blobs: Vec<ListBlobNode>,
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

pub struct AzureConnectionService;

impl AzureConnectionService {
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
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();

        if normalized_container_name.is_empty() {
            return Err("The Azure container name is required.".to_string());
        }

        let client = Client::new();
        let page_size = normalize_listing_page_size(page_size);
        let mut query = vec![
            ("restype".to_string(), "container".to_string()),
            ("comp".to_string(), "list".to_string()),
            ("delimiter".to_string(), "/".to_string()),
            ("maxresults".to_string(), page_size.to_string()),
        ];

        if let Some(prefix_value) = normalize_prefix(prefix) {
            query.push(("prefix".to_string(), prefix_value));
        }

        if let Some(marker_value) = continuation_token.filter(|value| !value.trim().is_empty()) {
            query.push(("marker".to_string(), marker_value));
        }

        let url = build_container_url(&storage_account_name, &normalized_container_name, &query)?;
        let response_text = execute_signed_get(
            &client,
            &storage_account_name,
            &input.account_key,
            url,
            format!("/{normalized_container_name}"),
        )
        .await?;
        let parsed: ListBlobsEnvelope = from_str(&response_text)
            .map_err(|error| format!("Failed to parse Azure blob listing XML: {error}"))?;
        let blobs_node = parsed.blobs.unwrap_or(ListBlobsNode {
            prefixes: Vec::new(),
            blobs: Vec::new(),
        });

        let directories = blobs_node
            .prefixes
            .into_iter()
            .map(|prefix| AzureVirtualDirectorySummary {
                name: get_leaf_name(&prefix.name),
                path: prefix.name,
            })
            .collect();
        let files = blobs_node
            .blobs
            .into_iter()
            .map(|blob| {
                let properties = blob.properties.unwrap_or(ListBlobPropertiesNode {
                    content_length: None,
                    last_modified: None,
                    e_tag: None,
                    access_tier: None,
                    archive_status: None,
                });

                AzureBlobSummary {
                    name: blob.name.clone(),
                    size: properties.content_length.unwrap_or(0),
                    e_tag: properties.e_tag,
                    last_modified: properties.last_modified,
                    storage_class: properties.access_tier,
                    restore_in_progress: properties.archive_status.as_ref().map(|status| {
                        status
                            .to_ascii_lowercase()
                            .contains("rehydrate-pending")
                    }),
                    restore_expiry_date: None,
                }
            })
            .collect();

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
            return Err(format!("Azure Blob Storage request failed ({status}): {body}"));
        }

        Ok(true)
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

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
        }

        let mut file = fs::File::open(&file_path)
            .await
            .map_err(|error| error.to_string())?;

        if metadata.len() <= AZURE_UPLOAD_BLOCK_SIZE as u64 {
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
            if cancellation_flag.load(Ordering::SeqCst) {
                return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
            }

            let bytes_read = file
                .read(&mut chunk_buffer)
                .await
                .map_err(|error| error.to_string())?;

            if bytes_read == 0 {
                break;
            }

            let block_id = BASE64_STANDARD.encode(format!("{next_block_index:08}"));
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

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
        }

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

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
        }

        if file_bytes.len() <= AZURE_UPLOAD_BLOCK_SIZE {
            upload_blob_single_request(
                &client,
                &storage_account_name,
                &input.account_key,
                &normalized_container_name,
                &normalized_blob_name,
                file_bytes,
                normalized_access_tier.as_deref(),
            )
            .await?;
            on_progress(total_bytes, total_bytes)?;
            return Ok(normalized_file_name);
        }

        let mut transferred_bytes = 0_i64;
        let mut block_ids = Vec::new();

        for (index, chunk) in file_bytes.chunks(AZURE_UPLOAD_BLOCK_SIZE).enumerate() {
            if cancellation_flag.load(Ordering::SeqCst) {
                return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
            }

            let block_id = BASE64_STANDARD.encode(format!("{index:08}"));
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
            transferred_bytes += i64::try_from(chunk.len()).map_err(|_| "Chunk too large.".to_string())?;
            on_progress(transferred_bytes, total_bytes)?;
        }

        if cancellation_flag.load(Ordering::SeqCst) {
            return Err(AZURE_UPLOAD_CANCELLED_ERROR.to_string());
        }

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
        let parsed: ListContainersEnvelope = from_str(&response_text)
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

        Ok((containers, parsed.next_marker.filter(|value| !value.is_empty())))
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
        .map(|value| if value.ends_with('/') { value } else { format!("{value}/") })
}

fn build_account_url(storage_account_name: &str) -> String {
    format!("https://{storage_account_name}.blob.core.windows.net")
}

fn build_service_url(storage_account_name: &str, query: &[(String, String)]) -> Result<Url, String> {
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
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "Unable to build Azure blob URL.".to_string())?;
        segments.push(container_name);

        for segment in blob_name.split('/') {
            if !segment.is_empty() {
                segments.push(segment);
            }
        }
    }

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
        return Err(format!("Azure Blob Storage request failed ({status}): {body}"));
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
        ("x-ms-version".to_string(), AZURE_BLOB_API_VERSION.to_string()),
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
    let mut mac =
        HmacSha256::new_from_slice(&key).map_err(|error| format!("Invalid Azure account key: {error}"))?;
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
        let query_url =
            Url::parse(&format!("https://dummy.invalid/?{query_value}")).map_err(|error| error.to_string())?;
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
    let Some(value) = value.map(|value| value.trim()).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    match value {
        "Hot" | "Cool" | "Cold" | "Archive" => Ok(Some(value.to_string())),
        _ => Err("Unsupported Azure upload access tier.".to_string()),
    }
}

fn normalize_listing_page_size(value: Option<i32>) -> usize {
    match value.unwrap_or(DEFAULT_MAX_RESULTS as i32) {
        value if value < 1 => 1,
        value if value > MAX_LISTING_PAGE_SIZE as i32 => MAX_LISTING_PAGE_SIZE,
        value => value as usize,
    }
}

async fn upload_blob_single_request(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    container_name: &str,
    blob_name: &str,
    file_bytes: Vec<u8>,
    access_tier: Option<&str>,
) -> Result<(), String> {
    let mut extra_headers = vec![("x-ms-blob-type".to_string(), "BlockBlob".to_string())];

    if let Some(access_tier) = access_tier {
        extra_headers.push(("x-ms-access-tier".to_string(), access_tier.to_string()));
    }

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
    let mut extra_headers = vec![("x-ms-blob-content-type".to_string(), "application/octet-stream".to_string())];

    if let Some(access_tier) = access_tier {
        extra_headers.push(("x-ms-access-tier".to_string(), access_tier.to_string()));
    }

    let block_list_xml = format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><BlockList>{}</BlockList>",
        block_ids
            .iter()
            .map(|block_id| format!("<Latest>{block_id}</Latest>"))
            .collect::<String>()
    )
    .into_bytes();
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

async fn ensure_success_response(response: Response) -> Result<(), String> {
    let status = response.status();

    if status.is_success() {
        return Ok(());
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    Err(format!("Azure Blob Storage request failed ({status}): {body}"))
}
