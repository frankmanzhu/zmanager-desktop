use tauri::Manager;

#[tauri::command]
fn get_theme(window: tauri::Window) -> String {
    format!("{:?}", window.theme())
}
