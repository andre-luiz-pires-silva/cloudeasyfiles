import { describe, expect, it } from "vitest";

import {
  buildContentItems,
  buildPreviewFileState,
  isArchivedStorageClass,
  mergeContentItems,
  type NavigationContentExplorerItem
} from "./navigationContent";
import type { CloudContainerItemsResult } from "./providerReadAdapters";

describe("navigationContent", () => {
  it("detects archived storage classes across providers", () => {
    expect(isArchivedStorageClass("GLACIER")).toBe(true);
    expect(isArchivedStorageClass("Archive")).toBe(true);
    expect(isArchivedStorageClass("Deep_Archive")).toBe(true);
    expect(isArchivedStorageClass("STANDARD")).toBe(false);
    expect(isArchivedStorageClass(null)).toBe(false);
  });

  it("builds preview file states from archive and restore metadata", () => {
    expect(buildPreviewFileState("GLACIER")).toEqual({
      availabilityStatus: "archived",
      downloadState: "not_downloaded"
    });
    expect(buildPreviewFileState("Archive", true, null)).toEqual({
      availabilityStatus: "restoring",
      downloadState: "restoring"
    });
    expect(buildPreviewFileState("Archive", false, "2026-04-15T00:00:00Z")).toEqual({
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    });
    expect(buildPreviewFileState("STANDARD")).toEqual({
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    });
  });

  it("builds content items with stable sorting and preview state", () => {
    const result: CloudContainerItemsResult = {
      provider: "aws",
      region: "us-east-1",
      directories: [
        { name: "zeta", path: "zeta/" },
        { name: "alpha", path: "alpha/" }
      ],
      files: [
        {
          path: "docs/report.txt",
          size: 10,
          storageClass: "STANDARD",
          lastModified: "2026-04-15T00:00:00Z"
        },
        {
          path: "docs/archive.zip",
          size: 20,
          storageClass: "GLACIER"
        }
      ],
      hasMore: false,
      continuationToken: null
    };

    expect(buildContentItems(result)).toEqual([
      {
        id: "directory:alpha/",
        kind: "directory",
        name: "alpha",
        path: "alpha/"
      },
      {
        id: "directory:zeta/",
        kind: "directory",
        name: "zeta",
        path: "zeta/"
      },
      {
        id: "file:docs/archive.zip",
        kind: "file",
        name: "archive.zip",
        path: "docs/archive.zip",
        size: 20,
        lastModified: undefined,
        storageClass: "GLACIER",
        restoreExpiryDate: undefined,
        availabilityStatus: "archived",
        downloadState: "not_downloaded"
      },
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        size: 10,
        lastModified: "2026-04-15T00:00:00Z",
        storageClass: "STANDARD",
        restoreExpiryDate: undefined,
        availabilityStatus: "available",
        downloadState: "not_downloaded"
      }
    ]);
  });

  it("merges content items by id and preserves sorted output", () => {
    const currentItems: NavigationContentExplorerItem[] = [
      { id: "directory:zeta/", kind: "directory", name: "zeta", path: "zeta/" },
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        size: 10,
        availabilityStatus: "available",
        downloadState: "not_downloaded"
      }
    ];
    const nextItems: NavigationContentExplorerItem[] = [
      { id: "directory:alpha/", kind: "directory", name: "alpha", path: "alpha/" },
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        size: 11,
        availabilityStatus: "available",
        downloadState: "downloaded"
      }
    ];

    expect(mergeContentItems(currentItems, nextItems)).toEqual([
      { id: "directory:alpha/", kind: "directory", name: "alpha", path: "alpha/" },
      { id: "directory:zeta/", kind: "directory", name: "zeta", path: "zeta/" },
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        size: 11,
        availabilityStatus: "available",
        downloadState: "downloaded"
      }
    ]);
  });
});
