use crate::domain::greeting::Greeting;

pub struct GreetingService;

impl GreetingService {
    pub fn build_startup_greeting() -> Greeting {
        Greeting::new("Hello, CloudEasyFiles!")
    }
}
