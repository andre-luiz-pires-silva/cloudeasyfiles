import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilePreviewPanel, type FilePreviewPanelProps } from "./FilePreviewPanel";
import type { NavigationContentExplorerItem } from "../navigationContent";

const fileItem: NavigationContentExplorerItem = {
  id: "file:reports/a.txt",
  kind: "file",
  name: "a.txt",
  path: "reports/a.txt",
  size: 128,
  availabilityStatus: "available",
  downloadState: "not_downloaded"
};

function renderPanel(overrides: Partial<FilePreviewPanelProps> = {}) {
  const props: FilePreviewPanelProps = {
    item: fileItem,
    support: { status: "supported", kind: "text", mimeType: "text/plain" },
    payload: null,
    isLoading: false,
    error: null,
    locale: "en-US",
    t: (key) => key,
    onRetry: vi.fn(),
    ...overrides
  };

  render(<FilePreviewPanel {...props} />);

  return props;
}

describe("FilePreviewPanel", () => {
  it("renders text preview payloads", () => {
    renderPanel({
      payload: { kind: "text", content: "hello\nworld", mimeType: "text/plain" }
    });

    expect(screen.getByText("hello world", { exact: false })).toBeInTheDocument();
  });

  it("renders image preview payloads", () => {
    renderPanel({
      payload: { kind: "image", base64: "abc", mimeType: "image/png" }
    });

    expect(screen.getByRole("img", { name: "content.preview.image_alt" })).toHaveAttribute(
      "src",
      "data:image/png;base64,abc"
    );
    expect(screen.getByRole("img", { name: "content.preview.image_alt" })).toHaveAttribute(
      "draggable",
      "false"
    );
    expect(screen.getByRole("button", { name: "content.preview.zoom_in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "content.preview.zoom_out" })).toBeInTheDocument();
  });

  it("formats JSON preview payloads", () => {
    renderPanel({
      payload: { kind: "text", content: "{\"a\":1}", mimeType: "application/json" }
    });

    fireEvent.click(screen.getByRole("button", { name: "content.preview.format" }));

    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });

  it("shows unsupported and too-large states", () => {
    renderPanel({ support: { status: "unsupported" } });

    expect(screen.getByText("content.preview.unsupported")).toBeInTheDocument();
  });

  it("shows retry for errors", () => {
    const props = renderPanel({ error: "Provider failed" });

    fireEvent.click(screen.getByRole("button", { name: "content.preview.retry" }));

    expect(screen.getByText("Provider failed")).toBeInTheDocument();
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
