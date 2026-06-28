use std::ffi::OsString;

use crate::dto::{
    QuickActionKindDto, QuickActionRequestDto, QuickActionStartupErrorDto,
    QuickActionStartupStateDto,
};

const QUICK_ACTION_ARG: &str = "--quick-action";
const QUICK_ACTION_ARG_ALIAS: &str = "--action";
const PATH_ARG: &str = "--path";
const PASSWORD_ARG_PREFIXES: &[&str] = &["--password", "--passphrase", "--secret"];

const SUPPORTED_SINGLE_EXTENSIONS: &[&str] = &[
    "7z", "apk", "appx", "br", "bz2", "cab", "cbr", "cpio", "deb", "gz", "ipa", "iso", "jar", "lz",
    "lz4", "lzma", "lzo", "lrz", "rar", "rpm", "tar", "tbz2", "tgz", "txz", "tzap", "tzst", "war",
    "xar", "xpi", "xz", "z", "zip", "zipx", "zst",
];
const SUPPORTED_COMPOUND_EXTENSIONS: &[&str] = &[
    "tar.br", "tar.bz2", "tar.gz", "tar.lz", "tar.lz4", "tar.lzma", "tar.lzo", "tar.lrz", "tar.xz",
    "tar.z", "tar.zst",
];
const SUPPORTED_SPLIT_ARCHIVE_SUFFIXES: &[&str] = &[".7z.001", ".vol000.tzap"];
const TZAP_EXTENSION_SUFFIX: &str = ".tzap";
const TZAP_VOLUME_MARKER: &str = ".vol";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum QuickActionStartupState {
    NotRequested,
    Requested(QuickActionRequestDto),
    Invalid(QuickActionError),
}

impl QuickActionStartupState {
    pub fn from_env() -> Self {
        Self::from_args(std::env::args_os().skip(1))
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
                error: None,
            },
            Self::Requested(request) => QuickActionStartupStateDto {
                launched_for_quick_action: true,
                quick_action: Some(request.clone()),
                error: None,
            },
            Self::Invalid(error) => QuickActionStartupStateDto {
                launched_for_quick_action: true,
                quick_action: None,
                error: Some(error.to_dto()),
            },
        }
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

enum ParseOutcome {
    NotRequested,
    Requested(Result<QuickActionRequestDto, QuickActionError>),
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

    if SUPPORTED_SPLIT_ARCHIVE_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix))
    {
        return true;
    }

    if SUPPORTED_COMPOUND_EXTENSIONS
        .iter()
        .any(|extension| name.ends_with(&format!(".{extension}")))
    {
        return true;
    }

    let Some(extension) = name.rsplit_once('.').map(|(_, extension)| extension) else {
        return false;
    };

    SUPPORTED_SINGLE_EXTENSIONS.contains(&extension)
}

fn parse_quick_action_args(args: impl IntoIterator<Item = OsString>) -> ParseOutcome {
    let mut requested = false;
    let mut kind: Option<Result<QuickActionKindDto, QuickActionError>> = None;
    let mut paths = Vec::new();
    let mut pending_path_values = false;
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
            continue;
        }

        if arg == QUICK_ACTION_ARG || arg == QUICK_ACTION_ARG_ALIAS {
            requested = true;
            kind = Some(Err(QuickActionError::invalid(
                "--quick-action requires an action value",
            )));
            pending_path_values = false;
            continue;
        }

        if arg == PATH_ARG {
            requested = true;
            pending_path_values = true;
            continue;
        }

        if arg.starts_with("--") {
            pending_path_values = false;
            if !requested {
                saw_unknown_option = true;
            }
            continue;
        }

        if requested {
            if matches!(kind, Some(Err(_))) {
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

        if path.contains("://") {
            return Err(QuickActionError::invalid(format!(
                "quick-action path must be local: {path}"
            )));
        }

        normalized.push(path.to_string());
    }

    Ok(normalized)
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
}
