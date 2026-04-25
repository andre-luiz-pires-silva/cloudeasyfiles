import { ChevronRight, CircleAlert, Cloud, Folder, LayoutGrid, List, LoaderCircle, Search, Snowflake, X } from "lucide-react";
import type { ContentStatusFilter } from "../hooks/useContentListingState";

export type ContentExplorerBreadcrumb = {
  label: string;
  path: string | null;
};

export type ContentExplorerConnectionIndicator = {
  status: "disconnected" | "connecting" | "connected" | "error";
  message?: string;
};

export type ContentExplorerStatusSummaryItem = {
  key: ContentStatusFilter;
  label: string;
  count: number;
};

export type ContentExplorerHeaderProps = {
  title: string;
  selectedNodeKind: "connection" | "bucket" | null;
  breadcrumbs: ContentExplorerBreadcrumb[];
  connectionIndicator: ContentExplorerConnectionIndicator | null;
  contentFilterText: string;
  contentStatusFilters: ContentStatusFilter[];
  allContentStatusFilters: ContentStatusFilter[];
  contentStatusSummaryItems: ContentExplorerStatusSummaryItem[];
  contentViewMode: "list" | "compact";
  isFilePreviewEnabled: boolean;
  t: (key: string) => string;
  onNavigateConnectionBreadcrumb: () => void;
  onNavigateBucketBreadcrumb: (path: string) => void;
  onContentFilterTextChange: (value: string) => void;
  onToggleContentStatusFilter: (status: ContentStatusFilter) => void;
  onContentViewModeChange: (mode: "list" | "compact") => void;
  onFilePreviewEnabledChange: (enabled: boolean) => void;
};

export function ContentExplorerHeader({
  title,
  selectedNodeKind,
  breadcrumbs,
  connectionIndicator,
  contentFilterText,
  contentStatusFilters,
  allContentStatusFilters,
  contentStatusSummaryItems,
  contentViewMode,
  isFilePreviewEnabled,
  t,
  onNavigateConnectionBreadcrumb,
  onNavigateBucketBreadcrumb,
  onContentFilterTextChange,
  onToggleContentStatusFilter,
  onContentViewModeChange,
  onFilePreviewEnabledChange
}: ContentExplorerHeaderProps) {
  const contentStatusSummaryMap = new Map(
    contentStatusSummaryItems.map((item) => [item.key, item] as const)
  );
  const canShowControls = selectedNodeKind === "connection" || selectedNodeKind === "bucket";

  return (
    <div className="content-toolbar">
      <div className="content-toolbar-copy">
        <p className="content-eyebrow">{t("content.eyebrow")}</p>
        <h1 className="content-title">{title}</h1>

        {selectedNodeKind === "bucket" ? (
          <nav className="content-breadcrumb" aria-label={t("content.breadcrumb.aria_label")}>
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;

              return (
                <span key={`${breadcrumb.path}:${index}`} className="content-breadcrumb-item">
                  {index > 0 ? (
                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      className="content-breadcrumb-separator"
                    />
                  ) : null}

                  {isCurrent ? (
                    <span className="content-breadcrumb-current">{breadcrumb.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="content-breadcrumb-link"
                      onClick={() => {
                        if (breadcrumb.path === null) {
                          onNavigateConnectionBreadcrumb();
                          return;
                        }

                        onNavigateBucketBreadcrumb(breadcrumb.path);
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

      {connectionIndicator ? (
        <div className="content-toolbar-side">
          <div className="content-toolbar-status">
            <ConnectionStatusIcon indicator={connectionIndicator} t={t} size={22} />
            <span>{getConnectionStatusLabel(connectionIndicator, t)}</span>
          </div>

          {canShowControls ? (
            <div className="content-toolbar-controls">
              <label className="filter-field content-toolbar-filter" htmlFor="content-filter">
                <Search size={16} strokeWidth={2} className="filter-field-icon" />
                <input
                  id="content-filter"
                  type="text"
                  className="filter-field-input"
                  value={contentFilterText}
                  onChange={(event) => onContentFilterTextChange(event.target.value)}
                  placeholder={t(
                    selectedNodeKind === "connection"
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
                    onClick={() => onContentFilterTextChange("")}
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                ) : null}
              </label>

              {selectedNodeKind === "bucket" ? (
                <div
                  className="content-status-filter-group"
                  role="group"
                  aria-label={t("content.filter.status_label")}
                >
                  {allContentStatusFilters.map((status) => {
                    const isSelected = contentStatusFilters.includes(status);
                    const summaryItem = contentStatusSummaryMap.get(status);
                    const label = summaryItem?.label ?? t(`content.filter.status.${status}`);
                    const count = summaryItem?.count ?? 0;

                    return (
                      <button
                        key={status}
                        type="button"
                        className={`content-status-filter-button${isSelected ? " is-selected" : ""}`}
                        aria-pressed={isSelected}
                        title={`${label}: ${count}`}
                        onClick={() => onToggleContentStatusFilter(status)}
                      >
                        <ContentCounterStatus status={status} label={label} count={count} />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedNodeKind === "bucket" ? (
                <label className="content-preview-toggle">
                  <input
                    type="checkbox"
                    checked={isFilePreviewEnabled}
                    onChange={(event) => onFilePreviewEnabledChange(event.target.checked)}
                  />
                  <span>{t("content.preview.toggle")}</span>
                </label>
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
                  onClick={() => onContentViewModeChange("list")}
                >
                  <List size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className={`content-view-button${
                    contentViewMode === "compact" ? " is-active" : ""
                  }`}
                  aria-label={t("content.view_mode.compact")}
                  title={t("content.view_mode.compact")}
                  onClick={() => onContentViewModeChange("compact")}
                >
                  <LayoutGrid size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConnectionStatusIcon({
  indicator,
  t,
  size = 16
}: {
  indicator: ContentExplorerConnectionIndicator;
  t: (key: string) => string;
  size?: number;
}) {
  if (indicator.status === "connecting") {
    return (
      <span
        className="connection-status-icon connection-status-icon-connecting"
        title={t("navigation.connection_status.connecting")}
      >
        <LoaderCircle size={size} strokeWidth={2} />
      </span>
    );
  }

  if (indicator.status === "connected") {
    return (
      <span
        className="connection-status-icon connection-status-icon-connected"
        title={t("navigation.connection_status.connected")}
      >
        <Cloud size={size} strokeWidth={1.9} />
      </span>
    );
  }

  if (indicator.status === "error") {
    return (
      <span
        className="connection-status-icon connection-status-icon-error"
        title={indicator.message ?? t("navigation.connection_status.disconnected")}
      >
        <CircleAlert size={size} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      className="connection-status-icon connection-status-icon-disconnected"
      title={t("navigation.connection_status.disconnected")}
    >
      <Cloud size={size} strokeWidth={1.9} />
    </span>
  );
}

function getConnectionStatusLabel(
  indicator: ContentExplorerConnectionIndicator,
  t: (key: string) => string
): string {
  if (indicator.status === "connected") {
    return t("navigation.connection_status.connected");
  }

  if (indicator.status === "connecting") {
    return t("navigation.connection_status.connecting");
  }

  if (indicator.status === "error") {
    return t("navigation.connection_status.error");
  }

  return t("navigation.connection_status.disconnected");
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
