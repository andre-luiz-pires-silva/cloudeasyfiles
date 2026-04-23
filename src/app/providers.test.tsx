import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./providers";
import { useI18n } from "../lib/i18n/useI18n";

function LocaleProbe() {
  const { locale, t } = useI18n();

  return (
    <div>
      <span>{locale}</span>
      <span>{t("app.title")}</span>
    </div>
  );
}

describe("AppProviders", () => {
  it("wraps children with error and i18n providers", () => {
    render(
      <AppProviders>
        <LocaleProbe />
      </AppProviders>
    );

    expect(screen.getByText("en-US")).toBeInTheDocument();
    expect(screen.getByText("CloudEasyFiles")).toBeInTheDocument();
  });
});
