use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatusDto {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatusDto {
    pub const fn is_terminal(&self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Failed | Self::Cancelled,
        )
    }

    pub const fn is_running(&self) -> bool {
        matches!(self, Self::Queued | Self::Running)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobKindDto {
    ZipCreate,
    ZipExtract,
    SevenZCreate,
    SevenZExtract,
    RarExtract,
    TarZstdCreate,
    TarZstdExtract,
    TzapCreate,
    TzapExtract,
    ArchiveExtract,
    TestArchive,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobEventKindDto {
    Started,
    EntryStarted,
    BytesProcessed,
    EntryFinished,
    Warning,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEventDto {
    pub event_type: JobEventKindDto,
    pub job_kind: Option<JobKindDto>,
    pub path: Option<String>,
    pub bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub total_bytes_processed: Option<u64>,
    pub entries: Option<usize>,
    pub message: Option<String>,
}

impl JobEventDto {
    pub fn new(event_type: JobEventKindDto) -> Self {
        Self {
            event_type,
            job_kind: None,
            path: None,
            bytes: None,
            total_bytes: None,
            total_bytes_processed: None,
            entries: None,
            message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobTerminalSummaryDto {
    pub written_entries: usize,
    pub skipped_entries: Option<usize>,
    pub written_bytes: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartJobResponseDto {
    pub job_id: String,
    pub kind: JobKindDto,
    pub status: JobStatusDto,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollJobEventsResponseDto {
    pub job_id: String,
    pub kind: JobKindDto,
    pub status: JobStatusDto,
    pub created_at: String,
    pub can_dismiss: bool,
    pub events: Vec<JobEventDto>,
    pub terminal_summary: Option<JobTerminalSummaryDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelJobResponseDto {
    pub job_id: String,
    pub status: JobStatusDto,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecordSnapshot {
    pub kind: JobKindDto,
    pub created_at: String,
    pub status: JobStatusDto,
    pub events: Vec<JobEventDto>,
    pub terminal_summary: Option<JobTerminalSummaryDto>,
}
