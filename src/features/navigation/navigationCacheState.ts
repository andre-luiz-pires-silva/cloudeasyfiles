import type { ConnectionProvider } from "../connections/models";
import type { NavigationContentExplorerItem } from "./navigationContent";
import { buildFileIdentity } from "./navigationGuards";
import { parseLegacyGlobalCacheDirectoryCandidate } from "./navigationPreferences";

export async function resolveCachedFileIdentities(params: {
  provider: ConnectionProvider;
  connectionId: string;
  connectionName: string;
  bucketName: string;
  globalLocalCacheDirectory: string | undefined;
  items: NavigationContentExplorerItem[];
  findAwsCachedObjects: (
    connectionId: string,
    connectionName: string,
    bucketName: string,
    globalLocalCacheDirectory: string,
    objectKeys: string[]
  ) => Promise<string[]>;
  findAzureCachedObjects: (
    connectionId: string,
    connectionName: string,
    bucketName: string,
    globalLocalCacheDirectory: string,
    objectKeys: string[]
  ) => Promise<string[]>;
}): Promise<Set<string>> {
  if (!params.globalLocalCacheDirectory) {
    return new Set();
  }

  const objectKeys = params.items.filter((item) => item.kind === "file").map((item) => item.path);

  if (objectKeys.length === 0) {
    return new Set();
  }

  const cachedObjectKeys =
    params.provider === "aws"
      ? await params.findAwsCachedObjects(
          params.connectionId,
          params.connectionName,
          params.bucketName,
          params.globalLocalCacheDirectory,
          objectKeys
        )
      : await params.findAzureCachedObjects(
          params.connectionId,
          params.connectionName,
          params.bucketName,
          params.globalLocalCacheDirectory,
          objectKeys
        );

  return new Set(
    cachedObjectKeys.map((objectKey) =>
      buildFileIdentity(params.connectionId, params.bucketName, objectKey)
    )
  );
}

export function loadLegacyGlobalCacheDirectoryCandidateFromStorage(
  rawValue: string | null | undefined
): string | undefined {
  return parseLegacyGlobalCacheDirectoryCandidate(rawValue);
}
