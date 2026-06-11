use std::io;
use std::path::{Path, PathBuf};
use std::thread;

use tauri::State;

use crate::{
    constants,
    dto::{
        ArchiveEntryDto, ArchiveEntryKindDto, ArchiveListingResponse, CreatePlanResponse,
        EntryExtractResponse, ExtractEntryRequest, PlanCreateRequest, PollJobEventsRequest,
        PreviewEntryRequest, PreviewEntryResponse, ProjectContract, ProjectIntegrationContract,
        StartCreateRequest, StartExtractRequest, TestArchiveRequest,
    },
    error::CommandErrorDto,
    job_dto::{
        JobEventDto, JobEventKindDto, JobKindDto, JobTerminalSummaryDto, PollJobEventsResponseDto,
        StartJobResponseDto,
    },
    job_registry::{JobEventCollector, JobRegistry},
};
use zmanager_core::archive_browser::{
    self, ArchiveBrowserError, BrowserExtractOptions, BrowserListOptions,
};
use zmanager_core::jobs::{
    run_7z_create_job_from_sources_with_plan_options, run_7z_extract_job_with_password_and_policy,
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
        },
    }
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

fn start_create_internal(
    request: StartCreateRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    let sources = normalize_non_empty_paths(&request.sources)?;
    let destination_path = ensure_non_empty_path(request.destination_path, "destinationPath")?;

    let plan_options = if request.clean_source {
        PlanOptions::clean_source()
    } else {
        PlanOptions::default()
    };
    let plan_options_for_thread = plan_options;

    let kind = match request.format {
        crate::dto::ArchiveFormatDto::Zip => JobKindDto::ZipCreate,
        crate::dto::ArchiveFormatDto::TarZst => JobKindDto::TarZstdCreate,
        crate::dto::ArchiveFormatDto::Tzap => JobKindDto::TzapCreate,
        crate::dto::ArchiveFormatDto::SevenZ => JobKindDto::SevenZCreate,
    };

    let (response, token) = registry.create_job(kind);
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
                registry_for_thread.set_terminal_summary(&job_id, summary);
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

fn start_extract_internal(
    request: StartExtractRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let destination_path = ensure_non_empty_path(request.destination_path, "destinationPath")?;

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
    let registry_for_thread = registry.clone();
    let job_id = response.job_id.clone();
    let family_for_thread = family;
    let password = request
        .password
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    let policy = extraction_policy(request.overwrite, request.strip_components);
    let archive_path = archive_path;
    let destination_path = destination_path;

    thread::spawn(move || {
        let mut sink = JobEventCollector::new(&registry_for_thread, job_id.clone());
        let result = match family_for_thread {
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
        };

        match result {
            Ok(summary) => {
                registry_for_thread.set_terminal_summary(&job_id, summary);
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

#[tauri::command]
pub fn extract_entry(
    request: ExtractEntryRequest,
) -> Result<EntryExtractResponse, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    let destination_path = ensure_non_empty_path(request.destination_path, "destinationPath")?;
    let entry_path = ensure_non_empty_path(request.entry_path, "entryPath")?;

    let report = archive_browser::extract_entry_with_options(
        archive_path,
        &entry_path,
        destination_path,
        BrowserExtractOptions {
            password: request.password.as_deref(),
            overwrite: map_overwrite_policy(request.overwrite),
            strip_components: request.strip_components,
        },
    )
    .map_err(map_archive_browser_error)?;

    Ok(EntryExtractResponse {
        destination_path: report.destination_path.to_string_lossy().to_string(),
        written_bytes: report.written_bytes,
    })
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

fn ensure_non_empty_path(value: String, field: &str) -> Result<String, CommandErrorDto> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(CommandErrorDto::invalid_request(format!(
            "{field} cannot be empty"
        )));
    }

    Ok(value)
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
    use std::env;
    use std::fs;
    use std::io::Error;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use zmanager_core::safety::ExtractionSafetyError;

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
        fs::set_permissions(&archive_path, permissions).expect("permissions should be restricted");

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

    #[cfg(not(windows))]
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
