import type { PropsWithChildren } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { I18nProvider } from "../lib/i18n/I18nProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <I18nProvider>{children}</I18nProvider>
    </ErrorBoundary>
  );
}
