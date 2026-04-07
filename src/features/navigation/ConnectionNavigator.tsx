import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import {
  AlertCircle,
  Archive,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  Download,
  Ellipsis,
  File,
  Folder,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Upload,
  XCircle,
  X
} from "lucide-react";
import logoPrimary from "../../assets/logo-primary.svg";
import { AwsConnectionFields } from "../connections/components/AwsConnectionFields";
import { AwsUploadStorageClassField } from "../connections/components/AwsUploadStorageClassField";
import { AzureConnectionPlaceholder } from "../connections/components/AzureConnectionPlaceholder";
import {
  DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
  normalizeAwsUploadStorageClass,
  type AwsUploadStorageClass
} from "../connections/awsUploadStorageClasses";
import { appSettingsStore } from "../settings/persistence/appSettingsStore";
import type {
  AwsConnectionDraft,
  ConnectionFormMode,
  ConnectionProvider,
  SavedConnectionSummary
} from "../connections/models";
import { connectionService } from "../connections/services/connectionService";
import {
  isConnectionNameFormatValid,
  isRestrictedBucketNameFormatValid,
  MAX_CONNECTION_NAME_LENGTH
} from "../connections/services/connectionService";
import {
  type AwsRestoreTier,
  type AwsDownloadProgressEvent,
  type AwsUploadProgressEvent,
  type AwsBucketSummary,
  awsObjectExists,
  cancelAwsUpload,
  cancelAwsDownload,
  createAwsFolder,
  downloadAwsObjectToPath,
  findAwsCachedObjects,
  getAwsBucketRegion,
  listAwsBucketItems,
  listAwsBuckets,
  openAwsCachedObject,
  openAwsCachedObjectParent,
  requestAwsObjectRestore,
  startAwsUpload,
  startAwsUploadFromBytes,
  startAwsCacheDownload,
  testAwsConnection
} from "../../lib/tauri/awsConnections";
import type { AwsBucketItemsResult } from "../../lib/tauri/awsConnections";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";
import { validateLocalMappingDirectory } from "../../lib/tauri/commands";
import { type RestoreRequestTarget, RestoreRequestModal } from "../restore/RestoreRequestModal";

type NavigatorView = "home" | "node";
type ConnectionTestStatus = "idle" | "testing" | "success" | "error";
type ConnectionIndicatorStatus = "disconnected" | "connecting" | "connected" | "error";
type FormErrors = Partial<
  Record<"connectionName" | "accessKeyId" | "secretAccessKey" | "restrictedBucketName", string>
>;
type NodeAction = {
  id: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove";
  label: string;
  variant?: "danger";
  disabled?: boolean;
};

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";
const MISSING_MINIMUM_S3_PERMISSION_ERROR = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
const RESTRICTED_BUCKET_MISMATCH_ERROR = "AWS_S3_RESTRICTED_BUCKET_MISMATCH";
const CONNECTING_CONNECTION_TITLE_KEY = "navigation.connection_status.connecting";
const CONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.connected";
const DISCONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.disconnected";
const BUCKET_REGION_PLACEHOLDER = "...";
const MAX_BUCKET_REGION_REQUESTS = 4;
const CONTENT_VIEW_MODE_STORAGE_KEY = "cloudeasyfiles.content-view-mode";
const CONNECTION_METADATA_STORAGE_KEY = "cloudeasyfiles.connection-metadata";
const ALL_CONTENT_STATUS_FILTERS: Array<"downloaded" | "available" | "restoring" | "archived"> = [
  "downloaded",
  "available",
  "restoring",
  "archived"
];
type ConnectionIndicator = {
  status: ConnectionIndicatorStatus;
  message?: string;
};

type ContentViewMode = "list" | "compact";
type LocalMappingDirectoryStatus = "checking" | "valid" | "invalid" | "missing";
type FileAvailabilityStatus = "available" | "archived" | "restoring";
type FileDownloadState = "not_downloaded" | "restoring" | "available_to_download" | "downloaded";
type ContentStatusFilter = (typeof ALL_CONTENT_STATUS_FILTERS)[number];
type FileActionId =
  | "download"
  | "downloadAs"
  | "openFile"
  | "openInExplorer"
  | "cancelDownload"
  | "restore";
type DownloadTransferState = "progress" | "completed" | "failed" | "cancelled";
type TransferKind = "cache" | "direct" | "upload";
type ContentMenuAnchor = {
  itemId: string;
  x: number;
  y: number;
};

type ContentAreaMenuAnchor = {
  x: number;
  y: number;
};

type ContentExplorerItem = {
  id: string;
  kind: "directory" | "file";
  name: string;
  path: string;
  size?: number;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreExpiryDate?: string | null;
  availabilityStatus?: FileAvailabilityStatus;
  downloadState?: FileDownloadState;
};

type TreeNodeKind = "connection" | "bucket";

type ExplorerTreeNode = {
  id: string;
  kind: TreeNodeKind;
  connectionId: string;
  provider: ConnectionProvider;
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  children?: ExplorerTreeNode[];
};

function sortTreeNodes(nodes: ExplorerTreeNode[]): ExplorerTreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined
    }))
    .sort((left, right) => {
      const kindOrder = (node: ExplorerTreeNode) => (node.kind === "bucket" ? 0 : 1);

      const kindDifference = kindOrder(left) - kindOrder(right);

      if (kindDifference !== 0) {
        return kindDifference;
      }

      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      });
    });
}

function buildBucketNodes(
  connection: SavedConnectionSummary,
  buckets: AwsBucketSummary[]
): ExplorerTreeNode[] {
  return sortTreeNodes(
    buckets.map((bucket) => ({
      id: `${connection.id}:bucket:${bucket.name}`,
      kind: "bucket",
      connectionId: connection.id,
      provider: connection.provider,
      name: bucket.name,
      region: BUCKET_REGION_PLACEHOLDER,
      bucketName: bucket.name,
      path: "",
      children: []
    }))
  );
}

function findNodeById(
  nodes: ExplorerTreeNode[],
  nodeId: string | null
): ExplorerTreeNode | null {
  if (!nodeId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const match = findNodeById(node.children ?? [], nodeId);

    if (match) {
      return match;
    }
  }

  return null;
}

function extractErrorMessage(error: unknown): string | null {
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

function isCancelledTransferError(error: unknown): boolean {
  return extractErrorMessage(error) === "DOWNLOAD_CANCELLED";
}

function isArchivedStorageClass(storageClass: string | null | undefined): boolean {
  const normalizedStorageClass = storageClass?.toLocaleLowerCase() ?? "";

  return normalizedStorageClass.includes("archive") || normalizedStorageClass.includes("glacier");
}

function buildPreviewFileState(
  storageClass: string | null | undefined,
  restoreInProgress?: boolean | null,
  restoreExpiryDate?: string | null
): Pick<ContentExplorerItem, "availabilityStatus" | "downloadState"> {
  const isArchivedTier = isArchivedStorageClass(storageClass);

  if (restoreInProgress) {
    return {
      availabilityStatus: "restoring",
      downloadState: "restoring"
    };
  }

  if (isArchivedTier && restoreExpiryDate) {
    return {
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    };
  }

  if (isArchivedTier) {
    return {
      availabilityStatus: "archived",
      downloadState: "not_downloaded"
    };
  }

  return {
    availabilityStatus: "available",
    downloadState: "not_downloaded"
  };
}

function buildContentItems(result: AwsBucketItemsResult): ContentExplorerItem[] {
  const directories: ContentExplorerItem[] = result.directories
    .map((directory) => ({
      id: `directory:${directory.path}`,
      kind: "directory" as const,
      name: directory.name,
      path: directory.path
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      })
    );

  const files: ContentExplorerItem[] = result.files
    .map((file) => ({
      ...buildPreviewFileState(file.storageClass, file.restoreInProgress, file.restoreExpiryDate),
      id: `file:${file.key}`,
      kind: "file" as const,
      name: file.key.split("/").pop() || file.key,
      path: file.key,
      size: file.size,
      lastModified: file.lastModified,
      storageClass: file.storageClass,
      restoreExpiryDate: file.restoreExpiryDate
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      })
    );

  return [...directories, ...files];
}

function mergeContentItems(
  currentItems: ContentExplorerItem[],
  nextItems: ContentExplorerItem[]
): ContentExplorerItem[] {
  const mergedItems = new Map<string, ContentExplorerItem>();

  for (const item of currentItems) {
    mergedItems.set(item.id, item);
  }

  for (const item of nextItems) {
    mergedItems.set(item.id, item);
  }

  return [...mergedItems.values()].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true
    });
  });
}

function normalizeFilterText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesFilter(parts: Array<string | null | undefined>, normalizedFilter: string): boolean {
  if (!normalizedFilter) {
    return true;
  }

  return parts.some((part) => part?.toLocaleLowerCase().includes(normalizedFilter));
}

function filterTreeNodes(
  nodes: ExplorerTreeNode[],
  normalizedFilter: string
): ExplorerTreeNode[] {
  if (!normalizedFilter) {
    return nodes;
  }

  return nodes.reduce<ExplorerTreeNode[]>((filteredNodes, node) => {
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

function getPathTitle(path: string, fallback: string): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const name = trimmed.split("/").pop();

  return name && name.length > 0 ? name : path;
}

function buildBreadcrumbs(connectionName: string, bucketName: string, path: string) {
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

function formatBytes(size: number | undefined, locale: Locale): string {
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

function formatDateTime(value: string | null | undefined, locale: Locale): string {
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

function buildConnectionFailureMessage(
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

function getConnectionActions(
  t: (key: string) => string,
  indicator: ConnectionIndicator
): NodeAction[] {
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

function buildContentCounterLabel(
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

function getSummaryContentStatuses(item: ContentExplorerItem): ContentStatusFilter[] {
  if (item.kind !== "file") {
    return [];
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

function getDisplayContentStatus(item: ContentExplorerItem): ContentStatusFilter | null {
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

function getContentStatusLabel(
  status: ContentStatusFilter | null,
  t: (key: string) => string
): string | null {
  if (status === "downloaded") {
    return t("content.download_state.downloaded");
  }

  if (status === "available" || status === "restoring" || status === "archived") {
    return t(`content.availability.${status}`);
  }

  return null;
}

type FileStatusBadgeDescriptor = {
  status: "available" | "downloaded" | "archived" | "restoring";
  label: string;
  title: string;
};

function isTemporaryRestoredArchivalFile(item: ContentExplorerItem): boolean {
  return (
    item.kind === "file" &&
    item.downloadState !== "downloaded" &&
    item.availabilityStatus === "available" &&
    Boolean(item.restoreExpiryDate) &&
    isArchivedStorageClass(item.storageClass)
  );
}

function buildAvailableUntilTooltip(
  restoreExpiryDate: string | null | undefined,
  locale: Locale,
  t: (key: string) => string
): string {
  const formattedDate = formatDateTime(restoreExpiryDate, locale);

  return t("content.availability.available_until").replace("{date}", formattedDate);
}

function getFileStatusBadgeDescriptors(
  item: ContentExplorerItem,
  locale: Locale,
  t: (key: string) => string
): FileStatusBadgeDescriptor[] {
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

  if (!primaryStatus || !primaryLabel) {
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

function resolveDownloadState(
  item: ContentExplorerItem,
  downloadedPaths: Set<string>,
  connectionId: string | null,
  bucketName: string | null,
  hasLocalCacheDirectory: boolean
): FileDownloadState | undefined {
  if (item.kind !== "file") {
    return item.downloadState;
  }

  if (item.availabilityStatus === "restoring") {
    return "restoring";
  }

  if (
    connectionId &&
    bucketName &&
    downloadedPaths.has(buildFileIdentity(connectionId, bucketName, item.path))
  ) {
    return "downloaded";
  }

  if (item.availabilityStatus === "available") {
    return hasLocalCacheDirectory ? "available_to_download" : "not_downloaded";
  }

  if (item.availabilityStatus === "archived") {
    return "not_downloaded";
  }

  return item.downloadState;
}

function applyDownloadedFileState(
  items: ContentExplorerItem[],
  downloadedPaths: Set<string>,
  connectionId: string | null,
  bucketName: string | null,
  hasLocalCacheDirectory: boolean
): ContentExplorerItem[] {
  let hasChanges = false;
  const nextItems = items.map((item) => {
    const nextDownloadState = resolveDownloadState(
      item,
      downloadedPaths,
      connectionId,
      bucketName,
      hasLocalCacheDirectory
    );

    if (item.downloadState === nextDownloadState) {
      return item;
    }

    hasChanges = true;

    return {
      ...item,
      downloadState: nextDownloadState
    };
  });

  return hasChanges ? nextItems : items;
}

function buildFileIdentity(connectionId: string, bucketName: string, objectKey: string): string {
  return `${connectionId}:${bucketName}:${objectKey}`;
}

function isFileIdentityInContext(
  fileIdentity: string,
  connectionId: string,
  bucketName: string,
  items: ContentExplorerItem[]
): boolean {
  return items.some(
    (item) =>
      item.kind === "file" &&
      buildFileIdentity(connectionId, bucketName, item.path) === fileIdentity
  );
}

async function resolveCachedFileIdentities(
  connectionId: string,
  connectionName: string,
  bucketName: string,
  globalLocalCacheDirectory: string | undefined,
  items: ContentExplorerItem[]
): Promise<Set<string>> {
  if (!globalLocalCacheDirectory) {
    return new Set();
  }

  const objectKeys = items
    .filter((item) => item.kind === "file")
    .map((item) => item.path);

  if (objectKeys.length === 0) {
    return new Set();
  }

  const cachedObjectKeys = await findAwsCachedObjects(
    connectionId,
    connectionName,
    bucketName,
    globalLocalCacheDirectory,
    objectKeys
  );

  return new Set(
    cachedObjectKeys.map((objectKey) => buildFileIdentity(connectionId, bucketName, objectKey))
  );
}

function reconcileDownloadedFilePathsForContext(
  currentPaths: string[],
  cachedPaths: Set<string>,
  connectionId: string,
  bucketName: string,
  items: ContentExplorerItem[]
): string[] {
  const nextPaths = currentPaths.filter(
    (path) => !isFileIdentityInContext(path, connectionId, bucketName, items)
  );

  for (const path of cachedPaths) {
    nextPaths.push(path);
  }

  const uniqueNextPaths = [...new Set(nextPaths)];

  if (
    uniqueNextPaths.length === currentPaths.length &&
    uniqueNextPaths.every((path, index) => path === currentPaths[index])
  ) {
    return currentPaths;
  }

  return uniqueNextPaths;
}

function loadLegacyGlobalCacheDirectoryCandidate(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const rawValue = window.localStorage.getItem(CONNECTION_METADATA_STORAGE_KEY);

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return undefined;
    }

    for (const candidate of parsedValue) {
      if (
        candidate &&
        typeof candidate === "object" &&
        "localCacheDirectory" in candidate &&
        typeof candidate.localCacheDirectory === "string"
      ) {
        const normalizedPath = candidate.localCacheDirectory.trim();

        if (normalizedPath) {
          return normalizedPath;
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function loadInitialGlobalCacheDirectory(): string {
  const appSettings = appSettingsStore.load();

  if (appSettings.globalLocalCacheDirectory?.trim()) {
    return appSettings.globalLocalCacheDirectory.trim();
  }

  return loadLegacyGlobalCacheDirectoryCandidate() ?? "";
}

type ActiveTransfer = {
  operationId: string;
  itemId: string;
  fileIdentity: string;
  fileName: string;
  bucketName: string;
  transferKind: TransferKind;
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  state: DownloadTransferState;
  objectKey?: string;
  localFilePath?: string;
  targetPath?: string | null;
  error?: string | null;
};

type CompletionToast = {
  id: string;
  title: string;
  description: string;
  tone?: "success" | "error";
};

type UploadConflictDecision = "overwrite" | "skip" | "overwriteAll" | "skipAll";

type SimpleUploadBatchInput = {
  fileName: string;
  localFilePath?: string;
  startUpload: (
    draft: AwsConnectionDraft,
    operationId: string,
    objectKey: string
  ) => Promise<void>;
};

type PreparedSimpleUploadBatchItem = SimpleUploadBatchInput & {
  objectKey: string;
  fileIdentity: string;
  objectAlreadyExists: boolean;
};

type UploadConflictPromptState = {
  currentConflictIndex: number;
  totalConflicts: number;
  fileName: string;
  objectKey: string;
};

type RestoreRequestState = RestoreRequestTarget & {
  connectionId: string;
  bucketName: string;
  bucketRegion?: string | null;
  objectKey: string;
};

type ConnectionNavigatorProps = {
  locale: Locale;
  onLocaleChange: (locale: string) => Promise<void>;
};

export function ConnectionNavigator({
  locale,
  onLocaleChange
}: ConnectionNavigatorProps) {
  const { t } = useI18n();
  const nameFieldId = useId();
  const providerFieldId = useId();
  const accessKeyFieldId = useId();
  const secretKeyFieldId = useId();
  const restrictedBucketNameFieldId = useId();
  const connectOnStartupFieldId = useId();
  const newFolderNameFieldId = useId();
  const localeFieldId = useId();
  const globalCacheDirectoryFieldId = useId();
  const [connections, setConnections] = useState<SavedConnectionSummary[]>([]);
  const [selectedView, setSelectedView] = useState<NavigatorView>("home");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionFormMode>("create");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionProvider>("aws");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [restrictedBucketName, setRestrictedBucketName] = useState("");
  const [connectOnStartup, setConnectOnStartup] = useState(false);
  const [defaultAwsUploadStorageClass, setDefaultAwsUploadStorageClass] =
    useState<AwsUploadStorageClass>(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
  const [globalLocalCacheDirectory, setGlobalLocalCacheDirectory] = useState(
    loadInitialGlobalCacheDirectory
  );
  const [localMappingDirectoryStatus, setLocalMappingDirectoryStatus] =
    useState<LocalMappingDirectoryStatus>(() =>
      loadInitialGlobalCacheDirectory().trim() ? "checking" : "missing"
    );
  const [connectionTestStatus, setConnectionTestStatus] =
    useState<ConnectionTestStatus>("idle");
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [openMenuConnectionId, setOpenMenuConnectionId] = useState<string | null>(null);
  const [pendingDeleteConnectionId, setPendingDeleteConnectionId] = useState<string | null>(null);
  const [connectionIndicators, setConnectionIndicators] = useState<
    Record<string, ConnectionIndicator>
  >({});
  const [collapsedConnectionIds, setCollapsedConnectionIds] = useState<Record<string, boolean>>({});
  const [connectionProviderAccountIds, setConnectionProviderAccountIds] = useState<
    Record<string, string>
  >({});
  const [connectionBuckets, setConnectionBuckets] = useState<
    Record<string, ExplorerTreeNode[]>
  >({});
  const [bucketContentPaths, setBucketContentPaths] = useState<Record<string, string>>({});
  const [contentItems, setContentItems] = useState<ContentExplorerItem[]>([]);
  const [contentContinuationToken, setContentContinuationToken] = useState<string | null>(null);
  const [contentHasMore, setContentHasMore] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingMoreContent, setIsLoadingMoreContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loadMoreContentError, setLoadMoreContentError] = useState<string | null>(null);
  const [contentActionError, setContentActionError] = useState<string | null>(null);
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequestState | null>(null);
  const [restoreSubmitError, setRestoreSubmitError] = useState<string | null>(null);
  const [isSubmittingRestoreRequest, setIsSubmittingRestoreRequest] = useState(false);
  const [sidebarFilterText, setSidebarFilterText] = useState("");
  const [contentFilterText, setContentFilterText] = useState("");
  const [contentStatusFilters, setContentStatusFilters] = useState<ContentStatusFilter[]>([]);
  const [downloadedFilePaths, setDownloadedFilePaths] = useState<string[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, ActiveTransfer>>({});
  const [activeDirectDownloadItemIds, setActiveDirectDownloadItemIds] = useState<string[]>([]);
  const [completionToast, setCompletionToast] = useState<CompletionToast | null>(null);
  const [uploadConflictPrompt, setUploadConflictPrompt] =
    useState<UploadConflictPromptState | null>(null);
  const [openContentMenuItemId, setOpenContentMenuItemId] = useState<string | null>(null);
  const [contentMenuAnchor, setContentMenuAnchor] = useState<ContentMenuAnchor | null>(null);
  const [contentAreaMenuAnchor, setContentAreaMenuAnchor] = useState<ContentAreaMenuAnchor | null>(
    null
  );
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isUploadDropTargetActive, setIsUploadDropTargetActive] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUploadSettingsModalOpen, setIsUploadSettingsModalOpen] = useState(false);
  const [uploadSettingsStorageClass, setUploadSettingsStorageClass] =
    useState<AwsUploadStorageClass>(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
  const [uploadSettingsSubmitError, setUploadSettingsSubmitError] = useState<string | null>(null);
  const [isSavingUploadSettings, setIsSavingUploadSettings] = useState(false);
  const [contentRefreshNonce, setContentRefreshNonce] = useState(0);
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>(() => {
    if (typeof window === "undefined") {
      return "list";
    }

    const savedMode = window.localStorage.getItem(CONTENT_VIEW_MODE_STORAGE_KEY);
    return savedMode === "compact" ? "compact" : "list";
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    const savedSidebarWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);

    if (!savedSidebarWidth) {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    const parsedSidebarWidth = Number(savedSidebarWidth);

    if (!Number.isFinite(parsedSidebarWidth)) {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    return Math.min(Math.max(parsedSidebarWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const contentDropZoneRef = useRef<HTMLElement | null>(null);
  const hasProcessedStartupAutoConnectRef = useRef(false);
  const nativeDragDropPathsRef = useRef<string[]>([]);
  const uploadConflictResolverRef = useRef<((decision: UploadConflictDecision) => void) | null>(
    null
  );
  const connectionTestRequestIdRef = useRef(0);
  const connectionRequestIdsRef = useRef<Record<string, number>>({});
  const contentRequestIdRef = useRef(0);
  const deferredSidebarFilterText = useDeferredValue(sidebarFilterText);
  const deferredContentFilterText = useDeferredValue(contentFilterText);

  const treeNodes = useMemo(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        kind: "connection" as const,
        connectionId: connection.id,
        provider: connection.provider,
        name: connection.name,
        children: connectionBuckets[connection.id] ?? []
      })),
    [connections, connectionBuckets]
  );

  const selectedNode = useMemo(
    () => findNodeById(treeNodes, selectedNodeId),
    [treeNodes, selectedNodeId]
  );
  const normalizedSidebarFilter = useMemo(
    () => normalizeFilterText(deferredSidebarFilterText),
    [deferredSidebarFilterText]
  );
  const filteredTreeNodes = useMemo(
    () => filterTreeNodes(treeNodes, normalizedSidebarFilter),
    [treeNodes, normalizedSidebarFilter]
  );

  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === selectedNode?.connectionId) ?? null,
    [connections, selectedNode]
  );

  const pendingDeleteConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === pendingDeleteConnectionId) ?? null,
    [connections, pendingDeleteConnectionId]
  );
  const selectedConnectionIndicator = selectedConnection
    ? (connectionIndicators[selectedConnection.id] ?? { status: "disconnected" })
    : { status: "disconnected" as const };

  const selectedBucketPath =
    selectedNode?.kind === "bucket" ? (bucketContentPaths[selectedNode.id] ?? "") : "";
  const selectedBucketConnectionId =
    selectedNode?.kind === "bucket" ? selectedNode.connectionId : null;
  const selectedBucketId = selectedNode?.kind === "bucket" ? selectedNode.id : null;
  const selectedBucketName =
    selectedNode?.kind === "bucket" ? (selectedNode.bucketName ?? selectedNode.name) : null;
  const selectedBucketProvider = selectedNode?.kind === "bucket" ? selectedNode.provider : null;
  const canCreateFolderInCurrentContext =
    selectedNode?.kind === "bucket" && selectedBucketProvider === "aws";
  const selectedBucketRegion =
    selectedNode?.kind === "bucket" ? selectedNode.region ?? null : null;
  const displayedContentTitle =
    selectedNode?.kind === "bucket"
      ? getPathTitle(selectedBucketPath, selectedNode.name)
      : (selectedNode?.name ?? t("content.empty.title"));
  const selectedBreadcrumbs =
    selectedNode?.kind === "bucket" && selectedConnection
      ? buildBreadcrumbs(
          selectedConnection.name,
          selectedNode.bucketName ?? selectedNode.name,
          selectedBucketPath
        )
      : [];
  const normalizedContentFilter = useMemo(
    () => normalizeFilterText(deferredContentFilterText),
    [deferredContentFilterText]
  );
  const filteredConnectionBuckets = useMemo(() => {
    const bucketNodes =
      selectedNode?.kind === "connection" ? (connectionBuckets[selectedNode.id] ?? []) : [];

    if (!normalizedContentFilter) {
      return bucketNodes;
    }

    return bucketNodes.filter((bucketNode) =>
      matchesFilter([bucketNode.name, bucketNode.region, bucketNode.bucketName], normalizedContentFilter)
    );
  }, [connectionBuckets, normalizedContentFilter, selectedNode]);
  const isStatusFilterInactive =
    contentStatusFilters.length === 0 ||
    contentStatusFilters.length === ALL_CONTENT_STATUS_FILTERS.length;
  const filteredContentItems = useMemo(
    () =>
      contentItems.filter((item) => {
        const matchesTextFilter = matchesFilter(
          [item.name, item.path, item.storageClass, item.kind],
          normalizedContentFilter
        );

        if (!matchesTextFilter) {
          return false;
        }

        const itemStatuses = getSummaryContentStatuses(item);

        if (isStatusFilterInactive) {
          return true;
        }

        return itemStatuses.some((status) => contentStatusFilters.includes(status));
      }),
    [contentItems, normalizedContentFilter, contentStatusFilters, isStatusFilterInactive]
  );
  const isContentFilterActive = normalizedContentFilter.length > 0 || !isStatusFilterInactive;
  const loadedFileItems = useMemo(
    () => contentItems.filter((item) => item.kind === "file"),
    [contentItems]
  );
  const filteredFileItems = useMemo(
    () => filteredContentItems.filter((item) => item.kind === "file"),
    [filteredContentItems]
  );
  const loadedContentCount =
    selectedNode?.kind === "connection"
      ? (connectionBuckets[selectedNode.id] ?? []).length
      : selectedNode?.kind === "bucket"
      ? loadedFileItems.length
      : 0;
  const displayedContentCount =
    selectedNode?.kind === "connection"
      ? filteredConnectionBuckets.length
      : selectedNode?.kind === "bucket"
      ? filteredFileItems.length
      : 0;
  const contentCounterLabel = buildContentCounterLabel(
    t,
    isContentFilterActive,
    displayedContentCount,
    loadedContentCount
  );
  const shouldRenderListHeaders = contentViewMode === "list";
  const activeTransferList = Object.values(activeTransfers).filter(
    (transfer) => transfer.state === "progress"
  );
  const activeTrackedDownloadList = useMemo(
    () => activeTransferList.filter((transfer) => transfer.transferKind === "cache"),
    [activeTransferList]
  );
  const activeTrackedDownloadIdentityMap = useMemo(
    () =>
      new Map(
        activeTrackedDownloadList.map((transfer) => [transfer.fileIdentity, transfer] as const)
      ),
    [activeTrackedDownloadList]
  );
  const activeTransferIdentityMap = useMemo(
    () =>
      new Map(activeTransferList.map((transfer) => [transfer.fileIdentity, transfer] as const)),
    [activeTransferList]
  );
  const activeDownloadList = useMemo(
    () => activeTransferList.filter((transfer) => transfer.transferKind !== "upload"),
    [activeTransferList]
  );
  const activeUploadList = useMemo(
    () => activeTransferList.filter((transfer) => transfer.transferKind === "upload"),
    [activeTransferList]
  );
  const activeDownloadPreviewCount = activeDownloadList.length;
  const activeUploadPreviewCount = activeUploadList.length;
  const isDownloadTransferActive = activeDownloadPreviewCount > 0;
  const isUploadTransferActive = activeUploadPreviewCount > 0;
  const downloadedFilePathSet = useMemo(
    () => new Set(downloadedFilePaths),
    [downloadedFilePaths]
  );
  const hasValidGlobalLocalCacheDirectory = localMappingDirectoryStatus === "valid";
  const localMappingDirectoryAlertKey =
    localMappingDirectoryStatus === "invalid"
      ? "settings.download_directory_notice_invalid"
      : localMappingDirectoryStatus === "missing"
      ? "settings.download_directory_notice_missing"
      : null;
  const loadedDownloadedCount = useMemo(
    () => loadedFileItems.filter((item) => getSummaryContentStatuses(item).includes("downloaded")).length,
    [loadedFileItems]
  );
  const loadedAvailableCount = useMemo(
    () => loadedFileItems.filter((item) => getSummaryContentStatuses(item).includes("available")).length,
    [loadedFileItems]
  );
  const loadedRestoringCount = useMemo(
    () => loadedFileItems.filter((item) => getSummaryContentStatuses(item).includes("restoring")).length,
    [loadedFileItems]
  );
  const loadedArchivedCount = useMemo(
    () => loadedFileItems.filter((item) => getSummaryContentStatuses(item).includes("archived")).length,
    [loadedFileItems]
  );
  const contentStatusSummaryItems =
    selectedNode?.kind === "bucket"
      ? [
          {
            key: "downloaded" as const,
            label: t("content.download_state.downloaded"),
            count: loadedDownloadedCount
          },
          {
            key: "available" as const,
            label: t("content.availability.available"),
            count: loadedAvailableCount
          },
          {
            key: "restoring" as const,
            label: t("content.availability.restoring"),
            count: loadedRestoringCount
          },
          {
            key: "archived" as const,
            label: t("content.availability.archived"),
            count: loadedArchivedCount
          }
        ]
      : [];

  const shouldRenderLoadMoreButton = selectedNode?.kind === "bucket";

  function toggleContentStatusFilter(filter: ContentStatusFilter) {
    setContentStatusFilters((currentFilters) =>
      currentFilters.includes(filter)
        ? currentFilters.filter((currentFilter) => currentFilter !== filter)
        : [...currentFilters, filter]
    );
  }

  function getFileNameFromPath(filePath: string) {
    return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
  }

function buildUploadObjectKey(currentPath: string, fileName: string) {
  const normalizedPath = currentPath.trim().replace(/^\/+|\/+$/g, "");

  return normalizedPath ? `${normalizedPath}/${fileName}` : fileName;
}

function validateNewFolderNameInput(
  folderName: string,
  t: (key: string) => string
): string | null {
  const normalizedFolderName = folderName.trim();

  if (!normalizedFolderName) {
    return t("content.folder.name_required");
  }

  if (normalizedFolderName.includes("/") || normalizedFolderName.includes("\\")) {
    return t("content.folder.name_invalid");
  }

  return null;
}

  function extractDroppedFiles(event: React.DragEvent<HTMLElement>) {
    const droppedFilesFromItems = Array.from(event.dataTransfer?.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((candidate): candidate is File => candidate instanceof File);

    if (droppedFilesFromItems.length > 0) {
      return droppedFilesFromItems;
    }

    return Array.from(event.dataTransfer?.files ?? []);
  }

  function handlePickGlobalCacheDirectory() {
    if (!isTauri()) {
      return;
    }

    void (async () => {
      try {
        setSubmitError(null);

        const selectedPath = await open({
          directory: true,
          multiple: false,
          defaultPath: globalLocalCacheDirectory.trim() || undefined
        });

        if (!selectedPath || Array.isArray(selectedPath)) {
          return;
        }

        setGlobalLocalCacheDirectory(selectedPath);
      } catch (error) {
        setSubmitError(
          extractErrorMessage(error) ?? t("settings.download_directory_pick_failed")
        );
      }
    })();
  }

  function handleCancelActiveDownload(operationId: string) {
    void (async () => {
      try {
        await cancelAwsDownload(operationId);
      } catch (error) {
        if (isCancelledTransferError(error)) {
          return;
        }

        showTransferErrorToast(extractErrorMessage(error) ?? t("content.transfer.cancel_failed"));
      }
    })();
  }

  function handleCancelActiveTransfer(operationId: string, transferKind: TransferKind) {
    if (transferKind === "upload") {
      void (async () => {
        try {
          await cancelAwsUpload(operationId);
        } catch (error) {
          if (isCancelledTransferError(error)) {
            return;
          }

          showTransferErrorToast(
            extractErrorMessage(error) ?? t("content.transfer.cancel_failed")
          );
        }
      })();

      return;
    }

    handleCancelActiveDownload(operationId);
  }

  function isUploadExistsPreflightPermissionError(error: unknown) {
    const message = extractErrorMessage(error)?.toLowerCase() ?? "";

    return (
      message.includes("accessdenied") ||
      message.includes("unauthorizedaccess") ||
      message.includes("forbidden") ||
      message.includes("not authorized")
    );
  }

  async function startPreparedSimpleAwsUpload(
    draft: AwsConnectionDraft,
    input: PreparedSimpleUploadBatchItem
  ) {
    if (
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      selectedBucketProvider !== "aws"
    ) {
      return;
    }

    const operationId =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let didCreateTransferEntry = false;

    try {
      setContentActionError(null);

      setActiveTransfers((currentTransfers) => ({
        ...currentTransfers,
        [operationId]: {
          operationId,
          itemId: `upload:${input.objectKey}`,
          fileIdentity: input.fileIdentity,
          fileName: input.fileName,
          bucketName: selectedBucketName,
          transferKind: "upload",
          progressPercent: 0,
          bytesTransferred: 0,
          totalBytes: 0,
          state: "progress",
          objectKey: input.objectKey,
          localFilePath: input.localFilePath ?? input.fileName
        }
      }));
      didCreateTransferEntry = true;

      await input.startUpload(draft, operationId, input.objectKey);
    } catch (error) {
      if (isCancelledTransferError(error)) {
        return;
      }

      const message = extractErrorMessage(error) ?? t("content.transfer.upload_failed");

      setActiveTransfers((currentTransfers) => {
        const currentTransfer = currentTransfers[operationId];

        if (!currentTransfer) {
          return currentTransfers;
        }

        return {
          ...currentTransfers,
          [operationId]: {
            ...currentTransfer,
            state: "failed",
            error: message
          }
        };
      });
      if (!didCreateTransferEntry) {
        showTransferErrorToast(message);
      }
    }
  }

  function promptUploadConflictResolution(
    input: UploadConflictPromptState
  ): Promise<UploadConflictDecision> {
    setUploadConflictPrompt(input);

    return new Promise<UploadConflictDecision>((resolve) => {
      uploadConflictResolverRef.current = (decision) => {
        uploadConflictResolverRef.current = null;
        setUploadConflictPrompt(null);
        resolve(decision);
      };
    });
  }

  function resolveUploadConflict(decision: UploadConflictDecision) {
    uploadConflictResolverRef.current?.(decision);
  }

  async function prepareSimpleAwsUploadBatch(inputs: SimpleUploadBatchInput[]) {
    if (
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      selectedBucketProvider !== "aws"
    ) {
      return null;
    }

    const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);
    const preparedItems: PreparedSimpleUploadBatchItem[] = [];
    const seenObjectKeys = new Set<string>();

    for (const input of inputs) {
      const fileName = input.fileName.trim();

      if (!fileName) {
        showTransferErrorToast(t("content.transfer.upload_invalid_path"));
        continue;
      }

      const objectKey = buildUploadObjectKey(selectedBucketPath, fileName);

      if (seenObjectKeys.has(objectKey)) {
        showTransferErrorToast(
          t("content.transfer.upload_duplicate_batch").replace("{name}", fileName)
        );
        continue;
      }

      seenObjectKeys.add(objectKey);

      const fileIdentity = buildFileIdentity(
        selectedBucketConnectionId,
        selectedBucketName,
        objectKey
      );

      if (activeTransferIdentityMap.has(fileIdentity)) {
        showTransferErrorToast(t("content.transfer.upload_duplicate_active"));
        continue;
      }

      let objectAlreadyExists = false;

      try {
        objectAlreadyExists = await awsObjectExists(
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          selectedBucketName,
          objectKey,
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined,
          draft.restrictedBucketName
        );
      } catch (error) {
        if (!isUploadExistsPreflightPermissionError(error)) {
          throw error;
        }
      }

      preparedItems.push({
        ...input,
        fileName,
        objectKey,
        fileIdentity,
        objectAlreadyExists
      });
    }

    return {
      draft,
      preparedItems
    };
  }

  async function processSimpleAwsUploadBatch(inputs: SimpleUploadBatchInput[]) {
    const preparedBatch = await prepareSimpleAwsUploadBatch(inputs);

    if (!preparedBatch || preparedBatch.preparedItems.length === 0) {
      return;
    }

    const conflictingItems = preparedBatch.preparedItems.filter((item) => item.objectAlreadyExists);
    const totalConflicts = conflictingItems.length;
    let conflictCursor = 0;
    let applyRemainingDecision: "overwrite" | "skip" | null = null;

    for (const item of preparedBatch.preparedItems) {
      let shouldUpload = true;

      if (item.objectAlreadyExists) {
        conflictCursor += 1;

        if (applyRemainingDecision) {
          shouldUpload = applyRemainingDecision === "overwrite";
        } else {
          const decision = await promptUploadConflictResolution({
            currentConflictIndex: conflictCursor,
            totalConflicts,
            fileName: item.fileName,
            objectKey: item.objectKey
          });

          if (decision === "skipAll") {
            applyRemainingDecision = "skip";
            shouldUpload = false;
          } else if (decision === "overwriteAll") {
            applyRemainingDecision = "overwrite";
          } else {
            shouldUpload = decision === "overwrite";
          }
        }
      }

      if (!shouldUpload) {
        continue;
      }

      void startPreparedSimpleAwsUpload(preparedBatch.draft, item);
    }
  }

  async function runSimpleAwsUpload(localFilePath: string) {
    const normalizedFilePath = localFilePath.trim();

    if (!normalizedFilePath) {
      return;
    }

    await processSimpleAwsUploadBatch([
      {
        fileName: getFileNameFromPath(normalizedFilePath),
        localFilePath: normalizedFilePath,
        startUpload: async (draft, operationId, objectKey) => {
          await startAwsUpload(
            operationId,
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketConnectionId!,
            selectedBucketName!,
            objectKey,
            normalizedFilePath,
            draft.defaultUploadStorageClass,
            selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? selectedBucketRegion
              : undefined,
            draft.restrictedBucketName
          );
        }
      }
    ]);
  }

  function runSimpleAwsUploads(localFilePaths: string[]) {
    const normalizedPaths = localFilePaths
      .map((localFilePath) => localFilePath.trim())
      .filter((localFilePath) => localFilePath.length > 0);

    void processSimpleAwsUploadBatch(
      normalizedPaths.map((localFilePath) => ({
        fileName: getFileNameFromPath(localFilePath),
        localFilePath,
        startUpload: async (draft, operationId, objectKey) => {
          await startAwsUpload(
            operationId,
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketConnectionId!,
            selectedBucketName!,
            objectKey,
            localFilePath,
            draft.defaultUploadStorageClass,
            selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? selectedBucketRegion
              : undefined,
            draft.restrictedBucketName
          );
        }
      }))
    );
  }

  function runSimpleDroppedFileUploads(files: File[]) {
    void processSimpleAwsUploadBatch(
      files.map((file) => ({
        fileName: file.name,
        localFilePath: file.name,
        startUpload: async (draft, operationId, objectKey) => {
          const candidateFile = file as File & {
            path?: string;
            webkitRelativePath?: string;
          };
          const candidatePath =
            candidateFile.path?.trim() || candidateFile.webkitRelativePath?.trim();

          if (candidatePath) {
            await startAwsUpload(
              operationId,
              draft.accessKeyId.trim(),
              draft.secretAccessKey.trim(),
              selectedBucketConnectionId!,
              selectedBucketName!,
              objectKey,
              candidatePath,
              draft.defaultUploadStorageClass,
              selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
                ? selectedBucketRegion
                : undefined,
              draft.restrictedBucketName
            );

            return;
          }

          const fileBytes = new Uint8Array(await file.arrayBuffer());

          await startAwsUploadFromBytes(
            operationId,
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketConnectionId!,
            selectedBucketName!,
            objectKey,
            file.name,
            fileBytes,
            draft.defaultUploadStorageClass,
            selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? selectedBucketRegion
              : undefined,
            draft.restrictedBucketName
          );
        }
      }))
    );
  }

  function handlePickUploadFile() {
    if (
      !isTauri() ||
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      selectedBucketProvider !== "aws"
    ) {
      return;
    }

    void (async () => {
      try {
        setContentActionError(null);

        const selectedPath = await open({
          directory: false,
          multiple: true
        });

        if (!selectedPath) {
          return;
        }

        runSimpleAwsUploads(Array.isArray(selectedPath) ? selectedPath : [selectedPath]);
      } catch (error) {
        showTransferErrorToast(
          extractErrorMessage(error) ?? t("content.transfer.upload_picker_failed")
        );
      }
    })();
  }

  function closeRestoreRequestModal() {
    if (isSubmittingRestoreRequest) {
      return;
    }

    setRestoreRequest(null);
    setRestoreSubmitError(null);
  }

  function handleSubmitAwsRestoreRequest(input: { tier: AwsRestoreTier; days: number }) {
    if (!restoreRequest || restoreRequest.provider !== "aws") {
      return;
    }

    void (async () => {
      setRestoreSubmitError(null);
      setIsSubmittingRestoreRequest(true);

      try {
        const draft = await connectionService.getAwsConnectionDraft(restoreRequest.connectionId);

        await requestAwsObjectRestore(
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          restoreRequest.bucketName,
          restoreRequest.objectKey,
          restoreRequest.storageClass,
          input.tier,
          input.days,
          restoreRequest.bucketRegion && restoreRequest.bucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? restoreRequest.bucketRegion
            : undefined,
          draft.restrictedBucketName
        );

        setRestoreRequest(null);
        setRestoreSubmitError(null);
        await handleRefreshCurrentView();
      } catch (error) {
        setRestoreSubmitError(
          extractErrorMessage(error) ?? t("restore.modal.submit_failed")
        );
      } finally {
        setIsSubmittingRestoreRequest(false);
      }
    })();
  }

  function handlePreviewFileAction(actionId: FileActionId, item: ContentExplorerItem) {
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setContentActionError(null);

    if (
      actionId === "cancelDownload" &&
      item.kind === "file" &&
      selectedBucketConnectionId &&
      selectedBucketName
    ) {
      const activeDownload = activeTransferIdentityMap.get(
        buildFileIdentity(selectedBucketConnectionId, selectedBucketName, item.path)
      );

      if (activeDownload) {
        handleCancelActiveDownload(activeDownload.operationId);
      }

      return;
    }

    if (
      actionId === "restore" &&
      item.kind === "file" &&
      selectedBucketProvider === "aws" &&
      selectedBucketConnectionId &&
      selectedBucketName &&
      item.availabilityStatus === "archived"
    ) {
      setRestoreSubmitError(null);
      setRestoreRequest({
        provider: selectedBucketProvider,
        connectionId: selectedBucketConnectionId,
        bucketName: selectedBucketName,
        bucketRegion:
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : null,
        objectKey: item.path,
        fileName: item.name,
        fileSizeLabel: formatBytes(item.size, locale),
        storageClass: item.storageClass
      });
      return;
    }

    if (
      actionId === "openFile" &&
      item.kind === "file" &&
      selectedBucketConnectionId &&
      selectedBucketName &&
      selectedConnection &&
      hasValidGlobalLocalCacheDirectory
    ) {
      void openAwsCachedObject(
        selectedBucketConnectionId,
        selectedConnection.name,
        selectedBucketName,
        globalLocalCacheDirectory,
        item.path
      );
      return;
    }

    if (
      actionId === "openInExplorer" &&
      item.kind === "file" &&
      selectedBucketConnectionId &&
      selectedBucketName &&
      selectedConnection &&
      hasValidGlobalLocalCacheDirectory
    ) {
      void openAwsCachedObjectParent(
        selectedBucketConnectionId,
        selectedConnection.name,
        selectedBucketName,
        globalLocalCacheDirectory,
        item.path
      );
      return;
    }

    if (
      item.kind === "file" &&
      actionId === "downloadAs" &&
      selectedBucketProvider === "aws" &&
      selectedBucketConnectionId &&
      selectedBucketName &&
      item.availabilityStatus === "available"
    ) {
      const activeTransfer = activeTransferIdentityMap.get(
        buildFileIdentity(selectedBucketConnectionId, selectedBucketName, item.path)
      );

      if (activeTransfer) {
        return;
      }

      if (activeDirectDownloadItemIds.includes(item.id)) {
        return;
      }

      void (async () => {
        const destinationPath = await save({
          defaultPath: item.name
        });

        if (!destinationPath) {
          return;
        }

        const operationId =
          typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `download-as-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        let didCreateTransferEntry = false;

        setActiveDirectDownloadItemIds((currentItemIds) =>
          currentItemIds.includes(item.id) ? currentItemIds : [...currentItemIds, item.id]
        );
        setActiveTransfers((currentTransfers) => ({
          ...currentTransfers,
          [operationId]: {
            operationId,
            itemId: item.id,
            fileIdentity: buildFileIdentity(
              selectedBucketConnectionId,
              selectedBucketName,
              item.path
            ),
            fileName: item.name,
            bucketName: selectedBucketName,
            transferKind: "direct",
            progressPercent: 0,
            bytesTransferred: 0,
            totalBytes: item.size ?? 0,
            state: "progress",
            targetPath: destinationPath
          }
        }));
        didCreateTransferEntry = true;

        try {
          const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);

          await downloadAwsObjectToPath(
            operationId,
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketConnectionId,
            selectedBucketName,
            item.path,
            destinationPath,
            selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? selectedBucketRegion
              : undefined,
            draft.restrictedBucketName
          );
        } catch (error) {
          if (isCancelledTransferError(error)) {
            return;
          }

          if (!didCreateTransferEntry) {
            showTransferErrorToast(
              extractErrorMessage(error) ?? t("content.transfer.download_as_failed")
            );
          }
        } finally {
          setActiveDirectDownloadItemIds((currentItemIds) =>
            currentItemIds.filter((currentItemId) => currentItemId !== item.id)
          );
        }
      })();

      return;
    }

    if (
      item.kind !== "file" ||
      actionId !== "download" ||
      selectedBucketProvider !== "aws" ||
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !selectedConnection ||
      !hasValidGlobalLocalCacheDirectory ||
      item.availabilityStatus !== "available"
    ) {
      return;
    }

    const activeTransfer = activeTransferIdentityMap.get(
      buildFileIdentity(selectedBucketConnectionId, selectedBucketName, item.path)
    );

    if (activeTransfer) {
      return;
    }

    const operationId =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `download-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    setActiveTransfers((currentTransfers) => ({
      ...currentTransfers,
      [operationId]: {
        operationId,
        itemId: item.id,
        fileIdentity: buildFileIdentity(
          selectedBucketConnectionId,
          selectedBucketName,
          item.path
        ),
        fileName: item.name,
        bucketName: selectedBucketName,
        transferKind: "cache",
        progressPercent: 0,
        bytesTransferred: 0,
        totalBytes: item.size ?? 0,
        state: "progress"
      }
    }));

    void (async () => {
      try {
        const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);

        await startAwsCacheDownload(
          operationId,
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          item.path,
          globalLocalCacheDirectory,
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined,
          draft.restrictedBucketName
        );
      } catch (error) {
        if (isCancelledTransferError(error)) {
          return;
        }

        const message = extractErrorMessage(error) ?? t("content.transfer.download_failed");

        setActiveTransfers((currentTransfers) => {
          const currentTransfer = currentTransfers[operationId];

          if (!currentTransfer) {
            return currentTransfers;
          }

          return {
            ...currentTransfers,
            [operationId]: {
              ...currentTransfer,
              state: "failed",
              error: message
            }
          };
        });
      }
    })();
  }

  useEffect(() => {
    let isActive = true;
    let cleanup: (() => void) | null = null;

    if (!isTauri()) {
      return undefined;
    }

    void (async () => {
      try {
        const unlisten = await listen<AwsDownloadProgressEvent>(
          "aws-download-progress",
          (event) => {
            if (!isActive) {
              return;
            }

            const payload = event.payload;

            setActiveTransfers((currentTransfers) => {
              const existingTransfer = currentTransfers[payload.operationId];

              if (!existingTransfer) {
                return currentTransfers;
              }

              return {
                ...currentTransfers,
                [payload.operationId]: {
                  ...existingTransfer,
                  progressPercent: payload.progressPercent,
                  bytesTransferred: payload.bytesReceived,
                  totalBytes: payload.totalBytes,
                  state: payload.state,
                  transferKind: payload.transferKind,
                  targetPath: payload.targetPath,
                  error: payload.error
                }
              };
            });

            if (payload.state === "completed" && payload.transferKind === "cache") {
              const fileIdentity = buildFileIdentity(
                payload.connectionId,
                payload.bucketName,
                payload.objectKey
              );

              setDownloadedFilePaths((currentPaths) =>
                currentPaths.includes(fileIdentity)
                  ? currentPaths
                  : [...currentPaths, fileIdentity]
              );
              setContentItems((currentItems) =>
                currentItems.map((currentItem) =>
                  currentItem.kind === "file" && currentItem.path === payload.objectKey
                    ? { ...currentItem, downloadState: "downloaded" }
                    : currentItem
                )
              );
            }

            if (payload.state === "completed" && payload.transferKind === "direct") {
              setCompletionToast({
                id: payload.operationId,
                title: t("content.transfer.download_as_completed"),
                description:
                  payload.targetPath ?? t("content.transfer.download_as_completed_fallback"),
                tone: "success"
              });
            } else if (payload.state === "failed" && payload.error) {
              showTransferErrorToast(payload.error);
            }
          }
        );

        if (!isActive) {
          void unlisten();
          return;
        }

        cleanup = () => {
          void unlisten();
        };
      } catch (error) {
        console.warn("[ui] failed to register aws download listener", error);
      }
    })();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [t]);

  useEffect(() => {
    if (isLoadingConnections || hasProcessedStartupAutoConnectRef.current) {
      return;
    }

    hasProcessedStartupAutoConnectRef.current = true;

    connections
      .filter((connection) => connection.connectOnStartup === true)
      .forEach((connection) => {
        void connectConnection(connection.id, connection);
      });
  }, [connections, isLoadingConnections]);

  useEffect(() => {
    let isActive = true;
    let cleanup: (() => void) | null = null;

    if (!isTauri()) {
      return undefined;
    }

    void (async () => {
      try {
        const unlisten = await listen<AwsUploadProgressEvent>(
          "aws-upload-progress",
          (event) => {
            if (!isActive) {
              return;
            }

            const payload = event.payload;

            setActiveTransfers((currentTransfers) => {
              const existingTransfer = currentTransfers[payload.operationId];

              if (!existingTransfer) {
                return currentTransfers;
              }

              return {
                ...currentTransfers,
                [payload.operationId]: {
                  ...existingTransfer,
                  progressPercent: payload.progressPercent,
                  bytesTransferred: payload.bytesTransferred,
                  totalBytes: payload.totalBytes,
                  state: payload.state,
                  error: payload.error,
                  objectKey: payload.objectKey,
                  localFilePath: payload.localFilePath
                }
              };
            });

            if (payload.state === "completed") {
              setCompletionToast({
                id: payload.operationId,
                title: t("content.transfer.upload_completed"),
                description: payload.objectKey,
                tone: "success"
              });

              if (
                payload.connectionId === selectedBucketConnectionId &&
                payload.bucketName === selectedBucketName
              ) {
                const uploadedParentPath = payload.objectKey.includes("/")
                  ? payload.objectKey.slice(0, payload.objectKey.lastIndexOf("/"))
                  : "";

                if (uploadedParentPath === selectedBucketPath) {
                  setContentRefreshNonce((currentValue) => currentValue + 1);
                }
              }
            } else if (payload.state === "failed" && payload.error) {
              showTransferErrorToast(payload.error);
            }
          }
        );

        if (!isActive) {
          void unlisten();
          return;
        }

        cleanup = () => {
          void unlisten();
        };
      } catch (error) {
        console.warn("[ui] failed to register aws upload listener", error);
      }
    })();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [selectedBucketConnectionId, selectedBucketName, selectedBucketPath, t]);

  useEffect(() => {
    let isActive = true;
    let cleanup: (() => void) | null = null;

    if (!isTauri()) {
      return undefined;
    }

    void (async () => {
      try {
        const unlisten = await getCurrentWindow().onDragDropEvent((event) => {
          if (!isActive) {
            return;
          }

          if (
            !selectedBucketConnectionId ||
            !selectedBucketName ||
            selectedBucketProvider !== "aws"
          ) {
            if (event.payload.type === "leave" || event.payload.type === "drop") {
              setIsUploadDropTargetActive(false);
              nativeDragDropPathsRef.current = [];
            }

            return;
          }

          if (event.payload.type === "enter" || event.payload.type === "over") {
            if ("paths" in event.payload && event.payload.paths.length > 0) {
              nativeDragDropPathsRef.current = event.payload.paths
                .map((filePath) => filePath.trim())
                .filter((filePath) => filePath.length > 0);
            }

            setIsUploadDropTargetActive(true);
            return;
          }

          if (event.payload.type === "leave") {
            setIsUploadDropTargetActive(false);
            nativeDragDropPathsRef.current = [];
            return;
          }

          setIsUploadDropTargetActive(false);

          const droppedPaths = event.payload.paths
            .map((filePath) => filePath.trim())
            .filter((filePath) => filePath.length > 0);

          nativeDragDropPathsRef.current = [];

          if (droppedPaths.length === 0) {
            return;
          }

          runSimpleAwsUploads(droppedPaths);
        });

        if (!isActive) {
          unlisten();
          return;
        }

        cleanup = () => {
          unlisten();
        };
      } catch (error) {
        console.warn("[ui] failed to register native drag and drop listener", error);
      }
    })();

    return () => {
      isActive = false;
      cleanup?.();
    };
  }, [
    selectedBucketConnectionId,
    selectedBucketName,
    selectedBucketProvider,
    selectedBucketPath,
    activeTransferIdentityMap,
    t
  ]);

  useEffect(() => {
    if (!completionToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCompletionToast((currentToast) =>
        currentToast?.id === completionToast.id ? null : currentToast
      );
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [completionToast]);

  function showTransferErrorToast(description: string) {
    setCompletionToast({
      id:
        typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
          ? globalThis.crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: t("content.transfer.error_title"),
      description,
      tone: "error"
    });
  }

  useEffect(() => {
    if (
      selectedBucketProvider !== "aws" ||
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !selectedConnection ||
      !hasValidGlobalLocalCacheDirectory ||
      contentItems.length === 0
    ) {
      return;
    }

    let isActive = true;

    void (async () => {
      try {
        const cachedFileIdentities = await resolveCachedFileIdentities(
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          globalLocalCacheDirectory,
          contentItems
        );

        if (!isActive) {
          return;
        }

        setDownloadedFilePaths((currentPaths) =>
          reconcileDownloadedFilePathsForContext(
            currentPaths,
            cachedFileIdentities,
            selectedBucketConnectionId,
            selectedBucketName,
            contentItems
          )
        );
      } catch {
        // Cache hydration must not block or destabilize provider-driven listing.
      }
    })();

    return () => {
      isActive = false;
    };
  }, [
    contentItems,
    globalLocalCacheDirectory,
    hasValidGlobalLocalCacheDirectory,
    selectedBucketConnectionId,
    selectedConnection,
    selectedBucketName,
    selectedBucketProvider
  ]);

  useEffect(() => {
    if (hasValidGlobalLocalCacheDirectory) {
      return;
    }

    setDownloadedFilePaths([]);
  }, [hasValidGlobalLocalCacheDirectory]);

  useEffect(() => {
    if (!selectedBucketConnectionId || !selectedBucketName || contentItems.length === 0) {
      return;
    }

    setContentItems((currentItems) =>
      applyDownloadedFileState(
        currentItems,
        downloadedFilePathSet,
        selectedBucketConnectionId,
        selectedBucketName,
        hasValidGlobalLocalCacheDirectory
      )
    );
  }, [
    downloadedFilePathSet,
    contentItems.length,
    hasValidGlobalLocalCacheDirectory,
    selectedBucketConnectionId,
    selectedBucketName
  ]);

  useEffect(() => {
    let isActive = true;

    async function loadConnections() {
      try {
        const savedConnections = await connectionService.listConnections();

        if (!isActive) {
          return;
        }

        setConnections(savedConnections);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSubmitError(
          error instanceof Error ? error.message : t("navigation.connections.load_error")
        );
      } finally {
        if (isActive) {
          setIsLoadingConnections(false);
        }
      }
    }

    void loadConnections();

    return () => {
      isActive = false;
    };
  }, [t]);

  useEffect(() => {
    if (connections.length === 0) {
      setSelectedView("home");
      setSelectedNodeId(null);
      return;
    }

    const selectedStillExists = selectedNodeId
      ? findNodeById(treeNodes, selectedNodeId) !== null
      : false;

    if (!selectedStillExists) {
      setSelectedView("home");
      setSelectedNodeId(null);
    }
  }, [connections, selectedNodeId, treeNodes]);

  useEffect(() => {
    setConnectionIndicators((previousIndicators) => {
      const nextIndicators: Record<string, ConnectionIndicator> = {};

      for (const connection of connections) {
        nextIndicators[connection.id] = previousIndicators[connection.id] ?? {
          status: "disconnected"
        };
      }

      return nextIndicators;
    });
  }, [connections]);

  useEffect(() => {
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds: Record<string, string> = {};

      for (const connection of connections) {
        const providerAccountId = previousProviderAccountIds[connection.id];

        if (providerAccountId) {
          nextProviderAccountIds[connection.id] = providerAccountId;
        }
      }

      return nextProviderAccountIds;
    });
  }, [connections]);

  useEffect(() => {
    setConnectionBuckets((previousConnectionBuckets) => {
      const nextConnectionBuckets: Record<string, ExplorerTreeNode[]> = {};

      for (const connection of connections) {
        if (previousConnectionBuckets[connection.id]) {
          nextConnectionBuckets[connection.id] = previousConnectionBuckets[connection.id];
        }
      }

      return nextConnectionBuckets;
    });
  }, [connections]);

  useEffect(() => {
    setCollapsedConnectionIds((previousCollapsedConnectionIds) => {
      const nextCollapsedConnectionIds: Record<string, boolean> = {};

      for (const connection of connections) {
        if (previousCollapsedConnectionIds[connection.id]) {
          nextCollapsedConnectionIds[connection.id] = true;
        }
      }

      return nextCollapsedConnectionIds;
    });
  }, [connections]);

  useEffect(() => {
    setBucketContentPaths((previousBucketContentPaths) => {
      const nextBucketContentPaths: Record<string, string> = {};

      for (const connectionId of Object.keys(previousBucketContentPaths)) {
        if (findNodeById(treeNodes, connectionId)) {
          nextBucketContentPaths[connectionId] = previousBucketContentPaths[connectionId];
        }
      }

      return nextBucketContentPaths;
    });
  }, [treeNodes]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const workspaceElement = workspaceRef.current;

      if (!workspaceElement) {
        return;
      }

      const workspaceRect = workspaceElement.getBoundingClientRect();
      const nextWidth = event.clientX - workspaceRect.left;
      const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, workspaceRect.width - MIN_CONTENT_WIDTH);
      const clampedWidth = Math.min(Math.max(nextWidth, MIN_SIDEBAR_WIDTH), maxWidth);

      setSidebarWidth(clampedWidth);
    }

    function handlePointerUp() {
      setIsResizingSidebar(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    return () => {
      connectionTestRequestIdRef.current += 1;
      contentRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setContentFilterText("");
    setContentStatusFilters([]);
    setContentAreaMenuAnchor(null);
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setIsCreateFolderModalOpen(false);
    setNewFolderName("");
    setCreateFolderError(null);
    setIsCreatingFolder(false);
  }, [selectedNodeId]);

  useEffect(() => {
    async function loadContentItems() {
      if (!selectedBucketId || !selectedBucketConnectionId || !selectedBucketName) {
        contentRequestIdRef.current += 1;
        setContentItems([]);
        setContentContinuationToken(null);
        setContentHasMore(false);
        setContentError(null);
        setContentActionError(null);
        setLoadMoreContentError(null);
        setIsLoadingContent(false);
        setIsLoadingMoreContent(false);
        return;
      }

      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;
      setIsLoadingContent(true);
      setIsLoadingMoreContent(false);
      setContentError(null);
      setContentActionError(null);
      setLoadMoreContentError(null);
      setContentContinuationToken(null);
      setContentHasMore(false);

      try {
        if (selectedBucketProvider !== "aws") {
          throw new Error(t("navigation.connection_status.unsupported_provider"));
        }

        const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);
        const result = await listAwsBucketItems(
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          selectedBucketName,
          selectedBucketPath || undefined,
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined,
          undefined,
          draft.restrictedBucketName
        );
        const nextItems = buildContentItems(result);

        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        setContentItems(
          applyDownloadedFileState(
            nextItems,
            downloadedFilePathSet,
            selectedBucketConnectionId,
            selectedBucketName,
            hasValidGlobalLocalCacheDirectory
          )
        );
        setContentContinuationToken(result.continuationToken ?? null);
        setContentHasMore(result.hasMore);
        setIsLoadingContent(false);
        setLoadMoreContentError(null);

        if (result.bucketRegion && result.bucketRegion !== selectedBucketRegion) {
          updateBucketNode(selectedBucketConnectionId, selectedBucketId, (node) => ({
            ...node,
            region: result.bucketRegion
          }));
        }
      } catch (error) {
        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        const message = extractErrorMessage(error) ?? t("content.list.load_error");
        setContentItems([]);
        setContentContinuationToken(null);
        setContentHasMore(false);
        setContentError(message);
        setLoadMoreContentError(null);
        setIsLoadingContent(false);
      }
    }

    void loadContentItems();
  }, [
    selectedBucketConnectionId,
    selectedBucketId,
    selectedBucketName,
    selectedBucketPath,
    selectedBucketProvider,
    selectedBucketRegion,
    contentRefreshNonce,
    t
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CONTENT_VIEW_MODE_STORAGE_KEY, contentViewMode);
  }, [contentViewMode]);

  useEffect(() => {
    let isActive = true;
    const normalizedPath = globalLocalCacheDirectory.trim();

    appSettingsStore.save({
      globalLocalCacheDirectory: normalizedPath || undefined
    });

    if (!normalizedPath) {
      setLocalMappingDirectoryStatus("missing");
      return undefined;
    }

    if (!isTauri()) {
      setLocalMappingDirectoryStatus("valid");
      return undefined;
    }

    setLocalMappingDirectoryStatus("checking");

    void (async () => {
      try {
        const isValidDirectory = await validateLocalMappingDirectory(normalizedPath);

        if (!isActive) {
          return;
        }

        setLocalMappingDirectoryStatus(isValidDirectory ? "valid" : "invalid");
      } catch {
        if (!isActive) {
          return;
        }

        setLocalMappingDirectoryStatus("invalid");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [globalLocalCacheDirectory]);

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingSidebar]);

  function resetForm() {
    resetConnectionTestState();
    setConnectionName("");
    setConnectionProvider("aws");
    setAccessKeyId("");
    setSecretAccessKey("");
    setRestrictedBucketName("");
    setConnectOnStartup(false);
    setDefaultAwsUploadStorageClass(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
    setFormErrors({});
    setSubmitError(null);
  }

  function handleResizeStart() {
    setIsResizingSidebar(true);
  }

  function openCreateModal() {
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
    setIsModalOpen(true);
  }

  async function openEditModal(connectionId: string) {
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      setSubmitError(t("navigation.modal.load_error"));
      return;
    }

    try {
      setSubmitError(null);
      setModalMode("edit");
      setEditingConnectionId(connectionId);
      setConnectionName(connection.name);
      setConnectionProvider(connection.provider);
      setAccessKeyId("");
      setSecretAccessKey("");
      setRestrictedBucketName(
        connection.provider === "aws" ? connection.restrictedBucketName ?? "" : ""
      );
      setConnectOnStartup(connection.connectOnStartup === true);
      setDefaultAwsUploadStorageClass(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
      resetConnectionTestState();
      setFormErrors({});
      setIsModalOpen(true);

      if (connection.provider !== "aws") {
        return;
      }

      const draft = await connectionService.getAwsConnectionDraft(connectionId);
      setAccessKeyId(draft.accessKeyId);
      setSecretAccessKey(draft.secretAccessKey);
      setRestrictedBucketName(draft.restrictedBucketName ?? "");
      setConnectOnStartup(draft.connectOnStartup === true);
      setDefaultAwsUploadStorageClass(
        normalizeAwsUploadStorageClass(draft.defaultUploadStorageClass)
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("navigation.modal.credentials_load_warning")
      );
    }
  }

  function getTransferCancelLabel(transferKind: TransferKind) {
    return transferKind === "upload"
      ? t("navigation.menu.cancel_upload")
      : t("navigation.menu.cancel_download");
  }

  function resetConnectionTestState() {
    connectionTestRequestIdRef.current += 1;
    setConnectionTestStatus("idle");
    setConnectionTestMessage(null);
  }

  function updateConnectionIndicator(connectionId: string, indicator: ConnectionIndicator) {
    setConnectionIndicators((previousIndicators) => ({
      ...previousIndicators,
      [connectionId]: indicator
    }));
  }

  function clearConnectionBuckets(connectionId: string) {
    setConnectionBuckets((previousConnectionBuckets) => {
      const nextConnectionBuckets = { ...previousConnectionBuckets };
      delete nextConnectionBuckets[connectionId];
      return nextConnectionBuckets;
    });
  }

  function navigateBucketPath(bucketNodeId: string, nextPath: string) {
    setBucketContentPaths((previousBucketContentPaths) => ({
      ...previousBucketContentPaths,
      [bucketNodeId]: nextPath
    }));
  }

  async function handleLoadMoreContent() {
    if (
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !contentContinuationToken ||
      isLoadingContent ||
      isLoadingMoreContent
    ) {
      return;
    }

    const requestId = contentRequestIdRef.current;
    setIsLoadingMoreContent(true);
    setLoadMoreContentError(null);

    try {
      if (selectedBucketProvider !== "aws") {
        throw new Error(t("navigation.connection_status.unsupported_provider"));
      }

      const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);
      const result = await listAwsBucketItems(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        selectedBucketName,
        selectedBucketPath || undefined,
        selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
          ? selectedBucketRegion
          : undefined,
        contentContinuationToken,
        draft.restrictedBucketName
      );
      const nextItems = buildContentItems(result);

      if (contentRequestIdRef.current !== requestId) {
        return;
      }

      setContentItems((previousItems) =>
        applyDownloadedFileState(
          mergeContentItems(previousItems, nextItems),
          downloadedFilePathSet,
          selectedBucketConnectionId,
          selectedBucketName,
          hasValidGlobalLocalCacheDirectory
        )
      );
      setContentContinuationToken(result.continuationToken ?? null);
      setContentHasMore(result.hasMore);
      setIsLoadingMoreContent(false);
      setLoadMoreContentError(null);

      if (result.bucketRegion && result.bucketRegion !== selectedBucketRegion && selectedBucketId) {
        updateBucketNode(selectedBucketConnectionId, selectedBucketId, (node) => ({
          ...node,
          region: result.bucketRegion
        }));
      }
    } catch (error) {
      if (contentRequestIdRef.current !== requestId) {
        return;
      }

      setLoadMoreContentError(extractErrorMessage(error) ?? t("content.list.load_error"));
      setIsLoadingMoreContent(false);
    }
  }

  async function handleRefreshCurrentView() {
    if (!selectedNode) {
      return;
    }

    if (selectedNode.kind === "connection") {
      if (selectedConnectionIndicator.status === "connected") {
        await connectConnection(selectedNode.id);
      }

      return;
    }

    if (isLoadingContent || isLoadingMoreContent) {
      return;
    }

    setContentRefreshNonce((currentValue) => currentValue + 1);
  }

  function updateBucketNode(
    connectionId: string,
    bucketNodeId: string,
    updater: (node: ExplorerTreeNode) => ExplorerTreeNode
  ) {
    setConnectionBuckets((previousConnectionBuckets) => ({
      ...previousConnectionBuckets,
      [connectionId]: (previousConnectionBuckets[connectionId] ?? []).map((bucket) =>
        bucket.id === bucketNodeId ? updater(bucket) : bucket
      )
    }));
  }

  async function hydrateBucketRegions(
    connectionId: string,
    requestId: number,
    accessKeyIdValue: string,
    secretAccessKeyValue: string,
    buckets: AwsBucketSummary[],
    restrictedBucketNameValue?: string
  ) {
    let nextBucketIndex = 0;

    async function worker() {
      while (nextBucketIndex < buckets.length) {
        const bucketIndex = nextBucketIndex;
        nextBucketIndex += 1;

        const bucket = buckets[bucketIndex];

        try {
          const region = await getAwsBucketRegion(
            accessKeyIdValue,
            secretAccessKeyValue,
            bucket.name,
            restrictedBucketNameValue
          );

          if (connectionRequestIdsRef.current[connectionId] !== requestId) {
            return;
          }

          updateBucketNode(connectionId, `${connectionId}:bucket:${bucket.name}`, (node) => ({
            ...node,
            region
          }));
        } catch {
          if (connectionRequestIdsRef.current[connectionId] !== requestId) {
            return;
          }
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_BUCKET_REGION_REQUESTS, buckets.length) }, () => worker())
    );
  }

  async function connectConnection(
    connectionId: string,
    connectionOverride?: SavedConnectionSummary
  ): Promise<void> {
    const connection =
      connectionOverride ?? connections.find((item) => item.id === connectionId);

    if (!connection) {
      return;
    }

    const requestId = (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    connectionRequestIdsRef.current[connectionId] = requestId;

    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "connecting" });

    if (connection.provider !== "aws") {
      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      updateConnectionIndicator(connectionId, {
        status: "error",
        message: t("navigation.connection_status.unsupported_provider")
      });
      return;
    }

    try {
      const draft = await connectionService.getAwsConnectionDraft(connectionId);
      const result = await testAwsConnection(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        draft.restrictedBucketName
      );

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      if (!result.accountId) {
        updateConnectionIndicator(connectionId, {
          status: "error",
          message: t("navigation.modal.aws.test_connection_failure")
        });
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) => ({
        ...previousProviderAccountIds,
        [connectionId]: result.accountId
      }));
      const buckets = await listAwsBuckets(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        draft.restrictedBucketName
      );

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionBuckets((previousConnectionBuckets) => ({
        ...previousConnectionBuckets,
        [connectionId]: buildBucketNodes(connection, buckets)
      }));

      void hydrateBucketRegions(
        connectionId,
        requestId,
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        buckets,
        draft.restrictedBucketName
      );

      updateConnectionIndicator(connectionId, { status: "connected" });
    } catch (error) {
      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) => {
        const nextProviderAccountIds = { ...previousProviderAccountIds };
        delete nextProviderAccountIds[connectionId];
        return nextProviderAccountIds;
      });
      updateConnectionIndicator(connectionId, {
        status: "error",
        message: buildConnectionFailureMessage(error, t)
      });
      clearConnectionBuckets(connectionId);
    }
  }

  async function disconnectConnection(connectionId: string) {
    connectionRequestIdsRef.current[connectionId] =
      (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "disconnected" });
  }

  async function cancelConnectionAttempt(connectionId: string) {
    connectionRequestIdsRef.current[connectionId] =
      (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "disconnected" });
  }

  function toggleConnectionCollapsed(connectionId: string) {
    setCollapsedConnectionIds((currentCollapsedConnectionIds) => ({
      ...currentCollapsedConnectionIds,
      [connectionId]: !currentCollapsedConnectionIds[connectionId]
    }));
  }

  function validateConnectionTestFields(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!accessKeyId.trim()) {
      nextErrors.accessKeyId = t("navigation.modal.validation.access_key_required");
    }

    if (!secretAccessKey.trim()) {
      nextErrors.secretAccessKey = t("navigation.modal.validation.secret_key_required");
    }

    if (
      restrictedBucketName.trim() &&
      !isRestrictedBucketNameFormatValid(restrictedBucketName.trim())
    ) {
      nextErrors.restrictedBucketName = t("navigation.modal.validation.restricted_bucket_invalid");
    }

    return nextErrors;
  }

  async function handleTestConnection() {
    const nextErrors = validateConnectionTestFields();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setConnectionTestStatus("error");
      setConnectionTestMessage(t("navigation.modal.aws.test_connection_validation_error"));
      return;
    }

    setConnectionTestStatus("testing");
    setConnectionTestMessage(t("navigation.modal.aws.test_connection_in_progress"));

    const requestId = connectionTestRequestIdRef.current + 1;
    connectionTestRequestIdRef.current = requestId;

    try {
      const result = await testAwsConnection(
        accessKeyId.trim(),
        secretAccessKey.trim(),
        restrictedBucketName.trim() || undefined
      );

      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      if (!result.accountId) {
        setConnectionTestStatus("error");
        setConnectionTestMessage(t("navigation.modal.aws.test_connection_failure"));
        return;
      }

      setConnectionTestStatus("success");
      setConnectionTestMessage(
        t("navigation.modal.aws.test_connection_success").replace(
          "{accountId}",
          result.accountId
        )
      );
    } catch (error) {
      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      setConnectionTestStatus("error");
      setConnectionTestMessage(buildConnectionFailureMessage(error, t));
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
  }

  function openUploadSettingsModal() {
    if (!selectedConnection || selectedConnection.provider !== "aws") {
      return;
    }

    setUploadSettingsStorageClass(
      normalizeAwsUploadStorageClass(selectedConnection.defaultUploadStorageClass)
    );
    setUploadSettingsSubmitError(null);
    setIsUploadSettingsModalOpen(true);
  }

  function closeUploadSettingsModal() {
    setIsUploadSettingsModalOpen(false);
    setUploadSettingsSubmitError(null);
    setIsSavingUploadSettings(false);
  }

  function openCreateFolderModal() {
    if (selectedNode?.kind !== "bucket" || selectedBucketProvider !== "aws") {
      return;
    }

    setContentAreaMenuAnchor(null);
    setNewFolderName("");
    setCreateFolderError(null);
    setIsCreatingFolder(false);
    setIsCreateFolderModalOpen(true);
  }

  function closeCreateFolderModal(force = false) {
    if (isCreatingFolder && !force) {
      return;
    }

    setIsCreateFolderModalOpen(false);
    setNewFolderName("");
    setCreateFolderError(null);
  }

  async function handleCreateFolder() {
    if (
      selectedNode?.kind !== "bucket" ||
      selectedBucketProvider !== "aws" ||
      !selectedBucketConnectionId ||
      !selectedBucketName
    ) {
      return;
    }

    const validationError = validateNewFolderNameInput(newFolderName, t);
    setCreateFolderError(validationError);

    if (validationError) {
      return;
    }

    setIsCreatingFolder(true);

    try {
      const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);

      await createAwsFolder(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        selectedBucketName,
        selectedBucketPath || undefined,
        newFolderName.trim(),
        selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
          ? selectedBucketRegion
          : undefined,
        draft.restrictedBucketName
      );

      setIsCreatingFolder(false);
      closeCreateFolderModal(true);
      await handleRefreshCurrentView();
    } catch (error) {
      setCreateFolderError(
        extractErrorMessage(error) ?? t("content.folder.create_failed")
      );
      setIsCreatingFolder(false);
      return;
    }
  }

  function handleOpenContentAreaContextMenu(event: React.MouseEvent<HTMLElement>) {
    if (!selectedNode) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (
      target?.closest(".content-list-item") ||
      target?.closest(".content-list-header") ||
      target?.closest(".tree-menu-popup")
    ) {
      return;
    }

    event.preventDefault();
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setContentAreaMenuAnchor({
      x: event.clientX,
      y: event.clientY
    });
  }

  async function handleContentAreaMenuAction(actionId: "createFolder" | "refresh") {
    setContentAreaMenuAnchor(null);

    if (actionId === "createFolder") {
      openCreateFolderModal();
      return;
    }

    await handleRefreshCurrentView();
  }

  function handleSelectHome() {
    setSelectedView("home");
    setSelectedNodeId(null);
    setOpenMenuConnectionId(null);
  }

  function handleSelectNode(node: ExplorerTreeNode) {
    if (node.kind === "bucket") {
      navigateBucketPath(node.id, "");
    }

    setSelectedView("node");
    setSelectedNodeId(node.id);
    setOpenMenuConnectionId(null);
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};
    const normalizedConnectionName = connectionName.trim();

    if (!normalizedConnectionName) {
      nextErrors.connectionName = t("navigation.modal.validation.connection_name_required");
    } else if (!isConnectionNameFormatValid(normalizedConnectionName)) {
      nextErrors.connectionName = t("navigation.modal.validation.connection_name_invalid").replace(
        "{max}",
        String(MAX_CONNECTION_NAME_LENGTH)
      );
    } else {
      const hasDuplicateName = connections.some(
        (connection) =>
          connection.id !== (modalMode === "edit" ? editingConnectionId : null) &&
          connection.name.trim().toLocaleLowerCase() === normalizedConnectionName.toLocaleLowerCase()
      );

      if (hasDuplicateName) {
        nextErrors.connectionName = t("navigation.modal.validation.connection_name_duplicate");
      }
    }

    if (connectionProvider === "aws") {
      if (!accessKeyId.trim()) {
        nextErrors.accessKeyId = t("navigation.modal.validation.access_key_required");
      }

      if (!secretAccessKey.trim()) {
        nextErrors.secretAccessKey = t("navigation.modal.validation.secret_key_required");
      }

      if (
        restrictedBucketName.trim() &&
        !isRestrictedBucketNameFormatValid(restrictedBucketName.trim())
      ) {
        nextErrors.restrictedBucketName = t("navigation.modal.validation.restricted_bucket_invalid");
      }
    }

    return nextErrors;
  }

  async function handleSaveConnection() {
    if (connectionProvider !== "aws") {
      return;
    }

    const nextErrors = validateForm();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedConnection = await connectionService.saveAwsConnection({
        id: modalMode === "edit" ? editingConnectionId ?? undefined : undefined,
        name: connectionName,
        provider: "aws",
        accessKeyId,
        secretAccessKey: secretAccessKey.trim(),
        restrictedBucketName,
        connectOnStartup,
        defaultUploadStorageClass: defaultAwsUploadStorageClass
      } satisfies AwsConnectionDraft);

      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
      setSelectedView("node");
      setSelectedNodeId(savedConnection.id);
      setOpenMenuConnectionId(null);
      closeModal();
      setIsSubmitting(false);
      void connectConnection(savedConnection.id, savedConnection);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.modal.save_error"));
      setIsSubmitting(false);
    }
  }

  async function handleSaveUploadSettings() {
    if (!selectedConnection || selectedConnection.provider !== "aws") {
      return;
    }

    setIsSavingUploadSettings(true);
    setUploadSettingsSubmitError(null);

    try {
      await connectionService.updateAwsUploadStorageClass(
        selectedConnection.id,
        uploadSettingsStorageClass
      );
      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
      closeUploadSettingsModal();
    } catch (error) {
      setUploadSettingsSubmitError(
        error instanceof Error ? error.message : t("navigation.modal.save_error")
      );
      setIsSavingUploadSettings(false);
    }
  }

  async function handleRemoveConnection(connectionId: string) {
    setPendingDeleteConnectionId(connectionId);
    setOpenMenuConnectionId(null);
  }

  async function confirmRemoveConnection() {
    if (!pendingDeleteConnectionId) {
      return;
    }

    try {
      const connectionId = pendingDeleteConnectionId;
      setPendingDeleteConnectionId(null);

      await connectionService.deleteConnection(connectionId);
      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.connections.delete_error"));
    }
  }

  async function handleConnectionAction(
    actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
    connectionId: string
  ) {
    if (actionId === "connect") {
      setOpenMenuConnectionId(null);
      await connectConnection(connectionId);
      return;
    }

    if (actionId === "cancelConnect") {
      await cancelConnectionAttempt(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    if (actionId === "disconnect") {
      await disconnectConnection(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    if (actionId === "edit") {
      await openEditModal(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    await handleRemoveConnection(connectionId);
  }

  async function handleDefaultConnectionAction(connectionId: string) {
    const indicator = connectionIndicators[connectionId] ?? { status: "disconnected" };

    if (indicator.status === "connecting") {
      return;
    }

    if (indicator.status === "connected") {
      await openEditModal(connectionId);
      return;
    }

    await connectConnection(connectionId);
  }

  return (
    <>
      <div
        ref={workspaceRef}
        className={`workspace-shell${isResizingSidebar ? " is-resizing" : ""}`}
        style={{
          gridTemplateColumns: `${sidebarWidth}px 12px minmax(0, 1fr)`
        }}
      >
        <aside className="sidebar-panel" aria-label={t("navigation.sidebar_aria_label")}>
          <div className="sidebar-header">
            <div>
              <p className="sidebar-eyebrow">{t("navigation.eyebrow")}</p>
              <h2 className="sidebar-title">{t("navigation.title")}</h2>
            </div>

            <div className="sidebar-actions">
              <button
                type="button"
                className={`icon-button icon-button-secondary${selectedView === "home" ? " is-active" : ""}`}
                aria-label={t("navigation.home")}
                title={t("navigation.home")}
                onClick={handleSelectHome}
              >
                <Settings size={18} strokeWidth={2} />
              </button>

              <button
                type="button"
                className="icon-button"
                aria-label={t("navigation.new_connection")}
                title={t("navigation.new_connection")}
                onClick={openCreateModal}
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="panel-filter">
            <label className="filter-field" htmlFor="sidebar-filter">
              <Search size={16} strokeWidth={2} className="filter-field-icon" />
              <input
                id="sidebar-filter"
                type="text"
                className="filter-field-input"
                value={sidebarFilterText}
                onChange={(event) => setSidebarFilterText(event.target.value)}
                placeholder={t("navigation.filter.placeholder")}
                aria-label={t("navigation.filter.label")}
              />
              {sidebarFilterText ? (
                <button
                  type="button"
                  className="filter-field-clear"
                  aria-label={t("common.clear")}
                  title={t("common.clear")}
                  onClick={() => setSidebarFilterText("")}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              ) : null}
            </label>
          </div>

          {connections.length === 0 && !isLoadingConnections ? (
            <div className="empty-tree-state">
              <p className="empty-tree-title">{t("navigation.empty.title")}</p>
              <p className="empty-tree-copy">{t("navigation.empty.description")}</p>
              <button type="button" className="primary-button" onClick={openCreateModal}>
                {t("navigation.empty.cta")}
              </button>
            </div>
          ) : (
            <div className="tree-panel">
              {filteredTreeNodes.length === 0 ? (
                <p className="panel-filter-empty">{t("navigation.filter.empty")}</p>
              ) : (
              <ul className="tree-root">
                {filteredTreeNodes.map((connection) => (
                  <li key={connection.id} className="tree-item">
                    <ConnectionTreeNodeItem
                      node={connection}
                      selectedNodeId={selectedNodeId}
                      connectionIndicators={connectionIndicators}
                      isCollapsed={collapsedConnectionIds[connection.id] === true}
                      shouldForceExpand={normalizedSidebarFilter.length > 0}
                      menuState={{
                        isOpen: openMenuConnectionId === connection.id,
                        onToggle: setOpenMenuConnectionId,
                        onAction: (actionId, connectionId) => {
                          void handleConnectionAction(actionId, connectionId);
                        }
                      }}
                      onSelect={handleSelectNode}
                      onToggleCollapsed={toggleConnectionCollapsed}
                      onConnectionDoubleClick={(connectionId) => {
                        void handleDefaultConnectionAction(connectionId);
                      }}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
              )}
            </div>
          )}
        </aside>

        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t("navigation.sidebar_aria_label")}
          onPointerDown={handleResizeStart}
        >
          <span className="sidebar-resizer-handle" aria-hidden="true" />
        </div>

        <section
          ref={contentDropZoneRef}
          className={`content-panel${selectedView === "home" ? " content-panel-home" : ""}${
            isUploadDropTargetActive ? " is-upload-drop-active" : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (
              selectedNode?.kind === "bucket" &&
              selectedBucketConnectionId &&
              selectedBucketName &&
              selectedBucketProvider === "aws"
            ) {
              setIsUploadDropTargetActive(true);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (
              selectedNode?.kind === "bucket" &&
              selectedBucketConnectionId &&
              selectedBucketName &&
              selectedBucketProvider === "aws"
            ) {
              setIsUploadDropTargetActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (
              contentDropZoneRef.current &&
              !contentDropZoneRef.current.contains(event.relatedTarget as Node | null)
            ) {
              setIsUploadDropTargetActive(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsUploadDropTargetActive(false);

            if (
              selectedNode?.kind !== "bucket" ||
              !selectedBucketConnectionId ||
              !selectedBucketName ||
              selectedBucketProvider !== "aws"
            ) {
              return;
            }

            const droppedFiles = extractDroppedFiles(event);
            const nativeFallbackPaths = nativeDragDropPathsRef.current;

            nativeDragDropPathsRef.current = [];

            if (droppedFiles.length > 0) {
              runSimpleDroppedFileUploads(droppedFiles);
              return;
            }

            if (nativeFallbackPaths.length > 0) {
              runSimpleAwsUploads(nativeFallbackPaths);
              return;
            }
          }}
        >
          {selectedView === "home" ? null : (
            <div className="content-toolbar">
              <div className="content-toolbar-copy">
                <p className="content-eyebrow">{t("content.eyebrow")}</p>
                <h1 className="content-title">
                  {displayedContentTitle}
                </h1>

                {selectedNode?.kind === "bucket" ? (
                  <nav
                    className="content-breadcrumb"
                    aria-label={t("content.breadcrumb.aria_label")}
                  >
                    {selectedBreadcrumbs.map((breadcrumb, index) => {
                      const isCurrent = index === selectedBreadcrumbs.length - 1;

                      return (
                        <span
                          key={`${breadcrumb.path}:${index}`}
                          className="content-breadcrumb-item"
                        >
                          {index > 0 ? (
                            <ChevronRight
                              size={14}
                              strokeWidth={2}
                              className="content-breadcrumb-separator"
                            />
                          ) : null}

                          {isCurrent ? (
                            <span className="content-breadcrumb-current">
                              {breadcrumb.label}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="content-breadcrumb-link"
                              onClick={() => {
                                if (breadcrumb.path === null) {
                                  const connectionNode = treeNodes.find(
                                    (node) => node.id === selectedNode.connectionId
                                  );

                                  if (connectionNode) {
                                    handleSelectNode(connectionNode);
                                  }

                                  return;
                                }

                                navigateBucketPath(selectedNode.id, breadcrumb.path);
                              }}
                            >
                              {breadcrumb.label}
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </nav>
                ) : null}
              </div>

              {selectedConnection ? (
                <div className="content-toolbar-side">
                  <div className="content-toolbar-status">
                    <ConnectionStatusIcon
                      indicator={
                        connectionIndicators[selectedConnection.id] ?? { status: "disconnected" }
                      }
                      connectingTitle={t(CONNECTING_CONNECTION_TITLE_KEY)}
                      connectedTitle={t(CONNECTED_CONNECTION_TITLE_KEY)}
                      disconnectedTitle={t(DISCONNECTED_CONNECTION_TITLE_KEY)}
                      size={22}
                    />
                    <span>
                      {getConnectionStatusLabel(
                        connectionIndicators[selectedConnection.id] ?? { status: "disconnected" },
                        t
                      )}
                    </span>
                  </div>

                  {selectedNode && (selectedNode.kind === "bucket" || selectedNode.kind === "connection") ? (
                    <div className="content-toolbar-controls">
                      <label className="filter-field content-toolbar-filter" htmlFor="content-filter">
                        <Search size={16} strokeWidth={2} className="filter-field-icon" />
                        <input
                          id="content-filter"
                          type="text"
                          className="filter-field-input"
                          value={contentFilterText}
                          onChange={(event) => setContentFilterText(event.target.value)}
                          placeholder={t(
                            selectedNode.kind === "connection"
                              ? "content.filter.placeholder_buckets"
                              : "content.filter.placeholder"
                          )}
                          aria-label={t("content.filter.label")}
                        />
                        {contentFilterText ? (
                          <button
                            type="button"
                            className="filter-field-clear"
                            aria-label={t("common.clear")}
                            title={t("common.clear")}
                            onClick={() => setContentFilterText("")}
                          >
                            <X size={14} strokeWidth={2.2} />
                          </button>
                        ) : null}
                      </label>

                      {selectedNode.kind === "bucket" ? (
                        <div
                          className="content-status-filter-group"
                          role="group"
                          aria-label={t("content.filter.status_label")}
                        >
                          {ALL_CONTENT_STATUS_FILTERS.map((status) => {
                            const isSelected = contentStatusFilters.includes(status);
                            const label = t(`content.filter.status.${status}`);

                            return (
                              <button
                                key={status}
                                type="button"
                                className={`content-status-filter-button${
                                  isSelected ? " is-selected" : ""
                                }`}
                                aria-pressed={isSelected}
                                title={label}
                                onClick={() => toggleContentStatusFilter(status)}
                              >
                                <ContentCounterStatus
                                  status={status}
                                  label={label}
                                  count={0}
                                  hideCount
                                />
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {canCreateFolderInCurrentContext ? (
                        <>
                          <span className="content-toolbar-divider" aria-hidden="true" />
                          <button
                            type="button"
                            className="content-load-more-button content-toolbar-action-button"
                            onClick={openCreateFolderModal}
                            disabled={isLoadingContent || isLoadingMoreContent}
                            title={t("content.folder.create_button")}
                          >
                            <Plus size={15} strokeWidth={2} />
                            <span>{t("content.folder.create_button")}</span>
                          </button>
                        </>
                      ) : null}

                      <span className="content-toolbar-divider" aria-hidden="true" />

                      {selectedNode.kind === "bucket" ? (
                        <>
                          <button
                            type="button"
                            className="content-load-more-button content-toolbar-action-button"
                            onClick={handlePickUploadFile}
                            disabled={!isTauri() || isLoadingContent || isLoadingMoreContent}
                            title={t("content.transfer.upload_button")}
                          >
                            <Upload size={15} strokeWidth={2} />
                            <span>{t("content.transfer.upload_button")}</span>
                          </button>

                          {selectedBucketProvider === "aws" ? (
                            <button
                              type="button"
                              className="content-load-more-button content-load-more-button-icon"
                              onClick={openUploadSettingsModal}
                              title={t("content.transfer.upload_settings_button")}
                              aria-label={t("content.transfer.upload_settings_button")}
                            >
                              <Settings size={15} strokeWidth={2} />
                            </button>
                          ) : null}

                          <span className="content-toolbar-divider" aria-hidden="true" />
                        </>
                      ) : null}

                      <div
                        className="content-view-switcher"
                        role="group"
                        aria-label={t("content.view_mode.label")}
                      >
                        <button
                          type="button"
                          className={`content-view-button${contentViewMode === "list" ? " is-active" : ""}`}
                          aria-label={t("content.view_mode.list")}
                          title={t("content.view_mode.list")}
                          onClick={() => setContentViewMode("list")}
                        >
                          <List size={16} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          className={`content-view-button${contentViewMode === "compact" ? " is-active" : ""}`}
                          aria-label={t("content.view_mode.compact")}
                          title={t("content.view_mode.compact")}
                          onClick={() => setContentViewMode("compact")}
                        >
                          <LayoutGrid size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                      ) : null}
                </div>
              ) : null}
            </div>
          )}

          <div className="content-panel-scroll-viewport">
          <div className="content-panel-body">
          {selectedView === "home" ? (
            <div className="home-card">
              <div className="home-header">
                <div className="home-brand">
                  <img src={logoPrimary} alt="" className="home-logo" />

                  <div>
                    <h2 className="home-title">{t("app.title")}</h2>
                    <p className="eyebrow home-eyebrow">{t("hero.eyebrow")}</p>
                  </div>
                </div>

                <label
                  className="field-group compact-field-group home-locale-field"
                  htmlFor={localeFieldId}
                >
                  <span>{t("settings.language")}</span>
                  <select
                    id={localeFieldId}
                    aria-label={t("settings.language")}
                    value={locale}
                    onChange={(event) => {
                      void onLocaleChange(event.target.value);
                    }}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="pt-BR">Portuguese (Brazil)</option>
                  </select>
                </label>
              </div>

              <p className="content-description">{t("hero.subtitle")}</p>

              <label className="field-group" htmlFor={globalCacheDirectoryFieldId}>
                <span>{t("settings.download_directory")}</span>
                <div className="path-picker-row">
                  <input
                    id={globalCacheDirectoryFieldId}
                    type="text"
                    value={globalLocalCacheDirectory}
                    placeholder={t("settings.download_directory_placeholder")}
                    readOnly
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handlePickGlobalCacheDirectory}
                    disabled={!isTauri()}
                  >
                    {t("settings.download_directory_pick")}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setGlobalLocalCacheDirectory("")}
                    disabled={!globalLocalCacheDirectory.trim()}
                  >
                    {t("common.clear")}
                  </button>
                </div>
                <span className="field-helper">{t("settings.download_directory_helper")}</span>
                {localMappingDirectoryAlertKey ? (
                  <div className="content-toolbar-notice" role="alert">
                    <CircleAlert size={16} strokeWidth={2} />
                    <p>{t(localMappingDirectoryAlertKey)}</p>
                  </div>
                ) : null}
              </label>

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          ) : selectedNode ? (
            <div className="content-card">
              {selectedNode.kind === "connection" ? (
                <>
                  <div
                    className="content-list-section"
                    onContextMenu={handleOpenContentAreaContextMenu}
                  >
                    {selectedConnectionIndicator.status === "connecting" ? (
                      <p className="content-list-state">{t("content.list.loading_containers")}</p>
                    ) : selectedConnectionIndicator.status === "error" ? (
                      <div className="content-empty connection-empty-state">
                        <p className="status-message-error">
                          {selectedConnectionIndicator.message ??
                            t("navigation.connection_status.error")}
                        </p>
                        <p className="content-list-state">{t("content.list.connect_to_load")}</p>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            void handleConnectionAction("connect", selectedNode.id);
                          }}
                        >
                          {t("navigation.menu.connect")}
                        </button>
                      </div>
                    ) : selectedConnectionIndicator.status !== "connected" ? (
                      <div className="content-empty connection-empty-state">
                        <p className="content-list-state">{t("content.list.connect_to_load")}</p>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            void handleConnectionAction("connect", selectedNode.id);
                          }}
                        >
                          {t("navigation.menu.connect")}
                        </button>
                      </div>
                    ) : (connectionBuckets[selectedNode.id] ?? []).length === 0 ? (
                      <p className="content-list-state">{t("content.list.empty_connection")}</p>
                    ) : filteredConnectionBuckets.length === 0 ? (
                      <p className="content-list-state">{t("content.filter.empty")}</p>
                    ) : (
                      <>
                        {shouldRenderListHeaders ? (
                          <div className="content-list-header content-list-header-buckets" aria-hidden="true">
                            <span>{t("navigation.modal.name_label")}</span>
                            <span>{t("content.detail.region")}</span>
                            <span>{t("content.detail.type")}</span>
                          </div>
                        ) : null}

                        <div
                          className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}
                        >
                          {filteredConnectionBuckets.map((bucketNode) => (
                            <button
                              key={bucketNode.id}
                              type="button"
                              className={`content-list-item content-list-item-action content-list-item-bucket${contentViewMode === "compact" ? " is-compact" : ""}`}
                              onClick={() => handleSelectNode(bucketNode)}
                            >
                              <span className="content-list-item-main">
                                <span className="content-list-item-icon content-list-item-icon-bucket">
                                  <Database size={18} strokeWidth={1.9} />
                                </span>
                                <span className="content-list-item-copy">
                                  <strong>{bucketNode.name}</strong>
                                  {contentViewMode === "compact" ? (
                                    <span>{bucketNode.region ?? BUCKET_REGION_PLACEHOLDER}</span>
                                  ) : null}
                                </span>
                              </span>

                              {contentViewMode === "compact" ? (
                                <span className="content-list-item-meta is-compact">
                                  <ChevronRight size={16} strokeWidth={2} />
                                </span>
                              ) : (
                                <>
                                  <span className="content-list-item-column">
                                    {bucketNode.region ?? BUCKET_REGION_PLACEHOLDER}
                                  </span>
                                  <span className="content-list-item-column content-list-item-column-end">
                                    {t("content.type.container")}
                                  </span>
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className="content-list-section"
                  onContextMenu={handleOpenContentAreaContextMenu}
                >
                  {localMappingDirectoryAlertKey ? (
                    <div className="content-toolbar-notice" role="alert">
                      <CircleAlert size={16} strokeWidth={2} />
                      <p>{t(localMappingDirectoryAlertKey)}</p>
                    </div>
                  ) : null}
                  {isLoadingContent ? (
                    <p className="content-list-state">{t("content.list.loading")}</p>
                  ) : contentError ? (
                    <p className="status-message-error">{contentError}</p>
                  ) : contentItems.length === 0 ? (
                    <p className="content-list-state">
                      {selectedBucketPath
                        ? t("content.list.empty_directory")
                        : t("content.list.empty_container")}
                    </p>
                  ) : filteredContentItems.length === 0 ? (
                    <p className="content-list-state">{t("content.filter.empty")}</p>
                  ) : (
                    <>
                      {shouldRenderListHeaders ? (
                        <div className="content-list-header content-list-header-files" aria-hidden="true">
                          <span>{t("navigation.modal.name_label")}</span>
                          <span>{t("content.detail.storage_class")}</span>
                          <span>{t("content.detail.type")}</span>
                          <span>{t("content.detail.size")}</span>
                          <span>{t("content.detail.last_modified")}</span>
                          <span />
                        </div>
                      ) : null}

                      <div
                        className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}
                      >
                        {filteredContentItems.map((item) =>
                          item.kind === "directory" ? (
                            <button
                              key={item.id}
                              type="button"
                              className={`content-list-item content-list-item-action content-list-item-file-row${contentViewMode === "compact" ? " is-compact" : ""}`}
                              onClick={() => navigateBucketPath(selectedNode.id, item.path)}
                            >
                              <span className="content-list-item-main">
                                <span className="content-list-item-icon content-list-item-icon-directory">
                                  <Folder size={18} strokeWidth={1.9} />
                                </span>
                                <span className="content-list-item-copy content-list-item-copy-directory">
                                  <strong>{item.name}</strong>
                                </span>
                              </span>

                              {contentViewMode === "compact" ? (
                                <span className="content-list-item-meta is-compact">
                                  <ChevronRight size={16} strokeWidth={2} />
                                </span>
                              ) : (
                                <>
                                  <span className="content-list-item-column">-</span>
                                  <span className="content-list-item-column">
                                    {t("content.type.directory")}
                                  </span>
                                  <span className="content-list-item-column">-</span>
                                  <span className="content-list-item-column content-list-item-column-end">-</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div
                              key={item.id}
                              className={`content-list-item content-list-item-action content-list-item-file-row${contentViewMode === "compact" ? " is-compact" : ""}`}
                              onClick={(event) => {
                                const nextIsOpen = openContentMenuItemId !== item.id;
                                setOpenContentMenuItemId(nextIsOpen ? item.id : null);
                                setContentMenuAnchor(
                                  nextIsOpen
                                    ? {
                                        itemId: item.id,
                                        x: event.clientX,
                                        y: event.clientY
                                      }
                                    : null
                                );
                              }}
                            >
                              <span className="content-list-item-main">
                                {contentViewMode === "compact" ? (
                                  <span className="content-list-item-topline">
                                    <span className="content-list-item-icon content-list-item-icon-file">
                                      <File size={18} strokeWidth={1.9} />
                                    </span>
                                    {item.availabilityStatus && item.downloadState ? (
                                      <CompactFileStatusIcons
                                        item={item}
                                        locale={locale}
                                        t={t}
                                      />
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="content-list-item-icon content-list-item-icon-file">
                                    <File size={18} strokeWidth={1.9} />
                                  </span>
                                )}
                                <span className="content-list-item-copy content-list-item-copy-file">
                                  <strong>{item.name}</strong>
                                  {item.availabilityStatus && item.downloadState ? (
                                    contentViewMode === "compact" ? null : (
                                      <span className="content-file-status-row">
                                        {getFileStatusBadgeDescriptors(item, locale, t).map(
                                          (descriptor, index) => (
                                            <FileStatusBadge
                                              key={`${descriptor.status}-${index}`}
                                              label={descriptor.label}
                                              status={descriptor.status}
                                              title={descriptor.title}
                                            />
                                          )
                                        )}
                                      </span>
                                    )
                                  ) : null}
                                  {selectedBucketConnectionId && selectedBucketName ? (
                                    (() => {
                                      const fileIdentity = buildFileIdentity(
                                        selectedBucketConnectionId,
                                        selectedBucketName,
                                        item.path
                                      );
                                      const activeDownload =
                                        activeTrackedDownloadIdentityMap.get(fileIdentity);

                                      return activeDownload ? (
                                        <span className="content-file-download-progress">
                                          <span className="content-file-download-progress-copy">
                                            {Math.max(
                                              0,
                                              Math.min(
                                                100,
                                                Math.round(activeDownload.progressPercent)
                                              )
                                            )}
                                            %
                                          </span>
                                          <span className="content-file-download-progress-track">
                                            <span
                                              className="content-file-download-progress-bar"
                                              style={{
                                                width: `${Math.max(
                                                  4,
                                                  Math.min(
                                                    100,
                                                    activeDownload.progressPercent || 4
                                                  )
                                                )}%`
                                              }}
                                            />
                                          </span>
                                        </span>
                                      ) : null;
                                    })()
                                  ) : null}
                                  {contentViewMode === "compact" && item.storageClass ? (
                                    <span>{item.storageClass}</span>
                                  ) : null}
                                </span>
                              </span>

                              {contentViewMode === "compact" ? null : (
                                <>
                                  <span className="content-list-item-column">
                                    {item.storageClass ?? "-"}
                                  </span>
                                  <span className="content-list-item-column">
                                    {t("content.type.file")}
                                  </span>
                                  <span className="content-list-item-column">
                                    {formatBytes(item.size, locale)}
                                  </span>
                                  <span className="content-list-item-column content-list-item-column-end">
                                    {formatDateTime(item.lastModified, locale)}
                                  </span>
                                </>
                              )}

                              <span className="content-list-item-actions">
                                <ContentItemMenu
                                  item={item}
                                  canRestore={
                                    selectedBucketProvider === "aws" &&
                                    item.availabilityStatus === "archived"
                                  }
                                  canDownload={
                                    hasValidGlobalLocalCacheDirectory &&
                                    item.availabilityStatus === "available" &&
                                    item.downloadState !== "downloaded" &&
                                    !(
                                      selectedBucketConnectionId &&
                                      selectedBucketName &&
                                      activeTransferIdentityMap.has(
                                        buildFileIdentity(
                                          selectedBucketConnectionId,
                                          selectedBucketName,
                                          item.path
                                        )
                                      )
                                    )
                                  }
                                  canDownloadAs={
                                    item.availabilityStatus === "available" &&
                                    !(
                                      selectedBucketConnectionId &&
                                      selectedBucketName &&
                                      activeTransferIdentityMap.has(
                                        buildFileIdentity(
                                          selectedBucketConnectionId,
                                          selectedBucketName,
                                          item.path
                                        )
                                      )
                                    ) &&
                                    !activeDirectDownloadItemIds.includes(item.id)
                                  }
                                  canCancelDownload={
                                    selectedBucketConnectionId &&
                                    selectedBucketName
                                      ? activeTransferIdentityMap.has(
                                          buildFileIdentity(
                                            selectedBucketConnectionId,
                                            selectedBucketName,
                                            item.path
                                          )
                                        )
                                      : false
                                  }
                                  canOpenFile={
                                    hasValidGlobalLocalCacheDirectory &&
                                    item.downloadState === "downloaded"
                                  }
                                  canOpenInExplorer={
                                    hasValidGlobalLocalCacheDirectory &&
                                    item.downloadState === "downloaded"
                                  }
                                  isOpen={openContentMenuItemId === item.id}
                                  showTrigger={contentViewMode !== "compact"}
                                  anchorPosition={
                                    contentMenuAnchor?.itemId === item.id
                                      ? { x: contentMenuAnchor.x, y: contentMenuAnchor.y }
                                      : null
                                  }
                                  onToggle={(itemId, anchorPosition) => {
                                    setOpenContentMenuItemId(itemId);
                                    setContentMenuAnchor(
                                      itemId && anchorPosition
                                        ? { itemId, x: anchorPosition.x, y: anchorPosition.y }
                                        : null
                                    );
                                  }}
                                  onAction={handlePreviewFileAction}
                                  t={t}
                                />
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {contentAreaMenuAnchor ? (
                <ContentAreaContextMenu
                  canCreateFolder={canCreateFolderInCurrentContext}
                  anchorPosition={contentAreaMenuAnchor}
                  onAction={handleContentAreaMenuAction}
                  onClose={() => setContentAreaMenuAnchor(null)}
                  t={t}
                />
              ) : null}

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          ) : (
            <div className="content-card content-empty">
              <p className="content-description">{t("content.empty.description")}</p>
            </div>
          )}
          </div>
          </div>

          {selectedView === "home" || !selectedNode ? null : (
            <div className="content-panel-footer">
              <div className="content-panel-footer-transfers">
                <button
                  type="button"
                  className={`transfer-status-button${isDownloadTransferActive ? " is-active is-blinking" : ""}`}
                  onClick={() => {
                    if (isDownloadTransferActive) {
                      setIsTransferModalOpen(true);
                    }
                  }}
                  title={
                    isDownloadTransferActive
                      ? t("content.transfer.download_active").replace(
                          "{count}",
                          String(activeDownloadPreviewCount)
                        )
                      : t("content.transfer.download_inactive")
                  }
                >
                  <Download size={16} strokeWidth={2} />
                  <span>{t("content.transfer.download_label")}</span>
                  <strong>{activeDownloadPreviewCount}</strong>
                </button>

                <button
                  type="button"
                  className={`transfer-status-button${isUploadTransferActive ? " is-active is-blinking" : ""}`}
                  onClick={() => {
                    if (isUploadTransferActive) {
                      setIsTransferModalOpen(true);
                    }
                  }}
                  title={
                    isUploadTransferActive
                      ? t("content.transfer.upload_active").replace(
                          "{count}",
                          String(activeUploadPreviewCount)
                        )
                      : t("content.transfer.upload_inactive")
                  }
                >
                  <Upload size={16} strokeWidth={2} />
                  <span>{t("content.transfer.upload_label")}</span>
                  <strong>{activeUploadPreviewCount}</strong>
                </button>

              </div>

              <div className="content-panel-footer-meta">
                {selectedNode.kind === "connection" &&
                selectedConnectionIndicator.status !== "connected" ? null : (
                  <>
                  <p className="content-list-counter">
                    {contentCounterLabel}
                    {contentStatusSummaryItems.length > 0 ? (
                      <span className="content-list-counter-detail" aria-label={t("content.filter.status_label")}>
                        {" ("}
                        {contentStatusSummaryItems.map((statusItem) => (
                          <ContentCounterStatus
                            key={statusItem.key}
                            status={statusItem.key}
                            label={statusItem.label}
                            count={statusItem.count}
                          />
                        ))}
                        {")"}
                      </span>
                    ) : null}
                  </p>
                  {shouldRenderLoadMoreButton ? (
                    <button
                      type="button"
                      className="content-load-more-button"
                      onClick={() => void handleLoadMoreContent()}
                      disabled={
                        !contentHasMore ||
                        isLoadingContent ||
                        isLoadingMoreContent
                      }
                    >
                      {isLoadingMoreContent
                        ? t("content.list.loading_more")
                        : t("content.list.load_more")}
                    </button>
                  ) : null}
                  {loadMoreContentError ? (
                    <p className="status-message-error">{loadMoreContentError}</p>
                  ) : null}
                  <button
                    type="button"
                    className="content-load-more-button"
                    onClick={() => void handleRefreshCurrentView()}
                    disabled={
                      selectedNode.kind === "connection"
                        ? selectedConnectionIndicator.status === "connecting"
                        : isLoadingContent || isLoadingMoreContent
                    }
                    title={t("content.list.refresh")}
                  >
                    <RefreshCw size={15} strokeWidth={2} />
                    <span>{t("content.list.refresh")}</span>
                  </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {restoreRequest ? (
        <RestoreRequestModal
          locale={locale}
          request={restoreRequest}
          isSubmitting={isSubmittingRestoreRequest}
          submitError={restoreSubmitError}
          onCancel={closeRestoreRequestModal}
          onSubmitAwsRequest={handleSubmitAwsRestoreRequest}
          t={t}
        />
      ) : null}

      {isTransferModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-summary-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.modal_eyebrow")}</p>
                <h2 id="transfer-summary-modal-title" className="modal-title">
                  {t("content.transfer.modal_title")}
                </h2>
              </div>
            </div>

            <div className="transfer-modal-list">
              {activeTransferList.length === 0 ? (
                <p className="modal-copy">{t("content.transfer.modal_empty")}</p>
              ) : (
                activeTransferList.map((download) => (
                  <article key={download.operationId} className="transfer-modal-item">
                    <div className="transfer-modal-item-header">
                      <strong>{download.fileName}</strong>
                      <span>{Math.max(0, Math.min(100, Math.round(download.progressPercent)))}%</span>
                    </div>
                    <p className="transfer-modal-item-copy">
                      {download.transferKind === "direct"
                        ? t("content.transfer.direct_download_label")
                        : download.transferKind === "upload"
                        ? t("content.transfer.simple_upload_label")
                        : t("content.transfer.tracked_download_label")}
                      {" · "}
                      {download.bucketName}
                    </p>
                    {download.transferKind === "direct" && download.targetPath ? (
                      <p className="transfer-modal-item-copy transfer-modal-item-copy-secondary">
                        {download.targetPath}
                      </p>
                    ) : null}
                    {download.transferKind === "upload" && download.objectKey ? (
                      <p className="transfer-modal-item-copy transfer-modal-item-copy-secondary">
                        {download.objectKey}
                      </p>
                    ) : null}
                    <div className="transfer-progress">
                      <span
                        className="transfer-progress-bar"
                        style={{
                          width: `${Math.max(4, Math.min(100, download.progressPercent || 4))}%`
                        }}
                      />
                    </div>
                    <p className="transfer-modal-item-meta">
                      {formatBytes(download.bytesTransferred, locale)} /{" "}
                      {download.totalBytes > 0
                        ? formatBytes(download.totalBytes, locale)
                        : t("content.transfer.size_unknown")}
                    </p>
                    <div className="transfer-modal-item-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          handleCancelActiveTransfer(download.operationId, download.transferKind)
                        }
                      >
                        {getTransferCancelLabel(download.transferKind)}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsTransferModalOpen(false)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}


      {completionToast ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          <article
            className={`toast-card${completionToast.tone === "error" ? " is-error" : ""}`}
          >
            <div className="toast-card-copy">
              <strong>{completionToast.title}</strong>
              <p>{completionToast.description}</p>
            </div>
            <button
              type="button"
              className="toast-card-close"
              onClick={() => setCompletionToast(null)}
              aria-label={t("common.close")}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </article>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className={`modal-card${connectionProvider === "aws" ? " modal-card-wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">
                  {modalMode === "edit"
                    ? t("navigation.modal.edit_eyebrow")
                    : t("navigation.modal.eyebrow")}
                </p>
                <h2 id="connection-modal-title" className="modal-title">
                  {modalMode === "edit"
                    ? t("navigation.modal.edit_title")
                    : t("navigation.modal.title")}
                </h2>
              </div>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveConnection();
              }}
            >
              <div className="modal-scroll-panel">
                <div className="modal-scroll-viewport">
                  <label className="field-group" htmlFor={nameFieldId}>
                    <span>{t("navigation.modal.name_label")}</span>
                    <input
                      id={nameFieldId}
                      type="text"
                      value={connectionName}
                      placeholder={t("navigation.modal.name_placeholder")}
                      onChange={(event) => {
                        setConnectionName(event.target.value);
                        resetConnectionTestState();
                      }}
                      autoFocus
                    />
                    {formErrors.connectionName ? (
                      <span className="field-error">{formErrors.connectionName}</span>
                    ) : null}
                  </label>

                  <label className="field-group" htmlFor={providerFieldId}>
                    <span>{t("navigation.modal.type_label")}</span>
                    <select
                      id={providerFieldId}
                      value={connectionProvider}
                      onChange={(event) => {
                        setConnectionProvider(event.target.value as ConnectionProvider);
                        resetConnectionTestState();
                      }}
                    >
                      <option value="aws">{t("content.provider.aws")}</option>
                      <option value="azure">{t("content.provider.azure")}</option>
                    </select>
                  </label>

                  {connectionProvider === "aws" ? (
                    <AwsConnectionFields
                      locale={locale}
                      accessKeyFieldId={accessKeyFieldId}
                      secretKeyFieldId={secretKeyFieldId}
                      restrictedBucketNameFieldId={restrictedBucketNameFieldId}
                      connectOnStartupFieldId={connectOnStartupFieldId}
                      accessKeyId={accessKeyId}
                      secretAccessKey={secretAccessKey}
                      restrictedBucketName={restrictedBucketName}
                      connectOnStartup={connectOnStartup}
                      defaultUploadStorageClass={defaultAwsUploadStorageClass}
                      errors={{
                        accessKeyId: formErrors.accessKeyId,
                        secretAccessKey: formErrors.secretAccessKey,
                        restrictedBucketName: formErrors.restrictedBucketName
                      }}
                      onAccessKeyIdChange={(value) => {
                        setAccessKeyId(value);
                        resetConnectionTestState();
                      }}
                      onSecretAccessKeyChange={(value) => {
                        setSecretAccessKey(value);
                        resetConnectionTestState();
                      }}
                      onRestrictedBucketNameChange={(value) => {
                        setRestrictedBucketName(value);
                        resetConnectionTestState();
                      }}
                      onConnectOnStartupChange={setConnectOnStartup}
                      onDefaultUploadStorageClassChange={setDefaultAwsUploadStorageClass}
                      t={t}
                    />
                  ) : (
                    <AzureConnectionPlaceholder t={t} />
                  )}

                  {submitError ? <p className="status-message-error">{submitError}</p> : null}
                </div>
              </div>

              <div className="connection-modal-footer">
                {connectionProvider === "aws" ? (
                  <div className="connection-test-footer">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSubmitting || connectionTestStatus === "testing"}
                      onClick={handleTestConnection}
                      title={t("navigation.modal.aws.test_connection_helper")}
                    >
                      {t("navigation.modal.aws.test_connection_button")}
                    </button>

                    {connectionTestStatus !== "idle" ? (
                      <span
                        className={`connection-test-status-icon is-${connectionTestStatus}`}
                        title={`${t(`navigation.modal.aws.test_connection_status.${connectionTestStatus}`)}${
                          connectionTestMessage ? `: ${connectionTestMessage}` : ""
                        }`}
                        aria-label={`${t(`navigation.modal.aws.test_connection_status.${connectionTestStatus}`)}${
                          connectionTestMessage ? `: ${connectionTestMessage}` : ""
                        }`}
                      >
                        {connectionTestStatus === "success" ? (
                          <CheckCircle2 size={16} strokeWidth={2} />
                        ) : connectionTestStatus === "error" ? (
                          <XCircle size={16} strokeWidth={2} />
                        ) : connectionTestStatus === "testing" ? (
                          <LoaderCircle
                            size={16}
                            strokeWidth={2}
                            className="connection-test-spinner"
                          />
                        ) : (
                          <AlertCircle size={16} strokeWidth={2} />
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div />
                )}

                <div className="modal-actions modal-actions-inline">
                  <button type="button" className="secondary-button" onClick={closeModal}>
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmitting || connectionProvider !== "aws"}
                  >
                    {modalMode === "edit" ? t("common.update") : t("common.save")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUploadSettingsModalOpen && selectedConnection?.provider === "aws" ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-settings-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.upload_settings_eyebrow")}</p>
                <h2 id="upload-settings-modal-title" className="modal-title">
                  {t("content.transfer.upload_settings_title").replace(
                    "{name}",
                    selectedConnection.name
                  )}
                </h2>
              </div>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveUploadSettings();
              }}
            >
              <div className="modal-scroll-panel">
                <div className="modal-scroll-viewport">
                  <AwsUploadStorageClassField
                    locale={locale}
                    value={uploadSettingsStorageClass}
                    onChange={setUploadSettingsStorageClass}
                  />

                  {uploadSettingsSubmitError ? (
                    <p className="status-message-error">{uploadSettingsSubmitError}</p>
                  ) : null}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeUploadSettingsModal}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="primary-button" disabled={isSavingUploadSettings}>
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateFolderModalOpen && canCreateFolderInCurrentContext ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-folder-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.folder.create_eyebrow")}</p>
                <h2 id="create-folder-modal-title" className="modal-title">
                  {t("content.folder.create_title")}
                </h2>
              </div>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateFolder();
              }}
            >
              <label className="field-group" htmlFor={newFolderNameFieldId}>
                <span>{t("content.folder.name_label")}</span>
                <input
                  id={newFolderNameFieldId}
                  type="text"
                  value={newFolderName}
                  placeholder={t("content.folder.name_placeholder")}
                  onChange={(event) => {
                    setNewFolderName(event.target.value);
                    if (createFolderError) {
                      setCreateFolderError(null);
                    }
                  }}
                  autoFocus
                />
                <span className="field-helper">
                  {t("content.folder.name_helper").replace("{path}", [
                    selectedBucketProvider?.toUpperCase() ?? t("content.provider.aws"),
                    selectedBucketName ?? "",
                    selectedBucketPath
                  ].filter((segment) => segment.length > 0).join("/"))}
                </span>
              </label>

              {createFolderError ? (
                <p className="status-message-error">{createFolderError}</p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => closeCreateFolderModal()}
                  disabled={isCreatingFolder}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="primary-button" disabled={isCreatingFolder}>
                  {isCreatingFolder
                    ? t("content.folder.creating_button")
                    : t("content.folder.create_button")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDeleteConnection ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-connection-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("navigation.connections.delete_title")}</p>
                <h2 id="delete-connection-modal-title" className="modal-title">
                  {t("navigation.connections.delete_confirm").replace(
                    "{name}",
                    pendingDeleteConnection.name
                  )}
                </h2>
              </div>
            </div>

            <p className="modal-copy">
              {t("navigation.connections.delete_description")
                .replace("{name}", pendingDeleteConnection.name)
                .replace(
                  "{provider}",
                  t(`content.provider.${pendingDeleteConnection.provider}`)
                )}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingDeleteConnectionId(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-danger"
                onClick={() => {
                  void confirmRemoveConnection();
                }}
              >
                {t("navigation.menu.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uploadConflictPrompt ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-conflict-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.transfer.conflict_modal_eyebrow")}</p>
                <h2 id="upload-conflict-modal-title" className="modal-title">
                  {t("content.transfer.conflict_modal_title").replace(
                    "{name}",
                    uploadConflictPrompt.fileName
                  )}
                </h2>
              </div>
            </div>

            <p className="modal-copy">
              {t("content.transfer.conflict_modal_progress")
                .replace("{current}", String(uploadConflictPrompt.currentConflictIndex))
                .replace("{total}", String(uploadConflictPrompt.totalConflicts))}
            </p>
            <p className="modal-copy">{t("content.transfer.conflict_modal_body")}</p>
            <p className="modal-copy">
              <strong>{t("content.transfer.conflict_modal_destination_label")}:</strong>{" "}
              {uploadConflictPrompt.objectKey}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => resolveUploadConflict("skip")}
              >
                {t("content.transfer.conflict_skip")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => resolveUploadConflict("skipAll")}
              >
                {t("content.transfer.conflict_skip_all")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => resolveUploadConflict("overwrite")}
              >
                {t("content.transfer.conflict_replace")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => resolveUploadConflict("overwriteAll")}
              >
                {t("content.transfer.conflict_replace_all")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ConnectionTreeNodeItemProps = {
  node: ExplorerTreeNode;
  selectedNodeId: string | null;
  connectionIndicators: Record<string, ConnectionIndicator>;
  isCollapsed?: boolean;
  shouldForceExpand?: boolean;
  menuState?: {
    isOpen: boolean;
    onToggle: (connectionId: string | null) => void;
    onAction: (
      actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
      connectionId: string
    ) => void;
  };
  onSelect: (node: ExplorerTreeNode) => void;
  onToggleCollapsed: (connectionId: string) => void;
  onConnectionDoubleClick: (connectionId: string) => void;
  t: (key: string) => string;
};

function ConnectionTreeNodeItem({
  node,
  selectedNodeId,
  connectionIndicators,
  isCollapsed = false,
  shouldForceExpand = false,
  menuState,
  onSelect,
  onToggleCollapsed,
  onConnectionDoubleClick,
  t
}: ConnectionTreeNodeItemProps) {
  const isSelected = selectedNodeId === node.id;
  const isConnectionNode = node.kind === "connection";
  const indicator = connectionIndicators[node.connectionId] ?? { status: "disconnected" };
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = !isCollapsed || shouldForceExpand;

  return (
    <div className="tree-node-branch">
      <div
        className={`tree-node-row${isConnectionNode ? " tree-node-row-connection" : " tree-node-row-container"}${
          isSelected ? " is-selected" : ""
        }`}
      >
        {isConnectionNode ? (
          hasChildren ? (
            <button
              type="button"
              className="tree-toggle-button tree-toggle-button-connection"
              aria-label={t(isExpanded ? "navigation.collapse" : "navigation.expand")}
              aria-expanded={isExpanded}
              onClick={() => onToggleCollapsed(node.connectionId)}
            >
              <ChevronRight
                size={16}
                strokeWidth={2}
                className={`tree-toggle-icon${isExpanded ? " is-expanded" : ""}`}
              />
            </button>
          ) : (
            <span className="tree-toggle-spacer" aria-hidden="true" />
          )
        ) : null}

        <button
          type="button"
          className={`tree-node-button${isConnectionNode ? " tree-node-button-connection" : " tree-node-button-container tree-node-nested"}${isSelected ? " is-selected" : ""}`}
          onClick={() => onSelect(node)}
          onDoubleClick={() => {
            if (isConnectionNode) {
              onConnectionDoubleClick(node.connectionId);
            }
          }}
        >
          <span className="tree-node-main">
            {isConnectionNode ? (
              <ConnectionStatusIcon
                indicator={indicator}
                connectingTitle={t(CONNECTING_CONNECTION_TITLE_KEY)}
                connectedTitle={t(CONNECTED_CONNECTION_TITLE_KEY)}
                disconnectedTitle={t(DISCONNECTED_CONNECTION_TITLE_KEY)}
              />
            ) : (
              <TreeNodeIcon kind={node.kind} />
            )}

            <span className="tree-node-copy">
              <span className={isConnectionNode ? "tree-node-title tree-node-title-connection" : "tree-node-title"}>
                {node.name}
              </span>
            </span>
            {node.kind === "connection" ? (
              <span className={`provider-badge provider-${node.provider}`}>
                {node.provider.toUpperCase()}
              </span>
            ) : node.region ? (
              <span className="tree-node-meta tree-node-meta-bucket">{node.region}</span>
            ) : null}
          </span>
        </button>

        {isConnectionNode && menuState ? (
          <TreeItemMenu
            connectionId={node.id}
            indicator={indicator}
            isOpen={menuState.isOpen}
            onToggle={menuState.onToggle}
            onAction={menuState.onAction}
            t={t}
          />
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <ul className="tree-children">
          {(node.children ?? []).map((childNode) => (
            <li key={childNode.id} className="tree-item">
              <ConnectionTreeNodeItem
                node={childNode}
                selectedNodeId={selectedNodeId}
                connectionIndicators={connectionIndicators}
                onToggleCollapsed={onToggleCollapsed}
                onSelect={onSelect}
                onConnectionDoubleClick={onConnectionDoubleClick}
                t={t}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TreeNodeIcon({ kind }: { kind: TreeNodeKind }) {
  return (
    <span
      className={`tree-node-glyph ${
        kind === "bucket" ? "tree-node-glyph-bucket" : "tree-node-glyph-folder"
      }`}
      aria-hidden="true"
    >
      {kind === "bucket" ? (
        <Database size={16} strokeWidth={1.9} />
      ) : (
        <Folder size={16} strokeWidth={1.9} />
      )}
    </span>
  );
}

type ConnectionStatusIconProps = {
  indicator: ConnectionIndicator;
  connectingTitle: string;
  connectedTitle: string;
  disconnectedTitle: string;
  size?: number;
};

function ConnectionStatusIcon({
  indicator,
  connectingTitle,
  connectedTitle,
  disconnectedTitle,
  size = 16
}: ConnectionStatusIconProps) {
  if (indicator.status === "connecting") {
    return (
      <span className="connection-status-icon connection-status-icon-connecting" title={connectingTitle}>
        <LoaderCircle size={size} strokeWidth={2} />
      </span>
    );
  }

  if (indicator.status === "connected") {
    return (
      <span className="connection-status-icon connection-status-icon-connected" title={connectedTitle}>
        <Cloud size={size} strokeWidth={1.9} />
      </span>
    );
  }

  if (indicator.status === "error") {
    return (
      <span
        className="connection-status-icon connection-status-icon-error"
        title={indicator.message ?? disconnectedTitle}
      >
        <CircleAlert size={size} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className="connection-status-icon connection-status-icon-disconnected" title={disconnectedTitle}>
      <Cloud size={size} strokeWidth={1.9} />
    </span>
  );
}

type TreeItemMenuProps = {
  connectionId: string;
  indicator: ConnectionIndicator;
  isOpen: boolean;
  onToggle: (connectionId: string | null) => void;
  onAction: (
    actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
    connectionId: string
  ) => void;
  t: (key: string) => string;
};

function TreeItemMenu({
  connectionId,
  indicator,
  isOpen,
  onToggle,
  onAction,
  t
}: TreeItemMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={menuRef} className="tree-item-menu">
      <button
        type="button"
        className="tree-menu-trigger"
        aria-label={t("navigation.item_menu")}
        onClick={() => onToggle(isOpen ? null : connectionId)}
      >
        <Ellipsis size={16} strokeWidth={2} />
      </button>

      {isOpen ? (
        <div className="tree-menu-popup" role="menu">
          {getConnectionActions(t, indicator).map((action) => (
            <button
              key={action.id}
              type="button"
              className={`tree-menu-action${action.variant === "danger" ? " tree-menu-action-danger" : ""}`}
              disabled={action.disabled}
              role="menuitem"
              onClick={() => onAction(action.id, connectionId)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ContentItemMenuProps = {
  item: ContentExplorerItem;
  canRestore: boolean;
  canDownload: boolean;
  canDownloadAs: boolean;
  canCancelDownload: boolean;
  canOpenFile: boolean;
  canOpenInExplorer: boolean;
  isOpen: boolean;
  showTrigger: boolean;
  anchorPosition: { x: number; y: number } | null;
  onToggle: (itemId: string | null, anchorPosition?: { x: number; y: number } | null) => void;
  onAction: (actionId: FileActionId, item: ContentExplorerItem) => void;
  t: (key: string) => string;
};

type ContentAreaContextMenuProps = {
  canCreateFolder: boolean;
  anchorPosition: { x: number; y: number };
  onAction: (actionId: "createFolder" | "refresh") => void;
  onClose: () => void;
  t: (key: string) => string;
};

function ContentAreaContextMenu({
  canCreateFolder,
  anchorPosition,
  onAction,
  onClose,
  t
}: ContentAreaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="tree-menu-popup tree-menu-popup-floating"
      role="menu"
      style={{
        left: `${anchorPosition.x}px`,
        top: `${anchorPosition.y}px`
      }}
    >
      {canCreateFolder ? (
        <button
          type="button"
          className="tree-menu-action"
          role="menuitem"
          onClick={() => onAction("createFolder")}
        >
          {t("content.folder.create_button")}
        </button>
      ) : null}
      <button
        type="button"
        className="tree-menu-action"
        role="menuitem"
        onClick={() => onAction("refresh")}
      >
        {t("navigation.menu.refresh")}
      </button>
    </div>
  );
}

function ContentItemMenu({
  item,
  canRestore,
  canDownload,
  canDownloadAs,
  canCancelDownload,
  canOpenFile,
  canOpenInExplorer,
  isOpen,
  showTrigger,
  anchorPosition,
  onToggle,
  onAction,
  t
}: ContentItemMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle(null, null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={menuRef} className="tree-item-menu">
      {showTrigger ? (
        <button
          type="button"
          className="tree-menu-trigger"
          aria-label={t("navigation.item_menu")}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(
              isOpen ? null : item.id,
              isOpen ? null : null
            );
          }}
        >
          <Ellipsis size={16} strokeWidth={2} />
        </button>
      ) : null}

      {isOpen ? (
        <div
          className={`tree-menu-popup${anchorPosition ? " tree-menu-popup-floating" : ""}`}
          role="menu"
          style={
            anchorPosition
              ? {
                  left: `${anchorPosition.x}px`,
                  top: `${anchorPosition.y}px`
                }
              : undefined
          }
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="tree-menu-action"
            role="menuitem"
            disabled={!canOpenFile}
            onClick={(event) => {
              event.stopPropagation();
              onAction("openFile", item);
            }}
          >
            {t("navigation.menu.open_file")}
          </button>
          <button
            type="button"
            className="tree-menu-action"
            role="menuitem"
            disabled={!canOpenInExplorer}
            onClick={(event) => {
              event.stopPropagation();
              onAction("openInExplorer", item);
            }}
          >
            {t("navigation.menu.open_in_file_explorer")}
          </button>
          {canRestore ? (
            <button
              type="button"
              className="tree-menu-action"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onAction("restore", item);
              }}
            >
              {t("navigation.menu.restore")}
            </button>
          ) : null}
          {canCancelDownload ? (
            <button
              type="button"
              className="tree-menu-action"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onAction("cancelDownload", item);
              }}
            >
              {t("navigation.menu.cancel_download")}
            </button>
          ) : null}
          <button
            type="button"
            className="tree-menu-action"
            role="menuitem"
            disabled={!canDownload}
            onClick={(event) => {
              event.stopPropagation();
              onAction("download", item);
            }}
          >
            {t("navigation.menu.download")}
          </button>
          <button
            type="button"
            className="tree-menu-action"
            role="menuitem"
            disabled={!canDownloadAs}
            onClick={(event) => {
              event.stopPropagation();
              onAction("downloadAs", item);
            }}
          >
            {t("navigation.menu.download_as")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type FileStatusBadgeProps = {
  label: string;
  status: "available" | "downloaded" | "archived" | "restoring";
  title?: string;
};

function FileStatusBadge({ label, status, title }: FileStatusBadgeProps) {
  let icon = <CircleAlert size={12} strokeWidth={2} />;

  if (status === "available") {
    icon = <Cloud size={12} strokeWidth={2} />;
  } else if (status === "downloaded") {
    icon = <Cloud size={12} strokeWidth={2} className="is-filled" />;
  } else if (status === "archived") {
    icon = <Archive size={12} strokeWidth={2} />;
  } else {
    icon = <LoaderCircle size={12} strokeWidth={2} />;
  }

  return (
    <span className={`file-status-badge file-status-badge-${status}`} title={title ?? label}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

type ContentCounterStatusProps = {
  status: "available" | "downloaded" | "archived" | "restoring";
  label: string;
  count: number;
  hideCount?: boolean;
};

function ContentCounterStatus({
  status,
  label,
  count,
  hideCount = false
}: ContentCounterStatusProps) {
  let icon = <CircleAlert size={12} strokeWidth={2} />;

  if (status === "available") {
    icon = <Cloud size={12} strokeWidth={2} />;
  } else if (status === "downloaded") {
    icon = <Cloud size={12} strokeWidth={2} className="is-filled" />;
  } else if (status === "archived") {
    icon = <Archive size={12} strokeWidth={2} />;
  } else if (status === "restoring") {
    icon = <LoaderCircle size={12} strokeWidth={2} className="content-counter-status-spinner" />;
  }

  return (
    <span className={`content-counter-status content-counter-status-${status}`} title={label}>
      {icon}
      {hideCount ? null : <strong>{count}</strong>}
    </span>
  );
}

type CompactFileStatusIconsProps = {
  item: ContentExplorerItem;
  locale: Locale;
  t: (key: string) => string;
};

function CompactFileStatusIcons({ item, locale, t }: CompactFileStatusIconsProps) {
  const items = getFileStatusBadgeDescriptors(item, locale, t).map((descriptor) => ({
    icon:
      descriptor.status === "downloaded" ? (
        <Cloud size={12} strokeWidth={2} className="is-filled" />
      ) : descriptor.status === "available" ? (
        <Cloud size={12} strokeWidth={2} />
      ) : descriptor.status === "restoring" ? (
        <LoaderCircle size={12} strokeWidth={2} />
      ) : (
        <Archive size={12} strokeWidth={2} />
      ),
    label: descriptor.title,
    className:
      descriptor.status === "downloaded"
        ? "is-downloaded"
        : descriptor.status === "available"
        ? "is-available"
        : descriptor.status === "restoring"
        ? "is-restoring"
        : "is-archived"
  }));

  if (items.length === 0) {
    return null;
  }

  return (
    <span className="content-file-status-icons" aria-label={t("content.detail.local_state")}>
      {items.map((item, index) => (
        <span
          key={`${item.className}-${index}`}
          className={`content-file-status-icon ${item.className}`}
          title={item.label}
          aria-label={item.label}
        >
          {item.icon}
        </span>
      ))}
    </span>
  );
}

function getConnectionStatusLabel(
  indicator: ConnectionIndicator,
  t: (key: string) => string
): string {
  if (indicator.status === "connected") {
    return t(CONNECTED_CONNECTION_TITLE_KEY);
  }

  if (indicator.status === "connecting") {
    return t(CONNECTING_CONNECTION_TITLE_KEY);
  }

  if (indicator.status === "error") {
    return t("navigation.connection_status.error");
  }

  return t(DISCONNECTED_CONNECTION_TITLE_KEY);
}
