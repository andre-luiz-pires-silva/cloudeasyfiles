// Barrel re-export — preserves all existing imports from this module.
// Each responsibility now lives in its own focused file:
//   navigationFormatting.ts   — formatBytes, formatDateTime, normalizeFilterText, getFileNameFromPath
//   navigationErrorUtils.ts   — extractErrorMessage, buildConnectionFailureMessage, getConnectionActions, ...
//   navigationTreeUtils.ts    — NavigationTreeNode, filterTreeNodes, buildBreadcrumbs, ...
//   navigationStatusUtils.ts  — NavigationContentStatusFilter, getFileStatusBadgeDescriptors, ...

export type { NavigationTreeNode } from "./navigationTreeUtils";
export type {
  NavigationContentStatusFilter,
  NavigationFileStatusBadgeDescriptor
} from "./navigationStatusUtils";

export {
  normalizeFilterText,
  formatBytes,
  formatDateTime,
  getFileNameFromPath
} from "./navigationFormatting";

export {
  extractErrorMessage,
  isCancelledTransferError,
  isUploadExistsPreflightPermissionError,
  buildConnectionFailureMessage,
  getConnectionActions
} from "./navigationErrorUtils";

export {
  matchesFilter,
  filterTreeNodes,
  getPathTitle,
  buildBreadcrumbs,
  buildContentCounterLabel
} from "./navigationTreeUtils";

export {
  isTemporaryRestoredArchivalFile,
  getSummaryContentStatuses,
  getDisplayContentStatus,
  getContentStatusLabel,
  buildAvailableUntilTooltip,
  getFileStatusBadgeDescriptors,
  getPreferredFileStatusBadgeDescriptors
} from "./navigationStatusUtils";
