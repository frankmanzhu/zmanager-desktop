use std::{
    collections::{HashMap, VecDeque},
    fs,
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
};

use crate::job_dto::{
    CancelJobResponseDto, JobControlResponseDto, JobEventDto, JobEventKindDto, JobKindDto,
    JobRecordSnapshot, JobStatusDto, JobTerminalSummaryDto, PollJobEventsResponseDto,
    StartJobResponseDto,
};
use zmanager_core::{jobs::CancellationToken, jobs::JobEvent, jobs::JobEventSink, jobs::JobKind};

const MAX_EVENTS_TO_KEEP: usize = 256;

#[derive(Debug)]
struct JobRecord {
    id: String,
    kind: JobKindDto,
    created_at: String,
    status: JobStatusDto,
    paused_from_status: Option<JobStatusDto>,
    events: VecDeque<JobEventDto>,
    terminal_summary: Option<JobTerminalSummaryDto>,
    cancellation_token: Option<CancellationToken>,
    pause_control: PauseControl,
    processed_entries: usize,
    total_entries: Option<usize>,
}

#[derive(Debug)]
struct PauseState {
    paused: Mutex<bool>,
    changed: Condvar,
}

#[derive(Debug, Clone)]
struct PauseControl {
    state: Arc<PauseState>,
}

impl PauseControl {
    fn new() -> Self {
        Self {
            state: Arc::new(PauseState {
                paused: Mutex::new(false),
                changed: Condvar::new(),
            }),
        }
    }

    fn pause(&self) {
        let mut paused = self
            .state
            .paused
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *paused = true;
    }

    fn resume(&self) {
        let mut paused = self
            .state
            .paused
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        *paused = false;
        self.state.changed.notify_all();
    }

    fn wait_if_paused(&self) {
        let mut paused = self
            .state
            .paused
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while *paused {
            paused = self
                .state
                .changed
                .wait(paused)
                .unwrap_or_else(|error| error.into_inner());
        }
    }
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
                    paused_from_status: None,
                    events: VecDeque::new(),
                    terminal_summary: None,
                    cancellation_token: Some(token.clone()),
                    pause_control: PauseControl::new(),
                    processed_entries: 0,
                    total_entries: None,
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
            state.jobs.get(job_id).map(|record| JobRecordSnapshot {
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
                record.pause_control.resume();
                if !record.status.is_terminal() {
                    record.status = JobStatusDto::Cancelled;
                    let kind = record.kind;
                    let processed_entries = record.processed_entries;
                    let total_entries = record.total_entries;
                    push_recorded_event(
                        record,
                        JobEventDto {
                            event_type: JobEventKindDto::Cancelled,
                            job_kind: Some(kind),
                            code: None,
                            hint: None,
                            severity: None,
                            retryable: Some(false),
                            path: None,
                            bytes: None,
                            total_bytes: None,
                            total_bytes_processed: None,
                            entries: Some(processed_entries),
                            total_entries,
                            message: Some("Cancelled.".to_string()),
                        },
                    );
                }
                Some(CancelJobResponseDto {
                    job_id: job_id.to_string(),
                    status: record.status,
                })
            } else {
                None
            }
        })
    }

    pub fn request_pause(&self, job_id: &str) -> Option<JobControlResponseDto> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;
            if record.status.is_terminal() {
                return Some(JobControlResponseDto {
                    job_id: job_id.to_string(),
                    status: record.status,
                });
            }

            if record.status != JobStatusDto::Paused {
                record.paused_from_status = Some(record.status);
                record.status = JobStatusDto::Paused;
                record.pause_control.pause();
                let kind = record.kind;
                let processed_entries = record.processed_entries;
                let total_entries = record.total_entries;
                push_recorded_event(
                    record,
                    JobEventDto {
                        event_type: JobEventKindDto::Paused,
                        job_kind: Some(kind),
                        code: None,
                        hint: None,
                        severity: None,
                        retryable: Some(true),
                        path: None,
                        bytes: None,
                        total_bytes: None,
                        total_bytes_processed: None,
                        entries: Some(processed_entries),
                        total_entries,
                        message: Some("Paused.".to_string()),
                    },
                );
            }

            Some(JobControlResponseDto {
                job_id: job_id.to_string(),
                status: record.status,
            })
        })
    }

    pub fn request_resume(&self, job_id: &str) -> Option<JobControlResponseDto> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;
            if record.status == JobStatusDto::Paused {
                record.pause_control.resume();
                record.status = record
                    .paused_from_status
                    .take()
                    .unwrap_or(JobStatusDto::Running);
                let kind = record.kind;
                let processed_entries = record.processed_entries;
                let total_entries = record.total_entries;
                push_recorded_event(
                    record,
                    JobEventDto {
                        event_type: JobEventKindDto::Resumed,
                        job_kind: Some(kind),
                        code: None,
                        hint: None,
                        severity: None,
                        retryable: Some(true),
                        path: None,
                        bytes: None,
                        total_bytes: None,
                        total_bytes_processed: None,
                        entries: Some(processed_entries),
                        total_entries,
                        message: Some("Resumed.".to_string()),
                    },
                );
            }

            Some(JobControlResponseDto {
                job_id: job_id.to_string(),
                status: record.status,
            })
        })
    }

    pub fn wait_if_paused(&self, job_id: &str) {
        let pause_control = self.with_lock(|state| {
            state
                .jobs
                .get(job_id)
                .map(|record| record.pause_control.clone())
        });

        if let Some(pause_control) = pause_control {
            pause_control.wait_if_paused();
        }
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
        let mapped_kind = match &event {
            JobEvent::Started { kind, .. } => Some(*kind),
            _ => None,
        };

        let mut event_dto = match &event {
            JobEvent::Started {
                kind: _,
                total_bytes,
            } => JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: mapped_kind.map(JobKindDto::from),
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: None,
                bytes: None,
                total_bytes: *total_bytes,
                total_bytes_processed: None,
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::EntryStarted { path, bytes } => JobEventDto {
                event_type: JobEventKindDto::EntryStarted,
                job_kind: None,
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: Some(path.clone()),
                bytes: *bytes,
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::BytesProcessed {
                path,
                bytes,
                total_bytes_processed,
            } => JobEventDto {
                event_type: JobEventKindDto::BytesProcessed,
                job_kind: None,
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: path.clone(),
                bytes: Some(*bytes),
                total_bytes: None,
                total_bytes_processed: Some(*total_bytes_processed),
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::EntryFinished { path, bytes } => JobEventDto {
                event_type: JobEventKindDto::EntryFinished,
                job_kind: None,
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: Some(path.clone()),
                bytes: Some(*bytes),
                total_bytes: None,
                total_bytes_processed: None,
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::Warning { message } => JobEventDto {
                event_type: JobEventKindDto::Warning,
                job_kind: None,
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
                message: Some(message.clone()),
            },
            JobEvent::Completed { entries, bytes } => JobEventDto {
                event_type: JobEventKindDto::Completed,
                job_kind: None,
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: None,
                bytes: Some(*bytes),
                total_bytes: None,
                total_bytes_processed: None,
                entries: Some(*entries),
                total_entries: Some(*entries),
                message: None,
            },
            JobEvent::Failed { message } => JobEventDto {
                event_type: JobEventKindDto::Failed,
                job_kind: None,
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
                message: Some(message.clone()),
            },
            JobEvent::Cancelled { message } => JobEventDto {
                event_type: JobEventKindDto::Cancelled,
                job_kind: None,
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
                message: Some(message.clone()),
            },
        };

        self.with_lock(|state| {
            let Some(record) = state.jobs.get_mut(job_id) else {
                return;
            };

            if matches!(event, JobEvent::EntryFinished { .. }) {
                record.processed_entries = record.processed_entries.saturating_add(1);
            }
            if matches!(event, JobEvent::Completed { .. }) {
                if let Some(entries) = event_dto.entries {
                    record.processed_entries = record.processed_entries.max(entries);
                }
            }
            if event_dto.entries.is_none() && record.processed_entries > 0 {
                event_dto.entries = Some(record.processed_entries);
            }
            if event_dto.total_entries.is_none() {
                event_dto.total_entries = record.total_entries;
            }

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

            push_recorded_event(record, event_dto);
        });
    }

    pub fn emit_direct_event(&self, job_id: &str, event: JobEventDto) {
        self.with_lock(|state| {
            let Some(record) = state.jobs.get_mut(job_id) else {
                return;
            };

            let mut event = event;
            if matches!(event.event_type, JobEventKindDto::EntryFinished) {
                record.processed_entries = record.processed_entries.saturating_add(1);
            }
            if let Some(entries) = event.entries {
                record.processed_entries = record.processed_entries.max(entries);
            }
            if let Some(total_entries) = event.total_entries {
                record.total_entries = Some(total_entries);
            }
            if event.entries.is_none() && record.processed_entries > 0 {
                event.entries = Some(record.processed_entries);
            }
            if event.total_entries.is_none() {
                event.total_entries = record.total_entries;
            }

            match event.event_type {
                JobEventKindDto::Started => record.status = JobStatusDto::Running,
                JobEventKindDto::Completed => {
                    if !record.status.is_terminal() {
                        record.status = JobStatusDto::Completed;
                    }
                }
                JobEventKindDto::Failed => record.status = JobStatusDto::Failed,
                JobEventKindDto::Cancelled => record.status = JobStatusDto::Cancelled,
                JobEventKindDto::Paused => record.status = JobStatusDto::Paused,
                JobEventKindDto::Resumed => {
                    if record.status == JobStatusDto::Paused {
                        record.status = JobStatusDto::Running;
                    }
                }
                _ => {}
            }

            push_recorded_event(record, event);
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

fn push_recorded_event(record: &mut JobRecord, event: JobEventDto) {
    match event.event_type {
        JobEventKindDto::EntryStarted => {
            record
                .events
                .retain(|existing| existing.event_type != JobEventKindDto::EntryStarted);
        }
        JobEventKindDto::EntryFinished => {
            record
                .events
                .retain(|existing| existing.event_type != JobEventKindDto::EntryFinished);
        }
        JobEventKindDto::BytesProcessed => {
            record
                .events
                .retain(|existing| existing.event_type != JobEventKindDto::BytesProcessed);
        }
        _ => {}
    }

    while record.events.len() >= MAX_EVENTS_TO_KEEP {
        let _ = record.events.pop_front();
    }
    record.events.push_back(event);
}

impl Drop for JobRegistry {
    fn drop(&mut self) {
        self.cleanup_preview_roots();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(windows)]
    fn temporary_preview_root() -> std::path::PathBuf {
        let now_nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("zmanager-preview-windows-{now_nanos}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("temporary preview directory should be available");
        root
    }

    #[cfg(not(windows))]
    fn temporary_preview_root() -> std::path::PathBuf {
        let now_nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("zmanager-preview-{now_nanos}"));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("temporary preview directory should be available");
        root
    }

    #[test]
    fn job_poll_drains_events_exactly_once() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipCreate);

        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::Started {
                kind: zmanager_core::jobs::JobKind::ZipCreate,
                total_bytes: None,
            },
        );

        let first_poll = registry
            .poll_events(&response.job_id)
            .expect("poll should return a snapshot");
        assert_eq!(first_poll.events.len(), 1);
        assert!(matches!(
            first_poll.events[0].event_type,
            JobEventKindDto::Started
        ));
        assert!(matches!(first_poll.status, JobStatusDto::Running));

        let second_poll = registry
            .poll_events(&response.job_id)
            .expect("poll should continue returning snapshots");
        assert_eq!(second_poll.events.len(), 0);
        assert!(matches!(second_poll.status, JobStatusDto::Running));
    }

    #[test]
    fn fake_job_records_started() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipCreate);

        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::Started {
                kind: zmanager_core::jobs::JobKind::ZipCreate,
                total_bytes: Some(1024),
            },
        );

        let snapshot = registry
            .snapshot(&response.job_id)
            .expect("job should exist after create");

        assert!(matches!(snapshot.status, JobStatusDto::Running));
        assert_eq!(snapshot.events.len(), 1);
        assert!(matches!(
            snapshot.events[0].event_type,
            JobEventKindDto::Started
        ));
        assert_eq!(snapshot.events[0].job_kind, Some(JobKindDto::ZipCreate));
    }

    #[test]
    fn job_progress_events_are_coalesced_without_entry_chatter() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipExtract);

        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::Started {
                kind: zmanager_core::jobs::JobKind::ZipExtract,
                total_bytes: Some(100),
            },
        );
        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::EntryStarted {
                path: "docs/one.txt".to_string(),
                bytes: Some(10),
            },
        );
        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::BytesProcessed {
                path: Some("docs/one.txt".to_string()),
                bytes: 10,
                total_bytes_processed: 10,
            },
        );
        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::EntryFinished {
                path: "docs/one.txt".to_string(),
                bytes: 10,
            },
        );
        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::BytesProcessed {
                path: Some("docs/two.txt".to_string()),
                bytes: 20,
                total_bytes_processed: 30,
            },
        );

        let snapshot = registry
            .snapshot(&response.job_id)
            .expect("job should exist after progress events");

        assert_eq!(
            snapshot
                .events
                .iter()
                .map(|event| event.event_type)
                .collect::<Vec<_>>(),
            [
                JobEventKindDto::Started,
                JobEventKindDto::EntryStarted,
                JobEventKindDto::EntryFinished,
                JobEventKindDto::BytesProcessed
            ]
        );
        let progress = snapshot
            .events
            .last()
            .expect("progress event should remain");
        assert_eq!(progress.path.as_deref(), Some("docs/two.txt"));
        assert_eq!(progress.total_bytes_processed, Some(30));
        let finished = snapshot
            .events
            .iter()
            .find(|event| event.event_type == JobEventKindDto::EntryFinished)
            .expect("latest finished entry should remain for file counts");
        assert_eq!(finished.entries, Some(1));
    }

    #[test]
    fn cancel_request_marks_token() {
        let registry = JobRegistry::new();
        let (response, token) = registry.create_job(JobKindDto::ZipExtract);

        let cancel_response = registry
            .request_cancel(&response.job_id)
            .expect("cancel should target an existing job");

        assert!(matches!(cancel_response.status, JobStatusDto::Cancelled));
        assert!(
            token.is_cancelled(),
            "cancel request should set the job cancellation token"
        );
    }

    #[test]
    fn cancel_request_moves_paused_job_to_cancelled() {
        let registry = JobRegistry::new();
        let (response, token) = registry.create_job(JobKindDto::ZipExtract);

        registry
            .request_pause(&response.job_id)
            .expect("pause should target an existing job");

        let cancel_response = registry
            .request_cancel(&response.job_id)
            .expect("cancel should target a paused job");

        assert!(matches!(cancel_response.status, JobStatusDto::Cancelled));
        assert!(
            token.is_cancelled(),
            "cancel request should set the paused job cancellation token"
        );

        let poll = registry
            .poll_events(&response.job_id)
            .expect("cancelled job should remain pollable");
        assert!(matches!(poll.status, JobStatusDto::Cancelled));
        assert!(poll.can_dismiss);
        assert!(
            poll.events
                .iter()
                .any(|event| event.event_type == JobEventKindDto::Cancelled)
        );
    }

    #[test]
    fn pause_and_resume_update_status_and_emit_events() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipExtract);

        registry.emit_job_event(
            &response.job_id,
            zmanager_core::jobs::JobEvent::Started {
                kind: zmanager_core::jobs::JobKind::ZipExtract,
                total_bytes: Some(100),
            },
        );

        let paused = registry
            .request_pause(&response.job_id)
            .expect("pause should target an existing job");
        assert!(matches!(paused.status, JobStatusDto::Paused));

        let pause_poll = registry
            .poll_events(&response.job_id)
            .expect("paused job should remain pollable");
        assert!(matches!(pause_poll.status, JobStatusDto::Paused));
        assert!(
            pause_poll
                .events
                .iter()
                .any(|event| event.event_type == JobEventKindDto::Paused)
        );

        let resumed = registry
            .request_resume(&response.job_id)
            .expect("resume should target an existing job");
        assert!(matches!(resumed.status, JobStatusDto::Running));

        let resume_poll = registry
            .poll_events(&response.job_id)
            .expect("resumed job should remain pollable");
        assert!(matches!(resume_poll.status, JobStatusDto::Running));
        assert!(
            resume_poll
                .events
                .iter()
                .any(|event| event.event_type == JobEventKindDto::Resumed)
        );
    }

    #[test]
    fn dismiss_job_only_removes_terminal_jobs() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipCreate);

        assert!(
            registry.remove_job_if_terminal(&response.job_id).is_none(),
            "non-terminal jobs should stay in registry"
        );

        registry.emit_direct_event(
            &response.job_id,
            JobEventDto::new(JobEventKindDto::Completed),
        );

        let removed = registry
            .remove_job_if_terminal(&response.job_id)
            .expect("terminal job should be removable");
        assert!(matches!(removed, JobKindDto::ZipCreate));
        assert!(registry.snapshot(&response.job_id).is_none());
    }

    #[test]
    fn replace_preview_root_cleans_previous_root() {
        let registry = JobRegistry::new();
        let root = temporary_preview_root();
        let first = root.join("first");
        let second = root.join("second");

        fs::create_dir_all(&first).expect("first preview root should be created");
        registry.replace_preview_root(first.clone());
        assert!(
            first.exists(),
            "first preview root should exist after registration"
        );

        fs::create_dir_all(&second).expect("second preview root should be created");
        registry.replace_preview_root(second.clone());

        assert!(!first.exists(), "previous preview root should be removed");
        assert!(second.exists(), "current preview root should remain");

        registry.cleanup_preview_roots();
        assert!(
            !second.exists(),
            "cleanup should remove remaining preview root"
        );
        let _ = fs::remove_dir_all(&root);
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

    pub fn emit_direct(&mut self, event: JobEventDto) {
        self.registry.wait_if_paused(&self.job_id);
        self.registry.emit_direct_event(&self.job_id, event);
    }
}

impl JobEventSink for JobEventCollector {
    fn emit(&mut self, event: JobEvent) {
        self.registry.wait_if_paused(&self.job_id);
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
            JobKind::RawStreamExtract => JobKindDto::RawStreamExtract,
        }
    }
}

fn now_timestamp() -> String {
    let since_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    since_epoch.as_secs().to_string()
}
