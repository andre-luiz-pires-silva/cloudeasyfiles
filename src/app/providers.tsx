import type { PropsWithChildren } from "react";
import { I18nProvider } from "../lib/i18n/I18nProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return <I18nProvider>{children}</I18nProvider>;
}
