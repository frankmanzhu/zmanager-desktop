use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthcheckResponse {
    pub engine: &'static str,
    pub version: &'static str,
    pub ready: bool,
    pub summary: String,
    pub shell: &'static str,
    pub status: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContract {
    pub commands: &'static [&'static str],
    pub platform_strategy: &'static str,
    pub core_dependency: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveListingResponse {
    pub archive_path: String,
    pub entries: Vec<ArchiveEntryDto>,
    pub entry_count: usize,
    pub total_size: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntryDto {
    pub path: String,
    pub kind: ArchiveEntryKindDto,
    pub size: Option<u64>,
    pub compressed_size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveEntryKindDto {
    File,
    Directory,
    Symlink,
    Hardlink,
    Special,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListArchiveRequest {
    pub archive_path: String,
    pub password: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanResponse {
    pub included_count: usize,
    pub excluded_count: usize,
    pub total_bytes: u64,
    pub excluded_bytes: u64,
    pub entries: Vec<String>,
    pub excluded_entries: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanCreateRequest {
    pub sources: Vec<String>,
    #[serde(default)]
    pub clean_source: bool,
    #[serde(default)]
    pub respect_gitignore: bool,
    pub exclude_names: Option<Vec<String>>,
    pub exclude_archive_paths: Option<Vec<String>>,
    pub include_archive_paths: Option<Vec<String>>,
    #[serde(default)]
    pub follow_symlinks: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveFormatDto {
    Zip,
    TarZst,
    Tzap,
    SevenZ,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCreateRequest {
    pub sources: Vec<String>,
    pub destination_path: String,
    pub format: ArchiveFormatDto,
    #[serde(default)]
    pub clean_source: bool,
    #[serde(default)]
    pub replace_existing: bool,
    pub password: Option<String>,
    pub compression_level: Option<u32>,
    pub volume_size: Option<u64>,
    #[serde(default)]
    pub preserve_metadata: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartExtractRequest {
    pub archive_path: String,
    pub destination_path: String,
    pub password: Option<String>,
    pub overwrite: OverwritePolicyDto,
    #[serde(default)]
    pub strip_components: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractEntryRequest {
    pub archive_path: String,
    pub entry_path: String,
    pub destination_path: String,
    pub password: Option<String>,
    pub overwrite: OverwritePolicyDto,
    #[serde(default)]
    pub strip_components: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryExtractResponse {
    pub destination_path: String,
    pub written_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewEntryRequest {
    pub archive_path: String,
    pub entry_path: String,
    pub password: Option<String>,
    pub overwrite: OverwritePolicyDto,
    #[serde(default)]
    pub strip_components: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewEntryResponse {
    pub cleanup_root: String,
    pub preview_path: String,
    pub written_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestArchiveResponse {
    pub tested_entries: usize,
    pub skipped_entries: usize,
    pub tested_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestArchiveRequest {
    pub archive_path: String,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollJobEventsRequest {
    pub job_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelJobRequest {
    pub job_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DismissJobRequest {
    pub job_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OverwritePolicyDto {
    Refuse,
    Replace,
    Rename,
    Ask,
}

impl Default for OverwritePolicyDto {
    fn default() -> Self {
        Self::Refuse
    }
}
