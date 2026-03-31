use crate::{app::window_state, presentation::commands};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            commands::delete_aws_connection_secrets,
            commands::test_aws_connection,
            commands::list_aws_buckets,
            commands::get_aws_bucket_region,
            commands::list_aws_bucket_items,
            commands::start_aws_cache_download,
            commands::download_aws_object_to_path,
            commands::cancel_aws_download,
            commands::find_aws_cached_objects,
            commands::open_aws_cached_object_parent
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}
