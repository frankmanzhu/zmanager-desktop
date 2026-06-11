#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::healthcheck,
            commands::project_contract
        ])
        .run(tauri::generate_context!())
        .expect("failed to run ZManager desktop");
}
