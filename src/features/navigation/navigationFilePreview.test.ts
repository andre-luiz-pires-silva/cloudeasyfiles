import { describe, expect, it } from "vitest";
import {
  FILE_PREVIEW_MAX_BYTES,
  buildFilePreviewDataUrl,
  getFilePreviewExtension,
  getFilePreviewSupport,
  type NavigationFilePreviewPayload
} from "./navigationFilePreview";
import type { NavigationContentExplorerItem } from "./navigationContent";

function fileItem(overrides: Partial<NavigationContentExplorerItem> = {}): NavigationContentExplorerItem {
  return {
    id: "file:reports/a.txt",
    kind: "file",
    name: "a.txt",
    path: "reports/a.txt",
    size: 128,
    availabilityStatus: "available",
    downloadState: "not_downloaded",
    ...overrides
  };
}

describe("navigationFilePreview", () => {
  it("detects file extensions conservatively", () => {
    expect(getFilePreviewExtension("report.TXT")).toBe("txt");
    expect(getFilePreviewExtension(".env")).toBeNull();
    expect(getFilePreviewExtension("archive")).toBeNull();
  });

  it("supports text and image files", () => {
    expect(getFilePreviewSupport(fileItem({ name: "notes.md" }))).toEqual({
      status: "supported",
      kind: "text",
      mimeType: "text/markdown"
    });
    expect(getFilePreviewSupport(fileItem({ name: "photo.jpeg" }))).toEqual({
      status: "supported",
      kind: "image",
      mimeType: "image/jpeg"
    });
  });

  it("rejects unavailable, oversized, and unsupported files before provider reads", () => {
    expect(getFilePreviewSupport(fileItem({ availabilityStatus: "archived" }))).toEqual({
      status: "archived"
    });
    expect(getFilePreviewSupport(fileItem({ size: FILE_PREVIEW_MAX_BYTES + 1 }))).toEqual({
      status: "too_large"
    });
    expect(getFilePreviewSupport(fileItem({ name: "report.pdf" }))).toEqual({
      status: "unsupported"
    });
  });

  it("builds data URLs only for image payloads", () => {
    const imagePayload: NavigationFilePreviewPayload = {
      kind: "image",
      base64: "abc",
      mimeType: "image/png"
    };

    expect(buildFilePreviewDataUrl(imagePayload)).toBe("data:image/png;base64,abc");
    expect(
      buildFilePreviewDataUrl({ kind: "text", content: "hello", mimeType: "text/plain" })
    ).toBeNull();
  });
});
