use crate::domain::azure_connection::{
    AzureBlobSummary, AzureConnectionTestInput, AzureConnectionTestResult, AzureContainerItemsResult,
    AzureContainerSummary, AzureVirtualDirectorySummary,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use chrono::Utc;
use hmac::{Hmac, Mac};
use quick_xml::de::from_str;
use reqwest::{Client, Url};
use serde::Deserialize;
use sha2::Sha256;
use std::collections::BTreeMap;

const AZURE_BLOB_API_VERSION: &str = "2023-11-03";
const DEFAULT_MAX_RESULTS: usize = 5000;

type HmacSha256 = Hmac<Sha256>;

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
    ) -> Result<AzureContainerItemsResult, String> {
        let storage_account_name = normalize_storage_account_name(&input.storage_account_name)?;
        let normalized_container_name = container_name.trim().to_string();

        if normalized_container_name.is_empty() {
            return Err("The Azure container name is required.".to_string());
        }

        let client = Client::new();
        let mut query = vec![
            ("restype".to_string(), "container".to_string()),
            ("comp".to_string(), "list".to_string()),
            ("delimiter".to_string(), "/".to_string()),
            ("maxresults".to_string(), DEFAULT_MAX_RESULTS.to_string()),
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

async fn execute_signed_get(
    client: &Client,
    storage_account_name: &str,
    account_key: &str,
    url: Url,
    canonicalized_resource_path: String,
) -> Result<String, String> {
    let request_date = Utc::now().format("%a, %d %b %Y %H:%M:%S GMT").to_string();
    let authorization = build_shared_key_authorization(
        storage_account_name,
        account_key,
        "GET",
        &request_date,
        &canonicalized_resource_path,
        url.query(),
    )?;

    let response = client
        .get(url)
        .header("x-ms-date", request_date)
        .header("x-ms-version", AZURE_BLOB_API_VERSION)
        .header("Authorization", authorization)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let body = response.text().await.map_err(|error| error.to_string())?;

    if !status.is_success() {
        return Err(format!("Azure Blob Storage request failed ({status}): {body}"));
    }

    Ok(body)
}

fn build_shared_key_authorization(
    storage_account_name: &str,
    account_key: &str,
    method: &str,
    request_date: &str,
    canonicalized_resource_path: &str,
    query: Option<&str>,
) -> Result<String, String> {
    let canonicalized_headers =
        format!("x-ms-date:{request_date}\nx-ms-version:{AZURE_BLOB_API_VERSION}\n");
    let canonicalized_resource =
        build_canonicalized_resource(storage_account_name, canonicalized_resource_path, query)?;
    let string_to_sign = format!(
        "{method}\n\n\n\n\n\n\n\n\n\n\n\n{canonicalized_headers}{canonicalized_resource}"
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
