import { normalizeConnectionName, normalizeStorageAccountName } from "./connectionNormalization";

export const MAX_CONNECTION_NAME_LENGTH = 20;
const SIMPLE_CONNECTION_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;
const SIMPLE_BUCKET_NAME_PATTERN = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const SIMPLE_STORAGE_ACCOUNT_NAME_PATTERN = /^(?=.{3,24}$)[a-z0-9]+$/;

export function isConnectionNameFormatValid(value: string): boolean {
  const normalizedValue = normalizeConnectionName(value);

  return (
    normalizedValue.length > 0 &&
    normalizedValue.length <= MAX_CONNECTION_NAME_LENGTH &&
    SIMPLE_CONNECTION_NAME_PATTERN.test(normalizedValue)
  );
}

export function isRestrictedBucketNameFormatValid(value: string): boolean {
  const normalizedValue = value.trim();

  return SIMPLE_BUCKET_NAME_PATTERN.test(normalizedValue) && !normalizedValue.includes("..");
}

export function isStorageAccountNameFormatValid(value: string): boolean {
  return SIMPLE_STORAGE_ACCOUNT_NAME_PATTERN.test(normalizeStorageAccountName(value));
}
