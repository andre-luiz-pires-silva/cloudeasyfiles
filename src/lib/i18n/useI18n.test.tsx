import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { useI18n } from "./useI18n";

function Consumer() {
  const { t } = useI18n();

  return <span>{t("app.title")}</span>;
}

function MissingProviderConsumer() {
  useI18n();

  return null;
}

describe("useI18n", () => {
  it("returns the current context when used inside I18nProvider", () => {
    render(
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    );

    expect(screen.getByText("CloudEasyFiles")).toBeInTheDocument();
  });

  it("throws when used outside I18nProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<MissingProviderConsumer />)).toThrow(
      "useI18n must be used within I18nProvider"
    );

    consoleError.mockRestore();
  });
});
