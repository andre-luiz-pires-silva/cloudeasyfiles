import { useEffect, useState } from "react";
import { getGreeting } from "../lib/tauri/commands";
import { useI18n } from "../lib/i18n/useI18n";

export function App() {
  const { locale, setLocale, t } = useI18n();
  const [greeting, setGreeting] = useState(() => t("greeting.loading"));

  useEffect(() => {
    let cancelled = false;

    setGreeting(t("greeting.loading"));

    void getGreeting(locale)
      .then((message) => {
        if (!cancelled) {
          setGreeting(message);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error(t("errors.greeting_load_failed"), error);
          setGreeting(t("greeting.fallback"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-toolbar">
          <div>
            <p className="eyebrow">{t("hero.eyebrow")}</p>
          </div>

          <div className="locale-control">
            <label htmlFor="locale-select">{t("settings.language")}</label>
            <select
              id="locale-select"
              aria-label={t("settings.language")}
              value={locale}
              onChange={(event) => {
                void setLocale(event.target.value);
              }}
            >
              <option value="en-US">English (US)</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
            </select>
          </div>
        </div>

        <h1>{greeting}</h1>

        <p className="subtitle">{t("hero.subtitle")}</p>

        <div className="status-grid">
          <article className="status-card">
            <span className="status-label">{t("status.frontend.label")}</span>
            <strong>{t("status.frontend.value")}</strong>
          </article>

          <article className="status-card">
            <span className="status-label">{t("status.backend.label")}</span>
            <strong>{t("status.backend.value")}</strong>
          </article>

          <article className="status-card">
            <span className="status-label">{t("status.architecture.label")}</span>
            <strong>{t("status.architecture.value")}</strong>
          </article>
        </div>
      </section>
    </main>
  );
}
