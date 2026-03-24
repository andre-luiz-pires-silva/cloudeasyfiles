import { changeLocale, getLocale, initI18n, t } from "./i18n.js";

const greetingElement = document.querySelector("#greeting");
const localeSelect = document.querySelector("#locale-select");
let greetingRequestId = 0;

async function loadGreeting() {
  const tauriCore = window.__TAURI__?.core;
  const requestId = ++greetingRequestId;
  const locale = getLocale();

  if (!tauriCore?.invoke) {
    if (requestId === greetingRequestId) {
      greetingElement.textContent = t("greeting.fallback");
    }
    return;
  }

  try {
    const message = await tauriCore.invoke("get_greeting", {
      locale
    });

    if (requestId !== greetingRequestId || locale !== getLocale()) {
      return;
    }

    greetingElement.textContent = message;
  } catch (error) {
    if (requestId !== greetingRequestId || locale !== getLocale()) {
      return;
    }

    console.error(t("errors.greeting_load_failed"), error);
    greetingElement.textContent = t("greeting.fallback");
  }
}

function bindLocaleSelector() {
  if (!localeSelect) {
    return;
  }

  localeSelect.value = getLocale();
  localeSelect.addEventListener("change", async (event) => {
    greetingElement.textContent = t("greeting.loading");
    await changeLocale(event.target.value);
    void loadGreeting();
  });
}

async function bootstrap() {
  await initI18n();
  greetingElement.textContent = t("greeting.loading");
  bindLocaleSelector();
  void loadGreeting();
}

void bootstrap();
