import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import {
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  Download,
  Ellipsis,
  File,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Snowflake,
  Trash2,
  Upload,
  XCircle,
  X
} from "lucide-react";
import logoPrimary from "../../assets/logo-primary.svg";
import { AwsConnectionFields } from "../connections/components/AwsConnectionFields";
import { AwsUploadStorageClassField } from "../connections/components/AwsUploadStorageClassField";
import { AzureConnectionFields } from "../connections/components/AzureConnectionFields";
import { AzureUploadTierField } from "../connections/components/AzureUploadTierField";
import {
  DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
  normalizeAwsUploadStorageClass,
  type AwsUploadStorageClass
} from "../connections/awsUploadStorageClasses";
import {
  DEFAULT_AZURE_UPLOAD_TIER,
  normalizeAzureUploadTier,
  type AzureUploadTier
} from "../connections/azureUploadTiers";
import { appSettingsStore } from "../settings/persistence/appSettingsStore";
import {
  DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  MAX_CONTENT_LISTING_PAGE_SIZE,
  MIN_CONTENT_LISTING_PAGE_SIZE,
  normalizeContentListingPageSize
} from "../settings/persistence/appSettingsStore";
import type {
  AwsConnectionDraft,
  AzureAuthenticationMethod,
  ConnectionFormMode,
  ConnectionProvider,
  SavedConnectionSummary
} from "../connections/models";
import { connectionService } from "../connections/services/connectionService";
import {
  type AwsRestoreTier,
  type AwsDownloadProgressEvent,
  type AwsUploadProgressEvent,
  type AwsBucketSummary,
  awsObjectExists,
  cancelAwsUpload,
  cancelAwsDownload,
  changeAwsObjectStorageClass,
  createAwsFolder,
  deleteAwsObjects,
  deleteAwsPrefix,
  downloadAwsObjectToPath,
  findAwsCachedObjects,
  getAwsBucketRegion,
  openAwsCachedObject,
  openAwsCachedObjectParent,
  requestAwsObjectRestore,
  startAwsUpload,
  startAwsUploadFromBytes,
  startAwsCacheDownload,
  testAwsConnection
} from "../../lib/tauri/awsConnections";
import {
  azureBlobExists,
  cancelAzureDownload,
  changeAzureBlobAccessTier,
  createAzureFolder,
  downloadAzureBlobToPath,
  deleteAzureObjects,
  deleteAzurePrefix,
  findAzureCachedObjects,
  openAzureCachedObject,
  openAzureCachedObjectParent,
  cancelAzureUpload,
  rehydrateAzureBlob,
  startAzureCacheDownload,
  startAzureUpload,
  startAzureUploadFromBytes,
  testAzureConnection,
  type AzureRehydrationPriority,
  type AzureDownloadProgressEvent,
  type AzureUploadProgressEvent
} from "../../lib/tauri/azureConnections";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";
import { validateLocalMappingDirectory } from "../../lib/tauri/commands";
import { RestoreRequestModal } from "../restore/RestoreRequestModal";
import { ChangeStorageClassModal } from "../storage-class/ChangeStorageClassModal";
import {
  type CloudContainerItemsResult,
  type CloudContainerSummary,
  listContainerItemsForSavedConnection,
  listContainersForSavedConnection,
  testConnectionForSavedConnection
} from "./providerReadAdapters";
import {
  buildPendingDeleteState,
  buildFileIdentity,
  buildUploadObjectKey,
  canChangeTierItem,
  canDownloadAsItem,
  canDownloadItem,
  canRestoreItem,
  dedupeDirectoryPrefixes,
  getBatchSelectionActions,
  getFileActionKind,
  getRefreshPlan,
  type NavigationFileActionId as FileActionId,
  getStartupAutoConnectConnections,
  getUploadParentPath,
  hasActiveTransferForItem,
  isFileIdentityInContext,
  normalizeDirectoryPrefix,
  shouldRefreshAfterUploadCompletion,
  toggleSelectedItemId,
  toggleVisibleSelection,
  validateNewFolderNameInput
} from "./navigationGuards";
import {
  buildChangeStorageClassRequestState,
  buildRestoreRequestState,
  getBatchChangeTierTooltip,
  type NavigationChangeStorageClassRequestState as ChangeStorageClassRequestState,
  type NavigationRestoreRequestState as RestoreRequestState
} from "./navigationWorkflows";
import {
  applyDownloadedFileState,
  reconcileDownloadedFilePathsForContext,
  resolveDownloadState
} from "./navigationDownloads";
import {
  buildContentItems,
  buildPreviewFileState,
  isArchivedStorageClass,
  mergeContentItems
} from "./navigationContent";
import {
  buildAvailableUntilTooltip,
  buildBreadcrumbs,
  buildConnectionFailureMessage,
  buildContentCounterLabel,
  extractErrorMessage,
  filterTreeNodes,
  formatBytes,
  formatDateTime,
  getConnectionActions,
  getContentStatusLabel,
  getDisplayContentStatus,
  getFileStatusBadgeDescriptors,
  getFileNameFromPath,
  getPathTitle,
  getPreferredFileStatusBadgeDescriptors,
  getSummaryContentStatuses,
  isCancelledTransferError,
  isTemporaryRestoredArchivalFile,
  isUploadExistsPreflightPermissionError,
  matchesFilter,
  normalizeFilterText
} from "./navigationPresentation";
import {
  isAzureArchivedOverwriteBlocked,
  resolveUploadConflictDecisions,
  type UploadConflictDecision,
  type UploadConflictPromptState
} from "./navigationUploads";
import {
  type NavigationFormErrors as FormErrors,
  validateConnectionForm as validateNavigationConnectionForm,
  validateConnectionTestFields as validateNavigationConnectionTestFields
} from "./navigationValidation";
import {
  buildBucketNodes,
  buildHomeSelectionState,
  buildNodeSelectionState,
  clearConnectionBucketNodes,
  findTreeNodeById,
  getTransferCancelLabel,
  setBucketPath,
  sortTreeNodes,
  toggleCollapsedConnection,
  updateBucketNodeMap
} from "./navigationTreeState";
import {
  buildContentResetState,
  buildInitialContentFailureState,
  buildInitialContentLoadingState,
  buildInitialContentSuccessState,
  buildLoadMoreFailureState,
  buildLoadMoreStartState,
  buildLoadMoreSuccessState,
  getRegionUpdate
} from "./navigationLoading";
import {
  buildConnectedIndicator,
  buildConnectingIndicator,
  buildConnectionErrorIndicator,
  buildConnectionTestInProgressState,
  buildConnectionTestMissingAccountState,
  buildConnectionTestSuccessState,
  buildConnectionTestValidationFailureState,
  buildDisconnectedIndicator,
  buildNextConnectionRequestId,
  buildResetConnectionTestState,
  clearConnectionProviderAccountId,
  setConnectionProviderAccountId,
  updateConnectionIndicatorMap
} from "./navigationConnectionState";
import {
  resolveInitialContentListingPageSize,
  resolveInitialContentViewMode,
  resolveInitialGlobalCacheDirectory,
  resolveInitialSidebarWidth
} from "./navigationPreferences";
import {
  buildAwsEditModalState,
  buildAzureEditModalState,
  buildBaseEditModalState,
  buildCreateModalState,
  buildModalLoadErrorMessage,
  buildResetModalFormState
} from "./navigationModalState";
import {
  getConnectionActionDispatchSteps,
  getContentAreaActionDispatchStep,
  getDefaultConnectionActionStep
} from "./navigationActionDispatch";
import {
  buildClosedCreateFolderModalState,
  buildClosedPendingDeleteModalState,
  buildOpenedCreateFolderModalState,
  canCloseCreateFolderModal,
  canClosePendingDeleteModal,
  canOpenCreateFolderModal,
  shouldOpenContentAreaContextMenu
} from "./navigationModalGuards";
import {
  buildClosedUploadSettingsModalState,
  buildConnectionDeleteErrorMessage,
  buildOpenedUploadSettingsModalState,
  buildPendingRemoveConnectionState
} from "./navigationSecondaryModalState";
import {
  loadLegacyGlobalCacheDirectoryCandidateFromStorage,
  resolveCachedFileIdentities
} from "./navigationCacheState";
import {
  buildDownloadCompletionToast,
  getTransferCancellationTarget,
  resolveTransferCancellationErrorMessage,
  buildTransferErrorToast,
  buildUploadCompletionToast,
  reconcileContentItemsFromDownloadEvent,
  reconcileDownloadedFilePathsFromDownloadEvent,
  shouldShowTransferError,
  updateTransfersFromDownloadEvent,
  updateTransfersFromUploadEvent
} from "./navigationTransfers";
import {
  buildUploadPreparationIssueMessages,
  buildUploadTransferEntry,
  hydratePreparedUploadBatchItems,
  normalizeUploadBatchPaths,
  prepareUploadBatchCandidates
} from "./navigationUploadPreparation";
import {
  resolveBrowserFileUploadSource,
  startSimpleUploadForProvider
} from "./navigationUploadExecution";
import {
  buildContentStatusSummaryItems,
  countLoadedItemsByStatus,
  filterConnectionBuckets,
  filterContentItems
} from "./navigationDerivedState";

function Globe2Icon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="18"
      height="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

type NavigatorView = "home" | "node";
type ConnectionTestStatus = "idle" | "testing" | "success" | "error";
type ConnectionIndicatorStatus = "disconnected" | "connecting" | "connected" | "error";
const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";
const CONNECTING_CONNECTION_TITLE_KEY = "navigation.connection_status.connecting";
const CONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.connected";
const DISCONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.disconnected";
const BUCKET_REGION_PLACEHOLDER = "...";
const MAX_BUCKET_REGION_REQUESTS = 4;
const CONTENT_VIEW_MODE_STORAGE_KEY = "cloudeasyfiles.content-view-mode";
const CONNECTION_METADATA_STORAGE_KEY = "cloudeasyfiles.connection-metadata";
const ALL_CONTENT_STATUS_FILTERS: Array<
  "directory" | "downloaded" | "available" | "restoring" | "archived"
> = [
  "directory",
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

type ContentDeletePlan = {
  fileKeys: string[];
  directoryPrefixes: string[];
};

type PendingContentDeleteState = {
  items: ContentExplorerItem[];
  fileCount: number;
  directoryCount: number;
  plan: ContentDeletePlan;
};

type FileActionAvailabilityContext = {
  provider: ConnectionProvider | null | undefined;
  connectionId: string | null;
  bucketName: string | null;
  hasValidLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, ActiveTransfer>;
};

type BatchSelectionActionsState = {
  downloadableItems: ContentExplorerItem[];
  restorableItems: ContentExplorerItem[];
  changeTierableItems: ContentExplorerItem[];
  deletableItems: ContentExplorerItem[];
  canBatchDownload: boolean;
  canBatchRestore: boolean;
  canBatchChangeTier: boolean;
  canBatchDelete: boolean;
};

const CONTENT_DELETE_CONFIRMATION_TEXT = "DELETE";

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

function loadLegacyGlobalCacheDirectoryCandidate(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return loadLegacyGlobalCacheDirectoryCandidateFromStorage(
    window.localStorage.getItem(CONNECTION_METADATA_STORAGE_KEY)
  );
}

function loadInitialGlobalCacheDirectory(): string {
  const appSettings = appSettingsStore.load();
  return resolveInitialGlobalCacheDirectory({
    settingsDirectory: appSettings.globalLocalCacheDirectory,
    legacyDirectoryCandidate: loadLegacyGlobalCacheDirectoryCandidate()
  });
}

function loadInitialContentListingPageSize(): number {
  return resolveInitialContentListingPageSize(appSettingsStore.load().contentListingPageSize);
}

type ActiveTransfer = {
  operationId: string;
  itemId: string;
  fileIdentity: string;
  fileName: string;
  bucketName: string;
  provider: ConnectionProvider;
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

type SimpleUploadBatchInput = {
  fileName: string;
  localFilePath?: string;
  startUpload: (
    draft:
      | AwsConnectionDraft
      | Awaited<ReturnType<typeof connectionService.getAzureConnectionDraft>>,
    operationId: string,
    objectKey: string
  ) => Promise<void>;
};

type PreparedSimpleUploadBatchItem = SimpleUploadBatchInput & {
  objectKey: string;
  fileIdentity: string;
  objectAlreadyExists: boolean;
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
  const storageAccountNameFieldId = useId();
  const azureAuthenticationMethodFieldId = useId();
  const azureAccountKeyFieldId = useId();
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
  const [storageAccountName, setStorageAccountName] = useState("");
  const [azureAuthenticationMethod, setAzureAuthenticationMethod] =
    useState<AzureAuthenticationMethod>("shared_key");
  const [azureAccountKey, setAzureAccountKey] = useState("");
  const [connectOnStartup, setConnectOnStartup] = useState(false);
  const [defaultAwsUploadStorageClass, setDefaultAwsUploadStorageClass] =
    useState<AwsUploadStorageClass>(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
  const [defaultAzureUploadTier, setDefaultAzureUploadTier] =
    useState<AzureUploadTier>(DEFAULT_AZURE_UPLOAD_TIER);
  const [globalLocalCacheDirectory, setGlobalLocalCacheDirectory] = useState(
    loadInitialGlobalCacheDirectory
  );
  const [contentListingPageSize, setContentListingPageSize] = useState(
    loadInitialContentListingPageSize
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
  const [changeStorageClassRequest, setChangeStorageClassRequest] =
    useState<ChangeStorageClassRequestState | null>(null);
  const [changeStorageClassSubmitError, setChangeStorageClassSubmitError] = useState<string | null>(
    null
  );
  const [isSubmittingStorageClassChange, setIsSubmittingStorageClassChange] = useState(false);
  const [sidebarFilterText, setSidebarFilterText] = useState("");
  const [contentFilterText, setContentFilterText] = useState("");
  const [contentStatusFilters, setContentStatusFilters] = useState<ContentStatusFilter[]>([]);
  const [selectedContentItemIds, setSelectedContentItemIds] = useState<string[]>([]);
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
  const [pendingContentDelete, setPendingContentDelete] = useState<PendingContentDeleteState | null>(
    null
  );
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [deleteContentError, setDeleteContentError] = useState<string | null>(null);
  const [isDeletingContent, setIsDeletingContent] = useState(false);
  const [isUploadSettingsModalOpen, setIsUploadSettingsModalOpen] = useState(false);
  const [uploadSettingsStorageClass, setUploadSettingsStorageClass] =
    useState<AwsUploadStorageClass>(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
  const [uploadSettingsAzureTier, setUploadSettingsAzureTier] =
    useState<AzureUploadTier>(DEFAULT_AZURE_UPLOAD_TIER);
  const [uploadSettingsSubmitError, setUploadSettingsSubmitError] = useState<string | null>(null);
  const [isSavingUploadSettings, setIsSavingUploadSettings] = useState(false);
  const [contentRefreshNonce, setContentRefreshNonce] = useState(0);
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>(() => {
    if (typeof window === "undefined") {
      return "list";
    }
    return resolveInitialContentViewMode(window.localStorage.getItem(CONTENT_VIEW_MODE_STORAGE_KEY));
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SIDEBAR_WIDTH;
    }
    return resolveInitialSidebarWidth(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    );
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
    () => findTreeNodeById(treeNodes, selectedNodeId),
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
  const canCreateFolderInCurrentContext = selectedNode?.kind === "bucket" && !!selectedBucketProvider;
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
    return filterConnectionBuckets(bucketNodes, normalizedContentFilter);
  }, [connectionBuckets, normalizedContentFilter, selectedNode]);
  const isStatusFilterInactive =
    contentStatusFilters.length === 0 ||
    contentStatusFilters.length === ALL_CONTENT_STATUS_FILTERS.length;
  const selectedContentItemIdSet = useMemo(
    () => new Set(selectedContentItemIds),
    [selectedContentItemIds]
  );
  const filteredContentItems = useMemo(
    () =>
      filterContentItems({
        items: contentItems,
        normalizedFilter: normalizedContentFilter,
        contentStatusFilters,
        allContentStatusFilters: ALL_CONTENT_STATUS_FILTERS
      }),
    [contentItems, normalizedContentFilter, contentStatusFilters]
  );
  const isContentFilterActive = normalizedContentFilter.length > 0 || !isStatusFilterInactive;
  const loadedFileItems = useMemo(
    () => contentItems.filter((item) => item.kind === "file"),
    [contentItems]
  );
  const loadedDirectoryCount = useMemo(
    () => contentItems.filter((item) => item.kind === "directory").length,
    [contentItems]
  );
  const selectedContentItems = useMemo(
    () => contentItems.filter((item) => selectedContentItemIdSet.has(item.id)),
    [contentItems, selectedContentItemIdSet]
  );
  const selectedContentCount = selectedContentItems.length;
  const isContentSelectionActive = selectedContentCount > 0;
  const visibleContentItemIds = useMemo(
    () => filteredContentItems.map((item) => item.id),
    [filteredContentItems]
  );
  const allVisibleContentItemsSelected =
    visibleContentItemIds.length > 0 &&
    visibleContentItemIds.every((itemId) => selectedContentItemIdSet.has(itemId));
  const loadedContentCount =
    selectedNode?.kind === "connection"
      ? (connectionBuckets[selectedNode.id] ?? []).length
      : selectedNode?.kind === "bucket"
      ? contentItems.length
      : 0;
  const displayedContentCount =
    selectedNode?.kind === "connection"
      ? filteredConnectionBuckets.length
      : selectedNode?.kind === "bucket"
      ? filteredContentItems.length
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
  const hasValidGlobalLocalCacheDirectory = localMappingDirectoryStatus === "valid";
  const fileActionAvailabilityContext = useMemo(
    () => ({
      provider: selectedBucketProvider,
      connectionId: selectedBucketConnectionId,
      bucketName: selectedBucketName,
      hasValidLocalCacheDirectory: hasValidGlobalLocalCacheDirectory,
      activeTransferIdentityMap
    }),
    [
      selectedBucketProvider,
      selectedBucketConnectionId,
      selectedBucketName,
      hasValidGlobalLocalCacheDirectory,
      activeTransferIdentityMap
    ]
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
  const batchSelectionActions = useMemo<BatchSelectionActionsState>(() => {
    return getBatchSelectionActions(
      selectedContentItems,
      fileActionAvailabilityContext,
      selectedBucketProvider
    );
  }, [selectedContentItems, fileActionAvailabilityContext, selectedBucketProvider]);
  const localMappingDirectoryAlertKey =
    localMappingDirectoryStatus === "invalid"
      ? "settings.download_directory_notice_invalid"
      : localMappingDirectoryStatus === "missing"
      ? "settings.download_directory_notice_missing"
      : null;
  const loadedDownloadedCount = useMemo(
    () => countLoadedItemsByStatus(loadedFileItems, "downloaded"),
    [loadedFileItems]
  );
  const loadedAvailableCount = useMemo(
    () => countLoadedItemsByStatus(loadedFileItems, "available"),
    [loadedFileItems]
  );
  const loadedRestoringCount = useMemo(
    () => countLoadedItemsByStatus(loadedFileItems, "restoring"),
    [loadedFileItems]
  );
  const loadedArchivedCount = useMemo(
    () => countLoadedItemsByStatus(loadedFileItems, "archived"),
    [loadedFileItems]
  );
  const contentStatusSummaryItems = useMemo(
    () =>
      buildContentStatusSummaryItems({
        isBucketSelected: selectedNode?.kind === "bucket",
        loadedDirectoryCount,
        loadedDownloadedCount,
        loadedAvailableCount,
        loadedRestoringCount,
        loadedArchivedCount,
        t
      }),
    [
      loadedArchivedCount,
      loadedAvailableCount,
      loadedDirectoryCount,
      loadedDownloadedCount,
      loadedRestoringCount,
      t
    ]
  );
  const contentStatusSummaryMap = useMemo(
    () => new Map(contentStatusSummaryItems.map((item) => [item.key, item] as const)),
    [contentStatusSummaryItems]
  );

  const shouldRenderLoadMoreButton = selectedNode?.kind === "bucket";

  function toggleContentStatusFilter(filter: ContentStatusFilter) {
    setContentStatusFilters((currentFilters) =>
      currentFilters.includes(filter)
        ? currentFilters.filter((currentFilter) => currentFilter !== filter)
        : [...currentFilters, filter]
    );
  }

  function getCompactFigureLabel(item: ContentExplorerItem) {
    if (item.kind === "directory") {
      return t("content.type.directory");
    }

    const extension = item.name.split(".").pop()?.trim();

    if (extension && extension !== item.name) {
      return extension.toUpperCase();
    }

    return t("content.type.file");
  }

  function renderCompactItemTopline(item: ContentExplorerItem) {
    if (item.kind === "directory") {
      return (
        <span className="content-list-item-topline">
          <span className="content-list-item-icon content-list-item-icon-directory">
            <Folder size={18} strokeWidth={1.9} />
          </span>
        </span>
      );
    }

    return (
      <span className="content-list-item-topline">
        {item.availabilityStatus && item.downloadState ? (
          <CompactFileStatusIcons item={item} locale={locale} t={t} />
        ) : null}
        <span className="content-list-item-compact-tier">
          {item.storageClass ?? t("content.type.file")}
        </span>
      </span>
    );
  }

  function renderCompactBucketTopline(region: string | null | undefined) {
    return (
      <span className="content-list-item-topline">
        <span className="content-list-item-icon content-list-item-icon-bucket">
          <Database size={18} strokeWidth={1.9} />
        </span>
        {region ? <span className="content-list-item-compact-tier">{region}</span> : null}
      </span>
    );
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
        const activeTransfer = activeTransfers[operationId];
        const cancellationTarget = getTransferCancellationTarget({
          transferKind: "direct",
          provider: activeTransfer?.provider
        });

        if (cancellationTarget === "cancelAzureDownload") {
          await cancelAzureDownload(operationId);
        } else {
          await cancelAwsDownload(operationId);
        }
      } catch (error) {
        if (isCancelledTransferError(error)) {
          return;
        }

        showTransferErrorToast(
          resolveTransferCancellationErrorMessage(
            extractErrorMessage(error),
            t("content.transfer.cancel_failed")
          )
        );
      }
    })();
  }

  function handleCancelActiveTransfer(operationId: string, transferKind: TransferKind) {
    if (transferKind === "upload") {
      void (async () => {
        try {
          const activeTransfer = activeTransfers[operationId];
          const cancellationTarget = getTransferCancellationTarget({
            transferKind,
            provider: activeTransfer?.provider
          });

          if (cancellationTarget === "cancelAzureUpload") {
            await cancelAzureUpload(operationId);
          } else {
            await cancelAwsUpload(operationId);
          }
        } catch (error) {
          if (isCancelledTransferError(error)) {
            return;
          }

          showTransferErrorToast(
            resolveTransferCancellationErrorMessage(
              extractErrorMessage(error),
              t("content.transfer.cancel_failed")
            )
          );
        }
      })();

      return;
    }

    handleCancelActiveDownload(operationId);
  }

  async function startPreparedSimpleAwsUpload(
    draft:
      | AwsConnectionDraft
      | Awaited<ReturnType<typeof connectionService.getAzureConnectionDraft>>,
    input: PreparedSimpleUploadBatchItem
  ) {
    if (!selectedBucketConnectionId || !selectedBucketName || !selectedBucketProvider) {
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
        [operationId]: buildUploadTransferEntry({
          operationId,
          input,
          selectedBucketName,
          selectedBucketProvider
        })
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

  async function prepareSimpleUploadBatch(
    inputs: SimpleUploadBatchInput[]
  ): Promise<{
    draft: Awaited<ReturnType<typeof connectionService.getAwsConnectionDraft>> | Awaited<ReturnType<typeof connectionService.getAzureConnectionDraft>>;
    preparedItems: PreparedSimpleUploadBatchItem[];
  } | null> {
    if (!selectedBucketConnectionId || !selectedBucketName || !selectedBucketProvider) {
      return null;
    }

    const draft =
      selectedBucketProvider === "aws"
        ? await connectionService.getAwsConnectionDraft(selectedBucketConnectionId)
        : await connectionService.getAzureConnectionDraft(selectedBucketConnectionId);
    const { preparedItems: candidateItems, issues } = prepareUploadBatchCandidates({
      inputs,
      selectedBucketConnectionId,
      selectedBucketName,
      selectedBucketPath,
      activeTransferIdentityMap
    });
    for (const message of buildUploadPreparationIssueMessages(issues, t)) {
      showTransferErrorToast(message);
    }

    const preparedItems = await hydratePreparedUploadBatchItems({
      provider: selectedBucketProvider,
      draft,
      selectedBucketName,
      selectedBucketRegion,
      bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
      candidateItems,
      isUploadExistsPreflightPermissionError,
      awsObjectExists,
      azureBlobExists
    });

    return {
      draft,
      preparedItems: preparedItems as PreparedSimpleUploadBatchItem[]
    };
  }

  async function processSimpleUploadBatch(inputs: SimpleUploadBatchInput[]) {
    const preparedBatch = await prepareSimpleUploadBatch(inputs);

    if (!preparedBatch || preparedBatch.preparedItems.length === 0) {
      return;
    }

    const uploadDecisions = await resolveUploadConflictDecisions(
      preparedBatch.preparedItems,
      promptUploadConflictResolution
    );

    for (const { item, shouldUpload } of uploadDecisions) {
      if (!shouldUpload) {
        continue;
      }

      if (
        selectedBucketProvider === "azure" &&
        isAzureArchivedOverwriteBlocked(item, contentItems)
      ) {
        showTransferErrorToast(
          t("content.transfer.azure_overwrite_archived_blob").replace("{name}", item.fileName)
        );
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

    await processSimpleUploadBatch([
      {
        fileName: getFileNameFromPath(normalizedFilePath),
        localFilePath: normalizedFilePath,
        startUpload: async (draft, operationId, objectKey) => {
          await startSimpleUploadForProvider({
            provider: selectedBucketProvider!,
            draft,
            connectionId: selectedBucketConnectionId!,
            bucketName: selectedBucketName!,
            objectKey,
            bucketRegion: selectedBucketRegion,
            bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
            source: {
              kind: "path",
              fileName: getFileNameFromPath(normalizedFilePath),
              localFilePath: normalizedFilePath
            },
            operationId,
            startAwsUpload,
            startAzureUpload,
            startAwsUploadFromBytes,
            startAzureUploadFromBytes
          });
        }
      }
    ]);
  }

  function runSimpleAwsUploads(localFilePaths: string[]) {
    const normalizedPaths = normalizeUploadBatchPaths(localFilePaths);

    void processSimpleUploadBatch(
      normalizedPaths.map((localFilePath) => ({
        fileName: getFileNameFromPath(localFilePath),
        localFilePath,
        startUpload: async (draft, operationId, objectKey) => {
          await startSimpleUploadForProvider({
            provider: selectedBucketProvider!,
            draft,
            connectionId: selectedBucketConnectionId!,
            bucketName: selectedBucketName!,
            objectKey,
            bucketRegion: selectedBucketRegion,
            bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
            source: {
              kind: "path",
              fileName: getFileNameFromPath(localFilePath),
              localFilePath
            },
            operationId,
            startAwsUpload,
            startAzureUpload,
            startAwsUploadFromBytes,
            startAzureUploadFromBytes
          });
        }
      }))
    );
  }

  function runSimpleDroppedFileUploads(files: File[]) {
    void processSimpleUploadBatch(
      files.map((file) => ({
        fileName: file.name,
        localFilePath: file.name,
        startUpload: async (draft, operationId, objectKey) => {
          const source = await resolveBrowserFileUploadSource(
            file as File & { path?: string; webkitRelativePath?: string }
          );

          await startSimpleUploadForProvider({
            provider: selectedBucketProvider!,
            draft,
            connectionId: selectedBucketConnectionId!,
            bucketName: selectedBucketName!,
            objectKey,
            bucketRegion: selectedBucketRegion,
            bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
            source,
            operationId,
            startAwsUpload,
            startAzureUpload,
            startAwsUploadFromBytes,
            startAzureUploadFromBytes
          });
        }
      }))
    );
  }

  function handlePickUploadFile() {
    if (
      !isTauri() ||
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !selectedBucketProvider
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

  function clearContentSelection() {
    setSelectedContentItemIds([]);
  }

  function toggleContentItemSelection(itemId: string) {
    setSelectedContentItemIds((currentItemIds) => toggleSelectedItemId(currentItemIds, itemId));
  }

  function toggleSelectAllVisibleContentItems() {
    if (visibleContentItemIds.length === 0) {
      return;
    }

    setSelectedContentItemIds((currentItemIds) =>
      toggleVisibleSelection(currentItemIds, visibleContentItemIds)
    );
  }

  function openDeleteContentModal(items: ContentExplorerItem[]) {
    const nextPendingDeleteState = buildPendingDeleteState(items);

    if (!nextPendingDeleteState) {
      return;
    }

    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setContentAreaMenuAnchor(null);
    setDeleteConfirmationValue("");
    setDeleteContentError(null);
    setPendingContentDelete(nextPendingDeleteState);
  }

  function closeDeleteContentModal(force = false) {
    if (!canClosePendingDeleteModal(isDeletingContent, force)) {
      return;
    }

    const nextState = buildClosedPendingDeleteModalState();
    setPendingContentDelete(nextState.pendingContentDelete);
    setDeleteConfirmationValue(nextState.deleteConfirmationValue);
    setDeleteContentError(nextState.deleteContentError);
    setIsDeletingContent(nextState.isDeletingContent);
  }

  async function handleConfirmDeleteContent() {
    if (
      !pendingContentDelete ||
      selectedNode?.kind !== "bucket" ||
      !selectedBucketProvider ||
      !selectedBucketConnectionId ||
      !selectedBucketName
    ) {
      return;
    }

    if (deleteConfirmationValue.trim() !== CONTENT_DELETE_CONFIRMATION_TEXT) {
      setDeleteContentError(t("content.delete.confirmation_mismatch"));
      return;
    }

    setIsDeletingContent(true);
    setDeleteContentError(null);

    try {
      if (selectedBucketProvider === "aws") {
        const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);
        const bucketRegion =
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined;

        if (pendingContentDelete.plan.fileKeys.length > 0) {
          await deleteAwsObjects(
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketName,
            pendingContentDelete.plan.fileKeys,
            bucketRegion,
            draft.restrictedBucketName
          );
        }

        for (const directoryPrefix of pendingContentDelete.plan.directoryPrefixes) {
          await deleteAwsPrefix(
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            selectedBucketName,
            directoryPrefix,
            bucketRegion,
            draft.restrictedBucketName
          );
        }
      } else {
        const draft = await connectionService.getAzureConnectionDraft(selectedBucketConnectionId);

        if (pendingContentDelete.plan.fileKeys.length > 0) {
          await deleteAzureObjects(
            draft.storageAccountName,
            draft.accountKey.trim(),
            selectedBucketName,
            pendingContentDelete.plan.fileKeys
          );
        }

        for (const directoryPrefix of pendingContentDelete.plan.directoryPrefixes) {
          await deleteAzurePrefix(
            draft.storageAccountName,
            draft.accountKey.trim(),
            selectedBucketName,
            directoryPrefix
          );
        }
      }

      setCompletionToast({
        id:
          typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        title: t("content.delete.success_title"),
        description: t("content.delete.success_description")
          .replace("{count}", String(pendingContentDelete.items.length))
          .replace("{files}", String(pendingContentDelete.fileCount))
          .replace("{folders}", String(pendingContentDelete.directoryCount)),
        tone: "success"
      });

      clearContentSelection();
      closeDeleteContentModal(true);
      await handleRefreshCurrentView();
    } catch (error) {
      await handleRefreshCurrentView();
      setDeleteContentError(extractErrorMessage(error) ?? t("content.delete.failed"));
      setIsDeletingContent(false);
    }
  }

  function closeRestoreRequestModal() {
    if (isSubmittingRestoreRequest) {
      return;
    }

    setRestoreRequest(null);
    setRestoreSubmitError(null);
  }

  function closeChangeStorageClassModal() {
    if (isSubmittingStorageClassChange) {
      return;
    }

    setChangeStorageClassRequest(null);
    setChangeStorageClassSubmitError(null);
  }

  function openRestoreRequestModal(items: ContentExplorerItem[]) {
    const nextRequest = buildRestoreRequestState({
      items,
      provider: selectedBucketProvider,
      connectionId: selectedBucketConnectionId,
      bucketName: selectedBucketName,
      bucketRegion: selectedBucketRegion,
      bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
      formatBytes: (size) => formatBytes(size, locale),
      getMixedStorageClassesLabel: () => t("restore.modal.batch.mixed_storage_classes")
    });

    if (!nextRequest) {
      return;
    }

    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setRestoreSubmitError(null);
    setRestoreRequest(nextRequest);
  }

  function openChangeStorageClassModal(items: ContentExplorerItem[]) {
    const nextRequest = buildChangeStorageClassRequestState({
      items,
      provider: selectedBucketProvider,
      connectionId: selectedBucketConnectionId,
      bucketName: selectedBucketName,
      bucketRegion: selectedBucketRegion,
      bucketRegionPlaceholder: BUCKET_REGION_PLACEHOLDER,
      formatBytes: (size) => formatBytes(size, locale),
      getMultipleCurrentClassesLabel: () =>
        t("content.storage_class_change.multiple_current_classes")
    });

    if (!nextRequest) {
      return;
    }

    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setChangeStorageClassSubmitError(null);
    setChangeStorageClassRequest(nextRequest);
  }

  function handleBatchChangeTierSelection() {
    if (!batchSelectionActions.canBatchChangeTier) {
      return;
    }

    openChangeStorageClassModal(batchSelectionActions.changeTierableItems);
  }

  function startTrackedDownloadForItem(item: ContentExplorerItem) {
    if (
      item.kind !== "file" ||
      !selectedBucketProvider ||
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !selectedConnection ||
      !canDownloadItem(item, fileActionAvailabilityContext)
    ) {
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
        provider: selectedBucketProvider ?? "aws",
        transferKind: "cache",
        progressPercent: 0,
        bytesTransferred: 0,
        totalBytes: item.size ?? 0,
        state: "progress"
      }
    }));

    void (async () => {
      try {
        if (selectedBucketProvider === "aws") {
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
        } else {
          const draft = await connectionService.getAzureConnectionDraft(selectedBucketConnectionId);

          await startAzureCacheDownload(
            operationId,
            draft.storageAccountName,
            draft.accountKey.trim(),
            selectedBucketConnectionId,
            selectedConnection.name,
            selectedBucketName,
            item.path,
            globalLocalCacheDirectory
          );
        }
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

  function handleBatchDownloadSelection() {
    if (!batchSelectionActions.canBatchDownload) {
      return;
    }

    batchSelectionActions.downloadableItems.forEach((item) => {
      if (item.kind === "file") {
        startTrackedDownloadForItem(item);
      }
    });
  }

  function handleBatchRestoreSelection() {
    if (!batchSelectionActions.canBatchRestore) {
      return;
    }

    openRestoreRequestModal(batchSelectionActions.restorableItems);
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
        for (const target of restoreRequest.targets) {
          await requestAwsObjectRestore(
            draft.accessKeyId.trim(),
            draft.secretAccessKey.trim(),
            restoreRequest.bucketName,
            target.objectKey,
            target.storageClass,
            input.tier,
            input.days,
            restoreRequest.bucketRegion && restoreRequest.bucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? restoreRequest.bucketRegion
              : undefined,
            draft.restrictedBucketName
          );
        }

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

  function handleSubmitAzureRehydrationRequest(input: {
    targetTier: Exclude<AzureUploadTier, "Archive">;
    priority: AzureRehydrationPriority;
  }) {
    if (!restoreRequest || restoreRequest.provider !== "azure") {
      return;
    }

    void (async () => {
      setRestoreSubmitError(null);
      setIsSubmittingRestoreRequest(true);

      try {
        const draft = await connectionService.getAzureConnectionDraft(restoreRequest.connectionId);

        for (const target of restoreRequest.targets) {
          await rehydrateAzureBlob(
            draft.storageAccountName,
            draft.accountKey.trim(),
            restoreRequest.bucketName,
            target.objectKey,
            input.targetTier,
            input.priority
          );
        }

        setCompletionToast({
          id:
            typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
              ? globalThis.crypto.randomUUID()
              : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          title: t("restore.modal.azure.success_title"),
          description: t("restore.modal.azure.success_description")
            .replace("{count}", String(restoreRequest.targets.length))
            .replace("{tier}", input.targetTier),
          tone: "success"
        });

        setRestoreRequest(null);
        setRestoreSubmitError(null);
        await handleRefreshCurrentView();
      } catch (error) {
        setRestoreSubmitError(
          extractErrorMessage(error) ?? t("restore.modal.azure.submit_failed")
        );
      } finally {
        setIsSubmittingRestoreRequest(false);
      }
    })();
  }

  function handleSubmitChangeStorageClass(
    storageClass: AwsUploadStorageClass | AzureUploadTier
  ) {
    if (!changeStorageClassRequest || !selectedBucketConnectionId || !selectedBucketProvider) {
      return;
    }

    void (async () => {
      setChangeStorageClassSubmitError(null);
      setIsSubmittingStorageClassChange(true);

      try {
        if (changeStorageClassRequest.provider === "aws") {
          const draft = await connectionService.getAwsConnectionDraft(
            changeStorageClassRequest.connectionId
          );

          for (const target of changeStorageClassRequest.targets) {
            await changeAwsObjectStorageClass(
              draft.accessKeyId.trim(),
              draft.secretAccessKey.trim(),
              changeStorageClassRequest.bucketName,
              target.objectKey,
              storageClass as AwsUploadStorageClass,
              changeStorageClassRequest.bucketRegion &&
                changeStorageClassRequest.bucketRegion !== BUCKET_REGION_PLACEHOLDER
                ? changeStorageClassRequest.bucketRegion
                : undefined,
              draft.restrictedBucketName
            );
          }
        } else {
          const draft = await connectionService.getAzureConnectionDraft(
            changeStorageClassRequest.connectionId
          );

          for (const target of changeStorageClassRequest.targets) {
            await changeAzureBlobAccessTier(
              draft.storageAccountName,
              draft.accountKey.trim(),
              changeStorageClassRequest.bucketName,
              target.objectKey,
              storageClass as AzureUploadTier
            );
          }
        }

        setCompletionToast({
          id:
            typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
              ? globalThis.crypto.randomUUID()
              : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          title: t(
            changeStorageClassRequest.provider === "azure"
              ? "content.azure_storage_class_change.success_title"
              : "content.storage_class_change.success_title"
          ),
          description: t(
            changeStorageClassRequest.provider === "azure"
              ? "content.azure_storage_class_change.success_description"
              : "content.storage_class_change.success_description"
          )
            .replace("{count}", String(changeStorageClassRequest.targets.length))
            .replace("{storageClass}", storageClass),
          tone: "success"
        });

        setChangeStorageClassRequest(null);
        setChangeStorageClassSubmitError(null);
        await handleRefreshCurrentView();
      } catch (error) {
        setChangeStorageClassSubmitError(
          extractErrorMessage(error) ??
            t(
              changeStorageClassRequest.provider === "azure"
                ? "content.azure_storage_class_change.submit_failed"
                : "content.storage_class_change.submit_failed"
            )
        );
      } finally {
        setIsSubmittingStorageClassChange(false);
      }
    })();
  }

  function handlePreviewFileAction(actionId: FileActionId, item: ContentExplorerItem) {
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setContentActionError(null);
    const actionKind = getFileActionKind(actionId);

    if (actionKind === "provider-mutation" && actionId === "delete") {
      openDeleteContentModal([item]);
      return;
    }

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
      actionKind === "provider-mutation" &&
      actionId === "restore" &&
      canRestoreItem(item, selectedBucketProvider)
    ) {
      openRestoreRequestModal([item]);
      return;
    }

    if (
      actionKind === "provider-mutation" &&
      actionId === "changeTier" &&
      canChangeTierItem(item, selectedBucketProvider)
    ) {
      openChangeStorageClassModal([item]);
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
      if (selectedBucketProvider === "aws") {
        void openAwsCachedObject(
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          globalLocalCacheDirectory,
          item.path
        );
      } else {
        void openAzureCachedObject(
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          globalLocalCacheDirectory,
          item.path
        );
      }
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
      if (selectedBucketProvider === "aws") {
        void openAwsCachedObjectParent(
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          globalLocalCacheDirectory,
          item.path
        );
      } else {
        void openAzureCachedObjectParent(
          selectedBucketConnectionId,
          selectedConnection.name,
          selectedBucketName,
          globalLocalCacheDirectory,
          item.path
        );
      }
      return;
    }

    if (
      item.kind === "file" &&
      actionId === "downloadAs" &&
      canDownloadAsItem(item, fileActionAvailabilityContext, activeDirectDownloadItemIds) &&
      selectedBucketConnectionId &&
      selectedBucketName
    ) {
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
            provider: selectedBucketProvider ?? "aws",
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
          if (selectedBucketProvider === "aws") {
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
          } else {
            const draft = await connectionService.getAzureConnectionDraft(selectedBucketConnectionId);

            await downloadAzureBlobToPath(
              operationId,
              draft.storageAccountName,
              draft.accountKey.trim(),
              selectedBucketConnectionId,
              selectedBucketName,
              item.path,
              destinationPath
            );
          }
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
      !canDownloadItem(item, fileActionAvailabilityContext)
    ) {
      return;
    }

    startTrackedDownloadForItem(item);
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

            setActiveTransfers((currentTransfers) =>
              updateTransfersFromDownloadEvent(currentTransfers, payload)
            );
            setDownloadedFilePaths((currentPaths) =>
              reconcileDownloadedFilePathsFromDownloadEvent(currentPaths, payload)
            );
            setContentItems((currentItems) =>
              reconcileContentItemsFromDownloadEvent(currentItems, payload)
            );

            const completionToast = buildDownloadCompletionToast(payload, t);

            if (completionToast) {
              setCompletionToast(completionToast);
            } else if (shouldShowTransferError(payload) && payload.error) {
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
    let isActive = true;
    let cleanup: (() => void) | null = null;

    if (!isTauri()) {
      return undefined;
    }

    void (async () => {
      try {
        const unlisten = await listen<AzureDownloadProgressEvent>(
          "azure-download-progress",
          (event) => {
            if (!isActive) {
              return;
            }

            const payload = event.payload;

            setActiveTransfers((currentTransfers) =>
              updateTransfersFromDownloadEvent(currentTransfers, payload)
            );
            setDownloadedFilePaths((currentPaths) =>
              reconcileDownloadedFilePathsFromDownloadEvent(currentPaths, payload)
            );
            setContentItems((currentItems) =>
              reconcileContentItemsFromDownloadEvent(currentItems, payload)
            );

            const completionToast = buildDownloadCompletionToast(payload, t);

            if (completionToast) {
              setCompletionToast(completionToast);
            } else if (shouldShowTransferError(payload) && payload.error) {
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
        console.warn("[ui] failed to register azure download listener", error);
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

    getStartupAutoConnectConnections(connections).forEach((connection) => {
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

            setActiveTransfers((currentTransfers) =>
              updateTransfersFromUploadEvent(currentTransfers, payload)
            );

            const completionToast = buildUploadCompletionToast(payload, t);

            if (completionToast) {
              setCompletionToast(completionToast);

              if (
                shouldRefreshAfterUploadCompletion({
                  uploadConnectionId: payload.connectionId,
                  uploadBucketName: payload.bucketName,
                  uploadObjectKey: payload.objectKey,
                  selectedBucketConnectionId,
                  selectedBucketName,
                  selectedBucketPath
                })
              ) {
                setContentRefreshNonce((currentValue) => currentValue + 1);
              }
            } else if (shouldShowTransferError(payload) && payload.error) {
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
        const unlisten = await listen<AzureUploadProgressEvent>(
          "azure-upload-progress",
          (event) => {
            if (!isActive) {
              return;
            }

            const payload = event.payload;

            setActiveTransfers((currentTransfers) =>
              updateTransfersFromUploadEvent(currentTransfers, payload)
            );

            const completionToast = buildUploadCompletionToast(payload, t);

            if (completionToast) {
              setCompletionToast(completionToast);

              if (
                shouldRefreshAfterUploadCompletion({
                  uploadConnectionId: payload.connectionId,
                  uploadBucketName: payload.bucketName,
                  uploadObjectKey: payload.objectKey,
                  selectedBucketConnectionId,
                  selectedBucketName,
                  selectedBucketPath
                })
              ) {
                setContentRefreshNonce((currentValue) => currentValue + 1);
              }
            } else if (shouldShowTransferError(payload) && payload.error) {
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
        console.warn("[ui] failed to register azure upload listener", error);
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
            !selectedBucketProvider
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
    const toastId =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setCompletionToast(buildTransferErrorToast(toastId, description, t));
  }

  useEffect(() => {
    if (
      !selectedBucketProvider ||
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
        const cachedFileIdentities = await resolveCachedFileIdentities({
          provider: selectedBucketProvider,
          connectionId: selectedBucketConnectionId,
          connectionName: selectedConnection.name,
          bucketName: selectedBucketName,
          globalLocalCacheDirectory,
          items: contentItems,
          findAwsCachedObjects,
          findAzureCachedObjects
        });

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
      ? findTreeNodeById(treeNodes, selectedNodeId) !== null
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
        if (findTreeNodeById(treeNodes, connectionId)) {
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
    setSelectedContentItemIds([]);
    setContentAreaMenuAnchor(null);
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    setIsCreateFolderModalOpen(false);
    setNewFolderName("");
    setCreateFolderError(null);
    setIsCreatingFolder(false);
    setPendingContentDelete(null);
    setDeleteConfirmationValue("");
    setDeleteContentError(null);
    setIsDeletingContent(false);
  }, [selectedNodeId]);

  useEffect(() => {
    setSelectedContentItemIds([]);
  }, [normalizedContentFilter, contentStatusFilters]);

  useEffect(() => {
    setSelectedContentItemIds((currentItemIds) =>
      currentItemIds.filter((itemId) => contentItems.some((item) => item.id === itemId))
    );
  }, [contentItems]);

  useEffect(() => {
    if (!isContentSelectionActive) {
      return;
    }

    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
  }, [isContentSelectionActive]);

  useEffect(() => {
    async function loadContentItems() {
      if (!selectedBucketId || !selectedBucketConnectionId || !selectedBucketName || !selectedConnection) {
        contentRequestIdRef.current += 1;
        const resetState = buildContentResetState<ContentExplorerItem>();
        setContentItems(resetState.contentItems);
        setContentContinuationToken(resetState.continuationToken);
        setContentHasMore(resetState.hasMore);
        setContentError(resetState.contentError);
        setContentActionError(resetState.contentActionError ?? null);
        setLoadMoreContentError(resetState.loadMoreContentError);
        setIsLoadingContent(resetState.isLoadingContent);
        setIsLoadingMoreContent(resetState.isLoadingMoreContent);
        return;
      }

      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;
      const loadingState = buildInitialContentLoadingState<ContentExplorerItem>();
      setIsLoadingContent(loadingState.isLoadingContent);
      setIsLoadingMoreContent(loadingState.isLoadingMoreContent);
      setContentError(loadingState.contentError);
      setContentActionError(loadingState.contentActionError ?? null);
      setLoadMoreContentError(loadingState.loadMoreContentError);
      setContentContinuationToken(loadingState.continuationToken);
      setContentHasMore(loadingState.hasMore);

      try {
        const result = await listContainerItemsForSavedConnection(selectedConnection, selectedBucketName, {
          path: selectedBucketPath || undefined,
          region:
            selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
              ? selectedBucketRegion
              : undefined,
          pageSize: contentListingPageSize
        });
        const nextItems = buildContentItems(result);

        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        const nextLoadedItems = applyDownloadedFileState(
          nextItems,
          downloadedFilePathSet,
          selectedBucketConnectionId,
          selectedBucketName,
          hasValidGlobalLocalCacheDirectory
        );
        const successState = buildInitialContentSuccessState(nextLoadedItems, result);
        setContentItems(successState.contentItems);
        setContentContinuationToken(successState.continuationToken);
        setContentHasMore(successState.hasMore);
        setIsLoadingContent(successState.isLoadingContent);
        setIsLoadingMoreContent(successState.isLoadingMoreContent);
        setContentError(successState.contentError);
        setContentActionError(successState.contentActionError ?? null);
        setLoadMoreContentError(successState.loadMoreContentError);

        const nextRegion = getRegionUpdate(result.region, selectedBucketRegion, selectedBucketId);

        if (nextRegion) {
          updateBucketNode(selectedBucketConnectionId, selectedBucketId, (node) => ({
            ...node,
            region: nextRegion
          }));
        }
      } catch (error) {
        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        const message = extractErrorMessage(error) ?? t("content.list.load_error");
        const failureState = buildInitialContentFailureState<ContentExplorerItem>(message);
        setContentItems(failureState.contentItems);
        setContentContinuationToken(failureState.continuationToken);
        setContentHasMore(failureState.hasMore);
        setContentError(failureState.contentError);
        setContentActionError(failureState.contentActionError ?? null);
        setLoadMoreContentError(failureState.loadMoreContentError);
        setIsLoadingContent(failureState.isLoadingContent);
        setIsLoadingMoreContent(failureState.isLoadingMoreContent);
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
    selectedConnection,
    contentRefreshNonce,
    contentListingPageSize,
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
    appSettingsStore.save({
      globalLocalCacheDirectory: globalLocalCacheDirectory.trim() || undefined,
      contentListingPageSize
    });
  }, [contentListingPageSize, globalLocalCacheDirectory]);

  useEffect(() => {
    let isActive = true;
    const normalizedPath = globalLocalCacheDirectory.trim();

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
    const resetState = buildResetModalFormState();
    resetConnectionTestState();
    setConnectionName(resetState.connectionName);
    setConnectionProvider(resetState.connectionProvider);
    setAccessKeyId(resetState.accessKeyId);
    setSecretAccessKey(resetState.secretAccessKey);
    setRestrictedBucketName(resetState.restrictedBucketName);
    setStorageAccountName(resetState.storageAccountName);
    setAzureAuthenticationMethod(resetState.azureAuthenticationMethod);
    setAzureAccountKey(resetState.azureAccountKey);
    setConnectOnStartup(resetState.connectOnStartup);
    setDefaultAwsUploadStorageClass(resetState.defaultAwsUploadStorageClass);
    setDefaultAzureUploadTier(resetState.defaultAzureUploadTier);
    setFormErrors(resetState.formErrors);
    setSubmitError(resetState.submitError);
  }

  function handleResizeStart() {
    setIsResizingSidebar(true);
  }

  function openCreateModal() {
    const createState = buildCreateModalState();
    setModalMode(createState.modalMode);
    setEditingConnectionId(createState.editingConnectionId);
    resetForm();
    setIsModalOpen(createState.isModalOpen);
  }

  async function openEditModal(connectionId: string) {
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      setSubmitError(t("navigation.modal.load_error"));
      return;
    }

    try {
      const baseEditState = buildBaseEditModalState(connection, connectionId);
      setSubmitError(baseEditState.submitError);
      setModalMode(baseEditState.modalMode);
      setEditingConnectionId(baseEditState.editingConnectionId);
      setConnectionName(baseEditState.connectionName);
      setConnectionProvider(baseEditState.connectionProvider);
      setAccessKeyId(baseEditState.accessKeyId);
      setSecretAccessKey(baseEditState.secretAccessKey);
      setRestrictedBucketName(baseEditState.restrictedBucketName);
      setStorageAccountName(baseEditState.storageAccountName);
      setAzureAuthenticationMethod(baseEditState.azureAuthenticationMethod);
      setAzureAccountKey(baseEditState.azureAccountKey);
      setDefaultAzureUploadTier(baseEditState.defaultAzureUploadTier);
      setConnectOnStartup(baseEditState.connectOnStartup);
      setDefaultAwsUploadStorageClass(baseEditState.defaultAwsUploadStorageClass);
      resetConnectionTestState();
      setFormErrors(baseEditState.formErrors);
      setIsModalOpen(baseEditState.isModalOpen);

      if (connection.provider === "aws") {
        const draft = await connectionService.getAwsConnectionDraft(connectionId);
        const awsEditState = buildAwsEditModalState(baseEditState, draft);
        setAccessKeyId(awsEditState.accessKeyId);
        setSecretAccessKey(awsEditState.secretAccessKey);
        setRestrictedBucketName(awsEditState.restrictedBucketName);
        setConnectOnStartup(awsEditState.connectOnStartup);
        setDefaultAwsUploadStorageClass(awsEditState.defaultAwsUploadStorageClass);
        return;
      }

      const draft = await connectionService.getAzureConnectionDraft(connectionId);
      const azureEditState = buildAzureEditModalState(baseEditState, draft);
      setStorageAccountName(azureEditState.storageAccountName);
      setAzureAuthenticationMethod(azureEditState.azureAuthenticationMethod);
      setAzureAccountKey(azureEditState.azureAccountKey);
      setConnectOnStartup(azureEditState.connectOnStartup);
      setDefaultAzureUploadTier(azureEditState.defaultAzureUploadTier);
    } catch (error) {
      setSubmitError(buildModalLoadErrorMessage(error, t));
    }
  }

  function resetConnectionTestState() {
    const nextState = buildResetConnectionTestState(connectionTestRequestIdRef.current);
    connectionTestRequestIdRef.current = nextState.requestId;
    setConnectionTestStatus(nextState.status);
    setConnectionTestMessage(nextState.message);
  }

  function updateConnectionIndicator(connectionId: string, indicator: ConnectionIndicator) {
    setConnectionIndicators((previousIndicators) =>
      updateConnectionIndicatorMap(previousIndicators, connectionId, indicator)
    );
  }

  function clearConnectionBuckets(connectionId: string) {
    setConnectionBuckets((previousConnectionBuckets) =>
      clearConnectionBucketNodes(previousConnectionBuckets, connectionId)
    );
  }

  function navigateBucketPath(bucketNodeId: string, nextPath: string) {
    setBucketContentPaths((previousBucketContentPaths) =>
      setBucketPath(previousBucketContentPaths, bucketNodeId, nextPath)
    );
  }

  async function handleLoadMoreContent() {
    if (
      !selectedBucketConnectionId ||
      !selectedBucketName ||
      !selectedConnection ||
      !contentContinuationToken ||
      isLoadingContent ||
      isLoadingMoreContent
    ) {
      return;
    }

    const requestId = contentRequestIdRef.current;
    const loadMoreStartState = buildLoadMoreStartState(
      contentItems,
      contentContinuationToken,
      contentHasMore
    );
    setIsLoadingContent(loadMoreStartState.isLoadingContent);
    setIsLoadingMoreContent(loadMoreStartState.isLoadingMoreContent);
    setContentError(loadMoreStartState.contentError);
    setLoadMoreContentError(loadMoreStartState.loadMoreContentError);

    try {
      const result = await listContainerItemsForSavedConnection(selectedConnection, selectedBucketName, {
        path: selectedBucketPath || undefined,
        region:
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined,
        continuationToken: contentContinuationToken,
        pageSize: contentListingPageSize
      });
      const nextItems = buildContentItems(result);

      if (contentRequestIdRef.current !== requestId) {
        return;
      }

      const nextMergedItems = applyDownloadedFileState(
        mergeContentItems(contentItems, nextItems),
        downloadedFilePathSet,
        selectedBucketConnectionId,
        selectedBucketName,
        hasValidGlobalLocalCacheDirectory
      );
      const loadMoreSuccessState = buildLoadMoreSuccessState(nextMergedItems, result);
      setContentItems(loadMoreSuccessState.contentItems);
      setContentContinuationToken(loadMoreSuccessState.continuationToken);
      setContentHasMore(loadMoreSuccessState.hasMore);
      setIsLoadingContent(loadMoreSuccessState.isLoadingContent);
      setIsLoadingMoreContent(loadMoreSuccessState.isLoadingMoreContent);
      setContentError(loadMoreSuccessState.contentError);
      setLoadMoreContentError(loadMoreSuccessState.loadMoreContentError);

      const nextRegion = getRegionUpdate(result.region, selectedBucketRegion, selectedBucketId);

      if (nextRegion && selectedBucketId) {
        updateBucketNode(selectedBucketConnectionId, selectedBucketId, (node) => ({
          ...node,
          region: nextRegion
        }));
      }
    } catch (error) {
      if (contentRequestIdRef.current !== requestId) {
        return;
      }

      const failureState = buildLoadMoreFailureState(
        contentItems,
        contentContinuationToken,
        contentHasMore,
        extractErrorMessage(error) ?? t("content.list.load_error")
      );
      setContentItems(failureState.contentItems);
      setContentContinuationToken(failureState.continuationToken);
      setContentHasMore(failureState.hasMore);
      setIsLoadingContent(failureState.isLoadingContent);
      setIsLoadingMoreContent(failureState.isLoadingMoreContent);
      setContentError(failureState.contentError);
      setLoadMoreContentError(failureState.loadMoreContentError);
    }
  }

  async function handleRefreshCurrentView() {
    clearContentSelection();
    const refreshPlan = getRefreshPlan({
      hasSelectedNode: !!selectedNode,
      selectedNodeKind: selectedNode?.kind,
      connectionStatus: selectedConnectionIndicator.status,
      isLoadingContent,
      isLoadingMoreContent
    });

    if (refreshPlan === "reconnect-connection" && selectedNode) {
      await connectConnection(selectedNode.id);
      return;
    }

    if (refreshPlan === "reload-bucket") {
      setContentRefreshNonce((currentValue) => currentValue + 1);
    }
  }

  function updateBucketNode(
    connectionId: string,
    bucketNodeId: string,
    updater: (node: ExplorerTreeNode) => ExplorerTreeNode
  ) {
    setConnectionBuckets((previousConnectionBuckets) =>
      updateBucketNodeMap(previousConnectionBuckets, connectionId, bucketNodeId, updater)
    );
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

    const nextRequest = buildNextConnectionRequestId(connectionRequestIdsRef.current, connectionId);
    const requestId = nextRequest.requestId;
    connectionRequestIdsRef.current = nextRequest.requestIds;

    setConnectionProviderAccountIds((previousProviderAccountIds) =>
      clearConnectionProviderAccountId(previousProviderAccountIds, connectionId)
    );
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, buildConnectingIndicator());

    try {
      const result = await testConnectionForSavedConnection(connection);

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      if (!result.accountLabel) {
        updateConnectionIndicator(
          connectionId,
          buildConnectionErrorIndicator(
            connection.provider === "aws"
              ? t("navigation.modal.aws.test_connection_failure")
              : t("navigation.modal.azure.test_connection_failure")
          )
        );
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) =>
        setConnectionProviderAccountId(
          previousProviderAccountIds,
          connectionId,
          result.accountLabel
        )
      );
      const buckets = await listContainersForSavedConnection(connection);

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionBuckets((previousConnectionBuckets) => ({
        ...previousConnectionBuckets,
        [connectionId]: buildBucketNodes(connection, buckets, BUCKET_REGION_PLACEHOLDER)
      }));

      if (connection.provider === "aws") {
        const draft = await connectionService.getAwsConnectionDraft(connectionId);

        if (connectionRequestIdsRef.current[connectionId] !== requestId) {
          return;
        }

        void hydrateBucketRegions(
          connectionId,
          requestId,
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          buckets.map((bucket) => ({ name: bucket.name })),
          draft.restrictedBucketName
        );
      }

      updateConnectionIndicator(connectionId, buildConnectedIndicator());
    } catch (error) {
      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) =>
        clearConnectionProviderAccountId(previousProviderAccountIds, connectionId)
      );
      updateConnectionIndicator(
        connectionId,
        buildConnectionErrorIndicator(buildConnectionFailureMessage(error, t))
      );
      clearConnectionBuckets(connectionId);
    }
  }

  async function disconnectConnection(connectionId: string) {
    const nextRequest = buildNextConnectionRequestId(connectionRequestIdsRef.current, connectionId);
    connectionRequestIdsRef.current = nextRequest.requestIds;
    setConnectionProviderAccountIds((previousProviderAccountIds) =>
      clearConnectionProviderAccountId(previousProviderAccountIds, connectionId)
    );
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, buildDisconnectedIndicator());
  }

  async function cancelConnectionAttempt(connectionId: string) {
    const nextRequest = buildNextConnectionRequestId(connectionRequestIdsRef.current, connectionId);
    connectionRequestIdsRef.current = nextRequest.requestIds;
    setConnectionProviderAccountIds((previousProviderAccountIds) =>
      clearConnectionProviderAccountId(previousProviderAccountIds, connectionId)
    );
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, buildDisconnectedIndicator());
  }

  function toggleConnectionCollapsed(connectionId: string) {
    setCollapsedConnectionIds((currentCollapsedConnectionIds) =>
      toggleCollapsedConnection(currentCollapsedConnectionIds, connectionId)
    );
  }

  function validateConnectionTestFields(): FormErrors {
    return validateNavigationConnectionTestFields({
      provider: connectionProvider,
      accessKeyId,
      secretAccessKey,
      restrictedBucketName,
      storageAccountName,
      azureAuthenticationMethod,
      azureAccountKey,
      t
    });
  }

  async function handleTestConnection() {
    const nextErrors = validateConnectionTestFields();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const failureState = buildConnectionTestValidationFailureState(connectionProvider, t);
      setConnectionTestStatus(failureState.status);
      setConnectionTestMessage(failureState.message);
      return;
    }

    const inProgressState = buildConnectionTestInProgressState(
      connectionProvider,
      connectionTestRequestIdRef.current,
      t
    );
    setConnectionTestStatus(inProgressState.status);
    setConnectionTestMessage(inProgressState.message);
    const requestId = inProgressState.requestId;
    connectionTestRequestIdRef.current = requestId;

    try {
      if (connectionProvider === "aws") {
        const result = await testAwsConnection(
          accessKeyId.trim(),
          secretAccessKey.trim(),
          restrictedBucketName.trim() || undefined
        );

        if (connectionTestRequestIdRef.current !== requestId) {
          return;
        }

        if (!result.accountId) {
          const missingAccountState = buildConnectionTestMissingAccountState("aws", t);
          setConnectionTestStatus(missingAccountState.status);
          setConnectionTestMessage(missingAccountState.message);
          return;
        }

        const successState = buildConnectionTestSuccessState("aws", result.accountId, t);
        setConnectionTestStatus(successState.status);
        setConnectionTestMessage(successState.message);
        return;
      }

      const result = await testAzureConnection(storageAccountName.trim(), azureAccountKey.trim());

      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      if (!result.storageAccountName) {
        const missingAccountState = buildConnectionTestMissingAccountState("azure", t);
        setConnectionTestStatus(missingAccountState.status);
        setConnectionTestMessage(missingAccountState.message);
        return;
      }

      const successState = buildConnectionTestSuccessState(
        "azure",
        result.storageAccountName,
        t
      );
      setConnectionTestStatus(successState.status);
      setConnectionTestMessage(successState.message);
    } catch (error) {
      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      setConnectionTestStatus("error");
      setConnectionTestMessage(
        connectionProvider === "aws"
          ? buildConnectionFailureMessage(error, t)
          : extractErrorMessage(error) ?? t("navigation.modal.azure.test_connection_failure")
      );
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
  }

  function openUploadSettingsModal() {
    const nextState = buildOpenedUploadSettingsModalState(selectedConnection, {
      uploadSettingsStorageClass,
      uploadSettingsAzureTier
    });

    if (!nextState) {
      return;
    }

    setUploadSettingsStorageClass(nextState.uploadSettingsStorageClass);
    setUploadSettingsAzureTier(nextState.uploadSettingsAzureTier);
    setUploadSettingsSubmitError(nextState.uploadSettingsSubmitError);
    setIsUploadSettingsModalOpen(nextState.isUploadSettingsModalOpen);
    setIsSavingUploadSettings(nextState.isSavingUploadSettings);
  }

  function closeUploadSettingsModal() {
    const nextState = buildClosedUploadSettingsModalState();
    setIsUploadSettingsModalOpen(nextState.isUploadSettingsModalOpen);
    setUploadSettingsSubmitError(nextState.uploadSettingsSubmitError);
    setIsSavingUploadSettings(nextState.isSavingUploadSettings);
  }

  function openCreateFolderModal() {
    if (
      !canOpenCreateFolderModal({
        selectedNodeKind: selectedNode?.kind,
        hasSelectedBucketProvider: !!selectedBucketProvider
      })
    ) {
      return;
    }

    const nextState = buildOpenedCreateFolderModalState();
    setContentAreaMenuAnchor(nextState.contentAreaMenuAnchor);
    setNewFolderName(nextState.newFolderName);
    setCreateFolderError(nextState.createFolderError);
    setIsCreatingFolder(nextState.isCreatingFolder);
    setIsCreateFolderModalOpen(nextState.isCreateFolderModalOpen);
  }

  function closeCreateFolderModal(force = false) {
    if (!canCloseCreateFolderModal(isCreatingFolder, force)) {
      return;
    }

    const nextState = buildClosedCreateFolderModalState({
      contentAreaMenuAnchor,
      isCreatingFolder
    });
    setIsCreateFolderModalOpen(nextState.isCreateFolderModalOpen);
    setNewFolderName(nextState.newFolderName);
    setCreateFolderError(nextState.createFolderError);
  }

  async function handleCreateFolder() {
    if (
      selectedNode?.kind !== "bucket" ||
      !selectedBucketProvider ||
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
      if (selectedBucketProvider === "aws") {
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
      } else {
        const draft = await connectionService.getAzureConnectionDraft(selectedBucketConnectionId);

        await createAzureFolder(
          draft.storageAccountName,
          draft.accountKey.trim(),
          selectedBucketName,
          selectedBucketPath || undefined,
          newFolderName.trim()
        );
      }

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
    const target = event.target as HTMLElement | null;

    if (
      !shouldOpenContentAreaContextMenu({
        hasSelectedNode: !!selectedNode,
        clickedContentListItem: !!target?.closest(".content-list-item"),
        clickedContentListHeader: !!target?.closest(".content-list-header"),
        clickedTreeMenuPopup: !!target?.closest(".tree-menu-popup")
      })
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

    if (getContentAreaActionDispatchStep(actionId) === "openCreateFolder") {
      openCreateFolderModal();
      return;
    }

    await handleRefreshCurrentView();
  }

  function handleSelectHome() {
    const nextSelectionState = buildHomeSelectionState();
    setSelectedView(nextSelectionState.selectedView);
    setSelectedNodeId(nextSelectionState.selectedNodeId);
    setOpenMenuConnectionId(nextSelectionState.openMenuConnectionId);
  }

  function handleSelectNode(node: ExplorerTreeNode) {
    if (node.kind === "bucket") {
      navigateBucketPath(node.id, "");
    }

    const nextSelectionState = buildNodeSelectionState(node.id);
    setSelectedView(nextSelectionState.selectedView);
    setSelectedNodeId(nextSelectionState.selectedNodeId);
    setOpenMenuConnectionId(nextSelectionState.openMenuConnectionId);
  }

  function validateForm(): FormErrors {
    return validateNavigationConnectionForm({
      provider: connectionProvider,
      connectionName,
      connections,
      modalMode,
      editingConnectionId,
      accessKeyId,
      secretAccessKey,
      restrictedBucketName,
      storageAccountName,
      azureAuthenticationMethod,
      azureAccountKey,
      t
    });
  }

  async function handleSaveConnection() {
    const nextErrors = validateForm();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedConnection =
        connectionProvider === "aws"
          ? await connectionService.saveAwsConnection({
              id: modalMode === "edit" ? editingConnectionId ?? undefined : undefined,
              name: connectionName,
              provider: "aws",
              accessKeyId,
              secretAccessKey: secretAccessKey.trim(),
              restrictedBucketName,
              connectOnStartup,
              defaultUploadStorageClass: defaultAwsUploadStorageClass
            } satisfies AwsConnectionDraft)
          : await connectionService.saveAzureConnection({
              id: modalMode === "edit" ? editingConnectionId ?? undefined : undefined,
              name: connectionName,
              provider: "azure",
              storageAccountName,
              authenticationMethod: azureAuthenticationMethod,
              accountKey: azureAccountKey.trim(),
              connectOnStartup,
              defaultUploadTier: defaultAzureUploadTier
            });

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
    if (!selectedConnection) {
      return;
    }

    setIsSavingUploadSettings(true);
    setUploadSettingsSubmitError(null);

    try {
      if (selectedConnection.provider === "aws") {
        await connectionService.updateAwsUploadStorageClass(
          selectedConnection.id,
          uploadSettingsStorageClass
        );
      } else {
        await connectionService.updateAzureUploadTier(
          selectedConnection.id,
          uploadSettingsAzureTier
        );
      }
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
    const nextState = buildPendingRemoveConnectionState(connectionId);
    setPendingDeleteConnectionId(nextState.pendingDeleteConnectionId);
    setOpenMenuConnectionId(nextState.openMenuConnectionId);
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
      setSubmitError(buildConnectionDeleteErrorMessage(error, t));
    }
  }

  async function handleConnectionAction(
    actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
    connectionId: string
  ) {
    for (const step of getConnectionActionDispatchSteps(actionId)) {
      if (step === "closeMenu") {
        setOpenMenuConnectionId(null);
      } else if (step === "connect") {
        await connectConnection(connectionId);
      } else if (step === "cancelConnect") {
        await cancelConnectionAttempt(connectionId);
      } else if (step === "disconnect") {
        await disconnectConnection(connectionId);
      } else if (step === "edit") {
        await openEditModal(connectionId);
      } else if (step === "remove") {
        await handleRemoveConnection(connectionId);
      }
    }
  }

  async function handleDefaultConnectionAction(connectionId: string) {
    const indicator = connectionIndicators[connectionId] ?? { status: "disconnected" };
    const nextStep = getDefaultConnectionActionStep({ status: indicator.status });

    if (nextStep === "edit") {
      await openEditModal(connectionId);
    } else if (nextStep === "connect") {
      await connectConnection(connectionId);
    }
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
              !selectedBucketProvider
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
                            const summaryItem = contentStatusSummaryMap.get(status);
                            const label = summaryItem?.label ?? t(`content.filter.status.${status}`);
                            const count = summaryItem?.count ?? 0;

                            return (
                              <button
                                key={status}
                                type="button"
                                className={`content-status-filter-button${
                                  isSelected ? " is-selected" : ""
                                }`}
                                aria-pressed={isSelected}
                                title={`${label}: ${count}`}
                                onClick={() => toggleContentStatusFilter(status)}
                              >
                                <ContentCounterStatus status={status} label={label} count={count} />
                              </button>
                            );
                          })}
                        </div>
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
            <div className="home-card home-stage">
              <section className="home-hero">
                <div className="home-hero-copy">
                  <div className="home-brand">
                    <img src={logoPrimary} alt="" className="home-logo" />

                    <div>
                      <p className="eyebrow home-eyebrow">{t("hero.eyebrow")}</p>
                      <h2 className="home-title">{t("app.title")}</h2>
                    </div>
                  </div>

                  <p className="home-kicker">{t("home.hero.kicker")}</p>
                  <p className="home-display">{t("home.hero.title")}</p>
                  <p className="home-lead">{t("home.hero.body")}</p>
                </div>

                <div className="home-hero-visual" aria-hidden="true">
                  <div className="home-visual-orbit home-visual-orbit-primary" />
                  <div className="home-visual-orbit home-visual-orbit-secondary" />
                  <div className="home-visual-grid" />
                  <div className="home-visual-badge home-visual-badge-top">
                    <Cloud size={16} strokeWidth={2} />
                    <span>{t("home.visual.badge_primary")}</span>
                  </div>
                  <div className="home-visual-core">
                    <div className="home-visual-provider-card home-visual-provider-card-aws">
                      <span>{t("home.visual.aws.label")}</span>
                      <strong>{t("home.visual.aws.value")}</strong>
                    </div>
                    <div className="home-visual-provider-card home-visual-provider-card-azure">
                      <span>{t("home.visual.azure.label")}</span>
                      <strong>{t("home.visual.azure.value")}</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="home-support-grid">
                <div className="home-settings-panel">
                  <div className="home-panel-header">
                    <Settings size={18} strokeWidth={2} />
                    <div>
                      <p className="home-panel-eyebrow">{t("home.settings.eyebrow")}</p>
                      <h3>{t("home.settings.title")}</h3>
                    </div>
                  </div>

                  <label
                    className="field-group compact-field-group home-locale-field"
                    htmlFor={localeFieldId}
                  >
                    <span className="home-field-label">
                      <Globe2Icon />
                      <span>{t("settings.language")}</span>
                    </span>
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

                  <label
                    className="field-group compact-field-group home-settings-path-field"
                    htmlFor="content-listing-page-size"
                  >
                    <span className="home-field-label">
                      <Database size={16} strokeWidth={2} />
                      <span>{t("settings.content_listing_page_size")}</span>
                    </span>
                    <div className="path-picker-row">
                      <input
                        id="content-listing-page-size"
                        type="number"
                        min={MIN_CONTENT_LISTING_PAGE_SIZE}
                        max={MAX_CONTENT_LISTING_PAGE_SIZE}
                        step={1}
                        value={contentListingPageSize}
                        onChange={(event) => {
                          const parsedValue = Number(event.target.value);
                          setContentListingPageSize(normalizeContentListingPageSize(parsedValue));
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setContentListingPageSize(DEFAULT_CONTENT_LISTING_PAGE_SIZE)
                        }
                        disabled={
                          contentListingPageSize === DEFAULT_CONTENT_LISTING_PAGE_SIZE
                        }
                      >
                        {t("common.reset")}
                      </button>
                    </div>
                    <span className="field-helper">
                      {t("settings.content_listing_page_size_helper")
                        .replace("{default}", String(DEFAULT_CONTENT_LISTING_PAGE_SIZE))
                        .replace("{min}", String(MIN_CONTENT_LISTING_PAGE_SIZE))
                        .replace("{max}", String(MAX_CONTENT_LISTING_PAGE_SIZE))}
                    </span>
                  </label>

                  <label
                    className="field-group compact-field-group home-settings-path-field"
                    htmlFor={globalCacheDirectoryFieldId}
                  >
                    <span className="home-field-label">
                      <Folder size={16} strokeWidth={2} />
                      <span>{t("settings.download_directory")}</span>
                    </span>
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
                    ) : (
                      <div className="home-inline-success">
                        <CheckCircle2 size={16} strokeWidth={2} />
                        <p>{t("home.settings.path_status_ready")}</p>
                      </div>
                    )}
                  </label>
                </div>

                <div className="home-notice-panel" role="alert">
                  <div className="home-panel-header">
                    <CircleAlert size={18} strokeWidth={2} />
                    <div>
                      <p className="home-panel-eyebrow">{t("home.cost_notice.eyebrow")}</p>
                      <h3>{t("home.cost_notice.title")}</h3>
                    </div>
                  </div>
                  <p>{t("home.cost_notice.body")}</p>
                </div>
              </section>

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
                              {contentViewMode === "compact" ? (
                                <>
                                  <span className="content-list-item-main">
                                    {renderCompactBucketTopline(bucketNode.region)}
                                    <span className="content-list-item-copy">
                                      <strong title={bucketNode.name}>{bucketNode.name}</strong>
                                    </span>
                                  </span>
                                  <span className="content-list-item-compact-footer">
                                    <span className="content-list-item-topline-label">
                                      {t("content.type.s3_bucket")}
                                    </span>
                                    <span className="content-list-item-compact-footer-end" />
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="content-list-item-main">
                                    <span className="content-list-item-icon content-list-item-icon-bucket">
                                      <Database size={18} strokeWidth={1.9} />
                                    </span>
                                    <span className="content-list-item-copy">
                                      <strong>{bucketNode.name}</strong>
                                    </span>
                                  </span>
                                  <span className="content-list-item-column">
                                    {bucketNode.region ?? ""}
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
                  <div className="content-selection-toolbar">
                    <div className="content-selection-toolbar-main">
                      <label className="content-selection-toggle">
                        <input
                          type="checkbox"
                          checked={allVisibleContentItemsSelected}
                          onChange={() => toggleSelectAllVisibleContentItems()}
                          disabled={visibleContentItemIds.length === 0}
                        />
                        <span>
                          {t("content.selection.select_visible").replace(
                            "{count}",
                            String(visibleContentItemIds.length)
                          )}
                        </span>
                      </label>
                      <strong className="content-selection-count">
                        {t("content.selection.count").replace(
                          "{count}",
                          String(selectedContentCount)
                        )}
                      </strong>
                      <div className="content-selection-toolbar-actions">
                      <button
                        type="button"
                        className="content-load-more-button content-load-more-button-icon"
                        onClick={handleBatchChangeTierSelection}
                        disabled={!batchSelectionActions.canBatchChangeTier}
                        title={getBatchChangeTierTooltip({
                          items: selectedContentItems,
                          provider: selectedBucketProvider,
                          isContentSelectionActive,
                          canBatchChangeTier: batchSelectionActions.canBatchChangeTier,
                          t
                        })}
                        aria-label={t("navigation.menu.change_tier")}
                      >
                        <Settings size={15} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="content-load-more-button content-load-more-button-icon"
                        onClick={handleBatchDownloadSelection}
                        disabled={!batchSelectionActions.canBatchDownload}
                        title={t("navigation.menu.download")}
                        aria-label={t("navigation.menu.download")}
                      >
                        <Download size={15} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="content-load-more-button content-load-more-button-icon"
                        onClick={handleBatchRestoreSelection}
                        disabled={!batchSelectionActions.canBatchRestore}
                        title={t("navigation.menu.restore")}
                        aria-label={t("navigation.menu.restore")}
                      >
                        <LoaderCircle size={15} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="content-load-more-button content-load-more-button-icon"
                        onClick={() => openDeleteContentModal(selectedContentItems)}
                        disabled={!batchSelectionActions.canBatchDelete}
                        title={t("content.delete.action")}
                        aria-label={t("content.delete.action")}
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                      </div>
                    </div>

                    <div className="content-selection-toolbar-context-actions">
                      {canCreateFolderInCurrentContext ? (
                        <button
                          type="button"
                          className="content-load-more-button content-load-more-button-icon"
                          onClick={openCreateFolderModal}
                          disabled={isLoadingContent || isLoadingMoreContent}
                          title={t("content.folder.create_button")}
                          aria-label={t("content.folder.create_button")}
                        >
                          <FolderPlus size={15} strokeWidth={2} />
                        </button>
                      ) : null}
                      {selectedNode.kind === "bucket" ? (
                        <span className="content-toolbar-divider" aria-hidden="true" />
                      ) : null}
                      {selectedNode.kind === "bucket" ? (
                        <button
                          type="button"
                          className="content-load-more-button content-load-more-button-icon"
                          onClick={handlePickUploadFile}
                          disabled={!isTauri() || isLoadingContent || isLoadingMoreContent}
                          title={t("content.transfer.upload_button")}
                          aria-label={t("content.transfer.upload_button")}
                        >
                          <Upload size={15} strokeWidth={2} />
                        </button>
                      ) : null}
                      {selectedBucketProvider && selectedNode.kind === "bucket" ? (
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
                    </div>
                  </div>
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
                        <div className="content-list-header content-list-header-files">
                          <span aria-hidden="true" />
                          <span>{t("navigation.modal.name_label")}</span>
                          <span>{t("content.detail.storage_class")}</span>
                          <span>{t("content.detail.local_state")}</span>
                          <span>{t("content.detail.type")}</span>
                          <span>{t("content.detail.size")}</span>
                          <span>{t("content.detail.last_modified")}</span>
                        </div>
                      ) : null}

                      <div
                        className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}
                      >
                        {filteredContentItems.map((item) =>
                          item.kind === "directory" ? (
                            <div
                              key={item.id}
                              className={`content-list-item content-list-item-action content-list-item-file-row${contentViewMode === "compact" ? " is-compact" : ""}${
                                selectedContentItemIdSet.has(item.id) ? " is-selected" : ""
                              }`}
                              onContextMenu={(event) => {
                                if (isContentSelectionActive) {
                                  return;
                                }

                                event.preventDefault();
                                setOpenContentMenuItemId(item.id);
                                setContentMenuAnchor({
                                  itemId: item.id,
                                  x: event.clientX,
                                  y: event.clientY
                                });
                              }}
                            >
                              {contentViewMode === "compact" ? null : (
                                <label
                                  className="content-list-item-checkbox"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedContentItemIdSet.has(item.id)}
                                    onChange={() => toggleContentItemSelection(item.id)}
                                    aria-label={t("content.selection.select_item").replace(
                                      "{name}",
                                      item.name
                                    )}
                                  />
                                </label>
                              )}
                              <button
                                type="button"
                                className={`content-list-item-main-button${
                                  contentViewMode === "compact" ? " is-compact" : ""
                                }`}
                                onClick={() => {
                                  navigateBucketPath(selectedNode.id, item.path);
                                }}
                              >
                                {contentViewMode === "compact" ? (
                                  <span className="content-list-item-main">
                                    {renderCompactItemTopline(item)}
                                    <span className="content-list-item-copy content-list-item-copy-directory">
                                      <strong title={item.name}>{item.name}</strong>
                                    </span>
                                  </span>
                                ) : (
                                  <>
                                    <span className="content-list-item-main">
                                      <span className="content-list-item-icon content-list-item-icon-directory">
                                        <Folder size={18} strokeWidth={1.9} />
                                      </span>
                                      <span className="content-list-item-copy content-list-item-copy-directory">
                                        <strong>{item.name}</strong>
                                      </span>
                                    </span>
                                    <span className="content-list-item-column">-</span>
                                    <span className="content-list-item-column">-</span>
                                    <span className="content-list-item-column">
                                      {t("content.type.directory")}
                                    </span>
                                    <span className="content-list-item-column content-list-item-column-end">-</span>
                                    <span className="content-list-item-column content-list-item-column-end">-</span>
                                  </>
                                )}
                              </button>

                              {contentViewMode === "compact" ? (
                                <>
                                  <span className="content-list-item-compact-footer">
                                    <span className="content-list-item-topline-label">
                                      {getCompactFigureLabel(item)}
                                    </span>
                                    <label
                                      className="content-list-item-checkbox"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedContentItemIdSet.has(item.id)}
                                        onChange={() => toggleContentItemSelection(item.id)}
                                        aria-label={t("content.selection.select_item").replace(
                                          "{name}",
                                          item.name
                                        )}
                                      />
                                    </label>
                                  </span>
                                  <span className="content-list-item-actions">
                                    <ContentItemMenu
                                      item={item}
                                      canRestore={false}
                                      canChangeTier={false}
                                      canDownload={false}
                                      canDownloadAs={false}
                                      canCancelDownload={false}
                                      canOpenFile={false}
                                      canOpenInExplorer={false}
                                      canDelete={!!selectedBucketProvider}
                                      isOpen={openContentMenuItemId === item.id}
                                      showTrigger={false}
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
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <div
                              key={item.id}
                              className={`content-list-item content-list-item-action content-list-item-file-row${
                                contentViewMode === "compact" ? " is-compact" : ""
                              }${selectedContentItemIdSet.has(item.id) ? " is-selected" : ""}`}
                              onClick={(event) => {
                                if (isContentSelectionActive) {
                                  return;
                                }

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
                              {contentViewMode === "compact" ? null : (
                                <label
                                  className="content-list-item-checkbox"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedContentItemIdSet.has(item.id)}
                                    onChange={() => toggleContentItemSelection(item.id)}
                                    aria-label={t("content.selection.select_item").replace(
                                      "{name}",
                                      item.name
                                    )}
                                  />
                                </label>
                              )}
                              <span className="content-list-item-main">
                                {contentViewMode === "compact" ? (
                                  renderCompactItemTopline(item)
                                ) : (
                                  <span className="content-list-item-icon content-list-item-icon-file">
                                    <File size={18} strokeWidth={1.9} />
                                  </span>
                                )}
                                <span className="content-list-item-copy content-list-item-copy-file">
                                  <strong title={contentViewMode === "compact" ? item.name : undefined}>
                                    {item.name}
                                  </strong>
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
                                </span>
                              </span>

                              {contentViewMode === "compact" ? null : (
                                <>
                                  <span className="content-list-item-column">
                                    {item.storageClass ?? "-"}
                                  </span>
                                  <span className="content-list-item-column content-list-item-column-status">
                                    {item.availabilityStatus && item.downloadState
                                      ? getPreferredFileStatusBadgeDescriptors(item, locale, t).map(
                                          (descriptor, index) => (
                                            <FileStatusBadge
                                              key={`${descriptor.status}-${index}`}
                                              label={descriptor.label}
                                              status={descriptor.status}
                                              title={descriptor.title}
                                            />
                                          )
                                        )
                                      : "-"}
                                  </span>
                                  <span className="content-list-item-column">
                                    {t("content.type.file")}
                                  </span>
                                  <span className="content-list-item-column content-list-item-column-end">
                                    {formatBytes(item.size, locale)}
                                  </span>
                                  <span className="content-list-item-column content-list-item-column-end">
                                    {formatDateTime(item.lastModified, locale)}
                                  </span>
                                </>
                              )}

                              {contentViewMode === "compact" ? (
                                <span className="content-list-item-compact-footer">
                                  <span className="content-list-item-topline-label">
                                    {getCompactFigureLabel(item)}
                                  </span>
                                  <label
                                    className="content-list-item-checkbox"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedContentItemIdSet.has(item.id)}
                                      onChange={() => toggleContentItemSelection(item.id)}
                                      aria-label={t("content.selection.select_item").replace(
                                        "{name}",
                                        item.name
                                      )}
                                    />
                                  </label>
                                </span>
                              ) : null}
                              <span className="content-list-item-actions">
                                <ContentItemMenu
                                  item={item}
                                  canRestore={canRestoreItem(item, selectedBucketProvider)}
                                  canChangeTier={canChangeTierItem(item, selectedBucketProvider)}
                                  canDownload={canDownloadItem(item, fileActionAvailabilityContext)}
                                  canDownloadAs={canDownloadAsItem(
                                    item,
                                    fileActionAvailabilityContext,
                                    activeDirectDownloadItemIds
                                  )}
                                  canCancelDownload={
                                    selectedBucketConnectionId && selectedBucketName
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
                                  canDelete={!!selectedBucketProvider}
                                  isOpen={openContentMenuItemId === item.id}
                                  showTrigger={false}
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
                  <p className="content-list-counter">{contentCounterLabel}</p>
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
          request={restoreRequest.request}
          isSubmitting={isSubmittingRestoreRequest}
          submitError={restoreSubmitError}
          onCancel={closeRestoreRequestModal}
          onSubmitAwsRequest={handleSubmitAwsRestoreRequest}
          onSubmitAzureRequest={handleSubmitAzureRehydrationRequest}
          t={t}
        />
      ) : null}

      {changeStorageClassRequest ? (
        <ChangeStorageClassModal
          provider={changeStorageClassRequest.provider}
          locale={locale}
          request={changeStorageClassRequest.request}
          initialStorageClass={changeStorageClassRequest.currentStorageClass}
          isSubmitting={isSubmittingStorageClassChange}
          submitError={changeStorageClassSubmitError}
          onCancel={closeChangeStorageClassModal}
          onSubmit={handleSubmitChangeStorageClass}
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
                        {getTransferCancelLabel(download.transferKind, t)}
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
            className="modal-card modal-card-wide"
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
                      disabled={modalMode === "edit"}
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
                    <AzureConnectionFields
                      storageAccountNameFieldId={storageAccountNameFieldId}
                      authenticationMethodFieldId={azureAuthenticationMethodFieldId}
                      accountKeyFieldId={azureAccountKeyFieldId}
                      connectOnStartupFieldId={connectOnStartupFieldId}
                      storageAccountName={storageAccountName}
                      authenticationMethod={azureAuthenticationMethod}
                      accountKey={azureAccountKey}
                      connectOnStartup={connectOnStartup}
                      defaultUploadTier={defaultAzureUploadTier}
                      errors={{
                        storageAccountName: formErrors.storageAccountName,
                        authenticationMethod: formErrors.authenticationMethod,
                        accountKey: formErrors.accountKey
                      }}
                      onStorageAccountNameChange={(value) => {
                        setStorageAccountName(value);
                        resetConnectionTestState();
                      }}
                      onAuthenticationMethodChange={(value) => {
                        setAzureAuthenticationMethod(value);
                        resetConnectionTestState();
                      }}
                      onAccountKeyChange={(value) => {
                        setAzureAccountKey(value);
                        resetConnectionTestState();
                      }}
                      onConnectOnStartupChange={setConnectOnStartup}
                      onDefaultUploadTierChange={setDefaultAzureUploadTier}
                      t={t}
                    />
                  )}

                  {submitError ? <p className="status-message-error">{submitError}</p> : null}
                </div>
              </div>

              <div className="connection-modal-footer">
                <div className="connection-test-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isSubmitting || connectionTestStatus === "testing"}
                    onClick={handleTestConnection}
                    title={t(
                      connectionProvider === "aws"
                        ? "navigation.modal.aws.test_connection_helper"
                        : "navigation.modal.azure.test_connection_helper"
                    )}
                  >
                    {t(
                      connectionProvider === "aws"
                        ? "navigation.modal.aws.test_connection_button"
                        : "navigation.modal.azure.test_connection_button"
                    )}
                  </button>

                  {connectionTestStatus !== "idle" ? (
                    <span
                      className={`connection-test-status-icon is-${connectionTestStatus}`}
                      title={`${t(
                        `navigation.modal.${connectionProvider}.test_connection_status.${connectionTestStatus}`
                      )}${connectionTestMessage ? `: ${connectionTestMessage}` : ""}`}
                      aria-label={`${t(
                        `navigation.modal.${connectionProvider}.test_connection_status.${connectionTestStatus}`
                      )}${connectionTestMessage ? `: ${connectionTestMessage}` : ""}`}
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

                <div className="modal-actions modal-actions-inline">
                  <button type="button" className="secondary-button" onClick={closeModal}>
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmitting}
                  >
                    {modalMode === "edit" ? t("common.update") : t("common.save")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUploadSettingsModalOpen && selectedConnection ? (
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
                  {selectedConnection.provider === "aws" ? (
                    <AwsUploadStorageClassField
                      locale={locale}
                      value={uploadSettingsStorageClass}
                      onChange={setUploadSettingsStorageClass}
                    />
                  ) : (
                    <AzureUploadTierField
                      value={uploadSettingsAzureTier}
                      onChange={setUploadSettingsAzureTier}
                    />
                  )}

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

      {pendingContentDelete ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-content-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("content.delete.eyebrow")}</p>
                <h2 id="delete-content-modal-title" className="modal-title">
                  {pendingContentDelete.items.length === 1
                    ? t(
                        pendingContentDelete.directoryCount === 1
                          ? "content.delete.title_single_folder"
                          : "content.delete.title_single_file"
                      ).replace("{name}", pendingContentDelete.items[0]?.name ?? "")
                    : t("content.delete.title_batch").replace(
                        "{count}",
                        String(pendingContentDelete.items.length)
                      )}
                </h2>
              </div>
            </div>

            <div className="modal-scroll-panel">
              <div className="modal-scroll-viewport">
                <p className="modal-copy">
                  {pendingContentDelete.directoryCount > 0
                    ? t("content.delete.description_recursive")
                        .replace("{files}", String(pendingContentDelete.fileCount))
                        .replace("{folders}", String(pendingContentDelete.directoryCount))
                    : t("content.delete.description_files").replace(
                        "{count}",
                        String(pendingContentDelete.fileCount)
                      )}
                </p>
                <p className="modal-copy">
                  {t("content.delete.confirmation_instruction").replace(
                    "{value}",
                    CONTENT_DELETE_CONFIRMATION_TEXT
                  )}
                </p>
                <label className="field-group" htmlFor="delete-content-confirmation-input">
                  <span>{t("content.delete.confirmation_label")}</span>
                  <input
                    id="delete-content-confirmation-input"
                    type="text"
                    value={deleteConfirmationValue}
                    onChange={(event) => {
                      setDeleteConfirmationValue(event.target.value);
                      if (deleteContentError) {
                        setDeleteContentError(null);
                      }
                    }}
                    autoFocus
                  />
                </label>

                <div className="content-delete-summary">
                  <span>
                    <File size={14} strokeWidth={1.9} />
                    {t("content.delete.summary_files").replace(
                      "{count}",
                      String(pendingContentDelete.fileCount)
                    )}
                  </span>
                  <span>
                    <Folder size={14} strokeWidth={1.9} />
                    {t("content.delete.summary_folders").replace(
                      "{count}",
                      String(pendingContentDelete.directoryCount)
                    )}
                  </span>
                </div>

                {deleteContentError ? (
                  <p className="status-message-error">{deleteContentError}</p>
                ) : null}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => closeDeleteContentModal()}
                disabled={isDeletingContent}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-danger"
                onClick={() => {
                  void handleConfirmDeleteContent();
                }}
                disabled={
                  isDeletingContent ||
                  deleteConfirmationValue.trim() !== CONTENT_DELETE_CONFIRMATION_TEXT
                }
              >
                {isDeletingContent ? t("content.delete.deleting") : t("content.delete.action")}
              </button>
            </div>
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
  canChangeTier: boolean;
  canDownload: boolean;
  canDownloadAs: boolean;
  canCancelDownload: boolean;
  canOpenFile: boolean;
  canOpenInExplorer: boolean;
  canDelete: boolean;
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
  canChangeTier,
  canDownload,
  canDownloadAs,
  canCancelDownload,
  canOpenFile,
  canOpenInExplorer,
  canDelete,
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
          {item.kind === "file" ? (
            <>
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
              <button
                type="button"
                className="tree-menu-action"
                role="menuitem"
                disabled={!canChangeTier}
                onClick={(event) => {
                  event.stopPropagation();
                  onAction("changeTier", item);
                }}
              >
                {t("navigation.menu.change_tier")}
              </button>
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
            </>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="tree-menu-action tree-menu-action-danger"
              role="menuitem"
              onClick={(event) => {
                event.stopPropagation();
                onAction("delete", item);
              }}
            >
              {t("content.delete.action")}
            </button>
          ) : null}
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
    icon = <Snowflake size={12} strokeWidth={2} />;
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
  status: "directory" | "available" | "downloaded" | "archived" | "restoring";
  label: string;
  count: number;
};

function ContentCounterStatus({ status, label, count }: ContentCounterStatusProps) {
  let icon = <CircleAlert size={12} strokeWidth={2} />;

  if (status === "directory") {
    icon = <Folder size={12} strokeWidth={2} />;
  } else if (status === "available") {
    icon = <Cloud size={12} strokeWidth={2} />;
  } else if (status === "downloaded") {
    icon = <Cloud size={12} strokeWidth={2} className="is-filled" />;
  } else if (status === "archived") {
    icon = <Snowflake size={12} strokeWidth={2} />;
  } else if (status === "restoring") {
    icon = <LoaderCircle size={12} strokeWidth={2} className="content-counter-status-spinner" />;
  }

  return (
    <span className={`content-counter-status content-counter-status-${status}`} title={label}>
      {icon}
      <strong>{count}</strong>
    </span>
  );
}

type CompactFileStatusIconsProps = {
  item: ContentExplorerItem;
  locale: Locale;
  t: (key: string) => string;
};

function CompactFileStatusIcons({ item, locale, t }: CompactFileStatusIconsProps) {
  const items = getPreferredFileStatusBadgeDescriptors(item, locale, t).map((descriptor) => ({
    icon:
      descriptor.status === "downloaded" ? (
        <Cloud size={12} strokeWidth={2} className="is-filled" />
      ) : descriptor.status === "available" ? (
        <Cloud size={12} strokeWidth={2} />
      ) : descriptor.status === "restoring" ? (
        <LoaderCircle size={12} strokeWidth={2} />
      ) : (
        <Snowflake size={12} strokeWidth={2} />
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
    <span
      className={`content-file-status-icons${items.length > 1 ? " has-multiple" : ""}`}
      aria-label={t("content.detail.local_state")}
    >
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
