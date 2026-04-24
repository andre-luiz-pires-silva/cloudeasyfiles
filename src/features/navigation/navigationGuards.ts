// Barrel re-export — preserves all existing imports from this module.
// Each responsibility now lives in its own focused file:
//   navigationTypes.ts            — all shared navigation types
//   navigationOperationBuilders.ts — path builders, key builders, validation, refresh logic
//   navigationItemGuards.ts        — per-item capability checks (can download, restore, etc.)
//   navigationSelectionGuards.ts   — selection state, batch actions, delete state builders

export type {
  NavigationAvailabilityStatus,
  NavigationDownloadState,
  NavigationTransferKind,
  NavigationRefreshPlan,
  NavigationFileActionId,
  NavigationFileActionKind,
  NavigationContentItem,
  NavigationTransferSummary,
  NavigationActionContext,
  NavigationBatchSelectionActions,
  ContentDeletePlan,
  NavigationPendingDeleteState
} from "./navigationTypes";

export {
  normalizeDirectoryPrefix,
  dedupeDirectoryPrefixes,
  getUploadParentPath,
  buildContentDeletePlan,
  buildUploadObjectKey,
  buildFileIdentity,
  validateNewFolderNameInput,
  getStartupAutoConnectConnections,
  shouldRefreshAfterUploadCompletion,
  getRefreshPlan,
  getFileActionKind
} from "./navigationOperationBuilders";

export {
  hasActiveTransferForItem,
  canRestoreItem,
  canChangeTierItem,
  canDownloadItem,
  canDownloadAsItem,
  isFileIdentityInContext
} from "./navigationItemGuards";

export {
  toggleSelectedItemId,
  toggleVisibleSelection,
  buildPendingDeleteState,
  getBatchSelectionActions
} from "./navigationSelectionGuards";
