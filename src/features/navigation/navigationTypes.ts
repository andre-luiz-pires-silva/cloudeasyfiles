import type { ConnectionProvider } from "../connections/models";

export type NavigationAvailabilityStatus = "available" | "archived" | "restoring";
export type NavigationDownloadState =
  | "not_downloaded"
  | "restoring"
  | "available_to_download"
  | "downloaded";
export type NavigationTransferKind = "cache" | "direct" | "upload";
export type NavigationRefreshPlan = "noop" | "reconnect-connection" | "reload-bucket";
export type NavigationFileActionId =
  | "download"
  | "downloadAs"
  | "openFile"
  | "openInExplorer"
  | "cancelDownload"
  | "restore"
  | "changeTier"
  | "delete";
export type NavigationFileActionKind =
  | "provider-read"
  | "provider-mutation"
  | "local-read"
  | "transfer-control";

export type NavigationContentItem = {
  id: string;
  kind: "directory" | "file";
  path: string;
  availabilityStatus?: NavigationAvailabilityStatus;
  downloadState?: NavigationDownloadState;
};

export type NavigationTransferSummary = {
  fileIdentity: string;
  transferKind: NavigationTransferKind;
};

export type NavigationActionContext = {
  provider: ConnectionProvider | null | undefined;
  connectionId: string | null;
  bucketName: string | null;
  hasValidLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, NavigationTransferSummary>;
};

export type NavigationBatchSelectionActions<T extends NavigationContentItem = NavigationContentItem> = {
  downloadableItems: T[];
  restorableItems: T[];
  changeTierableItems: T[];
  deletableItems: T[];
  canBatchDownload: boolean;
  canBatchRestore: boolean;
  canBatchChangeTier: boolean;
  canBatchDelete: boolean;
};

export type ContentDeletePlan = {
  fileKeys: string[];
  directoryPrefixes: string[];
};

export type NavigationPendingDeleteState<T extends NavigationContentItem = NavigationContentItem> = {
  items: T[];
  fileCount: number;
  directoryCount: number;
  plan: ContentDeletePlan;
};
