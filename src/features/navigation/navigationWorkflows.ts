import type { ConnectionProvider } from "../connections/models";
import type {
  RestoreRequestSummary,
  RestoreRequestTarget
} from "../restore/RestoreRequestModal";
import type { ChangeStorageClassRequestSummary } from "../storage-class/ChangeStorageClassModal";

export type NavigationWorkflowItem = {
  kind: "directory" | "file";
  name: string;
  path: string;
  size?: number;
  storageClass?: string | null;
  availabilityStatus?: "available" | "archived" | "restoring";
};

export type NavigationRestoreRequestState = {
  provider: ConnectionProvider;
  request: RestoreRequestTarget | RestoreRequestSummary;
  connectionId: string;
  bucketName: string;
  bucketRegion?: string | null;
  targets: Array<{
    objectKey: string;
    storageClass?: string | null;
  }>;
};

export type NavigationChangeStorageClassRequestState = {
  provider: ConnectionProvider;
  request: ChangeStorageClassRequestSummary;
  connectionId: string;
  bucketName: string;
  bucketRegion?: string | null;
  targets: Array<{
    objectKey: string;
    currentStorageClass?: string | null;
  }>;
  currentStorageClass?: string | null;
};

type BuildWorkflowRequestParams = {
  items: NavigationWorkflowItem[];
  provider: ConnectionProvider | null | undefined;
  connectionId: string | null;
  bucketName: string | null;
  bucketRegion: string | null | undefined;
  bucketRegionPlaceholder: string;
  formatBytes: (size: number | undefined) => string;
};

function normalizeBucketRegion(
  bucketRegion: string | null | undefined,
  bucketRegionPlaceholder: string
): string | null {
  return bucketRegion && bucketRegion !== bucketRegionPlaceholder ? bucketRegion : null;
}

function getFileItems(items: NavigationWorkflowItem[]) {
  return items.filter(
    (item): item is NavigationWorkflowItem & { kind: "file" } => item.kind === "file"
  );
}

export function buildRestoreRequestState(
  params: BuildWorkflowRequestParams & {
    getMixedStorageClassesLabel: () => string;
  }
): NavigationRestoreRequestState | null {
  if (!params.provider || !params.connectionId || !params.bucketName || params.items.length === 0) {
    return null;
  }

  const fileItems = getFileItems(params.items);

  if (fileItems.length === 0) {
    return null;
  }

  const totalSize = fileItems.reduce((sum, item) => sum + (item.size ?? 0), 0);
  const storageClasses = [...new Set(fileItems.map((item) => item.storageClass).filter(Boolean))];
  const request: RestoreRequestTarget | RestoreRequestSummary =
    fileItems.length === 1
      ? {
          provider: params.provider,
          fileName: fileItems[0]?.name ?? "",
          fileSizeLabel: params.formatBytes(fileItems[0]?.size),
          storageClass: fileItems[0]?.storageClass
        }
      : {
          provider: params.provider,
          fileCount: fileItems.length,
          totalSizeLabel: params.formatBytes(totalSize),
          storageClasses: fileItems.map((item) => item.storageClass),
          storageClassLabel:
            storageClasses.length === 1
              ? storageClasses[0] ?? null
              : params.getMixedStorageClassesLabel()
        };

  return {
    provider: params.provider,
    request,
    connectionId: params.connectionId,
    bucketName: params.bucketName,
    bucketRegion: normalizeBucketRegion(params.bucketRegion, params.bucketRegionPlaceholder),
    targets: fileItems.map((item) => ({
      objectKey: item.path,
      storageClass: item.storageClass
    }))
  };
}

export function buildChangeStorageClassRequestState(
  params: BuildWorkflowRequestParams & {
    getMultipleCurrentClassesLabel: () => string;
  }
): NavigationChangeStorageClassRequestState | null {
  if (!params.provider || !params.connectionId || !params.bucketName || params.items.length === 0) {
    return null;
  }

  const fileItems = getFileItems(params.items);

  if (fileItems.length === 0) {
    return null;
  }

  const totalSize = fileItems.reduce((sum, item) => sum + (item.size ?? 0), 0);
  const storageClasses = [...new Set(fileItems.map((item) => item.storageClass).filter(Boolean))];
  const currentStorageClass =
    storageClasses.length === 1 ? (storageClasses[0] ?? null) : null;

  return {
    provider: params.provider,
    request: {
      fileCount: fileItems.length,
      totalSizeLabel: params.formatBytes(totalSize),
      currentStorageClassLabel:
        storageClasses.length === 1
          ? storageClasses[0] ?? null
          : params.getMultipleCurrentClassesLabel()
    },
    connectionId: params.connectionId,
    bucketName: params.bucketName,
    bucketRegion: normalizeBucketRegion(params.bucketRegion, params.bucketRegionPlaceholder),
    targets: fileItems.map((item) => ({
      objectKey: item.path,
      currentStorageClass: item.storageClass
    })),
    currentStorageClass
  };
}

export function getBatchChangeTierTooltip(params: {
  items: NavigationWorkflowItem[];
  provider: ConnectionProvider | null | undefined;
  isContentSelectionActive: boolean;
  canBatchChangeTier: boolean;
  t: (key: string) => string;
}): string {
  if (
    params.items.some((item) => item.kind === "file" && item.availabilityStatus === "archived")
  ) {
    return params.t(
      params.provider === "azure"
        ? "content.azure_storage_class_change.tooltip_archived_requires_rehydration"
        : "content.storage_class_change.tooltip_archived_requires_restore"
    );
  }

  if (params.isContentSelectionActive && !params.canBatchChangeTier) {
    return params.t(
      params.provider === "azure"
        ? "content.azure_storage_class_change.tooltip_selection_incompatible"
        : "content.storage_class_change.tooltip_selection_incompatible"
    );
  }

  return params.t("navigation.menu.change_tier");
}

export function buildClosedRestoreRequestModalState(params: {
  isSubmittingRestoreRequest: boolean;
  restoreRequest: NavigationRestoreRequestState | null;
  restoreSubmitError: string | null;
}) {
  if (params.isSubmittingRestoreRequest) {
    return {
      restoreRequest: params.restoreRequest,
      restoreSubmitError: params.restoreSubmitError
    };
  }

  return {
    restoreRequest: null,
    restoreSubmitError: null
  };
}

export function buildOpenedRestoreRequestModalState(params: {
  nextRequest: NavigationRestoreRequestState | null;
  openContentMenuItemId: string | null;
  contentMenuAnchor: { itemId: string; x: number; y: number } | null;
}) {
  if (!params.nextRequest) {
    return {
      openContentMenuItemId: params.openContentMenuItemId,
      contentMenuAnchor: params.contentMenuAnchor,
      restoreSubmitError: null as string | null,
      restoreRequest: null as NavigationRestoreRequestState | null
    };
  }

  return {
    openContentMenuItemId: null,
    contentMenuAnchor: null,
    restoreSubmitError: null,
    restoreRequest: params.nextRequest
  };
}

export function buildClosedChangeStorageClassModalState(params: {
  isSubmittingStorageClassChange: boolean;
  changeStorageClassRequest: NavigationChangeStorageClassRequestState | null;
  changeStorageClassSubmitError: string | null;
}) {
  if (params.isSubmittingStorageClassChange) {
    return {
      changeStorageClassRequest: params.changeStorageClassRequest,
      changeStorageClassSubmitError: params.changeStorageClassSubmitError
    };
  }

  return {
    changeStorageClassRequest: null,
    changeStorageClassSubmitError: null
  };
}

export function buildOpenedChangeStorageClassModalState(params: {
  nextRequest: NavigationChangeStorageClassRequestState | null;
  openContentMenuItemId: string | null;
  contentMenuAnchor: { itemId: string; x: number; y: number } | null;
}) {
  if (!params.nextRequest) {
    return {
      openContentMenuItemId: params.openContentMenuItemId,
      contentMenuAnchor: params.contentMenuAnchor,
      changeStorageClassSubmitError: null as string | null,
      changeStorageClassRequest: null as NavigationChangeStorageClassRequestState | null
    };
  }

  return {
    openContentMenuItemId: null,
    contentMenuAnchor: null,
    changeStorageClassSubmitError: null,
    changeStorageClassRequest: params.nextRequest
  };
}
