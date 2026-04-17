import { describe, expect, it } from "vitest";

import { buildFileIdentity } from "./navigationGuards";
import {
  buildBatchDownloadPlan,
  applyDownloadedFileState,
  reconcileDownloadedFilePathsForContext,
  resolveDownloadState,
  type NavigationDownloadableItem
} from "./navigationDownloads";

describe("navigationDownloads", () => {
  it("builds a batch download plan only when batch download is enabled", () => {
    const items: NavigationDownloadableItem[] = [
      { id: "d1", kind: "directory", path: "docs" },
      {
        id: "f1",
        kind: "file",
        path: "docs/report.txt",
        availabilityStatus: "available",
        downloadState: "available_to_download"
      }
    ];

    expect(buildBatchDownloadPlan({ items, canBatchDownload: false })).toEqual([]);
    expect(buildBatchDownloadPlan({ items, canBatchDownload: true })).toEqual([items[1]!]);
  });

  it("resolves download state from availability and cache context", () => {
    const availableFile: NavigationDownloadableItem = {
      id: "f1",
      kind: "file",
      path: "docs/report.txt",
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    };
    const archivedFile: NavigationDownloadableItem = {
      id: "f2",
      kind: "file",
      path: "docs/archive.zip",
      availabilityStatus: "archived",
      downloadState: "available_to_download"
    };
    const restoringFile: NavigationDownloadableItem = {
      id: "f3",
      kind: "file",
      path: "docs/restore.zip",
      availabilityStatus: "restoring",
      downloadState: "not_downloaded"
    };
    const directory: NavigationDownloadableItem = {
      id: "d1",
      kind: "directory",
      path: "docs",
      downloadState: undefined
    };

    expect(resolveDownloadState(availableFile, new Set(), "conn-1", "bucket-a", true)).toBe(
      "available_to_download"
    );
    expect(resolveDownloadState(availableFile, new Set(), "conn-1", "bucket-a", false)).toBe(
      "not_downloaded"
    );
    expect(resolveDownloadState(archivedFile, new Set(), "conn-1", "bucket-a", true)).toBe(
      "not_downloaded"
    );
    expect(resolveDownloadState(restoringFile, new Set(), "conn-1", "bucket-a", true)).toBe(
      "restoring"
    );
    expect(
      resolveDownloadState(
        availableFile,
        new Set([buildFileIdentity("conn-1", "bucket-a", "docs/report.txt")]),
        "conn-1",
        "bucket-a",
        true
      )
    ).toBe("downloaded");
    expect(resolveDownloadState(directory, new Set(), "conn-1", "bucket-a", true)).toBeUndefined();
  });

  it("applies downloaded file state only when an item actually changes", () => {
    const items: NavigationDownloadableItem[] = [
      {
        id: "f1",
        kind: "file",
        path: "docs/report.txt",
        availabilityStatus: "available",
        downloadState: "not_downloaded"
      },
      {
        id: "d1",
        kind: "directory",
        path: "docs"
      }
    ];

    const unchanged = applyDownloadedFileState(items, new Set(), "conn-1", "bucket-a", false);
    expect(unchanged).toBe(items);

    const changed = applyDownloadedFileState(
      items,
      new Set([buildFileIdentity("conn-1", "bucket-a", "docs/report.txt")]),
      "conn-1",
      "bucket-a",
      true
    );
    expect(changed).not.toBe(items);
    expect(changed[0]?.downloadState).toBe("downloaded");
    expect(changed[1]).toBe(items[1]);
  });

  it("reconciles downloaded file paths only inside the active context", () => {
    const items: NavigationDownloadableItem[] = [
      { id: "f1", kind: "file", path: "docs/report.txt" },
      { id: "f2", kind: "file", path: "docs/archive.zip" }
    ];
    const currentPaths = [
      buildFileIdentity("conn-1", "bucket-a", "docs/report.txt"),
      buildFileIdentity("conn-2", "bucket-b", "other/file.txt")
    ];
    const cachedPaths = new Set([
      buildFileIdentity("conn-1", "bucket-a", "docs/archive.zip"),
      buildFileIdentity("conn-1", "bucket-a", "docs/archive.zip")
    ]);

    const reconciled = reconcileDownloadedFilePathsForContext(
      currentPaths,
      cachedPaths,
      "conn-1",
      "bucket-a",
      items
    );

    expect(reconciled).toEqual([
      buildFileIdentity("conn-2", "bucket-b", "other/file.txt"),
      buildFileIdentity("conn-1", "bucket-a", "docs/archive.zip")
    ]);

    const unchanged = reconcileDownloadedFilePathsForContext(
      reconciled,
      new Set([buildFileIdentity("conn-1", "bucket-a", "docs/archive.zip")]),
      "conn-1",
      "bucket-a",
      [{ id: "f2", kind: "file", path: "docs/archive.zip" }]
    );
    expect(unchanged).toBe(reconciled);
  });
});
