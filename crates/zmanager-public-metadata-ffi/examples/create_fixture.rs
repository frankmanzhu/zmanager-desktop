use std::fs;
use std::path::PathBuf;

use zmanager_core::jobs::{CancellationToken, JobContext};
use zmanager_core::manifest::{
    ArchiveManifest, ManifestEntry, ManifestFileType, PermissionSnapshot,
};
use zmanager_core::secrets::SecretString;
use zmanager_core::tzap_backend::{
    TzapCreateOptions, TzapKeySource, create_tzap_from_manifest_with_context,
};

fn main() {
    let mut arguments = std::env::args_os().skip(1);
    let destination = PathBuf::from(arguments.next().expect("usage: create_fixture OUTPUT [plain|encrypted|multi]"));
    let mode = arguments.next().and_then(|value| value.into_string().ok()).unwrap_or_else(|| "plain".to_owned());
    let source = destination.with_extension("fixture-source.txt");
    let payload = if mode == "multi" {
        let mut state = 0x1234_5678_9abc_def0u64;
        (0..10 * 1024 * 1024)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 7;
                state ^= state << 17;
                state as u8
            })
            .collect()
    } else {
        b"Z-Manager installed metadata smoke fixture\n".to_vec()
    };
    fs::write(&source, payload).unwrap();
    let size = fs::metadata(&source).unwrap().len();
    let root = destination.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf();
    let manifest = ArchiveManifest {
        root,
        entries: vec![ManifestEntry {
            archive_path: "metadata-smoke.txt".to_owned(),
            source_path: source.clone(),
            file_type: ManifestFileType::File,
            size,
            modified: None,
            permissions: PermissionSnapshot { readonly: false, unix_mode: Some(0o644) },
            symlink_target: None,
        }],
        total_bytes: size,
        excluded_entries: Vec::new(),
        excluded_bytes: 0,
        warnings: Vec::new(),
    };
    let options = TzapCreateOptions {
        key_source: if mode == "plain" {
            TzapKeySource::NoPassword
        } else {
            TzapKeySource::Passphrase(SecretString::new("installed-smoke-only"))
        },
        level: 1,
        preserve_metadata: true,
        replace_existing: true,
        volume_size: (mode == "multi").then_some(4 * 1024 * 1024),
        recovery_percentage: 0,
        volume_loss_tolerance: 0,
        x509_signing: None,
    };
    let cancellation = CancellationToken::new();
    let mut events = |_| {};
    let mut context = JobContext::new(&cancellation, &mut events);
    create_tzap_from_manifest_with_context(&manifest, &destination, &options, &mut context).unwrap();
    fs::remove_file(source).unwrap();
    println!("{}", destination.display());
}
