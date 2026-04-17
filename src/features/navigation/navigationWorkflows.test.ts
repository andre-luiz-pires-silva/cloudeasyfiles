import { describe, expect, it } from "vitest";

import {
  buildChangeStorageClassRequestState,
  buildRestoreRequestState,
  getBatchChangeTierTooltip,
  type NavigationWorkflowItem
} from "./navigationWorkflows";

function formatBytes(size: number | undefined) {
  return `${size ?? 0} bytes`;
}

describe("navigationWorkflows", () => {
  it("builds a single-file restore request and normalizes placeholder regions", () => {
    const result = buildRestoreRequestState({
      items: [
        {
          kind: "file",
          name: "archive.zip",
          path: "docs/archive.zip",
          size: 12,
          storageClass: "GLACIER"
        }
      ],
      provider: "aws",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "...",
      bucketRegionPlaceholder: "...",
      formatBytes,
      getMixedStorageClassesLabel: () => "mixed"
    });

    expect(result).toEqual({
      provider: "aws",
      request: {
        provider: "aws",
        fileName: "archive.zip",
        fileSizeLabel: "12 bytes",
        storageClass: "GLACIER"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: null,
      targets: [{ objectKey: "docs/archive.zip", storageClass: "GLACIER" }]
    });
  });

  it("builds a batch restore request using only file items", () => {
    const items: NavigationWorkflowItem[] = [
      { kind: "directory", name: "docs", path: "docs" },
      {
        kind: "file",
        name: "archive-a.zip",
        path: "docs/archive-a.zip",
        size: 10,
        storageClass: "Archive"
      },
      {
        kind: "file",
        name: "archive-b.zip",
        path: "docs/archive-b.zip",
        size: 15,
        storageClass: "Cool"
      }
    ];

    const result = buildRestoreRequestState({
      items,
      provider: "azure",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "brazilsouth",
      bucketRegionPlaceholder: "...",
      formatBytes,
      getMixedStorageClassesLabel: () => "mixed classes"
    });

    expect(result).toEqual({
      provider: "azure",
      request: {
        provider: "azure",
        fileCount: 2,
        totalSizeLabel: "25 bytes",
        storageClasses: ["Archive", "Cool"],
        storageClassLabel: "mixed classes"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "brazilsouth",
      targets: [
        { objectKey: "docs/archive-a.zip", storageClass: "Archive" },
        { objectKey: "docs/archive-b.zip", storageClass: "Cool" }
      ]
    });
  });

  it("returns null restore requests without bucket context or files", () => {
    expect(
      buildRestoreRequestState({
        items: [{ kind: "directory", name: "docs", path: "docs" }],
        provider: "aws",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        bucketRegion: null,
        bucketRegionPlaceholder: "...",
        formatBytes,
        getMixedStorageClassesLabel: () => "mixed"
      })
    ).toBeNull();

    expect(
      buildRestoreRequestState({
        items: [{ kind: "file", name: "archive.zip", path: "archive.zip" }],
        provider: null,
        connectionId: "conn-1",
        bucketName: "bucket-a",
        bucketRegion: null,
        bucketRegionPlaceholder: "...",
        formatBytes,
        getMixedStorageClassesLabel: () => "mixed"
      })
    ).toBeNull();
  });

  it("builds change-tier state and preserves a single current class", () => {
    const result = buildChangeStorageClassRequestState({
      items: [
        {
          kind: "file",
          name: "report-a.csv",
          path: "reports/report-a.csv",
          size: 5,
          storageClass: "STANDARD"
        },
        {
          kind: "file",
          name: "report-b.csv",
          path: "reports/report-b.csv",
          size: 7,
          storageClass: "STANDARD"
        }
      ],
      provider: "aws",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "us-east-1",
      bucketRegionPlaceholder: "...",
      formatBytes,
      getMultipleCurrentClassesLabel: () => "mixed"
    });

    expect(result).toEqual({
      provider: "aws",
      request: {
        fileCount: 2,
        totalSizeLabel: "12 bytes",
        currentStorageClassLabel: "STANDARD"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "us-east-1",
      targets: [
        { objectKey: "reports/report-a.csv", currentStorageClass: "STANDARD" },
        { objectKey: "reports/report-b.csv", currentStorageClass: "STANDARD" }
      ],
      currentStorageClass: "STANDARD"
    });
  });

  it("builds change-tier state with mixed classes and ignores directories", () => {
    const result = buildChangeStorageClassRequestState({
      items: [
        { kind: "directory", name: "reports", path: "reports" },
        {
          kind: "file",
          name: "archive-a.zip",
          path: "archive-a.zip",
          size: 9,
          storageClass: "Archive"
        },
        {
          kind: "file",
          name: "archive-b.zip",
          path: "archive-b.zip",
          size: 1,
          storageClass: "Cool"
        }
      ],
      provider: "azure",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: "...",
      bucketRegionPlaceholder: "...",
      formatBytes,
      getMultipleCurrentClassesLabel: () => "multiple classes"
    });

    expect(result).toEqual({
      provider: "azure",
      request: {
        fileCount: 2,
        totalSizeLabel: "10 bytes",
        currentStorageClassLabel: "multiple classes"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: null,
      targets: [
        { objectKey: "archive-a.zip", currentStorageClass: "Archive" },
        { objectKey: "archive-b.zip", currentStorageClass: "Cool" }
      ],
      currentStorageClass: null
    });
  });

  it("explains archived and incompatible batch change-tier selections", () => {
    expect(
      getBatchChangeTierTooltip({
        items: [
          {
            kind: "file",
            name: "archive.zip",
            path: "archive.zip",
            availabilityStatus: "archived"
          }
        ],
        provider: "aws",
        isContentSelectionActive: true,
        canBatchChangeTier: false,
        t: (key) => key
      })
    ).toBe("content.storage_class_change.tooltip_archived_requires_restore");

    expect(
      getBatchChangeTierTooltip({
        items: [{ kind: "file", name: "report.csv", path: "report.csv" }],
        provider: "azure",
        isContentSelectionActive: true,
        canBatchChangeTier: false,
        t: (key) => key
      })
    ).toBe("content.azure_storage_class_change.tooltip_selection_incompatible");

    expect(
      getBatchChangeTierTooltip({
        items: [{ kind: "file", name: "report.csv", path: "report.csv" }],
        provider: "aws",
        isContentSelectionActive: false,
        canBatchChangeTier: true,
        t: (key) => key
      })
    ).toBe("navigation.menu.change_tier");
  });

  it("returns the azure rehydration tooltip for archived azure items", () => {
    expect(
      getBatchChangeTierTooltip({
        items: [
          {
            kind: "file",
            name: "archive.zip",
            path: "archive.zip",
            availabilityStatus: "archived"
          }
        ],
        provider: "azure",
        isContentSelectionActive: false,
        canBatchChangeTier: false,
        t: (key) => key
      })
    ).toBe("content.azure_storage_class_change.tooltip_archived_requires_rehydration");
  });

  it("returns null change-tier state without bucket context or files", () => {
    expect(
      buildChangeStorageClassRequestState({
        items: [{ kind: "file", name: "report.csv", path: "report.csv" }],
        provider: null,
        connectionId: "conn-1",
        bucketName: "bucket-a",
        bucketRegion: null,
        bucketRegionPlaceholder: "...",
        formatBytes,
        getMultipleCurrentClassesLabel: () => "mixed"
      })
    ).toBeNull();

    expect(
      buildChangeStorageClassRequestState({
        items: [{ kind: "directory", name: "docs", path: "docs" }],
        provider: "aws",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        bucketRegion: null,
        bucketRegionPlaceholder: "...",
        formatBytes,
        getMultipleCurrentClassesLabel: () => "mixed"
      })
    ).toBeNull();
  });

  it("builds a batch restore request with a single common storage class label", () => {
    const result = buildRestoreRequestState({
      items: [
        { kind: "file", name: "a.zip", path: "a.zip", size: 5, storageClass: "GLACIER" },
        { kind: "file", name: "b.zip", path: "b.zip", size: 5, storageClass: "GLACIER" }
      ],
      provider: "aws",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      bucketRegion: null,
      bucketRegionPlaceholder: "...",
      formatBytes,
      getMixedStorageClassesLabel: () => "mixed"
    });

    expect(result).not.toBeNull();
    if (result && "storageClassLabel" in result.request) {
      expect(result.request.storageClassLabel).toBe("GLACIER");
    }
  });

  it("returns null restore state when items array is empty", () => {
    expect(
      buildRestoreRequestState({
        items: [],
        provider: "aws",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        bucketRegion: null,
        bucketRegionPlaceholder: "...",
        formatBytes,
        getMixedStorageClassesLabel: () => "mixed"
      })
    ).toBeNull();
  });
});
