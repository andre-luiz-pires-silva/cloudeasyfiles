import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenChild(): JSX.Element {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders children while no error has been captured", () => {
    render(
      <ErrorBoundary>
        <p>Loaded</p>
      </ErrorBoundary>
    );

    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });

  it("renders the fallback after a child render error", () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );

    expect(
      screen.getByText("The interface failed to render. Reload the window to retry.")
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });
});
