import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildContentCounts,
  buildContentStatusSummaryItems,
  countLoadedItemsByStatus,
  filterConnectionBuckets,
  filterContentItems,
  isContentFilterActive,
  isContentStatusFilterInactive
} from "./navigationDerivedState";

describe("navigationDerivedState", () => {
  it("filters connection buckets by normalized content filter", () => {
    expect(
      filterConnectionBuckets(
        [
          { name: "Reports", region: "us-east-1", bucketName: "reports" },
          { name: "Archive", region: "brazilsouth", bucketName: "archive" }
        ],
        "south"
      )
    ).toEqual([{ name: "Archive", region: "brazilsouth", bucketName: "archive" }]);

    expect(
      filterConnectionBuckets([{ name: "Reports", region: "us-east-1", bucketName: "reports" }], "")
    ).toEqual([{ name: "Reports", region: "us-east-1", bucketName: "reports" }]);
  });

  it("filters content items by text and status selection", () => {
    const items: NavigationContentExplorerItem[] = [
      { id: "d1", kind: "directory", name: "docs", path: "docs/" },
      {
        id: "f1",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        storageClass: "STANDARD",
        availabilityStatus: "available",
        downloadState: "downloaded"
      },
      {
        id: "f2",
        kind: "file",
        name: "archive.zip",
        path: "docs/archive.zip",
        storageClass: "GLACIER",
        availabilityStatus: "archived",
        downloadState: "not_downloaded"
      }
    ];

    expect(
      filterContentItems({
        items,
        normalizedFilter: "archive",
        contentStatusFilters: [],
        allContentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"]
      })
    ).toEqual([items[2]!]);

    expect(
      filterContentItems({
        items,
        normalizedFilter: "docs",
        contentStatusFilters: ["downloaded"],
        allContentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"]
      })
    ).toEqual([items[1]!]);
  });

  it("counts loaded file items by normalized status", () => {
    const items: NavigationContentExplorerItem[] = [
      {
        id: "f1",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        availabilityStatus: "available",
        downloadState: "downloaded"
      },
      {
        id: "f2",
        kind: "file",
        name: "archive.zip",
        path: "docs/archive.zip",
        storageClass: "GLACIER",
        restoreExpiryDate: "2026-04-15T00:00:00Z",
        availabilityStatus: "available",
        downloadState: "not_downloaded"
      },
      {
        id: "f3",
        kind: "file",
        name: "rehydrating.zip",
        path: "docs/rehydrating.zip",
        availabilityStatus: "restoring",
        downloadState: "restoring"
      }
    ];

    expect(countLoadedItemsByStatus(items, "downloaded")).toBe(1);
    expect(countLoadedItemsByStatus(items, "available")).toBe(1);
    expect(countLoadedItemsByStatus(items, "archived")).toBe(1);
    expect(countLoadedItemsByStatus(items, "restoring")).toBe(1);
  });

  it("builds content status summary items only for bucket selections", () => {
    const t = (key: string) => key;

    expect(
      buildContentStatusSummaryItems({
        isBucketSelected: false,
        loadedDirectoryCount: 1,
        loadedDownloadedCount: 2,
        loadedAvailableCount: 3,
        loadedRestoringCount: 4,
        loadedArchivedCount: 5,
        t
      })
    ).toEqual([]);

    expect(
      buildContentStatusSummaryItems({
        isBucketSelected: true,
        loadedDirectoryCount: 1,
        loadedDownloadedCount: 2,
        loadedAvailableCount: 3,
        loadedRestoringCount: 4,
        loadedArchivedCount: 5,
        t
      })
    ).toEqual([
      { key: "directory", label: "content.filter.status.directory", count: 1 },
      { key: "downloaded", label: "content.download_state.downloaded", count: 2 },
      { key: "available", label: "content.availability.available", count: 3 },
      { key: "restoring", label: "content.availability.restoring", count: 4 },
      { key: "archived", label: "content.availability.archived", count: 5 }
    ]);
  });

  it("derives content filter activity and loaded/displayed counts", () => {
    expect(
      isContentStatusFilterInactive({
        contentStatusFilters: [],
        allContentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"]
      })
    ).toBe(true);

    expect(
      isContentStatusFilterInactive({
        contentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"],
        allContentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"]
      })
    ).toBe(true);

    expect(
      isContentFilterActive({
        normalizedContentFilter: "",
        isStatusFilterInactive: true
      })
    ).toBe(false);

    expect(
      isContentFilterActive({
        normalizedContentFilter: "docs",
        isStatusFilterInactive: true
      })
    ).toBe(true);

    expect(
      buildContentCounts({
        selectedNodeKind: "connection",
        connectionBucketCount: 3,
        contentItemCount: 10,
        filteredConnectionBucketCount: 2,
        filteredContentItemCount: 4
      })
    ).toEqual({
      loadedContentCount: 3,
      displayedContentCount: 2
    });

    expect(
      buildContentCounts({
        selectedNodeKind: "bucket",
        connectionBucketCount: 3,
        contentItemCount: 10,
        filteredConnectionBucketCount: 2,
        filteredContentItemCount: 4
      })
    ).toEqual({
      loadedContentCount: 10,
      displayedContentCount: 4
    });
  });
});
