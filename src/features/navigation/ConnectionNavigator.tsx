import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  Ellipsis,
  File,
  Folder,
  Home,
  Plus
} from "lucide-react";
import logoPrimary from "../../assets/logo-primary.svg";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";

type TreeNodeType = "connection" | "container" | "directory" | "file";
type NavigatorView = "home" | "node";
type AvailabilityStatus = "available" | "archived" | "restoring";
type LocalFileState = "not_downloaded" | "downloaded" | "outdated";
type StorageClass = "standard" | "cool" | "cold" | "archived";
type ConnectionModalMode = "create" | "edit";

type TreeNode = {
  id: string;
  name: string;
  type: TreeNodeType;
  path?: string;
  description?: string;
  storageClass?: StorageClass;
  availabilityStatus?: AvailabilityStatus;
  localFileState?: LocalFileState;
  sizeLabel?: string;
  lastModified?: string;
  children?: TreeNode[];
};

type ConnectionItem = {
  id: string;
  name: string;
  provider: "aws" | "azure";
  localCacheEnabled: boolean;
  localCachePath?: string;
  children: TreeNode[];
};

type RemoveNodeResult = {
  changed: boolean;
  nodes: TreeNode[];
};

type NodeAction = {
  id: string;
  label: string;
  disabled?: boolean;
  variant?: "danger";
};

function compareByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
    numeric: true
  });
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined
    }))
    .sort(compareByName);
}

function sortConnections(connections: ConnectionItem[]): ConnectionItem[] {
  return [...connections].sort(compareByName);
}

function createContainerNode(
  connectionId: string,
  containerKey: string,
  name: string,
  children: TreeNode[]
): TreeNode {
  return {
    id: `${connectionId}-container-${containerKey}`,
    name,
    type: "container",
    path: name,
    description: `${name} container`,
    children
  };
}

function createDirectoryNode(connectionId: string, path: string, children: TreeNode[]): TreeNode {
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  const normalizedId = normalizedPath.split("/").join("-");
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  return {
    id: `${connectionId}-directory-${normalizedId}`,
    name: pathSegments[pathSegments.length - 1] ?? normalizedPath,
    type: "directory",
    path: normalizedPath,
    description: normalizedPath,
    children
  };
}

function createFileNode(
  connectionId: string,
  path: string,
  file: Omit<TreeNode, "id" | "type" | "name" | "path">
): TreeNode {
  const pathSegments = path.split("/");

  return {
    id: `${connectionId}-file-${path.split("/").join("-")}`,
    name: pathSegments[pathSegments.length - 1] ?? path,
    type: "file",
    path,
    ...file
  };
}

function createFakeNodes(
  connectionId: string,
  provider: ConnectionItem["provider"]
): TreeNode[] {
  if (provider === "aws") {
    return [
      createContainerNode(connectionId, "finops-prod", "finops-prod", [
        createDirectoryNode(connectionId, "reports", [
          createDirectoryNode(connectionId, "reports/2026", [
            createFileNode(connectionId, "reports/2026/january-costs.csv", {
              description: "Monthly export generated from the finance data pipeline.",
              storageClass: "standard",
              availabilityStatus: "available",
              localFileState: "downloaded",
              sizeLabel: "2.4 MB",
              lastModified: "2026-03-24 09:12 UTC"
            }),
            createFileNode(connectionId, "reports/2026/february-costs.csv", {
              description: "Latest finalized billing export for February.",
              storageClass: "standard",
              availabilityStatus: "available",
              localFileState: "outdated",
              sizeLabel: "2.8 MB",
              lastModified: "2026-03-25 18:47 UTC"
            })
          ]),
          createDirectoryNode(connectionId, "reports/archive", [
            createFileNode(connectionId, "reports/archive/2024-summary.parquet", {
              description: "Archived financial dataset kept for compliance retention.",
              storageClass: "archived",
              availabilityStatus: "restoring",
              localFileState: "not_downloaded",
              sizeLabel: "184 MB",
              lastModified: "2026-01-12 07:30 UTC"
            })
          ])
        ]),
        createDirectoryNode(connectionId, "shared", [
          createFileNode(connectionId, "shared/team-access-matrix.xlsx", {
            description: "Operational spreadsheet shared between platform and security teams.",
            storageClass: "cool",
            availabilityStatus: "available",
            localFileState: "downloaded",
            sizeLabel: "420 KB",
            lastModified: "2026-03-23 13:05 UTC"
          })
        ])
      ]),
      createContainerNode(connectionId, "legal-archive", "legal-archive", [
        createDirectoryNode(connectionId, "contracts", [
          createFileNode(connectionId, "contracts/vendor-master-2021.pdf", {
            description: "Historical supplier contract stored in archival tier.",
            storageClass: "archived",
            availabilityStatus: "archived",
            localFileState: "not_downloaded",
            sizeLabel: "6.1 MB",
            lastModified: "2025-11-02 15:41 UTC"
          })
        ])
      ])
    ];
  }

  return [
    createContainerNode(connectionId, "product-assets", "product-assets", [
      createDirectoryNode(connectionId, "images", [
        createDirectoryNode(connectionId, "images/raw", [
          createFileNode(connectionId, "images/raw/hero-banner.psd", {
            description: "Large design source stored in cool access tier.",
            storageClass: "cool",
            availabilityStatus: "available",
            localFileState: "downloaded",
            sizeLabel: "48 MB",
            lastModified: "2026-03-20 10:18 UTC"
          })
        ]),
        createDirectoryNode(connectionId, "images/published", [
          createFileNode(connectionId, "images/published/landing-hero.webp", {
            description: "Optimized asset currently served by the product website.",
            storageClass: "standard",
            availabilityStatus: "available",
            localFileState: "outdated",
            sizeLabel: "1.1 MB",
            lastModified: "2026-03-26 08:04 UTC"
          })
        ])
      ]),
      createDirectoryNode(connectionId, "releases", [
        createDirectoryNode(connectionId, "releases/2026", [
          createFileNode(connectionId, "releases/2026/changelog-v4.txt", {
            description: "Release note artifact exported from the deployment pipeline.",
            storageClass: "standard",
            availabilityStatus: "available",
            localFileState: "not_downloaded",
            sizeLabel: "92 KB",
            lastModified: "2026-03-25 22:10 UTC"
          })
        ])
      ])
    ]),
    createContainerNode(connectionId, "app-backups", "app-backups", [
      createDirectoryNode(connectionId, "snapshots", [
        createFileNode(connectionId, "snapshots/db-2026-02-01.bak", {
          description: "Monthly database backup retained for disaster recovery drills.",
          storageClass: "archived",
          availabilityStatus: "restoring",
          localFileState: "not_downloaded",
          sizeLabel: "3.2 GB",
          lastModified: "2026-02-01 03:00 UTC"
        })
      ])
    ])
  ];
}

function getNodeIcon(nodeType: TreeNodeType) {
  if (nodeType === "connection") {
    return <Cloud size={16} strokeWidth={1.9} />;
  }

  if (nodeType === "container") {
    return <Database size={16} strokeWidth={1.9} />;
  }

  if (nodeType === "directory") {
    return <Folder size={16} strokeWidth={1.9} />;
  }

  return <File size={16} strokeWidth={1.9} />;
}

function removeNodeFromTree(nodes: TreeNode[], nodeId: string): RemoveNodeResult {
  let changed = false;
  const nextNodes: TreeNode[] = [];

  nodes.forEach((node) => {
    if (node.id === nodeId) {
      changed = true;
      return;
    }

    const removalResult = node.children ? removeNodeFromTree(node.children, nodeId) : null;

    if (removalResult?.changed) {
      changed = true;
      nextNodes.push({
        ...node,
        children: removalResult.nodes
      });
      return;
    }

    nextNodes.push(node);
  });

  return {
    changed,
    nodes: nextNodes
  };
}

function getNodeMenuActions(
  nodeType: TreeNodeType,
  t: (key: string) => string
): NodeAction[] {
  if (nodeType === "connection") {
    return [
      { id: "refresh", label: t("navigation.menu.refresh") },
      { id: "edit", label: t("navigation.menu.edit_settings") },
      { id: "remove", label: t("navigation.menu.remove"), variant: "danger" }
    ];
  }

  if (nodeType === "container" || nodeType === "directory") {
    return [
      { id: "refresh", label: t("navigation.menu.refresh") },
      { id: "delete", label: t("navigation.menu.delete"), variant: "danger" }
    ];
  }

  return [
    { id: "download", label: t("navigation.menu.download") },
    { id: "delete", label: t("navigation.menu.delete"), variant: "danger" },
    { id: "restore", label: t("navigation.menu.restore"), disabled: true }
  ];
}

function createConnectionId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getNodeDescription(
  selectedNode: NonNullable<ReturnType<typeof flattenTreeNodes>[number]>,
  t: (key: string) => string
) {
  if (selectedNode.type === "connection") {
    return t("content.connection.description");
  }

  if (selectedNode.type === "container") {
    return t("content.container.description");
  }

  if (selectedNode.type === "directory") {
    return t("content.directory.description");
  }

  return t("content.file.description");
}

function getDefaultLocalCachePath(
  name: string,
  provider: ConnectionItem["provider"]
): string | undefined {
  if (provider !== "aws") {
    return undefined;
  }

  return `/Users/demo/CloudEasyFiles/${name.split(" ").join("-")}`;
}

function buildConnection(
  name: string,
  provider: ConnectionItem["provider"],
  connectionId: string
): ConnectionItem {
  const normalizedName = name.trim();

  return {
    id: connectionId,
    name: normalizedName,
    provider,
    localCacheEnabled: provider === "aws",
    localCachePath: getDefaultLocalCachePath(normalizedName, provider),
    children: sortTreeNodes(createFakeNodes(connectionId, provider))
  };
}

function flattenTreeNodes(connections: ConnectionItem[]): Array<{
  id: string;
  name: string;
  type: TreeNodeType;
  provider: ConnectionItem["provider"];
  path?: string;
  description?: string;
  storageClass?: StorageClass;
  availabilityStatus?: AvailabilityStatus;
  localFileState?: LocalFileState;
  sizeLabel?: string;
  lastModified?: string;
  localCacheEnabled?: boolean;
  localCachePath?: string;
  childCount?: number;
}> {
  const items: Array<{
    id: string;
    name: string;
    type: TreeNodeType;
    provider: ConnectionItem["provider"];
    path?: string;
    description?: string;
    storageClass?: StorageClass;
    availabilityStatus?: AvailabilityStatus;
    localFileState?: LocalFileState;
    sizeLabel?: string;
    lastModified?: string;
    localCacheEnabled?: boolean;
    localCachePath?: string;
    childCount?: number;
  }> = [];

  function visitNode(
    node: TreeNode,
    provider: ConnectionItem["provider"],
    localCacheEnabled: boolean,
    localCachePath?: string
  ) {
    items.push({
      id: node.id,
      name: node.name,
      type: node.type,
      provider,
      path: node.path,
      description: node.description,
      storageClass: node.storageClass,
      availabilityStatus: node.availabilityStatus,
      localFileState: node.localFileState,
      sizeLabel: node.sizeLabel,
      lastModified: node.lastModified,
      localCacheEnabled,
      localCachePath,
      childCount: node.children?.length ?? 0
    });

    node.children?.forEach((childNode) =>
      visitNode(childNode, provider, localCacheEnabled, localCachePath)
    );
  }

  connections.forEach((connection) => {
    items.push({
      id: connection.id,
      name: connection.name,
      type: "connection",
      provider: connection.provider,
      description: `${connection.children.length} simulated containers`,
      localCacheEnabled: connection.localCacheEnabled,
      localCachePath: connection.localCachePath,
      childCount: connection.children.length
    });

    connection.children.forEach((childNode) =>
      visitNode(
        childNode,
        connection.provider,
        connection.localCacheEnabled,
        connection.localCachePath
      )
    );
  });

  return items;
}

type ConnectionNavigatorProps = {
  locale: Locale;
  onLocaleChange: (locale: string) => Promise<void>;
};

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";

export function ConnectionNavigator({
  locale,
  onLocaleChange
}: ConnectionNavigatorProps) {
  const { t } = useI18n();
  const nameFieldId = useId();
  const providerFieldId = useId();
  const localeFieldId = useId();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [selectedView, setSelectedView] = useState<NavigatorView>("home");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionModalMode>("create");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionItem["provider"]>("aws");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [openMenuNodeId, setOpenMenuNodeId] = useState<string | null>(null);
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

  const flatNodes = useMemo(() => flattenTreeNodes(connections), [connections]);
  const selectedNode =
    selectedView === "node"
      ? (flatNodes.find((node) => node.id === selectedNodeId) ?? null)
      : null;

  useEffect(() => {
    if (flatNodes.length === 0) {
      if (selectedNodeId !== null || selectedView !== "home") {
        setSelectedNodeId(null);
        setSelectedView("home");
      }
      return;
    }

    if (selectedView !== "node") {
      return;
    }

    const selectedNodeStillExists = flatNodes.some((node) => node.id === selectedNodeId);

    if (!selectedNodeStillExists) {
      setSelectedNodeId(null);
      setSelectedView("home");
    }
  }, [flatNodes, selectedNodeId, selectedView]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isModalOpen]);

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
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

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

  function handleResizeStart() {
    setIsResizingSidebar(true);
  }

  function openModal() {
    setModalMode("create");
    setEditingConnectionId(null);
    setConnectionName("");
    setConnectionProvider("aws");
    setIsModalOpen(true);
  }

  function openEditModal(connectionId: string) {
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      return;
    }

    setModalMode("edit");
    setEditingConnectionId(connection.id);
    setConnectionName(connection.name);
    setConnectionProvider(connection.provider);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingConnectionId(null);
    setConnectionName("");
    setConnectionProvider("aws");
  }

  function toggleExpanded(nodeId: string) {
    setExpandedNodeIds((currentExpandedNodeIds) => {
      const nextExpandedNodeIds = new Set(currentExpandedNodeIds);

      if (nextExpandedNodeIds.has(nodeId)) {
        nextExpandedNodeIds.delete(nodeId);
      } else {
        nextExpandedNodeIds.add(nodeId);
      }

      return nextExpandedNodeIds;
    });
  }

  function handleSaveConnection() {
    const trimmedName = connectionName.trim();

    if (!trimmedName) {
      return;
    }

    if (modalMode === "edit" && editingConnectionId) {
      setConnections((currentConnections) =>
        sortConnections(
          currentConnections.map((connection) => {
            if (connection.id !== editingConnectionId) {
              return connection;
            }

            return {
              ...connection,
              name: trimmedName,
              provider: connectionProvider,
              localCacheEnabled: connectionProvider === "aws",
              localCachePath: getDefaultLocalCachePath(trimmedName, connectionProvider)
            };
          })
        )
      );
      setSelectedView("node");
      setSelectedNodeId(editingConnectionId);
      setOpenMenuNodeId(null);
      closeModal();
      return;
    }

    const nextConnection = buildConnection(trimmedName, connectionProvider, createConnectionId());

    setConnections((currentConnections) => sortConnections([...currentConnections, nextConnection]));
    setSelectedView("node");
    setSelectedNodeId(nextConnection.id);
    setOpenMenuNodeId(null);
    closeModal();
  }

  function handleSelectHome() {
    setSelectedView("home");
    setSelectedNodeId(null);
    setOpenMenuNodeId(null);
  }

  function handleSelectNode(nodeId: string) {
    setSelectedView("node");
    setSelectedNodeId(nodeId);
    setOpenMenuNodeId(null);
  }

  function handleRemoveNode(nodeId: string) {
    setConnections((currentConnections) => {
      const nextConnections = currentConnections
        .filter((connection) => connection.id !== nodeId)
        .map((connection) => {
          const removalResult = removeNodeFromTree(connection.children, nodeId);

          if (!removalResult.changed) {
            return connection;
          }

          return {
            ...connection,
            children: removalResult.nodes
          };
        });

      return nextConnections;
    });

    setExpandedNodeIds((currentExpandedNodeIds) => {
      const nextExpandedNodeIds = new Set(currentExpandedNodeIds);
      nextExpandedNodeIds.delete(nodeId);
      return nextExpandedNodeIds;
    });
    setOpenMenuNodeId(null);
  }

  function handleNodeAction(actionId: string, nodeId: string) {
    if (actionId === "edit") {
      openEditModal(nodeId);
      setOpenMenuNodeId(null);
      return;
    }

    if (actionId === "remove" || actionId === "delete") {
      handleRemoveNode(nodeId);
      return;
    }

    setOpenMenuNodeId(null);
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
                <Home size={18} strokeWidth={2} />
              </button>

              <button
                type="button"
                className="icon-button"
                aria-label={t("navigation.new_connection")}
                title={t("navigation.new_connection")}
                onClick={openModal}
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {connections.length === 0 ? (
            <div className="empty-tree-state">
              <p className="empty-tree-title">{t("navigation.empty.title")}</p>
              <p className="empty-tree-copy">{t("navigation.empty.description")}</p>
              <button type="button" className="primary-button" onClick={openModal}>
                {t("navigation.empty.cta")}
              </button>
            </div>
          ) : (
            <div className="tree-panel">
              <ul className="tree-root">
                {connections.map((connection) => (
                  <li key={connection.id} className="tree-item">
                    <div
                      className={`tree-node-row${selectedNode?.id === connection.id ? " is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="tree-toggle-button"
                        aria-label={
                          expandedNodeIds.has(connection.id)
                            ? t("navigation.collapse")
                            : t("navigation.expand")
                        }
                        onClick={() => toggleExpanded(connection.id)}
                      >
                        {expandedNodeIds.has(connection.id) ? (
                          <ChevronDown size={16} strokeWidth={2.1} />
                        ) : (
                          <ChevronRight size={16} strokeWidth={2.1} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="tree-node-button"
                        onClick={() => handleSelectNode(connection.id)}
                      >
                        <span className="tree-node-main">
                          <span className="tree-node-icon" aria-hidden="true">
                            {getNodeIcon("connection")}
                          </span>
                          <span>{connection.name}</span>
                        </span>
                        <span className={`provider-badge provider-${connection.provider}`}>
                          {connection.provider.toUpperCase()}
                        </span>
                      </button>

                      <TreeItemMenu
                        nodeType="connection"
                        nodeId={connection.id}
                        isOpen={openMenuNodeId === connection.id}
                        onToggle={setOpenMenuNodeId}
                        onAction={handleNodeAction}
                        t={t}
                      />
                    </div>

                    {expandedNodeIds.has(connection.id) ? (
                      <ul className="tree-children">
                        {connection.children.map((child) => (
                          <TreeBranch
                            key={child.id}
                            node={child}
                            selectedNodeId={selectedNodeId}
                            expandedNodeIds={expandedNodeIds}
                            onSelect={handleSelectNode}
                            onToggle={toggleExpanded}
                            openMenuNodeId={openMenuNodeId}
                            onMenuToggle={setOpenMenuNodeId}
                            onAction={handleNodeAction}
                            t={t}
                          />
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
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

        <section className={`content-panel${selectedView === "home" ? " content-panel-home" : ""}`}>
          {selectedView === "home" ? null : (
            <div className="content-toolbar">
              <div>
                <p className="content-eyebrow">{t("content.eyebrow")}</p>
                <h1 className="content-title">{selectedNode?.name ?? t("content.empty.title")}</h1>
              </div>
            </div>
          )}

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

                <label className="field-group compact-field-group home-locale-field" htmlFor={localeFieldId}>
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
            </div>
          ) : selectedNode ? (
            <div className="content-card">
              <p className="content-description">{getNodeDescription(selectedNode, t)}</p>

              <div className="details-grid">
                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.type")}</span>
                  <strong>{t(`content.type.${selectedNode.type}`)}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.provider")}</span>
                  <strong>{t(`content.provider.${selectedNode.provider}`)}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.identifier")}</span>
                  <strong>{selectedNode.id}</strong>
                </article>

                <article className="detail-card detail-card-wide">
                  <span className="detail-label">{t("content.detail.cache_path")}</span>
                  <strong>
                    {selectedNode.localCacheEnabled && selectedNode.localCachePath
                      ? selectedNode.localCachePath
                      : t("content.local_cache.not_configured")}
                  </strong>
                </article>
              </div>

              <div className="action-row">
                {getNodeMenuActions(selectedNode.type, t).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`secondary-button${action.variant === "danger" ? " secondary-button-danger" : ""}`}
                    disabled={action.disabled}
                    onClick={() => handleNodeAction(action.id, selectedNode.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="content-card content-empty">
              <p className="content-description">{t("content.empty.description")}</p>
            </div>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-modal-title"
            onClick={(event) => event.stopPropagation()}
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
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveConnection();
              }}
            >
              <label className="field-group" htmlFor={providerFieldId}>
                <span>{t("navigation.modal.type_label")}</span>
                <select
                  id={providerFieldId}
                  value={connectionProvider}
                  onChange={(event) =>
                    setConnectionProvider(event.target.value as ConnectionItem["provider"])
                  }
                >
                  <option value="aws">{t("content.provider.aws")}</option>
                  <option value="azure">{t("content.provider.azure")}</option>
                </select>
              </label>

              <label className="field-group" htmlFor={nameFieldId}>
                <span>{t("navigation.modal.name_label")}</span>
                <input
                  id={nameFieldId}
                  type="text"
                  value={connectionName}
                  placeholder={t("navigation.modal.name_placeholder")}
                  onChange={(event) => setConnectionName(event.target.value)}
                  autoFocus
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={connectionName.trim().length === 0}
                >
                  {modalMode === "edit" ? t("common.update") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

type TreeBranchProps = {
  node: TreeNode;
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  openMenuNodeId: string | null;
  onMenuToggle: (nodeId: string | null) => void;
  onAction: (actionId: string, nodeId: string) => void;
  t: (key: string) => string;
};

function TreeBranch({
  node,
  selectedNodeId,
  expandedNodeIds,
  onSelect,
  onToggle,
  openMenuNodeId,
  onMenuToggle,
  onAction,
  t
}: TreeBranchProps) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expandedNodeIds.has(node.id);

  return (
    <li className="tree-item">
      <div className={`tree-node-row${selectedNodeId === node.id ? " is-selected" : ""}`}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle-button"
            aria-label={isExpanded ? t("navigation.collapse") : t("navigation.expand")}
            onClick={() => onToggle(node.id)}
          >
            {isExpanded ? (
              <ChevronDown size={16} strokeWidth={2.1} />
            ) : (
              <ChevronRight size={16} strokeWidth={2.1} />
            )}
          </button>
        ) : (
          <span className="tree-toggle-spacer" aria-hidden="true" />
        )}

        <button
          type="button"
          className="tree-node-button tree-node-nested"
          onClick={() => onSelect(node.id)}
        >
          <span className="tree-node-main">
            <span className="tree-node-icon" aria-hidden="true">
              {getNodeIcon(node.type)}
            </span>
            <span>{node.name}</span>
          </span>
        </button>

        <TreeItemMenu
          nodeType={node.type}
          nodeId={node.id}
          isOpen={openMenuNodeId === node.id}
          onToggle={onMenuToggle}
          onAction={onAction}
          t={t}
        />
      </div>

      {hasChildren && isExpanded ? (
        <ul className="tree-children">
          {(node.children ?? []).map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              expandedNodeIds={expandedNodeIds}
              onSelect={onSelect}
              onToggle={onToggle}
              openMenuNodeId={openMenuNodeId}
              onMenuToggle={onMenuToggle}
              onAction={onAction}
              t={t}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type TreeItemMenuProps = {
  nodeType: TreeNodeType;
  nodeId: string;
  isOpen: boolean;
  onToggle: (nodeId: string | null) => void;
  onAction: (actionId: string, nodeId: string) => void;
  t: (key: string) => string;
};

function TreeItemMenu({ nodeType, nodeId, isOpen, onToggle, onAction, t }: TreeItemMenuProps) {
  const actions = getNodeMenuActions(nodeType, t);

  return (
    <div className="tree-item-menu">
      <button
        type="button"
        className="tree-menu-trigger"
        aria-label={t("navigation.item_menu")}
        aria-expanded={isOpen}
        onClick={() => onToggle(isOpen ? null : nodeId)}
      >
        <Ellipsis size={16} strokeWidth={2.1} />
      </button>

      {isOpen ? (
        <div className="tree-menu-popup" onMouseLeave={() => onToggle(null)}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`tree-menu-action${action.variant === "danger" ? " tree-menu-action-danger" : ""}`}
              disabled={action.disabled}
              onClick={() => onAction(action.id, nodeId)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
