const STORAGE_KEY = "cloudeasyfiles.locale";
const DEFAULT_LOCALE = "en-US";
const SUPPORTED_LOCALES = ["en-US", "pt-BR"];
const localePaths = {
  "en-US": "./locales/en-US.json",
  "pt-BR": "./locales/pt-BR.json"
};

let currentLocale = DEFAULT_LOCALE;
let messages = {};

function normalizeLocale(locale) {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  if (SUPPORTED_LOCALES.includes(locale)) {
    return locale;
  }

  if (locale.toLowerCase().startsWith("pt")) {
    return "pt-BR";
  }

  return DEFAULT_LOCALE;
}

export function detectInitialLocale() {
  const storedLocale = window.localStorage.getItem(STORAGE_KEY);

  if (storedLocale) {
    return normalizeLocale(storedLocale);
  }

  return normalizeLocale(navigator.language);
}

export function getLocale() {
  return currentLocale;
}

export function t(key) {
  const localeMessages = messages[currentLocale] ?? {};
  const fallbackMessages = messages[DEFAULT_LOCALE] ?? {};
  return localeMessages[key] ?? fallbackMessages[key] ?? key;
}

export function applyTranslations(root = document) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    const key = element.dataset.i18n;

    if (element.tagName === "TITLE") {
      document.title = t(key);
      continue;
    }

    element.textContent = t(key);
  }
}

export function setLocale(locale) {
  currentLocale = normalizeLocale(locale);
  window.localStorage.setItem(STORAGE_KEY, currentLocale);
  document.documentElement.lang = currentLocale;
  applyTranslations();
}

async function loadCatalog(locale) {
  if (messages[locale]) {
    return messages[locale];
  }

  const response = await fetch(localePaths[locale]);

  if (!response.ok) {
    throw new Error(`Failed to load locale catalog: ${locale}`);
  }

  const catalog = await response.json();
  messages = { ...messages, [locale]: catalog };
  return catalog;
}

export async function initI18n() {
  currentLocale = detectInitialLocale();
  await loadCatalog(DEFAULT_LOCALE);

  if (currentLocale !== DEFAULT_LOCALE) {
    await loadCatalog(currentLocale);
  }

  document.documentElement.lang = currentLocale;
  applyTranslations();
  return currentLocale;
}

export async function changeLocale(locale) {
  currentLocale = normalizeLocale(locale);
  await loadCatalog(currentLocale);
  window.localStorage.setItem(STORAGE_KEY, currentLocale);
  document.documentElement.lang = currentLocale;
  applyTranslations();
}
