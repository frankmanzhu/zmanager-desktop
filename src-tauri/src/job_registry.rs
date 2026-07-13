use std::{
    collections::{HashMap, VecDeque},
    fs,
    path::PathBuf,
    sync::{Arc, Condvar, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, watch};

#[cfg(test)]
use crate::job_dto::TestJobEventsSnapshot;
use crate::job_dto::{
    CancelJobResponseDto, DesktopJobSnapshotDto, JobCatalogDescriptorDto, JobCatalogSnapshotDto,
    JobControlResponseDto, JobEventDto, JobEventKindDto, JobKindDto, JobPhaseDto,
    JobProgressFactsDto, JobRecordSnapshot, JobStatusDto, JobTerminalSummaryDto,
    StartJobResponseDto,
};
use zmanager_core::{
    jobs::CancellationToken, jobs::JobEvent, jobs::JobEventSink, jobs::JobKind, jobs::JobPhase,
    jobs::JobProgressState,
};

const MAX_EVENTS_TO_KEEP: usize = 256;
pub const MAX_RETAINED_TERMINAL_JOBS: usize = 100;
pub const MAX_ADMITTED_JOBS: usize = 256;
pub const MAX_SUBSCRIBERS_PER_JOB: usize = 16;
pub const MAX_PROCESS_SUBSCRIBERS: usize = 512;
const MAX_NOTICES_TO_KEEP: usize = 32;

#[derive(Debug)]
struct JobRecord {
    id: String,
    kind: JobKindDto,
    created_at: String,
    status: JobStatusDto,
    paused_from_status: Option<JobStatusDto>,
    #[cfg(test)]
    test_events: VecDeque<JobEventDto>,
    terminal_summary: Option<JobTerminalSummaryDto>,
    cancellation_token: Option<CancellationToken>,
    pause_control: PauseControl,
    processed_entries: usize,
    total_entries: Option<usize>,
    revision: u64,
    updated_at: String,
    progress: JobProgressFactsDto,
    notices: VecDeque<JobEventDto>,
    latest_failure: Option<JobEventDto>,
    terminal_sequence: Option<u64>,
    started_at: Instant,
    paused_at: Option<Instant>,
    paused_duration: Duration,
    finished_at: Option<Instant>,
    phase_started_at: Option<Instant>,
    phase_paused_duration: Duration,
    snapshot_sender: watch::Sender<Arc<DesktopJobSnapshotDto>>,
    core_progress: JobProgressState,
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

struct RegistryState {
    next_job_id: u64,
    catalog_revision: u64,
    jobs: HashMap<String, JobRecord>,
    preview_roots: VecDeque<PathBuf>,
    catalog_sender: watch::Sender<Arc<JobCatalogSnapshotDto>>,
    next_subscription_id: u64,
    subscriptions: HashMap<String, SubscriptionRecord>,
}

#[derive(Debug)]
struct SubscriptionRecord {
    owner: String,
    job_id: Option<String>,
    commands: mpsc::Sender<SubscriptionCommand>,
    in_flight: Arc<Mutex<Option<u64>>>,
}

#[derive(Debug)]
pub enum SubscriptionCommand {
    Ack(u64),
    Stop,
}

impl RegistryState {
    fn new() -> Self {
        let (catalog_sender, _) = watch::channel(Arc::new(JobCatalogSnapshotDto {
            catalog_revision: "0".to_string(),
            jobs: Vec::new(),
        }));
        Self {
            next_job_id: 0,
            catalog_revision: 0,
            jobs: HashMap::new(),
            preview_roots: VecDeque::new(),
            catalog_sender,
            next_subscription_id: 0,
            subscriptions: HashMap::new(),
        }
    }
}

#[derive(Clone)]
pub struct JobRegistry {
    state: Arc<Mutex<RegistryState>>,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(RegistryState::new())),
        }
    }

    fn with_lock<R>(&self, operation: impl FnOnce(&mut RegistryState) -> R) -> R {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());

        operation(&mut state)
    }

    pub fn create_job(&self, kind: JobKindDto) -> (StartJobResponseDto, CancellationToken) {
        self.try_create_job(kind)
            .expect("job registry capacity exceeded")
    }

    pub fn try_create_job(
        &self,
        kind: JobKindDto,
    ) -> Result<(StartJobResponseDto, CancellationToken), &'static str> {
        self.with_lock(|state| {
            let job_id = state.next_job_id.saturating_add(1).to_string();
            state.next_job_id = state.next_job_id.saturating_add(1);

            let token = CancellationToken::new();
            let created_at = now_timestamp();
            evict_oldest_terminal_jobs(state);
            if state.jobs.len() >= MAX_ADMITTED_JOBS {
                return Err("job_capacity");
            }
            let progress = JobProgressFactsDto::default();
            let initial_snapshot = Arc::new(DesktopJobSnapshotDto {
                revision: "1".to_string(),
                job_id: job_id.clone(),
                kind,
                status: JobStatusDto::Queued,
                created_at: created_at.clone(),
                updated_at: created_at.clone(),
                can_pause: true,
                can_resume: false,
                can_cancel: true,
                can_dismiss: false,
                progress_facts: progress.clone(),
                latest_failure: None,
                bounded_notices: Vec::new(),
                available_actions: Vec::new(),
                output_artifacts: Vec::new(),
                retry_descriptor: None,
                terminal_summary: None,
            });
            let (snapshot_sender, _) = watch::channel(initial_snapshot);
            state.jobs.insert(
                job_id.clone(),
                JobRecord {
                    id: job_id.clone(),
                    kind,
                    created_at: created_at.clone(),
                    status: JobStatusDto::Queued,
                    paused_from_status: None,
                    #[cfg(test)]
                    test_events: VecDeque::new(),
                    terminal_summary: None,
                    cancellation_token: Some(token.clone()),
                    pause_control: PauseControl::new(),
                    processed_entries: 0,
                    total_entries: None,
                    revision: 1,
                    updated_at: created_at.clone(),
                    progress,
                    notices: VecDeque::new(),
                    latest_failure: None,
                    terminal_sequence: None,
                    started_at: Instant::now(),
                    paused_at: None,
                    paused_duration: Duration::ZERO,
                    finished_at: None,
                    phase_started_at: None,
                    phase_paused_duration: Duration::ZERO,
                    snapshot_sender,
                    core_progress: JobProgressState::default(),
                },
            );
            publish_catalog(state);

            Ok((
                StartJobResponseDto {
                    job_id: job_id.clone(),
                    kind,
                    status: JobStatusDto::Queued,
                    created_at,
                },
                token,
            ))
        })
    }

    pub fn remove_job_if_terminal(&self, job_id: &str) -> Option<JobKindDto> {
        self.with_lock(|state| {
            let record = state.jobs.get(job_id)?;
            if !record.status.is_terminal() {
                return None;
            }

            cancel_job_subscriptions(state, job_id);
            let removed = state.jobs.remove(job_id).map(|record| record.kind);
            if removed.is_some() {
                publish_catalog(state);
            }
            removed
        })
    }

    pub fn snapshot(&self, job_id: &str) -> Option<JobRecordSnapshot> {
        self.with_lock(|state| {
            state.jobs.get(job_id).map(|record| JobRecordSnapshot {
                kind: record.kind,
                created_at: record.created_at.clone(),
                status: record.status,
                #[cfg(test)]
                events: record.test_events.iter().cloned().collect(),
                terminal_summary: record.terminal_summary.clone(),
            })
        })
    }

    pub fn current_job_snapshot(&self, job_id: &str) -> Option<Arc<DesktopJobSnapshotDto>> {
        self.with_lock(|state| {
            state
                .jobs
                .get(job_id)
                .map(|record| record.snapshot_sender.borrow().clone())
        })
    }

    pub fn subscribe_job_snapshot(
        &self,
        job_id: &str,
    ) -> Option<watch::Receiver<Arc<DesktopJobSnapshotDto>>> {
        self.with_lock(|state| {
            state
                .jobs
                .get(job_id)
                .map(|record| record.snapshot_sender.subscribe())
        })
    }

    pub fn subscribe_catalog_snapshot(&self) -> watch::Receiver<Arc<JobCatalogSnapshotDto>> {
        self.with_lock(|state| state.catalog_sender.subscribe())
    }

    pub fn register_job_subscription(
        &self,
        owner: &str,
        job_id: &str,
    ) -> Result<
        (
            String,
            watch::Receiver<Arc<DesktopJobSnapshotDto>>,
            mpsc::Receiver<SubscriptionCommand>,
            Arc<Mutex<Option<u64>>>,
        ),
        &'static str,
    > {
        self.with_lock(|state| {
            if owner != "main" && owner != format!("task-{job_id}") {
                return Err("job_subscription_forbidden");
            }
            if state.subscriptions.len() >= MAX_PROCESS_SUBSCRIBERS {
                return Err("subscription_capacity");
            }
            if state
                .subscriptions
                .values()
                .filter(|sub| sub.job_id.as_deref() == Some(job_id))
                .count()
                >= MAX_SUBSCRIBERS_PER_JOB
            {
                return Err("job_subscription_capacity");
            }
            let receiver = state
                .jobs
                .get(job_id)
                .ok_or("job_not_found")?
                .snapshot_sender
                .subscribe();
            state.next_subscription_id = state
                .next_subscription_id
                .checked_add(1)
                .ok_or("subscription_id_exhausted")?;
            let id = format!("subscription-{}", state.next_subscription_id);
            let (commands, receiver_commands) = mpsc::channel(4);
            let in_flight = Arc::new(Mutex::new(None));
            state.subscriptions.insert(
                id.clone(),
                SubscriptionRecord {
                    owner: owner.to_owned(),
                    job_id: Some(job_id.to_owned()),
                    commands,
                    in_flight: in_flight.clone(),
                },
            );
            Ok((id, receiver, receiver_commands, in_flight))
        })
    }

    pub fn register_catalog_subscription(
        &self,
        owner: &str,
    ) -> Result<
        (
            String,
            watch::Receiver<Arc<JobCatalogSnapshotDto>>,
            mpsc::Receiver<SubscriptionCommand>,
            Arc<Mutex<Option<u64>>>,
        ),
        &'static str,
    > {
        self.with_lock(|state| {
            if owner != "main" {
                return Err("catalog_forbidden");
            }
            if state.subscriptions.len() >= MAX_PROCESS_SUBSCRIBERS {
                return Err("subscription_capacity");
            }
            state.next_subscription_id = state
                .next_subscription_id
                .checked_add(1)
                .ok_or("subscription_id_exhausted")?;
            let id = format!("subscription-{}", state.next_subscription_id);
            let (commands, receiver_commands) = mpsc::channel(4);
            let in_flight = Arc::new(Mutex::new(None));
            state.subscriptions.insert(
                id.clone(),
                SubscriptionRecord {
                    owner: owner.to_owned(),
                    job_id: None,
                    commands,
                    in_flight: in_flight.clone(),
                },
            );
            Ok((
                id,
                state.catalog_sender.subscribe(),
                receiver_commands,
                in_flight,
            ))
        })
    }

    pub fn acknowledge_subscription(
        &self,
        owner: &str,
        id: &str,
        revision: u64,
    ) -> Result<(), &'static str> {
        self.with_lock(|state| {
            let subscription = state
                .subscriptions
                .get(id)
                .ok_or("subscription_not_found")?;
            if subscription.owner != owner {
                return Err("subscription_forbidden");
            }
            let sent = *subscription
                .in_flight
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if sent.is_some_and(|sent| revision > sent) {
                return Err("ack_revision_newer_than_in_flight");
            }
            if sent.is_none() {
                return Ok(());
            }
            subscription
                .commands
                .try_send(SubscriptionCommand::Ack(revision))
                .map_err(|_| "subscription_busy")
        })
    }

    pub fn unsubscribe(&self, owner: &str, id: &str) -> Result<(), &'static str> {
        self.with_lock(|state| {
            let subscription = state
                .subscriptions
                .get(id)
                .ok_or("subscription_not_found")?;
            if subscription.owner != owner {
                return Err("subscription_forbidden");
            }
            let subscription = state
                .subscriptions
                .remove(id)
                .expect("checked subscription exists");
            let _ = subscription.commands.try_send(SubscriptionCommand::Stop);
            Ok(())
        })
    }

    pub fn cleanup_subscription(&self, id: &str) {
        self.with_lock(|state| {
            state.subscriptions.remove(id);
        });
    }

    pub fn cleanup_owner_subscriptions(&self, owner: &str) {
        self.with_lock(|state| {
            let ids = state
                .subscriptions
                .iter()
                .filter_map(|(id, subscription)| (subscription.owner == owner).then(|| id.clone()))
                .collect::<Vec<_>>();
            for id in ids {
                if let Some(subscription) = state.subscriptions.remove(&id) {
                    let _ = subscription.commands.try_send(SubscriptionCommand::Stop);
                }
            }
        });
    }

    pub fn request_cancel(&self, job_id: &str) -> Option<CancelJobResponseDto> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;

            if let Some(token) = record.cancellation_token.as_ref() {
                token.cancel();
                record.pause_control.resume();
                if !record.status.is_terminal() {
                    record.status = JobStatusDto::Cancelling;
                    let kind = record.kind;
                    let processed_entries = record.processed_entries;
                    let total_entries = record.total_entries;
                    record_test_event(
                        record,
                        JobEventDto {
                            event_type: JobEventKindDto::Warning,
                            job_kind: Some(kind),
                            phase: None,
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
                            message: Some("Cancellation requested.".to_string()),
                        },
                    );
                }
                publish_record(record);
                let response = Some(CancelJobResponseDto {
                    job_id: job_id.to_string(),
                    status: record.status,
                    revision: record.revision.to_string(),
                });
                publish_catalog(state);
                response
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
                    revision: record.revision.to_string(),
                });
            }

            if record.status != JobStatusDto::Paused {
                record.paused_from_status = Some(record.status);
                record.status = JobStatusDto::Paused;
                record.pause_control.pause();
                let kind = record.kind;
                let processed_entries = record.processed_entries;
                let total_entries = record.total_entries;
                record_test_event(
                    record,
                    JobEventDto {
                        event_type: JobEventKindDto::Paused,
                        job_kind: Some(kind),
                        phase: None,
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

            publish_record(record);
            let response = Some(JobControlResponseDto {
                job_id: job_id.to_string(),
                status: record.status,
                revision: record.revision.to_string(),
            });
            publish_catalog(state);
            response
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
                record_test_event(
                    record,
                    JobEventDto {
                        event_type: JobEventKindDto::Resumed,
                        job_kind: Some(kind),
                        phase: None,
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

            publish_record(record);
            let response = Some(JobControlResponseDto {
                job_id: job_id.to_string(),
                status: record.status,
                revision: record.revision.to_string(),
            });
            publish_catalog(state);
            response
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

    #[cfg(test)]
    pub fn take_test_events(&self, job_id: &str) -> Option<TestJobEventsSnapshot> {
        self.with_lock(|state| {
            let record = state.jobs.get_mut(job_id)?;
            let events = record.test_events.drain(..).collect::<Vec<_>>();

            Some(TestJobEventsSnapshot {
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
                phase: None,
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
                phase: None,
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
                recent_paths,
                bytes,
                total_bytes_processed,
                total_entries_processed,
                ..
            } => JobEventDto {
                event_type: JobEventKindDto::BytesProcessed,
                job_kind: None,
                phase: None,
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: recent_paths.last().cloned().or_else(|| path.clone()),
                bytes: Some(*bytes),
                total_bytes: None,
                total_bytes_processed: Some(*total_bytes_processed),
                entries: Some(usize::try_from(*total_entries_processed).unwrap_or(usize::MAX)),
                total_entries: None,
                message: None,
            },
            JobEvent::PhaseStarted { phase, total_bytes } => JobEventDto {
                event_type: JobEventKindDto::PhaseStarted,
                job_kind: None,
                phase: Some(JobPhaseDto::from(*phase)),
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: None,
                bytes: None,
                total_bytes: *total_bytes,
                total_bytes_processed: Some(0),
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::PhaseBytesProcessed {
                phase,
                path,
                recent_paths,
                bytes,
                total_bytes_processed,
                total_bytes,
                ..
            } => JobEventDto {
                event_type: JobEventKindDto::PhaseBytesProcessed,
                job_kind: None,
                phase: Some(JobPhaseDto::from(*phase)),
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: recent_paths.last().cloned().or_else(|| path.clone()),
                bytes: Some(*bytes),
                total_bytes: *total_bytes,
                total_bytes_processed: Some(*total_bytes_processed),
                entries: None,
                total_entries: None,
                message: None,
            },
            JobEvent::EntryFinished { path, bytes } => JobEventDto {
                event_type: JobEventKindDto::EntryFinished,
                job_kind: None,
                phase: None,
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
                message: Some(message.clone()),
            },
            JobEvent::Completed { entries, bytes } => JobEventDto {
                event_type: JobEventKindDto::Completed,
                job_kind: None,
                phase: None,
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
                message: Some(message.clone()),
            },
            JobEvent::Cancelled { message } => JobEventDto {
                event_type: JobEventKindDto::Cancelled,
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
                message: Some(message.clone()),
            },
        };

        self.with_lock(|state| {
            let Some(record) = state.jobs.get_mut(job_id) else {
                return;
            };
            record.core_progress.apply(&event);
            sync_core_progress(record);

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

            if matches!(event, JobEvent::Completed { .. }) {
                apply_event_to_progress(record, &event_dto);
                publish_record(record);
                publish_catalog(state);
                return;
            }

            match event {
                JobEvent::Started { .. } => {
                    if matches!(record.status, JobStatusDto::Queued | JobStatusDto::Running) {
                        record.status = JobStatusDto::Running;
                    }
                }
                JobEvent::Completed { .. } => {
                    if !record.status.is_terminal() {
                        record.status = JobStatusDto::Completed;
                    }
                }
                JobEvent::Failed { .. } if !record.status.is_terminal() => {
                    record.status = JobStatusDto::Failed
                }
                JobEvent::Cancelled { .. } if !record.status.is_terminal() => {
                    record.status = JobStatusDto::Cancelled
                }
                _ => {}
            }

            apply_event_to_progress(record, &event_dto);
            sync_core_progress(record);
            record_test_event(record, event_dto);
            if record.status.is_terminal() && record.terminal_sequence.is_none() {
                record.terminal_sequence = Some(record.revision);
            }
            publish_record(record);
            publish_catalog(state);
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
                JobEventKindDto::Started => {
                    if matches!(record.status, JobStatusDto::Queued | JobStatusDto::Running) {
                        record.status = JobStatusDto::Running;
                    }
                }
                JobEventKindDto::Completed => {
                    if !record.status.is_terminal() {
                        record.status = JobStatusDto::Completed;
                    }
                }
                JobEventKindDto::Failed if !record.status.is_terminal() => {
                    record.status = JobStatusDto::Failed
                }
                JobEventKindDto::Cancelled if !record.status.is_terminal() => {
                    record.status = JobStatusDto::Cancelled
                }
                JobEventKindDto::Paused => record.status = JobStatusDto::Paused,
                JobEventKindDto::Resumed => {
                    if record.status == JobStatusDto::Paused {
                        record.status = JobStatusDto::Running;
                    }
                }
                _ => {}
            }

            apply_event_to_progress(record, &event);
            record_test_event(record, event);
            if record.status.is_terminal() && record.terminal_sequence.is_none() {
                record.terminal_sequence = Some(record.revision);
            }
            publish_record(record);
            publish_catalog(state);
        });
    }

    pub fn set_terminal_summary(&self, job_id: &str, summary: JobTerminalSummaryDto) {
        self.with_lock(|state| {
            if let Some(record) = state.jobs.get_mut(job_id) {
                record.terminal_summary = Some(summary);
                publish_record(record);
                publish_catalog(state);
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

#[cfg(test)]
fn record_test_event(record: &mut JobRecord, event: JobEventDto) {
    match event.event_type {
        JobEventKindDto::EntryStarted => {
            record
                .test_events
                .retain(|existing| existing.event_type != JobEventKindDto::EntryStarted);
        }
        JobEventKindDto::EntryFinished => {
            record
                .test_events
                .retain(|existing| existing.event_type != JobEventKindDto::EntryFinished);
        }
        JobEventKindDto::BytesProcessed => {
            record
                .test_events
                .retain(|existing| existing.event_type != JobEventKindDto::BytesProcessed);
        }
        JobEventKindDto::PhaseBytesProcessed => {
            record.test_events.retain(|existing| {
                existing.event_type != JobEventKindDto::PhaseBytesProcessed
                    || existing.phase != event.phase
            });
        }
        _ => {}
    }

    while record.test_events.len() >= MAX_EVENTS_TO_KEEP {
        let _ = record.test_events.pop_front();
    }
    record.test_events.push_back(event);
}

#[cfg(not(test))]
fn record_test_event(_record: &mut JobRecord, _event: JobEventDto) {}

fn apply_event_to_progress(record: &mut JobRecord, event: &JobEventDto) {
    if let Some(total) = event.total_bytes {
        record.progress.total_bytes = Some(total);
    }
    if let Some(processed) = event.total_bytes_processed {
        if matches!(
            event.event_type,
            JobEventKindDto::PhaseStarted | JobEventKindDto::PhaseBytesProcessed
        ) {
            record.progress.phase_processed_bytes =
                record.progress.phase_processed_bytes.max(processed);
            record.progress.phase_total_bytes = event.total_bytes;
        } else {
            record.progress.processed_bytes = record.progress.processed_bytes.max(processed);
        }
    }
    if let Some(entries) = event.entries {
        record.progress.processed_entries = record.progress.processed_entries.max(entries as u64);
    }
    if let Some(total) = event.total_entries {
        record.progress.total_entries = Some(total as u64);
    }
    if let Some(path) = event.path.as_ref() {
        record
            .progress
            .recent_paths
            .retain(|existing| existing != path);
        record.progress.recent_paths.push(path.clone());
        if record.progress.recent_paths.len() > 10 {
            record.progress.recent_paths.remove(0);
        }
        record.progress.current_path = Some(path.clone());
    }
    if matches!(event.event_type, JobEventKindDto::PhaseStarted) {
        record.progress.active_phase = event.phase;
        record.progress.phase_processed_bytes = 0;
        record.progress.phase_total_bytes = event.total_bytes;
        record.progress.phase_elapsed_millis = 0;
        record.phase_started_at = Some(Instant::now());
        record.phase_paused_duration = Duration::ZERO;
    }
    if matches!(event.event_type, JobEventKindDto::Warning) {
        record.progress.warning_count = record.progress.warning_count.saturating_add(1);
        while record.notices.len() >= MAX_NOTICES_TO_KEEP {
            record.notices.pop_front();
        }
        record.notices.push_back(event.clone());
    }
    if matches!(event.event_type, JobEventKindDto::Failed) {
        record.latest_failure = Some(event.clone());
    }
}

fn sync_core_progress(record: &mut JobRecord) {
    let core = &record.core_progress;
    record.progress.processed_bytes = core.processed_bytes;
    record.progress.total_bytes = core.total_bytes;
    record.progress.processed_entries = core.processed_entries;
    record.progress.total_entries = core.total_entries;
    record.progress.current_path = core.current_path.clone();
    record.progress.recent_paths = core.recent_paths.clone();
    record.progress.active_phase = core.active_phase.map(JobPhaseDto::from);
    record.progress.phase_processed_bytes = core.phase_processed_bytes;
    record.progress.phase_total_bytes = core.phase_total_bytes;
    record.progress.warning_count = core.warning_count;
}

fn publish_record(record: &mut JobRecord) {
    let now = Instant::now();
    if record.status == JobStatusDto::Paused {
        record.paused_at.get_or_insert(now);
    } else if let Some(paused_at) = record.paused_at.take() {
        let paused = now.saturating_duration_since(paused_at);
        record.paused_duration = record.paused_duration.saturating_add(paused);
        record.phase_paused_duration = record.phase_paused_duration.saturating_add(paused);
    }
    if record.status.is_terminal() {
        record.finished_at.get_or_insert(now);
    }
    record.revision = next_revision(record.revision).expect("job revision exhausted");
    record.updated_at = now_timestamp();
    let _ = record
        .snapshot_sender
        .send_replace(Arc::new(snapshot_dto(record)));
}

fn next_revision(current: u64) -> Result<u64, &'static str> {
    current.checked_add(1).ok_or("revision_exhausted")
}

fn snapshot_dto(record: &JobRecord) -> DesktopJobSnapshotDto {
    let (can_pause, can_resume, can_cancel, can_dismiss) = match record.status {
        JobStatusDto::Queued | JobStatusDto::Running => (true, false, true, false),
        JobStatusDto::Paused => (false, true, true, false),
        JobStatusDto::Cancelling => (false, false, false, false),
        JobStatusDto::Completed | JobStatusDto::Failed | JobStatusDto::Cancelled => {
            (false, false, false, true)
        }
    };
    let mut progress = record.progress.clone();
    let now = record.finished_at.unwrap_or_else(Instant::now);
    let current_pause = record
        .paused_at
        .map(|paused_at| now.saturating_duration_since(paused_at))
        .unwrap_or_default();
    let paused_duration = record.paused_duration.saturating_add(current_pause);
    progress.active_elapsed_millis = now
        .saturating_duration_since(record.started_at)
        .saturating_sub(paused_duration)
        .as_millis()
        .min(u128::from(u64::MAX)) as u64;
    progress.phase_elapsed_millis = record
        .phase_started_at
        .map(|started_at| {
            now.saturating_duration_since(started_at)
                .saturating_sub(record.phase_paused_duration.saturating_add(current_pause))
                .as_millis()
                .min(u128::from(u64::MAX)) as u64
        })
        .unwrap_or(0);
    DesktopJobSnapshotDto {
        revision: record.revision.to_string(),
        job_id: record.id.clone(),
        kind: record.kind,
        status: record.status,
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
        can_pause,
        can_resume,
        can_cancel,
        can_dismiss,
        progress_facts: progress,
        latest_failure: record.latest_failure.clone(),
        bounded_notices: record.notices.iter().cloned().collect(),
        available_actions: if record.status == JobStatusDto::Completed {
            vec!["openOutput".into(), "showInFolder".into()]
        } else {
            Vec::new()
        },
        output_artifacts: Vec::new(),
        retry_descriptor: record.latest_failure.as_ref().and_then(|failure| {
            failure
                .retryable
                .filter(|value| *value)
                .map(|_| "retry".into())
        }),
        terminal_summary: record.terminal_summary.clone(),
    }
}

fn publish_catalog(state: &mut RegistryState) {
    state.catalog_revision = state
        .catalog_revision
        .checked_add(1)
        .expect("catalog revision exhausted");
    let mut jobs = state
        .jobs
        .values()
        .map(|record| JobCatalogDescriptorDto {
            job_id: record.id.clone(),
            revision: record.revision.to_string(),
            kind: record.kind,
            status: record.status,
            terminal: record.status.is_terminal(),
        })
        .collect::<Vec<_>>();
    jobs.sort_by(|left, right| left.job_id.cmp(&right.job_id));
    let _ = state
        .catalog_sender
        .send_replace(Arc::new(JobCatalogSnapshotDto {
            catalog_revision: state.catalog_revision.to_string(),
            jobs,
        }));
}

fn evict_oldest_terminal_jobs(state: &mut RegistryState) {
    while state
        .jobs
        .values()
        .filter(|record| record.status.is_terminal())
        .count()
        >= MAX_RETAINED_TERMINAL_JOBS
    {
        let oldest = state
            .jobs
            .values()
            .filter_map(|record| {
                record
                    .terminal_sequence
                    .map(|sequence| (sequence, record.id.clone()))
            })
            .min_by(|left, right| left.cmp(right));
        let Some((_, id)) = oldest else { break };
        cancel_job_subscriptions(state, &id);
        state.jobs.remove(&id);
    }
}

fn cancel_job_subscriptions(state: &mut RegistryState, job_id: &str) {
    let ids = state
        .subscriptions
        .iter()
        .filter_map(|(id, subscription)| {
            (subscription.job_id.as_deref() == Some(job_id)).then(|| id.clone())
        })
        .collect::<Vec<_>>();
    for id in ids {
        if let Some(subscription) = state.subscriptions.remove(&id) {
            let _ = subscription.commands.try_send(SubscriptionCommand::Stop);
        }
    }
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
    fn test_event_capture_drains_exactly_once() {
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
            .take_test_events(&response.job_id)
            .expect("poll should return a snapshot");
        assert_eq!(first_poll.events.len(), 1);
        assert!(matches!(
            first_poll.events[0].event_type,
            JobEventKindDto::Started
        ));
        assert!(matches!(first_poll.status, JobStatusDto::Running));

        let second_poll = registry
            .take_test_events(&response.job_id)
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
                recent_paths: vec!["docs/one.txt".to_string()],
                bytes: 10,
                total_bytes_processed: 10,
                entries: 0,
                total_entries_processed: 0,
                recent_paths_truncated: false,
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
                path: Some("docs/one.txt".to_string()),
                recent_paths: vec!["docs/one.txt".to_string(), "docs/two.txt".to_string()],
                bytes: 20,
                total_bytes_processed: 30,
                entries: 0,
                total_entries_processed: 1,
                recent_paths_truncated: false,
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

        assert!(matches!(cancel_response.status, JobStatusDto::Cancelling));
        assert!(
            token.is_cancelled(),
            "cancel request should set the job cancellation token"
        );
    }

    #[test]
    fn tzap_phase_progress_maps_and_coalesces_per_phase() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::TzapCreate);

        registry.emit_job_event(
            &response.job_id,
            JobEvent::PhaseStarted {
                phase: JobPhase::PlanningPayload,
                total_bytes: Some(100),
            },
        );
        for processed in [25, 75] {
            registry.emit_job_event(
                &response.job_id,
                JobEvent::PhaseBytesProcessed {
                    phase: JobPhase::PlanningPayload,
                    path: Some("payload.bin".to_string()),
                    recent_paths: vec!["payload.bin".to_string()],
                    bytes: processed,
                    total_bytes_processed: processed,
                    total_bytes: Some(100),
                    recent_paths_truncated: false,
                },
            );
        }

        let snapshot = registry
            .snapshot(&response.job_id)
            .expect("job should exist after create");
        assert_eq!(snapshot.events.len(), 2);
        assert_eq!(snapshot.events[0].phase, Some(JobPhaseDto::PlanningPayload));
        assert!(matches!(
            snapshot.events[0].event_type,
            JobEventKindDto::PhaseStarted
        ));
        assert_eq!(snapshot.events[1].total_bytes_processed, Some(75));
        assert!(matches!(
            snapshot.events[1].event_type,
            JobEventKindDto::PhaseBytesProcessed
        ));
    }

    #[test]
    fn cancel_request_moves_paused_job_to_cancelling_until_core_outcome() {
        let registry = JobRegistry::new();
        let (response, token) = registry.create_job(JobKindDto::ZipExtract);

        registry
            .request_pause(&response.job_id)
            .expect("pause should target an existing job");

        let cancel_response = registry
            .request_cancel(&response.job_id)
            .expect("cancel should target a paused job");

        assert!(matches!(cancel_response.status, JobStatusDto::Cancelling));
        assert!(
            token.is_cancelled(),
            "cancel request should set the paused job cancellation token"
        );

        let poll = registry
            .take_test_events(&response.job_id)
            .expect("cancelled job should remain pollable");
        assert!(matches!(poll.status, JobStatusDto::Cancelling));
        assert!(!poll.can_dismiss);
        assert!(
            !poll
                .events
                .iter()
                .any(|event| event.event_type == JobEventKindDto::Cancelled)
        );

        registry.emit_job_event(
            &response.job_id,
            JobEvent::Cancelled {
                message: "cancelled".into(),
            },
        );
        let terminal = registry
            .take_test_events(&response.job_id)
            .expect("job remains retained");
        assert!(matches!(terminal.status, JobStatusDto::Cancelled));
        assert!(terminal.can_dismiss);
    }

    #[test]
    fn late_and_independent_subscribers_receive_retained_revisions() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipCreate);
        registry.emit_job_event(
            &response.job_id,
            JobEvent::Started {
                kind: JobKind::ZipCreate,
                total_bytes: Some(100),
            },
        );
        let first = registry
            .subscribe_job_snapshot(&response.job_id)
            .expect("job receiver");
        let second = registry
            .subscribe_job_snapshot(&response.job_id)
            .expect("independent receiver");
        assert_eq!(first.borrow().status, JobStatusDto::Running);
        assert_eq!(first.borrow().revision, second.borrow().revision);
        registry.emit_job_event(
            &response.job_id,
            JobEvent::Warning {
                message: "notice".into(),
            },
        );
        assert!(first.has_changed().expect("sender remains"));
        assert!(second.has_changed().expect("sender remains"));
        assert_eq!(first.borrow().progress_facts.warning_count, 1);
    }

    #[test]
    fn catalog_discovers_creation_and_rejects_task_window_access() {
        let registry = JobRegistry::new();
        let catalog = registry.subscribe_catalog_snapshot();
        let (response, _) = registry.create_job(JobKindDto::ZipExtract);
        assert!(catalog.has_changed().expect("catalog sender remains"));
        assert_eq!(catalog.borrow().jobs[0].job_id, response.job_id);
        assert!(matches!(
            registry.register_catalog_subscription("task-1"),
            Err("catalog_forbidden")
        ));
        assert!(matches!(
            registry.register_job_subscription("task-other", &response.job_id),
            Err("job_subscription_forbidden")
        ));
        assert!(
            registry
                .register_job_subscription("main", &response.job_id)
                .is_ok()
        );
    }

    #[test]
    fn paused_and_cancelling_states_survive_late_started_event() {
        let registry = JobRegistry::new();
        let (paused, _) = registry.create_job(JobKindDto::ZipCreate);
        registry.request_pause(&paused.job_id);
        registry.emit_job_event(
            &paused.job_id,
            JobEvent::Started {
                kind: JobKind::ZipCreate,
                total_bytes: None,
            },
        );
        assert_eq!(
            registry
                .current_job_snapshot(&paused.job_id)
                .unwrap()
                .status,
            JobStatusDto::Paused
        );
        let (cancelling, _) = registry.create_job(JobKindDto::ZipCreate);
        registry.request_cancel(&cancelling.job_id);
        registry.emit_job_event(
            &cancelling.job_id,
            JobEvent::Started {
                kind: JobKind::ZipCreate,
                total_bytes: None,
            },
        );
        assert_eq!(
            registry
                .current_job_snapshot(&cancelling.job_id)
                .unwrap()
                .status,
            JobStatusDto::Cancelling
        );
    }

    #[test]
    fn acknowledgement_is_owner_scoped_and_rejects_unsent_revisions() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipCreate);
        let (id, snapshots, _commands, in_flight) = registry
            .register_job_subscription("main", &response.job_id)
            .unwrap();
        let revision = snapshots.borrow().revision.parse::<u64>().unwrap();
        *in_flight.lock().unwrap() = Some(revision);
        assert_eq!(
            registry.acknowledge_subscription("task-1", &id, revision),
            Err("subscription_forbidden")
        );
        assert_eq!(
            registry.acknowledge_subscription("main", &id, revision + 1),
            Err("ack_revision_newer_than_in_flight")
        );
        assert!(
            registry
                .acknowledge_subscription("main", &id, revision)
                .is_ok()
        );
    }

    #[test]
    fn revision_exhaustion_fails_closed() {
        assert_eq!(next_revision(u64::MAX), Err("revision_exhausted"));
    }

    #[test]
    fn retention_and_active_admission_are_process_bounded() {
        let registry = JobRegistry::new();
        for _ in 0..=MAX_RETAINED_TERMINAL_JOBS {
            let (job, _) = registry.create_job(JobKindDto::ZipCreate);
            registry.emit_direct_event(&job.job_id, JobEventDto::new(JobEventKindDto::Completed));
        }
        let catalog = registry.subscribe_catalog_snapshot();
        assert!(
            catalog
                .borrow()
                .jobs
                .iter()
                .filter(|job| job.terminal)
                .count()
                <= MAX_RETAINED_TERMINAL_JOBS
        );

        let active = JobRegistry::new();
        for _ in 0..MAX_ADMITTED_JOBS {
            active.try_create_job(JobKindDto::ZipCreate).unwrap();
        }
        assert!(matches!(
            active.try_create_job(JobKindDto::ZipCreate),
            Err("job_capacity")
        ));
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
            .take_test_events(&response.job_id)
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
            .take_test_events(&response.job_id)
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
            JobKind::AppleArchiveCreate => JobKindDto::AppleArchiveCreate,
            JobKind::AppleArchiveExtract => JobKindDto::AppleArchiveExtract,
            JobKind::ArchiveExtract => JobKindDto::ArchiveExtract,
            JobKind::RawStreamExtract => JobKindDto::RawStreamExtract,
        }
    }
}

impl From<JobPhase> for JobPhaseDto {
    fn from(phase: JobPhase) -> Self {
        match phase {
            JobPhase::PlanningPayload => JobPhaseDto::PlanningPayload,
            JobPhase::PlanningMetadata => JobPhaseDto::PlanningMetadata,
            JobPhase::EmittingPayload => JobPhaseDto::EmittingPayload,
            JobPhase::EmittingMetadata => JobPhaseDto::EmittingMetadata,
            JobPhase::CommittingOutput => JobPhaseDto::CommittingOutput,
        }
    }
}

fn now_timestamp() -> String {
    let since_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    since_epoch.as_secs().to_string()
}
