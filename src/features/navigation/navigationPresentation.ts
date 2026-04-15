import type { Locale } from "../../lib/i18n/I18nProvider";
import { isArchivedStorageClass, type NavigationContentExplorerItem } from "./navigationContent";

export type NavigationTreeNode = {
  id: string;
  kind: "connection" | "bucket";
  connectionId: string;
  provider: "aws" | "azure";
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  children?: NavigationTreeNode[];
};

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

const MISSING_MINIMUM_S3_PERMISSION_ERROR = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
const RESTRICTED_BUCKET_MISMATCH_ERROR = "AWS_S3_RESTRICTED_BUCKET_MISMATCH";

export function normalizeFilterText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

export function isCancelledTransferError(error: unknown): boolean {
  return extractErrorMessage(error) === "DOWNLOAD_CANCELLED";
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

export function buildConnectionFailureMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const errorMessage = extractErrorMessage(error);

  if (errorMessage === MISSING_MINIMUM_S3_PERMISSION_ERROR) {
    return t("navigation.modal.aws.test_connection_missing_minimum_permission");
  }

  if (errorMessage === RESTRICTED_BUCKET_MISMATCH_ERROR) {
    return t("navigation.modal.aws.test_connection_restricted_bucket_mismatch");
  }

  return errorMessage ?? t("navigation.modal.aws.test_connection_failure");
}

export function getConnectionActions(
  t: (key: string) => string,
  indicator: { status: "disconnected" | "connecting" | "connected" | "error" }
): Array<{
  id: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove";
  label: string;
  variant?: "danger";
  disabled?: boolean;
}> {
  return [
    indicator.status === "connecting"
      ? { id: "cancelConnect", label: t("navigation.menu.cancel_connect") }
      : indicator.status === "connected"
        ? { id: "disconnect", label: t("navigation.menu.disconnect") }
        : {
            id: "connect",
            label: t("navigation.menu.connect")
          },
    { id: "edit", label: t("navigation.menu.edit_settings") },
    { id: "remove", label: t("navigation.menu.remove"), variant: "danger" }
  ];
}

export function getFileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

export function isUploadExistsPreflightPermissionError(error: unknown): boolean {
  const message = extractErrorMessage(error)?.toLowerCase() ?? "";

  return (
    message.includes("accessdenied") ||
    message.includes("unauthorizedaccess") ||
    message.includes("forbidden") ||
    message.includes("not authorized")
  );
}

export function matchesFilter(
  parts: Array<string | null | undefined>,
  normalizedFilter: string
): boolean {
  if (!normalizedFilter) {
    return true;
  }

  return parts.some((part) => part?.toLocaleLowerCase().includes(normalizedFilter));
}

export function filterTreeNodes(
  nodes: NavigationTreeNode[],
  normalizedFilter: string
): NavigationTreeNode[] {
  if (!normalizedFilter) {
    return nodes;
  }

  return nodes.reduce<NavigationTreeNode[]>((filteredNodes, node) => {
    const filteredChildren = node.children
      ? filterTreeNodes(node.children, normalizedFilter)
      : undefined;
    const nodeMatches = matchesFilter(
      [node.name, node.provider, node.region, node.bucketName, node.path],
      normalizedFilter
    );

    if (!nodeMatches && (!filteredChildren || filteredChildren.length === 0)) {
      return filteredNodes;
    }

    filteredNodes.push({
      ...node,
      children: filteredChildren
    });

    return filteredNodes;
  }, []);
}

export function getPathTitle(path: string, fallback: string): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const name = trimmed.split("/").pop();

  return name && name.length > 0 ? name : path;
}

export function buildBreadcrumbs(connectionName: string, bucketName: string, path: string) {
  const breadcrumbs = [
    { label: connectionName, path: null as string | null },
    { label: bucketName, path: "" }
  ];

  if (!path) {
    return breadcrumbs;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = trimmed.split("/");
  let accumulatedPath = "";

  for (const segment of segments) {
    accumulatedPath += `${segment}/`;
    breadcrumbs.push({
      label: segment || "/",
      path: accumulatedPath
    });
  }

  return breadcrumbs;
}

export function buildContentCounterLabel(
  t: (key: string) => string,
  isFilterActive: boolean,
  displayedCount: number,
  loadedCount: number
): string {
  if (isFilterActive) {
    return t("content.list.count_filtered")
      .replace("{filtered}", String(displayedCount))
      .replace("{loaded}", String(loadedCount));
  }

  return t("content.list.count_loaded").replace("{loaded}", String(loadedCount));
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

export function isTemporaryRestoredArchivalFile(item: NavigationContentExplorerItem): boolean {
  return (
    item.kind === "file" &&
    item.downloadState !== "downloaded" &&
    item.availabilityStatus === "available" &&
    Boolean(item.restoreExpiryDate) &&
    isArchivedStorageClass(item.storageClass)
  );
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
