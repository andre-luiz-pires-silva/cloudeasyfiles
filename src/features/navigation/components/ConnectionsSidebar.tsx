import { useEffect, useRef } from "react";
import {
  ChevronRight,
  CircleAlert,
  Cloud,
  Database,
  Ellipsis,
  Folder,
  LoaderCircle,
  Plus,
  Search,
  Settings,
  X
} from "lucide-react";
import type { ConnectionProvider } from "../../connections/models";
import { getConnectionActions } from "../navigationPresentation";

export type ConnectionsSidebarIndicator = {
  status: "disconnected" | "connecting" | "connected" | "error";
  message?: string;
};

export type ConnectionsSidebarTreeNode = {
  id: string;
  kind: "connection" | "bucket";
  connectionId: string;
  provider: ConnectionProvider;
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  children?: ConnectionsSidebarTreeNode[];
};

export type ConnectionSidebarActionId =
  | "connect"
  | "cancelConnect"
  | "disconnect"
  | "edit"
  | "remove";

export type ConnectionsSidebarProps = {
  selectedView: "home" | "node";
  selectedNodeId: string | null;
  connectionsCount: number;
  isLoadingConnections: boolean;
  sidebarFilterText: string;
  filteredTreeNodes: ConnectionsSidebarTreeNode[];
  normalizedSidebarFilterLength: number;
  collapsedConnectionIds: Record<string, boolean>;
  openMenuConnectionId: string | null;
  connectionIndicators: Record<string, ConnectionsSidebarIndicator>;
  t: (key: string) => string;
  onSelectHome: () => void;
  onOpenCreateModal: () => void;
  onSidebarFilterTextChange: (value: string) => void;
  onSelectNode: (node: ConnectionsSidebarTreeNode) => void;
  onToggleCollapsed: (connectionId: string) => void;
  onOpenMenuConnectionChange: (connectionId: string | null) => void;
  onConnectionAction: (actionId: ConnectionSidebarActionId, connectionId: string) => void;
  onDefaultConnectionAction: (connectionId: string) => void;
};

export function ConnectionsSidebar({
  selectedView,
  selectedNodeId,
  connectionsCount,
  isLoadingConnections,
  sidebarFilterText,
  filteredTreeNodes,
  normalizedSidebarFilterLength,
  collapsedConnectionIds,
  openMenuConnectionId,
  connectionIndicators,
  t,
  onSelectHome,
  onOpenCreateModal,
  onSidebarFilterTextChange,
  onSelectNode,
  onToggleCollapsed,
  onOpenMenuConnectionChange,
  onConnectionAction,
  onDefaultConnectionAction
}: ConnectionsSidebarProps) {
  return (
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
            onClick={onSelectHome}
          >
            <Settings size={18} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="icon-button"
            aria-label={t("navigation.new_connection")}
            title={t("navigation.new_connection")}
            onClick={onOpenCreateModal}
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
            onChange={(event) => onSidebarFilterTextChange(event.target.value)}
            placeholder={t("navigation.filter.placeholder")}
            aria-label={t("navigation.filter.label")}
          />
          {sidebarFilterText ? (
            <button
              type="button"
              className="filter-field-clear"
              aria-label={t("common.clear")}
              title={t("common.clear")}
              onClick={() => onSidebarFilterTextChange("")}
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          ) : null}
        </label>
      </div>

      {connectionsCount === 0 && !isLoadingConnections ? (
        <div className="empty-tree-state">
          <p className="empty-tree-title">{t("navigation.empty.title")}</p>
          <p className="empty-tree-copy">{t("navigation.empty.description")}</p>
          <button type="button" className="primary-button" onClick={onOpenCreateModal}>
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
                    shouldForceExpand={normalizedSidebarFilterLength > 0}
                    menuState={{
                      isOpen: openMenuConnectionId === connection.id,
                      onToggle: onOpenMenuConnectionChange,
                      onAction: onConnectionAction
                    }}
                    onSelect={onSelectNode}
                    onToggleCollapsed={onToggleCollapsed}
                    onConnectionDoubleClick={onDefaultConnectionAction}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

type ConnectionTreeNodeItemProps = {
  node: ConnectionsSidebarTreeNode;
  selectedNodeId: string | null;
  connectionIndicators: Record<string, ConnectionsSidebarIndicator>;
  isCollapsed?: boolean;
  shouldForceExpand?: boolean;
  menuState?: {
    isOpen: boolean;
    onToggle: (connectionId: string | null) => void;
    onAction: (actionId: ConnectionSidebarActionId, connectionId: string) => void;
  };
  onSelect: (node: ConnectionsSidebarTreeNode) => void;
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
              <ConnectionStatusIcon indicator={indicator} t={t} />
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

function TreeNodeIcon({ kind }: { kind: "connection" | "bucket" }) {
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

function ConnectionStatusIcon({
  indicator,
  t,
  size = 16
}: {
  indicator: ConnectionsSidebarIndicator;
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

type TreeItemMenuProps = {
  connectionId: string;
  indicator: ConnectionsSidebarIndicator;
  isOpen: boolean;
  onToggle: (connectionId: string | null) => void;
  onAction: (actionId: ConnectionSidebarActionId, connectionId: string) => void;
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
