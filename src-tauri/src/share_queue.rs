use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::account::AccountRuntime;
use crate::commands;
use crate::diagnostics::DiagnosticLog;
use crate::dto::{JobEventDto, JobStatusDto, StartCreateRequest};
use crate::error::{CommandErrorDto, ErrorSeverityDto};
use crate::job_registry::JobRegistry;
use crate::localsend::{LocalSendDeviceInfoDto, LocalSendEventDto, LocalSendState};

pub const MAX_SHARE_RECORDS: usize = 128;
pub const SHARE_QUEUE_CHANGED_EVENT: &str = "zmanager-share-queue-changed";

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase", rename_all_fields = "camelCase", deny_unknown_fields)]
pub enum EnqueueShareRequest {
    CompressAndShare {
        client_request_id: String,
        sender_alias: String,
        create_request: StartCreateRequest,
        receiver: Option<LocalSendDeviceInfoDto>,
    },
    DirectShare {
        client_request_id: String,
        sender_alias: String,
        artifact_path: String,
        receiver: Option<LocalSendDeviceInfoDto>,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareErrorSummary {
    pub code: String,
    pub message: String,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShareMode {
    CompressAndShare,
    DirectShare,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CompressionState {
    NotRequired,
    Compressing,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TransferState {
    NotStarted,
    Waiting,
    Sending,
    Sent,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SharingIntent {
    Pending,
    Skipped,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShareLifecycle {
    Active,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionProgressSummary {
    pub processed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub processed_entries: u64,
    pub total_entries: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareRecordSnapshot {
    pub share_id: String,
    pub client_request_id: String,
    pub enqueue_sequence: String,
    pub mode: ShareMode,
    pub source_paths: Vec<String>,
    pub sender_alias: String,
    pub compression_job_id: Option<String>,
    pub artifact_path: Option<String>,
    pub receiver: Option<LocalSendDeviceInfoDto>,
    pub receiver_generation: String,
    pub send_id: Option<String>,
    pub compression_state: CompressionState,
    pub compression_progress: Option<CompressionProgressSummary>,
    pub transfer_state: TransferState,
    pub sharing_intent: SharingIntent,
    pub lifecycle: ShareLifecycle,
    pub attempt: u32,
    pub bytes_sent: u64,
    pub total_bytes: Option<u64>,
    pub delivery_uncertain: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_error: Option<ShareErrorSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareRegistrySnapshot {
    pub queue_revision: String,
    pub items: Vec<ShareRecordSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueShareResponse {
    pub item: ShareRecordSnapshot,
    pub deduplicated: bool,
}

#[derive(Debug, Clone)]
struct ShareRecord {
    share_id: String,
    client_request_id: String,
    enqueue_sequence: u64,
    mode: ShareMode,
    source_paths: Vec<PathBuf>,
    sender_alias: String,
    compression_job_id: Option<String>,
    artifact_path: Option<PathBuf>,
    receiver: Option<LocalSendDeviceInfoDto>,
    receiver_generation: u64,
    send_id: Option<String>,
    compression_state: CompressionState,
    compression_progress: Option<CompressionProgressSummary>,
    transfer_state: TransferState,
    sharing_intent: SharingIntent,
    lifecycle: ShareLifecycle,
    attempt: u32,
    bytes_sent: u64,
    total_bytes: Option<u64>,
    delivery_uncertain: bool,
    created_at: String,
    updated_at: String,
    last_error: Option<ShareErrorSummary>,
}

impl ShareRecord {
    fn snapshot(&self) -> ShareRecordSnapshot {
        ShareRecordSnapshot {
            share_id: self.share_id.clone(),
            client_request_id: self.client_request_id.clone(),
            enqueue_sequence: self.enqueue_sequence.to_string(),
            mode: self.mode,
            source_paths: self.source_paths.iter().map(|path| path.to_string_lossy().into_owned()).collect(),
            sender_alias: self.sender_alias.clone(),
            compression_job_id: self.compression_job_id.clone(),
            artifact_path: self.artifact_path.as_ref().map(|path| path.to_string_lossy().into_owned()),
            receiver: self.receiver.clone(),
            receiver_generation: self.receiver_generation.to_string(),
            send_id: self.send_id.clone(),
            compression_state: self.compression_state,
            compression_progress: self.compression_progress.clone(),
            transfer_state: self.transfer_state,
            sharing_intent: self.sharing_intent,
            lifecycle: self.lifecycle,
            attempt: self.attempt,
            bytes_sent: self.bytes_sent,
            total_bytes: self.total_bytes,
            delivery_uncertain: self.delivery_uncertain,
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
            last_error: self.last_error.clone(),
        }
    }
}

struct QueueState {
    next_sequence: u64,
    revision: u64,
    next_id: u64,
    items: Vec<ShareRecord>,
    active_send: Option<(String, String, u64)>,
    shutting_down: bool,
}

pub struct ShareRegistry {
    state: Arc<Mutex<QueueState>>,
    jobs: JobRegistry,
    localsend: LocalSendState,
    account: AccountRuntime,
    app: tauri::AppHandle,
    diagnostics: DiagnosticLog,
}

impl Clone for ShareRegistry {
    fn clone(&self) -> Self {
        Self { state: self.state.clone(), jobs: self.jobs.clone(), localsend: self.localsend.clone(), account: self.account.clone(), app: self.app.clone(), diagnostics: self.diagnostics.clone() }
    }
}

impl ShareRegistry {
    pub fn new(jobs: JobRegistry, localsend: LocalSendState, account: AccountRuntime, app: tauri::AppHandle, diagnostics: DiagnosticLog) -> Self {
        Self { state: Arc::new(Mutex::new(QueueState { next_sequence: 0, revision: 0, next_id: 0, items: Vec::new(), active_send: None, shutting_down: false })), jobs, localsend, account, app, diagnostics }
    }

    pub fn shutdown(&self) {
        let (send_id, job_ids) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.shutting_down = true;
            let send_id = state.active_send.as_ref().map(|active| active.1.clone());
            let job_ids = state.items.iter().filter_map(|item| (item.lifecycle == ShareLifecycle::Active).then_some(item.compression_job_id.clone()).flatten()).collect::<Vec<_>>();
            (send_id, job_ids)
        };
        if let Some(send_id) = send_id { let _ = self.localsend.cancel_send_for_share(&send_id); }
        for job_id in job_ids { let _ = self.jobs.request_cancel(&job_id); }
    }

    pub fn snapshot(&self) -> ShareRegistrySnapshot {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        ShareRegistrySnapshot { queue_revision: state.revision.to_string(), items: state.items.iter().map(ShareRecord::snapshot).collect() }
    }

    pub fn enqueue(&self, request: EnqueueShareRequest) -> Result<EnqueueShareResponse, CommandErrorDto> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.shutting_down { return Err(error("share_invalid_state", "Share queue is shutting down", false)); }
        let (client_request_id, sender_alias, receiver) = match &request {
            EnqueueShareRequest::CompressAndShare { client_request_id, sender_alias, receiver, .. } => (client_request_id.clone(), sender_alias.clone(), receiver.clone()),
            EnqueueShareRequest::DirectShare { client_request_id, sender_alias, receiver, .. } => (client_request_id.clone(), sender_alias.clone(), receiver.clone()),
        };
        validate_client_request_id(&client_request_id)?;
        let sender_alias = sender_alias.trim().to_owned();
        if sender_alias.is_empty() { return Err(error("share_invalid_state", "sender alias must not be blank", false)); }
        if let Some(existing) = state.items.iter().find(|item| item.client_request_id == client_request_id) {
            return Ok(EnqueueShareResponse { item: existing.snapshot(), deduplicated: true });
        }
        if state.items.len() >= MAX_SHARE_RECORDS { return Err(error("share_queue_full", "The share queue is full", false)); }
        if let Some(receiver) = receiver.as_ref() && receiver.fingerprint.trim().is_empty() { return Err(error("share_invalid_state", "receiver fingerprint must not be blank", false)); }

        let (mode, source_paths, artifact_path, job_response) = match request {
            EnqueueShareRequest::DirectShare { artifact_path, .. } => {
                let path = validate_direct_artifact(&artifact_path)?;
                (ShareMode::DirectShare, vec![path.clone()], Some(path), None)
            }
            EnqueueShareRequest::CompressAndShare { create_request, .. } => {
                if create_request.volume_size.is_some_and(|value| value > 0) { return Err(error("multi_file_output_not_supported", "Compressed sharing requires one output file", false)); }
                if create_request.sources.is_empty() { return Err(error("share_invalid_state", "at least one source is required", false)); }
                let source_paths = create_request.sources.iter().map(PathBuf::from).collect::<Vec<_>>();
                let response = commands::start_create_service(create_request, &self.app, &self.account, &self.jobs, Some(self.diagnostics.clone()))?;
                (ShareMode::CompressAndShare, source_paths, None, Some(response))
            }
        };
        state.next_sequence = state.next_sequence.saturating_add(1);
        state.next_id = state.next_id.saturating_add(1);
        let now = timestamp();
        let receiver_generation = u64::from(receiver.is_some());
        let response = ShareRecord { share_id: format!("share-{}", state.next_id), client_request_id, enqueue_sequence: state.next_sequence, mode, source_paths, sender_alias, compression_job_id: job_response.as_ref().map(|job| job.job_id.clone()), artifact_path, receiver, receiver_generation, send_id: None, compression_state: if mode == ShareMode::DirectShare { CompressionState::NotRequired } else { CompressionState::Compressing }, compression_progress: None, transfer_state: TransferState::NotStarted, sharing_intent: SharingIntent::Pending, lifecycle: ShareLifecycle::Active, attempt: 0, bytes_sent: 0, total_bytes: None, delivery_uncertain: false, created_at: now.clone(), updated_at: now, last_error: None };
        let item = response.snapshot();
        let job_id = response.compression_job_id.clone();
        state.items.push(response);
        self.bump_and_publish_locked(&mut state, true);
        drop(state);
        if let Some(job_id) = job_id { self.watch_job(item.share_id.clone(), job_id); }
        self.schedule();
        Ok(EnqueueShareResponse { item, deduplicated: false })
    }

    pub fn set_receiver(&self, share_id: &str, receiver: LocalSendDeviceInfoDto) -> Result<ShareRecordSnapshot, CommandErrorDto> {
        if receiver.fingerprint.trim().is_empty() { return Err(error("share_invalid_state", "receiver fingerprint must not be blank", false)); }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let item = find_item_mut(&mut state, share_id)?;
        if item.transfer_state == TransferState::Sending { return Err(error("share_busy", "The transfer is already sending", true)); }
        item.receiver = Some(receiver);
        item.receiver_generation = item.receiver_generation.saturating_add(1).max(1);
        item.last_error = None;
        item.updated_at = timestamp();
        let snapshot = item.snapshot();
        self.bump_and_publish_locked(&mut state, true);
        drop(state);
        self.schedule();
        Ok(snapshot)
    }

    pub fn start_share(&self, share_id: &str, acknowledge_delivery_uncertainty: bool) -> Result<ShareRecordSnapshot, CommandErrorDto> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let item = find_item_mut(&mut state, share_id)?;
        if item.lifecycle == ShareLifecycle::Cancelled { return Err(error("share_invalid_state", "Cancelled shares cannot be restarted", false)); }
        if item.transfer_state == TransferState::Sent { return Err(error("share_already_completed", "This share has already completed", false)); }
        if item.delivery_uncertain && !acknowledge_delivery_uncertainty { return Err(error("delivery_confirmation_required", "The receiver may already contain this file", true)); }
        validate_item_artifact(item)?;
        item.sharing_intent = SharingIntent::Pending;
        item.transfer_state = TransferState::NotStarted;
        item.delivery_uncertain = false;
        item.last_error = None;
        item.updated_at = timestamp();
        let snapshot = item.snapshot();
        self.bump_and_publish_locked(&mut state, true);
        drop(state);
        self.schedule();
        Ok(snapshot)
    }

    pub fn skip_share(&self, share_id: &str) -> Result<ShareRecordSnapshot, CommandErrorDto> {
        let (send_id, snapshot) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            let item = find_item_mut(&mut state, share_id)?;
            if item.transfer_state == TransferState::Sent { return Err(error("share_already_completed", "This share has already completed", false)); }
            item.sharing_intent = SharingIntent::Skipped;
            let send_id = if item.transfer_state == TransferState::Sending { item.send_id.clone() } else { None };
            if send_id.is_some() { item.transfer_state = TransferState::Cancelled; item.delivery_uncertain = true; }
            item.updated_at = timestamp();
            let snapshot = item.snapshot();
            self.bump_and_publish_locked(&mut state, true);
            (send_id, snapshot)
        };
        if let Some(send_id) = send_id { let _ = self.localsend.cancel_send_for_share(&send_id); }
        self.schedule();
        Ok(snapshot)
    }

    pub fn cancel_share(&self, share_id: &str) -> Result<ShareRecordSnapshot, CommandErrorDto> {
        let (send_id, job_id, snapshot) = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            let item = find_item_mut(&mut state, share_id)?;
            if item.lifecycle == ShareLifecycle::Cancelled { return Ok(item.snapshot()); }
            item.lifecycle = ShareLifecycle::Cancelled;
            let send_id = item.send_id.clone().filter(|_| item.transfer_state == TransferState::Sending);
            let job_id = item.compression_job_id.clone().filter(|_| !item.compression_state_is_terminal());
            item.transfer_state = TransferState::Cancelled;
            item.compression_state = if item.mode == ShareMode::CompressAndShare && !item.compression_state_is_terminal() { CompressionState::Cancelled } else { item.compression_state };
            item.updated_at = timestamp();
            let snapshot = item.snapshot();
            self.bump_and_publish_locked(&mut state, true);
            (send_id, job_id, snapshot)
        };
        if let Some(send_id) = send_id { let _ = self.localsend.cancel_send_for_share(&send_id); }
        if let Some(job_id) = job_id { let _ = self.jobs.request_cancel(&job_id); }
        self.schedule();
        Ok(snapshot)
    }

    pub fn remove_share(&self, share_id: &str) -> Result<(), CommandErrorDto> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let index = state.items.iter().position(|item| item.share_id == share_id).ok_or_else(|| error("share_not_found", "Share was not found", false))?;
        let item = &state.items[index];
        if item.transfer_state == TransferState::Sending || item.compression_state == CompressionState::Compressing { return Err(error("share_busy", "The share is still active", true)); }
        state.items.remove(index);
        self.bump_and_publish_locked(&mut state, true);
        Ok(())
    }

    pub(crate) fn on_localsend_event(&self, event: LocalSendEventDto) {
        let LocalSendEventDto::FileSendProgress { send_id, bytes_sent, total_bytes, .. } = event else { return; };
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some((share_id, active_send_id, generation)) = state.active_send.clone() else { return; };
        if active_send_id != send_id { return; }
        let Some(item) = state.items.iter_mut().find(|item| item.share_id == share_id && item.send_id.as_deref() == Some(send_id.as_str()) && item.receiver_generation == generation) else { return; };
        item.bytes_sent = bytes_sent;
        item.total_bytes = Some(total_bytes);
        item.updated_at = timestamp();
        self.bump_and_publish_locked(&mut state, false);
    }

    fn watch_job(&self, share_id: String, job_id: String) {
        let Some(mut receiver) = self.jobs.subscribe_job_snapshot(&job_id) else { return; };
        let registry = self.clone();
        thread::spawn(move || {
            loop {
                let snapshot = receiver.borrow_and_update().clone();
                registry.on_job_snapshot(&share_id, &job_id, &snapshot);
                if snapshot.status.is_terminal() { break; }
                if receiver.changed().is_err() { break; }
            }
        });
    }

    fn on_job_snapshot(&self, share_id: &str, job_id: &str, snapshot: &crate::job_dto::DesktopJobSnapshotDto) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(item) = state.items.iter_mut().find(|item| item.share_id == share_id && item.compression_job_id.as_deref() == Some(job_id)) else { return; };
        if item.lifecycle == ShareLifecycle::Cancelled { return; }
        item.compression_progress = Some(CompressionProgressSummary { processed_bytes: snapshot.progress_facts.processed_bytes, total_bytes: snapshot.progress_facts.total_bytes, processed_entries: snapshot.progress_facts.processed_entries, total_entries: snapshot.progress_facts.total_entries });
        match snapshot.status {
            JobStatusDto::Completed => {
                let Some(artifact) = snapshot.output_artifacts.iter().find(|artifact| artifact.artifact_id == "output" && matches!(&artifact.kind, crate::job_dto::JobArtifactKindDto::Archive)) else {
                    item.compression_state = CompressionState::Failed;
                    item.last_error = Some(ShareErrorSummary { code: "share_artifact_missing".into(), message: "The archive output was not found".into(), hint: None });
                    item.updated_at = timestamp();
                    self.bump_and_publish_locked(&mut state, true);
                    return;
                };
                let path = PathBuf::from(&artifact.path);
                if !path.is_file() { item.compression_state = CompressionState::Failed; item.last_error = Some(ShareErrorSummary { code: "share_artifact_invalid".into(), message: "The archive output is not a regular file".into(), hint: None }); }
                else { item.artifact_path = Some(path); item.compression_state = CompressionState::Complete; }
            }
            JobStatusDto::Failed => { item.compression_state = CompressionState::Failed; item.last_error = snapshot.latest_failure.as_ref().map(job_error_summary).or_else(|| Some(ShareErrorSummary { code: "create_failed".into(), message: "Archive creation failed".into(), hint: None })); }
            JobStatusDto::Cancelled => { item.compression_state = CompressionState::Cancelled; }
            _ => {}
        }
        item.updated_at = timestamp();
        self.bump_and_publish_locked(&mut state, true);
        drop(state);
        self.schedule();
    }

    fn schedule(&self) {
        let send = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.shutting_down || state.active_send.is_some() { return; }
            let Some(index) = state.items.iter().enumerate().filter(|(_, item)| item.lifecycle == ShareLifecycle::Active && item.sharing_intent == SharingIntent::Pending && item.receiver.is_some() && item.artifact_path.is_some() && item.transfer_state != TransferState::Sent && item.transfer_state != TransferState::Sending).min_by_key(|(_, item)| item.enqueue_sequence).map(|(index, _)| index) else { return; };
            let item = &mut state.items[index];
            let send_id = format!("send-{}", uuid_like());
            item.send_id = Some(send_id.clone());
            item.attempt = item.attempt.saturating_add(1);
            item.transfer_state = TransferState::Sending;
            item.bytes_sent = 0;
            item.total_bytes = None;
            item.updated_at = timestamp();
            let target = item.receiver.clone().expect("eligible share has receiver");
            let path = item.artifact_path.clone().expect("eligible share has artifact");
            let generation = item.receiver_generation;
            let share_id = item.share_id.clone();
            state.active_send = Some((share_id.clone(), send_id.clone(), generation));
            self.bump_and_publish_locked(&mut state, true);
            Some((share_id, send_id, generation, item.sender_alias.clone(), target, path))
        };
        let Some((share_id, send_id, generation, alias, target, path)) = send else { return; };
        let registry = self.clone();
        thread::spawn(move || {
            let result = registry.localsend.send_file_for_share(&send_id, &alias, target, &path);
            registry.finish_send(&share_id, &send_id, generation, result);
        });
    }

    fn finish_send(&self, share_id: &str, send_id: &str, generation: u64, result: Result<crate::localsend::LocalSendSendFileResultDto, CommandErrorDto>) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some((active_share_id, active_send_id, active_generation)) = state.active_send.clone() else { return; };
        if active_share_id != share_id || active_send_id != send_id || active_generation != generation { return; }
        let Some(item) = state.items.iter_mut().find(|item| item.share_id == share_id && item.send_id.as_deref() == Some(send_id) && item.receiver_generation == generation) else { return; };
        match result { Ok(_) => { item.transfer_state = TransferState::Sent; item.delivery_uncertain = false; item.last_error = None; }, Err(error) => { item.transfer_state = if error.code == "cancelled" { TransferState::Cancelled } else { TransferState::Failed }; item.delivery_uncertain = true; item.last_error = Some(ShareErrorSummary { code: error.code.to_string(), message: error.message, hint: error.hint }); } }
        item.updated_at = timestamp();
        state.active_send = None;
        self.bump_and_publish_locked(&mut state, true);
        drop(state);
        self.schedule();
    }

    fn bump_and_publish_locked(&self, state: &mut QueueState, _immediate: bool) {
        state.revision = state.revision.saturating_add(1);
        let revision = state.revision.to_string();
        let _ = tauri::Emitter::emit(&self.app, SHARE_QUEUE_CHANGED_EVENT, revision);
    }
}

impl ShareRecord {
    fn compression_state_is_terminal(&self) -> bool { matches!(self.compression_state, CompressionState::Complete | CompressionState::Failed | CompressionState::Cancelled | CompressionState::NotRequired) }
}

fn find_item_mut<'a>(state: &'a mut QueueState, share_id: &str) -> Result<&'a mut ShareRecord, CommandErrorDto> {
    state.items.iter_mut().find(|item| item.share_id == share_id).ok_or_else(|| error("share_not_found", "Share was not found", false))
}

fn validate_client_request_id(value: &str) -> Result<(), CommandErrorDto> {
    if value.is_empty() || value.len() > 256 || value.chars().any(char::is_control) { return Err(error("share_invalid_state", "client request id is invalid", false)); }
    Ok(())
}

fn validate_direct_artifact(value: &str) -> Result<PathBuf, CommandErrorDto> {
    let path = PathBuf::from(value.trim());
    if path.as_os_str().is_empty() || path.to_string_lossy().contains('\0') { return Err(error("share_invalid_state", "artifact path is invalid", false)); }
    if !path.is_file() { return Err(CommandErrorDto::not_found(format!("artifact is not a regular file: {path:?}"), None)); }
    Ok(path)
}

fn validate_item_artifact(item: &ShareRecord) -> Result<(), CommandErrorDto> {
    let Some(path) = &item.artifact_path else { return Err(error("share_invalid_state", "share artifact is not ready", true)); };
    if !path.is_file() { return Err(CommandErrorDto::not_found("share artifact is no longer a regular file", None)); }
    Ok(())
}

fn job_error_summary(event: &JobEventDto) -> ShareErrorSummary {
    ShareErrorSummary { code: event.code.unwrap_or("create_failed").to_string(), message: event.message.clone().unwrap_or_else(|| "Archive creation failed".into()), hint: event.hint.map(str::to_owned) }
}

fn error(code: &'static str, message: impl Into<String>, retryable: bool) -> CommandErrorDto {
    CommandErrorDto::new(code, message, None::<String>, ErrorSeverityDto::Warning, retryable)
}

fn timestamp() -> String {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis().to_string()
}

fn uuid_like() -> String {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    format!("{}-{}", std::process::id(), NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed))
}

pub(crate) fn command_get_share_queue(state: &ShareRegistry) -> ShareRegistrySnapshot { state.snapshot() }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetShareReceiverRequest {
    pub share_id: String,
    pub receiver: LocalSendDeviceInfoDto,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartShareRequest {
    pub share_id: String,
    #[serde(default)]
    pub acknowledge_delivery_uncertainty: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareIdRequest {
    pub share_id: String,
}

#[tauri::command]
pub fn enqueue_share(request: EnqueueShareRequest, state: tauri::State<'_, ShareRegistry>) -> Result<EnqueueShareResponse, CommandErrorDto> {
    state.enqueue(request)
}

#[tauri::command]
pub fn set_share_receiver(request: SetShareReceiverRequest, state: tauri::State<'_, ShareRegistry>) -> Result<ShareRecordSnapshot, CommandErrorDto> {
    state.set_receiver(&request.share_id, request.receiver)
}

#[tauri::command]
pub fn start_share(request: StartShareRequest, state: tauri::State<'_, ShareRegistry>) -> Result<ShareRecordSnapshot, CommandErrorDto> {
    state.start_share(&request.share_id, request.acknowledge_delivery_uncertainty)
}

#[tauri::command]
pub fn get_share_queue(state: tauri::State<'_, ShareRegistry>) -> ShareRegistrySnapshot {
    state.snapshot()
}

#[tauri::command]
pub fn skip_share(request: ShareIdRequest, state: tauri::State<'_, ShareRegistry>) -> Result<ShareRecordSnapshot, CommandErrorDto> {
    state.skip_share(&request.share_id)
}

#[tauri::command]
pub fn cancel_share(request: ShareIdRequest, state: tauri::State<'_, ShareRegistry>) -> Result<ShareRecordSnapshot, CommandErrorDto> {
    state.cancel_share(&request.share_id)
}

#[tauri::command]
pub fn remove_share(request: ShareIdRequest, state: tauri::State<'_, ShareRegistry>) -> Result<(), CommandErrorDto> {
    state.remove_share(&request.share_id)
}
