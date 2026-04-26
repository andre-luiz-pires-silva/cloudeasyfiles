import { describe, expect, it } from "vitest";

import {
  navigationPreferenceBounds,
  parseLegacyGlobalCacheDirectoryCandidate,
  resolveInitialContentListingPageSize,
  resolveInitialContentViewMode,
  resolveInitialGlobalCacheDirectory,
  resolveInitialPreviewPanelWidth,
  resolveInitialSidebarWidth
} from "./navigationPreferences";

describe("navigationPreferences", () => {
  it("parses legacy cache directory candidates defensively", () => {
    expect(parseLegacyGlobalCacheDirectoryCandidate(null)).toBeUndefined();
    expect(parseLegacyGlobalCacheDirectoryCandidate("not-json")).toBeUndefined();
    expect(parseLegacyGlobalCacheDirectoryCandidate("{\"a\":{}}")).toBeUndefined();
    expect(
      parseLegacyGlobalCacheDirectoryCandidate(
        JSON.stringify({
          first: { localCacheDirectory: "   " },
          second: { localCacheDirectory: " /tmp/cache " }
        })
      )
    ).toBe("/tmp/cache");
  });

  it("prefers app settings cache directory over legacy storage", () => {
    expect(
      resolveInitialGlobalCacheDirectory({
        settingsDirectory: " /var/cache/app ",
        legacyDirectoryCandidate: "/tmp/cache"
      })
    ).toBe("/var/cache/app");
    expect(
      resolveInitialGlobalCacheDirectory({
        settingsDirectory: " ",
        legacyDirectoryCandidate: " /tmp/cache "
      })
    ).toBe("/tmp/cache");
    expect(
      resolveInitialGlobalCacheDirectory({
        settingsDirectory: undefined,
        legacyDirectoryCandidate: undefined
      })
    ).toBe("");
  });

  it("normalizes listing page size and content view mode", () => {
    expect(resolveInitialContentListingPageSize(undefined)).toBe(
      navigationPreferenceBounds.defaultContentListingPageSize
    );
    expect(resolveInitialContentListingPageSize(1)).toBe(
      navigationPreferenceBounds.minContentListingPageSize
    );
    expect(resolveInitialContentListingPageSize(99999)).toBe(
      navigationPreferenceBounds.maxContentListingPageSize
    );
    expect(resolveInitialContentViewMode("compact")).toBe("compact");
    expect(resolveInitialContentViewMode("grid")).toBe("list");
    expect(resolveInitialContentViewMode(null)).toBe("list");
  });

  it("clamps and validates sidebar width", () => {
    expect(resolveInitialSidebarWidth(null, 360, 300, 520)).toBe(360);
    expect(resolveInitialSidebarWidth("invalid", 360, 300, 520)).toBe(360);
    expect(resolveInitialSidebarWidth("280", 360, 300, 520)).toBe(300);
    expect(resolveInitialSidebarWidth("999", 360, 300, 520)).toBe(520);
    expect(resolveInitialSidebarWidth("400", 360, 300, 520)).toBe(400);
  });

  it("clamps and validates preview panel width", () => {
    expect(resolveInitialPreviewPanelWidth(null, 380, 280, 760)).toBe(380);
    expect(resolveInitialPreviewPanelWidth("invalid", 380, 280, 760)).toBe(380);
    expect(resolveInitialPreviewPanelWidth("240", 380, 280, 760)).toBe(280);
    expect(resolveInitialPreviewPanelWidth("999", 380, 280, 760)).toBe(760);
    expect(resolveInitialPreviewPanelWidth("440", 380, 280, 760)).toBe(440);
  });
});
