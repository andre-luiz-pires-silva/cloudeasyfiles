use crate::{app::window_state, presentation::commands};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{AppHandle, Listener, Manager, Runtime};

const FRONTEND_READY_EVENT: &str = "frontend://ready";
const FRONTEND_BOOT_FAILED_EVENT: &str = "frontend://boot-failed";
const FRONTEND_READY_TIMEOUT: Duration = Duration::from_secs(6);
const FRONTEND_RELOAD_SCRIPT: &str = "window.location.reload();";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            prepare_main_window(&app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            window_state::handle_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_greeting,
            commands::validate_local_mapping_directory,
            commands::save_aws_connection_secrets,
            commands::load_aws_connection_secrets,
            commands::delete_aws_connection_secrets,
            commands::save_azure_connection_secrets,
            commands::load_azure_connection_secrets,
            commands::delete_azure_connection_secrets,
            commands::test_aws_connection,
            commands::test_azure_connection,
            commands::list_aws_buckets,
            commands::list_azure_containers,
            commands::get_aws_bucket_region,
            commands::list_aws_bucket_items,
            commands::list_azure_container_items,
            commands::aws_object_exists,
            commands::request_aws_object_restore,
            commands::create_aws_folder,
            commands::delete_aws_objects,
            commands::delete_aws_prefix,
            commands::change_aws_object_storage_class,
            commands::open_external_url,
            commands::start_aws_cache_download,
            commands::download_aws_object_to_path,
            commands::start_aws_upload,
            commands::start_aws_upload_bytes,
            commands::cancel_aws_download,
            commands::cancel_aws_upload,
            commands::find_aws_cached_objects,
            commands::open_aws_cached_object,
            commands::open_aws_cached_object_parent
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}

fn prepare_main_window<R: Runtime>(app: &AppHandle<R>) {
    window_state::restore_main_window_size(app);

    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[bootstrap] main window not found while preparing startup flow");
        return;
    };

    let frontend_boot_resolved = Arc::new(AtomicBool::new(false));
    let ready_flag = frontend_boot_resolved.clone();
    window.once(FRONTEND_READY_EVENT, move |_| {
        ready_flag.store(true, Ordering::SeqCst);
    });

    let failed_flag = frontend_boot_resolved.clone();
    window.once(FRONTEND_BOOT_FAILED_EVENT, move |_| {
        failed_flag.store(true, Ordering::SeqCst);
    });

    let app_handle = app.clone();
    let boot_resolved_flag = frontend_boot_resolved;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FRONTEND_READY_TIMEOUT).await;

        if boot_resolved_flag.load(Ordering::SeqCst) {
            return;
        }

        let Some(window) = app_handle.get_webview_window("main") else {
            return;
        };

        eprintln!(
            "[bootstrap] frontend ready event timed out after {}s; reloading webview once",
            FRONTEND_READY_TIMEOUT.as_secs()
        );

        if let Err(error) = window.eval(FRONTEND_RELOAD_SCRIPT) {
            eprintln!("[bootstrap] failed to reload webview after startup timeout error={error}");
            return;
        }
    });
}
