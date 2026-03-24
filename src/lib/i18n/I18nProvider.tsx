import { createContext, useEffect, useState, type PropsWithChildren } from "react";
import enUS from "../../locales/en-US.json";
import ptBR from "../../locales/pt-BR.json";

export type Locale = "en-US" | "pt-BR";

type Messages = Record<string, string>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: string) => Promise<void>;
  t: (key: string) => string;
};

const STORAGE_KEY = "cloudeasyfiles.locale";
const DEFAULT_LOCALE: Locale = "en-US";
const catalogs: Record<Locale, Messages> = {
  "en-US": enUS,
  "pt-BR": ptBR
};

export const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLocale(locale: string | null | undefined): Locale {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  if (locale === "en-US" || locale === "pt-BR") {
    return locale;
  }

  if (locale.toLowerCase().startsWith("pt")) {
    return "pt-BR";
  }

  return DEFAULT_LOCALE;
}

function detectInitialLocale(): Locale {
  const storedLocale = window.localStorage.getItem(STORAGE_KEY);

  if (storedLocale) {
    return normalizeLocale(storedLocale);
  }

  return normalizeLocale(window.navigator.language);
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setCurrentLocale] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, "app.title");
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  async function setLocale(nextLocale: string) {
    setCurrentLocale(normalizeLocale(nextLocale));
  }

  function t(key: string) {
    return translate(locale, key);
  }

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

function translate(locale: Locale, key: string): string {
  const localeMessages = catalogs[locale] ?? {};
  const fallbackMessages = catalogs[DEFAULT_LOCALE] ?? {};

  return localeMessages[key] ?? fallbackMessages[key] ?? key;
}
