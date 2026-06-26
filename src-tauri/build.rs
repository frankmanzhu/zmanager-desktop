fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "healthcheck",
            "project_contract",
            "quick_action_startup_state",
            "list_archive",
            "plan_create",
            "start_create",
            "start_extract",
            "preview_entry",
            "cleanup_preview_roots",
            "test_archive",
            "poll_job_events",
            "cancel_job",
            "dismiss_job",
        ]),
    ))
    .expect("failed to run Tauri build script");
}
