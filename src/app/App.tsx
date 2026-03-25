import { ConnectionNavigator } from "../features/navigation/ConnectionNavigator";
import { useI18n } from "../lib/i18n/useI18n";

export function App() {
  const { locale, setLocale, t } = useI18n();

  return (
    <main className="app-shell">
      <section className="app-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("hero.eyebrow")}</p>
            <h1 className="app-title">{t("app.title")}</h1>
            <p className="subtitle">{t("hero.subtitle")}</p>
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
        </header>

        <ConnectionNavigator />
      </section>
    </main>
  );
}
