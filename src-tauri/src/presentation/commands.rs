use crate::application::services::greeting_service::GreetingService;

#[tauri::command]
pub async fn get_greeting(locale: Option<String>) -> String {
    let locale = locale.unwrap_or_else(|| "en-US".to_string());

    GreetingService::build_startup_greeting(&locale)
        .message()
        .to_string()
}
