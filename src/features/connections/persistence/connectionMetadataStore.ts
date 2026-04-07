import type { SavedConnectionSummary } from "../models";
import { normalizeAwsUploadStorageClass } from "../awsUploadStorageClasses";

const STORAGE_KEY = "cloudeasyfiles.connection-metadata";

function isSavedConnectionSummary(value: unknown): value is SavedConnectionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  const hasBaseShape =
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.provider === "aws" || candidate.provider === "azure") &&
    (typeof candidate.connectOnStartup === "undefined" ||
      typeof candidate.connectOnStartup === "boolean");

  if (!hasBaseShape) {
    return false;
  }

  if (candidate.provider === "azure") {
    return true;
  }

  return (
    (typeof candidate.restrictedBucketName === "undefined" ||
      typeof candidate.restrictedBucketName === "string") &&
    (typeof candidate.defaultUploadStorageClass === "undefined" ||
      (typeof candidate.defaultUploadStorageClass === "string" &&
        normalizeAwsUploadStorageClass(candidate.defaultUploadStorageClass) ===
          candidate.defaultUploadStorageClass.trim().toUpperCase()))
  );
}

export class ConnectionMetadataStore {
  load(): SavedConnectionSummary[] {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(rawValue);

      if (!Array.isArray(parsedValue)) {
        return [];
      }

      return parsedValue.filter(isSavedConnectionSummary);
    } catch {
      return [];
    }
  }

  save(connections: SavedConnectionSummary[]) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  }
}
