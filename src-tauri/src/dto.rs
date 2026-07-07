use serde::{Deserialize, Serialize};

use crate::job_dto::StartJobResponseDto;

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
pub struct ProjectIntegrationShellActionDto {
    pub label: &'static str,
    pub quick_action: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIntegrationContract {
    pub platform: &'static str,
    pub explorer_integration_enabled: bool,
    pub desktop_actions_enabled: bool,
    pub associated_extensions: Vec<String>,
    pub shell_actions: Vec<ProjectIntegrationShellActionDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContract {
    pub commands: &'static [&'static str],
    pub platform_strategy: &'static str,
    pub core_dependency: &'static str,
    pub platform_integration: ProjectIntegrationContract,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFileIconRequest {
    pub entries: Vec<SystemFileIconRequestEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFileIconRequestEntry {
    pub key: String,
    pub path: String,
    #[serde(default)]
    pub is_directory: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFileIconResponse {
    pub icons: Vec<SystemFileIconDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFileIconDto {
    pub key: String,
    pub data_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateDirectoryRequest {
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateDirectoryResponse {
    pub exists: bool,
    pub is_directory: bool,
    pub accessible: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum QuickActionKindDto {
    Open,
    Compress,
    Extract,
    CompressZip,
    CompressTzap,
    CompressSevenZ,
    CompressTarZst,
    CompressCleanSource,
    ExtractHere,
    ExtractToFolder,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuickActionRequestDto {
    pub kind: QuickActionKindDto,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuickActionStartupErrorDto {
    pub code: String,
    pub message: String,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuickActionStartupStateDto {
    pub launched_for_quick_action: bool,
    pub quick_action: Option<QuickActionRequestDto>,
    pub quick_action_jobs: Vec<StartJobResponseDto>,
    pub error: Option<QuickActionStartupErrorDto>,
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
    pub plan_entries: Vec<CreatePlanEntryDto>,
    pub excluded_entries: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanEntryDto {
    pub path: String,
    pub kind: ArchiveEntryKindDto,
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub source_path: String,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArchiveFormatDto {
    Zip,
    TarZst,
    Tzap,
    SevenZ,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DestinationCollisionStrategyDto {
    Refuse,
    Rename,
}

impl Default for DestinationCollisionStrategyDto {
    fn default() -> Self {
        Self::Refuse
    }
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
    #[serde(default)]
    pub destination_collision_strategy: DestinationCollisionStrategyDto,
    pub password: Option<String>,
    pub compression_level: Option<u32>,
    pub volume_size: Option<u64>,
    pub tzap_recovery_percentage: Option<u8>,
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
    pub destination_collision_strategy: DestinationCollisionStrategyDto,
    #[serde(default)]
    pub entry_paths: Option<Vec<String>>,
    #[serde(default)]
    pub strip_components: usize,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFileDragRequest {
    pub archive_path: String,
    #[serde(default)]
    pub entry_paths: Vec<String>,
    pub password: Option<String>,
    #[serde(default)]
    pub strip_components: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFileDragResponse {
    pub outcome: NativeFileDragOutcomeDto,
    pub dragged_entries: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeFileDragOutcomeDto {
    Dropped,
    Cancelled,
    NoDrop,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestArchiveRequest {
    pub archive_path: String,
    pub entry_paths: Option<Vec<String>>,
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
pub struct PauseJobRequest {
    pub job_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeJobRequest {
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
