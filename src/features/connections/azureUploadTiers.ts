export const DEFAULT_AZURE_UPLOAD_TIER = "Hot" as const;

export const AZURE_UPLOAD_TIER_OPTIONS = ["Hot", "Cool", "Cold", "Archive"] as const;

export type AzureUploadTier = (typeof AZURE_UPLOAD_TIER_OPTIONS)[number];

export function normalizeAzureUploadTier(value: string | null | undefined): AzureUploadTier {
  const normalizedValue = value?.trim();

  if (
    normalizedValue &&
    AZURE_UPLOAD_TIER_OPTIONS.includes(normalizedValue as AzureUploadTier)
  ) {
    return normalizedValue as AzureUploadTier;
  }

  return DEFAULT_AZURE_UPLOAD_TIER;
}
