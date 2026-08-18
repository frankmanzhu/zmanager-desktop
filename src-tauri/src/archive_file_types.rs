use std::sync::OnceLock;

use serde::Deserialize;

const ARCHIVE_FILE_TYPES_MANIFEST: &str = include_str!("generated/archive_file_types.generated.json");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveFileTypesManifest {
    single_extensions: Vec<String>,
    compound_extensions: Vec<String>,
    split_archive_suffixes: Vec<String>,
}

fn manifest() -> &'static ArchiveFileTypesManifest {
    static MANIFEST: OnceLock<ArchiveFileTypesManifest> = OnceLock::new();
    MANIFEST.get_or_init(|| serde_json::from_str(ARCHIVE_FILE_TYPES_MANIFEST).expect("archive file type manifest should be valid JSON"))
}

pub fn single_extensions() -> &'static [String] {
    &manifest().single_extensions
}

pub fn compound_extensions() -> &'static [String] {
    &manifest().compound_extensions
}

pub fn split_archive_suffixes() -> &'static [String] {
    &manifest().split_archive_suffixes
}

pub fn associated_extensions() -> Vec<String> {
    let mut extensions = single_extensions().to_vec();
    extensions.extend(split_archive_suffixes().iter().filter_map(|suffix| suffix.strip_prefix('.').map(str::to_string)));
    extensions.sort();
    extensions.dedup();
    extensions
}
