import { useEffect, useRef } from "react";
import { CircleAlert, Cloud, Ellipsis, File, Folder, LoaderCircle, Snowflake } from "lucide-react";
import type { Locale } from "../../../lib/i18n/I18nProvider";
import type { ConnectionProvider } from "../../connections/models";
import type { ContentMenuAnchor } from "../hooks/useContentListingState";
import type { NavigationContentExplorerItem as ContentExplorerItem } from "../navigationContent";
import {
  buildFileIdentity,
  canChangeTierItem,
  canDownloadAsItem,
  canDownloadItem,
  canRestoreItem,
  hasActiveTransferForItem,
  type NavigationFileActionId as FileActionId
} from "../navigationGuards";
import {
  formatBytes,
  formatDateTime,
  getPreferredFileStatusBadgeDescriptors
} from "../navigationPresentation";
import type { NavigationActiveTransfer as ActiveTransfer } from "../navigationTransfers";

type FileActionAvailabilityContext = {
  provider: ConnectionProvider | null | undefined;
  connectionId: string | null;
  bucketName: string | null;
  hasValidLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, ActiveTransfer>;
};

export type ContentItemListProps = {
  items: ContentExplorerItem[];
  contentViewMode: "list" | "compact";
  shouldRenderListHeaders: boolean;
  selectedContentItemIdSet: Set<string>;
  previewedContentItemId: string | null;
  isContentSelectionActive: boolean;
  selectedBucketConnectionId: string | null;
  selectedBucketName: string | null;
  selectedBucketProvider: ConnectionProvider | null;
  hasValidGlobalLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, ActiveTransfer>;
  activeTrackedDownloadIdentityMap: Map<string, ActiveTransfer>;
  activeDirectDownloadItemIds: string[];
  fileActionAvailabilityContext: FileActionAvailabilityContext;
  openContentMenuItemId: string | null;
  contentMenuAnchor: ContentMenuAnchor | null;
  locale: Locale;
  t: (key: string) => string;
  onNavigateDirectory: (path: string) => void;
  onToggleContentItemSelection: (itemId: string) => void;
  onPreviewContentItem: (item: ContentExplorerItem) => void;
  onOpenContentMenu: (itemId: string | null, anchorPosition?: { x: number; y: number } | null) => void;
  onPreviewFileAction: (actionId: FileActionId, item: ContentExplorerItem) => void;
};

export function ContentItemList({
  items,
  contentViewMode,
  shouldRenderListHeaders,
  selectedContentItemIdSet,
  previewedContentItemId,
  isContentSelectionActive,
  selectedBucketConnectionId,
  selectedBucketName,
  selectedBucketProvider,
  hasValidGlobalLocalCacheDirectory,
  activeTransferIdentityMap,
  activeTrackedDownloadIdentityMap,
  activeDirectDownloadItemIds,
  fileActionAvailabilityContext,
  openContentMenuItemId,
  contentMenuAnchor,
  locale,
  t,
  onNavigateDirectory,
  onToggleContentItemSelection,
  onPreviewContentItem,
  onOpenContentMenu,
  onPreviewFileAction
}: ContentItemListProps) {
  return (
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

      <div className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}>
        {items.map((item) =>
          item.kind === "directory" ? (
            <DirectoryContentItem
              key={item.id}
              item={item}
              contentViewMode={contentViewMode}
              isSelected={selectedContentItemIdSet.has(item.id)}
              isPreviewed={previewedContentItemId === item.id}
              isContentSelectionActive={isContentSelectionActive}
              selectedBucketProvider={selectedBucketProvider}
              isMenuOpen={openContentMenuItemId === item.id}
              contentMenuAnchor={contentMenuAnchor}
              t={t}
              onNavigateDirectory={onNavigateDirectory}
              onToggleSelection={onToggleContentItemSelection}
              onOpenContentMenu={onOpenContentMenu}
              onPreviewFileAction={onPreviewFileAction}
            />
          ) : (
            <FileContentItem
              key={item.id}
              item={item}
              contentViewMode={contentViewMode}
              isSelected={selectedContentItemIdSet.has(item.id)}
              isPreviewed={previewedContentItemId === item.id}
              isContentSelectionActive={isContentSelectionActive}
              selectedBucketConnectionId={selectedBucketConnectionId}
              selectedBucketName={selectedBucketName}
              selectedBucketProvider={selectedBucketProvider}
              hasValidGlobalLocalCacheDirectory={hasValidGlobalLocalCacheDirectory}
              activeTransferIdentityMap={activeTransferIdentityMap}
              activeTrackedDownloadIdentityMap={activeTrackedDownloadIdentityMap}
              activeDirectDownloadItemIds={activeDirectDownloadItemIds}
              fileActionAvailabilityContext={fileActionAvailabilityContext}
              isMenuOpen={openContentMenuItemId === item.id}
              contentMenuAnchor={contentMenuAnchor}
              locale={locale}
              t={t}
              onToggleSelection={onToggleContentItemSelection}
              onPreviewContentItem={onPreviewContentItem}
              onOpenContentMenu={onOpenContentMenu}
              onPreviewFileAction={onPreviewFileAction}
            />
          )
        )}
      </div>
    </>
  );
}

type DirectoryContentItemProps = {
  item: ContentExplorerItem;
  contentViewMode: "list" | "compact";
  isSelected: boolean;
  isPreviewed: boolean;
  isContentSelectionActive: boolean;
  selectedBucketProvider: ConnectionProvider | null;
  isMenuOpen: boolean;
  contentMenuAnchor: ContentMenuAnchor | null;
  t: (key: string) => string;
  onNavigateDirectory: (path: string) => void;
  onToggleSelection: (itemId: string) => void;
  onOpenContentMenu: (itemId: string | null, anchorPosition?: { x: number; y: number } | null) => void;
  onPreviewFileAction: (actionId: FileActionId, item: ContentExplorerItem) => void;
};

function DirectoryContentItem({
  item,
  contentViewMode,
  isSelected,
  isPreviewed,
  isContentSelectionActive,
  selectedBucketProvider,
  isMenuOpen,
  contentMenuAnchor,
  t,
  onNavigateDirectory,
  onToggleSelection,
  onOpenContentMenu,
  onPreviewFileAction
}: DirectoryContentItemProps) {
  return (
    <div
      className={`content-list-item content-list-item-action content-list-item-file-row${
        contentViewMode === "compact" ? " is-compact" : ""
      }${isSelected ? " is-selected" : ""}`}
      data-previewed={isPreviewed ? "true" : undefined}
      onContextMenu={(event) => {
        if (isContentSelectionActive) {
          return;
        }

        event.preventDefault();
        onOpenContentMenu(item.id, { x: event.clientX, y: event.clientY });
      }}
    >
      {contentViewMode === "compact" ? null : (
        <SelectionCheckbox item={item} checked={isSelected} t={t} onChange={onToggleSelection} />
      )}
      <button
        type="button"
        className={`content-list-item-main-button${
          contentViewMode === "compact" ? " is-compact" : ""
        }`}
        onClick={() => onNavigateDirectory(item.path)}
      >
        {contentViewMode === "compact" ? (
          <span className="content-list-item-main">
            {renderCompactItemTopline(item, t, "en-US")}
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
            <span className="content-list-item-column">{t("content.type.directory")}</span>
            <span className="content-list-item-column content-list-item-column-end">-</span>
            <span className="content-list-item-column content-list-item-column-end">-</span>
          </>
        )}
      </button>

      {contentViewMode === "compact" ? (
        <>
          <span className="content-list-item-compact-footer">
            <span className="content-list-item-topline-label">{getCompactFigureLabel(item, t)}</span>
            <SelectionCheckbox item={item} checked={isSelected} t={t} onChange={onToggleSelection} />
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
              isOpen={isMenuOpen}
              showTrigger={false}
              anchorPosition={getMenuAnchorForItem(contentMenuAnchor, item.id)}
              onToggle={onOpenContentMenu}
              onAction={onPreviewFileAction}
              t={t}
            />
          </span>
        </>
      ) : null}
    </div>
  );
}

type FileContentItemProps = {
  item: ContentExplorerItem;
  contentViewMode: "list" | "compact";
  isSelected: boolean;
  isPreviewed: boolean;
  isContentSelectionActive: boolean;
  selectedBucketConnectionId: string | null;
  selectedBucketName: string | null;
  selectedBucketProvider: ConnectionProvider | null;
  hasValidGlobalLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, ActiveTransfer>;
  activeTrackedDownloadIdentityMap: Map<string, ActiveTransfer>;
  activeDirectDownloadItemIds: string[];
  fileActionAvailabilityContext: FileActionAvailabilityContext;
  isMenuOpen: boolean;
  contentMenuAnchor: ContentMenuAnchor | null;
  locale: Locale;
  t: (key: string) => string;
  onToggleSelection: (itemId: string) => void;
  onPreviewContentItem: (item: ContentExplorerItem) => void;
  onOpenContentMenu: (itemId: string | null, anchorPosition?: { x: number; y: number } | null) => void;
  onPreviewFileAction: (actionId: FileActionId, item: ContentExplorerItem) => void;
};

function FileContentItem({
  item,
  contentViewMode,
  isSelected,
  isPreviewed,
  isContentSelectionActive,
  selectedBucketConnectionId,
  selectedBucketName,
  selectedBucketProvider,
  hasValidGlobalLocalCacheDirectory,
  activeTransferIdentityMap,
  activeTrackedDownloadIdentityMap,
  activeDirectDownloadItemIds,
  fileActionAvailabilityContext,
  isMenuOpen,
  contentMenuAnchor,
  locale,
  t,
  onToggleSelection,
  onPreviewContentItem,
  onOpenContentMenu,
  onPreviewFileAction
}: FileContentItemProps) {
  return (
    <div
      className={`content-list-item content-list-item-action content-list-item-file-row${
        contentViewMode === "compact" ? " is-compact" : ""
      }${isSelected ? " is-selected" : ""}`}
      onClick={(event) => {
        if (isContentSelectionActive) {
          return;
        }

        event.stopPropagation();
        onPreviewContentItem(item);
        onOpenContentMenu(null, null);
      }}
      onContextMenu={(event) => {
        if (isContentSelectionActive) {
          return;
        }

        event.preventDefault();
        onOpenContentMenu(item.id, { x: event.clientX, y: event.clientY });
      }}
      data-previewed={isPreviewed ? "true" : undefined}
    >
      {contentViewMode === "compact" ? null : (
        <SelectionCheckbox item={item} checked={isSelected} t={t} onChange={onToggleSelection} />
      )}
      <span className="content-list-item-main">
        {contentViewMode === "compact" ? (
          renderCompactItemTopline(item, t, locale)
        ) : (
          <span className="content-list-item-icon content-list-item-icon-file">
            <File size={18} strokeWidth={1.9} />
          </span>
        )}
        <span className="content-list-item-copy content-list-item-copy-file">
          <strong title={contentViewMode === "compact" ? item.name : undefined}>{item.name}</strong>
          {selectedBucketConnectionId && selectedBucketName ? (
            <ActiveDownloadProgress
              item={item}
              connectionId={selectedBucketConnectionId}
              bucketName={selectedBucketName}
              activeTrackedDownloadIdentityMap={activeTrackedDownloadIdentityMap}
            />
          ) : null}
        </span>
      </span>

      {contentViewMode === "compact" ? null : (
        <>
          <span className="content-list-item-column">{item.storageClass ?? "-"}</span>
          <span className="content-list-item-column content-list-item-column-status">
            {item.availabilityStatus && item.downloadState
              ? getPreferredFileStatusBadgeDescriptors(item, locale, t).map((descriptor, index) => (
                  <FileStatusBadge
                    key={`${descriptor.status}-${index}`}
                    label={descriptor.label}
                    status={descriptor.status}
                    title={descriptor.title}
                  />
                ))
              : "-"}
          </span>
          <span className="content-list-item-column">{t("content.type.file")}</span>
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
          <span className="content-list-item-topline-label">{getCompactFigureLabel(item, t)}</span>
          <SelectionCheckbox item={item} checked={isSelected} t={t} onChange={onToggleSelection} />
        </span>
      ) : null}
      <span className="content-list-item-actions">
        <ContentItemMenu
          item={item}
          canRestore={canRestoreItem(item, selectedBucketProvider)}
          canChangeTier={canChangeTierItem(item, selectedBucketProvider)}
          canDownload={canDownloadItem(item, fileActionAvailabilityContext)}
          canDownloadAs={canDownloadAsItem(item, fileActionAvailabilityContext, activeDirectDownloadItemIds)}
          canCancelDownload={hasActiveTransferForItem(
            item,
            selectedBucketConnectionId,
            selectedBucketName,
            activeTransferIdentityMap
          )}
          canOpenFile={hasValidGlobalLocalCacheDirectory && item.downloadState === "downloaded"}
          canOpenInExplorer={hasValidGlobalLocalCacheDirectory && item.downloadState === "downloaded"}
          canDelete={!!selectedBucketProvider}
          isOpen={isMenuOpen}
          showTrigger={false}
          anchorPosition={getMenuAnchorForItem(contentMenuAnchor, item.id)}
          onToggle={onOpenContentMenu}
          onAction={onPreviewFileAction}
          t={t}
        />
      </span>
    </div>
  );
}

type SelectionCheckboxProps = {
  item: ContentExplorerItem;
  checked: boolean;
  t: (key: string) => string;
  onChange: (itemId: string) => void;
};

function SelectionCheckbox({ item, checked, t, onChange }: SelectionCheckboxProps) {
  return (
    <label className="content-list-item-checkbox" onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(item.id)}
        aria-label={t("content.selection.select_item").replace("{name}", item.name)}
      />
    </label>
  );
}

function ActiveDownloadProgress({
  item,
  connectionId,
  bucketName,
  activeTrackedDownloadIdentityMap
}: {
  item: ContentExplorerItem;
  connectionId: string;
  bucketName: string;
  activeTrackedDownloadIdentityMap: Map<string, ActiveTransfer>;
}) {
  const fileIdentity = buildFileIdentity(connectionId, bucketName, item.path);
  const activeDownload = activeTrackedDownloadIdentityMap.get(fileIdentity);

  if (!activeDownload) {
    return null;
  }

  const progressPercent = Math.max(0, Math.min(100, Math.round(activeDownload.progressPercent)));
  const barWidth = Math.max(4, Math.min(100, activeDownload.progressPercent || 4));

  return (
    <span className="content-file-download-progress">
      <span className="content-file-download-progress-copy">{progressPercent}%</span>
      <span className="content-file-download-progress-track">
        <span className="content-file-download-progress-bar" style={{ width: `${barWidth}%` }} />
      </span>
    </span>
  );
}

function getMenuAnchorForItem(contentMenuAnchor: ContentMenuAnchor | null, itemId: string) {
  return contentMenuAnchor?.itemId === itemId
    ? { x: contentMenuAnchor.x, y: contentMenuAnchor.y }
    : null;
}

function getCompactFigureLabel(item: ContentExplorerItem, t: (key: string) => string) {
  if (item.kind === "directory") {
    return t("content.type.directory");
  }

  const extension = item.name.split(".").pop()?.trim();

  if (extension && extension !== item.name) {
    return extension.toUpperCase();
  }

  return t("content.type.file");
}

function renderCompactItemTopline(
  item: ContentExplorerItem,
  t: (key: string) => string,
  locale: Locale
) {
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
            onToggle(isOpen ? null : item.id, isOpen ? null : null);
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
              <ContentItemMenuAction
                disabled={!canOpenFile}
                label={t("navigation.menu.open_file")}
                onClick={() => onAction("openFile", item)}
              />
              <ContentItemMenuAction
                disabled={!canOpenInExplorer}
                label={t("navigation.menu.open_in_file_explorer")}
                onClick={() => onAction("openInExplorer", item)}
              />
              {canRestore ? (
                <ContentItemMenuAction label={t("navigation.menu.restore")} onClick={() => onAction("restore", item)} />
              ) : null}
              <ContentItemMenuAction
                disabled={!canChangeTier}
                label={t("navigation.menu.change_tier")}
                onClick={() => onAction("changeTier", item)}
              />
              {canCancelDownload ? (
                <ContentItemMenuAction
                  label={t("navigation.menu.cancel_download")}
                  onClick={() => onAction("cancelDownload", item)}
                />
              ) : null}
              <ContentItemMenuAction
                disabled={!canDownload}
                label={t("navigation.menu.download")}
                onClick={() => onAction("download", item)}
              />
              <ContentItemMenuAction
                disabled={!canDownloadAs}
                label={t("navigation.menu.download_as")}
                onClick={() => onAction("downloadAs", item)}
              />
            </>
          ) : null}
          {canDelete ? (
            <ContentItemMenuAction
              danger
              label={t("content.delete.action")}
              onClick={() => onAction("delete", item)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ContentItemMenuAction({
  label,
  disabled = false,
  danger = false,
  onClick
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`tree-menu-action${danger ? " tree-menu-action-danger" : ""}`}
      role="menuitem"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
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
