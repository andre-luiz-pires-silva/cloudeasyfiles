import { useEffect, useId, useMemo, useState } from "react";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";

type TreeNodeType = "connection" | "group" | "resource";
type NavigatorView = "home" | "node";

type TreeNode = {
  id: string;
  name: string;
  type: TreeNodeType;
  children?: TreeNode[];
};

type ConnectionItem = {
  id: string;
  name: string;
  provider: "aws" | "azure";
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

function createFakeNodes(connectionId: string): TreeNode[] {
  return [
    {
      id: `${connectionId}-folder-1`,
      name: "Folder 1",
      type: "group",
      children: [
        {
          id: `${connectionId}-file-1`,
          name: "File 1",
          type: "resource"
        },
        {
          id: `${connectionId}-file-2`,
          name: "File 2",
          type: "resource"
        }
      ]
    },
    {
      id: `${connectionId}-folder-2`,
      name: "Folder 2",
      type: "group",
      children: [
        {
          id: `${connectionId}-folder-3`,
          name: "Folder 3",
          type: "group",
          children: [
            {
              id: `${connectionId}-file-3`,
              name: "File 3",
              type: "resource"
            },
            {
              id: `${connectionId}-file-4`,
              name: "File 4",
              type: "resource"
            }
          ]
        },
        {
          id: `${connectionId}-file-5`,
          name: "File 5",
          type: "resource"
        }
      ]
    }
  ];
}

function getNodeIcon(nodeType: TreeNodeType): string {
  if (nodeType === "connection") {
    return "◉";
  }

  if (nodeType === "group") {
    return "▣";
  }

  return "•";
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

  if (nodeType === "group") {
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
    children: createFakeNodes(connectionId)
  };
}

function flattenTreeNodes(connections: ConnectionItem[]): Array<{
  id: string;
  name: string;
  type: TreeNodeType;
  provider?: ConnectionItem["provider"];
}> {
  const items: Array<{
    id: string;
    name: string;
    type: TreeNodeType;
    provider?: ConnectionItem["provider"];
  }> = [];

  function visitNode(node: TreeNode, provider: ConnectionItem["provider"]) {
    items.push({
      id: node.id,
      name: node.name,
      type: node.type,
      provider
    });

    node.children?.forEach((childNode) => visitNode(childNode, provider));
  }

  connections.forEach((connection) => {
    items.push({
      id: connection.id,
      name: connection.name,
      type: "connection",
      provider: connection.provider
    });

    connection.children.forEach((childNode) => visitNode(childNode, connection.provider));
  });

  return items;
}

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
  const localeFieldId = useId();
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [selectedView, setSelectedView] = useState<NavigatorView>("home");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionItem["provider"]>("aws");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [openMenuNodeId, setOpenMenuNodeId] = useState<string | null>(null);

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

  function openModal() {
    setConnectionName("");
    setConnectionProvider("aws");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
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

    const nextConnection = buildConnection(trimmedName, connectionProvider, createConnectionId());

    setConnections((currentConnections) => [...currentConnections, nextConnection]);
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
    if (actionId === "remove" || actionId === "delete") {
      handleRemoveNode(nodeId);
      return;
    }

    setOpenMenuNodeId(null);
  }

  return (
    <>
      <div className="workspace-shell">
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
                ⌂
              </button>

              <button
                type="button"
                className="icon-button"
                aria-label={t("navigation.new_connection")}
                title={t("navigation.new_connection")}
                onClick={openModal}
              >
                +
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
                        {expandedNodeIds.has(connection.id) ? "▾" : "▸"}
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
                <div>
                  <h2 className="home-title">{t("app.title")}</h2>
                  <p className="eyebrow home-eyebrow">{t("hero.eyebrow")}</p>
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
              <p className="content-description">
                {selectedNode.type === "connection"
                  ? t("content.connection.description")
                  : selectedNode.type === "group"
                    ? t("content.group.description")
                    : t("content.resource.description")}
              </p>

              <div className="details-grid">
                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.type")}</span>
                  <strong>{t(`content.type.${selectedNode.type}`)}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.identifier")}</span>
                  <strong>{selectedNode.id}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.provider")}</span>
                  <strong>
                    {selectedNode.provider
                      ? t(`content.provider.${selectedNode.provider}`)
                      : t("content.provider.contextual")}
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
                <p className="modal-eyebrow">{t("navigation.modal.eyebrow")}</p>
                <h2 id="connection-modal-title" className="modal-title">
                  {t("navigation.modal.title")}
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
                  {t("common.save")}
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
            {isExpanded ? "▾" : "▸"}
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
        ⋯
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
