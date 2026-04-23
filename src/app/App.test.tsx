import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const navigatorProps = vi.fn();
const setLocale = vi.fn();

vi.mock("../lib/i18n/useI18n", () => ({
  useI18n: () => ({
    locale: "pt-BR",
    setLocale
  })
}));

vi.mock("../features/navigation/ConnectionNavigator", () => ({
  ConnectionNavigator: (props: { locale: string; onLocaleChange: (locale: string) => Promise<void> }) => {
    navigatorProps(props);
    return <div data-testid="connection-navigator" />;
  }
}));

describe("App", () => {
  it("renders the app shell and passes locale controls to the navigator", () => {
    render(<App />);

    expect(screen.getByTestId("connection-navigator")).toBeInTheDocument();
    expect(navigatorProps).toHaveBeenCalledWith({
      locale: "pt-BR",
      onLocaleChange: setLocale
    });
  });
});
