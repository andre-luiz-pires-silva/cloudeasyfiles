use crate::application::services::greeting_service::GreetingService;

#[tauri::command]
pub async fn get_greeting() -> String {
    GreetingService::build_startup_greeting()
        .message()
        .to_string()
}
