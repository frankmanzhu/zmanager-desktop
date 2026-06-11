#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod constants;
mod dto;
mod error;
mod job_dto;
mod job_registry;
mod platform;

fn main() {
    let builder = tauri::Builder::default();
    let builder = platform::register_platform_services(builder);
    builder
        .manage(job_registry::JobRegistry::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::project_contract,
            commands::list_archive,
            commands::plan_create,
            commands::start_create,
            commands::start_extract,
            commands::extract_entry,
            commands::preview_entry,
            commands::test_archive,
            commands::poll_job_events,
            commands::cancel_job,
            commands::dismiss_job
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZManager desktop");
}
