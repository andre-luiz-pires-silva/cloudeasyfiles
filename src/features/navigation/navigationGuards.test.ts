import { describe, expect, it } from "vitest";

import {
  buildContentDeletePlan,
  buildFileIdentity,
  buildUploadObjectKey,
  canChangeTierItem,
  canDownloadAsItem,
  canDownloadItem,
  canRestoreItem,
  dedupeDirectoryPrefixes,
  getUploadParentPath,
  isFileIdentityInContext,
  normalizeDirectoryPrefix,
  validateNewFolderNameInput,
  type NavigationActionContext,
  type NavigationContentItem
} from "./navigationGuards";

function createContext(
  overrides: Partial<NavigationActionContext> = {}
): NavigationActionContext {
  return {
    provider: "aws",
    connectionId: "conn-1",
    bucketName: "bucket-a",
    hasValidLocalCacheDirectory: true,
    activeTransferIdentityMap: new Map(),
    ...overrides
  };
}

describe("navigationGuards", () => {
  it("normalizes directory prefixes and upload parents", () => {
    expect(normalizeDirectoryPrefix("/docs/reports/")).toBe("docs/reports/");
    expect(normalizeDirectoryPrefix("")).toBe("");
    expect(getUploadParentPath("docs/report.txt")).toBe("docs/");
    expect(getUploadParentPath("report.txt")).toBe("");
  });

  it("deduplicates nested directory prefixes", () => {
    expect(dedupeDirectoryPrefixes(["docs/", "docs/reports/", "logs/", "docs/", ""])).toEqual([
      "docs/",
      "logs/"
    ]);
  });

  it("builds delete plans without duplicating covered files", () => {
    const items: NavigationContentItem[] = [
      { id: "d1", kind: "directory", path: "docs" },
      { id: "f1", kind: "file", path: "docs/report.txt" },
      { id: "f2", kind: "file", path: "logs/app.log" },
      { id: "f3", kind: "file", path: "logs/app.log" }
    ];

    expect(buildContentDeletePlan(items)).toEqual({
      directoryPrefixes: ["docs/"],
      fileKeys: ["logs/app.log"]
    });
  });

  it("builds upload keys and validates folder names", () => {
    expect(buildUploadObjectKey("/docs/reports/", "file.txt")).toBe("docs/reports/file.txt");
    expect(buildUploadObjectKey("", "file.txt")).toBe("file.txt");
    expect(validateNewFolderNameInput("  ", (key) => key)).toBe("content.folder.name_required");
    expect(validateNewFolderNameInput("bad/name", (key) => key)).toBe("content.folder.name_invalid");
    expect(validateNewFolderNameInput("good-name", (key) => key)).toBeNull();
  });

  it("applies restore, tier, download and download-as guardrails", () => {
    const archivedFile: NavigationContentItem = {
      id: "f1",
      kind: "file",
      path: "docs/archive.zip",
      availabilityStatus: "archived",
      downloadState: "not_downloaded"
    };
    const availableFile: NavigationContentItem = {
      id: "f2",
      kind: "file",
      path: "docs/report.txt",
      availabilityStatus: "available",
      downloadState: "available_to_download"
    };

    expect(canRestoreItem(archivedFile, "aws")).toBe(true);
    expect(canRestoreItem(availableFile, "aws")).toBe(false);
    expect(canChangeTierItem(availableFile, "azure")).toBe(true);
    expect(canChangeTierItem(archivedFile, "azure")).toBe(false);
    expect(canDownloadItem(availableFile, createContext())).toBe(true);
    expect(canDownloadItem({ ...availableFile, downloadState: "downloaded" }, createContext())).toBe(
      false
    );
    expect(
      canDownloadItem(
        availableFile,
        createContext({
          activeTransferIdentityMap: new Map([
            [
              buildFileIdentity("conn-1", "bucket-a", "docs/report.txt"),
              {
                fileIdentity: buildFileIdentity("conn-1", "bucket-a", "docs/report.txt"),
                transferKind: "cache"
              }
            ]
          ])
        })
      )
    ).toBe(false);
    expect(canDownloadAsItem(availableFile, createContext(), [])).toBe(true);
    expect(canDownloadAsItem(availableFile, createContext(), ["f2"])).toBe(false);
  });

  it("resolves file identity presence inside a context", () => {
    const items: NavigationContentItem[] = [
      { id: "f1", kind: "file", path: "docs/report.txt" },
      { id: "d1", kind: "directory", path: "docs" }
    ];

    expect(
      isFileIdentityInContext(
        buildFileIdentity("conn-1", "bucket-a", "docs/report.txt"),
        "conn-1",
        "bucket-a",
        items
      )
    ).toBe(true);
    expect(
      isFileIdentityInContext(
        buildFileIdentity("conn-1", "bucket-a", "docs/missing.txt"),
        "conn-1",
        "bucket-a",
        items
      )
    ).toBe(false);
  });
});
