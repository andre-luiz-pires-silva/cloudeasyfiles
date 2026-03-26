use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, LogicalSize, Manager, Runtime, Window, WindowEvent};

const WINDOW_STATE_FILE_NAME: &str = "window-state.json";
const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SavedWindowState {
    width: f64,
    height: f64,
}

pub fn restore_main_window_size<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        eprintln!(
            "[window_state] main window not found while trying to restore saved size"
        );
        return;
    };

    let Some(saved_state) = load_window_state(app) else {
        return;
    };

    if let Err(error) = window.set_size(LogicalSize::new(saved_state.width, saved_state.height)) {
        eprintln!(
            "[window_state] failed to restore main window size width={} height={} error={}",
            saved_state.width, saved_state.height, error
        );
    }
}

pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::Resized(size) => {
            match window.scale_factor() {
                Ok(scale_factor) => {
                    let logical_size = size.to_logical::<f64>(scale_factor);
                    save_window_state(&window.app_handle(), logical_size.width, logical_size.height);
                }
                Err(error) => {
                    eprintln!(
                        "[window_state] failed to resolve scale factor for resize event error={}",
                        error
                    );
                }
            }
        }
        WindowEvent::ScaleFactorChanged { new_inner_size, .. } => {
            match window.scale_factor() {
                Ok(scale_factor) => {
                    let logical_size = new_inner_size.to_logical::<f64>(scale_factor);
                    save_window_state(&window.app_handle(), logical_size.width, logical_size.height);
                }
                Err(error) => {
                    eprintln!(
                        "[window_state] failed to resolve scale factor for scale-factor change error={}",
                        error
                    );
                }
            }
        }
        _ => {}
    }
}

fn load_window_state<R: Runtime>(app: &AppHandle<R>) -> Option<SavedWindowState> {
    let state_path = window_state_path(app)?;
    let raw_contents = fs::read_to_string(&state_path).ok()?;

    match serde_json::from_str::<SavedWindowState>(&raw_contents) {
        Ok(saved_state) => Some(saved_state),
        Err(error) => {
            eprintln!(
                "[window_state] failed to parse saved window state path={} error={}",
                state_path.display(),
                error
            );
            None
        }
    }
}

fn save_window_state<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64) {
    let Some(state_path) = window_state_path(app) else {
        return;
    };

    if let Some(parent_directory) = state_path.parent() {
        if let Err(error) = fs::create_dir_all(parent_directory) {
            eprintln!(
                "[window_state] failed to create state directory path={} error={}",
                parent_directory.display(),
                error
            );
            return;
        }
    }

    let saved_state = SavedWindowState { width, height };

    match serde_json::to_string_pretty(&saved_state) {
        Ok(serialized_state) => {
            if let Err(error) = fs::write(&state_path, serialized_state) {
                eprintln!(
                    "[window_state] failed to write state file path={} error={}",
                    state_path.display(),
                    error
                );
            }
        }
        Err(error) => {
            eprintln!(
                "[window_state] failed to serialize window state width={} height={} error={}",
                width, height, error
            );
        }
    }
}

fn window_state_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    match app.path().app_config_dir() {
        Ok(config_dir) => Some(config_dir.join(WINDOW_STATE_FILE_NAME)),
        Err(error) => {
            eprintln!(
                "[window_state] failed to resolve app config directory error={}",
                error
            );
            None
        }
    }
}
