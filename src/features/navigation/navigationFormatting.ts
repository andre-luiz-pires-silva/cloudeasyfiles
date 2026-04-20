import type { Locale } from "../../lib/i18n/I18nProvider";

export function normalizeFilterText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function getFileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

export function formatBytes(size: number | undefined, locale: Locale): string {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return "-";
  }

  if (size < 1024) {
    return `${new Intl.NumberFormat(locale).format(size)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

export function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
