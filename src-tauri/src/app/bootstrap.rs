use crate::{app::window_state, presentation::commands};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tauri::{image::Image, AppHandle, Listener, Manager, Runtime};

const FRONTEND_READY_EVENT: &str = "frontend://ready";
const FRONTEND_BOOT_FAILED_EVENT: &str = "frontend://boot-failed";
const FRONTEND_READY_TIMEOUT: Duration = Duration::from_secs(6);
const FRONTEND_RELOAD_SCRIPT: &str = "window.location.reload();";
const MAIN_WINDOW_ICON_PNG: &[u8] = include_bytes!("../../icons/128x128@2x.png");

#[derive(Debug, PartialEq, Eq)]
enum FrontendTimeoutAction {
    NoReload,
    WindowMissing,
    ReloadOnce { script: &'static str, log_message: String },
}

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
            commands::azure_blob_exists,
            commands::request_aws_object_restore,
            commands::create_aws_folder,
            commands::create_azure_folder,
            commands::delete_aws_objects,
            commands::delete_azure_objects,
            commands::delete_aws_prefix,
            commands::delete_azure_prefix,
            commands::change_aws_object_storage_class,
            commands::change_azure_blob_access_tier,
            commands::rehydrate_azure_blob,
            commands::open_external_url,
            commands::start_aws_cache_download,
            commands::start_azure_cache_download,
            commands::download_aws_object_to_path,
            commands::download_azure_blob_to_path,
            commands::start_aws_upload,
            commands::start_aws_upload_bytes,
            commands::start_azure_upload,
            commands::start_azure_upload_bytes,
            commands::cancel_aws_download,
            commands::cancel_azure_download,
            commands::cancel_aws_upload,
            commands::cancel_azure_upload,
            commands::find_aws_cached_objects,
            commands::find_azure_cached_objects,
            commands::open_aws_cached_object,
            commands::open_aws_cached_object_parent,
            commands::open_azure_cached_object,
            commands::open_azure_cached_object_parent
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudEasyFiles application");
}

fn prepare_main_window<R: Runtime>(app: &AppHandle<R>) {
    window_state::restore_main_window_size(app);

    let Some(window) = app.get_webview_window("main") else {
        eprintln!("{}", missing_main_window_message());
        return;
    };

    apply_main_window_icon(&window);

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

        match resolve_frontend_timeout_action(
            &boot_resolved_flag,
            app_handle.get_webview_window("main").is_some(),
            FRONTEND_READY_TIMEOUT,
        ) {
            FrontendTimeoutAction::NoReload | FrontendTimeoutAction::WindowMissing => return,
            FrontendTimeoutAction::ReloadOnce { script, log_message } => {
                let Some(window) = app_handle.get_webview_window("main") else {
                    return;
                };

                eprintln!("{log_message}");

                if let Err(error) = window.eval(script) {
                    eprintln!("{}", frontend_reload_eval_error_message(&error.to_string()));
                    return;
                }
            }
        }
    });
}

fn should_reload_frontend_after_timeout(frontend_boot_resolved: &AtomicBool) -> bool {
    !frontend_boot_resolved.load(Ordering::SeqCst)
}

fn resolve_frontend_timeout_action(
    frontend_boot_resolved: &AtomicBool,
    window_available: bool,
    timeout: Duration,
) -> FrontendTimeoutAction {
    if !should_reload_frontend_after_timeout(frontend_boot_resolved) {
        return FrontendTimeoutAction::NoReload;
    }

    if !window_available {
        return FrontendTimeoutAction::WindowMissing;
    }

    FrontendTimeoutAction::ReloadOnce {
        script: FRONTEND_RELOAD_SCRIPT,
        log_message: frontend_reload_timeout_message(timeout),
    }
}

fn missing_main_window_message() -> &'static str {
    "[bootstrap] main window not found while preparing startup flow"
}

fn frontend_reload_timeout_message(timeout: Duration) -> String {
    format!(
        "[bootstrap] frontend ready event timed out after {}s; reloading webview once",
        timeout.as_secs()
    )
}

fn frontend_reload_eval_error_message(error: &str) -> String {
    format!("[bootstrap] failed to reload webview after startup timeout error={error}")
}

fn main_window_icon_load_error_message(error: &str) -> String {
    format!("[bootstrap] failed to load main window icon error={error}")
}

fn main_window_icon_apply_error_message(error: &str) -> String {
    format!("[bootstrap] failed to apply main window icon error={error}")
}

fn apply_main_window_icon<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let icon = match Image::from_bytes(MAIN_WINDOW_ICON_PNG) {
        Ok(icon) => icon,
        Err(error) => {
            eprintln!("{}", main_window_icon_load_error_message(&error.to_string()));
            return;
        }
    };

    if let Err(error) = window.set_icon(icon) {
        eprintln!("{}", main_window_icon_apply_error_message(&error.to_string()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reloads_frontend_only_when_boot_is_unresolved_after_timeout() {
        let unresolved = AtomicBool::new(false);
        let resolved = AtomicBool::new(true);

        assert!(should_reload_frontend_after_timeout(&unresolved));
        assert!(!should_reload_frontend_after_timeout(&resolved));
    }

    #[test]
    fn exposes_bootstrap_log_messages() {
        assert_eq!(
            missing_main_window_message(),
            "[bootstrap] main window not found while preparing startup flow"
        );
        assert_eq!(
            frontend_reload_timeout_message(Duration::from_secs(6)),
            "[bootstrap] frontend ready event timed out after 6s; reloading webview once"
        );
        assert_eq!(
            frontend_reload_timeout_message(Duration::from_secs(12)),
            "[bootstrap] frontend ready event timed out after 12s; reloading webview once"
        );
        assert_eq!(
            frontend_reload_eval_error_message("eval failed"),
            "[bootstrap] failed to reload webview after startup timeout error=eval failed"
        );
        assert_eq!(
            main_window_icon_load_error_message("decode failed"),
            "[bootstrap] failed to load main window icon error=decode failed"
        );
        assert_eq!(
            main_window_icon_apply_error_message("platform rejected icon"),
            "[bootstrap] failed to apply main window icon error=platform rejected icon"
        );
    }

    #[test]
    fn resolves_frontend_timeout_actions() {
        let unresolved = AtomicBool::new(false);
        let resolved = AtomicBool::new(true);

        assert_eq!(
            resolve_frontend_timeout_action(&resolved, true, Duration::from_secs(6)),
            FrontendTimeoutAction::NoReload
        );
        assert_eq!(
            resolve_frontend_timeout_action(&unresolved, false, Duration::from_secs(6)),
            FrontendTimeoutAction::WindowMissing
        );
        assert_eq!(
            resolve_frontend_timeout_action(&unresolved, true, Duration::from_secs(6)),
            FrontendTimeoutAction::ReloadOnce {
                script: FRONTEND_RELOAD_SCRIPT,
                log_message: frontend_reload_timeout_message(Duration::from_secs(6)),
            }
        );
    }

    #[test]
    fn reload_decision_tracks_atomic_state_transitions() {
        let state = AtomicBool::new(false);

        assert!(should_reload_frontend_after_timeout(&state));

        state.store(true, Ordering::SeqCst);
        assert!(!should_reload_frontend_after_timeout(&state));

        state.store(false, Ordering::SeqCst);
        assert!(should_reload_frontend_after_timeout(&state));
    }

    #[test]
    fn timeout_action_uses_requested_timeout_in_reload_message() {
        let unresolved = AtomicBool::new(false);

        assert_eq!(
            resolve_frontend_timeout_action(&unresolved, true, Duration::from_secs(30)),
            FrontendTimeoutAction::ReloadOnce {
                script: FRONTEND_RELOAD_SCRIPT,
                log_message: frontend_reload_timeout_message(Duration::from_secs(30)),
            }
        );
        assert_eq!(
            frontend_reload_timeout_message(Duration::from_secs(1)),
            "[bootstrap] frontend ready event timed out after 1s; reloading webview once"
        );
    }
}
