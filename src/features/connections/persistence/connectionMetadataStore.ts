import type { SavedConnectionSummary } from "../models";

const STORAGE_KEY = "cloudeasyfiles.connection-metadata";

function isSavedConnectionSummary(value: unknown): value is SavedConnectionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    (candidate.provider === "aws" || candidate.provider === "azure") &&
    typeof candidate.region === "string" &&
    (typeof candidate.localCacheDirectory === "string" ||
      typeof candidate.localCacheDirectory === "undefined")
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
