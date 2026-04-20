import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildConnectionFailureMessage,
  buildAvailableUntilTooltip,
  buildBreadcrumbs,
  buildContentCounterLabel,
  extractErrorMessage,
  filterTreeNodes,
  formatBytes,
  formatDateTime,
  getConnectionActions,
  getContentStatusLabel,
  getDisplayContentStatus,
  getFileStatusBadgeDescriptors,
  getFileNameFromPath,
  getPathTitle,
  getPreferredFileStatusBadgeDescriptors,
  getSummaryContentStatuses,
  isCancelledTransferError,
  isTemporaryRestoredArchivalFile,
  isUploadExistsPreflightPermissionError,
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

  it("extracts error messages and cancellation state", () => {
    expect(extractErrorMessage("plain failure")).toBe("plain failure");
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
    expect(extractErrorMessage({ message: "denied" })).toBe("denied");
    expect(extractErrorMessage({})).toBeNull();
    expect(isCancelledTransferError("DOWNLOAD_CANCELLED")).toBe(true);
    expect(isCancelledTransferError(new Error("other"))).toBe(false);
  });

  it("formats bytes and date values for display", () => {
    expect(formatBytes(undefined, "en-US")).toBe("-");
    expect(formatBytes(512, "en-US")).toBe("512 B");
    expect(formatBytes(1536, "en-US")).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024, "en-US")).toBe("1 MB");
    expect(formatDateTime(null, "en-US")).toBe("-");
    expect(formatDateTime("invalid-date", "en-US")).toBe("invalid-date");
    expect(formatDateTime("2026-04-15T13:45:00Z", "en-US")).toContain("2026");
  });

  it("builds connection failure messages and available actions", () => {
    const t = (key: string) => key;

    expect(
      buildConnectionFailureMessage("AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED", t)
    ).toBe("navigation.modal.aws.test_connection_missing_minimum_permission");
    expect(
      buildConnectionFailureMessage("AWS_S3_RESTRICTED_BUCKET_MISMATCH", t)
    ).toBe("navigation.modal.aws.test_connection_restricted_bucket_mismatch");
    expect(buildConnectionFailureMessage("generic", t)).toBe("generic");
    expect(buildConnectionFailureMessage({}, t)).toBe(
      "navigation.modal.aws.test_connection_failure"
    );

    expect(getConnectionActions(t, { status: "connecting" })).toEqual([
      { id: "cancelConnect", label: "navigation.menu.cancel_connect" },
      { id: "edit", label: "navigation.menu.edit_settings" },
      {
        id: "remove",
        label: "navigation.menu.remove",
        variant: "danger"
      }
    ]);
    expect(getConnectionActions(t, { status: "connected" })[0]).toEqual({
      id: "disconnect",
      label: "navigation.menu.disconnect"
    });
    expect(getConnectionActions(t, { status: "error" })[0]).toEqual({
      id: "connect",
      label: "navigation.menu.connect"
    });
  });

  it("derives file names and upload permission preflight errors", () => {
    expect(getFileNameFromPath("reports/2026/file.txt")).toBe("file.txt");
    expect(getFileNameFromPath("C:\\temp\\file.txt")).toBe("file.txt");
    expect(getFileNameFromPath("file.txt")).toBe("file.txt");

    expect(
      isUploadExistsPreflightPermissionError(new Error("AccessDenied: failed to probe"))
    ).toBe(true);
    expect(
      isUploadExistsPreflightPermissionError("forbidden while checking upload destination")
    ).toBe(true);
    expect(isUploadExistsPreflightPermissionError(new Error("network timeout"))).toBe(false);
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

  it("returns empty badge array for non-file items", () => {
    const t = (key: string) => key;
    const directory: NavigationContentExplorerItem = {
      id: "d1",
      kind: "directory",
      name: "docs",
      path: "docs/"
    };
    expect(getFileStatusBadgeDescriptors(directory, "en-US", t)).toEqual([]);
    expect(getPreferredFileStatusBadgeDescriptors(directory, "en-US", t)).toEqual([]);
  });

  it("computes summary and display statuses for restoring, available, and archived files", () => {
    const restoring: NavigationContentExplorerItem = {
      id: "f1",
      kind: "file",
      name: "file.txt",
      path: "file.txt",
      availabilityStatus: "restoring",
      downloadState: "not_downloaded"
    };
    const available: NavigationContentExplorerItem = {
      id: "f2",
      kind: "file",
      name: "file.txt",
      path: "file.txt",
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    };
    const archived: NavigationContentExplorerItem = {
      id: "f3",
      kind: "file",
      name: "file.txt",
      path: "file.txt",
      availabilityStatus: "archived",
      downloadState: "not_downloaded"
    };

    expect(getSummaryContentStatuses(restoring)).toEqual(["restoring"]);
    expect(getSummaryContentStatuses(available)).toEqual(["available"]);
    expect(getSummaryContentStatuses(archived)).toEqual(["archived"]);
    expect(getSummaryContentStatuses({ id: "f4", kind: "file", name: "f", path: "f" })).toEqual([]);

    expect(getDisplayContentStatus(available)).toBe("available");
    expect(getDisplayContentStatus(restoring)).toBe("restoring");
    expect(getDisplayContentStatus(archived)).toBe("archived");
    expect(getDisplayContentStatus({ id: "f5", kind: "file", name: "f", path: "f" })).toBeNull();
  });

  it("returns null label for null status and correct labels for all status types", () => {
    const t = (key: string) => key;
    expect(getContentStatusLabel(null, t)).toBeNull();
    expect(getContentStatusLabel("downloaded", t)).toBe("content.download_state.downloaded");
    expect(getContentStatusLabel("restoring", t)).toBe("content.availability.restoring");
    expect(getContentStatusLabel("available", t)).toBe("content.availability.available");
  });

  it("formats bytes in TB range and handles non-finite values", () => {
    expect(formatBytes(Infinity, "en-US")).toBe("-");
    expect(formatBytes(NaN, "en-US")).toBe("-");
    const tb = 1024 * 1024 * 1024 * 1024;
    expect(formatBytes(tb, "en-US")).toContain("TB");
  });

  it("returns all nodes for empty filter and returns true for empty normalizedFilter in matchesFilter", () => {
    expect(matchesFilter(["anything"], "")).toBe(true);
    const nodes: NavigationTreeNode[] = [
      { id: "c1", kind: "connection", connectionId: "1", provider: "aws", name: "AWS" }
    ];
    expect(filterTreeNodes(nodes, "")).toEqual(nodes);
  });
});
