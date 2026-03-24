const greetingElement = document.querySelector("#greeting");

async function loadGreeting() {
  const tauriCore = window.__TAURI__?.core;

  if (!tauriCore?.invoke) {
    greetingElement.textContent = "Hello, CloudEasyFiles!";
    return;
  }

  try {
    const message = await tauriCore.invoke("get_greeting");
    greetingElement.textContent = message;
  } catch (error) {
    console.error("Failed to load greeting from Rust:", error);
    greetingElement.textContent = "Hello, CloudEasyFiles!";
  }
}

loadGreeting();
