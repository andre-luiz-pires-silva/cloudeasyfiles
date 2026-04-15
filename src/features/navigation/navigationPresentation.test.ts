import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildAvailableUntilTooltip,
  buildBreadcrumbs,
  buildContentCounterLabel,
  filterTreeNodes,
  getContentStatusLabel,
  getDisplayContentStatus,
  getFileStatusBadgeDescriptors,
  getPathTitle,
  getPreferredFileStatusBadgeDescriptors,
  getSummaryContentStatuses,
  isTemporaryRestoredArchivalFile,
  matchesFilter,
  normalizeFilterText,
  type NavigationTreeNode
} from "./navigationPresentation";

describe("navigationPresentation", () => {
  it("normalizes and matches tree filters", () => {
    expect(normalizeFilterText("  Reports ")).toBe("reports");
    expect(matchesFilter(["Reports", "aws"], "reports")).toBe(true);
    expect(matchesFilter(["Reports", "aws"], "azure")).toBe(false);
  });

  it("filters tree nodes while preserving matching descendants", () => {
    const nodes: NavigationTreeNode[] = [
      {
        id: "conn:1",
        kind: "connection",
        connectionId: "1",
        provider: "aws",
        name: "AWS Main",
        children: [
          {
            id: "bucket:1",
            kind: "bucket",
            connectionId: "1",
            provider: "aws",
            name: "Reports",
            bucketName: "reports",
            path: "docs/"
          }
        ]
      },
      {
        id: "conn:2",
        kind: "connection",
        connectionId: "2",
        provider: "azure",
        name: "Azure Main"
      }
    ];

    expect(filterTreeNodes(nodes, "reports")).toEqual([
      {
        id: "conn:1",
        kind: "connection",
        connectionId: "1",
        provider: "aws",
        name: "AWS Main",
        children: [
          {
            id: "bucket:1",
            kind: "bucket",
            connectionId: "1",
            provider: "aws",
            name: "Reports",
            bucketName: "reports",
            path: "docs/",
            children: undefined
          }
        ]
      }
    ]);
  });

  it("builds breadcrumbs and path titles", () => {
    expect(getPathTitle("docs/reports/", "fallback")).toBe("reports");
    expect(getPathTitle("", "fallback")).toBe("fallback");
    expect(buildBreadcrumbs("AWS Main", "reports", "docs/2026/")).toEqual([
      { label: "AWS Main", path: null },
      { label: "reports", path: "" },
      { label: "docs", path: "docs/" },
      { label: "2026", path: "docs/2026/" }
    ]);
  });

  it("builds content counter labels", () => {
    const t = (key: string) => key;
    expect(buildContentCounterLabel(t, true, 2, 10)).toBe("content.list.count_filtered".replace("{filtered}", "2").replace("{loaded}", "10"));
    expect(buildContentCounterLabel(t, false, 2, 10)).toBe("content.list.count_loaded".replace("{loaded}", "10"));
  });

  it("computes summary and display statuses for files and directories", () => {
    const directory: NavigationContentExplorerItem = {
      id: "d1",
      kind: "directory",
      name: "docs",
      path: "docs/"
    };
    const downloaded: NavigationContentExplorerItem = {
      id: "f1",
      kind: "file",
      name: "report.txt",
      path: "docs/report.txt",
      availabilityStatus: "available",
      downloadState: "downloaded"
    };
    const restoredArchive: NavigationContentExplorerItem = {
      id: "f2",
      kind: "file",
      name: "archive.zip",
      path: "docs/archive.zip",
      availabilityStatus: "available",
      downloadState: "not_downloaded",
      restoreExpiryDate: "2026-04-15T00:00:00Z",
      storageClass: "GLACIER"
    };

    expect(getSummaryContentStatuses(directory)).toEqual(["directory"]);
    expect(getSummaryContentStatuses(downloaded)).toEqual(["downloaded"]);
    expect(getSummaryContentStatuses(restoredArchive)).toEqual(["available", "archived"]);
    expect(getDisplayContentStatus(downloaded)).toBe("downloaded");
    expect(getDisplayContentStatus(directory)).toBeNull();
    expect(getContentStatusLabel("archived", (key) => key)).toBe("content.availability.archived");
    expect(isTemporaryRestoredArchivalFile(restoredArchive)).toBe(true);
  });

  it("builds file badge descriptors for regular and temporarily restored archival files", () => {
    const t = (key: string) => key;
    const regularFile: NavigationContentExplorerItem = {
      id: "f1",
      kind: "file",
      name: "report.txt",
      path: "docs/report.txt",
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    };
    const restoredArchive: NavigationContentExplorerItem = {
      id: "f2",
      kind: "file",
      name: "archive.zip",
      path: "docs/archive.zip",
      availabilityStatus: "available",
      downloadState: "not_downloaded",
      restoreExpiryDate: "2026-04-15T00:00:00Z",
      storageClass: "Archive"
    };

    expect(getFileStatusBadgeDescriptors(regularFile, "en-US", t)).toEqual([
      {
        status: "available",
        label: "content.availability.available",
        title: "content.availability.available"
      }
    ]);

    const restoredBadges = getFileStatusBadgeDescriptors(restoredArchive, "en-US", t);
    expect(restoredBadges).toHaveLength(2);
    expect(restoredBadges[0]?.status).toBe("available");
    expect(restoredBadges[0]?.title).toContain("content.availability.available_until".replace("{date}", ""));
    expect(getPreferredFileStatusBadgeDescriptors(restoredArchive, "en-US", t)).toEqual([
      restoredBadges[0]
    ]);
    expect(buildAvailableUntilTooltip("invalid-date", "en-US", t)).toBe(
      "content.availability.available_until".replace("{date}", "invalid-date")
    );
  });
});
