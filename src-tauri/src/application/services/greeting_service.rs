use crate::domain::greeting::Greeting;

pub struct GreetingService;

impl GreetingService {
    pub fn build_startup_greeting(locale: &str) -> Greeting {
        let message = if locale.to_lowercase().starts_with("pt") {
            "Olá, CloudEasyFiles!"
        } else {
            "Hello, CloudEasyFiles!"
        };

        Greeting::new(message)
    }
}
