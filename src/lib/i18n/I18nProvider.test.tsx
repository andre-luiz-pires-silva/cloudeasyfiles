import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { useI18n } from "./useI18n";

function I18nProbe() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{t("app.title")}</span>
      <span data-testid="fallback">{t("missing.translation.key")}</span>
      <button type="button" onClick={() => void setLocale("pt")}>
        set pt
      </button>
      <button type="button" onClick={() => void setLocale("fr-FR")}>
        set fallback
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    document.title = "";
  });

  it("uses the default locale and writes document metadata", () => {
    render(
      <I18nProvider>
        <I18nProbe />
      </I18nProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("title")).toHaveTextContent("CloudEasyFiles");
    expect(screen.getByTestId("fallback")).toHaveTextContent("missing.translation.key");
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.title).toBe("CloudEasyFiles");
    expect(window.localStorage.getItem("cloudeasyfiles.locale")).toBe("en-US");
  });

  it("normalizes stored and requested locales", async () => {
    window.localStorage.setItem("cloudeasyfiles.locale", "pt-BR");

    render(
      <I18nProvider>
        <I18nProbe />
      </I18nProvider>
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("pt-BR");

    await act(async () => {
      screen.getByRole("button", { name: "set fallback" }).click();
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");

    await act(async () => {
      screen.getByRole("button", { name: "set pt" }).click();
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("pt-BR");
    expect(window.localStorage.getItem("cloudeasyfiles.locale")).toBe("pt-BR");
  });
});
