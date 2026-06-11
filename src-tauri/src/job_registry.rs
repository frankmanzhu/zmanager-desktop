use std::{
    collections::{HashMap, VecDeque},
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use crate::job_dto::{
    CancelJobResponseDto, JobEventDto, JobEventKindDto, JobKindDto, JobRecordSnapshot,
    JobStatusDto, JobTerminalSummaryDto, PollJobEventsResponseDto, StartJobResponseDto,
};
use zmanager_core::{jobs::JobEventSink, jobs::JobEvent, jobs::JobKind, jobs::CancellationToken};

const MAX_EVENTS_TO_KEEP: usize = 256;

#[derive(Debug)]
struct JobRecord {
    id: String,
    kind: JobKindDto,
    created_at: String,
    status: JobStatusDto,
    events: VecDeque<JobEventDto>,
    terminal_summary: Option<JobTerminalSummaryDto>,
    cancellation_token: Option<CancellationToken>,
}

#[derive(Default)]
struct RegistryState {
    next_job_id: u64,
    jobs: HashMap<String, JobRecord>,
    preview_roots: VecDeque<PathBuf>,
}

#[derive(Clone)]
pub struct JobRegistry {
    state: Arc<Mutex<RegistryState>>,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RegistryState::default())),
        }
    }

    fn with_lock<R>(&self, operation: impl FnOnce(&mut RegistryState) -> R) -> R {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());

        operation(&mut state)
    }

    pub fn create_job(&self, kind: JobKindDto) -> (StartJobResponseDto, CancellationToken) {
        self.with_lock(|state| {
            let job_id = state.next_job_id.saturating_add(1).to_string();
            state.next_job_id = state.next_job_id.saturating_add(1);

            let token = CancellationToken::new();
            let created_at = now_timestamp();
            state.jobs.insert(
                job_id.clone(),
                JobRecord {
                    id: job_id.clone(),
                    kind,
                    created_at: created_at.clone(),
                    status: JobStatusDto::Queued,
                    events: VecDeque::new(),
                    terminal_summary: None,
                    cancellation_token: Some(token.clone()),
                },
            );

            (
                StartJobResponseDto {
                    job_id: job_id.clone(),
                    kind,
                    status: JobStatusDto::Queued,
                    created_at,
                },
                token,
            )
        })
    }

    pub fn remove_job_if_terminal(&self, job_id: &str) -> Option<JobKindDto> {
        self.with_lock(|state| {
            let record = state.jobs.get(job_id)?;
            if !record.status.is_terminal() {
                return None;
            }

            state.jobs.remove(job_id).map(|record| record.kind)
        })
    }

    pub fn snapshot(&self, job_id: &str) -> Option<JobRecordSnapshot> {
        self.with_lock(|state| {
            state
                .jobs
                .get(job_id)
                .map(|record| JobRecordSnapshot {
                    kind: record.kind,
                    created_at: record.created_at.clone(),
                    status: record.status,
                    events: record.events.iter().cloned().collect(),
                    terminal_summary: record.terminal_summary.clone(),
                })
        })
    }

    pub fn request_cancel(&self, job_id: &str) -> Option<CancelJobResponseDto> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;

            if let Some(token) = record.cancellation_token.as_ref() {
                token.cancel();
                Some(CancelJobResponseDto {
                    job_id: job_id.to_string(),
                    status: record.status,
                })
            } else {
                None
            }
        })
    }

    pub fn poll_events(&self, job_id: &str) -> Option<PollJobEventsResponseDto> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;
            let events = record.events.drain(..).collect::<Vec<_>>();

            Some(PollJobEventsResponseDto {
                job_id: record.id.clone(),
                kind: record.kind,
                status: record.status,
                created_at: record.created_at.clone(),
                can_dismiss: record.status.is_terminal(),
                events,
                terminal_summary: record.terminal_summary.clone(),
            })
        })
    }

    pub fn emit_job_event(&self, job_id: &str, event: JobEvent) {
        let mapped_kind = match event {
            JobEvent::Started { kind, .. } => Some(kind),
            _ => None,
        };

        let event_dto = match event {
            JobEvent::Started { kind: _, total_bytes } => JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: Some(mapped_kind.map(JobKindDto::from)),
                path: None,
                bytes: None,
                total_bytes,
                total_bytes_processed: None,
                entries: None,
                message: None,
            },
            JobEvent::EntryStarted { path, bytes } => JobEventDto {
                event_type: JobEventKindDto::EntryStarted,
                job_kind: None,
                path: Some(path),
                bytes,
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                message: None,
            },
            JobEvent::BytesProcessed {
                path,
                bytes,
                total_bytes_processed,
            } => JobEventDto {
                event_type: JobEventKindDto::BytesProcessed,
                job_kind: None,
                path,
                bytes: Some(bytes),
                total_bytes: None,
                total_bytes_processed: Some(total_bytes_processed),
                entries: None,
                message: None,
            },
            JobEvent::EntryFinished { path, bytes } => JobEventDto {
                event_type: JobEventKindDto::EntryFinished,
                job_kind: None,
                path: Some(path),
                bytes: Some(bytes),
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                message: None,
            },
            JobEvent::Warning { message } => JobEventDto {
                event_type: JobEventKindDto::Warning,
                job_kind: None,
                path: None,
                bytes: None,
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                message: Some(message),
            },
            JobEvent::Completed { entries, bytes } => JobEventDto {
                event_type: JobEventKindDto::Completed,
                job_kind: None,
                path: None,
                bytes: Some(bytes),
                total_bytes: None,
                total_bytes_processed: None,
                entries: Some(entries),
                message: None,
            },
            JobEvent::Failed { message } => JobEventDto {
                event_type: JobEventKindDto::Failed,
                job_kind: None,
                path: None,
                bytes: None,
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                message: Some(message),
            },
            JobEvent::Cancelled { message } => JobEventDto {
                event_type: JobEventKindDto::Cancelled,
                job_kind: None,
                path: None,
                bytes: None,
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                message: Some(message),
            },
        };

        self.with_lock(|state| {
            let Some(record) = state.jobs.get_mut(job_id) else {
                return;
            };

            if let Some(kind) = mapped_kind {
                let dto_kind = JobKindDto::from(kind);
                record.kind = dto_kind;
            }

            match event {
                JobEvent::Started { .. } => record.status = JobStatusDto::Running,
                JobEvent::Completed { .. } => {
                    if !record.status.is_terminal() {
                        record.status = JobStatusDto::Completed;
                    }
                }
                JobEvent::Failed { .. } => record.status = JobStatusDto::Failed,
                JobEvent::Cancelled { .. } => record.status = JobStatusDto::Cancelled,
                _ => {}
            }

            while record.events.len() >= MAX_EVENTS_TO_KEEP {
                let _ = record.events.pop_front();
            }
            record.events.push_back(event_dto);
        });
    }

    pub fn emit_direct_event(&self, job_id: &str, event: JobEventDto) {
        self.with_lock(|state| {
            let Some(record) = state.jobs.get_mut(job_id) else {
                return;
            };

            match event.event_type {
                JobEventKindDto::Started => record.status = JobStatusDto::Running,
                JobEventKindDto::Completed => {
                    if !record.status.is_terminal() {
                        record.status = JobStatusDto::Completed;
                    }
                }
                JobEventKindDto::Failed => record.status = JobStatusDto::Failed,
                JobEventKindDto::Cancelled => record.status = JobStatusDto::Cancelled,
                _ => {}
            }

            while record.events.len() >= MAX_EVENTS_TO_KEEP {
                let _ = record.events.pop_front();
            }
            record.events.push_back(event);
        });
    }

    pub fn set_terminal_summary(&self, job_id: &str, summary: JobTerminalSummaryDto) {
        self.with_lock(|state| {
            if let Some(record) = state.jobs.get_mut(job_id) {
                record.terminal_summary = Some(summary);
            }
        });
    }

    pub fn replace_preview_root(&self, path: PathBuf) {
        self.with_lock(|state| {
            while let Some(root) = state.preview_roots.pop_front() {
                let _ = fs::remove_dir_all(root);
            }
            state.preview_roots.push_back(path);
        });
    }

    pub fn cleanup_preview_roots(&self) {
        self.with_lock(|state| {
            while let Some(root) = state.preview_roots.pop_front() {
                let _ = fs::remove_dir_all(root);
            }
        });
    }
}

impl Drop for JobRegistry {
    fn drop(&mut self) {
        self.cleanup_preview_roots();
    }
}

pub struct JobEventCollector {
    registry: JobRegistry,
    job_id: String,
}

impl JobEventCollector {
    pub fn new(registry: &JobRegistry, job_id: String) -> Self {
        Self {
            registry: registry.clone(),
            job_id,
        }
    }
}

impl JobEventSink for JobEventCollector {
    fn emit(&mut self, event: JobEvent) {
        self.registry.emit_job_event(&self.job_id, event);
    }
}

impl From<JobKind> for JobKindDto {
    fn from(kind: JobKind) -> Self {
        match kind {
            JobKind::ZipCreate => JobKindDto::ZipCreate,
            JobKind::ZipExtract => JobKindDto::ZipExtract,
            JobKind::SevenZCreate => JobKindDto::SevenZCreate,
            JobKind::SevenZExtract => JobKindDto::SevenZExtract,
            JobKind::RarExtract => JobKindDto::RarExtract,
            JobKind::TarZstdCreate => JobKindDto::TarZstdCreate,
            JobKind::TarZstdExtract => JobKindDto::TarZstdExtract,
            JobKind::TzapCreate => JobKindDto::TzapCreate,
            JobKind::TzapExtract => JobKindDto::TzapExtract,
            JobKind::ArchiveExtract => JobKindDto::ArchiveExtract,
        }
    }
}

fn now_timestamp() -> String {
    let since_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    since_epoch.as_secs().to_string()
}
