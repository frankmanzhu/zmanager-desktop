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
            "subscribe_job",
            "subscribe_job_catalog",
            "ack_subscription",
            "unsubscribe_job",
            "cancel_job",
            "pause_job",
            "resume_job",
            "dismiss_job",
        ]),
    ))
    .expect("failed to run Tauri build script");
}
