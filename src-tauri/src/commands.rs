use std::collections::HashSet;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use openssl::asn1::{Asn1Integer, Asn1Time};
use openssl::bn::{BigNum, MsbOption};
use openssl::hash::MessageDigest;
use openssl::nid::Nid;
use openssl::pkcs12::Pkcs12;
use openssl::pkey::PKey;
use openssl::rsa::Rsa;
use openssl::x509::{X509, X509NameBuilder};
use tauri::{State, WebviewWindow, ipc::Channel};

#[cfg(test)]
use crate::dto::{ArchiveEntryDto, ArchiveListingResponse};
#[cfg(test)]
use crate::job_dto::TestJobEventsSnapshot;
use crate::{
    archive_index::ArchiveIndexRegistry,
    constants,
    dto::{
        AckSubscriptionRequest, ArchiveEntryKindDto, CreatePlanEntryDto, CreatePlanResponse,
        DestinationCollisionStrategyDto, NativeFileDragOutcomeDto, NativeFileDragRequest,
        NativeFileDragResponse, PauseJobRequest, PlanCreateRequest, PreviewEntryRequest,
        PreviewEntryResponse, ProjectContract, ProjectIntegrationContract, ResumeJobRequest,
        StartCreateRequest, StartExtractRequest, SubscribeJobRequest, SubscriptionRequest,
        SystemFileIconRequest, SystemFileIconResponse, TestArchiveRequest, TzapRestorePolicyDto,
        ValidateDirectoryRequest, ValidateDirectoryResponse,
    },
    error::{CommandErrorDto, ErrorSeverityDto},
    job_dto::{
        JobActionKindDto, JobArtifactKindDto, JobAvailableActionDto, JobCatalogEnvelopeDto,
        JobControlResponseDto, JobEventDto, JobEventKindDto, JobKindDto, JobOutputArtifactDto,
        JobRetryDescriptorDto, JobSnapshotEnvelopeDto, JobTerminalSummaryDto, StartJobResponseDto,
    },
    job_registry::{JobEventCollector, JobRegistry, forward_latest_values},
    native_launch_inbox::NativeLaunchInbox,
    quick_action::QuickActionLaunchCoordinator,
};
use zmanager_core::archive_browser::{self, BrowserExtractOptions, BrowserListOptions};
use zmanager_core::jobs::{
    CancellationToken, run_7z_create_job_from_sources_with_plan_options,
    run_7z_extract_job_with_password_and_policy,
    run_libarchive_extract_job_with_password_and_policy,
    run_rar_extract_job_with_password_and_policy,
    run_tar_gz_create_job_from_sources_with_plan_options,
    run_tar_zst_create_job_from_sources_with_plan_options, run_tar_zst_extract_job_with_policy,
    run_tzap_create_job_from_sources_with_plan_options,
    run_tzap_extract_job_with_password_and_policy_and_restore_options,
    run_zip_create_job_from_sources_with_plan_options,
    run_zip_extract_job_with_password_and_policy,
};
use zmanager_core::libarchive_backend::LibarchiveError;
use zmanager_core::manifest::{
    ArchiveManifest, ManifestFileType, PlanError, PlanOptions, plan_archives,
};
use zmanager_core::rar_backend::RarBackendError;
use zmanager_core::raw_stream_backend::RawStreamError;
use zmanager_core::safety::{ExtractionPolicy, OverwritePolicy, UnsafeFilePolicy};
use zmanager_core::secrets::SecretString;
use zmanager_core::sevenz_backend::{SevenZCreateOptions, SevenZCreateReport, SevenZError};
use zmanager_core::tar_gz_backend::{TarGzCreateOptions, TarGzCreateReport};
use zmanager_core::tar_zst_backend::{TarZstdCreateOptions, TarZstdCreateReport};
use zmanager_core::tzap_backend::{
    TzapCreateOptions, TzapCreateReport, TzapError, TzapKeySource, TzapX509SigningOptions,
    TzapX509TrustOptions, inspect_tzap_x509_public_no_key_signer, verify_tzap_x509_public_no_key,
};
use zmanager_core::tzap_backend::{TzapRestoreOptions, TzapRestorePolicy};
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
        app_version: env!("CARGO_PKG_VERSION"),
        build_id: option_env!("ZMANAGER_BUILD_ID").unwrap_or("dev"),
    }
}

#[tauri::command]
pub fn project_contract() -> crate::dto::ProjectContract {
    use crate::dto::SourceTableCapabilitiesDto;

    let package_kind = crate::native_integration::current_package_kind();
    let capabilities = crate::native_integration::capability_snapshots(
        std::env::consts::OS,
        package_kind,
        &crate::platform::capability_observations(),
    );

    // Build the Compress source-table capability set for the running platform.
    // Follows the expected platform outcomes table in the implementation plan.
    // Safe base (always available): name, kind, size, modified, sourcePath
    let mut available_column_ids = vec!["name", "kind", "size", "modified", "sourcePath"];

    // All platforms: created, accessed, linkTarget (core planner captures these)
    available_column_ids.push("created");
    available_column_ids.push("accessed");
    available_column_ids.push("linkTarget");

    available_column_ids.extend_from_slice(crate::platform::source_table_column_ids());

    ProjectContract {
        commands: constants::PLANNED_COMMANDS,
        platform_strategy: constants::PLATFORM_STRATEGY,
        core_dependency: constants::CORE_DEPENDENCY,
        platform_integration: ProjectIntegrationContract {
            platform: std::env::consts::OS,
            package_kind,
            capabilities,
        },
        source_table_capabilities: SourceTableCapabilitiesDto {
            available_column_ids,
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
pub fn validate_directory(request: ValidateDirectoryRequest) -> ValidateDirectoryResponse {
    let path = request.path.trim();
    if path.is_empty() {
        return ValidateDirectoryResponse {
            exists: false,
            is_directory: false,
            accessible: false,
        };
    }

    match std::fs::metadata(path) {
        Ok(metadata) => {
            let is_directory = metadata.is_dir();
            let accessible = is_directory && std::fs::read_dir(path).is_ok();
            ValidateDirectoryResponse {
                exists: true,
                is_directory,
                accessible,
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => ValidateDirectoryResponse {
            exists: false,
            is_directory: false,
            accessible: false,
        },
        Err(_) => ValidateDirectoryResponse {
            exists: true,
            is_directory: false,
            accessible: false,
        },
    }
}

#[tauri::command]
pub fn quick_action_startup_state(
    state: State<'_, QuickActionLaunchCoordinator>,
) -> crate::dto::QuickActionStartupStateDto {
    state.startup_state().to_dto()
}

#[tauri::command]
pub fn native_frontend_ready(
    window_label: String,
    state: State<'_, NativeLaunchInbox>,
) -> Result<usize, CommandErrorDto> {
    state.frontend_ready(&window_label).map_err(|error| {
        CommandErrorDto::invalid_request(format!("native inbox readiness failed: {error:?}"))
    })
}

#[tauri::command]
pub fn acknowledge_native_event(
    window_label: String,
    event_id: String,
    state: State<'_, NativeLaunchInbox>,
) -> Result<(), CommandErrorDto> {
    state
        .acknowledge(&window_label, &event_id)
        .map_err(|error| {
            CommandErrorDto::invalid_request(format!(
                "native event acknowledgement failed: {error:?}"
            ))
        })
}

#[cfg(test)]
fn quick_action_startup_state_internal(
    state: &crate::quick_action::QuickActionStartupState,
) -> crate::dto::QuickActionStartupStateDto {
    state.to_dto()
}

#[cfg(test)]
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
    .map_err(crate::platform::map_archive_browser_error)?;

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
            mode: entry.mode,
            metadata_diagnostics: entry.metadata_diagnostics,
            encrypted: entry.encrypted,
            method: entry.method,
            crc: entry.crc.map(|c| format!("{:08X}", c)),
            comment: entry.comment,
            created: entry.created,
            accessed: entry.accessed,
            solid: entry.solid,
            link_target: entry.link_target,
            attributes: entry.attributes,
            uid: entry.uid,
            gid: entry.gid,
            owner: entry.owner,
            group: entry.group,
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
pub fn start_archive_index(
    request: crate::dto::StartArchiveIndexRequest,
    registry: State<'_, ArchiveIndexRegistry>,
) -> Result<crate::dto::ArchiveIndexStartResponseDto, CommandErrorDto> {
    registry.start(request)
}

#[tauri::command]
pub async fn wait_archive_index(
    request: crate::dto::ArchiveIndexSessionRequest,
    registry: State<'_, ArchiveIndexRegistry>,
) -> Result<crate::dto::ArchiveIndexSnapshotDto, CommandErrorDto> {
    registry
        .inner()
        .clone()
        .wait_for_change(&request.session_id, request.after_revision.as_deref())
        .await
}

#[tauri::command]
pub fn get_archive_children(
    request: crate::dto::ArchiveChildrenRequest,
    registry: State<'_, ArchiveIndexRegistry>,
) -> Result<crate::dto::ArchiveChildrenPageDto, CommandErrorDto> {
    registry.children(request)
}

#[tauri::command]
pub fn search_archive_index(
    request: crate::dto::ArchiveSearchRequest,
    registry: State<'_, ArchiveIndexRegistry>,
) -> Result<crate::dto::ArchiveChildrenPageDto, CommandErrorDto> {
    registry.search(request)
}

#[tauri::command]
pub fn close_archive_index(
    request: crate::dto::ArchiveIndexSessionRequest,
    registry: State<'_, ArchiveIndexRegistry>,
) -> Result<(), CommandErrorDto> {
    registry.close(&request.session_id)
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
    let plan_entries: Vec<CreatePlanEntryDto> = manifest
        .entries
        .iter()
        .map(create_plan_entry_to_dto)
        .collect();
    let entries = manifest
        .entries
        .iter()
        .map(|entry| entry.archive_path.clone())
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
        plan_entries,
        excluded_entries,
        warnings,
    })
}

fn create_plan_entry_to_dto(entry: &zmanager_core::manifest::ManifestEntry) -> CreatePlanEntryDto {
    let link_target = entry
        .symlink_target
        .as_ref()
        .map(|p| p.to_string_lossy().to_string());

    // Collect platform metadata from the source path.
    // Do not follow symlinks: table metadata describes the archived object.
    let source_meta = std::fs::symlink_metadata(&entry.source_path).ok();

    let created = source_meta
        .as_ref()
        .and_then(|m| m.created().ok())
        .and_then(system_time_to_epoch_seconds_string);

    let accessed = source_meta
        .as_ref()
        .and_then(|m| m.accessed().ok())
        .and_then(system_time_to_epoch_seconds_string);

    let platform_metadata =
        crate::platform::source_platform_metadata(&entry.source_path, &entry.permissions);

    CreatePlanEntryDto {
        path: entry.archive_path.clone(),
        kind: map_manifest_file_type(entry.file_type),
        size: matches!(entry.file_type, ManifestFileType::File).then_some(entry.size),
        modified: entry.modified.and_then(system_time_to_epoch_seconds_string),
        mode: entry.permissions.unix_mode,
        source_path: entry.source_path.to_string_lossy().to_string(),
        created,
        accessed,
        attributes: platform_metadata.attributes,
        link_target,
        uid: platform_metadata.uid,
        gid: platform_metadata.gid,
        owner: platform_metadata.owner,
        group: platform_metadata.group,
    }
}

fn map_manifest_file_type(file_type: ManifestFileType) -> ArchiveEntryKindDto {
    match file_type {
        ManifestFileType::File => ArchiveEntryKindDto::File,
        ManifestFileType::Directory => ArchiveEntryKindDto::Directory,
        ManifestFileType::Symlink => ArchiveEntryKindDto::Symlink,
        ManifestFileType::Other => ArchiveEntryKindDto::Special,
    }
}

fn system_time_to_epoch_seconds_string(time: SystemTime) -> Option<String> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs().to_string())
}

#[tauri::command]
pub fn start_create(
    request: StartCreateRequest,
    registry: State<'_, JobRegistry>,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    start_create_internal(request, &registry)
}

fn create_progress_estimate_for_format(
    manifest: &ArchiveManifest,
    format: crate::dto::ArchiveFormatDto,
) -> (usize, u64) {
    let total_entries = match format {
        crate::dto::ArchiveFormatDto::Tzap => manifest
            .entries
            .iter()
            .filter(|entry| matches!(entry.file_type, ManifestFileType::File))
            .count(),
        crate::dto::ArchiveFormatDto::Zip
        | crate::dto::ArchiveFormatDto::TarZst
        | crate::dto::ArchiveFormatDto::TarGz
        | crate::dto::ArchiveFormatDto::SevenZ
        | crate::dto::ArchiveFormatDto::AppleArchive => manifest.included_count(),
    };

    (total_entries, manifest.total_bytes)
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

    let mut plan_options = if request.clean_source {
        PlanOptions::clean_source()
    } else {
        PlanOptions::default()
    };
    plan_options.exclude_names = request.exclude_names.unwrap_or_default();
    plan_options.exclude_archive_paths = request.exclude_archive_paths.unwrap_or_default();
    plan_options.include_archive_paths = request.include_archive_paths.unwrap_or_default();
    plan_options.respect_gitignore = request.respect_gitignore;
    plan_options.follow_symlinks = request.follow_symlinks;
    let plan_result = plan_archives(sources.clone(), &plan_options);
    let create_progress_estimate = plan_result
        .as_ref()
        .ok()
        .map(|manifest| create_progress_estimate_for_format(manifest, request.format));
    let plan_for_thread = plan_result.ok();
    let plan_options_for_thread = plan_options;

    let kind = match request.format {
        crate::dto::ArchiveFormatDto::Zip => JobKindDto::ZipCreate,
        crate::dto::ArchiveFormatDto::TarZst => JobKindDto::TarZstdCreate,
        crate::dto::ArchiveFormatDto::TarGz => JobKindDto::TarGzCreate,
        crate::dto::ArchiveFormatDto::Tzap => JobKindDto::TzapCreate,
        crate::dto::ArchiveFormatDto::SevenZ => JobKindDto::SevenZCreate,
        crate::dto::ArchiveFormatDto::AppleArchive => JobKindDto::AppleArchiveCreate,
    };

    let password = request
        .password
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    if let Some(certificates) = request.tzap_certificates.as_ref() {
        let has_signing_certificate = certificates
            .signing_certificate_path
            .as_deref()
            .is_some_and(|path| !path.trim().is_empty());
        let has_signing_key = certificates
            .signing_private_key_path
            .as_deref()
            .is_some_and(|path| !path.trim().is_empty());
        if has_signing_certificate != has_signing_key {
            return Err(CommandErrorDto::invalid_request(
                "TZAP signing requires both a certificate and a matching private key",
            ));
        }
        if !certificates.recipient_certificate_paths.is_empty() && password.is_some() {
            return Err(CommandErrorDto::invalid_request(
                "TZAP recipient-certificate encryption cannot be combined with a password",
            ));
        }
    }

    let (response, token) = registry.try_create_job(kind).map_err(subscription_error)?;
    registry
        .configure_recovery_facts(
            &response.job_id,
            None,
            vec![JobOutputArtifactDto {
                artifact_id: "output".into(),
                kind: JobArtifactKindDto::Archive,
                path: destination_path.clone(),
            }],
            vec![JobAvailableActionDto {
                action_id: "reveal-output".into(),
                kind: JobActionKindDto::Reveal,
                artifact_id: "output".into(),
            }],
        )
        .map_err(subscription_error)?;
    if let Some((total_entries, total_bytes)) = create_progress_estimate {
        registry.emit_direct_event(
            &response.job_id,
            JobEventDto {
                event_type: JobEventKindDto::Started,
                job_kind: Some(kind),
                phase: None,
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

    let replace_existing = request.replace_existing;
    let preserve_metadata = request.preserve_metadata;
    let compression_level = request.compression_level;
    let volume_size = request.volume_size.filter(|value| *value > 0);
    let tzap_recovery_percentage = request.tzap_recovery_percentage.unwrap_or(5).min(100);
    let tzap_volume_loss_tolerance = if volume_size.is_some() {
        request.tzap_volume_loss_tolerance.unwrap_or(0).min(16)
    } else {
        0
    };
    let zip_compression = request.zip_compression;
    let seven_z_solid = request.seven_z_solid.unwrap_or(true);
    let seven_z_threads = request.seven_z_threads.filter(|value| *value > 0);
    let seven_z_chunk_size = request.seven_z_chunk_size.filter(|value| *value > 0);
    let seven_z_encrypt_file_names = request.seven_z_encrypt_file_names.unwrap_or(true);
    let tzap_certificates = request.tzap_certificates;
    let format = request.format;

    let request_sources = sources;
    let destination = destination_path;
    let kind_for_thread = kind;
    let plan_options = plan_options_for_thread;
    let plan = plan_for_thread;

    thread::spawn(move || {
        let mut sink = JobEventCollector::new(&registry_for_thread, job_id.clone());
        let result: Result<JobTerminalSummaryDto, CommandErrorDto> = match format {
            crate::dto::ArchiveFormatDto::Zip => {
                let create_options = ZipCreateOptions {
                    compression: match zip_compression {
                        Some(crate::dto::ZipCompressionDto::Store) => {
                            zmanager_core::zip_backend::ZipCompression::Store
                        }
                        _ => zmanager_core::zip_backend::ZipCompression::Deflate,
                    },
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
            crate::dto::ArchiveFormatDto::TarGz => {
                let level = compression_level
                    .and_then(|value| i32::try_from(value).ok())
                    .unwrap_or(TarGzCreateOptions::default().level);
                let create_options = TarGzCreateOptions {
                    level,
                    preserve_metadata,
                    replace_existing,
                    ..TarGzCreateOptions::default()
                };
                run_tar_gz_create_job_from_sources_with_plan_options(
                    &request_sources,
                    &destination,
                    &create_options,
                    &plan_options,
                    &token,
                    &mut sink,
                )
                .map(to_terminal_summary_for_tar_gz_create)
                .map_err(map_tar_gz_error)
            }
            crate::dto::ArchiveFormatDto::Tzap => {
                let recipient_certificates = tzap_certificates
                    .as_ref()
                    .map(|options| {
                        options
                            .recipient_certificate_paths
                            .iter()
                            .map(PathBuf::from)
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                let key_source = if recipient_certificates.is_empty() {
                    password
                        .as_deref()
                        .map(SecretString::from)
                        .map_or(TzapKeySource::NoPassword, TzapKeySource::Passphrase)
                } else {
                    TzapKeySource::RecipientCertificates(recipient_certificates)
                };
                let x509_signing = tzap_certificates.as_ref().and_then(|options| {
                    if let Some(identity) = options
                        .signing_identity_path
                        .as_deref()
                        .map(str::trim)
                        .filter(|path| !path.is_empty())
                    {
                        return Some(TzapX509SigningOptions::Pkcs12 {
                            identity: PathBuf::from(identity),
                            password: SecretString::from(
                                options
                                    .signing_identity_password
                                    .clone()
                                    .unwrap_or_default(),
                            ),
                        });
                    }
                    let certificate = options.signing_certificate_path.as_deref()?.trim();
                    let private_key = options.signing_private_key_path.as_deref()?.trim();
                    if certificate.is_empty() || private_key.is_empty() {
                        return None;
                    }
                    Some(TzapX509SigningOptions::CertificateAndKey {
                        signing_certificate: PathBuf::from(certificate),
                        signing_private_key: PathBuf::from(private_key),
                        signing_chain: options
                            .signing_chain_paths
                            .iter()
                            .map(PathBuf::from)
                            .collect(),
                    })
                });
                let create_options = TzapCreateOptions {
                    key_source,
                    level: compression_level
                        .and_then(|value| i32::try_from(value).ok())
                        .unwrap_or(3),
                    preserve_metadata,
                    replace_existing,
                    volume_size,
                    recovery_percentage: tzap_recovery_percentage,
                    volume_loss_tolerance: tzap_volume_loss_tolerance,
                    x509_signing,
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
                    solid: seven_z_solid,
                    level: compression_level,
                    preserve_metadata,
                    password: password.as_deref().map(SecretString::from),
                    encrypt_file_names: seven_z_encrypt_file_names,
                    replace_existing,
                    volume_size,
                    threads: seven_z_threads,
                    chunk_size: seven_z_chunk_size,
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
            crate::dto::ArchiveFormatDto::AppleArchive => match plan.as_ref() {
                Some(manifest) => crate::platform::apple_archive::create_apple_archive(
                    manifest,
                    &destination,
                    preserve_metadata,
                    replace_existing,
                    password.as_deref(),
                    &token,
                    &mut sink,
                ),
                None => Err(CommandErrorDto::operation_failed(
                    "AppleArchive create requires a valid source plan".to_string(),
                )),
            },
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

#[tauri::command]
pub fn generate_tzap_identity(
    request: crate::dto::GenerateTzapIdentityRequest,
) -> Result<crate::dto::GenerateTzapIdentityResponse, CommandErrorDto> {
    let identity_path = PathBuf::from(ensure_non_empty_path(
        request.identity_path,
        "identityPath",
    )?);
    let certificate_path = PathBuf::from(ensure_non_empty_path(
        request.certificate_path,
        "certificatePath",
    )?);
    let common_name = request.common_name.trim();
    if common_name.is_empty() {
        return Err(CommandErrorDto::invalid_request(
            "commonName must not be blank",
        ));
    }
    let key = PKey::from_rsa(Rsa::generate(3072).map_err(map_identity_error)?)
        .map_err(map_identity_error)?;
    let mut name = X509NameBuilder::new().map_err(map_identity_error)?;
    name.append_entry_by_nid(Nid::COMMONNAME, common_name)
        .map_err(map_identity_error)?;
    let name = name.build();
    let mut serial = BigNum::new().map_err(map_identity_error)?;
    serial
        .rand(128, MsbOption::MAYBE_ZERO, false)
        .map_err(map_identity_error)?;
    let serial = Asn1Integer::from_bn(&serial).map_err(map_identity_error)?;
    let mut certificate = X509::builder().map_err(map_identity_error)?;
    certificate.set_version(2).map_err(map_identity_error)?;
    certificate
        .set_serial_number(&serial)
        .map_err(map_identity_error)?;
    certificate
        .set_subject_name(&name)
        .map_err(map_identity_error)?;
    certificate
        .set_issuer_name(&name)
        .map_err(map_identity_error)?;
    certificate.set_pubkey(&key).map_err(map_identity_error)?;
    certificate
        .set_not_before(
            Asn1Time::days_from_now(0)
                .map_err(map_identity_error)?
                .as_ref(),
        )
        .map_err(map_identity_error)?;
    certificate
        .set_not_after(
            Asn1Time::days_from_now(3650)
                .map_err(map_identity_error)?
                .as_ref(),
        )
        .map_err(map_identity_error)?;
    certificate
        .sign(&key, MessageDigest::sha256())
        .map_err(map_identity_error)?;
    let certificate = certificate.build();
    let password = request.password.unwrap_or_default();
    let mut identity = Pkcs12::builder();
    identity.name(common_name);
    identity.pkey(&key);
    identity.cert(&certificate);
    let identity = identity.build2(&password).map_err(map_identity_error)?;
    std::fs::write(
        &identity_path,
        identity.to_der().map_err(map_identity_error)?,
    )
    .map_err(|error| map_io_error(identity_path.to_string_lossy().into_owned(), error))?;
    std::fs::write(
        &certificate_path,
        certificate.to_pem().map_err(map_identity_error)?,
    )
    .map_err(|error| map_io_error(certificate_path.to_string_lossy().into_owned(), error))?;
    let fingerprint = certificate
        .digest(MessageDigest::sha256())
        .map_err(map_identity_error)?;
    Ok(crate::dto::GenerateTzapIdentityResponse {
        identity_path: identity_path.to_string_lossy().into_owned(),
        certificate_path: certificate_path.to_string_lossy().into_owned(),
        subject: format!("CN={common_name}"),
        certificate_sha256: hex_bytes(fingerprint.as_ref()),
    })
}

fn map_identity_error(error: openssl::error::ErrorStack) -> CommandErrorDto {
    CommandErrorDto::new(
        "certificate_error",
        format!("Unable to create signing identity: {error}"),
        None::<String>,
        ErrorSeverityDto::Error,
        false,
    )
}

#[tauri::command]
pub fn verify_tzap_certificate(
    request: crate::dto::VerifyTzapCertificateRequest,
) -> Result<crate::dto::VerifyTzapCertificateResponse, CommandErrorDto> {
    let archive_path = ensure_non_empty_path(request.archive_path, "archivePath")?;
    if !zmanager_core::tzap_backend::is_tzap_archive_path(Path::new(&archive_path)) {
        return Err(CommandErrorDto::invalid_request(
            "certificate verification is available only for TZAP archives",
        ));
    }

    if request.validate_trust {
        let trust = TzapX509TrustOptions {
            trusted_ca_certificates: request
                .trusted_ca_certificate_paths
                .iter()
                .map(PathBuf::from)
                .collect(),
            trusted_system_roots: request.trusted_system_roots,
            include_official_tzap_root: request.include_official_tzap_root,
        };
        if !trust.has_trust_source() {
            return Err(CommandErrorDto::invalid_request(
                "trust validation requires the official TZAP root, a custom CA, or system roots",
            ));
        }
        let report =
            verify_tzap_x509_public_no_key(&archive_path, &trust).map_err(map_tzap_error)?;
        return Ok(crate::dto::VerifyTzapCertificateResponse {
            outcome: "trusted",
            subject: report.subject,
            issuer: report.issuer,
            serial_number_hex: report.serial_number_hex,
            certificate_sha256: hex_bytes(&report.certificate_sha256),
            signed_at_unix_seconds: report.signed_at_unix_seconds,
            trust_anchor_subject: report.trust_anchor_subject,
            verified_chain_subjects: report.verified_chain_subjects,
            diagnostics: report.diagnostics,
        });
    }

    let inspection =
        inspect_tzap_x509_public_no_key_signer(&archive_path).map_err(map_tzap_error)?;
    Ok(crate::dto::VerifyTzapCertificateResponse {
        outcome: "signatureValid",
        subject: inspection.subject,
        issuer: inspection.issuer,
        serial_number_hex: inspection.serial_number_hex,
        certificate_sha256: hex_bytes(&inspection.certificate_sha256),
        signed_at_unix_seconds: inspection.signed_at_unix_seconds,
        trust_anchor_subject: None,
        verified_chain_subjects: Vec::new(),
        diagnostics: inspection.diagnostics,
    })
}

fn hex_bytes(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

pub(crate) fn start_extract_internal(
    request: StartExtractRequest,
    registry: &JobRegistry,
) -> Result<StartJobResponseDto, CommandErrorDto> {
    start_extract_internal_with_spawner(request, registry, |worker| {
        thread::spawn(worker);
    })
}

fn start_extract_internal_with_spawner(
    request: StartExtractRequest,
    registry: &JobRegistry,
    spawn_worker: impl FnOnce(Box<dyn FnOnce() + Send + 'static>),
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
    let family = detect_archive_family(&archive_path);
    let kind = match family {
        ArchiveFamily::Zip => JobKindDto::ZipExtract,
        ArchiveFamily::TarZst => JobKindDto::TarZstdExtract,
        ArchiveFamily::SevenZ => JobKindDto::SevenZExtract,
        ArchiveFamily::Rar => JobKindDto::RarExtract,
        ArchiveFamily::Tzap => JobKindDto::TzapExtract,
        ArchiveFamily::AppleArchive => JobKindDto::AppleArchiveExtract,
        ArchiveFamily::Archive => JobKindDto::ArchiveExtract,
    };

    let (response, token) = registry.try_create_job(kind).map_err(subscription_error)?;
    registry
        .configure_recovery_facts(
            &response.job_id,
            Some(JobRetryDescriptorDto::ExtractArchive {
                action_id: "retry-with-password".into(),
                archive_path: archive_path.clone(),
                destination_path: destination_path.clone(),
                overwrite: request.overwrite,
                destination_collision_strategy: request.destination_collision_strategy,
                entry_paths: entry_paths.clone(),
                strip_components: request.strip_components,
                tzap_restore_policy: request.tzap_restore_policy,
                tzap_allow_degraded: request.tzap_allow_degraded,
                tzap_allow_absolute_symlinks: request.tzap_allow_absolute_symlinks,
                ignore_symlinks: request.ignore_symlinks,
            }),
            vec![JobOutputArtifactDto {
                artifact_id: "output".into(),
                kind: JobArtifactKindDto::Directory,
                path: destination_path.clone(),
            }],
            vec![JobAvailableActionDto {
                action_id: "open-output".into(),
                kind: JobActionKindDto::Open,
                artifact_id: "output".into(),
            }],
        )
        .map_err(subscription_error)?;
    let registry_for_thread = registry.clone();
    let job_id = response.job_id.clone();
    let family_for_thread = family;
    let policy = extraction_policy(
        request.overwrite,
        request.strip_components,
        request.ignore_symlinks,
    );
    let tzap_restore_options = TzapRestoreOptions {
        policy: map_tzap_restore_policy(request.tzap_restore_policy),
        allow_degraded: request.tzap_allow_degraded,
        allow_absolute_symlinks: request.tzap_allow_absolute_symlinks,
    };
    let archive_path = archive_path;
    let destination_path = destination_path;

    spawn_worker(Box::new(move || {
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
                ArchiveFamily::Tzap => {
                    run_tzap_extract_job_with_password_and_policy_and_restore_options(
                        &archive_path,
                        &destination_path,
                        password.as_deref(),
                        policy,
                        tzap_restore_options,
                        &token,
                        &mut sink,
                    )
                    .map(to_terminal_summary_for_extract)
                    .map_err(map_tzap_error)
                }
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
                ArchiveFamily::AppleArchive => {
                    crate::platform::apple_archive::extract_apple_archive(
                        &archive_path,
                        &destination_path,
                        policy,
                        password.as_deref(),
                        &token,
                        &mut sink,
                    )
                }
            }
        } else {
            run_selected_extract_job(
                &archive_path,
                &destination_path,
                &entry_paths,
                password.as_deref(),
                policy,
                tzap_restore_options,
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
    }));

    Ok(response)
}

fn complete_job_if_needed(
    registry: &JobRegistry,
    job_id: &str,
    kind: JobKindDto,
    summary: JobTerminalSummaryDto,
) {
    let _ = registry.commit_completed(job_id, kind, summary);
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
            ..BrowserExtractOptions::default()
        },
    )
    .map_err(crate::platform::map_archive_browser_error)?;

    registry.replace_preview_root(report.cleanup_root.clone());

    Ok(PreviewEntryResponse {
        cleanup_root: report.cleanup_root.to_string_lossy().to_string(),
        preview_path: report.preview_path.to_string_lossy().to_string(),
        written_bytes: report.written_bytes,
    })
}

#[tauri::command]
pub fn start_native_file_drag(
    window: tauri::WebviewWindow,
    request: NativeFileDragRequest,
    _registry: State<'_, JobRegistry>,
    drag_registry: State<'_, crate::native_drag_session::NativeDragSessionRegistry>,
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
    let stream_archive_path = archive_path.clone();
    let stream_password = password.clone();
    let preflight_archive_path = archive_path.clone();
    let preflight_password = password.clone();
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

    let start = crate::platform::start_native_file_drag(
        &window,
        &drag_items,
        || {
            preflight_native_drag_stream(
                &preflight_archive_path,
                preflight_password.as_deref(),
                &drag_items,
            )
            .map_err(native_file_drag_error_from_command)
        },
        stream_provider,
        &drag_registry,
    )
    .map_err(map_native_file_drag_error)?;

    let (outcome, session_id) = match start {
        crate::platform::NativeFileDragStart::Pending { session_id } => {
            (NativeFileDragOutcomeDto::Pending, Some(session_id))
        }
        crate::platform::NativeFileDragStart::Settled { outcome } => {
            (map_native_file_drag_outcome(outcome), None)
        }
    };
    Ok(NativeFileDragResponse {
        outcome,
        session_id,
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
    let entry_paths = normalize_optional_entry_paths(request.entry_paths)?;
    let retry_entry_paths = entry_paths.clone();
    let selected_entry_keys = Arc::new(entry_paths.into_iter().collect::<HashSet<_>>());
    let family = detect_archive_family(&archive_path);

    let (response, _token) = registry
        .try_create_job(JobKindDto::TestArchive)
        .map_err(subscription_error)?;
    registry
        .configure_recovery_facts(
            &response.job_id,
            Some(JobRetryDescriptorDto::TestArchive {
                action_id: "retry-with-password".into(),
                archive_path: archive_path.clone(),
                entry_paths: retry_entry_paths,
            }),
            Vec::new(),
            Vec::new(),
        )
        .map_err(subscription_error)?;
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
            },
        );

        let result: Result<JobTerminalSummaryDto, CommandErrorDto> = match family {
            ArchiveFamily::Zip => {
                let selected_entry_keys = Arc::clone(&selected_entry_keys);
                zmanager_core::zip_backend::test_zip_with_password_filter(
                    &archive_path,
                    password.as_deref(),
                    move |path| {
                        selected_entry_keys.is_empty() || selected_entry_keys.contains(path)
                    },
                )
                .map(to_terminal_summary_for_zip_test)
                .map_err(map_zip_error)
            }
            ArchiveFamily::Tzap => {
                let selected_entry_keys = Arc::clone(&selected_entry_keys);
                zmanager_core::tzap_backend::test_tzap_with_optional_password_filter_and_x509_trust(
                    &archive_path,
                    password.as_deref(),
                    move |path| {
                        selected_entry_keys.is_empty() || selected_entry_keys.contains(path)
                    },
                    None,
                )
                .map(to_terminal_summary_for_tzap_test)
                .map_err(map_tzap_error)
            }
            _ => {
                let selected_entry_keys = Arc::clone(&selected_entry_keys);
                zmanager_core::libarchive_backend::test_archive_with_password_filter(
                    &archive_path,
                    password.as_deref(),
                    move |path| {
                        selected_entry_keys.is_empty() || selected_entry_keys.contains(path)
                    },
                )
                .map(to_terminal_summary_for_libarchive_test)
                .map_err(map_libarchive_error)
            }
        };

        match result {
            Ok(summary) => {
                let _ =
                    registry_for_thread.commit_completed(&job_id, JobKindDto::TestArchive, summary);
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
    tzap_restore_options: TzapRestoreOptions,
    token: &CancellationToken,
    sink: &mut JobEventCollector,
    kind: JobKindDto,
) -> Result<JobTerminalSummaryDto, CommandErrorDto> {
    sink.emit_direct(JobEventDto {
        event_type: JobEventKindDto::Started,
        job_kind: Some(kind),
        phase: None,
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
            phase: None,
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
                tzap_restore_policy: tzap_restore_options.policy,
                tzap_allow_degraded: tzap_restore_options.allow_degraded,
                tzap_allow_absolute_symlinks: tzap_restore_options.allow_absolute_symlinks,
                ignore_symlinks: policy.ignore_symlinks,
            },
        )
        .map_err(crate::platform::map_archive_browser_error)?;

        written_entries = written_entries.saturating_add(1);
        written_bytes = written_bytes.saturating_add(report.written_bytes);
        for diagnostic in report.metadata_diagnostics {
            sink.emit_direct(JobEventDto {
                event_type: JobEventKindDto::Warning,
                job_kind: Some(kind),
                phase: None,
                code: Some("metadata_degraded"),
                hint: None,
                severity: Some(ErrorSeverityDto::Warning),
                retryable: Some(false),
                path: Some(entry_path.clone()),
                bytes: None,
                total_bytes: None,
                total_bytes_processed: Some(written_bytes),
                entries: Some(written_entries),
                total_entries: Some(entry_paths.len()),
                message: Some(diagnostic),
            });
        }
        sink.emit_direct(JobEventDto {
            event_type: JobEventKindDto::EntryFinished,
            job_kind: Some(kind),
            phase: None,
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
        phase: None,
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
pub fn subscribe_job(
    request: SubscribeJobRequest,
    on_snapshot: Channel<JobSnapshotEnvelopeDto>,
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<String, CommandErrorDto> {
    let job_id = request.job_id.trim();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }
    let owner = window.label().to_string();
    let (subscription_id, snapshots, commands, shared_flow) = registry
        .register_job_subscription(&owner, job_id)
        .map_err(subscription_error)?;
    let registry = registry.inner().clone();
    let task_subscription_id = subscription_id.clone();
    tauri::async_runtime::spawn(async move {
        forward_latest_values(
            snapshots,
            commands,
            shared_flow,
            |snapshot| snapshot.revision.parse::<u64>().ok(),
            |current| {
                on_snapshot
                    .send(JobSnapshotEnvelopeDto {
                        subscription_id: task_subscription_id.clone(),
                        revision: current.revision.clone(),
                        payload: (*current).clone(),
                    })
                    .map_err(|_| ())
            },
        )
        .await;
        registry.cleanup_subscription(&task_subscription_id);
    });
    Ok(subscription_id)
}

#[tauri::command]
pub fn subscribe_job_catalog(
    on_snapshot: Channel<JobCatalogEnvelopeDto>,
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<String, CommandErrorDto> {
    let owner = window.label().to_string();
    let (subscription_id, snapshots, commands, shared_flow) = registry
        .register_catalog_subscription(&owner)
        .map_err(subscription_error)?;
    let registry = registry.inner().clone();
    let task_subscription_id = subscription_id.clone();
    tauri::async_runtime::spawn(async move {
        forward_latest_values(
            snapshots,
            commands,
            shared_flow,
            |snapshot| snapshot.catalog_revision.parse::<u64>().ok(),
            |current| {
                on_snapshot
                    .send(JobCatalogEnvelopeDto {
                        subscription_id: task_subscription_id.clone(),
                        revision: current.catalog_revision.clone(),
                        payload: (*current).clone(),
                    })
                    .map_err(|_| ())
            },
        )
        .await;
        registry.cleanup_subscription(&task_subscription_id);
    });
    Ok(subscription_id)
}

#[tauri::command]
pub fn ack_subscription(
    request: AckSubscriptionRequest,
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<(), CommandErrorDto> {
    let revision = request.revision.parse::<u64>().map_err(|_| {
        CommandErrorDto::invalid_request("revision must be an unsigned decimal string")
    })?;
    registry
        .acknowledge_subscription(window.label(), request.subscription_id.trim(), revision)
        .map_err(subscription_error)
}

#[tauri::command]
pub fn unsubscribe_job(
    request: SubscriptionRequest,
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<(), CommandErrorDto> {
    registry
        .unsubscribe(window.label(), request.subscription_id.trim())
        .map_err(subscription_error)
}

fn subscription_error(code: &'static str) -> CommandErrorDto {
    CommandErrorDto::invalid_request(code)
}

fn ensure_task_job_owner(owner: &str, job_id: &str) -> Result<(), CommandErrorDto> {
    if owner == format!("task-{job_id}") {
        return Ok(());
    }
    Err(CommandErrorDto::invalid_request("job_control_forbidden"))
}

#[tauri::command]
pub fn cancel_job(
    request: crate::dto::CancelJobRequest,
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<crate::job_dto::CancelJobResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }
    ensure_task_job_owner(window.label(), &job_id)?;

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
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<JobControlResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }
    ensure_task_job_owner(window.label(), &job_id)?;

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
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<JobControlResponseDto, CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }
    ensure_task_job_owner(window.label(), &job_id)?;

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
    window: WebviewWindow,
    registry: State<'_, JobRegistry>,
) -> Result<(), CommandErrorDto> {
    let job_id = request.job_id.trim().to_string();
    if job_id.is_empty() {
        return Err(CommandErrorDto::invalid_request("jobId cannot be empty"));
    }
    ensure_task_job_owner(window.label(), &job_id)?;

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

pub(crate) fn map_browser_entry_kind(
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

pub(crate) fn map_zip_error(error: ZipBackendError) -> CommandErrorDto {
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

pub(crate) fn map_tar_zst_error(
    error: zmanager_core::tar_zst_backend::TarZstdError,
) -> CommandErrorDto {
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

fn map_tar_gz_error(error: zmanager_core::tar_gz_backend::TarGzError) -> CommandErrorDto {
    match error {
        zmanager_core::tar_gz_backend::TarGzError::Io { path, source } => {
            map_io_error(path.to_string_lossy().to_string(), source)
        }
        zmanager_core::tar_gz_backend::TarGzError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("TAR.GZ plan error: {source}"))
        }
        zmanager_core::tar_gz_backend::TarGzError::Cancelled(_) => {
            CommandErrorDto::cancelled("TAR.GZ job was cancelled.")
        }
    }
}

pub(crate) fn map_7z_error(error: SevenZError) -> CommandErrorDto {
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

pub(crate) fn map_tzap_error(error: TzapError) -> CommandErrorDto {
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

pub(crate) fn map_libarchive_error(error: LibarchiveError) -> CommandErrorDto {
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

pub(crate) fn map_raw_stream_error(error: RawStreamError) -> CommandErrorDto {
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

pub(crate) fn map_io_error(path: String, source: io::Error) -> CommandErrorDto {
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
    match error.kind {
        crate::platform::NativeFileDragErrorKind::InvalidRequest => {
            CommandErrorDto::invalid_request(error.message)
        }
        crate::platform::NativeFileDragErrorKind::UnsafeArchive => {
            CommandErrorDto::unsafe_archive(error.message)
        }
        crate::platform::NativeFileDragErrorKind::OperationFailed => CommandErrorDto::new(
            constants::COMMAND_ERROR_OPERATION_FAILED,
            error.message,
            error.hint,
            ErrorSeverityDto::Warning,
            false,
        ),
    }
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
    .map_err(crate::platform::map_archive_browser_error)?;

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

    let mut candidates = Vec::with_capacity(selected_entries.len());
    for entry in selected_entries {
        candidates.push(crate::platform::NativeFileDragCandidate {
            entry_path: entry.path.clone(),
            size: entry.size,
            modified_unix_seconds: entry
                .modified
                .as_deref()
                .and_then(|modified| modified.parse::<u64>().ok()),
        });
    }

    crate::platform::prepare_native_file_drag(&candidates, strip_components)
        .map_err(map_native_file_drag_error)
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

fn archive_entry_key(path: &str) -> String {
    path.split(['/', '\\'])
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
        ArchiveFamily::AppleArchive => {
            let mut writer = DynWriteAdapter { inner: output };
            let report = crate::platform::apple_archive::copy_apple_archive_files_to_writer(
                archive_path,
                |name| archive_entry_key(name) == archive_entry_key(entry_path),
                &mut writer,
                password,
            )?;
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

fn map_tzap_restore_policy(policy: TzapRestorePolicyDto) -> TzapRestorePolicy {
    match policy {
        TzapRestorePolicyDto::Content => TzapRestorePolicy::Content,
        TzapRestorePolicyDto::Portable => TzapRestorePolicy::Portable,
        TzapRestorePolicyDto::SameOs => TzapRestorePolicy::SameOs,
        TzapRestorePolicyDto::System => TzapRestorePolicy::System,
    }
}

fn extraction_policy(
    overwrite: crate::dto::OverwritePolicyDto,
    strip_components: usize,
    ignore_symlinks: bool,
) -> ExtractionPolicy {
    ExtractionPolicy {
        overwrite: map_overwrite_policy(overwrite),
        unsafe_file: UnsafeFilePolicy::Reject,
        include_patterns: Vec::new(),
        exclude_patterns: Vec::new(),
        strip_components,
        limits: Default::default(),
        ignore_symlinks,
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

fn to_terminal_summary_for_tar_gz_create(report: TarGzCreateReport) -> JobTerminalSummaryDto {
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

    if let Some(dot_index) = name.rfind('.')
        && dot_index > 0
    {
        return name.split_at(dot_index);
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
    AppleArchive,
    Archive,
}

fn detect_archive_family(path: &str) -> ArchiveFamily {
    let path = Path::new(path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    // Apple Archive detection (macOS-only format)
    // Check BEFORE stem extraction to avoid unused-variable warning on early return
    if matches!(extension.as_deref(), Some("aar") | Some("aea")) {
        return ArchiveFamily::AppleArchive;
    }

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

    #[test]
    fn job_controls_are_scoped_to_the_matching_disposable_task_window() {
        assert!(ensure_task_job_owner("task-42", "42").is_ok());
        assert_eq!(
            ensure_task_job_owner("main", "42")
                .expect_err("Main Window must not control a Job")
                .code,
            constants::COMMAND_ERROR_INVALID_REQUEST,
        );
        assert!(ensure_task_job_owner("task-41", "42").is_err());
    }
    use std::env;
    use std::ffi::OsString;
    use std::fs;
    use std::io::Error;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::path::PathBuf;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use zmanager_core::manifest::{ManifestEntry, ManifestFileType, PermissionSnapshot};
    use zmanager_core::safety::ExtractionSafetyError;

    #[test]
    fn create_plan_entry_dto_preserves_core_permission_mode() {
        let entry = ManifestEntry {
            archive_path: "bin/tool".to_string(),
            source_path: PathBuf::from("C:/work/bin/tool"),
            file_type: ManifestFileType::File,
            size: 42,
            modified: None,
            permissions: PermissionSnapshot {
                readonly: false,
                unix_mode: Some(0o755),
            },
            symlink_target: None,
        };

        let dto = create_plan_entry_to_dto(&entry);

        assert_eq!(dto.mode, Some(0o755));
    }

    #[test]
    fn create_plan_entry_dto_maps_symlink_target_to_link_target() {
        let entry = ManifestEntry {
            archive_path: "link.txt".to_string(),
            source_path: PathBuf::from("/tmp/link.txt"),
            file_type: ManifestFileType::Symlink,
            size: 0,
            modified: None,
            permissions: PermissionSnapshot {
                readonly: false,
                unix_mode: Some(0o777),
            },
            symlink_target: Some(PathBuf::from("target.txt")),
        };

        let dto = create_plan_entry_to_dto(&entry);

        assert_eq!(dto.link_target, Some("target.txt".to_string()));
        // Optional fields not yet populated remain None
        assert_eq!(dto.created, None);
        assert_eq!(dto.uid, None);
        assert_eq!(dto.owner, None);
    }

    #[test]
    fn create_plan_entry_dto_leaves_link_target_none_when_no_symlink_target() {
        let entry = ManifestEntry {
            archive_path: "regular.txt".to_string(),
            source_path: PathBuf::from("/tmp/regular.txt"),
            file_type: ManifestFileType::File,
            size: 100,
            modified: None,
            permissions: PermissionSnapshot {
                readonly: false,
                unix_mode: Some(0o644),
            },
            symlink_target: None,
        };

        let dto = create_plan_entry_to_dto(&entry);

        assert_eq!(dto.link_target, None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn create_plan_entry_dto_reports_exact_object_metadata_without_following_symlinks() {
        use std::os::unix::fs::symlink;

        let root = env::temp_dir().join(format!(
            "zmanager-source-columns-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("target.txt");
        let link = root.join("link.txt");
        fs::write(&target, b"target").unwrap();
        symlink("target.txt", &link).unwrap();
        assert!(
            std::process::Command::new("/usr/bin/chflags")
                .arg("hidden")
                .arg(&target)
                .status()
                .unwrap()
                .success()
        );

        let target_dto = create_plan_entry_to_dto(&ManifestEntry {
            archive_path: "target.txt".into(),
            source_path: target.clone(),
            file_type: ManifestFileType::File,
            size: 6,
            modified: None,
            permissions: PermissionSnapshot {
                readonly: false,
                unix_mode: Some(0o644),
            },
            symlink_target: None,
        });
        let link_dto = create_plan_entry_to_dto(&ManifestEntry {
            archive_path: "link.txt".into(),
            source_path: link,
            file_type: ManifestFileType::Symlink,
            size: 0,
            modified: None,
            permissions: PermissionSnapshot {
                readonly: false,
                unix_mode: Some(0o777),
            },
            symlink_target: Some(PathBuf::from("target.txt")),
        });

        assert!(target_dto.created.is_some());
        assert!(target_dto.accessed.is_some());
        assert!(target_dto.uid.is_some());
        assert!(target_dto.owner.is_some());
        assert!(
            target_dto
                .attributes
                .as_deref()
                .unwrap_or_default()
                .iter()
                .any(|attribute| attribute.code == "hidden")
        );
        assert!(
            !link_dto
                .attributes
                .as_deref()
                .unwrap_or_default()
                .iter()
                .any(|attribute| attribute.code == "hidden")
        );

        fs::remove_dir_all(root).unwrap();
    }

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
            .take_test_events(&response.job_id)
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
            .take_test_events(&response.job_id)
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
            vec![
                "a.txt".to_string(),
                format!("nested{}b.txt", std::path::MAIN_SEPARATOR)
            ]
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
            vec![
                format!("folder{}alpha.txt", std::path::MAIN_SEPARATOR),
                format!("folder{}beta.txt", std::path::MAIN_SEPARATOR),
            ]
        );
    }

    #[test]
    fn native_drag_items_reject_duplicate_display_paths_after_stripping() {
        let entries = vec![
            browser_entry(
                "one/readme.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
            browser_entry(
                "two/readme.txt",
                zmanager_core::archive_browser::BrowserEntryKind::File,
            ),
        ];

        let error = native_drag_items_from_listing(
            &entries,
            &["one/readme.txt".to_string(), "two/readme.txt".to_string()],
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
            mode: Some(0o644),
            metadata_diagnostics: Vec::new(),
            encrypted: None,
            method: None,
            crc: None,
            comment: None,
            created: None,
            accessed: None,
            solid: None,
            link_target: None,
            attributes: None,
            uid: None,
            gid: None,
            owner: None,
            group: None,
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
    fn quick_action_startup_state_command_exposes_only_window_disposition() {
        let state = QuickActionStartupState::from_args(
            ["--quick-action", "open", "--path", "C:/tmp/one.zip"]
                .into_iter()
                .map(OsString::from),
        );

        let response = quick_action_startup_state_internal(&state);

        assert!(response.launched_for_quick_action);
        assert!(response.error.is_none());
        assert_eq!(
            response.window_disposition,
            Some(crate::dto::QuickActionWindowDispositionDto::MainWindow),
        );
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

        let response = quick_action_startup_state_internal(&state);

        assert!(response.launched_for_quick_action);
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

    #[test]
    fn detect_archive_family_recognizes_aar() {
        assert_eq!(
            detect_archive_family("test.aar"),
            ArchiveFamily::AppleArchive
        );
    }

    #[test]
    fn detect_archive_family_recognizes_aea() {
        assert_eq!(
            detect_archive_family("test.aea"),
            ArchiveFamily::AppleArchive
        );
    }

    #[test]
    fn apple_archive_format_serializes_correctly() {
        let format = crate::dto::ArchiveFormatDto::AppleArchive;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"appleArchive\"");
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

    #[test]
    fn generate_tzap_identity_writes_parseable_pkcs12_and_public_certificate() {
        let workspace = create_temp_workspace("generate-tzap-identity");
        let identity_path = workspace.join("signer.p12");
        let certificate_path = workspace.join("signer.crt");
        let response = generate_tzap_identity(crate::dto::GenerateTzapIdentityRequest {
            identity_path: identity_path.to_string_lossy().into_owned(),
            certificate_path: certificate_path.to_string_lossy().into_owned(),
            common_name: "Desktop Test Signer".to_owned(),
            password: Some("identity-secret".to_owned()),
        })
        .expect("identity generation should succeed");

        let identity = Pkcs12::from_der(&fs::read(&identity_path).expect("identity should exist"))
            .expect("identity should be valid PKCS#12");
        let parsed = identity
            .parse2("identity-secret")
            .expect("identity password should work");
        assert!(parsed.cert.is_some());
        assert!(parsed.pkey.is_some());
        assert!(
            X509::from_pem(&fs::read(&certificate_path).expect("certificate should exist")).is_ok()
        );
        assert_eq!(response.subject, "CN=Desktop Test Signer");
        assert!(!response.certificate_sha256.is_empty());
        let _ = fs::remove_dir_all(workspace);
    }

    fn wait_for_job_terminal(
        registry: &crate::job_registry::JobRegistry,
        job_id: &str,
    ) -> (TestJobEventsSnapshot, Vec<JobEventDto>) {
        let mut all_events = Vec::new();

        for _ in 0..400 {
            let poll = registry
                .take_test_events(job_id)
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
                exclude_names: None,
                exclude_archive_paths: None,
                include_archive_paths: None,
                respect_gitignore: false,
                follow_symlinks: false,
                replace_existing: true,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: None,
                compression_level: None,
                volume_size: None,
                tzap_recovery_percentage: None,
                tzap_volume_loss_tolerance: None,
                zip_compression: None,
                seven_z_solid: None,
                seven_z_threads: None,
                seven_z_chunk_size: None,
                seven_z_encrypt_file_names: None,
                tzap_certificates: None,
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
                entry_paths: None,
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
                tzap_restore_policy: TzapRestorePolicyDto::Portable,
                tzap_allow_degraded: false,
                tzap_allow_absolute_symlinks: false,
                ignore_symlinks: false,
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
    fn whole_archive_extract_returns_the_queued_job_before_worker_enumeration() {
        let workspace = create_temp_workspace("extract-registration-boundary");
        let source = workspace.join("source");
        let destination_archive = workspace.join("created.zip");
        fs::create_dir_all(&source).expect("fixture source should exist");
        fs::write(source.join("payload.txt"), b"payload").expect("fixture payload should write");

        let registry = JobRegistry::new();
        let create_job = start_create_internal(
            StartCreateRequest {
                sources: vec![source.to_string_lossy().to_string()],
                destination_path: destination_archive.to_string_lossy().to_string(),
                format: crate::dto::ArchiveFormatDto::Zip,
                clean_source: false,
                exclude_names: None,
                exclude_archive_paths: None,
                include_archive_paths: None,
                respect_gitignore: false,
                follow_symlinks: false,
                replace_existing: true,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: None,
                compression_level: None,
                volume_size: None,
                tzap_recovery_percentage: None,
                tzap_volume_loss_tolerance: None,
                zip_compression: None,
                seven_z_solid: None,
                seven_z_threads: None,
                seven_z_chunk_size: None,
                seven_z_encrypt_file_names: None,
                tzap_certificates: None,
                preserve_metadata: false,
            },
            &registry,
        )
        .expect("fixture archive creation should start");
        let (create_snapshot, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_snapshot.status, JobStatusDto::Completed);

        let extract_job = start_extract_internal_with_spawner(
            StartExtractRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                destination_path: workspace.join("out").to_string_lossy().to_string(),
                password: None,
                overwrite: OverwritePolicyDto::Replace,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                entry_paths: None,
                strip_components: 0,
                tzap_restore_policy: TzapRestorePolicyDto::Portable,
                tzap_allow_degraded: false,
                tzap_allow_absolute_symlinks: false,
                ignore_symlinks: false,
            },
            &registry,
            |_worker| {},
        )
        .expect("extract job should be registered before its worker runs");

        let snapshot = registry
            .current_job_snapshot(&extract_job.job_id)
            .expect("registered extract job should have a retained snapshot");
        assert_eq!(snapshot.status, JobStatusDto::Queued);
        assert_eq!(snapshot.progress_facts.total_entries, None);
        assert_eq!(snapshot.progress_facts.total_bytes, None);
        let _ = fs::remove_dir_all(workspace);
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
                exclude_names: None,
                exclude_archive_paths: None,
                include_archive_paths: None,
                respect_gitignore: false,
                follow_symlinks: false,
                replace_existing: true,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: Some("smoke-secret".to_string()),
                compression_level: None,
                volume_size: None,
                tzap_recovery_percentage: None,
                tzap_volume_loss_tolerance: None,
                zip_compression: None,
                seven_z_solid: None,
                seven_z_threads: None,
                seven_z_chunk_size: None,
                seven_z_encrypt_file_names: None,
                tzap_certificates: None,
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
                tzap_restore_policy: TzapRestorePolicyDto::Portable,
                tzap_allow_degraded: false,
                tzap_allow_absolute_symlinks: false,
                ignore_symlinks: false,
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
                .any(|event| event.code == Some(constants::COMMAND_ERROR_PASSWORD_REQUIRED)),
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
                tzap_restore_policy: TzapRestorePolicyDto::Portable,
                tzap_allow_degraded: false,
                tzap_allow_absolute_symlinks: false,
                ignore_symlinks: false,
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
                .any(|event| event.code == Some(constants::COMMAND_ERROR_INVALID_PASSWORD)),
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
                tzap_restore_policy: TzapRestorePolicyDto::Portable,
                tzap_allow_degraded: false,
                tzap_allow_absolute_symlinks: false,
                ignore_symlinks: false,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: false,
            destination_collision_strategy: DestinationCollisionStrategyDto::Rename,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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

        let first_payload = vec![b'a'; 256 * 1024];
        let second_payload = vec![b'b'; 256 * 1024];
        fs::write(sources.join("one.bin"), &first_payload).expect("first fixture should write");
        fs::write(sources.join("two.bin"), &second_payload).expect("second fixture should write");
        let source_total_bytes = (first_payload.len() + second_payload.len()) as u64;
        let registry = crate::job_registry::JobRegistry::new();

        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
            preserve_metadata: true,
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
        assert!(destination.is_file());
        let finished_event = create_events
            .iter()
            .find(|event| {
                matches!(event.event_type, JobEventKindDto::BytesProcessed)
                    && event.entries.unwrap_or_default() > 0
            })
            .expect("tzap create should aggregate finished entries for file counts");
        assert!(finished_event.entries.unwrap_or_default() > 0);
        let summary = create_poll
            .terminal_summary
            .as_ref()
            .expect("tzap create should return a terminal summary");
        let listing = list_archive(crate::dto::ListArchiveRequest {
            archive_path: destination.to_string_lossy().to_string(),
            password: None,
        })
        .expect("created TZAP archive should expose entry metadata");
        println!(
            "summary.written_entries = {}, listing.entries = {:?}",
            summary.written_entries, listing.entries
        );
        assert_eq!(summary.written_entries, 3);
        assert_eq!(listing.entries.len(), 3);
        assert!(listing.entries.iter().all(|entry| entry.mode.is_some()));
        assert!(listing.entries.iter().all(|entry| entry.modified.is_some()));
        assert_ne!(summary.written_bytes, source_total_bytes);
        assert!(
            listing
                .entries
                .iter()
                .all(|entry| entry.metadata_diagnostics.is_empty())
        );
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_tzap_create_accepts_explicit_zero_recovery_fast_path() {
        let workspace = create_temp_workspace("start-create-tzap-zero-recovery");
        let sources = workspace.join("sources");
        let destination = workspace.join("created.tzap");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::write(sources.join("one.bin"), vec![b'a'; 16 * 1024]).expect("fixture should write");

        let registry = crate::job_registry::JobRegistry::new();
        let create_request = StartCreateRequest {
            sources: vec![sources.to_string_lossy().to_string()],
            destination_path: destination.to_string_lossy().to_string(),
            format: crate::dto::ArchiveFormatDto::Tzap,
            clean_source: false,
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: Some(0),
            tzap_recovery_percentage: Some(0),
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
            preserve_metadata: false,
        };

        let create_job = start_create_internal(create_request, &registry)
            .expect("zero-recovery create command should start a job");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);

        assert_eq!(create_poll.status, JobStatusDto::Completed);
        assert!(destination.is_file());
        let _ = fs::remove_dir_all(&workspace);
    }

    #[test]
    fn command_boundary_start_tzap_create_rejects_incomplete_signing_identity() {
        let workspace = create_temp_workspace("start-create-tzap-incomplete-signing");
        let sources = workspace.join("sources");
        let destination = workspace.join("created.tzap");
        fs::create_dir_all(&sources).expect("source directory should exist");
        fs::write(sources.join("one.txt"), b"one").expect("fixture should write");

        let result = start_create_internal(
            StartCreateRequest {
                sources: vec![sources.to_string_lossy().to_string()],
                destination_path: destination.to_string_lossy().to_string(),
                format: crate::dto::ArchiveFormatDto::Tzap,
                clean_source: false,
                exclude_names: None,
                exclude_archive_paths: None,
                include_archive_paths: None,
                respect_gitignore: false,
                follow_symlinks: false,
                replace_existing: false,
                destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
                password: None,
                compression_level: None,
                volume_size: None,
                tzap_recovery_percentage: None,
                tzap_volume_loss_tolerance: None,
                zip_compression: None,
                seven_z_solid: None,
                seven_z_threads: None,
                seven_z_chunk_size: None,
                seven_z_encrypt_file_names: None,
                tzap_certificates: Some(crate::dto::TzapCertificateOptionsDto {
                    recipient_certificate_paths: Vec::new(),
                    signing_identity_path: None,
                    signing_identity_password: None,
                    signing_certificate_path: Some("C:/certs/signer.pem".to_owned()),
                    signing_private_key_path: None,
                    signing_chain_paths: Vec::new(),
                }),
                preserve_metadata: false,
            },
            &crate::job_registry::JobRegistry::new(),
        );

        let error = result.expect_err("incomplete signing identity must be rejected");
        assert_eq!(error.code, "invalid_request");
        assert!(error.message.contains("certificate") && error.message.contains("private key"));
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            tzap_restore_policy: TzapRestorePolicyDto::Portable,
            tzap_allow_degraded: false,
            tzap_allow_absolute_symlinks: false,
            ignore_symlinks: false,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            tzap_restore_policy: TzapRestorePolicyDto::Portable,
            tzap_allow_degraded: false,
            tzap_allow_absolute_symlinks: false,
            ignore_symlinks: false,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            tzap_restore_policy: TzapRestorePolicyDto::Portable,
            tzap_allow_degraded: false,
            tzap_allow_absolute_symlinks: false,
            ignore_symlinks: false,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            tzap_restore_policy: TzapRestorePolicyDto::Portable,
            tzap_allow_degraded: false,
            tzap_allow_absolute_symlinks: false,
            ignore_symlinks: false,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
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
            extraction_policy(OverwritePolicyDto::Replace, 0, false),
            TzapRestoreOptions::default(),
            &token,
            &mut sink,
            JobKindDto::ZipExtract,
        )
        .expect("pre-cancelled selected extract should finish with a terminal summary");

        let poll = registry
            .take_test_events(&response.job_id)
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
            exclude_names: None,
            exclude_archive_paths: None,
            include_archive_paths: None,
            respect_gitignore: false,
            follow_symlinks: false,
            replace_existing: true,
            destination_collision_strategy: DestinationCollisionStrategyDto::Refuse,
            password: None,
            compression_level: None,
            volume_size: None,
            tzap_recovery_percentage: None,
            tzap_volume_loss_tolerance: None,
            zip_compression: None,
            seven_z_solid: None,
            seven_z_threads: None,
            seven_z_chunk_size: None,
            seven_z_encrypt_file_names: None,
            tzap_certificates: None,
            preserve_metadata: false,
        };
        let create_job =
            start_create_internal(create_request, &registry).expect("fixture create should start");
        let (create_poll, _) = wait_for_job_terminal(&registry, &create_job.job_id);
        assert_eq!(create_poll.status, JobStatusDto::Completed);

        let test_job = start_test_archive_internal(
            TestArchiveRequest {
                archive_path: destination_archive.to_string_lossy().to_string(),
                entry_paths: None,
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
                entry_paths: None,
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

        if fs::File::open(&archive_path).is_ok() {
            permissions.set_mode(0o644);
            let _ = fs::set_permissions(&archive_path, permissions);
            let _ = fs::remove_dir_all(&workspace);
            return;
        }

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
