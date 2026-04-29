use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureConnectionTestInput {
    pub storage_account_name: String,
    pub account_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureConnectionTestResult {
    pub storage_account_name: String,
    pub account_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureContainerSummary {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureVirtualDirectorySummary {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureBlobSummary {
    pub name: String,
    pub size: i64,
    pub e_tag: Option<String>,
    pub last_modified: Option<String>,
    pub storage_class: Option<String>,
    pub restore_in_progress: Option<bool>,
    pub restore_expiry_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureContainerItemsResult {
    pub directories: Vec<AzureVirtualDirectorySummary>,
    pub files: Vec<AzureBlobSummary>,
    pub continuation_token: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureDeleteResult {
    pub deleted_object_count: i64,
    pub deleted_directory_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureCacheDownloadResult {
    pub local_path: String,
    pub bytes_written: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureBlobPreviewResult {
    pub base64: String,
    pub content_length: i64,
}
