import { describe, expect, it, vi } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  loadLegacyGlobalCacheDirectoryCandidateFromStorage,
  resolveCachedFileIdentities
} from "./navigationCacheState";

describe("navigationCacheState", () => {
  it("returns an empty set when cache directory is missing or there are no file items", async () => {
    const findAwsCachedObjects = vi.fn();
    const findAzureCachedObjects = vi.fn();

    await expect(
      resolveCachedFileIdentities({
        provider: "aws",
        connectionId: "conn-1",
        connectionName: "Primary",
        bucketName: "bucket-a",
        globalLocalCacheDirectory: undefined,
        items: [],
        findAwsCachedObjects,
        findAzureCachedObjects
      })
    ).resolves.toEqual(new Set());

    const items: NavigationContentExplorerItem[] = [
      { id: "d1", kind: "directory", name: "docs", path: "docs/" }
    ];

    await expect(
      resolveCachedFileIdentities({
        provider: "azure",
        connectionId: "conn-1",
        connectionName: "Primary",
        bucketName: "bucket-a",
        globalLocalCacheDirectory: "/cache",
        items,
        findAwsCachedObjects,
        findAzureCachedObjects
      })
    ).resolves.toEqual(new Set());

    expect(findAwsCachedObjects).not.toHaveBeenCalled();
    expect(findAzureCachedObjects).not.toHaveBeenCalled();
  });

  it("resolves cached file identities with the provider-specific finder", async () => {
    const findAwsCachedObjects = vi.fn().mockResolvedValue(["docs/report.txt"]);
    const findAzureCachedObjects = vi.fn().mockResolvedValue(["docs/archive.zip"]);
    const items: NavigationContentExplorerItem[] = [
      { id: "d1", kind: "directory", name: "docs", path: "docs/" },
      { id: "f1", kind: "file", name: "report.txt", path: "docs/report.txt" }
    ];

    await expect(
      resolveCachedFileIdentities({
        provider: "aws",
        connectionId: "conn-1",
        connectionName: "Primary",
        bucketName: "bucket-a",
        globalLocalCacheDirectory: "/cache",
        items,
        findAwsCachedObjects,
        findAzureCachedObjects
      })
    ).resolves.toEqual(new Set(["conn-1:bucket-a:docs/report.txt"]));

    expect(findAwsCachedObjects).toHaveBeenCalledWith(
      "conn-1",
      "Primary",
      "bucket-a",
      "/cache",
      ["docs/report.txt"]
    );
    expect(findAzureCachedObjects).not.toHaveBeenCalled();
  });

  it("resolves cached file identities for Azure provider", async () => {
    const findAwsCachedObjects = vi.fn();
    const findAzureCachedObjects = vi.fn().mockResolvedValue(["docs/archive.zip"]);
    const items: NavigationContentExplorerItem[] = [
      { id: "f1", kind: "file", name: "archive.zip", path: "docs/archive.zip" }
    ];

    await expect(
      resolveCachedFileIdentities({
        provider: "azure",
        connectionId: "conn-2",
        connectionName: "Azure Primary",
        bucketName: "container-b",
        globalLocalCacheDirectory: "/cache",
        items,
        findAwsCachedObjects,
        findAzureCachedObjects
      })
    ).resolves.toEqual(new Set(["conn-2:container-b:docs/archive.zip"]));

    expect(findAzureCachedObjects).toHaveBeenCalledWith(
      "conn-2",
      "Azure Primary",
      "container-b",
      "/cache",
      ["docs/archive.zip"]
    );
    expect(findAwsCachedObjects).not.toHaveBeenCalled();
  });

  it("loads a legacy global cache directory candidate from stored metadata", () => {
    expect(loadLegacyGlobalCacheDirectoryCandidateFromStorage(null)).toBeUndefined();
    expect(loadLegacyGlobalCacheDirectoryCandidateFromStorage("invalid-json")).toBeUndefined();
    expect(
      loadLegacyGlobalCacheDirectoryCandidateFromStorage(
        JSON.stringify({
          a: { localCacheDirectory: "   " },
          b: { localCacheDirectory: "/legacy/cache" }
        })
      )
    ).toBe("/legacy/cache");
  });
});
