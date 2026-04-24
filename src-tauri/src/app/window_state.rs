use serde::{Deserialize, Serialize};
use std::{
    fmt::Display,
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalSize, Runtime, Window, WindowEvent};

const WINDOW_STATE_FILE_NAME: &str = "window-state.json";
const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SavedWindowState {
    width: f64,
    height: f64,
}

pub fn restore_main_window_size<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        eprintln!("{}", missing_main_window_restore_message());
        return;
    };

    let Some(saved_state) = load_window_state(app) else {
        return;
    };

    if let Err(error) = window.set_size(logical_size_from_saved_state(&saved_state)) {
        eprintln!(
            "{}",
            restore_size_error_message(saved_state.width, saved_state.height, &error)
        );
    }
}

pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::Resized(size) => match window.scale_factor() {
            Ok(scale_factor) => {
                let logical_size = logical_size_from_physical(*size, scale_factor);
                save_window_state(
                    &window.app_handle(),
                    logical_size.width,
                    logical_size.height,
                );
            }
            Err(error) => {
                eprintln!("{}", scale_factor_error_message("resize", &error));
            }
        },
        WindowEvent::ScaleFactorChanged { new_inner_size, .. } => match window.scale_factor() {
            Ok(scale_factor) => {
                let logical_size = logical_size_from_physical(*new_inner_size, scale_factor);
                save_window_state(
                    &window.app_handle(),
                    logical_size.width,
                    logical_size.height,
                );
            }
            Err(error) => {
                eprintln!(
                    "{}",
                    scale_factor_error_message("scale-factor change", &error)
                );
            }
        },
        _ => {}
    }
}

fn load_window_state<R: Runtime>(app: &AppHandle<R>) -> Option<SavedWindowState> {
    let state_path = window_state_path(app)?;
    load_window_state_from_path(&state_path)
}

fn load_window_state_from_path(state_path: &Path) -> Option<SavedWindowState> {
    let raw_contents = fs::read_to_string(state_path).ok()?;

    match parse_window_state(&raw_contents) {
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

    let saved_state = SavedWindowState { width, height };
    save_window_state_to_path(&state_path, &saved_state);
}

fn save_window_state_to_path(state_path: &Path, saved_state: &SavedWindowState) {
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

    match serialize_window_state(saved_state) {
        Ok(serialized_state) => {
            if let Err(error) = fs::write(state_path, serialized_state) {
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
                saved_state.width, saved_state.height, error
            );
        }
    }
}

fn window_state_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    match app.path().app_config_dir() {
        Ok(config_dir) => Some(build_window_state_path(&config_dir)),
        Err(error) => {
            eprintln!(
                "[window_state] failed to resolve app config directory error={}",
                error
            );
            None
        }
    }
}

fn parse_window_state(raw_contents: &str) -> serde_json::Result<SavedWindowState> {
    serde_json::from_str::<SavedWindowState>(raw_contents)
}

fn serialize_window_state(saved_state: &SavedWindowState) -> serde_json::Result<String> {
    serde_json::to_string_pretty(saved_state)
}

fn logical_size_from_saved_state(saved_state: &SavedWindowState) -> LogicalSize<f64> {
    LogicalSize::new(saved_state.width, saved_state.height)
}

fn logical_size_from_physical(size: PhysicalSize<u32>, scale_factor: f64) -> LogicalSize<f64> {
    size.to_logical::<f64>(scale_factor)
}

fn missing_main_window_restore_message() -> &'static str {
    "[window_state] main window not found while trying to restore saved size"
}

fn restore_size_error_message(width: f64, height: f64, error: &impl Display) -> String {
    format!(
        "[window_state] failed to restore main window size width={} height={} error={}",
        width, height, error
    )
}

fn scale_factor_error_message(event_kind: &str, error: &impl Display) -> String {
    format!(
        "[window_state] failed to resolve scale factor for {event_kind} event error={}",
        error
    )
}

fn build_window_state_path(config_dir: &Path) -> PathBuf {
    config_dir.join(WINDOW_STATE_FILE_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_saved_window_state_from_json() {
        let saved_state = parse_window_state(
            r#"{
                "width": 1440.5,
                "height": 900.25
            }"#,
        )
        .expect("valid window state");

        assert_eq!(saved_state.width, 1440.5);
        assert_eq!(saved_state.height, 900.25);
    }

    #[test]
    fn rejects_invalid_saved_window_state_json() {
        assert!(parse_window_state(r#"{"width":"wide","height":900}"#).is_err());
        assert!(parse_window_state(r#"{"width":1440}"#).is_err());
        assert!(parse_window_state("not json").is_err());
    }

    #[test]
    fn serializes_saved_window_state_to_pretty_json() {
        let serialized = serialize_window_state(&SavedWindowState {
            width: 1280.0,
            height: 720.0,
        })
        .expect("serializable window state");

        assert!(serialized.contains("\"width\": 1280.0"));
        assert!(serialized.contains("\"height\": 720.0"));
    }

    #[test]
    fn round_trips_saved_window_state_through_json() {
        let initial_state = SavedWindowState {
            width: 1024.0,
            height: 768.0,
        };
        let serialized = serialize_window_state(&initial_state).expect("serializable window state");
        let parsed = parse_window_state(&serialized).expect("serialized state should parse");

        assert_eq!(parsed.width, initial_state.width);
        assert_eq!(parsed.height, initial_state.height);
    }

    #[test]
    fn parses_integer_dimensions_as_f64_values() {
        let saved_state = parse_window_state(r#"{"width":1280,"height":720}"#)
            .expect("integer dimensions should parse as f64");

        assert_eq!(saved_state.width, 1280.0);
        assert_eq!(saved_state.height, 720.0);
    }

    #[test]
    fn builds_window_state_path_below_config_directory() {
        let path = build_window_state_path(Path::new("/tmp/cloudeasyfiles-config"));

        assert_eq!(
            path,
            PathBuf::from("/tmp/cloudeasyfiles-config").join(WINDOW_STATE_FILE_NAME)
        );
    }

    #[test]
    fn converts_saved_and_physical_sizes_to_logical_dimensions() {
        let saved_state = SavedWindowState {
            width: 1600.0,
            height: 900.0,
        };
        let logical_size = logical_size_from_saved_state(&saved_state);
        assert_eq!(logical_size.width, 1600.0);
        assert_eq!(logical_size.height, 900.0);

        let resized = logical_size_from_physical(PhysicalSize::new(3200, 1800), 2.0);
        assert_eq!(resized.width, 1600.0);
        assert_eq!(resized.height, 900.0);

        let scaled = logical_size_from_physical(PhysicalSize::new(2250, 1500), 1.5);
        assert_eq!(scaled.width, 1500.0);
        assert_eq!(scaled.height, 1000.0);
    }

    #[test]
    fn exposes_window_state_log_messages() {
        assert_eq!(
            missing_main_window_restore_message(),
            "[window_state] main window not found while trying to restore saved size"
        );
        assert_eq!(
            restore_size_error_message(1280.0, 720.0, &"denied"),
            "[window_state] failed to restore main window size width=1280 height=720 error=denied"
        );
        assert_eq!(
            scale_factor_error_message("resize", &"unavailable"),
            "[window_state] failed to resolve scale factor for resize event error=unavailable"
        );
        assert_eq!(
            scale_factor_error_message("scale-factor change", &"unsupported"),
            "[window_state] failed to resolve scale factor for scale-factor change event error=unsupported"
        );
    }

    #[test]
    fn serializes_window_state_with_fractional_dimensions() {
        let serialized = serialize_window_state(&SavedWindowState {
            width: 1440.5,
            height: 900.25,
        })
        .expect("window state should serialize");

        assert!(serialized.contains("\"width\": 1440.5"));
        assert!(serialized.contains("\"height\": 900.25"));
    }

    #[test]
    fn load_window_state_from_path_returns_none_for_directory_paths() {
        let config_dir = unique_temp_config_dir();
        fs::create_dir_all(&config_dir).expect("config dir should exist");
        let state_path = build_window_state_path(&config_dir);
        fs::create_dir_all(&state_path).expect("state path directory should exist");

        assert!(load_window_state_from_path(&state_path).is_none());

        fs::remove_dir_all(&config_dir).ok();
    }

    #[test]
    fn save_window_state_to_path_overwrites_existing_file_contents() {
        let config_dir = unique_temp_config_dir();
        fs::create_dir_all(&config_dir).expect("config dir should exist");
        let state_path = build_window_state_path(&config_dir);
        fs::write(&state_path, r#"{"width":800,"height":600}"#)
            .expect("existing state should be written");

        save_window_state_to_path(
            &state_path,
            &SavedWindowState {
                width: 1920.0,
                height: 1080.0,
            },
        );

        let updated = load_window_state_from_path(&state_path).expect("updated state should load");
        assert_eq!(updated.width, 1920.0);
        assert_eq!(updated.height, 1080.0);

        fs::remove_dir_all(&config_dir).ok();
    }

    #[test]
    fn saves_window_state_to_disk_creating_parent_directory() {
        let config_dir = unique_temp_config_dir();
        let state_path = build_window_state_path(&config_dir);
        let saved_state = SavedWindowState {
            width: 1600.0,
            height: 900.0,
        };

        save_window_state_to_path(&state_path, &saved_state);

        let persisted_state =
            load_window_state_from_path(&state_path).expect("saved state should load");
        assert_eq!(persisted_state.width, saved_state.width);
        assert_eq!(persisted_state.height, saved_state.height);

        fs::remove_dir_all(&config_dir).ok();
    }

    #[test]
    fn loads_window_state_from_existing_file() {
        let config_dir = unique_temp_config_dir();
        fs::create_dir_all(&config_dir).expect("test config directory");
        let state_path = build_window_state_path(&config_dir);
        fs::write(&state_path, r#"{"width":1366,"height":768}"#).expect("window state file");

        let saved_state = load_window_state_from_path(&state_path).expect("saved state should load");

        assert_eq!(saved_state.width, 1366.0);
        assert_eq!(saved_state.height, 768.0);

        fs::remove_dir_all(&config_dir).ok();
    }

    #[test]
    fn returns_none_when_window_state_file_is_missing_or_invalid() {
        let config_dir = unique_temp_config_dir();
        let state_path = build_window_state_path(&config_dir);

        assert!(load_window_state_from_path(&state_path).is_none());

        fs::create_dir_all(&config_dir).expect("test config directory");
        fs::write(&state_path, "not json").expect("invalid window state file");

        assert!(load_window_state_from_path(&state_path).is_none());

        fs::remove_dir_all(&config_dir).ok();
    }

    #[test]
    fn save_window_state_to_path_returns_when_parent_directory_cannot_be_created() {
        let temp_root = unique_temp_config_dir();
        fs::create_dir_all(&temp_root).expect("temp root should exist");

        let blocking_file = temp_root.join("blocking-file");
        fs::write(&blocking_file, b"not-a-directory").expect("blocking file should exist");

        let state_path = blocking_file.join(WINDOW_STATE_FILE_NAME);
        save_window_state_to_path(
            &state_path,
            &SavedWindowState {
                width: 800.0,
                height: 600.0,
            },
        );

        assert!(!state_path.exists());

        fs::remove_dir_all(&temp_root).ok();
    }

    #[test]
    fn save_window_state_to_path_handles_write_errors_when_target_is_a_directory() {
        let config_dir = unique_temp_config_dir();
        let state_path = build_window_state_path(&config_dir);

        fs::create_dir_all(&state_path).expect("state path directory should exist");

        save_window_state_to_path(
            &state_path,
            &SavedWindowState {
                width: 1024.0,
                height: 768.0,
            },
        );

        assert!(state_path.is_dir());
        assert!(load_window_state_from_path(&state_path).is_none());

        fs::remove_dir_all(&config_dir).ok();
    }

    fn unique_temp_config_dir() -> PathBuf {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!(
            "cloudeasyfiles-window-state-test-{}-{unique_id}",
            std::process::id()
        ))
    }
}
