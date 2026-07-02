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

use tauri::{LogicalSize, Manager, Size};

const QUICK_ACTION_WINDOW_WIDTH: f64 = 680.0;
const QUICK_ACTION_WINDOW_HEIGHT: f64 = 430.0;
const QUICK_ACTION_WINDOW_MIN_WIDTH: f64 = 560.0;
const QUICK_ACTION_WINDOW_MIN_HEIGHT: f64 = 340.0;

fn main() {
    let startup_window_state = quick_action::QuickActionStartupState::from_startup_env();
    let startup_job_only_window = matches!(
        &startup_window_state,
        quick_action::QuickActionStartupState::Requested(request)
            if request.kind != dto::QuickActionKindDto::Open
    );
    let quick_action_launch_coordinator =
        quick_action::QuickActionLaunchCoordinator::from_startup_env();
    let single_instance_coordinator = quick_action_launch_coordinator.clone();

    let builder = tauri::Builder::default();
    let builder = platform::register_platform_services(builder);
    builder
        .manage(job_registry::JobRegistry::new())
        .manage(quick_action_launch_coordinator)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(
            move |app, argv, _cwd| {
                single_instance_coordinator.ingest_secondary_process_args(
                    argv.into_iter().map(std::ffi::OsString::from).collect(),
                    app.clone(),
                );
            },
        ))
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                if startup_job_only_window {
                    let quick_action_min_size = Size::Logical(LogicalSize {
                        width: QUICK_ACTION_WINDOW_MIN_WIDTH,
                        height: QUICK_ACTION_WINDOW_MIN_HEIGHT,
                    });
                    let quick_action_size = Size::Logical(LogicalSize {
                        width: QUICK_ACTION_WINDOW_WIDTH,
                        height: QUICK_ACTION_WINDOW_HEIGHT,
                    });
                    let _ = window.set_min_size(Some(quick_action_min_size));
                    let _ = window.set_size(quick_action_size);
                    let _ = window.center();
                }
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::project_contract,
            commands::system_file_icons,
            commands::quick_action_startup_state,
            commands::list_archive,
            commands::plan_create,
            commands::start_create,
            commands::start_extract,
            commands::preview_entry,
            commands::start_native_file_drag,
            commands::cleanup_preview_roots,
            commands::test_archive,
            commands::poll_job_events,
            commands::cancel_job,
            commands::dismiss_job
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZManager desktop");
}
