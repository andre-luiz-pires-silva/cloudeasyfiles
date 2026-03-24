use crate::presentation::commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::get_greeting])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}
