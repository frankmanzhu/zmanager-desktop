use serde::{Deserialize, Serialize};

use crate::error::{CommandErrorDto, ErrorSeverityDto};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStatusDto {
    Queued,
    Running,
    Paused,
    Cancelling,
    Completed,
    Failed,
    Cancelled,
}

impl JobStatusDto {
    pub const fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled,)
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
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
    AppleArchiveCreate,
    AppleArchiveExtract,
    ArchiveExtract,
    RawStreamExtract,
    TestArchive,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobEventKindDto {
    Started,
    EntryStarted,
    BytesProcessed,
    PhaseStarted,
    PhaseBytesProcessed,
    EntryFinished,
    Paused,
    Resumed,
    Warning,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobPhaseDto {
    PlanningPayload,
    PlanningMetadata,
    EmittingPayload,
    EmittingMetadata,
    CommittingOutput,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEventDto {
    pub event_type: JobEventKindDto,
    pub job_kind: Option<JobKindDto>,
    pub phase: Option<JobPhaseDto>,
    pub code: Option<&'static str>,
    pub hint: Option<String>,
    pub severity: Option<ErrorSeverityDto>,
    pub retryable: Option<bool>,
    pub path: Option<String>,
    pub bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub total_bytes_processed: Option<u64>,
    pub entries: Option<usize>,
    pub total_entries: Option<usize>,
    pub message: Option<String>,
}

impl JobEventDto {
    pub fn failed_from_command_error(job_kind: JobKindDto, error: CommandErrorDto) -> Self {
        Self {
            event_type: JobEventKindDto::Failed,
            job_kind: Some(job_kind),
            phase: None,
            code: Some(error.code),
            hint: error.hint,
            severity: Some(error.severity),
            retryable: Some(error.retryable),
            path: None,
            bytes: None,
            total_bytes: None,
            total_bytes_processed: None,
            entries: None,
            total_entries: None,
            message: Some(error.message),
        }
    }
}

#[cfg(test)]
impl JobEventDto {
    pub fn new(event_type: JobEventKindDto) -> Self {
        Self {
            event_type,
            job_kind: None,
            phase: None,
            code: None,
            hint: None,
            severity: None,
            retryable: None,
            path: None,
            bytes: None,
            total_bytes: None,
            total_bytes_processed: None,
            entries: None,
            total_entries: None,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
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
pub struct JobControlResponseDto {
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
