use crate::presentation::commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_greeting,
            commands::save_aws_connection_secrets,
            commands::load_aws_connection_secrets,
            commands::delete_aws_connection_secrets
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}
