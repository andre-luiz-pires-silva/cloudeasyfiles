use crate::{app::window_state, presentation::commands};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            window_state::restore_main_window_size(&app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            window_state::handle_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_greeting,
            commands::save_aws_connection_secrets,
            commands::load_aws_connection_secrets,
            commands::delete_aws_connection_secrets
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}
