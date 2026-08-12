//! Apple Archive platform integration.
//!
//! Apple Archive is only available on macOS via system frameworks, but the
//! platform gating lives in zmanager-core (its entry points are portable and
//! return `AppleArchiveError::Unsupported` off-Apple); this module just maps
//! core errors onto desktop DTOs and carries no `#[cfg(target_os)]` itself.

use std::path::Path;

use crate::error::CommandErrorDto;
use crate::job_dto::JobTerminalSummaryDto;
use zmanager_core::apple_archive_backend::{AppleArchiveCreateOptions, AppleArchiveError};
use zmanager_core::jobs::CancellationToken;
use zmanager_core::jobs::JobContext;
use zmanager_core::manifest::ArchiveManifest;
use zmanager_core::safety::ExtractionPolicy;

pub(crate) struct AppleArchiveExtractReportDto {
    pub written_entries: usize,
    pub written_bytes: u64,
}

/// Creates an Apple Archive from a manifest, emitting job events through the context.
pub(crate) fn create_apple_archive(
    manifest: &ArchiveManifest,
    destination: &str,
    preserve_metadata: bool,
    replace_existing: bool,
    password: Option<&str>,
    token: &CancellationToken,
    sink: &mut dyn zmanager_core::jobs::JobEventSink,
) -> Result<JobTerminalSummaryDto, CommandErrorDto> {
    let create_options = AppleArchiveCreateOptions {
        preserve_metadata,
        replace_existing,
        password: password.map(String::from),
        ..Default::default()
    };
    let mut context = JobContext::new(token, sink);
    zmanager_core::apple_archive_backend::create_apple_archive_from_manifest_with_context(
        manifest,
        destination,
        &create_options,
        &mut context,
    )
    .map(|report| JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: None,
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    })
    .map_err(map_apple_archive_error)
}

/// Extracts an Apple Archive, emitting job events through the context.
pub(crate) fn extract_apple_archive(
    archive_path: &str,
    destination_path: &str,
    policy: ExtractionPolicy,
    password: Option<&str>,
    token: &CancellationToken,
    sink: &mut dyn zmanager_core::jobs::JobEventSink,
) -> Result<JobTerminalSummaryDto, CommandErrorDto> {
    let mut context = JobContext::new(token, sink);
    zmanager_core::apple_archive_backend::extract_apple_archive_with_context(
        archive_path,
        destination_path,
        policy,
        password,
        &mut context,
    )
    .map(|report| JobTerminalSummaryDto {
        written_entries: report.written_entries,
        skipped_entries: Some(report.skipped_entries),
        written_bytes: report.written_bytes,
        warnings: report.warnings,
    })
    .map_err(map_apple_archive_error)
}

pub(crate) fn map_apple_archive_error(error: AppleArchiveError) -> CommandErrorDto {
    match error {
        AppleArchiveError::Plan(source) => {
            CommandErrorDto::operation_failed(format!("AppleArchive plan error: {source}"))
        }
        AppleArchiveError::Native(source) => {
            CommandErrorDto::operation_failed(format!("AppleArchive native error: {source}"))
        }
        AppleArchiveError::Io { path, source } => CommandErrorDto::io_error(
            format!("I/O failed for {}: {source}", path.display()),
            false,
        ),
        AppleArchiveError::Safety(source) => {
            CommandErrorDto::operation_failed(format!("AppleArchive safety error: {source}"))
        }
        AppleArchiveError::MissingLinkTarget { path } => CommandErrorDto::unsupported_format(
            format!("AppleArchive link entry has no target: {path}"),
        ),
        AppleArchiveError::MissingFileData { path } => CommandErrorDto::unsupported_format(
            format!("AppleArchive file entry has no data blob: {path}"),
        ),
        AppleArchiveError::EntryNotFound { path } => {
            CommandErrorDto::not_found(format!("AppleArchive entry not found: {path}"), None)
        }
        AppleArchiveError::StdoutSelectionNotSingleFile { selected_files } => {
            CommandErrorDto::operation_failed(format!(
                "AppleArchive stdout extraction requires exactly one selected regular file; selected {selected_files}"
            ))
        }
        AppleArchiveError::Cancelled => {
            CommandErrorDto::cancelled("AppleArchive job was cancelled.")
        }
        AppleArchiveError::Unsupported => CommandErrorDto::unsupported_format(
            "Apple Archive format (.aar / .aea) is only supported on macOS",
        ),
    }
}

/// Copies Apple Archive file entries to a writer.
pub(crate) fn copy_apple_archive_files_to_writer<W: std::io::Write>(
    archive_path: &Path,
    selected: impl FnMut(&str) -> bool,
    output: &mut W,
    password: Option<&str>,
) -> Result<AppleArchiveExtractReportDto, CommandErrorDto> {
    zmanager_core::apple_archive_backend::copy_apple_archive_files_to_writer(
        archive_path,
        selected,
        output,
        password,
    )
    .map(|report| AppleArchiveExtractReportDto {
        written_entries: report.written_entries,
        written_bytes: report.written_bytes,
    })
    .map_err(map_apple_archive_error)
}
