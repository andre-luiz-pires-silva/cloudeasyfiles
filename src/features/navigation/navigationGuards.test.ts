import { describe, expect, it } from "vitest";

import {
  buildContentDeletePlan,
  buildPendingDeleteState,
  buildFileIdentity,
  buildUploadObjectKey,
  canChangeTierItem,
  canDownloadAsItem,
  canDownloadItem,
  canRestoreItem,
  dedupeDirectoryPrefixes,
  getBatchSelectionActions,
  getStartupAutoConnectConnections,
  getUploadParentPath,
  getFileActionKind,
  getRefreshPlan,
  isFileIdentityInContext,
  normalizeDirectoryPrefix,
  shouldRefreshAfterUploadCompletion,
  toggleSelectedItemId,
  toggleVisibleSelection,
  validateNewFolderNameInput,
  type NavigationActionContext,
  type NavigationContentItem
} from "./navigationGuards";
import type { SavedConnectionSummary } from "../connections/models";

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
    expect(buildPendingDeleteState(items)).toEqual({
      items,
      fileCount: 3,
      directoryCount: 1,
      plan: {
        directoryPrefixes: ["docs/"],
        fileKeys: ["logs/app.log"]
      }
    });
    expect(buildPendingDeleteState([])).toBeNull();
  });

  it("toggles individual and visible content selection deterministically", () => {
    expect(toggleSelectedItemId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleSelectedItemId(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleVisibleSelection(["a"], [])).toEqual(["a"]);
    expect(toggleVisibleSelection(["a"], ["a", "b"])).toEqual(["a", "b"]);
    expect(toggleVisibleSelection(["a", "b", "c"], ["a", "b"])).toEqual(["c"]);
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

  it("selects only startup-enabled connections", () => {
    const connections: SavedConnectionSummary[] = [
      { id: "aws-1", name: "AWS Main", provider: "aws", connectOnStartup: true },
      {
        id: "azure-1",
        name: "Azure Main",
        provider: "azure",
        storageAccountName: "mystorage",
        authenticationMethod: "shared_key"
      }
    ];

    expect(getStartupAutoConnectConnections(connections).map((connection) => connection.id)).toEqual([
      "aws-1"
    ]);
  });

  it("refreshes only when a completed upload affects the currently open context", () => {
    expect(
      shouldRefreshAfterUploadCompletion({
        uploadConnectionId: "conn-1",
        uploadBucketName: "bucket-a",
        uploadObjectKey: "docs/report.txt",
        selectedBucketConnectionId: "conn-1",
        selectedBucketName: "bucket-a",
        selectedBucketPath: "docs"
      })
    ).toBe(true);

    expect(
      shouldRefreshAfterUploadCompletion({
        uploadConnectionId: "conn-2",
        uploadBucketName: "bucket-a",
        uploadObjectKey: "docs/report.txt",
        selectedBucketConnectionId: "conn-1",
        selectedBucketName: "bucket-a",
        selectedBucketPath: "docs"
      })
    ).toBe(false);

    expect(
      shouldRefreshAfterUploadCompletion({
        uploadConnectionId: "conn-1",
        uploadBucketName: "bucket-a",
        uploadObjectKey: "other/report.txt",
        selectedBucketConnectionId: "conn-1",
        selectedBucketName: "bucket-a",
        selectedBucketPath: "docs"
      })
    ).toBe(false);
  });

  it("builds refresh plans without turning refresh into a mutating action", () => {
    expect(
      getRefreshPlan({
        hasSelectedNode: false,
        isLoadingContent: false,
        isLoadingMoreContent: false
      })
    ).toBe("noop");

    expect(
      getRefreshPlan({
        hasSelectedNode: true,
        selectedNodeKind: "connection",
        connectionStatus: "connected",
        isLoadingContent: false,
        isLoadingMoreContent: false
      })
    ).toBe("reconnect-connection");

    expect(
      getRefreshPlan({
        hasSelectedNode: true,
        selectedNodeKind: "connection",
        connectionStatus: "error",
        isLoadingContent: false,
        isLoadingMoreContent: false
      })
    ).toBe("noop");

    expect(
      getRefreshPlan({
        hasSelectedNode: true,
        selectedNodeKind: "bucket",
        isLoadingContent: true,
        isLoadingMoreContent: false
      })
    ).toBe("noop");

    expect(
      getRefreshPlan({
        hasSelectedNode: true,
        selectedNodeKind: "bucket",
        isLoadingContent: false,
        isLoadingMoreContent: false
      })
    ).toBe("reload-bucket");
  });

  it("classifies file actions by operational kind", () => {
    expect(getFileActionKind("download")).toBe("provider-read");
    expect(getFileActionKind("downloadAs")).toBe("provider-read");
    expect(getFileActionKind("restore")).toBe("provider-mutation");
    expect(getFileActionKind("changeTier")).toBe("provider-mutation");
    expect(getFileActionKind("delete")).toBe("provider-mutation");
    expect(getFileActionKind("openFile")).toBe("local-read");
    expect(getFileActionKind("openInExplorer")).toBe("local-read");
    expect(getFileActionKind("cancelDownload")).toBe("transfer-control");
  });

  it("computes batch selection actions without mixing incompatible operations", () => {
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

    const archivedSelection = getBatchSelectionActions([archivedFile], createContext(), "aws");
    expect(archivedSelection.restorableItems).toEqual([archivedFile]);
    expect(archivedSelection.canBatchRestore).toBe(true);
    expect(archivedSelection.canBatchDownload).toBe(false);
    expect(archivedSelection.canBatchChangeTier).toBe(false);
    expect(archivedSelection.canBatchDelete).toBe(true);

    const availableSelection = getBatchSelectionActions([availableFile], createContext(), "azure");
    expect(availableSelection.downloadableItems).toEqual([availableFile]);
    expect(availableSelection.changeTierableItems).toEqual([availableFile]);
    expect(availableSelection.canBatchDownload).toBe(true);
    expect(availableSelection.canBatchChangeTier).toBe(true);
    expect(availableSelection.canBatchRestore).toBe(false);
    expect(availableSelection.canBatchDelete).toBe(true);

    const mixedSelection = getBatchSelectionActions(
      [archivedFile, availableFile],
      createContext(),
      "aws"
    );
    expect(mixedSelection.canBatchDownload).toBe(false);
    expect(mixedSelection.canBatchRestore).toBe(false);
    expect(mixedSelection.canBatchChangeTier).toBe(false);
    expect(mixedSelection.canBatchDelete).toBe(true);

    const disconnectedSelection = getBatchSelectionActions(
      [availableFile],
      createContext({ provider: null }),
      null
    );
    expect(disconnectedSelection.canBatchDelete).toBe(false);
    expect(disconnectedSelection.deletableItems).toEqual([]);
  });
});
