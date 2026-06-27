#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod constants;
mod dto;
mod error;
mod job_dto;
mod job_registry;
mod platform;
mod quick_action;

fn main() {
    let builder = tauri::Builder::default();
    let builder = platform::register_platform_services(builder);
    builder
        .manage(job_registry::JobRegistry::new())
        .manage(quick_action::QuickActionStartupState::from_env())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
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
            commands::cleanup_preview_roots,
            commands::test_archive,
            commands::poll_job_events,
            commands::cancel_job,
            commands::dismiss_job
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZManager desktop");
}
