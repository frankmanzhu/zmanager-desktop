use std::{
    ffi::OsString,
    fs,
    path::Path,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use tauri::{AppHandle, Emitter, Url};

use crate::{
    commands::{start_create_internal, start_extract_internal},
    dto::{
        ArchiveFormatDto, DestinationCollisionStrategyDto, OverwritePolicyDto, QuickActionKindDto,
        QuickActionRequestDto, QuickActionStartupErrorDto, QuickActionStartupStateDto,
        StartCreateRequest, StartExtractRequest,
    },
    error::CommandErrorDto,
    job_dto::StartJobResponseDto,
    job_registry::JobRegistry,
};

const QUICK_ACTION_ARG: &str = "--quick-action";
const QUICK_ACTION_ARG_ALIAS: &str = "--action";
const QUICK_ACTION_REQUEST_ARG: &str = "--quick-action-request";
const PATH_ARG: &str = "--path";
const PASSWORD_ARG_PREFIXES: &[&str] = &["--password", "--passphrase", "--secret"];
const QUICK_ACTION_EVENT: &str = "zmanager-quick-action";
const QUICK_ACTION_BURST_DEBOUNCE: Duration = Duration::from_millis(450);

const TZAP_EXTENSION_SUFFIX: &str = ".tzap";
const TZAP_VOLUME_MARKER: &str = ".vol";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum QuickActionStartupState {
    NotRequested,
    Requested(QuickActionRequestDto),
    StartedJobs(Vec<StartJobResponseDto>),
    Invalid(QuickActionError),
}

impl QuickActionStartupState {
    pub fn from_startup_env() -> Self {
        let args = std::env::args_os().skip(1).collect::<Vec<_>>();
        Self::from_args(args)
    }

    fn from_process_or_user_args(args: Vec<OsString>) -> Self {
        if first_arg_is_executable_path(args.first()) {
            return Self::from_args(args.into_iter().skip(1));
        }

        Self::from_args(args)
    }

    pub fn from_args(args: impl IntoIterator<Item = OsString>) -> Self {
        match parse_quick_action_args(args) {
            ParseOutcome::NotRequested => Self::NotRequested,
            ParseOutcome::Requested(result) => match result {
                Ok(request) => Self::Requested(request),
                Err(error) => Self::Invalid(error),
            },
        }
    }

    pub fn to_dto(&self) -> QuickActionStartupStateDto {
        match self {
            Self::NotRequested => QuickActionStartupStateDto {
                launched_for_quick_action: false,
                quick_action: None,
                quick_action_jobs: Vec::new(),
                error: None,
            },
            Self::Requested(request) => QuickActionStartupStateDto {
                launched_for_quick_action: true,
                quick_action: Some(request.clone()),
                quick_action_jobs: Vec::new(),
                error: None,
            },
            Self::StartedJobs(jobs) => QuickActionStartupStateDto {
                launched_for_quick_action: true,
                quick_action: None,
                quick_action_jobs: jobs.clone(),
                error: None,
            },
            Self::Invalid(error) => QuickActionStartupStateDto {
                launched_for_quick_action: true,
                quick_action: None,
                quick_action_jobs: Vec::new(),
                error: Some(error.to_dto()),
            },
        }
    }
}

#[derive(Clone, Debug)]
pub struct QuickActionLaunchCoordinator {
    inner: Arc<Mutex<QuickActionLaunchState>>,
}

#[derive(Debug)]
struct QuickActionLaunchState {
    startup: QuickActionStartupState,
    pending_creates: Vec<QuickActionRequestDto>,
    pending_generation: u64,
    flush_scheduled: bool,
}

impl QuickActionLaunchCoordinator {
    pub fn from_startup_state(state: QuickActionStartupState) -> Self {
        let coordinator = Self {
            inner: Arc::new(Mutex::new(QuickActionLaunchState {
                startup: QuickActionStartupState::NotRequested,
                pending_creates: Vec::new(),
                pending_generation: 0,
                flush_scheduled: false,
            })),
        };
        coordinator.ingest_startup_state(state);
        coordinator
    }

    pub fn startup_state(&self) -> QuickActionStartupState {
        if self.has_pending_creates() {
            thread::sleep(QUICK_ACTION_BURST_DEBOUNCE);
        }

        let mut inner = self.inner.lock().expect("quick-action lock poisoned");
        if let Some(request) = pop_pending_create(&mut inner) {
            return QuickActionStartupState::Requested(request);
        }

        std::mem::replace(&mut inner.startup, QuickActionStartupState::NotRequested)
    }

    pub fn ingest_secondary_process_args(
        &self,
        args: Vec<OsString>,
        app: AppHandle,
        registry: JobRegistry,
    ) {
        match QuickActionStartupState::from_process_or_user_args(args) {
            QuickActionStartupState::Requested(request) if is_create_quick_action(request.kind) => {
                self.add_pending_create(request);
                self.schedule_flush(app, registry);
            }
            state => {
                let _ = app.emit(QUICK_ACTION_EVENT, startup_state_to_dto(state, &registry));
            }
        }
    }

    fn ingest_startup_state(&self, state: QuickActionStartupState) {
        let mut inner = self.inner.lock().expect("quick-action lock poisoned");
        match state {
            QuickActionStartupState::Requested(request) if is_create_quick_action(request.kind) => {
                add_pending_create_locked(&mut inner, request);
            }
            other => {
                inner.startup = other;
            }
        }
    }

    fn has_pending_creates(&self) -> bool {
        !self
            .inner
            .lock()
            .expect("quick-action lock poisoned")
            .pending_creates
            .is_empty()
    }

    fn add_pending_create(&self, request: QuickActionRequestDto) {
        let mut inner = self.inner.lock().expect("quick-action lock poisoned");
        add_pending_create_locked(&mut inner, request);
    }

    fn schedule_flush(&self, app: AppHandle, registry: JobRegistry) {
        let coordinator = self.clone();
        let mut inner = self.inner.lock().expect("quick-action lock poisoned");
        if inner.flush_scheduled {
            return;
        }
        inner.flush_scheduled = true;
        let mut observed_generation = inner.pending_generation;
        drop(inner);

        thread::spawn(move || {
            loop {
                thread::sleep(QUICK_ACTION_BURST_DEBOUNCE);
                let requests = {
                    let mut inner = coordinator
                        .inner
                        .lock()
                        .expect("quick-action lock poisoned");
                    if inner.pending_generation != observed_generation {
                        observed_generation = inner.pending_generation;
                        continue;
                    }

                    inner.flush_scheduled = false;
                    drain_pending_creates(&mut inner)
                };

                for request in requests {
                    let state = QuickActionStartupState::Requested(request);
                    let _ = app.emit(QUICK_ACTION_EVENT, startup_state_to_dto(state, &registry));
                }
                break;
            }
        });
    }
}

pub fn startup_state_to_dto(
    state: QuickActionStartupState,
    registry: &JobRegistry,
) -> QuickActionStartupStateDto {
    match state {
        QuickActionStartupState::Requested(request) if is_direct_job_quick_action(request.kind) => {
            match start_direct_quick_action_jobs(&request, registry) {
                Ok(quick_action_jobs) => QuickActionStartupStateDto {
                    launched_for_quick_action: true,
                    quick_action: None,
                    quick_action_jobs,
                    error: None,
                },
                Err(error) => QuickActionStartupStateDto {
                    launched_for_quick_action: true,
                    quick_action: None,
                    quick_action_jobs: Vec::new(),
                    error: Some(QuickActionStartupErrorDto::from(error)),
                },
            }
        }
        other => other.to_dto(),
    }
}

pub fn prestart_direct_quick_action(
    state: QuickActionStartupState,
    registry: &JobRegistry,
) -> QuickActionStartupState {
    match state {
        QuickActionStartupState::Requested(request) if is_direct_job_quick_action(request.kind) => {
            match start_direct_quick_action_jobs(&request, registry) {
                Ok(jobs) => QuickActionStartupState::StartedJobs(jobs),
                Err(error) => QuickActionStartupState::Invalid(QuickActionError::from(error)),
            }
        }
        other => other,
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QuickActionError {
    code: &'static str,
    message: String,
    hint: Option<String>,
}

impl QuickActionError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: crate::constants::COMMAND_ERROR_INVALID_REQUEST,
            message: message.into(),
            hint: None,
        }
    }

    fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    fn to_dto(&self) -> QuickActionStartupErrorDto {
        QuickActionStartupErrorDto {
            code: self.code.to_string(),
            message: self.message.clone(),
            hint: self.hint.clone(),
        }
    }
}

impl From<CommandErrorDto> for QuickActionStartupErrorDto {
    fn from(error: CommandErrorDto) -> Self {
        Self {
            code: error.code.to_string(),
            message: error.message,
            hint: error.hint,
        }
    }
}

impl From<CommandErrorDto> for QuickActionError {
    fn from(error: CommandErrorDto) -> Self {
        Self {
            code: error.code,
            message: error.message,
            hint: error.hint,
        }
    }
}

enum ParseOutcome {
    NotRequested,
    Requested(Result<QuickActionRequestDto, QuickActionError>),
}

fn first_arg_is_executable_path(arg: Option<&OsString>) -> bool {
    let Some(arg) = arg.and_then(|value| value.to_str()) else {
        return false;
    };

    let path = Path::new(arg);
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
    {
        return true;
    }

    let Some(file_name) = path.file_name().and_then(|file_name| file_name.to_str()) else {
        return false;
    };

    if file_name.eq_ignore_ascii_case("zmanager-desktop")
        || file_name.eq_ignore_ascii_case("zmanager-desktop.exe")
    {
        return true;
    }

    std::env::current_exe()
        .ok()
        .and_then(|current_exe| current_exe.file_name().map(|name| name.to_owned()))
        .and_then(|current_exe_name| current_exe_name.to_str().map(str::to_owned))
        .is_some_and(|current_exe_name| current_exe_name == file_name)
}

fn is_create_quick_action(kind: QuickActionKindDto) -> bool {
    matches!(
        kind,
        QuickActionKindDto::Compress
            | QuickActionKindDto::CompressZip
            | QuickActionKindDto::CompressTzap
            | QuickActionKindDto::CompressSevenZ
            | QuickActionKindDto::CompressTarZst
            | QuickActionKindDto::CompressCleanSource
    )
}

pub fn is_direct_job_quick_action(kind: QuickActionKindDto) -> bool {
    matches!(
        kind,
        QuickActionKindDto::CompressZip
            | QuickActionKindDto::CompressTzap
            | QuickActionKindDto::CompressSevenZ
            | QuickActionKindDto::CompressTarZst
            | QuickActionKindDto::CompressCleanSource
            | QuickActionKindDto::ExtractHere
            | QuickActionKindDto::ExtractToFolder
    )
}

fn start_direct_quick_action_jobs(
    request: &QuickActionRequestDto,
    registry: &JobRegistry,
) -> Result<Vec<StartJobResponseDto>, CommandErrorDto> {
    match request.kind {
        QuickActionKindDto::CompressZip => {
            start_direct_create_job(request, ArchiveFormatDto::Zip, false, registry)
        }
        QuickActionKindDto::CompressTzap => {
            start_direct_create_job(request, ArchiveFormatDto::Tzap, false, registry)
        }
        QuickActionKindDto::CompressSevenZ => {
            start_direct_create_job(request, ArchiveFormatDto::SevenZ, false, registry)
        }
        QuickActionKindDto::CompressTarZst => {
            start_direct_create_job(request, ArchiveFormatDto::TarZst, false, registry)
        }
        QuickActionKindDto::CompressCleanSource => {
            start_direct_create_job(request, ArchiveFormatDto::TarZst, true, registry)
        }
        QuickActionKindDto::ExtractHere | QuickActionKindDto::ExtractToFolder => {
            start_direct_extract_jobs(request, registry)
        }
        _ => Ok(Vec::new()),
    }
}

fn start_direct_create_job(
    request: &QuickActionRequestDto,
    format: ArchiveFormatDto,
    clean_source: bool,
    registry: &JobRegistry,
) -> Result<Vec<StartJobResponseDto>, CommandErrorDto> {
    let sources = unique_paths(request.paths.clone());
    let destination_path = quick_create_destination(&sources, format).ok_or_else(|| {
        CommandErrorDto::invalid_request("compress quick actions require at least one path")
    })?;

    let response = start_create_internal(
        StartCreateRequest {
            sources,
            destination_path,
            format,
            clean_source,
            replace_existing: false,
            destination_collision_strategy: DestinationCollisionStrategyDto::Rename,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: true,
        },
        registry,
    )?;

    Ok(vec![response])
}

fn start_direct_extract_jobs(
    request: &QuickActionRequestDto,
    registry: &JobRegistry,
) -> Result<Vec<StartJobResponseDto>, CommandErrorDto> {
    let mut responses = Vec::new();
    let action = request.kind;
    for archive_path in unique_paths(request.paths.clone()) {
        let destination_path = quick_extract_destination(&archive_path, action).ok_or_else(|| {
            CommandErrorDto::invalid_request("extract quick actions require archive paths with parent folders")
        })?;

        let response = start_extract_internal(
            StartExtractRequest {
                archive_path,
                destination_path,
                password: None,
                overwrite: OverwritePolicyDto::Rename,
                destination_collision_strategy: if action == QuickActionKindDto::ExtractToFolder {
                    DestinationCollisionStrategyDto::Rename
                } else {
                    DestinationCollisionStrategyDto::Refuse
                },
                entry_paths: None,
                strip_components: 0,
            },
            registry,
        )?;
        responses.push(response);
    }

    Ok(responses)
}

fn add_pending_create_locked(inner: &mut QuickActionLaunchState, request: QuickActionRequestDto) {
    inner.pending_generation = inner.pending_generation.saturating_add(1);
    if let Some(existing) = inner
        .pending_creates
        .iter_mut()
        .find(|existing| existing.kind == request.kind)
    {
        append_unique_paths(&mut existing.paths, request.paths);
        return;
    }

    inner.pending_creates.push(QuickActionRequestDto {
        kind: request.kind,
        paths: unique_paths(request.paths),
    });
}

fn drain_pending_creates(inner: &mut QuickActionLaunchState) -> Vec<QuickActionRequestDto> {
    inner.pending_creates.drain(..).collect()
}

fn pop_pending_create(inner: &mut QuickActionLaunchState) -> Option<QuickActionRequestDto> {
    if inner.pending_creates.is_empty() {
        None
    } else {
        Some(inner.pending_creates.remove(0))
    }
}

fn append_unique_paths(target: &mut Vec<String>, paths: Vec<String>) {
    for path in paths {
        if !target.iter().any(|existing| existing == &path) {
            target.push(path);
        }
    }
}

fn unique_paths(paths: Vec<String>) -> Vec<String> {
    let mut unique = Vec::new();
    append_unique_paths(&mut unique, paths);
    unique
}

fn quick_create_destination(paths: &[String], format: ArchiveFormatDto) -> Option<String> {
    let first_path = paths.first()?.trim();
    if first_path.is_empty() {
        return None;
    }

    let output_directory = native_parent_path(first_path);
    let archive_name = suggested_create_archive_name(first_path, format);
    Some(join_native_path(output_directory, &archive_name))
}

fn suggested_create_archive_name(path: &str, format: ArchiveFormatDto) -> String {
    let source_name = native_file_name(path).unwrap_or("archive");
    let safe_name = sanitize_archive_name(source_name);
    format!("{safe_name}.{}", create_format_extension(format))
}

fn sanitize_archive_name(name: &str) -> String {
    let sanitized = name
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0'..='\u{1f}' => '_',
            _ => character,
        })
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized.is_empty() {
        "archive".to_string()
    } else {
        sanitized
    }
}

fn create_format_extension(format: ArchiveFormatDto) -> &'static str {
    match format {
        ArchiveFormatDto::Zip => "zip",
        ArchiveFormatDto::TarZst => "tzst",
        ArchiveFormatDto::Tzap => "tzap",
        ArchiveFormatDto::SevenZ => "7z",
    }
}

fn quick_extract_destination(path: &str, action: QuickActionKindDto) -> Option<String> {
    let parent = native_parent_path(path);
    match action {
        QuickActionKindDto::ExtractHere => Some(parent.to_string()),
        QuickActionKindDto::ExtractToFolder => {
            let folder_name = archive_base_name_without_known_extension(path)?;
            Some(join_native_path(parent, &folder_name))
        }
        _ => None,
    }
}

fn archive_base_name_without_known_extension(path: &str) -> Option<String> {
    let name = native_file_name(path)?.trim();
    if name.is_empty() {
        return None;
    }

    let lower_name = name.to_ascii_lowercase();
    if let Some(marker_index) = tzap_volume_marker_index(&lower_name) {
        return Some(name[..marker_index].to_string());
    }

    let mut suffixes = crate::archive_file_types::compound_extensions()
        .iter()
        .map(|extension| format!(".{extension}"))
        .chain(
            crate::archive_file_types::single_extensions()
                .iter()
                .map(|extension| format!(".{extension}")),
        )
        .collect::<Vec<_>>();
    suffixes.sort_by_key(|suffix| std::cmp::Reverse(suffix.len()));

    for suffix in suffixes {
        if lower_name.ends_with(&suffix) && name.len() > suffix.len() {
            return Some(name[..name.len() - suffix.len()].to_string());
        }
    }

    Some(name.to_string())
}

fn tzap_volume_marker_index(lower_name: &str) -> Option<usize> {
    if !lower_name.ends_with(TZAP_EXTENSION_SUFFIX) {
        return None;
    }

    let stem = &lower_name[..lower_name.len() - TZAP_EXTENSION_SUFFIX.len()];
    let marker_index = stem.rfind(TZAP_VOLUME_MARKER)?;
    let digits = &stem[marker_index + TZAP_VOLUME_MARKER.len()..];
    if marker_index > 0 && !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit()) {
        Some(marker_index)
    } else {
        None
    }
}

fn native_parent_path(path: &str) -> &str {
    match path.rfind(|character| character == '/' || character == '\\') {
        Some(index) if index > 0 => &path[..index],
        Some(0) => &path[..1],
        _ => "",
    }
}

fn native_file_name(path: &str) -> Option<&str> {
    path.rsplit(['/', '\\']).find(|part| !part.is_empty())
}

fn join_native_path(parent: &str, child: &str) -> String {
    let parent = parent.trim_end_matches(|character| character == '/' || character == '\\');
    if parent.is_empty() {
        return child.to_string();
    }

    let separator = if parent.contains('\\') || parent.ends_with(':') { '\\' } else { '/' };
    format!("{parent}{separator}{child}")
}

pub fn is_supported_archive_path(path: &str) -> bool {
    let name = path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(path)
        .to_ascii_lowercase();

    if is_tzap_volume_archive_name(&name) {
        return true;
    }

    if crate::archive_file_types::split_archive_suffixes()
        .iter()
        .any(|suffix| name.ends_with(suffix.as_str()))
    {
        return true;
    }

    if crate::archive_file_types::compound_extensions()
        .iter()
        .any(|extension| name.ends_with(&format!(".{extension}")))
    {
        return true;
    }

    let Some(extension) = name.rsplit_once('.').map(|(_, extension)| extension) else {
        return false;
    };

    crate::archive_file_types::single_extensions()
        .iter()
        .any(|supported_extension| supported_extension == extension)
}

fn parse_quick_action_args(args: impl IntoIterator<Item = OsString>) -> ParseOutcome {
    let mut requested = false;
    let mut kind: Option<Result<QuickActionKindDto, QuickActionError>> = None;
    let mut paths = Vec::new();
    let mut request_file_path: Option<String> = None;
    let mut pending_path_values = false;
    let mut pending_request_file_value = false;
    let mut saw_unknown_option = false;
    let mut ordinary_open_paths = Vec::new();

    for arg in args {
        let arg = match arg.into_string() {
            Ok(value) => value,
            Err(_) => {
                return ParseOutcome::Requested(Err(QuickActionError::invalid(
                    "quick-action arguments must be valid Unicode",
                )));
            }
        };

        if is_password_arg(&arg) {
            return ParseOutcome::Requested(Err(QuickActionError::invalid(
                "passwords cannot be supplied through quick-action arguments",
            )));
        }

        if let Some(value) = arg.strip_prefix("--quick-action=") {
            requested = true;
            kind = Some(parse_kind(value));
            pending_path_values = false;
            continue;
        }

        if let Some(value) = arg.strip_prefix("--action=") {
            requested = true;
            kind = Some(parse_kind(value));
            pending_path_values = false;
            pending_request_file_value = false;
            continue;
        }

        if let Some(value) = arg.strip_prefix("--quick-action-request=") {
            requested = true;
            request_file_path = Some(value.to_string());
            pending_path_values = false;
            pending_request_file_value = false;
            continue;
        }

        if arg == QUICK_ACTION_ARG || arg == QUICK_ACTION_ARG_ALIAS {
            requested = true;
            kind = Some(Err(QuickActionError::invalid(
                "--quick-action requires an action value",
            )));
            pending_path_values = false;
            pending_request_file_value = false;
            continue;
        }

        if arg == QUICK_ACTION_REQUEST_ARG {
            requested = true;
            pending_request_file_value = true;
            pending_path_values = false;
            continue;
        }

        if arg == PATH_ARG {
            requested = true;
            pending_path_values = true;
            pending_request_file_value = false;
            continue;
        }

        if arg.starts_with("--") {
            pending_path_values = false;
            pending_request_file_value = false;
            if !requested {
                saw_unknown_option = true;
            }
            continue;
        }

        if requested {
            if pending_request_file_value {
                request_file_path = Some(arg);
                pending_request_file_value = false;
            } else if matches!(kind, Some(Err(_))) {
                kind = Some(parse_kind(&arg));
            } else if pending_path_values {
                paths.push(arg);
            }
        } else if !saw_unknown_option {
            ordinary_open_paths.push(arg);
        }
    }

    if !requested {
        if ordinary_open_paths.is_empty() {
            return ParseOutcome::NotRequested;
        }

        return ParseOutcome::Requested(validate_request(
            QuickActionKindDto::Open,
            ordinary_open_paths,
        ));
    }

    if pending_request_file_value {
        return ParseOutcome::Requested(Err(QuickActionError::invalid(
            "--quick-action-request requires a file path",
        )));
    }

    if let Some(request_file_path) = request_file_path {
        return ParseOutcome::Requested(read_quick_action_request_file(&request_file_path));
    }

    let kind = match kind.unwrap_or_else(|| {
        Err(QuickActionError::invalid(
            "--quick-action is required for quick-action launches",
        ))
    }) {
        Ok(kind) => kind,
        Err(error) => return ParseOutcome::Requested(Err(error)),
    };

    ParseOutcome::Requested(validate_request(kind, paths))
}

fn read_quick_action_request_file(
    request_file_path: &str,
) -> Result<QuickActionRequestDto, QuickActionError> {
    let trimmed_path = request_file_path.trim();
    if trimmed_path.is_empty() {
        return Err(QuickActionError::invalid(
            "--quick-action-request requires a file path",
        ));
    }
    if trimmed_path.contains("://") {
        return Err(QuickActionError::invalid(format!(
            "quick-action request path must be local: {trimmed_path}"
        )));
    }

    let content = fs::read_to_string(trimmed_path).map_err(|error| {
        QuickActionError::invalid(format!("unable to read quick-action request: {error}"))
    })?;
    let request = serde_json::from_str::<QuickActionRequestDto>(&content).map_err(|error| {
        QuickActionError::invalid(format!("invalid quick-action request JSON: {error}"))
    })?;
    validate_request(request.kind, request.paths)
}

fn parse_kind(value: &str) -> Result<QuickActionKindDto, QuickActionError> {
    let normalized = value
        .trim()
        .chars()
        .filter(|character| *character != '-' && *character != '_' && *character != ' ')
        .flat_map(char::to_lowercase)
        .collect::<String>();

    match normalized.as_str() {
        "compress" => Ok(QuickActionKindDto::Compress),
        "open" | "browse" => Ok(QuickActionKindDto::Open),
        "extract" => Ok(QuickActionKindDto::Extract),
        "compresszip" | "addtozip" => Ok(QuickActionKindDto::CompressZip),
        "compresstzap" | "addtotzap" => Ok(QuickActionKindDto::CompressTzap),
        "compress7z" | "compresssevenz" | "addto7z" | "addtosevenz" => {
            Ok(QuickActionKindDto::CompressSevenZ)
        }
        "compresstarzst" | "compresstzst" | "addtotarzst" | "addtotzst" => {
            Ok(QuickActionKindDto::CompressTarZst)
        }
        "compresscleansource" | "cleansource" => Ok(QuickActionKindDto::CompressCleanSource),
        "extracthere" => Ok(QuickActionKindDto::ExtractHere),
        "extracttofolder" | "extractfolder" => Ok(QuickActionKindDto::ExtractToFolder),
        _ => Err(
            QuickActionError::invalid(format!("unknown quick action: {value}"))
                .with_hint("Use compress or extract."),
        ),
    }
}

fn validate_request(
    kind: QuickActionKindDto,
    paths: Vec<String>,
) -> Result<QuickActionRequestDto, QuickActionError> {
    let paths = normalize_local_paths(paths)?;

    match kind {
        QuickActionKindDto::Open => {
            if paths.len() != 1 {
                return Err(QuickActionError::invalid(
                    "open requires exactly one archive path",
                ));
            }
            validate_all_supported_archives(&paths)?;
        }
        QuickActionKindDto::Compress
        | QuickActionKindDto::CompressZip
        | QuickActionKindDto::CompressTzap
        | QuickActionKindDto::CompressSevenZ
        | QuickActionKindDto::CompressTarZst
        | QuickActionKindDto::CompressCleanSource => {
            if paths.is_empty() {
                return Err(QuickActionError::invalid(
                    "compress quick actions require at least one path",
                ));
            }
        }
        QuickActionKindDto::Extract => {
            if paths.is_empty() {
                return Err(QuickActionError::invalid(
                    "extract quick actions require at least one archive path",
                ));
            }
            validate_all_supported_archives(&paths)?;
        }
        QuickActionKindDto::ExtractHere => {
            if paths.is_empty() {
                return Err(QuickActionError::invalid(
                    "extract-here requires at least one archive path",
                ));
            }
            validate_all_supported_archives(&paths)?;
        }
        QuickActionKindDto::ExtractToFolder => {
            if paths.len() != 1 {
                return Err(QuickActionError::invalid(
                    "extract-to-folder requires exactly one archive path",
                ));
            }
            validate_all_supported_archives(&paths)?;
        }
    }

    Ok(QuickActionRequestDto { kind, paths })
}

fn normalize_local_paths(paths: Vec<String>) -> Result<Vec<String>, QuickActionError> {
    let mut normalized = Vec::new();

    for path in paths {
        let path = path.trim();
        if path.is_empty() {
            continue;
        }

        let path = normalize_local_path(path)?;
        normalized.push(path);
    }

    Ok(normalized)
}

fn normalize_local_path(path: &str) -> Result<String, QuickActionError> {
    if path.contains("://") {
        let url = Url::parse(path).map_err(|_| {
            QuickActionError::invalid(format!("quick-action path must be local: {path}"))
        })?;
        if url.scheme() != "file" {
            return Err(QuickActionError::invalid(format!(
                "quick-action path must be local: {path}"
            )));
        }

        return url
            .to_file_path()
            .map(|path| path.to_string_lossy().to_string())
            .map_err(|_| {
                QuickActionError::invalid(format!("quick-action path must be local: {path}"))
            });
    }

    Ok(path.to_string())
}

fn validate_all_supported_archives(paths: &[String]) -> Result<(), QuickActionError> {
    for path in paths {
        if !is_supported_archive_path(path) {
            return Err(QuickActionError::invalid(format!(
                "unsupported archive for quick action: {path}"
            )));
        }
    }

    Ok(())
}

fn is_password_arg(arg: &str) -> bool {
    PASSWORD_ARG_PREFIXES
        .iter()
        .any(|prefix| arg == *prefix || arg.starts_with(&format!("{prefix}=")))
}

fn is_tzap_volume_archive_name(name: &str) -> bool {
    base_name_without_tzap_volume_suffix(name).is_some()
}

fn base_name_without_tzap_volume_suffix(name: &str) -> Option<&str> {
    if !name.ends_with(TZAP_EXTENSION_SUFFIX) {
        return None;
    }

    let stem = &name[..name.len() - TZAP_EXTENSION_SUFFIX.len()];
    let marker_index = stem.rfind(TZAP_VOLUME_MARKER)?;
    let base_name = &stem[..marker_index];
    let digits = &stem[marker_index + TZAP_VOLUME_MARKER.len()..];
    if base_name.is_empty()
        || digits.is_empty()
        || !digits.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }

    Some(base_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::job_dto::{JobStatusDto, PollJobEventsResponseDto};
    use crate::job_registry::JobRegistry;
    use std::fs;
    use std::path::PathBuf;
    use std::time::Duration;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn state_from_args(args: &[&str]) -> QuickActionStartupState {
        QuickActionStartupState::from_args(args.iter().map(OsString::from))
    }

    fn requested(args: &[&str]) -> QuickActionRequestDto {
        match state_from_args(args) {
            QuickActionStartupState::Requested(request) => request,
            other => panic!("expected requested quick action, got {other:?}"),
        }
    }

    fn invalid(args: &[&str]) -> QuickActionError {
        match state_from_args(args) {
            QuickActionStartupState::Invalid(error) => error,
            other => panic!("expected invalid quick action, got {other:?}"),
        }
    }

    fn unique_temp_file(name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("zmanager-{name}-{nanos}.json"))
    }

    fn create_temp_workspace(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let base = std::env::temp_dir().join(format!("zmanager-quick-action-{name}-{nanos}"));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("temporary workspace should be created");
        base
    }

    fn wait_for_job_terminal(
        registry: &JobRegistry,
        job_id: &str,
    ) -> PollJobEventsResponseDto {
        for _ in 0..400 {
            let poll = registry
                .poll_events(job_id)
                .expect("job should stay available while waiting for terminal state");
            if poll.status.is_terminal() {
                return poll;
            }
            std::thread::sleep(Duration::from_millis(25));
        }

        panic!("timed out while waiting for job to complete");
    }

    fn empty_coordinator() -> QuickActionLaunchCoordinator {
        QuickActionLaunchCoordinator {
            inner: Arc::new(Mutex::new(QuickActionLaunchState {
                startup: QuickActionStartupState::NotRequested,
                pending_creates: Vec::new(),
                pending_generation: 0,
                flush_scheduled: false,
            })),
        }
    }

    #[test]
    fn parse_without_quick_action_is_not_requested() {
        assert_eq!(
            state_from_args(&["--ordinary-open", "C:/tmp/archive.zip"]),
            QuickActionStartupState::NotRequested
        );
    }

    #[test]
    fn parse_plain_supported_archive_arg_as_open_request() {
        let request = requested(&["C:/tmp/archive.tzap"]);

        assert_eq!(request.kind, QuickActionKindDto::Open);
        assert_eq!(request.paths, ["C:/tmp/archive.tzap"]);
    }

    #[test]
    fn parse_file_uri_archive_arg_as_open_request() {
        let request = requested(&["file:///home/frank/Documents/beeware-tutorial.tzap"]);

        assert_eq!(request.kind, QuickActionKindDto::Open);
        assert_eq!(
            request.paths,
            ["/home/frank/Documents/beeware-tutorial.tzap"]
        );
    }

    #[test]
    fn parse_secondary_process_args_ignores_linux_executable_argv() {
        let state = QuickActionStartupState::from_process_or_user_args(
            [
                "/usr/bin/zmanager-desktop",
                "file:///home/frank/Documents/beeware-tutorial.tzap",
            ]
            .into_iter()
            .map(OsString::from)
            .collect(),
        );

        let QuickActionStartupState::Requested(request) = state else {
            panic!("expected open request from secondary process args, got {state:?}");
        };

        assert_eq!(request.kind, QuickActionKindDto::Open);
        assert_eq!(
            request.paths,
            ["/home/frank/Documents/beeware-tutorial.tzap"]
        );
    }

    #[test]
    fn parse_accepts_kebab_and_camel_case_actions() {
        let preferred_compress = requested(&[
            "--quick-action",
            "compress",
            "--path",
            "C:/tmp/source one",
            "C:/tmp/source two",
        ]);
        assert_eq!(preferred_compress.kind, QuickActionKindDto::Compress);
        assert_eq!(
            preferred_compress.paths,
            ["C:/tmp/source one", "C:/tmp/source two"]
        );

        let preferred_extract =
            requested(&["--quick-action=extract", "--path", "C:/tmp/archive.tar.zst"]);
        assert_eq!(preferred_extract.kind, QuickActionKindDto::Extract);
        assert_eq!(preferred_extract.paths, ["C:/tmp/archive.tar.zst"]);

        let compress = requested(&[
            "--quick-action",
            "compress-zip",
            "--path",
            "C:/tmp/source one",
            "C:/tmp/source two",
        ]);
        assert_eq!(compress.kind, QuickActionKindDto::CompressZip);
        assert_eq!(compress.paths, ["C:/tmp/source one", "C:/tmp/source two"]);

        let compress_tzap =
            requested(&["--quick-action", "compress-tzap", "--path", "C:/tmp/source"]);
        assert_eq!(compress_tzap.kind, QuickActionKindDto::CompressTzap);

        let compress_seven_z =
            requested(&["--quick-action", "compress-7z", "--path", "C:/tmp/source"]);
        assert_eq!(compress_seven_z.kind, QuickActionKindDto::CompressSevenZ);

        let compress_tzst =
            requested(&["--quick-action", "compress-tzst", "--path", "C:/tmp/source"]);
        assert_eq!(compress_tzst.kind, QuickActionKindDto::CompressTarZst);

        let unknown_option_compress = requested(&[
            "--quick-action",
            "compress-tzap",
            "--ignored-shell-option",
            "--path",
            "C:/tmp/source",
        ]);
        assert_eq!(
            unknown_option_compress.kind,
            QuickActionKindDto::CompressTzap
        );
        assert_eq!(unknown_option_compress.paths, ["C:/tmp/source"]);

        let extract = requested(&[
            "--quick-action=extractToFolder",
            "--path",
            "C:/tmp/archive.tar.zst",
        ]);
        assert_eq!(extract.kind, QuickActionKindDto::ExtractToFolder);
        assert_eq!(extract.paths, ["C:/tmp/archive.tar.zst"]);
    }

    #[test]
    fn parse_accepts_repeated_path_groups() {
        let request = requested(&[
            "--quick-action",
            "extract-here",
            "--path",
            "C:/tmp/one.zip",
            "--path",
            "C:/tmp/two.tzap",
        ]);

        assert_eq!(request.kind, QuickActionKindDto::ExtractHere);
        assert_eq!(request.paths, ["C:/tmp/one.zip", "C:/tmp/two.tzap"]);
    }

    #[test]
    fn parse_accepts_structured_quick_action_request_file() {
        let request_path = unique_temp_file("quick-action-request");
        std::fs::write(
            &request_path,
            r#"{"kind":"compressZip","paths":["C:/tmp/source one","C:/tmp/source two"]}"#,
        )
        .expect("quick-action request fixture should write");

        let request_path_text = request_path.to_string_lossy().to_string();
        let request = requested(&["--quick-action-request", &request_path_text]);

        assert_eq!(request.kind, QuickActionKindDto::CompressZip);
        assert_eq!(request.paths, ["C:/tmp/source one", "C:/tmp/source two"]);
        let _ = std::fs::remove_file(request_path);
    }

    #[test]
    fn startup_coordinator_coalesces_create_launches_by_action() {
        let coordinator = empty_coordinator();
        coordinator.ingest_startup_state(QuickActionStartupState::Requested(
            QuickActionRequestDto {
                kind: QuickActionKindDto::CompressZip,
                paths: vec!["C:/tmp/one".to_string()],
            },
        ));
        coordinator.ingest_startup_state(QuickActionStartupState::Requested(
            QuickActionRequestDto {
                kind: QuickActionKindDto::CompressZip,
                paths: vec!["C:/tmp/two".to_string(), "C:/tmp/one".to_string()],
            },
        ));

        let request = match coordinator.startup_state() {
            QuickActionStartupState::Requested(request) => request,
            other => panic!("expected coalesced create request, got {other:?}"),
        };

        assert_eq!(request.kind, QuickActionKindDto::CompressZip);
        assert_eq!(request.paths, ["C:/tmp/one", "C:/tmp/two"]);
        assert_eq!(
            coordinator.startup_state(),
            QuickActionStartupState::NotRequested
        );
    }

    #[test]
    fn startup_coordinator_returns_mixed_create_launches_without_dropping_later_actions() {
        let coordinator = empty_coordinator();
        coordinator.ingest_startup_state(QuickActionStartupState::Requested(
            QuickActionRequestDto {
                kind: QuickActionKindDto::CompressZip,
                paths: vec!["C:/tmp/one".to_string()],
            },
        ));
        coordinator.ingest_startup_state(QuickActionStartupState::Requested(
            QuickActionRequestDto {
                kind: QuickActionKindDto::CompressTzap,
                paths: vec!["C:/tmp/two".to_string()],
            },
        ));

        let first = match coordinator.startup_state() {
            QuickActionStartupState::Requested(request) => request,
            other => panic!("expected first create request, got {other:?}"),
        };
        let second = match coordinator.startup_state() {
            QuickActionStartupState::Requested(request) => request,
            other => panic!("expected second create request, got {other:?}"),
        };

        assert_eq!(first.kind, QuickActionKindDto::CompressZip);
        assert_eq!(first.paths, ["C:/tmp/one"]);
        assert_eq!(second.kind, QuickActionKindDto::CompressTzap);
        assert_eq!(second.paths, ["C:/tmp/two"]);
        assert_eq!(
            coordinator.startup_state(),
            QuickActionStartupState::NotRequested
        );
    }

    #[test]
    fn structured_quick_action_request_file_uses_normal_validation() {
        let request_path = unique_temp_file("invalid-quick-action-request");
        std::fs::write(
            &request_path,
            r#"{"kind":"extractHere","paths":["C:/tmp/notes.txt"]}"#,
        )
        .expect("invalid quick-action request fixture should write");

        let request_path_text = request_path.to_string_lossy().to_string();
        let error = invalid(&["--quick-action-request", &request_path_text]);

        assert!(error.message.contains("unsupported archive"));
        let _ = std::fs::remove_file(request_path);
    }

    #[test]
    fn compress_actions_require_at_least_one_local_path() {
        assert_eq!(
            invalid(&["--quick-action", "compress-zip"]).message,
            "compress quick actions require at least one path"
        );

        let request = requested(&[
            "--quick-action",
            "compress-clean-source",
            "--path",
            "notes.txt",
        ]);
        assert_eq!(request.kind, QuickActionKindDto::CompressCleanSource);
        assert_eq!(request.paths, ["notes.txt"]);
    }

    #[test]
    fn extract_here_accepts_multiple_supported_archives() {
        let request = requested(&[
            "--quick-action",
            "extract",
            "--path",
            "first.zip",
            "second.tar",
            "third.vol001.tzap",
        ]);

        assert_eq!(request.kind, QuickActionKindDto::Extract);
        assert_eq!(
            request.paths,
            ["first.zip", "second.tar", "third.vol001.tzap"]
        );
    }

    #[test]
    fn extract_actions_reject_unsupported_archives() {
        let error = invalid(&["--quick-action", "extract", "--path", "notes.txt"]);

        assert_eq!(error.code, crate::constants::COMMAND_ERROR_INVALID_REQUEST);
        assert!(error.message.contains("unsupported archive"));
    }

    #[test]
    fn extract_to_folder_accepts_exactly_one_archive() {
        let request = requested(&[
            "--quick-action",
            "extract-to-folder",
            "--path",
            "archive.7z.001",
        ]);
        assert_eq!(request.kind, QuickActionKindDto::ExtractToFolder);

        assert_eq!(
            invalid(&[
                "--quick-action",
                "extract-to-folder",
                "--path",
                "one.zip",
                "two.zip",
            ])
            .message,
            "extract-to-folder requires exactly one archive path"
        );
    }

    #[test]
    fn quick_actions_reject_remote_urls_and_password_args() {
        assert!(
            invalid(&[
                "--quick-action",
                "compress-zip",
                "--path",
                "https://example.com/a"
            ])
            .message
            .contains("must be local")
        );
        assert!(
            invalid(&[
                "--quick-action",
                "extract",
                "--password",
                "secret",
                "--path",
                "archive.zip",
            ])
            .message
            .contains("passwords cannot be supplied")
        );
    }

    #[test]
    fn supported_archive_detection_matches_macos_contract() {
        for path in [
            "archive.zip",
            "archive.ZIP",
            "archive.tar",
            "archive.tzap",
            "archive.vol000.tzap",
            "archive.vol001.tzap",
            "archive.tzst",
            "archive.tar.zst",
            "archive.tar.lzma",
            "archive.tar.Z",
            "archive.7z",
            "archive.7z.001",
            "archive.rar",
            "archive.deb",
            "archive.iso",
            r"C:\tmp\bundle.TAR.GZ",
        ] {
            assert!(
                is_supported_archive_path(path),
                "{path} should be supported"
            );
        }

        for path in [
            "notes.txt",
            "image.png",
            "archive",
            "archive.zmanager",
            "archive.7z.002",
            "archive.z01",
        ] {
            assert!(
                !is_supported_archive_path(path),
                "{path} should not be supported"
            );
        }
    }

    #[test]
    fn startup_state_starts_tzap_create_job_and_writes_archive() {
        let workspace = create_temp_workspace("tzap-create");
        let source = workspace.join("note.txt");
        fs::write(&source, b"quick action tzap").expect("source should be written");
        let registry = JobRegistry::new();

        let prestarted = prestart_direct_quick_action(
            QuickActionStartupState::Requested(QuickActionRequestDto {
                kind: QuickActionKindDto::CompressTzap,
                paths: vec![source.to_string_lossy().to_string()],
            }),
            &registry,
        );
        let response = startup_state_to_dto(prestarted, &registry);

        assert!(response.launched_for_quick_action);
        assert!(response.error.is_none());
        assert!(response.quick_action.is_none());
        assert_eq!(response.quick_action_jobs.len(), 1);

        let terminal = wait_for_job_terminal(&registry, &response.quick_action_jobs[0].job_id);
        assert_eq!(terminal.status, JobStatusDto::Completed);
        assert!(
            workspace.join("note.txt.tzap").exists(),
            "direct quick action should write the expected archive"
        );

        let _ = fs::remove_dir_all(workspace);
    }

    #[test]
    fn startup_state_starts_extract_here_job_and_writes_file() {
        let workspace = create_temp_workspace("extract-here");
        let source = workspace.join("payload.txt");
        fs::write(&source, b"quick action extract").expect("source should be written");
        let registry = JobRegistry::new();

        let create_response = startup_state_to_dto(
            QuickActionStartupState::Requested(QuickActionRequestDto {
                kind: QuickActionKindDto::CompressZip,
                paths: vec![source.to_string_lossy().to_string()],
            }),
            &registry,
        );
        let create_job = create_response
            .quick_action_jobs
            .first()
            .expect("zip create job should be started");
        let create_terminal = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_terminal.status, JobStatusDto::Completed);

        fs::remove_file(&source).expect("source should be removed before extract");
        let archive = workspace.join("payload.txt.zip");
        assert!(archive.exists(), "zip quick action should create archive");

        let extract_response = startup_state_to_dto(
            QuickActionStartupState::Requested(QuickActionRequestDto {
                kind: QuickActionKindDto::ExtractHere,
                paths: vec![archive.to_string_lossy().to_string()],
            }),
            &registry,
        );
        let extract_job = extract_response
            .quick_action_jobs
            .first()
            .expect("extract-here job should be started");
        let extract_terminal = wait_for_job_terminal(&registry, &extract_job.job_id);
        assert_eq!(extract_terminal.status, JobStatusDto::Completed);
        assert_eq!(
            fs::read(&source).expect("extracted file should exist"),
            b"quick action extract"
        );

        let _ = fs::remove_dir_all(workspace);
    }
}
