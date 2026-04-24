import type { AzureAuthenticationMethod, SavedConnectionSummary } from "../models";

export function createConnectionId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sortConnections(connections: SavedConnectionSummary[]) {
  return [...connections].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true
    })
  );
}

export function normalizeConnectionName(value: string): string {
  return value.trim();
}

export function normalizeConnectionNameForComparison(value: string): string {
  return normalizeConnectionName(value).toLocaleLowerCase();
}

export function normalizeRestrictedBucketName(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function normalizeStorageAccountName(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeAzureAuthenticationMethod(
  value: string | null | undefined
): AzureAuthenticationMethod {
  return value === "entra_id" ? "entra_id" : "shared_key";
}
