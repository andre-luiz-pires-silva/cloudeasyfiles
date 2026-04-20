import type { Locale } from "../../lib/i18n/I18nProvider";
import { isArchivedStorageClass, type NavigationContentExplorerItem } from "./navigationContent";
import { formatDateTime } from "./navigationFormatting";

export type NavigationContentStatusFilter =
  | "directory"
  | "downloaded"
  | "available"
  | "restoring"
  | "archived";

export type NavigationFileStatusBadgeDescriptor = {
  status: "available" | "downloaded" | "archived" | "restoring";
  label: string;
  title: string;
};

export function isTemporaryRestoredArchivalFile(item: NavigationContentExplorerItem): boolean {
  return (
    item.kind === "file" &&
    item.downloadState !== "downloaded" &&
    item.availabilityStatus === "available" &&
    Boolean(item.restoreExpiryDate) &&
    isArchivedStorageClass(item.storageClass)
  );
}

export function getSummaryContentStatuses(
  item: NavigationContentExplorerItem
): NavigationContentStatusFilter[] {
  if (item.kind === "directory") {
    return ["directory"];
  }

  if (item.downloadState === "downloaded") {
    return ["downloaded"];
  }

  if (item.availabilityStatus === "restoring") {
    return ["restoring"];
  }

  if (isTemporaryRestoredArchivalFile(item)) {
    return ["available", "archived"];
  }

  if (item.availabilityStatus === "available") {
    return ["available"];
  }

  if (item.availabilityStatus === "archived") {
    return ["archived"];
  }

  return [];
}

export function getDisplayContentStatus(
  item: NavigationContentExplorerItem
): NavigationContentStatusFilter | null {
  if (item.kind !== "file") {
    return null;
  }

  if (item.downloadState === "downloaded") {
    return "downloaded";
  }

  if (item.availabilityStatus === "available") {
    return "available";
  }

  if (item.availabilityStatus === "restoring") {
    return "restoring";
  }

  if (item.availabilityStatus === "archived") {
    return "archived";
  }

  return null;
}

export function getContentStatusLabel(
  status: NavigationContentStatusFilter | null,
  t: (key: string) => string
): string | null {
  if (status === "directory") {
    return t("content.filter.status.directory");
  }

  if (status === "downloaded") {
    return t("content.download_state.downloaded");
  }

  if (status === "available" || status === "restoring" || status === "archived") {
    return t(`content.availability.${status}`);
  }

  return null;
}

export function buildAvailableUntilTooltip(
  restoreExpiryDate: string | null | undefined,
  locale: Locale,
  t: (key: string) => string
): string {
  const formattedDate = formatDateTime(restoreExpiryDate, locale);

  return t("content.availability.available_until").replace("{date}", formattedDate);
}

export function getFileStatusBadgeDescriptors(
  item: NavigationContentExplorerItem,
  locale: Locale,
  t: (key: string) => string
): NavigationFileStatusBadgeDescriptor[] {
  if (item.kind !== "file") {
    return [];
  }

  if (isTemporaryRestoredArchivalFile(item)) {
    return [
      {
        status: "available",
        label: t("content.availability.available"),
        title: buildAvailableUntilTooltip(item.restoreExpiryDate, locale, t)
      },
      {
        status: "archived",
        label: t("content.availability.archived"),
        title: t("content.availability.archived")
      }
    ];
  }

  const primaryStatus = getDisplayContentStatus(item);
  const primaryLabel = getContentStatusLabel(primaryStatus, t);

  if (!primaryStatus || primaryStatus === "directory" || !primaryLabel) {
    return [];
  }

  return [
    {
      status: primaryStatus,
      label: primaryLabel,
      title: primaryLabel
    }
  ];
}

export function getPreferredFileStatusBadgeDescriptors(
  item: NavigationContentExplorerItem,
  locale: Locale,
  t: (key: string) => string
): NavigationFileStatusBadgeDescriptor[] {
  const descriptors = getFileStatusBadgeDescriptors(item, locale, t);
  const availableDescriptor = descriptors.find((descriptor) => descriptor.status === "available");

  return availableDescriptor ? [availableDescriptor] : descriptors;
}
