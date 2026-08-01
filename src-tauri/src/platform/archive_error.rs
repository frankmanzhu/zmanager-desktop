use zmanager_core::archive_browser::ArchiveBrowserError;

use crate::error::CommandErrorDto;

pub(crate) fn map_archive_browser_error(error: ArchiveBrowserError) -> CommandErrorDto {
    match error {
        ArchiveBrowserError::Cancelled => {
            CommandErrorDto::cancelled("Archive enumeration was cancelled.")
        }
        ArchiveBrowserError::Zip(source) => crate::commands::map_zip_error(source),
        ArchiveBrowserError::TarZst(source) => crate::commands::map_tar_zst_error(source),
        ArchiveBrowserError::SevenZ(source) => crate::commands::map_7z_error(source),
        ArchiveBrowserError::Tzap(source) => crate::commands::map_tzap_error(source),
        #[cfg(target_os = "macos")]
        ArchiveBrowserError::AppleArchive(source) => {
            super::apple_archive::map_apple_archive_error(source)
        }
        ArchiveBrowserError::Libarchive(source) => crate::commands::map_libarchive_error(source),
        ArchiveBrowserError::RawStream(source) => crate::commands::map_raw_stream_error(source),
        ArchiveBrowserError::Io { path, source } => {
            crate::commands::map_io_error(path.to_string_lossy().to_string(), source)
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
        ArchiveBrowserError::UnsupportedOperation(msg) => {
            CommandErrorDto::operation_failed(format!("Unsupported operation: {msg}"))
        }
    }
}
