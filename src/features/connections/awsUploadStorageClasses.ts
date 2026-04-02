export const DEFAULT_AWS_UPLOAD_STORAGE_CLASS = "STANDARD" as const;

export const AWS_UPLOAD_STORAGE_CLASS_OPTIONS = [
  "STANDARD",
  "STANDARD_IA",
  "ONEZONE_IA",
  "INTELLIGENT_TIERING",
  "GLACIER_IR",
  "GLACIER",
  "DEEP_ARCHIVE"
] as const;

export type AwsUploadStorageClass = (typeof AWS_UPLOAD_STORAGE_CLASS_OPTIONS)[number];

export function normalizeAwsUploadStorageClass(
  value: string | null | undefined
): AwsUploadStorageClass {
  const normalizedValue = value?.trim().toUpperCase();

  if (
    normalizedValue &&
    AWS_UPLOAD_STORAGE_CLASS_OPTIONS.includes(normalizedValue as AwsUploadStorageClass)
  ) {
    return normalizedValue as AwsUploadStorageClass;
  }

  return DEFAULT_AWS_UPLOAD_STORAGE_CLASS;
}
