use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsConnectionTestInput {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub restricted_bucket_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsConnectionTestResult {
    pub account_id: String,
    pub arn: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsBucketSummary {
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsVirtualDirectorySummary {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsObjectSummary {
    pub key: String,
    pub size: i64,
    pub e_tag: Option<String>,
    pub last_modified: Option<String>,
    pub storage_class: Option<String>,
    pub restore_in_progress: Option<bool>,
    pub restore_expiry_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsBucketItemsResult {
    pub bucket_region: String,
    pub directories: Vec<AwsVirtualDirectorySummary>,
    pub files: Vec<AwsObjectSummary>,
    pub continuation_token: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsDeleteResult {
    pub deleted_object_count: i64,
    pub deleted_directory_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsCacheDownloadResult {
    pub local_path: String,
    pub bytes_written: i64,
}
