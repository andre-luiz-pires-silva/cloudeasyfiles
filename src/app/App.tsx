import { ConnectionNavigator } from "../features/navigation/ConnectionNavigator";
import { useI18n } from "../lib/i18n/useI18n";

export function App() {
  const { locale, setLocale, t } = useI18n();

  return (
    <main className="app-shell">
      <section className="app-frame">
        <ConnectionNavigator locale={locale} onLocaleChange={setLocale} />
      </section>
    </main>
  );
}
