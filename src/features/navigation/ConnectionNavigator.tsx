import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { useNavigationPreferencesState } from "./hooks/useNavigationPreferencesState";
import { useTransferState } from "./hooks/useTransferState";
import { useModalOrchestrationState } from "./hooks/useModalOrchestrationState";
import { useConnectionFormState } from "./hooks/useConnectionFormState";
import {
  ALL_CONTENT_STATUS_FILTERS,
  type ContentStatusFilter,
  useContentListingState
} from "./hooks/useContentListingState";
import {
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
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  X
} from "lucide-react";
import logoPrimary from "../../assets/logo-primary.svg";
import { ContentExplorerHeader } from "./components/ContentExplorerHeader";
import { ContentItemList } from "./components/ContentItemList";
import { ConnectionsSidebar } from "./components/ConnectionsSidebar";
import { FilePreviewPanel } from "./components/FilePreviewPanel";
import { NavigatorModalOrchestrator } from "./components/NavigatorModalOrchestrator";
import type { AwsUploadStorageClass } from "../connections/awsUploadStorageClasses";
import type { AzureUploadTier } from "../connections/azureUploadTiers";
import {
  DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  MAX_CONTENT_LISTING_PAGE_SIZE,
  MIN_CONTENT_LISTING_PAGE_SIZE,
  normalizeContentListingPageSize
} from "../settings/persistence/appSettingsStore";
import type {
  AwsConnectionDraft,
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
import {
  type CloudContainerItemsResult,
  type CloudContainerSummary,
  listContainerItemsForSavedConnection,
  listContainersForSavedConnection,
  previewObjectForSavedConnection,
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
  buildClosedChangeStorageClassModalState,
  buildClosedRestoreRequestModalState,
  buildChangeStorageClassRequestState,
  buildOpenedChangeStorageClassModalState,
  buildOpenedRestoreRequestModalState,
  buildRestoreRequestState,
  getBatchChangeTierTooltip,
  type NavigationChangeStorageClassRequestState as ChangeStorageClassRequestState,
  type NavigationRestoreRequestState as RestoreRequestState
} from "./navigationWorkflows";
import {
  buildBatchDownloadPlan,
  applyDownloadedFileState,
  reconcileDownloadedFilePathsForContext,
  resolveDownloadState
} from "./navigationDownloads";
import {
  buildContentItems,
  buildPreviewFileState,
  isArchivedStorageClass,
  mergeContentItems,
  type NavigationContentExplorerItem as ContentExplorerItem
} from "./navigationContent";
import {
  buildInitialFilePreviewState,
  getFilePreviewSupport
} from "./navigationFilePreview";
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
  buildAwsEditModalState,
  buildAzureEditModalState,
  buildBaseEditModalState,
  buildCreateModalState,
  buildModalLoadErrorMessage,
  buildResetModalFormState
} from "./navigationModalState";
import {
  executeConnectionActionDispatch,
  executeContentAreaActionDispatch,
  executeDefaultConnectionAction,
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
  buildDeleteContentFailureState,
  buildDeleteContentSuccessState,
  buildClosedUploadSettingsModalState,
  buildConnectionDeleteErrorMessage,
  buildOpenedUploadSettingsModalState,
  buildPendingRemoveConnectionState
} from "./navigationSecondaryModalState";
import { resolveCachedFileIdentities } from "./navigationCacheState";
import {
  buildDownloadCompletionToast,
  getTransferCancellationTarget,
  resolveTransferCancellationErrorMessage,
  buildUploadCompletionToast,
  reconcileContentItemsFromDownloadEvent,
  reconcileDownloadedFilePathsFromDownloadEvent,
  shouldShowTransferError,
  updateTransfersFromDownloadEvent,
  updateTransfersFromUploadEvent,
  type NavigationActiveTransfer as ActiveTransfer,
  type NavigationCompletionToast as CompletionToast,
  type NavigationTransferKind as TransferKind
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
  collectDroppedFiles,
  resolveDirectoryPickerDefaultPath,
  resolveMultiFilePickResult,
  resolveSingleDirectoryPickResult
} from "./navigationFileInput";
import {
  buildContentSelectionState,
  clearContentSelectionState,
  toggleAllVisibleContentSelection,
  toggleContentSelectionItem
} from "./navigationSelectionState";
import {
  buildContentCounts,
  buildContentStatusSummaryItems,
  countLoadedItemsByStatus,
  filterConnectionBuckets,
  filterContentItems,
  isContentFilterActive as deriveIsContentFilterActive,
  isContentStatusFilterInactive
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
type ConnectionIndicatorStatus = "disconnected" | "connecting" | "connected" | "error";
const CONNECTING_CONNECTION_TITLE_KEY = "navigation.connection_status.connecting";
const CONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.connected";
const DISCONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.disconnected";
const BUCKET_REGION_PLACEHOLDER = "...";
const MAX_BUCKET_REGION_REQUESTS = 4;
type ConnectionIndicator = {
  status: ConnectionIndicatorStatus;
  message?: string;
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
  const {
    isModalOpen,
    modalMode,
    editingConnectionId,
    connectionName,
    connectionProvider,
    accessKeyId,
    secretAccessKey,
    restrictedBucketName,
    storageAccountName,
    azureAuthenticationMethod,
    azureAccountKey,
    connectOnStartup,
    defaultAwsUploadStorageClass,
    defaultAzureUploadTier,
    connectionTestStatus,
    connectionTestMessage,
    formErrors,
    submitError,
    isSubmitting,
    setIsModalOpen,
    setModalMode,
    setEditingConnectionId,
    setConnectionName,
    setConnectionProvider,
    setAccessKeyId,
    setSecretAccessKey,
    setRestrictedBucketName,
    setStorageAccountName,
    setAzureAuthenticationMethod,
    setAzureAccountKey,
    setConnectOnStartup,
    setDefaultAwsUploadStorageClass,
    setDefaultAzureUploadTier,
    setConnectionTestStatus,
    setConnectionTestMessage,
    setFormErrors,
    setSubmitError,
    setIsSubmitting
  } = useConnectionFormState();
  const {
    globalLocalCacheDirectory,
    contentListingPageSize,
    contentViewMode,
    sidebarWidth,
    localMappingDirectoryStatus,
    isResizingSidebar,
    workspaceRef,
    setGlobalLocalCacheDirectory,
    setContentListingPageSize,
    setContentViewMode,
    startResizing
  } = useNavigationPreferencesState();
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
  const {
    contentItems,
    contentContinuationToken,
    contentHasMore,
    isLoadingContent,
    isLoadingMoreContent,
    contentError,
    loadMoreContentError,
    contentActionError,
    sidebarFilterText,
    contentFilterText,
    contentStatusFilters,
    selectedContentItemIds,
    openContentMenuItemId,
    contentMenuAnchor,
    contentAreaMenuAnchor,
    contentRefreshNonce,
    filePreviewState,
    setContentItems,
    setContentContinuationToken,
    setContentHasMore,
    setIsLoadingContent,
    setIsLoadingMoreContent,
    setContentError,
    setLoadMoreContentError,
    setContentActionError,
    setSidebarFilterText,
    setContentFilterText,
    setContentStatusFilters,
    setSelectedContentItemIds,
    setOpenContentMenuItemId,
    setContentMenuAnchor,
    setContentAreaMenuAnchor,
    setContentRefreshNonce,
    setFilePreviewState
  } = useContentListingState();
  const {
    restoreRequest,
    restoreSubmitError,
    isSubmittingRestoreRequest,
    changeStorageClassRequest,
    changeStorageClassSubmitError,
    isSubmittingStorageClassChange,
    isCreateFolderModalOpen,
    newFolderName,
    createFolderError,
    isCreatingFolder,
    pendingContentDelete,
    deleteConfirmationValue,
    deleteContentError,
    isDeletingContent,
    isUploadSettingsModalOpen,
    uploadSettingsStorageClass,
    uploadSettingsAzureTier,
    uploadSettingsSubmitError,
    isSavingUploadSettings,
    setRestoreRequest,
    setRestoreSubmitError,
    setIsSubmittingRestoreRequest,
    setChangeStorageClassRequest,
    setChangeStorageClassSubmitError,
    setIsSubmittingStorageClassChange,
    setIsCreateFolderModalOpen,
    setNewFolderName,
    setCreateFolderError,
    setIsCreatingFolder,
    setPendingContentDelete,
    setDeleteConfirmationValue,
    setDeleteContentError,
    setIsDeletingContent,
    setIsUploadSettingsModalOpen,
    setUploadSettingsStorageClass,
    setUploadSettingsAzureTier,
    setUploadSettingsSubmitError,
    setIsSavingUploadSettings
  } = useModalOrchestrationState();
  const {
    downloadedFilePaths,
    activeTransfers,
    activeDirectDownloadItemIds,
    completionToast,
    uploadConflictPrompt,
    isTransferModalOpen,
    isUploadDropTargetActive,
    uploadConflictResolverRef,
    activeTransferList,
    downloadedFilePathSet,
    setDownloadedFilePaths,
    setActiveTransfers,
    setActiveDirectDownloadItemIds,
    setCompletionToast,
    setUploadConflictPrompt,
    setIsTransferModalOpen,
    setIsUploadDropTargetActive,
    showTransferErrorToast
  } = useTransferState();
  const contentDropZoneRef = useRef<HTMLElement | null>(null);
  const hasProcessedStartupAutoConnectRef = useRef(false);
  const nativeDragDropPathsRef = useRef<string[]>([]);
  const connectionTestRequestIdRef = useRef(0);
  const connectionRequestIdsRef = useRef<Record<string, number>>({});
  const contentRequestIdRef = useRef(0);
  const filePreviewRequestIdRef = useRef(0);
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
  const isStatusFilterInactive = isContentStatusFilterInactive({
    contentStatusFilters,
    allContentStatusFilters: ALL_CONTENT_STATUS_FILTERS
  });
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
  const isContentFilterActive = deriveIsContentFilterActive({
    normalizedContentFilter,
    isStatusFilterInactive
  });
  const loadedFileItems = useMemo(
    () => contentItems.filter((item) => item.kind === "file"),
    [contentItems]
  );
  const loadedDirectoryCount = useMemo(
    () => contentItems.filter((item) => item.kind === "directory").length,
    [contentItems]
  );
  const contentSelectionState = useMemo(
    () =>
      buildContentSelectionState({
        items: contentItems,
        filteredItems: filteredContentItems,
        selectedItemIds: selectedContentItemIds
      }),
    [contentItems, filteredContentItems, selectedContentItemIds]
  );
  const selectedContentItemIdSet = contentSelectionState.selectedItemIdSet;
  const selectedContentItems = contentSelectionState.selectedItems;
  const selectedContentCount = contentSelectionState.selectedCount;
  const isContentSelectionActive = contentSelectionState.isSelectionActive;
  const visibleContentItemIds = contentSelectionState.visibleItemIds;
  const allVisibleContentItemsSelected = contentSelectionState.allVisibleItemsSelected;
  const previewedContentItem = useMemo(
    () => contentItems.find((item) => item.id === filePreviewState.selectedItemId) ?? null,
    [contentItems, filePreviewState.selectedItemId]
  );
  const filePreviewSupport = useMemo(
    () => getFilePreviewSupport(previewedContentItem),
    [previewedContentItem]
  );
  const { loadedContentCount, displayedContentCount } = buildContentCounts({
    selectedNodeKind: selectedNode?.kind,
    connectionBucketCount:
      selectedNode?.kind === "connection" ? (connectionBuckets[selectedNode.id] ?? []).length : 0,
    contentItemCount: contentItems.length,
    filteredConnectionBucketCount: filteredConnectionBuckets.length,
    filteredContentItemCount: filteredContentItems.length
  });
  const contentCounterLabel = buildContentCounterLabel(
    t,
    isContentFilterActive,
    displayedContentCount,
    loadedContentCount
  );
  const shouldRenderListHeaders = contentViewMode === "list";
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

  const shouldRenderLoadMoreButton = selectedNode?.kind === "bucket";

  function toggleContentStatusFilter(filter: ContentStatusFilter) {
    setContentStatusFilters((currentFilters) =>
      currentFilters.includes(filter)
        ? currentFilters.filter((currentFilter) => currentFilter !== filter)
        : [...currentFilters, filter]
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
    return collectDroppedFiles({
      items: event.dataTransfer?.items,
      files: event.dataTransfer?.files
    });
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
          defaultPath: resolveDirectoryPickerDefaultPath(globalLocalCacheDirectory)
        });

        const normalizedSelectedPath = resolveSingleDirectoryPickResult(selectedPath);

        if (!normalizedSelectedPath) {
          return;
        }

        setGlobalLocalCacheDirectory(normalizedSelectedPath);
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
        const normalizedSelectedPaths = resolveMultiFilePickResult(selectedPath);

        if (normalizedSelectedPaths.length === 0) {
          return;
        }

        runSimpleAwsUploads(normalizedSelectedPaths);
      } catch (error) {
        showTransferErrorToast(
          extractErrorMessage(error) ?? t("content.transfer.upload_picker_failed")
        );
      }
    })();
  }

  function clearContentSelection() {
    setSelectedContentItemIds(clearContentSelectionState());
  }

  function toggleContentItemSelection(itemId: string) {
    setSelectedContentItemIds((currentItemIds) =>
      toggleContentSelectionItem(currentItemIds, itemId)
    );
  }

  function setFilePreviewEnabled(isEnabled: boolean) {
    filePreviewRequestIdRef.current += 1;
    setFilePreviewState((currentState) => ({
      ...currentState,
      isEnabled,
      requestId: filePreviewRequestIdRef.current,
      isLoading: false,
      payload: isEnabled ? currentState.payload : null,
      error: null
    }));
  }

  function selectFileForPreview(item: ContentExplorerItem) {
    if (!filePreviewState.isEnabled || item.kind !== "file") {
      return;
    }

    void loadFilePreview(item);
  }

  async function loadFilePreview(item: ContentExplorerItem) {
    if (!selectedConnection || !selectedBucketName || item.kind !== "file") {
      return;
    }

    const support = getFilePreviewSupport(item);
    const requestId = filePreviewRequestIdRef.current + 1;
    filePreviewRequestIdRef.current = requestId;

    if (support.status !== "supported") {
      setFilePreviewState((currentState) => ({
        ...currentState,
        selectedItemId: item.id,
        requestId,
        isLoading: false,
        payload: null,
        error: null
      }));
      return;
    }

    setFilePreviewState((currentState) => ({
      ...currentState,
      selectedItemId: item.id,
      requestId,
      isLoading: true,
      payload: null,
      error: null
    }));

    try {
      const payload = await previewObjectForSavedConnection({
        connection: selectedConnection,
        containerName: selectedBucketName,
        item,
        region:
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined
      });

      if (filePreviewRequestIdRef.current !== requestId) {
        return;
      }

      setFilePreviewState((currentState) => ({
        ...currentState,
        selectedItemId: item.id,
        requestId,
        isLoading: false,
        payload,
        error: null
      }));
    } catch (error) {
      if (filePreviewRequestIdRef.current !== requestId) {
        return;
      }

      setFilePreviewState((currentState) => ({
        ...currentState,
        selectedItemId: item.id,
        requestId,
        isLoading: false,
        payload: null,
        error: extractErrorMessage(error) ?? t("content.preview.error_body")
      }));
    }
  }

  function retryFilePreview() {
    if (previewedContentItem?.kind === "file") {
      void loadFilePreview(previewedContentItem);
    }
  }

  function toggleSelectAllVisibleContentItems() {
    setSelectedContentItemIds((currentItemIds) =>
      toggleAllVisibleContentSelection(currentItemIds, visibleContentItemIds)
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

      const nextDeleteSuccessState = buildDeleteContentSuccessState({
        toastId:
          typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        itemCount: pendingContentDelete.items.length,
        fileCount: pendingContentDelete.fileCount,
        directoryCount: pendingContentDelete.directoryCount,
        t
      });

      setCompletionToast(nextDeleteSuccessState.completionToast);
      setDeleteContentError(nextDeleteSuccessState.deleteContentError);
      setIsDeletingContent(nextDeleteSuccessState.isDeletingContent);

      clearContentSelection();
      closeDeleteContentModal(true);
      await handleRefreshCurrentView();
    } catch (error) {
      await handleRefreshCurrentView();
      const nextDeleteFailureState = buildDeleteContentFailureState({ error, t });
      setDeleteContentError(nextDeleteFailureState.deleteContentError);
      setIsDeletingContent(nextDeleteFailureState.isDeletingContent);
    }
  }

  function closeRestoreRequestModal() {
    const nextState = buildClosedRestoreRequestModalState({
      isSubmittingRestoreRequest,
      restoreRequest,
      restoreSubmitError
    });
    setRestoreRequest(nextState.restoreRequest);
    setRestoreSubmitError(nextState.restoreSubmitError);
  }

  function closeChangeStorageClassModal() {
    const nextState = buildClosedChangeStorageClassModalState({
      isSubmittingStorageClassChange,
      changeStorageClassRequest,
      changeStorageClassSubmitError
    });
    setChangeStorageClassRequest(nextState.changeStorageClassRequest);
    setChangeStorageClassSubmitError(nextState.changeStorageClassSubmitError);
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
    const nextState = buildOpenedRestoreRequestModalState({
      nextRequest,
      openContentMenuItemId,
      contentMenuAnchor
    });
    setOpenContentMenuItemId(nextState.openContentMenuItemId);
    setContentMenuAnchor(nextState.contentMenuAnchor);
    setRestoreSubmitError(nextState.restoreSubmitError);
    setRestoreRequest(nextState.restoreRequest);
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
    const nextState = buildOpenedChangeStorageClassModalState({
      nextRequest,
      openContentMenuItemId,
      contentMenuAnchor
    });
    setOpenContentMenuItemId(nextState.openContentMenuItemId);
    setContentMenuAnchor(nextState.contentMenuAnchor);
    setChangeStorageClassSubmitError(nextState.changeStorageClassSubmitError);
    setChangeStorageClassRequest(nextState.changeStorageClassRequest);
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
    buildBatchDownloadPlan({
      items: batchSelectionActions.downloadableItems,
      canBatchDownload: batchSelectionActions.canBatchDownload
    }).forEach((item) => {
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
    return () => {
      connectionTestRequestIdRef.current += 1;
      contentRequestIdRef.current += 1;
      filePreviewRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setContentFilterText("");
    setContentStatusFilters([]);
    setSelectedContentItemIds([]);
    setContentAreaMenuAnchor(null);
    setOpenContentMenuItemId(null);
    setContentMenuAnchor(null);
    filePreviewRequestIdRef.current += 1;
    setFilePreviewState((currentState) => ({
      ...buildInitialFilePreviewState(),
      isEnabled: currentState.isEnabled,
      requestId: filePreviewRequestIdRef.current
    }));
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
    setFilePreviewState((currentState) => {
      if (
        !currentState.selectedItemId ||
        contentItems.some((item) => item.id === currentState.selectedItemId)
      ) {
        return currentState;
      }

      filePreviewRequestIdRef.current += 1;

      return {
        ...buildInitialFilePreviewState(),
        isEnabled: currentState.isEnabled,
        requestId: filePreviewRequestIdRef.current
      };
    });
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
    await executeContentAreaActionDispatch({
      step: getContentAreaActionDispatchStep(actionId),
      handlers: {
        openCreateFolder: openCreateFolderModal,
        refresh: handleRefreshCurrentView
      }
    });
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
    await executeConnectionActionDispatch({
      steps: getConnectionActionDispatchSteps(actionId),
      handlers: {
        closeMenu: () => setOpenMenuConnectionId(null),
        connect: () => connectConnection(connectionId),
        cancelConnect: () => cancelConnectionAttempt(connectionId),
        disconnect: () => disconnectConnection(connectionId),
        edit: () => openEditModal(connectionId),
        remove: () => handleRemoveConnection(connectionId)
      }
    });
  }

  async function handleDefaultConnectionAction(connectionId: string) {
    const indicator = connectionIndicators[connectionId] ?? { status: "disconnected" };
    await executeDefaultConnectionAction({
      step: getDefaultConnectionActionStep({ status: indicator.status }),
      handlers: {
        connect: () => connectConnection(connectionId),
        edit: () => openEditModal(connectionId)
      }
    });
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
        <ConnectionsSidebar
          selectedView={selectedView}
          selectedNodeId={selectedNodeId}
          connectionsCount={connections.length}
          isLoadingConnections={isLoadingConnections}
          sidebarFilterText={sidebarFilterText}
          filteredTreeNodes={filteredTreeNodes}
          normalizedSidebarFilterLength={normalizedSidebarFilter.length}
          collapsedConnectionIds={collapsedConnectionIds}
          openMenuConnectionId={openMenuConnectionId}
          connectionIndicators={connectionIndicators}
          t={t}
          onSelectHome={handleSelectHome}
          onOpenCreateModal={openCreateModal}
          onSidebarFilterTextChange={setSidebarFilterText}
          onSelectNode={handleSelectNode}
          onToggleCollapsed={toggleConnectionCollapsed}
          onOpenMenuConnectionChange={setOpenMenuConnectionId}
          onConnectionAction={(actionId, connectionId) => {
            void handleConnectionAction(actionId, connectionId);
          }}
          onDefaultConnectionAction={(connectionId) => {
            void handleDefaultConnectionAction(connectionId);
          }}
        />

        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t("navigation.sidebar_aria_label")}
          onPointerDown={startResizing}
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
            <ContentExplorerHeader
              title={displayedContentTitle}
              selectedNodeKind={selectedNode?.kind ?? null}
              breadcrumbs={selectedBreadcrumbs}
              connectionIndicator={
                selectedConnection
                  ? connectionIndicators[selectedConnection.id] ?? { status: "disconnected" }
                  : null
              }
              contentFilterText={contentFilterText}
              contentStatusFilters={contentStatusFilters}
              allContentStatusFilters={ALL_CONTENT_STATUS_FILTERS}
              contentStatusSummaryItems={contentStatusSummaryItems}
              contentViewMode={contentViewMode}
              isFilePreviewEnabled={filePreviewState.isEnabled}
              t={t}
              onNavigateConnectionBreadcrumb={() => {
                if (!selectedNode) {
                  return;
                }

                const connectionNode = treeNodes.find(
                  (node) => node.id === selectedNode.connectionId
                );

                if (connectionNode) {
                  handleSelectNode(connectionNode);
                }
              }}
              onNavigateBucketBreadcrumb={(path) => {
                if (selectedNode?.kind === "bucket") {
                  navigateBucketPath(selectedNode.id, path);
                }
              }}
              onContentFilterTextChange={setContentFilterText}
              onToggleContentStatusFilter={toggleContentStatusFilter}
              onContentViewModeChange={setContentViewMode}
              onFilePreviewEnabledChange={setFilePreviewEnabled}
            />
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
                <div className="content-explorer-with-preview">
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
                    <ContentItemList
                      items={filteredContentItems}
                      contentViewMode={contentViewMode}
                      shouldRenderListHeaders={shouldRenderListHeaders}
                      selectedContentItemIdSet={selectedContentItemIdSet}
                      previewedContentItemId={
                        filePreviewState.isEnabled ? filePreviewState.selectedItemId : null
                      }
                      isContentSelectionActive={isContentSelectionActive}
                      selectedBucketConnectionId={selectedBucketConnectionId}
                      selectedBucketName={selectedBucketName}
                      selectedBucketProvider={selectedBucketProvider}
                      hasValidGlobalLocalCacheDirectory={hasValidGlobalLocalCacheDirectory}
                      activeTransferIdentityMap={activeTransferIdentityMap}
                      activeTrackedDownloadIdentityMap={activeTrackedDownloadIdentityMap}
                      activeDirectDownloadItemIds={activeDirectDownloadItemIds}
                      fileActionAvailabilityContext={fileActionAvailabilityContext}
                      openContentMenuItemId={openContentMenuItemId}
                      contentMenuAnchor={contentMenuAnchor}
                      locale={locale}
                      t={t}
                      onNavigateDirectory={(path) => navigateBucketPath(selectedNode.id, path)}
                      onToggleContentItemSelection={toggleContentItemSelection}
                      onPreviewContentItem={selectFileForPreview}
                      onOpenContentMenu={(itemId, anchorPosition) => {
                        setOpenContentMenuItemId(itemId);
                        setContentMenuAnchor(
                          itemId && anchorPosition
                            ? { itemId, x: anchorPosition.x, y: anchorPosition.y }
                            : null
                        );
                      }}
                      onPreviewFileAction={handlePreviewFileAction}
                    />
                  )}
                </div>
                {filePreviewState.isEnabled ? (
                  <FilePreviewPanel
                    item={previewedContentItem}
                    support={filePreviewSupport}
                    payload={filePreviewState.payload}
                    isLoading={filePreviewState.isLoading}
                    error={filePreviewState.error}
                    locale={locale}
                    t={t}
                    onRetry={retryFilePreview}
                  />
                ) : null}
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

      <NavigatorModalOrchestrator
        locale={locale}
        t={t}
        restoreRequest={restoreRequest}
        restoreSubmitError={restoreSubmitError}
        isSubmittingRestoreRequest={isSubmittingRestoreRequest}
        onCloseRestoreRequestModal={closeRestoreRequestModal}
        onSubmitAwsRestoreRequest={handleSubmitAwsRestoreRequest}
        onSubmitAzureRehydrationRequest={handleSubmitAzureRehydrationRequest}
        changeStorageClassRequest={changeStorageClassRequest}
        changeStorageClassSubmitError={changeStorageClassSubmitError}
        isSubmittingStorageClassChange={isSubmittingStorageClassChange}
        onCloseChangeStorageClassModal={closeChangeStorageClassModal}
        onSubmitChangeStorageClass={handleSubmitChangeStorageClass}
        isTransferModalOpen={isTransferModalOpen}
        activeTransferList={activeTransferList}
        onCancelActiveTransfer={handleCancelActiveTransfer}
        onCloseTransferModal={() => setIsTransferModalOpen(false)}
        completionToast={completionToast}
        onCloseCompletionToast={() => setCompletionToast(null)}
        connectionFormProps={{
          isOpen: isModalOpen,
          locale,
          fieldIds: {
            nameFieldId,
            providerFieldId,
            accessKeyFieldId,
            secretKeyFieldId,
            restrictedBucketNameFieldId,
            storageAccountNameFieldId,
            azureAuthenticationMethodFieldId,
            azureAccountKeyFieldId,
            connectOnStartupFieldId
          },
          modalMode,
          connectionName,
          connectionProvider,
          accessKeyId,
          secretAccessKey,
          restrictedBucketName,
          storageAccountName,
          azureAuthenticationMethod,
          azureAccountKey,
          connectOnStartup,
          defaultAwsUploadStorageClass,
          defaultAzureUploadTier,
          formErrors,
          submitError,
          isSubmitting,
          connectionTestStatus,
          connectionTestMessage,
          t,
          onConnectionNameChange: (value) => {
            setConnectionName(value);
            resetConnectionTestState();
          },
          onConnectionProviderChange: (value) => {
            setConnectionProvider(value);
            resetConnectionTestState();
          },
          onAccessKeyIdChange: (value) => {
            setAccessKeyId(value);
            resetConnectionTestState();
          },
          onSecretAccessKeyChange: (value) => {
            setSecretAccessKey(value);
            resetConnectionTestState();
          },
          onRestrictedBucketNameChange: (value) => {
            setRestrictedBucketName(value);
            resetConnectionTestState();
          },
          onStorageAccountNameChange: (value) => {
            setStorageAccountName(value);
            resetConnectionTestState();
          },
          onAzureAuthenticationMethodChange: (value) => {
            setAzureAuthenticationMethod(value);
            resetConnectionTestState();
          },
          onAzureAccountKeyChange: (value) => {
            setAzureAccountKey(value);
            resetConnectionTestState();
          },
          onConnectOnStartupChange: setConnectOnStartup,
          onDefaultAwsUploadStorageClassChange: setDefaultAwsUploadStorageClass,
          onDefaultAzureUploadTierChange: setDefaultAzureUploadTier,
          onTestConnection: handleTestConnection,
          onSaveConnection: () => {
            void handleSaveConnection();
          },
          onClose: closeModal
        }}
        isUploadSettingsModalOpen={isUploadSettingsModalOpen}
        selectedConnection={selectedConnection}
        uploadSettingsStorageClass={uploadSettingsStorageClass}
        uploadSettingsAzureTier={uploadSettingsAzureTier}
        uploadSettingsSubmitError={uploadSettingsSubmitError}
        isSavingUploadSettings={isSavingUploadSettings}
        onUploadSettingsStorageClassChange={setUploadSettingsStorageClass}
        onUploadSettingsAzureTierChange={setUploadSettingsAzureTier}
        onSaveUploadSettings={() => {
          void handleSaveUploadSettings();
        }}
        onCloseUploadSettingsModal={closeUploadSettingsModal}
        isCreateFolderModalOpen={isCreateFolderModalOpen}
        canCreateFolderInCurrentContext={canCreateFolderInCurrentContext}
        newFolderNameFieldId={newFolderNameFieldId}
        newFolderName={newFolderName}
        createFolderError={createFolderError}
        isCreatingFolder={isCreatingFolder}
        selectedBucketProvider={selectedBucketProvider}
        selectedBucketName={selectedBucketName}
        selectedBucketPath={selectedBucketPath}
        onNewFolderNameChange={setNewFolderName}
        onClearCreateFolderError={() => setCreateFolderError(null)}
        onCreateFolder={() => {
          void handleCreateFolder();
        }}
        onCloseCreateFolderModal={() => closeCreateFolderModal()}
        pendingContentDelete={pendingContentDelete}
        deleteConfirmationValue={deleteConfirmationValue}
        deleteContentError={deleteContentError}
        isDeletingContent={isDeletingContent}
        contentDeleteConfirmationText={CONTENT_DELETE_CONFIRMATION_TEXT}
        onDeleteConfirmationValueChange={setDeleteConfirmationValue}
        onClearDeleteContentError={() => setDeleteContentError(null)}
        onCloseDeleteContentModal={() => closeDeleteContentModal()}
        onConfirmDeleteContent={() => {
          void handleConfirmDeleteContent();
        }}
        pendingDeleteConnection={pendingDeleteConnection}
        onCancelDeleteConnection={() => setPendingDeleteConnectionId(null)}
        onConfirmDeleteConnection={() => {
          void confirmRemoveConnection();
        }}
        uploadConflictPrompt={uploadConflictPrompt}
        onResolveUploadConflict={resolveUploadConflict}
      />
    </>
  );
}

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
