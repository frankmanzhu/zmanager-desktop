#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod archive_file_types;
mod commands;
mod constants;
mod dto;
mod error;
mod job_dto;
mod job_registry;
mod platform;
mod quick_action;

use tauri::Manager;

fn main() {
    let startup_window_state = quick_action::QuickActionStartupState::from_startup_env();
    let job_registry = job_registry::JobRegistry::new();
    let startup_state =
        quick_action::prestart_direct_quick_action(startup_window_state, &job_registry);
    let quick_action_launch_coordinator =
        quick_action::QuickActionLaunchCoordinator::from_startup_state(startup_state);
    let single_instance_coordinator = quick_action_launch_coordinator.clone();

    let builder = tauri::Builder::default();
    let builder = platform::register_platform_services(builder);
    builder
        .manage(job_registry)
        .manage(quick_action_launch_coordinator)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(
            move |app, argv, _cwd| {
                let registry = app.state::<job_registry::JobRegistry>().inner().clone();
                single_instance_coordinator.ingest_secondary_process_args(
                    argv.into_iter().map(std::ffi::OsString::from).collect(),
                    app.clone(),
                    registry,
                );
            },
        ))
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "linux")]
                let _ = window.set_decorations(false);
                #[cfg(not(target_os = "linux"))]
                let _ = window;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::project_contract,
            commands::system_file_icons,
            commands::validate_directory,
            commands::quick_action_startup_state,
            commands::list_archive,
            commands::plan_create,
            commands::start_create,
            commands::start_extract,
            commands::verify_tzap_certificate,
            commands::generate_tzap_identity,
            commands::preview_entry,
            commands::start_native_file_drag,
            commands::cleanup_preview_roots,
            commands::test_archive,
            commands::poll_job_events,
            commands::cancel_job,
            commands::pause_job,
            commands::resume_job,
            commands::dismiss_job
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZManager desktop");
}
