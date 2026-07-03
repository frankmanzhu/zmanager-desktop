use std::collections::HashSet;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use tauri::State;

use crate::{
    constants,
    dto::{
        ArchiveEntryDto, ArchiveEntryKindDto, ArchiveListingResponse, CreatePlanResponse,
        DestinationCollisionStrategyDto, NativeFileDragOutcomeDto, NativeFileDragRequest,
        NativeFileDragResponse, PauseJobRequest, PlanCreateRequest, PollJobEventsRequest,
        PreviewEntryRequest, PreviewEntryResponse, ProjectContract, ProjectIntegrationContract,
        ProjectIntegrationShellActionDto, ResumeJobRequest, StartCreateRequest,
        StartExtractRequest, SystemFileIconRequest, SystemFileIconResponse, TestArchiveRequest,
    },
    error::{CommandErrorDto, ErrorSeverityDto},
    job_dto::{
        JobControlResponseDto, JobEventDto, JobEventKindDto, JobKindDto, JobTerminalSummaryDto,
        PollJobEventsResponseDto, StartJobResponseDto,
    },
    job_registry::{JobEventCollector, JobRegistry},
    quick_action::QuickActionLaunchCoordinator,
};
use zmanager_core::archive_browser::{
    self, ArchiveBrowserError, BrowserExtractOptions, BrowserListOptions,
};
use zmanager_core::jobs::{
    CancellationToken, run_7z_create_job_from_sources_with_plan_options,
    run_7z_extract_job_with_password_and_policy,
    run_libarchive_extract_job_with_password_and_policy,
    run_rar_extract_job_with_password_and_policy,
    run_tar_zst_create_job_from_sources_with_plan_options, run_tar_zst_extract_job_with_policy,
    run_tzap_create_job_from_sources_with_plan_options,
    run_tzap_extract_job_with_password_and_policy,
    run_zip_create_job_from_sources_with_plan_options,
    run_zip_extract_job_with_password_and_policy,
};
use zmanager_core::libarchive_backend::LibarchiveError;
use zmanager_core::manifest::{PlanError, PlanOptions, plan_archives};
use zmanager_core::rar_backend::RarBackendError;
use zmanager_core::raw_stream_backend::RawStreamError;
use zmanager_core::safety::{ExtractionPolicy, OverwritePolicy, UnsafeFilePolicy};
use zmanager_core::secrets::SecretString;
use zmanager_core::sevenz_backend::{SevenZCreateOptions, SevenZCreateReport, SevenZError};
use zmanager_core::tar_zst_backend::{TarZstdCreateOptions, TarZstdCreateReport};
use zmanager_core::tzap_backend::{TzapCreateOptions, TzapCreateReport, TzapError, TzapKeySource};
use zmanager_core::zip_backend::{ZipBackendError, ZipCreateOptions, ZipCreateReport};

#[tauri::command]
pub fn healthcheck() -> crate::dto::HealthcheckResponse {
    let report = zmanager_core::healthcheck();
    crate::dto::HealthcheckResponse {
        engine: report.engine,
        version: report.version,
        ready: report.ready,
        summary: report.summary(),
        shell: constants::DESKTOP_SHELL_NAME,
        status: if report.ready { "ready" } else { "not-ready" },
    }
}

#[tauri::command]
pub fn project_contract() -> crate::dto::ProjectContract {
    let integration = crate::platform::integration_profile();

    ProjectContract {
        commands: constants::PLANNED_COMMANDS,
        platform_strategy: constants::PLATFORM_STRATEGY,
        core_dependency: constants::CORE_DEPENDENCY,
        platform_integration: ProjectIntegrationContract {
            platform: integration.platform,
            explorer_integration_enabled: integration.explorer_integration_enabled,
            desktop_actions_enabled: integration.desktop_actions_enabled,
            associated_extensions: integration.associated_extensions,
            shell_actions: integration
                .shell_actions
                .iter()
                .map(|action| ProjectIntegrationShellActionDto {
                    label: action.label,
                    quick_action: action.quick_action,
                })
                .collect(),
        },
    }
}

#[tauri::command]
pub fn system_file_icons(request: SystemFileIconRequest) -> SystemFileIconResponse {
    SystemFileIconResponse {
        icons: crate::platform::system_file_icons(&request.entries),
    }
}

#[tauri::command]
pub fn quick_action_startup_state(
    state: State<'_, QuickActionLaunchCoordinator>,
    registry: State<'_, JobRegistry>,
) -> crate::dto::QuickActionStartupStateDto {
    crate::quick_action::startup_state_to_dto(state.startup_state(), &registry)
}

#[cfg(test)]
fn quick_action_startup_state_internal(
    state: &crate::quick_action::QuickActionStartupState,
    registry: &JobRegistry,
) -> crate::dto::QuickActionStartupStateDto {
    crate::quick_action::startup_state_to_dto(state.clone(), registry)
}

#[tauri::command]
pub fn list_archive(
    request: crate::dto::ListArchiveRequest,
) -> Result<ArchiveListingResponse, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;

    let listing = archive_browser::list_entries_with_options(
        Path::new(&archive_path),
        BrowserListOptions {
            password: request.password.as_deref(),
        },
    )
    .map_err(map_archive_browser_error)?;

    let mut total_size = 0u64;
    let mut has_size = false;
    let mut entries = Vec::with_capacity(listing.entries.len());
    let entry_count = listing.entries.len();

    for entry in listing.entries {
        if let Some(size) = entry.size {
            total_size = total_size.saturating_add(size);
            has_size = true;
        }

        entries.push(ArchiveEntryDto {
            path: entry.path,
            kind: map_browser_entry_kind(entry.kind),
            size: entry.size,
            compressed_size: entry.compressed_size,
            modified: entry.modified,
        });
    }

    Ok(ArchiveListingResponse {
        archive_path,
        entries,
        entry_count,
        total_size: if has_size { Some(total_size) } else { None },
    })
}

#[tauri::command]
pub fn plan_create(request: PlanCreateRequest) -> Result<CreatePlanResponse, CommandErrorDto> {
    let sources = normalize_non_empty_paths(&request.sources)?;

    let mut options = if request.clean_source {
        PlanOptions::clean_source()
    } else {
        PlanOptions::default()
    };
    options.respect_gitignore = request.respect_gitignore;
    options.exclude_names = request.exclude_names.unwrap_or_default();
    options.exclude_archive_paths = request.exclude_archive_paths.unwrap_or_default();
    options.include_archive_paths = request.include_archive_paths.unwrap_or_default();
    options.follow_symlinks = request.follow_symlinks;

    let manifest = plan_archives(sources, &options).map_err(map_plan_error)?;
    let included_count = manifest.included_count();
    let excluded_count = manifest.excluded_count();
    let entries = manifest
        .entries
        .into_iter()
        .map(|entry| entry.archive_path)
        .collect();
    let excluded_entries = manifest
        .excluded_entries
        .into_iter()
        .map(|entry| entry.archive_path)
        .collect();
    let warnings = manifest
        .warnings
        .into_iter()
        .map(|warning| warning.message)
        .collect();

    Ok(CreatePlanResponse {
        included_count,
        excluded_count,
        total_bytes: manifest.total_bytes,
        excluded_bytes: manifest.excluded_bytes,
        entries,
        excluded_entries,
        warnings,
    })
}

#[tauri::command]
pub fn start_create(
    request: StartCreateRequest,
    registry: State<'_, JobRegistry>,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    start_create_internal(request, &registry)
}

pub(crate) fn start_create_internal(
    request: StartCreateRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    let sources = normalize_non_empty_paths(&request.sources)?;
    let requested_destination_path =
        ensure_non_empty_path(request.destination_path, "destinationPath")?
            .trim()
            .to_string();
    let destination_path = if request.destination_collision_strategy
        == DestinationCollisionStrategyDto::Rename
        && !request.replace_existing
    {
        next_available_destination_path(&requested_destination_path)
    } else {
        requested_destination_path
    };

    if destination_path.ends_with('/') || destination_path.ends_with('\\') {
        return Err(CommandErrorDto::invalid_request(
            "destinationPath must include a file name, not just a directory",
        ));
    }

    let destination_path = ensure_non_empty_path(destination_path, "destinationPath")?;
    if let Ok(metadata) = std::fs::metadata(&destination_path) {
        if metadata.is_dir() {
            return Err(CommandErrorDto::invalid_request(format!(
                "destinationPath must be a file path, not a directory: {destination_path}"
            )));
        }
    } else {
        let parent = Path::new(&destination_path)
            .parent()
            .unwrap_or(Path::new(""));
        if !parent.exists() {
            return Err(CommandErrorDto::not_found(
                format!("destination directory does not exist: {destination_path}"),
                Some("Choose a destination inside an existing directory.".to_string()),
            ));
        }
    }

    validate_source_paths_exist(&sources)?;

    let plan_options = if request.clean_source {
        PlanOptions::clean_source()
    } else {
        PlanOptions::default()
    };
    let create_progress_estimate = plan_archives(sources.clone(), &plan_options)
        .ok()
        .map(|manifest| (manifest.included_count(), manifest.total_bytes));
    let plan_options_for_thread = plan_options;

    let kind = match request.format {
        crate::dto::ArchiveFormatDto::Zip => JobKindDto::ZipCreate,
        crate::dto::ArchiveFormatDto::TarZst => JobKindDto::TarZstdCreate,
        crate::dto::ArchiveFormatDto::Tzap => JobKindDto::TzapCreate,
        crate::dto::ArchiveFormatDto::SevenZ => JobKindDto::SevenZCreate,
    };

    let (response, token) = registry.create_job(kind);
    if let Some((total_entries, total_bytes)) = create_progress_estimate {
        registry.emit_direct_event(
            &response.job_id,
            JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: Some(kind),
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: None,
                bytes: None,
                total_bytes: Some(total_bytes),
                total_bytes_processed: Some(0),
                entries: Some(0),
                total_entries: Some(total_entries),
                message: Some("Planning archive.".to_string()),
            },
        );
    }
    let registry_for_thread = registry.clone();
    let job_id = response.job_id.clone();

    let password = request
        .password
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let replace_existing = request.replace_existing;
    let preserve_metadata = request.preserve_metadata;
    let compression_level = request.compression_level;
    let volume_size = request.volume_size;
    let format = request.format;

    let request_sources = sources;
    let destination = destination_path;
    let kind_for_thread = kind;
    let plan_options = plan_options_for_thread;

    thread::spawn(move || {
        let mut sink = JobEventCollector::new(&registry_for_thread, job_id.clone());
        let result: Result<JobTerminalSummaryDto, CommandErrorDto> = match format {
            crate::dto::ArchiveFormatDto::Zip => {
                let create_options = ZipCreateOptions {
                    compression: zmanager_core::zip_backend::ZipCompression::default(),
                    level: compression_level.map(i64::from),
                    preserve_metadata,
                    replace_existing,
                    password: password.as_deref().map(SecretString::from),
                    volume_size,
                };
                run_zip_create_job_from_sources_with_plan_options(
                    &request_sources,
                    &destination,
                    &create_options,
                    &plan_options,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_zip_create)
                .map_err(map_zip_error)
            }
            crate::dto::ArchiveFormatDto::TarZst => {
                let level = compression_level
                    .and_then(|value| i32::try_from(value).ok())
                    .unwrap_or(TarZstdCreateOptions::default().level);
                let create_options = TarZstdCreateOptions {
                    level,
                    preserve_metadata,
                    replace_existing,
                    ..TarZstdCreateOptions::default()
                };
                run_tar_zst_create_job_from_sources_with_plan_options(
                    &request_sources,
                    &destination,
                    &create_options,
                    &plan_options,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_tar_create)
                .map_err(map_tar_zst_error)
            }
            crate::dto::ArchiveFormatDto::Tzap => {
                let key_source = password
                    .as_deref()
                    .map(SecretString::from)
                    .map_or(TzapKeySource::NoPassword, TzapKeySource::Passphrase);
                let create_options = TzapCreateOptions {
                    key_source,
                    level: compression_level
                        .and_then(|value| i32::try_from(value).ok())
                        .unwrap_or(3),
                    preserve_metadata,
                    replace_existing,
                    volume_size,
                    recovery_percentage: 0,
                    volume_loss_tolerance: 0,
                    x509_signing: None,
                };
                run_tzap_create_job_from_sources_with_plan_options(
                    &request_sources,
                    &destination,
                    &create_options,
                    &plan_options,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_tzap_create)
                .map_err(map_tzap_error)
            }
            crate::dto::ArchiveFormatDto::SevenZ => {
                let create_options = SevenZCreateOptions {
                    solid: true,
                    level: compression_level,
                    preserve_metadata,
                    password: password.as_deref().map(SecretString::from),
                    encrypt_file_names: true,
                    replace_existing,
                    volume_size,
                    ..SevenZCreateOptions::default()
                };
                run_7z_create_job_from_sources_with_plan_options(
                    &request_sources,
                    &destination,
                    &create_options,
                    &plan_options,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_seven_create)
                .map_err(map_7z_error)
            }
        };

        match result {
            Ok(summary) => {
                complete_job_if_needed(&registry_for_thread, &job_id, kind_for_thread, summary);
            }
            Err(error) => {
                registry_for_thread.emit_direct_event(
                    &job_id,
                    JobEventDto::failed_from_command_error(kind_for_thread, error),
                );
            }
        }
    });

    Ok(response)
}

#[tauri::command]
pub fn start_extract(
    request: StartExtractRequest,
    registry: State<'_, JobRegistry>,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    start_extract_internal(request, &registry)
}

pub(crate) fn start_extract_internal(
    request: StartExtractRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let requested_destination_path =
        ensure_non_empty_path(request.destination_path, "destinationPath")?;
    let destination_path =
        if request.destination_collision_strategy == DestinationCollisionStrategyDto::Rename {
            next_available_destination_path(&requested_destination_path)
        } else {
            requested_destination_path
        };
    let entry_paths = normalize_optional_entry_paths(request.entry_paths)?;
    let password = request
        .password
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let extract_progress_estimate = if entry_paths.is_empty() {
        archive_extract_progress_estimate(&archive_path, password.as_deref())
    } else {
        Some((entry_paths.len(), None))
    };

    let family = detect_archive_family(&archive_path);
    let kind = match family {
        ArchiveFamily::Zip => JobKindDto::ZipExtract,
        ArchiveFamily::TarZst => JobKindDto::TarZstdExtract,
        ArchiveFamily::SevenZ => JobKindDto::SevenZExtract,
        ArchiveFamily::Rar => JobKindDto::RarExtract,
        ArchiveFamily::Tzap => JobKindDto::TzapExtract,
        ArchiveFamily::Archive => JobKindDto::ArchiveExtract,
    };

    let (response, token) = registry.create_job(kind);
    if let Some((total_entries, total_bytes)) = extract_progress_estimate {
        registry.emit_direct_event(
            &response.job_id,
            JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: Some(kind),
                code: None,
                hint: None,
                severity: None,
                retryable: None,
                path: None,
                bytes: None,
                total_bytes,
                total_bytes_processed: Some(0),
                entries: Some(0),
                total_entries: Some(total_entries),
                message: Some("Planning extraction.".to_string()),
            },
        );
    }
    let registry_for_thread = registry.clone();
    let job_id = response.job_id.clone();
    let family_for_thread = family;
    let policy = extraction_policy(request.overwrite, request.strip_components);
    let archive_path = archive_path;
    let destination_path = destination_path;

    thread::spawn(move || {
        let mut sink = JobEventCollector::new(&registry_for_thread, job_id.clone());
        let result = if entry_paths.is_empty() {
            match family_for_thread {
                ArchiveFamily::Zip => run_zip_extract_job_with_password_and_policy(
                    &archive_path,
                    &destination_path,
                    password.as_deref(),
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_zip_error),
                ArchiveFamily::TarZst => run_tar_zst_extract_job_with_policy(
                    &archive_path,
                    &destination_path,
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_tar_zst_error),
                ArchiveFamily::SevenZ => run_7z_extract_job_with_password_and_policy(
                    &archive_path,
                    &destination_path,
                    password.as_deref(),
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_7z_error),
                ArchiveFamily::Rar => run_rar_extract_job_with_password_and_policy(
                    &archive_path,
                    &destination_path,
                    password.as_deref(),
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_rar_error),
                ArchiveFamily::Tzap => run_tzap_extract_job_with_password_and_policy(
                    &archive_path,
                    &destination_path,
                    password.as_deref(),
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_tzap_error),
                ArchiveFamily::Archive => run_libarchive_extract_job_with_password_and_policy(
                    &archive_path,
                    &destination_path,
                    password.as_deref(),
                    policy,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_extract)
                .map_err(map_libarchive_error),
            }
        } else {
            run_selected_extract_job(
                &archive_path,
                &destination_path,
                &entry_paths,
                password.as_deref(),
                policy,
                &token,
                &mut sink,
                kind,
            )
        };

        match result {
            Ok(summary) => {
                complete_job_if_needed(&registry_for_thread, &job_id, kind, summary);
            }
            Err(error) => {
                registry_for_thread.emit_direct_event(
                    &job_id,
                    JobEventDto::failed_from_command_error(kind, error),
                );
            }
        }
    });

    Ok(response)
}

fn complete_job_if_needed(
    registry: &JobRegistry,
    job_id: &str,
    kind: JobKindDto,
    summary: JobTerminalSummaryDto,
) {
    let written_entries = summary.written_entries;
    let written_bytes = summary.written_bytes;
    registry.set_terminal_summary(job_id, summary);

    if registry
        .snapshot(job_id)
        .is_some_and(|snapshot| snapshot.status.is_terminal())
    {
        return;
    }

    registry.emit_direct_event(
        job_id,
        JobEventDto {
            event_type: JobEventKindDto::Completed,
            job_kind: Some(kind),
            code: None,
            hint: None,
            severity: None,
            retryable: None,
            path: None,
            bytes: Some(written_bytes),
            total_bytes: None,
            total_bytes_processed: Some(written_bytes),
            entries: Some(written_entries),
            total_entries: Some(written_entries),
            message: None,
        },
    );
}

fn archive_extract_progress_estimate(
    archive_path: &str,
    password: Option<&str>,
) -> Option<(usize, Option<u64>)> {
    let listing = archive_browser::list_entries_with_options(
        Path::new(archive_path),
        BrowserListOptions { password },
    )
    .ok()?;
    let mut total_entries = 0usize;
    let mut total_bytes = 0u64;
    let mut has_size = false;

    for entry in listing.entries {
        if matches!(
            entry.kind,
            zmanager_core::archive_browser::BrowserEntryKind::Directory
        ) {
            continue;
        }

        total_entries = total_entries.saturating_add(1);
        if let Some(size) = entry.size {
            total_bytes = total_bytes.saturating_add(size);
            has_size = true;
        }
    }

    Some((total_entries, has_size.then_some(total_bytes)))
}

#[tauri::command]
pub fn preview_entry(
    request: PreviewEntryRequest,
    registry: State<'_, JobRegistry>,
) -> Result<PreviewEntryResponse, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let entry_path = ensure_non_empty_path(request.entry_path, "entryPath")?;

    let report = archive_browser::preview_entry_with_options(
        archive_path,
        &entry_path,
        BrowserExtractOptions {
            password: request.password.as_deref(),
            overwrite: map_overwrite_policy(request.overwrite),
            strip_components: request.strip_components,
        },
    )
    .map_err(map_archive_browser_error)?;

    registry.replace_preview_root(report.cleanup_root.clone());

    Ok(PreviewEntryResponse {
        cleanup_root: report.cleanup_root.to_string_lossy().to_string(),
        preview_path: report.preview_path.to_string_lossy().to_string(),
        written_bytes: report.written_bytes,
    })
}

#[tauri::command]
pub fn start_native_file_drag(
    request: NativeFileDragRequest,
    _registry: State<'_, JobRegistry>,
) -> Result<NativeFileDragResponse, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let entry_paths = normalize_optional_entry_paths(Some(request.entry_paths))?;
    let password = request
        .password
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());

    let drag_items = build_native_drag_items(
        &archive_path,
        &entry_paths,
        request.strip_components,
        password.as_deref(),
    )?;
    preflight_native_drag_stream(&archive_path, password.as_deref(), &drag_items)?;

    let stream_archive_path = archive_path.clone();
    let stream_password = password.clone();
    let stream_provider: crate::platform::NativeFileDragStreamProvider =
        Arc::new(move |entry_path, writer| {
            stream_native_drag_entry(
                &stream_archive_path,
                stream_password.as_deref(),
                entry_path,
                writer,
            )
            .map_err(native_file_drag_error_from_command)
        });

    let outcome = crate::platform::start_native_file_drag(&drag_items, stream_provider)
        .map_err(map_native_file_drag_error)?;

    Ok(NativeFileDragResponse {
        outcome: map_native_file_drag_outcome(outcome),
        dragged_entries: drag_items
            .iter()
            .map(|item| item.entry_path.clone())
            .collect(),
    })
}

#[tauri::command]
pub fn cleanup_preview_roots(registry: State<'_, JobRegistry>) {
    registry.cleanup_preview_roots();
}

#[tauri::command]
pub fn test_archive(
    request: TestArchiveRequest,
    registry: State<'_, JobRegistry>,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    start_test_archive_internal(request, &registry)
}

fn start_test_archive_internal(
    request: TestArchiveRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let family = detect_archive_family(&archive_path);

    let (response, _token) = registry.create_job(JobKindDto::TestArchive);
    let registry_for_thread = registry.clone();
    let job_id = response.job_id.clone();

    let password = request
        .password
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());

    thread::spawn(move || {
        registry_for_thread.emit_direct_event(
            &job_id,
            JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: Some(JobKindDto::TestArchive),
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
            },
        );

        let result: Result<JobTerminalSummaryDto, CommandErrorDto> = match family {
            ArchiveFamily::Zip => zmanager_core::zip_backend::test_zip_with_password_filter(
                &archive_path,
                password.as_deref(),
                |_| true,
            )
            .map(to_terminal_summary_for_zip_test)
            .map_err(map_zip_error),
            ArchiveFamily::Tzap => {
                zmanager_core::tzap_backend::test_tzap_with_optional_password_filter_and_x509_trust(
                    &archive_path,
                    password.as_deref(),
                    |_| true,
                    None,
                )
                .map(to_terminal_summary_for_tzap_test)
                .map_err(map_tzap_error)
            }
            _ => zmanager_core::libarchive_backend::test_archive_with_password_filter(
                &archive_path,
                password.as_deref(),
                |_| true,
            )
            .map(to_terminal_summary_for_libarchive_test)
            .map_err(map_libarchive_error),
        };

        match result {
            Ok(summary) => {
                let written_entries = summary.written_entries;
                let written_bytes = summary.written_bytes;
                registry_for_thread.set_terminal_summary(&job_id, summary);
                registry_for_thread.emit_direct_event(
                    &job_id,
                    JobEventDto {
                        event_type: JobEventKindDto::Completed,
                        job_kind: Some(JobKindDto::TestArchive),
                        code: None,
                        hint: None,
                        severity: None,
                        retryable: None,
                        path: None,
                        bytes: Some(written_bytes),
                        total_bytes: None,
                        total_bytes_processed: None,
                        entries: Some(written_entries),
                        total_entries: Some(written_entries),
                        message: None,
                    },
                );
            }
            Err(error) => {
                registry_for_thread.emit_direct_event(
                    &job_id,
                    JobEventDto::failed_from_command_error(JobKindDto::TestArchive, error),
                );
            }
        }
    });

    Ok(response)
}

fn run_selected_extract_job(
    archive_path: &str,
    destination_path: &str,
    entry_paths: &[String],
    password: Option<&str>,
    policy: ExtractionPolicy,
    token: &CancellationToken,
    sink: &mut JobEventCollector,
    kind: JobKindDto,
) -> Result<JobTerminalSummaryDto, CommandErrorDto> {
    sink.emit_direct(JobEventDto {
        event_type: JobEventKindDto::Started,
        job_kind: Some(kind),
        code: None,
        hint: None,
        severity: None,
        retryable: None,
        path: None,
        bytes: None,
        total_bytes: None,
        total_bytes_processed: None,
        entries: Some(0),
        total_entries: Some(entry_paths.len()),
        message: None,
    });

    let mut written_entries = 0usize;
    let mut written_bytes = 0u64;

    for entry_path in entry_paths {
        if token.is_cancelled() {
            return Ok(cancel_selected_extract_job(
                sink,
                kind,
                Some(entry_path.clone()),
                written_entries,
                written_bytes,
                entry_paths.len(),
            ));
        }

        sink.emit_direct(JobEventDto {
            event_type: JobEventKindDto::EntryStarted,
            job_kind: Some(kind),
            code: None,
            hint: None,
            severity: None,
            retryable: None,
            path: Some(entry_path.clone()),
            bytes: None,
            total_bytes: None,
            total_bytes_processed: Some(written_bytes),
            entries: Some(written_entries),
            total_entries: Some(entry_paths.len()),
            message: None,
        });

        let report = archive_browser::extract_entry_with_options(
            archive_path,
            entry_path,
            destination_path,
            BrowserExtractOptions {
                password,
                overwrite: policy.overwrite,
                strip_components: policy.strip_components,
            },
        )
        .map_err(map_archive_browser_error)?;

        written_entries = written_entries.saturating_add(1);
        written_bytes = written_bytes.saturating_add(report.written_bytes);
        sink.emit_direct(JobEventDto {
            event_type: JobEventKindDto::EntryFinished,
            job_kind: Some(kind),
            code: None,
            hint: None,
            severity: None,
            retryable: None,
            path: Some(entry_path.clone()),
            bytes: Some(report.written_bytes),
            total_bytes: None,
            total_bytes_processed: Some(written_bytes),
            entries: Some(written_entries),
            total_entries: Some(entry_paths.len()),
            message: None,
        });

        if token.is_cancelled() {
            return Ok(cancel_selected_extract_job(
                sink,
                kind,
                Some(entry_path.clone()),
                written_entries,
                written_bytes,
                entry_paths.len(),
            ));
        }
    }

    if token.is_cancelled() {
        return Ok(cancel_selected_extract_job(
            sink,
            kind,
            None,
            written_entries,
            written_bytes,
            entry_paths.len(),
        ));
    }

    sink.emit_direct(JobEventDto {
        event_type: JobEventKindDto::Completed,
        job_kind: Some(kind),
        code: None,
        hint: None,
        severity: None,
        retryable: None,
        path: None,
        bytes: Some(written_bytes),
        total_bytes: None,
        total_bytes_processed: Some(written_bytes),
        entries: Some(written_entries),
        total_entries: Some(entry_paths.len()),
        message: None,
    });

    Ok(JobTerminalSummaryDto {
        written_entries,
        skipped_entries: None,
        written_bytes,
        warnings: Vec::new(),
    })
}

fn cancel_selected_extract_job(
    sink: &mut JobEventCollector,
    kind: JobKindDto,
    path: Option<String>,
    written_entries: usize,
    written_bytes: u64,
    total_entries: usize,
) -> JobTerminalSummaryDto {
    sink.emit_direct(JobEventDto {
        event_type: JobEventKindDto::Cancelled,
        job_kind: Some(kind),
        code: Some(constants::COMMAND_ERROR_CANCELLED),
        hint: None,
        severity: None,
        retryable: Some(true),
        path,
        bytes: None,
        total_bytes: None,
        total_bytes_processed: Some(written_bytes),
        entries: Some(written_entries),
        total_entries: Some(total_entries),
        message: Some("Extraction cancelled.".to_string()),
    });

    JobTerminalSummaryDto {
        written_entries,
        skipped_entries: None,
        written_bytes,
        warnings: vec!["Extraction cancelled.".to_string()],
    }
}

#[tauri::command]
pub fn poll_job_events(
    request: PollJobEventsRequest,
    registry: State<'_, JobRegistry>,
) -> Result<PollJobEventsResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }

    registry.poll_events(&job_id).ok_or_else(|| {
        CommandErrorDto::not_found(
            format!("job not found: {job_id}"),
            Some("Start a new job command before polling.".to_string()),
        )
    })
}

#[tauri::command]
pub fn cancel_job(
    request: crate::dto::CancelJobRequest,
    registry: State<'_, JobRegistry>,
) -> Result<crate::job_dto::CancelJobResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }

    registry.request_cancel(&job_id).ok_or_else(|| {
        CommandErrorDto::not_found(
            format!("job not found: {job_id}"),
            Some("The job may have already completed and can be dismissed.".to_string()),
        )
    })
}

#[tauri::command]
pub fn pause_job(
    request: PauseJobRequest,
    registry: State<'_, JobRegistry>,
) -> Result<JobControlResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }

    registry.request_pause(&job_id).ok_or_else(|| {
        CommandErrorDto::not_found(
            format!("job not found: {job_id}"),
            Some("Start a new job command before pausing.".to_string()),
        )
    })
}

#[tauri::command]
pub fn resume_job(
    request: ResumeJobRequest,
    registry: State<'_, JobRegistry>,
) -> Result<JobControlResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }

    registry.request_resume(&job_id).ok_or_else(|| {
        CommandErrorDto::not_found(
            format!("job not found: {job_id}"),
            Some("Only jobs that still exist in this session can be resumed.".to_string()),
        )
    })
}

#[tauri::command]
pub fn dismiss_job(
    request: crate::dto::DismissJobRequest,
    registry: State<'_, JobRegistry>,
) -> Result<(), CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }

    let snapshot = registry.snapshot(&job_id).ok_or_else(|| {
        CommandErrorDto::not_found(
            format!("job not found: {job_id}"),
            Some("Only dismiss jobs that still exist in this session.".to_string()),
        )
    })?;

    if !snapshot.status.is_terminal() {
        return Err(CommandErrorDto::invalid_request(format!(
            "cannot dismiss job {job_id} while it is {:?}",
            snapshot.status,
        )));
    }

    let _ = registry.remove_job_if_terminal(&job_id);
    Ok(())
}

fn map_browser_entry_kind(
    entry: zmanager_core::archive_browser::BrowserEntryKind,
) -> ArchiveEntryKindDto {
    match entry {
        zmanager_core::archive_browser::BrowserEntryKind::File => ArchiveEntryKindDto::File,
        zmanager_core::archive_browser::BrowserEntryKind::Directory => {
            ArchiveEntryKindDto::Directory
        }
        zmanager_core::archive_browser::BrowserEntryKind::Symlink => ArchiveEntryKindDto::Symlink,
        zmanager_core::archive_browser::BrowserEntryKind::Hardlink => ArchiveEntryKindDto::Hardlink,
        zmanager_core::archive_browser::BrowserEntryKind::Special => ArchiveEntryKindDto::Special,
    }
}

fn map_archive_browser_error(error: ArchiveBrowserError) -> CommandErrorDto {
    match error {
        ArchiveBrowserError::Zip(source) => map_zip_error(source),
        ArchiveBrowserError::TarZst(source) => map_tar_zst_error(source),
        ArchiveBrowserError::SevenZ(source) => map_7z_error(source),
        ArchiveBrowserError::Tzap(source) => map_tzap_error(source),
        ArchiveBrowserError::Libarchive(source) => map_libarchive_error(source),
        ArchiveBrowserError::RawStream(source) => map_raw_stream_error(source),
        ArchiveBrowserError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        ArchiveBrowserError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        ArchiveBrowserError::EntryNotFound { path } => CommandErrorDto::not_found(
            format!("archive entry not found: {path}"),
            Some("Open a different archive or confirm the selected entry path.".to_string()),
        ),
        ArchiveBrowserError::UnsupportedEntry { path, .. } => CommandErrorDto::unsupported_format(
            format!("entry cannot be extracted or previewed here: {path}"),
        ),
    }
}

fn map_zip_error(error: ZipBackendError) -> CommandErrorDto {
    match error {
        ZipBackendError::PasswordRequired => CommandErrorDto::password_required(
            "This ZIP archive is encrypted and requires a password.",
            Some("Enter the archive password.".to_string()),
        ),
        ZipBackendError::InvalidPassword => {
            CommandErrorDto::invalid_password("The ZIP password was incorrect.")
        }
        ZipBackendError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        ZipBackendError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        ZipBackendError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("ZIP plan failed: {source}"))
        }
        ZipBackendError::VolumeSizeTooSmall { size, minimum } => CommandErrorDto::invalid_request(
            format!("ZIP volume size {size} is smaller than minimum {minimum}"),
        ),
        ZipBackendError::UnsupportedSplitZip { .. } => CommandErrorDto::unsupported_format(
            "ZIP split archives are unsupported for this operation in this path.".to_string(),
        ),
        ZipBackendError::InvalidSymlinkTarget { archive_path } => {
            CommandErrorDto::operation_failed(format!("invalid symlink target for {archive_path}"))
        }
        ZipBackendError::Zip(source) => {
            CommandErrorDto::operation_failed(format!("ZIP operation failed: {source}"))
        }
        ZipBackendError::Cancelled => CommandErrorDto::cancelled("ZIP job was cancelled."),
    }
}

fn map_tar_zst_error(error: zmanager_core::tar_zst_backend::TarZstdError) -> CommandErrorDto {
    match error {
        zmanager_core::tar_zst_backend::TarZstdError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        zmanager_core::tar_zst_backend::TarZstdError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        zmanager_core::tar_zst_backend::TarZstdError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("TAR/ZST plan error: {source}"))
        }
        zmanager_core::tar_zst_backend::TarZstdError::MissingLinkTarget { archive_path } => {
            CommandErrorDto::unsupported_format(format!(
                "tar link entry has no target: {archive_path}"
            ))
        }
        zmanager_core::tar_zst_backend::TarZstdError::Cancelled => {
            CommandErrorDto::cancelled("TAR/ZST job was cancelled.")
        }
    }
}

fn map_7z_error(error: SevenZError) -> CommandErrorDto {
    match error {
        SevenZError::PasswordRequired => CommandErrorDto::password_required(
            "This 7z archive is encrypted and requires a password.",
            Some("Enter the archive password.".to_string()),
        ),
        SevenZError::InvalidPassword => {
            CommandErrorDto::invalid_password("The 7z password was incorrect.")
        }
        SevenZError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        SevenZError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        SevenZError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("7z plan error: {source}"))
        }
        SevenZError::VolumeSizeTooSmall { size, minimum } => CommandErrorDto::invalid_request(
            format!("7z volume size {size} bytes is smaller than minimum {minimum} bytes"),
        ),
        SevenZError::SevenZ(source) => {
            CommandErrorDto::operation_failed(format!("7z operation failed: {source}"))
        }
        SevenZError::Cancelled => CommandErrorDto::cancelled("7z job was cancelled."),
    }
}

fn map_tzap_error(error: TzapError) -> CommandErrorDto {
    match error {
        TzapError::PasswordRequired => CommandErrorDto::password_required(
            "This TZAP archive is encrypted and requires a password.",
            Some("Enter the archive password.".to_string()),
        ),
        TzapError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        TzapError::Io { path, source } => map_io_error(path.to_string_lossy().to_string(), source),
        TzapError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("TZAP plan error: {source}"))
        }
        TzapError::Format(source) => {
            CommandErrorDto::unsupported_format(format!("TZAP format rejected archive: {source}"))
        }
        TzapError::X509RootAuth(message) => CommandErrorDto::unsupported_format(format!(
            "TZAP root-auth verification failed: {message}"
        )),
        TzapError::KeyWrap(message) => {
            CommandErrorDto::operation_failed(format!("TZAP key wrapping failed: {message}"))
        }
        TzapError::RecipientKeyRequired => CommandErrorDto::unsupported_format(
            "This TZAP archive requires a recipient private key.".to_string(),
        ),
        TzapError::Cancelled => CommandErrorDto::cancelled("TZAP job was cancelled."),
    }
}

fn map_libarchive_error(error: LibarchiveError) -> CommandErrorDto {
    match error {
        LibarchiveError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        LibarchiveError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        LibarchiveError::MissingPath => {
            CommandErrorDto::unsupported_format("archive entry has no path".to_string())
        }
        LibarchiveError::MissingLinkTarget { path } => {
            CommandErrorDto::unsupported_format(format!("link entry has no target: {path}"))
        }
        LibarchiveError::EntryNotFound { path } => CommandErrorDto::not_found(
            format!("archive entry not found: {path}"),
            Some("Select a path present in this archive.".to_string()),
        ),
        LibarchiveError::StdoutSelectionNotSingleFile { selected_files } => {
            CommandErrorDto::unsupported_format(format!(
                "expected exactly one selected file, got {selected_files}"
            ))
        }
        LibarchiveError::Archive(source) => {
            CommandErrorDto::operation_failed(format!("libarchive error: {source}"))
        }
        LibarchiveError::RawStream(source) => map_raw_stream_error(source),
        LibarchiveError::Cancelled => CommandErrorDto::cancelled("archive job was cancelled."),
    }
}

fn map_raw_stream_error(error: RawStreamError) -> CommandErrorDto {
    match error {
        RawStreamError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        RawStreamError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        RawStreamError::MissingOutputName { archive_path } => {
            CommandErrorDto::unsupported_format(format!(
                "could not derive an output file name from {}",
                archive_path.display()
            ))
        }
        RawStreamError::ExternalToolUnavailable { tool, source } => {
            CommandErrorDto::operation_failed(format!(
                "required decoder tool {tool} is not available: {source}"
            ))
        }
        RawStreamError::ExternalToolFailed {
            tool,
            archive_path,
            status,
            message,
        } => {
            let status = status.map_or_else(|| "unknown".to_string(), |status| status.to_string());
            let detail = if message.is_empty() {
                String::new()
            } else {
                format!(": {message}")
            };
            CommandErrorDto::operation_failed(format!(
                "{tool} failed to decode {} with status {status}{detail}",
                archive_path.display()
            ))
        }
    }
}

fn map_rar_error(error: RarBackendError) -> CommandErrorDto {
    match error {
        RarBackendError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        RarBackendError::Safety(source) => {
            CommandErrorDto::unsafe_archive(format!("entry blocked by safety policy: {source}"))
        }
        RarBackendError::Unrar(source) => {
            CommandErrorDto::operation_failed(format!("RAR error: {source}"))
        }
        RarBackendError::MissingLinkTarget { path } => {
            CommandErrorDto::unsupported_format(format!("RAR link entry has no target: {path}"))
        }
        RarBackendError::InvalidLinkTarget {
            path,
            target,
            reason,
        } => CommandErrorDto::unsupported_format(format!(
            "RAR link target is invalid for {path}: {target}: {reason}"
        )),
        RarBackendError::DictionaryTooLarge { path, size } => CommandErrorDto::invalid_request(
            format!("RAR dictionary is too large for {path}: {size} bytes"),
        ),
    }
}

fn map_plan_error(error: PlanError) -> CommandErrorDto {
    CommandErrorDto::invalid_request(error.to_string())
}

fn map_io_error(path: String, source: io::Error) -> CommandErrorDto {
    match source.kind() {
        io::ErrorKind::NotFound => CommandErrorDto::not_found(
            format!("could not find file or directory: {path}"),
            Some("Check that the path exists and is accessible.".to_string()),
        ),
        _ => CommandErrorDto::io_error(
            format!("I/O failed for {path}: {source}"),
            source.kind() == io::ErrorKind::TimedOut || source.kind() == io::ErrorKind::Interrupted,
        ),
    }
}

fn map_native_file_drag_error(error: crate::platform::NativeFileDragError) -> CommandErrorDto {
    CommandErrorDto::new(
        constants::COMMAND_ERROR_OPERATION_FAILED,
        error.message,
        error.hint,
        ErrorSeverityDto::Warning,
        false,
    )
}

fn native_file_drag_error_from_command(
    error: CommandErrorDto,
) -> crate::platform::NativeFileDragError {
    crate::platform::NativeFileDragError::new(error.message, error.hint)
}

fn map_native_file_drag_outcome(
    outcome: crate::platform::NativeFileDragOutcome,
) -> NativeFileDragOutcomeDto {
    match outcome {
        crate::platform::NativeFileDragOutcome::Dropped => NativeFileDragOutcomeDto::Dropped,
        crate::platform::NativeFileDragOutcome::Cancelled => NativeFileDragOutcomeDto::Cancelled,
        crate::platform::NativeFileDragOutcome::NoDrop => NativeFileDragOutcomeDto::NoDrop,
    }
}

fn build_native_drag_items(
    archive_path: &str,
    entry_paths: &[String],
    strip_components: usize,
    password: Option<&str>,
) -> Result<Vec<crate::platform::NativeFileDragItem>, CommandErrorDto> {
    let listing = archive_browser::list_entries_with_options(
        Path::new(archive_path),
        BrowserListOptions { password },
    )
    .map_err(map_archive_browser_error)?;

    native_drag_items_from_listing(&listing.entries, entry_paths, strip_components)
}

fn native_drag_items_from_listing(
    entries: &[zmanager_core::archive_browser::BrowserEntry],
    entry_paths: &[String],
    strip_components: usize,
) -> Result<Vec<crate::platform::NativeFileDragItem>, CommandErrorDto> {
    let mut selected_entry_keys = HashSet::new();
    let mut selected_entries = Vec::new();

    for entry_path in entry_paths {
        let requested_key = archive_entry_key(entry_path);
        let Some(selected) = entries
            .iter()
            .find(|entry| archive_entry_key(&entry.path) == requested_key)
        else {
            let before = selected_entries.len();
            let folder_key = archive_folder_key(entry_path);
            for descendant in entries {
                if descendant.kind != zmanager_core::archive_browser::BrowserEntryKind::File {
                    continue;
                }
                if entry_is_under_folder_key(&archive_entry_key(&descendant.path), &folder_key) {
                    push_native_drag_listing_entry(
                        descendant,
                        &mut selected_entry_keys,
                        &mut selected_entries,
                    );
                }
            }
            if selected_entries.len() > before {
                continue;
            }
            return Err(CommandErrorDto::not_found(
                format!("archive entry not found: {entry_path}"),
                Some("Open the archive again or choose a visible entry.".to_string()),
            ));
        };

        match selected.kind {
            zmanager_core::archive_browser::BrowserEntryKind::File => {
                push_native_drag_listing_entry(
                    selected,
                    &mut selected_entry_keys,
                    &mut selected_entries,
                );
            }
            zmanager_core::archive_browser::BrowserEntryKind::Directory => {
                let before = selected_entries.len();
                let folder_key = archive_folder_key(&selected.path);
                for descendant in entries {
                    if descendant.kind != zmanager_core::archive_browser::BrowserEntryKind::File {
                        continue;
                    }
                    if entry_is_under_folder_key(&archive_entry_key(&descendant.path), &folder_key)
                    {
                        push_native_drag_listing_entry(
                            descendant,
                            &mut selected_entry_keys,
                            &mut selected_entries,
                        );
                    }
                }
                if selected_entries.len() == before {
                    return Err(CommandErrorDto::unsupported_format(format!(
                        "directory has no regular file entries to drag out: {}",
                        selected.path
                    )));
                }
            }
            _ => {
                return Err(CommandErrorDto::unsupported_format(format!(
                    "entry cannot be dragged out as a virtual file: {}",
                    selected.path
                )));
            }
        }
    }

    let mut display_path_keys = HashSet::new();
    let mut items = Vec::with_capacity(selected_entries.len());
    for entry in selected_entries {
        let display_path = virtual_drag_display_path(&entry.path, strip_components)?;
        let display_key = display_path.to_lowercase();
        if !display_path_keys.insert(display_key) {
            return Err(CommandErrorDto::invalid_request(format!(
                "more than one selected entry would drag out as {display_path}"
            )));
        }

        items.push(crate::platform::NativeFileDragItem {
            entry_path: entry.path.clone(),
            display_path,
            size: entry.size,
            modified_unix_seconds: entry
                .modified
                .as_deref()
                .and_then(|modified| modified.parse::<u64>().ok()),
        });
    }

    Ok(items)
}

fn push_native_drag_listing_entry<'a>(
    entry: &'a zmanager_core::archive_browser::BrowserEntry,
    selected_entry_keys: &mut HashSet<String>,
    selected_entries: &mut Vec<&'a zmanager_core::archive_browser::BrowserEntry>,
) {
    if selected_entry_keys.insert(archive_entry_key(&entry.path)) {
        selected_entries.push(entry);
    }
}

fn virtual_drag_display_path(
    entry_path: &str,
    strip_components: usize,
) -> Result<String, CommandErrorDto> {
    let components = entry_path
        .split(|character| character == '/' || character == '\\')
        .filter(|component| !component.is_empty())
        .skip(strip_components)
        .collect::<Vec<_>>();

    if components.is_empty() {
        return Err(CommandErrorDto::invalid_request(format!(
            "entry path is empty after stripping components: {entry_path}"
        )));
    }

    for component in &components {
        validate_virtual_drag_component(component, entry_path)?;
    }

    let display_path = components.join("\\");
    if display_path.encode_utf16().count() > WINDOWS_FILE_DESCRIPTOR_PATH_MAX_UTF16 {
        return Err(CommandErrorDto::invalid_request(format!(
            "entry path is too long for Windows virtual drag-out: {entry_path}"
        )));
    }

    Ok(display_path)
}

const WINDOWS_FILE_DESCRIPTOR_PATH_MAX_UTF16: usize = 259;
const WINDOWS_RESERVED_FILE_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

fn validate_virtual_drag_component(
    component: &str,
    entry_path: &str,
) -> Result<(), CommandErrorDto> {
    if component == "." || component == ".." {
        return Err(CommandErrorDto::unsafe_archive(format!(
            "entry path contains unsafe traversal component: {entry_path}"
        )));
    }

    if component.ends_with(' ') || component.ends_with('.') {
        return Err(CommandErrorDto::unsafe_archive(format!(
            "entry path contains a Windows-unsafe component: {entry_path}"
        )));
    }

    if component.chars().any(is_windows_invalid_file_name_char) {
        return Err(CommandErrorDto::unsafe_archive(format!(
            "entry path contains a Windows-unsafe character: {entry_path}"
        )));
    }

    let reserved_probe = component
        .split_once('.')
        .map_or(component, |(stem, _)| stem)
        .to_ascii_uppercase();
    if WINDOWS_RESERVED_FILE_NAMES
        .iter()
        .any(|reserved| reserved_probe == *reserved)
    {
        return Err(CommandErrorDto::unsafe_archive(format!(
            "entry path contains a Windows-reserved file name: {entry_path}"
        )));
    }

    Ok(())
}

fn is_windows_invalid_file_name_char(character: char) -> bool {
    character == '\0'
        || character.is_control()
        || matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*')
}

fn archive_entry_key(path: &str) -> String {
    path.split(|character| character == '/' || character == '\\')
        .filter(|component| !component.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn archive_folder_key(path: &str) -> String {
    let mut key = archive_entry_key(path);
    if !key.ends_with('/') {
        key.push('/');
    }
    key
}

fn entry_is_under_folder_key(entry_key: &str, folder_key: &str) -> bool {
    entry_key.starts_with(folder_key) && entry_key.len() > folder_key.len()
}

fn preflight_native_drag_stream(
    archive_path: &str,
    password: Option<&str>,
    items: &[crate::platform::NativeFileDragItem],
) -> Result<(), CommandErrorDto> {
    if zmanager_core::raw_stream_backend::detect_raw_stream_format(Path::new(archive_path))
        .is_some()
    {
        return Ok(());
    }

    let Some(item) = items
        .iter()
        .filter(|item| item.size != Some(0))
        .min_by_key(|item| item.size.unwrap_or(u64::MAX))
        .or_else(|| items.first())
    else {
        return Ok(());
    };

    let mut sink = io::sink();
    stream_native_drag_entry(archive_path, password, &item.entry_path, &mut sink)?;
    Ok(())
}

fn stream_native_drag_entry(
    archive_path: &str,
    password: Option<&str>,
    entry_path: &str,
    output: &mut dyn Write,
) -> Result<u64, CommandErrorDto> {
    let archive_path = Path::new(archive_path);

    if let Some(format) = zmanager_core::raw_stream_backend::detect_raw_stream_format(archive_path)
    {
        let output_name =
            zmanager_core::raw_stream_backend::output_name_for_raw_stream(archive_path, format)
                .ok_or_else(|| {
                    CommandErrorDto::unsupported_format(format!(
                        "could not derive an output file name from {}",
                        archive_path.display()
                    ))
                })?;
        if archive_entry_key(&output_name) != archive_entry_key(entry_path) {
            return Err(CommandErrorDto::not_found(
                format!("archive entry not found: {entry_path}"),
                Some("Open the archive again or choose a visible entry.".to_string()),
            ));
        }

        let mut writer = DynWriteAdapter { inner: output };
        return zmanager_core::raw_stream_backend::copy_raw_stream_to_writer(
            archive_path,
            format,
            &mut writer,
        )
        .map_err(map_raw_stream_error);
    }

    match stream_archive_family(archive_path) {
        ArchiveFamily::Zip => {
            let mut writer = DynWriteAdapter { inner: output };
            let report = zmanager_core::zip_backend::copy_zip_files_to_writer(
                archive_path,
                password,
                |name| archive_entry_key(name) == archive_entry_key(entry_path),
                &mut writer,
            )
            .map_err(map_zip_error)?;
            one_streamed_entry_bytes(entry_path, report.written_entries, report.written_bytes)
        }
        ArchiveFamily::TarZst => {
            let mut writer = DynWriteAdapter { inner: output };
            let report = zmanager_core::tar_zst_backend::copy_tar_zst_files_to_writer(
                archive_path,
                |name| archive_entry_key(name) == archive_entry_key(entry_path),
                &mut writer,
            )
            .map_err(map_tar_zst_error)?;
            one_streamed_entry_bytes(entry_path, report.written_entries, report.written_bytes)
        }
        ArchiveFamily::SevenZ => {
            let mut writer = DynWriteAdapter { inner: output };
            let report = zmanager_core::sevenz_backend::copy_7z_files_to_writer(
                archive_path,
                password,
                |name| archive_entry_key(name) == archive_entry_key(entry_path),
                &mut writer,
            )
            .map_err(map_7z_error)?;
            one_streamed_entry_bytes(entry_path, report.written_entries, report.written_bytes)
        }
        ArchiveFamily::Tzap => {
            let report =
                zmanager_core::tzap_backend::copy_tzap_files_to_writer_with_optional_password(
                    archive_path,
                    password,
                    |name| archive_entry_key(name) == archive_entry_key(entry_path),
                    output,
                )
                .map_err(map_tzap_error)?;
            one_streamed_entry_bytes(entry_path, report.written_entries, report.written_bytes)
        }
        ArchiveFamily::Rar | ArchiveFamily::Archive => {
            let mut writer = DynWriteAdapter { inner: output };
            let report = zmanager_core::libarchive_backend::copy_archive_files_to_writer(
                archive_path,
                password,
                |name| archive_entry_key(name) == archive_entry_key(entry_path),
                &mut writer,
            )
            .map_err(map_libarchive_error)?;
            one_streamed_entry_bytes(entry_path, report.written_entries, report.written_bytes)
        }
    }
}

fn stream_archive_family(archive_path: &Path) -> ArchiveFamily {
    let family = detect_archive_family(&archive_path.to_string_lossy());
    if family == ArchiveFamily::Zip
        && zmanager_core::libarchive_backend::is_split_zip_path(archive_path)
    {
        ArchiveFamily::Archive
    } else {
        family
    }
}

fn one_streamed_entry_bytes(
    entry_path: &str,
    written_entries: usize,
    written_bytes: u64,
) -> Result<u64, CommandErrorDto> {
    if written_entries == 1 {
        return Ok(written_bytes);
    }

    if written_entries == 0 {
        return Err(CommandErrorDto::not_found(
            format!("archive entry was not streamed: {entry_path}"),
            Some("Open the archive again or choose a regular file entry.".to_string()),
        ));
    }

    Err(CommandErrorDto::operation_failed(format!(
        "archive streamed {written_entries} files for one drag-out entry: {entry_path}"
    )))
}

struct DynWriteAdapter<'a> {
    inner: &'a mut dyn Write,
}

impl Write for DynWriteAdapter<'_> {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        self.inner.write(buffer)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

fn map_overwrite_policy(policy: crate::dto::OverwritePolicyDto) -> OverwritePolicy {
    match policy {
        crate::dto::OverwritePolicyDto::Refuse => OverwritePolicy::Refuse,
        crate::dto::OverwritePolicyDto::Replace => OverwritePolicy::Replace,
        crate::dto::OverwritePolicyDto::Rename => OverwritePolicy::Rename,
        crate::dto::OverwritePolicyDto::Ask => OverwritePolicy::Ask,
    }
}

fn extraction_policy(
    overwrite: crate::dto::OverwritePolicyDto,
    strip_components: usize,
) -> ExtractionPolicy {
    ExtractionPolicy {
        overwrite: map_overwrite_policy(overwrite),
        unsafe_file: UnsafeFilePolicy::Reject,
        include_patterns: Vec::new(),
        exclude_patterns: Vec::new(),
        strip_components,
        limits: Default::default(),
    }
}

fn to_terminal_summary_for_zip_create(report: ZipCreateReport) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: None,
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    }
}

fn to_terminal_summary_for_tar_create(report: TarZstdCreateReport) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: None,
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    }
}

fn to_terminal_summary_for_tzap_create(report: TzapCreateReport) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: None,
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    }
}

fn to_terminal_summary_for_seven_create(report: SevenZCreateReport) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: None,
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    }
}

fn to_terminal_summary_for_extract(report: impl ExtractSummary) -> JobTerminalSummaryDto {
    report.into_summary()
}

fn to_terminal_summary_for_zip_test(
    report: zmanager_core::zip_backend::ZipTestReport,
) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.tested_entries,
        skipped_entries: Some(report.skipped_entries),
        written_bytes: report.tested_bytes,
        warnings: Vec::new(),
    }
}

fn to_terminal_summary_for_tzap_test(
    report: zmanager_core::tzap_backend::TzapTestReport,
) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.tested_entries,
        skipped_entries: Some(report.skipped_entries),
        written_bytes: report.tested_bytes,
        warnings: report
            .x509_root_auth
            .map(|verification| {
                let mut warnings = Vec::with_capacity(1 + verification.diagnostics.len());
                warnings.push(format!(
                    "tzap root-auth verified for {}",
                    verification.subject
                ));
                warnings.extend(verification.diagnostics);
                warnings
            })
            .unwrap_or_default(),
    }
}

fn to_terminal_summary_for_libarchive_test(
    report: zmanager_core::libarchive_backend::LibarchiveTestReport,
) -> JobTerminalSummaryDto {
    JobTerminalSummaryDto {
        written_entries: report.tested_entries,
        skipped_entries: Some(report.skipped_entries),
        written_bytes: report.tested_bytes,
        warnings: Vec::new(),
    }
}

trait ExtractSummary {
    fn into_summary(self) -> JobTerminalSummaryDto;
}

impl ExtractSummary for zmanager_core::zip_backend::ZipExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

impl ExtractSummary for zmanager_core::tar_zst_backend::TarZstdExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

impl ExtractSummary for zmanager_core::sevenz_backend::SevenZExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

impl ExtractSummary for zmanager_core::rar_backend::RarExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

impl ExtractSummary for zmanager_core::libarchive_backend::LibarchiveExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

impl ExtractSummary for zmanager_core::tzap_backend::TzapExtractReport {
    fn into_summary(self) -> JobTerminalSummaryDto {
        JobTerminalSummaryDto {
            written_entries: self.written_entries,
            skipped_entries: Some(self.skipped_entries),
            written_bytes: self.written_bytes,
            warnings: self.warnings,
        }
    }
}

fn normalize_non_empty_paths(paths: &[String]) -> Result<Vec<PathBuf>, CommandErrorDto> {
    let mut normalized = Vec::new();

    for path in paths {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            continue;
        }
        normalized.push(PathBuf::from(trimmed));
    }

    if normalized.is_empty() {
        return Err(CommandErrorDto::invalid_request(
            "at least one source path is required",
        ));
    }

    Ok(normalized)
}

fn normalize_optional_entry_paths(
    paths: Option<Vec<String>>,
) -> Result<Vec<String>, CommandErrorDto> {
    let Some(paths) = paths else {
        return Ok(Vec::new());
    };

    let normalized = paths
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        return Err(CommandErrorDto::invalid_request(
            "at least one selected entry path is required",
        ));
    }

    Ok(normalized)
}

fn validate_source_paths_exist(sources: &[PathBuf]) -> Result<(), CommandErrorDto> {
    for source in sources {
        std::fs::metadata(source).map_err(|source_error| {
            if source_error.kind() == io::ErrorKind::NotFound {
                CommandErrorDto::not_found(
                    format!("source path does not exist: {}", source.to_string_lossy()),
                    Some(
                        "Select an existing file or folder before creating an archive.".to_string(),
                    ),
                )
            } else {
                map_io_error(source.to_string_lossy().to_string(), source_error)
            }
        })?;
    }
    Ok(())
}

fn ensure_non_empty_path(value: String, field: &str) -> Result<String, CommandErrorDto> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(CommandErrorDto::invalid_request(format!(
            "{field} cannot be empty"
        )));
    }

    Ok(value)
}

fn next_available_destination_path(path: &str) -> String {
    let candidate = Path::new(path);
    if !candidate.exists() {
        return path.to_string();
    }

    let parent = candidate.parent().unwrap_or(Path::new(""));
    let file_name = candidate
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path);
    let (stem, suffix) = split_collision_name(file_name);

    for index in 2..10_000 {
        let renamed = parent.join(format!("{stem} {index}{suffix}"));
        if !renamed.exists() {
            return renamed.to_string_lossy().to_string();
        }
    }

    path.to_string()
}

fn split_collision_name(name: &str) -> (&str, &str) {
    const COMPOUND_SUFFIXES: &[&str] = &[
        ".tar.br",
        ".tar.bz2",
        ".tar.gz",
        ".tar.lz",
        ".tar.lz4",
        ".tar.lzma",
        ".tar.lzo",
        ".tar.lrz",
        ".tar.xz",
        ".tar.z",
        ".tar.zst",
    ];

    let lower_name = name.to_ascii_lowercase();
    for suffix in COMPOUND_SUFFIXES {
        if lower_name.ends_with(suffix) && name.len() > suffix.len() {
            return name.split_at(name.len() - suffix.len());
        }
    }

    if let Some(dot_index) = name.rfind('.') {
        if dot_index > 0 {
            return name.split_at(dot_index);
        }
    }

    (name, "")
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ArchiveFamily {
    Zip,
    TarZst,
    SevenZ,
    Rar,
    Tzap,
    Archive,
}

fn detect_archive_family(path: &str) -> ArchiveFamily {
    let path = Path::new(path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    if matches!(
        extension.as_deref(),
        Some("zip")
            | Some("zipx")
            | Some("jar")
            | Some("war")
            | Some("ipa")
            | Some("apk")
            | Some("appx")
            | Some("xpi")
            | Some("z01")
            | Some("z02")
            | Some("z03")
    ) {
        ArchiveFamily::Zip
    } else if matches!(
        extension.as_deref(),
        Some("tzst") | Some("tzap") | Some("7z")
    ) {
        match extension.as_deref() {
            Some("7z") => ArchiveFamily::SevenZ,
            Some("tzap") => ArchiveFamily::Tzap,
            Some("tzst") => ArchiveFamily::TarZst,
            _ => ArchiveFamily::Archive,
        }
    } else if extension == Some("zst".to_string())
        && stem.is_some_and(|value| value.ends_with(".tar"))
    {
        ArchiveFamily::TarZst
    } else if extension == Some("rar".to_string()) {
        ArchiveFamily::Rar
    } else if zmanager_core::tzap_backend::is_tzap_archive_path(path) {
        ArchiveFamily::Tzap
    } else {
        ArchiveFamily::Archive
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::OverwritePolicyDto;
    use crate::job_dto::JobStatusDto;
    use crate::quick_action::QuickActionStartupState;
    use std::env;
    use std::ffi::OsString;
    use std::fs;
    use std::io::Error;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use zmanager_core::safety::ExtractionSafetyError;

    #[test]
    fn completion_fallback_marks_successful_job_terminal_without_core_completed_event() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::TzapExtract);

        complete_job_if_needed(
            &registry,
            &response.job_id,
            JobKindDto::TzapExtract,
            JobTerminalSummaryDto {
                written_entries: 2,
                skipped_entries: None,
                written_bytes: 42,
                warnings: Vec::new(),
            },
        );

        let poll = registry
            .poll_events(&response.job_id)
            .expect("fallback-completed job should remain pollable");
        assert_eq!(poll.status, JobStatusDto::Completed);
        assert!(poll.can_dismiss);
        assert_eq!(
            poll.terminal_summary
                .expect("terminal summary should be retained")
                .written_bytes,
            42
        );
        assert!(poll.events.iter().any(|event| {
            event.event_type == JobEventKindDto::Completed
                && event.total_bytes_processed == Some(42)
                && event.entries == Some(2)
        }));
    }

    #[test]
    fn completion_fallback_does_not_override_cancelled_job() {
        let registry = JobRegistry::new();
        let (response, _) = registry.create_job(JobKindDto::ZipExtract);
        registry.emit_direct_event(
            &response.job_id,
            JobEventDto {
                event_type: JobEventKindDto::Cancelled,
                job_kind: Some(JobKindDto::ZipExtract),
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
                message: Some("cancelled".to_string()),
            },
        );

        complete_job_if_needed(
            &registry,
            &response.job_id,
            JobKindDto::ZipExtract,
            JobTerminalSummaryDto {
                written_entries: 1,
                skipped_entries: None,
                written_bytes: 12,
                warnings: Vec::new(),
            },
        );

        let poll = registry
            .poll_events(&response.job_id)
            .expect("cancelled job should remain pollable");
        assert_eq!(poll.status, JobStatusDto::Cancelled);
        assert!(
            !poll
                .events
                .iter()
                .any(|event| event.event_type == JobEventKindDto::Completed)
        );
    }

    #[test]
    fn virtual_drag_display_path_uses_current_folder_depth() {
        assert_eq!(
            virtual_drag_display_path("docs/readme.txt", 1).unwrap(),
            "readme.txt"
        );
        assert_eq!(
            virtual_drag_display_path("docs/nested/readme.txt", 1).unwrap(),
            "nested\\readme.txt"
        );
        assert!(virtual_drag_display_path("docs", 1).is_err());
    }

    #[test]
    fn virtual_drag_display_path_rejects_windows_unsafe_names() {
        for path in [
            "../escape.txt",
            "docs/CON.txt",
            "docs/name:stream.txt",
            "docs/trailing-dot.",
            "docs/trailing-space ",
        ] {
            assert!(
                virtual_drag_display_path(path, 0).is_err(),
                "{path} should be rejected"
            );
        }
    }

    #[test]
    fn native_drag_items_expand_folders_to_regular_file_descendants() {
        let entries = vec![
            browser_entry(
                "docs",
                zmanager_core::archive_browser::BrowserEntryKind::Directory,
            ),
            browser_entry(
                "docs/a.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "docs/nested/b.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "other.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
        ];

        let items = native_drag_items_from_listing(&entries, &["docs".to_string()], 1).unwrap();

        assert_eq!(
            items
                .iter()
                .map(|item| item.display_path.as_str())
                .collect::<Vec<_>>(),
            vec!["a.txt", "nested\\b.txt"]
        );
    }

    #[test]
    fn native_drag_items_expand_synthetic_folder_prefixes() {
        let entries = vec![
            browser_entry(
                "folder/alpha.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "folder/beta.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "root.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
        ];

        let items = native_drag_items_from_listing(&entries, &["folder".to_string()], 0).unwrap();

        assert_eq!(
            items
                .iter()
                .map(|item| item.display_path.as_str())
                .collect::<Vec<_>>(),
            vec!["folder\\alpha.txt", "folder\\beta.txt"]
        );
    }

    #[test]
    fn native_drag_items_reject_duplicate_display_paths() {
        let entries = vec![
            browser_entry(
                "one/readme.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "two/README.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
        ];

        let error = native_drag_items_from_listing(
            &entries,
            &["one/readme.txt".to_string(), "two/README.txt".to_string()],
            1,
        )
        .unwrap_err();

        assert_eq!(error.code, constants::COMMAND_ERROR_INVALID_REQUEST);
    }

    fn browser_entry(
        path: &str,
        kind: zmanager_core::archive_browser::BrowserEntryKind,
    ) -> zmanager_core::archive_browser::BrowserEntry {
        zmanager_core::archive_browser::BrowserEntry {
            path: path.to_string(),
            kind,
            size: Some(1),
            compressed_size: None,
            modified: Some("1700000000".to_string()),
        }
    }

    #[test]
    fn list_archive_rejects_empty_path() {
        let error = list_archive(crate::dto::ListArchiveRequest {
            archive_path: "".to_string(),
            password: None,
        })
        .unwrap_err();

        assert_eq!(error.code, constants::COMMAND_ERROR_INVALID_REQUEST);
        assert!(!error.message.is_empty());
    }

    #[test]
    fn missing_archive_maps_not_found_or_io_error() {
        let missing = env::temp_dir().join(".zmanager-does-not-exist.zip");
        let error = list_archive(crate::dto::ListArchiveRequest {
            archive_path: missing.to_string_lossy().to_string(),
            password: None,
        })
        .unwrap_err();

        assert!(
            error.code == constants::COMMAND_ERROR_NOT_FOUND
                || error.code == constants::COMMAND_ERROR_IO_ERROR
        );
    }

    #[test]
    fn mapping_does_not_leak_password_text() {
        let password = "super-secret-password";
        let missing = env::temp_dir().join(".zmanager-does-not-exist.zip");
        let error = list_archive(crate::dto::ListArchiveRequest {
            archive_path: missing.to_string_lossy().to_string(),
            password: Some(password.to_string()),
        })
        .unwrap_err();

        assert!(!error.message.contains(password));
        assert!(
            !error
                .hint
                .as_ref()
                .is_some_and(|value| value.contains(password))
        );
    }

    #[test]
    fn mapping_password_required_is_distinct_from_invalid_password() {
        let password_required = map_zip_error(ZipBackendError::PasswordRequired);
        let invalid_password = map_zip_error(ZipBackendError::InvalidPassword);

        assert_eq!(
            password_required.code,
            crate::constants::COMMAND_ERROR_PASSWORD_REQUIRED
        );
        assert_eq!(
            invalid_password.code,
            crate::constants::COMMAND_ERROR_INVALID_PASSWORD
        );
        assert_ne!(password_required.code, invalid_password.code);
    }

    #[test]
    fn mapping_safety_errors_to_unsafe_archive() {
        let safety_error = map_zip_error(ZipBackendError::Safety(
            ExtractionSafetyError::UnsafeFileType {
                archive_path: "blocked".to_string(),
            },
        ));

        assert_eq!(
            safety_error.code,
            crate::constants::COMMAND_ERROR_UNSAFE_ARCHIVE
        );
    }

    #[test]
    fn quick_action_startup_state_command_exposes_pending_intent() {
        let state = QuickActionStartupState::from_args(
            ["--quick-action", "open", "--path", "C:/tmp/one.zip"]
                .into_iter()
                .map(OsString::from),
        );

        let registry = JobRegistry::new();
        let response = quick_action_startup_state_internal(&state, &registry);

        assert!(response.launched_for_quick_action);
        assert!(response.error.is_none());
        let quick_action = response
            .quick_action
            .expect("quick action intent should be present");
        assert_eq!(quick_action.kind, crate::dto::QuickActionKindDto::Open);
        assert_eq!(quick_action.paths, ["C:/tmp/one.zip"]);
    }

    #[test]
    fn quick_action_startup_state_command_exposes_invalid_launch() {
        let state = QuickActionStartupState::from_args(
            [
                "--quick-action",
                "extract-to-folder",
                "--path",
                "one.zip",
                "two.zip",
            ]
            .into_iter()
            .map(OsString::from),
        );

        let registry = JobRegistry::new();
        let response = quick_action_startup_state_internal(&state, &registry);

        assert!(response.launched_for_quick_action);
        assert!(response.quick_action.is_none());
        let error = response
            .error
            .expect("invalid launch should include an error");
        assert_eq!(error.code, constants::COMMAND_ERROR_INVALID_REQUEST);
        assert_eq!(
            error.message,
            "extract-to-folder requires exactly one archive path"
        );
    }

    #[test]
    fn normalize_non_empty_paths_trims_and_rejects_empty_values() {
        let normalized = normalize_non_empty_paths(&[
            "  C:/tmp/src ".to_string(),
            "   ".to_string(),
            "".to_string(),
            "C:/tmp/dest".to_string(),
        ])
        .expect("non-empty paths should parse");

        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0].to_string_lossy(), "C:/tmp/src".to_string());
        assert_eq!(normalized[1].to_string_lossy(), "C:/tmp/dest".to_string());
    }

    #[test]
    fn normalize_non_empty_paths_rejects_only_blank_paths() {
        let result = normalize_non_empty_paths(&["".to_string(), "   ".to_string()]);
        assert!(result.is_err());
    }

    #[test]
    fn detect_archive_family_is_case_insensitive_and_handles_windows_drive() {
        assert_eq!(
            detect_archive_family(r"C:\\Users\\me\\archive.ZIP"),
            ArchiveFamily::Zip
        );
        assert_eq!(
            detect_archive_family(r"D:\\archives\\report.TAR.ZST"),
            ArchiveFamily::TarZst
        );
        assert_eq!(
            detect_archive_family(r"\\\\server\\share\\bundle.TZAP"),
            ArchiveFamily::Tzap
        );
    }

    #[test]
    fn detect_archive_family_supports_tar_zst_double_extension_and_plain_tar() {
        assert_eq!(
            detect_archive_family("/tmp/archive.tar.zst"),
            ArchiveFamily::TarZst
        );
    }

    #[test]
    fn ensure_non_empty_path_trims_whitespace() {
        assert_eq!(
            ensure_non_empty_path("  C:/tmp/archive.zip  ".to_string(), "archivePath")
                .expect("path should trim to valid value"),
            "C:/tmp/archive.zip"
        );

        assert!(
            ensure_non_empty_path("   ".to_string(), "archivePath").is_err(),
            "blank path should not pass",
        );
    }

    #[test]
    fn normalize_non_empty_paths_accepts_windows_and_long_paths() {
        let very_long_leaf = format!("{}{}", "nested/", "a".repeat(1024),);
        let win_like = format!("C:\\tmp\\{very_long_leaf}.zip");

        let normalized = normalize_non_empty_paths(&[
            r"  C:\tmp\my archive.zip  ".to_string(),
            win_like.clone(),
        ])
        .expect("windows-like and long-like paths should normalize");

        assert_eq!(normalized[0].to_string_lossy(), "C:\\tmp\\my archive.zip");
        assert_eq!(normalized[1].to_string_lossy(), win_like);
        assert_eq!(normalized.len(), 2);
    }

    #[test]
    fn map_io_error_preserves_retryability_for_non_retryable_cases() {
        let denied = map_io_error(
            "C:/restricted/path".to_string(),
            Error::new(io::ErrorKind::PermissionDenied, "forbidden"),
        );
        assert_eq!(denied.code, constants::COMMAND_ERROR_IO_ERROR);
        assert!(!denied.retryable);
    }

    #[test]
    fn detect_archive_family_handles_windows_backslashes_and_collision_cases() {
        assert_eq!(
            detect_archive_family(r"C:\temp\ARCHIVE.ZIp"),
            ArchiveFamily::Zip
        );
        assert_eq!(
            detect_archive_family(r"D:\\WORK\\report.TAR.ZST"),
            ArchiveFamily::TarZst
        );
    }

    fn create_temp_workspace(name: &str) -> PathBuf {
        let now_nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let base = env::temp_dir().join(format!("zmanager-command-{name}-{now_nanos}"));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("temporary workspace should be created");
        base
    }

    fn wait_for_job_terminal(
        registry: &crate::job_registry::JobRegistry,
        job_id: &str,
    ) -> (PollJobEventsResponseDto, Vec<JobEventDto>) {
        let mut all_events = Vec::new();

        for _ in 0..400 {
            let poll = registry
                .poll_events(job_id)
                .expect("job should stay available while waiting for terminal state");
            all_events.extend_from_slice(&poll.events);
            if poll.status.is_terminal() {
                return (poll, all_events);
            }
            std::thread::sleep(Duration::from_millis(25));
        }

        panic!("timed out while waiting for job to complete");
    }

    #[test]
    fn recovery_smoke_create_open_test_extract_zip_end_to_end() {
        let workspace = create_temp_workspace("recovery-smoke");
        let source = workspace.join("source");
        let nested = source.join("nested");
        let destination_archive = workspace.join("created.zip");
        let extract_destination = workspace.join("extracted");
        fs::create_dir_all(&nested).expect("nested fixture directory should exist");
        fs::create_dir_all(&extract_destination).expect("extract destination should exist");
        fs::write(source.join("hello.txt"), b"hello smoke").expect("hello fixture should write");
        fs::write(nested.join("readme.md"), b"# smoke").expect("nested fixture should write");

        let registry = crate::job_registry::JobRegistry::new();
        let create_job = start_create_internal(
            StartCreateRequest {
                sources: vec![source.to_string_lossy().to_string()],
                destination_path: destination_archive.to_string_lossy().to_string(),
                format: crate::dto::ArchiveFormatDto::Zip,
                clean_source: false,
                replace_existing: true,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: None,
                compression_level: None,
                volume_size: None,
                preserve_metadata: false,
            },
            &registry,
        )
        .expect("smoke create should start");

        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);
        assert!(
            destination_archive.is_file(),
            "smoke archive should be written"
        );

        let listing = list_archive(crate::dto::ListArchiveRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            password: None,
        })
        .expect("smoke archive should list");
        let listed_paths = listing
            .entries
            .iter()
            .map(|entry| entry.path.as_str())
            .collect::<Vec<_>>();
        assert!(listed_paths.contains(&"source/hello.txt"));
        assert!(listed_paths.contains(&"source/nested/readme.md"));

        let test_job = start_test_archive_internal(
            TestArchiveRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                password: None,
            },
            &registry,
        )
        .expect("smoke test archive should start");
        let (test_poll, _) = wait_for_job_terminal(&registry, &test_job.job_id);
        assert_eq!(test_poll.status, JobStatusDto::Completed);

        let extract_job = start_extract_internal(
            StartExtractRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                destination_path: extract_destination.to_string_lossy().to_string(),
                password: None,
                overwrite: OverwritePolicyDto::Replace,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                entry_paths: None,
                strip_components: 0,
            },
            &registry,
        )
        .expect("smoke extract should start");
        let (extract_poll, _) = wait_for_job_terminal(&registry, &extract_job.job_id);
        assert_eq!(extract_poll.status, JobStatusDto::Completed);
        assert_eq!(
            fs::read_to_string(extract_destination.join("source").join("hello.txt"))
                .expect("extracted hello should be readable"),
            "hello smoke"
        );
        assert_eq!(
            fs::read_to_string(
                extract_destination
                    .join("source")
                    .join("nested")
                    .join("readme.md"),
            )
            .expect("extracted nested file should be readable"),
            "# smoke"
        );

        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn recovery_smoke_password_required_invalid_and_valid_zip_flow() {
        let workspace = create_temp_workspace("recovery-password-smoke");
        let source = workspace.join("source");
        let destination_archive = workspace.join("protected.zip");
        fs::create_dir_all(&source).expect("password smoke source should exist");
        fs::write(source.join("secret.txt"), b"protected smoke")
            .expect("password smoke fixture should write");

        let registry = crate::job_registry::JobRegistry::new();
        let create_job = start_create_internal(
            StartCreateRequest {
                sources: vec![source.to_string_lossy().to_string()],
                destination_path: destination_archive.to_string_lossy().to_string(),
                format: crate::dto::ArchiveFormatDto::Zip,
                clean_source: false,
                replace_existing: true,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: Some("smoke-secret".to_string()),
                compression_level: None,
                volume_size: None,
                preserve_metadata: false,
            },
            &registry,
        )
        .expect("password smoke create should start");

        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let listing = list_archive(crate::dto::ListArchiveRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            password: Some("smoke-secret".to_string()),
        })
        .expect("valid password should list protected archive");

        assert!(
            listing
                .entries
                .iter()
                .any(|entry| entry.path == "source/secret.txt"),
            "protected smoke archive should list expected file",
        );

        let missing_password_job = start_extract_internal(
            StartExtractRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                destination_path: workspace
                    .join("missing-password")
                    .to_string_lossy()
                    .to_string(),
                password: None,
                overwrite: OverwritePolicyDto::Replace,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                entry_paths: None,
                strip_components: 0,
            },
            &registry,
        )
        .expect("missing-password extract should start");
        let (missing_password_poll, missing_password_events) =
            wait_for_job_terminal(&registry, &missing_password_job.job_id);
        assert_eq!(missing_password_poll.status, JobStatusDto::Failed);
        assert!(
            missing_password_events
                .iter()
                .any(|event| event.code.as_deref()
                    == Some(constants::COMMAND_ERROR_PASSWORD_REQUIRED)),
            "missing password extract should fail with password_required",
        );

        let invalid_password_job = start_extract_internal(
            StartExtractRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                destination_path: workspace
                    .join("invalid-password")
                    .to_string_lossy()
                    .to_string(),
                password: Some("wrong-password".to_string()),
                overwrite: OverwritePolicyDto::Replace,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                entry_paths: None,
                strip_components: 0,
            },
            &registry,
        )
        .expect("invalid-password extract should start");
        let (invalid_password_poll, invalid_password_events) =
            wait_for_job_terminal(&registry, &invalid_password_job.job_id);
        assert_eq!(invalid_password_poll.status, JobStatusDto::Failed);
        assert!(
            invalid_password_events
                .iter()
                .any(|event| event.code.as_deref()
                    == Some(constants::COMMAND_ERROR_INVALID_PASSWORD)),
            "invalid password extract should fail with invalid_password",
        );
        assert!(
            invalid_password_events
                .iter()
                .filter_map(|event| event.message.as_deref())
                .all(|message| !message.contains("wrong-password")),
            "invalid password diagnostics must not leak the attempted password",
        );

        let valid_extract_destination = workspace.join("valid-password");
        fs::create_dir_all(&valid_extract_destination)
            .expect("valid password destination should exist");
        let valid_password_job = start_extract_internal(
            StartExtractRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                destination_path: valid_extract_destination.to_string_lossy().to_string(),
                password: Some("smoke-secret".to_string()),
                overwrite: OverwritePolicyDto::Replace,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                entry_paths: None,
                strip_components: 0,
            },
            &registry,
        )
        .expect("valid-password extract should start");
        let (valid_password_poll, valid_password_events) =
            wait_for_job_terminal(&registry, &valid_password_job.job_id);
        assert_eq!(valid_password_poll.status, JobStatusDto::Completed);
        assert!(
            valid_password_events
                .iter()
                .filter_map(|event| event.message.as_deref())
                .all(|message| !message.contains("smoke-secret")),
            "valid password diagnostics must not leak the password",
        );
        assert_eq!(
            fs::read_to_string(valid_extract_destination.join("source").join("secret.txt"))
                .expect("valid password extraction should write protected file"),
            "protected smoke",
        );

        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_create_job_reaches_terminal_and_writes_archive() {
        let workspace = create_temp_workspace("start-create");
        let sources = workspace.join("sources");
        let destination = workspace.join("created.zip");
        fs::create_dir_all(&sources).expect("source directory should exist");

        fs::write(sources.join("hello.txt"), b"hello from create")
            .expect("fixture file should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Zip,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job = start_create_internal(create_request, &registry)
            .expect("create command should start a job");
        let (create_poll, mut create_events) = wait_for_job_terminal(&registry, &create_job.job_id);

        create_events.extend_from_slice(&create_poll.events);

        assert_eq!(create_poll.status, JobStatusDto::Completed);
        assert_eq!(create_poll.kind, JobKindDto::ZipCreate);
        assert!(
            create_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Started)),
            "create lifecycle should emit a started event",
        );
        assert!(
            create_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "create lifecycle should emit a completed event",
        );
        assert!(create_poll.terminal_summary.is_some());
        assert!(destination.is_file());
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_create_renames_existing_destination_when_requested() {
        let workspace = create_temp_workspace("start-create-rename-destination");
        let sources = workspace.join("docs");
        let destination = workspace.join("docs.tzap");
        let renamed_destination = workspace.join("docs 2.tzap");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::write(sources.join("README.md"), b"# docs").expect("fixture file should write");
        fs::write(&destination, b"existing archive should stay untouched")
            .expect("existing destination should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            replace_existing: false,
            destination_collision_strategy: DestinationCollisionStrategyDto::Rename,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job = start_create_internal(create_request, &registry)
            .expect("create command should start a renamed-destination job");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);

        assert_eq!(create_poll.status, JobStatusDto::Completed);
        assert_eq!(
            fs::read(&destination).expect("original destination should remain readable"),
            b"existing archive should stay untouched"
        );
        assert!(
            renamed_destination.is_file(),
            "renamed archive destination should be written"
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_tzap_create_job_reaches_terminal_and_writes_archive() {
        let workspace = create_temp_workspace("start-create-tzap");
        let sources = workspace.join("sources");
        let destination = workspace.join("created.tzap");
        fs::create_dir_all(&sources).expect("source directory should exist");

        fs::write(sources.join("hello.txt"), b"hello from tzap create")
            .expect("fixture file should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job = start_create_internal(create_request, &registry)
            .expect("create command should start a job");
        let (create_poll, mut create_events) = wait_for_job_terminal(&registry, &create_job.job_id);

        create_events.extend_from_slice(&create_poll.events);

        assert_eq!(create_poll.status, JobStatusDto::Completed);
        assert_eq!(create_poll.kind, JobKindDto::TzapCreate);
        assert!(
            create_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Started)),
            "create lifecycle should emit a started event",
        );
        assert!(
            create_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "create lifecycle should emit a completed event",
        );
        assert!(create_poll.terminal_summary.is_some());
        assert!(destination.is_file());
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_tzap_extract_job_reaches_terminal_and_outputs_expected_file() {
        let workspace = create_temp_workspace("start-extract-tzap");
        let sources = workspace.join("sources");
        let destination_archive = workspace.join("fixture.tzap");
        let extract_destination = workspace.join("extracted");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::create_dir_all(&extract_destination).expect("extract directory should exist");

        fs::write(sources.join("README.md"), b"# extractor").expect("fixture file should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination_archive.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let extract_request = StartExtractRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            destination_path: extract_destination.to_string_lossy().to_string(),
            password: None,
            overwrite: OverwritePolicyDto::Replace,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            entry_paths: None,
            strip_components: 0,
        };
        let extract_job = start_extract_internal(extract_request, &registry)
            .expect("extract command should start a job");
        let (extract_poll, mut extract_events) =
            wait_for_job_terminal(&registry, &extract_job.job_id);
        extract_events.extend_from_slice(&extract_poll.events);

        assert_eq!(extract_poll.status, JobStatusDto::Completed);
        assert_eq!(extract_poll.kind, JobKindDto::TzapExtract);
        assert!(
            extract_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Started)),
            "extract lifecycle should emit a started event",
        );
        assert!(
            extract_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "extract lifecycle should emit a completed event",
        );
        assert!(extract_poll.terminal_summary.is_some());

        assert_eq!(
            fs::read_to_string(extract_destination.join("sources").join("README.md"))
                .expect("extracted README should be readable"),
            "# extractor"
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_extract_renames_existing_destination_when_requested() {
        let workspace = create_temp_workspace("start-extract-rename-destination");
        let sources = workspace.join("sources");
        let destination_archive = workspace.join("fixture.zip");
        let extract_destination = workspace.join("extracted");
        let renamed_extract_destination = workspace.join("extracted 2");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::create_dir_all(&extract_destination).expect("existing extract directory should exist");
        fs::write(sources.join("README.md"), b"# extractor").expect("fixture file should write");
        fs::write(extract_destination.join("marker.txt"), b"keep")
            .expect("existing destination marker should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination_archive.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Zip,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let extract_request = StartExtractRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            destination_path: extract_destination.to_string_lossy().to_string(),
            password: None,
            overwrite: OverwritePolicyDto::Rename,
            destination_collision_strategy: DestinationCollisionStrategyDto::Rename,
            entry_paths: None,
            strip_components: 0,
        };
        let extract_job = start_extract_internal(extract_request, &registry)
            .expect("extract command should start a renamed-destination job");
        let (extract_poll, _) = wait_for_job_terminal(&registry, &extract_job.job_id);

        assert_eq!(extract_poll.status, JobStatusDto::Completed);
        assert_eq!(
            fs::read_to_string(extract_destination.join("marker.txt"))
                .expect("existing destination marker should remain"),
            "keep"
        );
        assert!(
            renamed_extract_destination
                .join("sources")
                .join("README.md")
                .is_file(),
            "renamed extract destination should receive archive contents"
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_extract_job_reaches_terminal_and_outputs_expected_file() {
        let workspace = create_temp_workspace("start-extract");
        let sources = workspace.join("sources");
        let destination_archive = workspace.join("fixture.zip");
        let extract_destination = workspace.join("extracted");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::create_dir_all(&extract_destination).expect("extract directory should exist");

        fs::write(sources.join("README.md"), b"# extractor").expect("fixture file should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination_archive.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Zip,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let extract_request = StartExtractRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            destination_path: extract_destination.to_string_lossy().to_string(),
            password: None,
            overwrite: OverwritePolicyDto::Replace,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            entry_paths: None,
            strip_components: 0,
        };
        let extract_job = start_extract_internal(extract_request, &registry)
            .expect("extract command should start a job");
        let (extract_poll, mut extract_events) =
            wait_for_job_terminal(&registry, &extract_job.job_id);
        extract_events.extend_from_slice(&extract_poll.events);

        let extracted_file = extract_destination.join("sources").join("README.md");

        assert_eq!(extract_poll.status, JobStatusDto::Completed);
        assert_eq!(extract_poll.kind, JobKindDto::ZipExtract);
        assert!(
            extract_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "extract lifecycle should emit a completed event",
        );
        assert!(extracted_file.is_file());
        assert_eq!(
            fs::read_to_string(&extracted_file).expect("extracted file should be readable"),
            "# extractor"
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_extract_selected_entries_uses_job_lifecycle() {
        let workspace = create_temp_workspace("start-extract-selected");
        let sources = workspace.join("sources");
        let destination_archive = workspace.join("fixture.zip");
        let extract_destination = workspace.join("selected");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::create_dir_all(&extract_destination).expect("extract directory should exist");

        fs::write(sources.join("keep.txt"), b"keep me").expect("selected fixture should write");
        fs::write(sources.join("skip.txt"), b"skip me").expect("unselected fixture should write");

        let registry = crate::job_registry::JobRegistry::new();
        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination_archive.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Zip,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let extract_request = StartExtractRequest {
            archive_path: destination_archive.to_string_lossy().to_string(),
            destination_path: extract_destination.to_string_lossy().to_string(),
            password: None,
            overwrite: OverwritePolicyDto::Replace,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            entry_paths: Some(vec!["sources/keep.txt".to_string()]),
            strip_components: 0,
        };
        let extract_job = start_extract_internal(extract_request, &registry)
            .expect("selected extract command should start a job");
        let (extract_poll, mut extract_events) =
            wait_for_job_terminal(&registry, &extract_job.job_id);
        extract_events.extend_from_slice(&extract_poll.events);

        let extracted_file = extract_destination.join("sources").join("keep.txt");
        let skipped_file = extract_destination.join("sources").join("skip.txt");

        assert_eq!(extract_poll.status, JobStatusDto::Completed);
        assert_eq!(extract_poll.kind, JobKindDto::ZipExtract);
        let finished_event = extract_events
            .iter()
            .find(|event| matches!(event.event_type, JobEventKindDto::EntryFinished))
            .expect("selected extract should retain the latest finished entry for file counts");
        assert_eq!(finished_event.entries, Some(1));
        assert_eq!(finished_event.total_entries, Some(1));
        assert!(
            extract_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "selected extract lifecycle should emit a completed event",
        );
        assert!(
            extract_poll
                .terminal_summary
                .as_ref()
                .is_some_and(|summary| summary.written_entries == 1),
            "selected extract should include a one-entry terminal summary",
        );
        assert!(extracted_file.is_file());
        assert!(!skipped_file.exists());
        assert_eq!(
            fs::read_to_string(&extracted_file).expect("selected file should be readable"),
            "keep me"
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_create_rejects_directory_destination_path() {
        let workspace = create_temp_workspace("start-create-directory-destination");
        let sources = workspace.join("sources");
        let destination = workspace.join("destination-folder");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::create_dir_all(&destination).expect("destination directory should exist");
        fs::write(sources.join("hello.txt"), b"hello from create")
            .expect("fixture file should write");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };

        let error = start_create_internal(create_request, &registry)
            .expect_err("directory destination should fail");
        assert_eq!(error.code, crate::constants::COMMAND_ERROR_INVALID_REQUEST);
        assert!(error.message.contains("file path"));
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_create_rejects_missing_source() {
        let workspace = create_temp_workspace("start-create-missing-source");
        let missing_source = workspace.join("does-not-exist");
        let destination = workspace.join("created.tzap");
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![missing_source.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };

        let error = start_create_internal(create_request, &registry)
            .expect_err("missing source should fail");
        assert_eq!(error.code, crate::constants::COMMAND_ERROR_NOT_FOUND);
        assert!(error.message.contains("source path does not exist"));
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn selected_extract_reports_cancelled_without_completed_event_when_token_is_cancelled() {
        let registry = crate::job_registry::JobRegistry::new();
        let (response, token) = registry.create_job(JobKindDto::ZipExtract);
        registry
            .request_cancel(&response.job_id)
            .expect("cancel should target the selected extract job");
        assert!(
            token.is_cancelled(),
            "registry cancellation should mark the selected extract token"
        );

        let mut sink = JobEventCollector::new(&registry, response.job_id.clone());
        let summary = run_selected_extract_job(
            "unused.zip",
            "unused-destination",
            &["sources/keep.txt".to_string()],
            None,
            extraction_policy(OverwritePolicyDto::Replace, 0),
            &token,
            &mut sink,
            JobKindDto::ZipExtract,
        )
        .expect("pre-cancelled selected extract should finish with a terminal summary");

        let poll = registry
            .poll_events(&response.job_id)
            .expect("cancelled selected extract job should be pollable");

        assert_eq!(poll.status, JobStatusDto::Cancelled);
        assert_eq!(summary.written_entries, 0);
        assert_eq!(summary.written_bytes, 0);
        assert!(
            poll.events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Cancelled)),
            "selected extract should emit a cancelled event",
        );
        assert!(
            !poll
                .events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "cancelled selected extract must not emit completed",
        );
    }

    #[test]
    fn command_boundary_test_archive_job_reaches_terminal_for_valid_zip() {
        let workspace = create_temp_workspace("test-archive-valid");
        let sources = workspace.join("sources");
        let destination_archive = workspace.join("fixture.zip");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::write(sources.join("hello.txt"), b"hello from test")
            .expect("fixture file should write");

        let registry = crate::job_registry::JobRegistry::new();
        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination_archive.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Zip,
            clean_source: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let test_job = start_test_archive_internal(
            TestArchiveRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                password: None,
            },
            &registry,
        )
        .expect("test archive command should start a job");
        let (test_poll, mut test_events) = wait_for_job_terminal(&registry, &test_job.job_id);
        test_events.extend_from_slice(&test_poll.events);

        assert_eq!(test_poll.status, JobStatusDto::Completed);
        assert_eq!(test_poll.kind, JobKindDto::TestArchive);
        assert!(
            test_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Started)),
            "test lifecycle should emit a started event",
        );
        assert!(
            test_events
                .iter()
                .any(|event| matches!(event.event_type, JobEventKindDto::Completed)),
            "test lifecycle should emit a completed event",
        );
        assert!(
            test_poll
                .terminal_summary
                .as_ref()
                .is_some_and(|summary| summary.written_entries > 0),
            "successful test should include a terminal summary",
        );

        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_test_archive_job_reports_failed_for_corrupt_zip() {
        let workspace = create_temp_workspace("test-archive-corrupt");
        let archive_path = workspace.join("corrupt.zip");
        fs::write(&archive_path, b"this is not a valid zip archive")
            .expect("corrupt archive fixture should write");

        let registry = crate::job_registry::JobRegistry::new();
        let test_job = start_test_archive_internal(
            TestArchiveRequest {
                archive_path: archive_path.to_string_lossy().to_string(),
                password: None,
            },
            &registry,
        )
        .expect("test archive command should start a job");
        let (test_poll, mut test_events) = wait_for_job_terminal(&registry, &test_job.job_id);
        test_events.extend_from_slice(&test_poll.events);

        assert_eq!(test_poll.status, JobStatusDto::Failed);
        assert_eq!(test_poll.kind, JobKindDto::TestArchive);
        assert!(test_poll.terminal_summary.is_none());
        assert!(
            test_events.iter().any(|event| {
                matches!(event.event_type, JobEventKindDto::Failed)
                    && event
                        .message
                        .as_ref()
                        .is_some_and(|message| !message.is_empty())
            }),
            "failed test should emit a failure event with a message",
        );

        let _ = fs::remove_dir_all(&workspace);
    }

    #[cfg(unix)]
    #[test]
    fn list_archive_inaccessible_source_maps_to_io_error() {
        let workspace = create_temp_workspace("permission-denied");
        let archive_path = workspace.join("locked.zip");
        fs::write(&archive_path, b"not a real archive").expect("fixture should be written");

        let mut permissions = fs::metadata(&archive_path)
            .expect("fixture metadata should be readable")
            .permissions();
        permissions.set_mode(0o000);
        fs::set_permissions(&archive_path, permissions.clone())
            .expect("permissions should be restricted");

        let error = list_archive(crate::dto::ListArchiveRequest {
            archive_path: archive_path.to_string_lossy().to_string(),
            password: None,
        })
        .unwrap_err();

        assert_eq!(error.code, constants::COMMAND_ERROR_IO_ERROR);
        assert!(
            !error.retryable,
            "permission denied should not be marked retryable",
        );

        permissions.set_mode(0o644);
        let _ = fs::set_permissions(&archive_path, permissions);
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn normalize_non_empty_paths_preserves_reserved_names() {
        let normalized = normalize_non_empty_paths(&[
            r"C:\CON\archive.zip".to_string(),
            r"D:\AUX\report.TAR.ZST".to_string(),
            r"\\server\\NUL\bundle.tZAP".to_string(),
        ])
        .expect("reserved-looking names should parse as paths");

        assert_eq!(normalized[0].to_string_lossy(), r"C:\CON\archive.zip");
        assert_eq!(normalized[1].to_string_lossy(), r"D:\AUX\report.TAR.ZST");
        assert_eq!(
            normalized[2].to_string_lossy(),
            r"\\server\\NUL\bundle.tZAP"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_case_collision_is_os_case_insensitive() {
        let workspace = create_temp_workspace("case-collision");
        let root = workspace.join("root");
        let lower = root.join("archive.zip");
        let upper = root.join("ARCHIVE.ZIP");

        fs::create_dir_all(&root).expect("case-collision workspace should be created");
        fs::write(&lower, b"lower-path").expect("baseline file should be written");
        let lower_canonical = lower.canonicalize().expect("canonical path should resolve");
        let upper_canonical = upper
            .canonicalize()
            .expect("case variant should resolve to same file");

        assert_eq!(lower_canonical, upper_canonical);
        let read = fs::read_to_string(&upper).expect("case-variant path should resolve");
        assert_eq!(read, "lower-path");

        let normalized = normalize_non_empty_paths(&[
            lower.to_string_lossy().to_string(),
            upper.to_string_lossy().to_string(),
        ])
        .expect("case-variant paths should parse");
        assert_eq!(normalized.len(), 2);
        let _ = fs::remove_dir_all(&workspace);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_case_variants_are_distinct_paths() {
        let workspace = create_temp_workspace("case-variance");
        let root = workspace.join("root");
        let lower = root.join("archive.zip");
        let upper = root.join("ARCHIVE.ZIP");

        fs::create_dir_all(&root).expect("case-variant workspace should be created");
        fs::write(&lower, b"lower-path").expect("lowercase baseline file should be written");
        fs::write(&upper, b"upper-path")
            .expect("uppercase path should be separate file on case-sensitive FS");

        assert_ne!(
            lower
                .canonicalize()
                .expect("lower file path should resolve")
                .to_string_lossy()
                .to_string(),
            upper
                .canonicalize()
                .expect("upper file path should resolve")
                .to_string_lossy()
                .to_string(),
        );

        assert_eq!(
            fs::read_to_string(&lower).expect("lowercase file should be readable"),
            "lower-path"
        );
        assert_eq!(
            fs::read_to_string(&upper).expect("uppercase file should be readable"),
            "upper-path"
        );

        let _ = fs::remove_dir_all(&workspace);
    }

    #[cfg(windows)]
    #[test]
    fn windows_long_filename_semantics_remain_stable_for_create() {
        let workspace = create_temp_workspace("long-name");
        let root = workspace.join("root");
        let long_name = format!("{}.zip", "a".repeat(140));
        let long_path = root.join(long_name);

        fs::create_dir_all(&root).expect("long-name workspace should be created");
        fs::write(&long_path, b"ok").expect("long filenames should be writable");

        let normalized = normalize_non_empty_paths(&[long_path.to_string_lossy().to_string()])
            .expect("long filename should normalize");
        assert_eq!(
            normalized[0].to_string_lossy(),
            long_path.to_string_lossy().to_string()
        );
        assert!(fs::metadata(&long_path).is_ok());

        let _ = fs::remove_dir_all(&workspace);
    }
}
