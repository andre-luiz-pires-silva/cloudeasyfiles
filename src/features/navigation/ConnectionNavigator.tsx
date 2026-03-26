import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Cloud, Ellipsis, Home, Plus } from "lucide-react";
import logoPrimary from "../../assets/logo-primary.svg";
import { AwsConnectionFields } from "../connections/components/AwsConnectionFields";
import { AzureConnectionPlaceholder } from "../connections/components/AzureConnectionPlaceholder";
import type {
  AwsConnectionDraft,
  ConnectionFormMode,
  ConnectionProvider,
  SavedConnectionSummary
} from "../connections/models";
import { connectionService } from "../connections/services/connectionService";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";

type NavigatorView = "home" | "node";
type ConnectionTestStatus = "idle" | "testing" | "success" | "error";
type FormErrors = Partial<
  Record<"connectionName" | "region" | "accessKeyId" | "secretAccessKey", string>
>;
type NodeAction = {
  id: "edit" | "remove";
  label: string;
  variant?: "danger";
};

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";

function getConnectionActions(t: (key: string) => string): NodeAction[] {
  return [
    { id: "edit", label: t("navigation.menu.edit_settings") },
    { id: "remove", label: t("navigation.menu.remove"), variant: "danger" }
  ];
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
  const regionFieldId = useId();
  const accessKeyFieldId = useId();
  const secretKeyFieldId = useId();
  const cacheDirectoryFieldId = useId();
  const localeFieldId = useId();
  const [connections, setConnections] = useState<SavedConnectionSummary[]>([]);
  const [selectedView, setSelectedView] = useState<NavigatorView>("home");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionFormMode>("create");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionProvider>("aws");
  const [region, setRegion] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [localCacheDirectory, setLocalCacheDirectory] = useState("");
  const [connectionTestStatus, setConnectionTestStatus] =
    useState<ConnectionTestStatus>("idle");
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [openMenuConnectionId, setOpenMenuConnectionId] = useState<string | null>(null);
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
  const connectionTestTimeoutRef = useRef<number | null>(null);

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  );

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
      setSelectedConnectionId(null);
      return;
    }

    const selectedStillExists = connections.some((connection) => connection.id === selectedConnectionId);

    if (!selectedStillExists) {
      setSelectedView("home");
      setSelectedConnectionId(null);
    }
  }, [connections, selectedConnectionId]);

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
    return () => {
      if (connectionTestTimeoutRef.current !== null) {
        window.clearTimeout(connectionTestTimeoutRef.current);
      }
    };
  }, []);

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

  function resetForm() {
    resetConnectionTestState();
    setConnectionName("");
    setConnectionProvider("aws");
    setRegion("");
    setAccessKeyId("");
    setSecretAccessKey("");
    setLocalCacheDirectory("");
    setFormErrors({});
    setSubmitError(null);
  }

  function handleResizeStart() {
    setIsResizingSidebar(true);
  }

  function openCreateModal() {
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
    setIsModalOpen(true);
  }

  async function openEditModal(connectionId: string) {
    const connection = connections.find((item) => item.id === connectionId);

    if (!connection) {
      setSubmitError(t("navigation.modal.load_error"));
      return;
    }

    try {
      setSubmitError(null);
      setModalMode("edit");
      setEditingConnectionId(connectionId);
      setConnectionName(connection.name);
      setConnectionProvider(connection.provider);
      setRegion(connection.region);
      setLocalCacheDirectory(connection.localCacheDirectory ?? "");
      setAccessKeyId("");
      setSecretAccessKey("");
      resetConnectionTestState();
      setFormErrors({});
      setIsModalOpen(true);

      if (connection.provider !== "aws") {
        return;
      }

      const draft = await connectionService.getAwsConnectionDraft(connectionId);
      setAccessKeyId(draft.accessKeyId);
      setSecretAccessKey(draft.secretAccessKey);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("navigation.modal.credentials_load_warning")
      );
    }
  }

  function resetConnectionTestState() {
    if (connectionTestTimeoutRef.current !== null) {
      window.clearTimeout(connectionTestTimeoutRef.current);
      connectionTestTimeoutRef.current = null;
    }

    setConnectionTestStatus("idle");
    setConnectionTestMessage(null);
  }

  function validateConnectionTestFields(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!region.trim()) {
      nextErrors.region = t("navigation.modal.validation.region_required");
    }

    if (!accessKeyId.trim()) {
      nextErrors.accessKeyId = t("navigation.modal.validation.access_key_required");
    }

    if (!secretAccessKey.trim()) {
      nextErrors.secretAccessKey = t("navigation.modal.validation.secret_key_required");
    }

    return nextErrors;
  }

  function handleTestConnection() {
    const nextErrors = validateConnectionTestFields();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setConnectionTestStatus("error");
      setConnectionTestMessage(t("navigation.modal.aws.test_connection_validation_error"));
      return;
    }

    setConnectionTestStatus("testing");
    setConnectionTestMessage(t("navigation.modal.aws.test_connection_in_progress"));

    connectionTestTimeoutRef.current = window.setTimeout(() => {
      connectionTestTimeoutRef.current = null;

      if (accessKeyId.trim().toUpperCase().includes("FAIL")) {
        setConnectionTestStatus("error");
        setConnectionTestMessage(t("navigation.modal.aws.test_connection_failure"));
        return;
      }

      setConnectionTestStatus("success");
      setConnectionTestMessage(t("navigation.modal.aws.test_connection_success"));
    }, 900);
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
  }

  function handleSelectHome() {
    setSelectedView("home");
    setSelectedConnectionId(null);
    setOpenMenuConnectionId(null);
  }

  function handleSelectConnection(connectionId: string) {
    setSelectedView("node");
    setSelectedConnectionId(connectionId);
    setOpenMenuConnectionId(null);
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!connectionName.trim()) {
      nextErrors.connectionName = t("navigation.modal.validation.connection_name_required");
    }

    if (connectionProvider === "aws") {
      if (!region.trim()) {
        nextErrors.region = t("navigation.modal.validation.region_required");
      }

      if (!accessKeyId.trim()) {
        nextErrors.accessKeyId = t("navigation.modal.validation.access_key_required");
      }

      if (!secretAccessKey.trim()) {
        nextErrors.secretAccessKey = t("navigation.modal.validation.secret_key_required");
      }
    }

    return nextErrors;
  }

  async function handleSaveConnection() {
    if (connectionProvider !== "aws") {
      return;
    }

    const nextErrors = validateForm();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const savedConnection = await connectionService.saveAwsConnection({
        id: modalMode === "edit" ? editingConnectionId ?? undefined : undefined,
        name: connectionName,
        provider: "aws",
        region,
        accessKeyId,
        secretAccessKey: secretAccessKey.trim(),
        localCacheDirectory
      } satisfies AwsConnectionDraft);

      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
      setSelectedView("node");
      setSelectedConnectionId(savedConnection.id);
      setOpenMenuConnectionId(null);
      closeModal();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.modal.save_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveConnection(connectionId: string) {
    try {
      await connectionService.deleteConnection(connectionId);
      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
      setOpenMenuConnectionId(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.connections.delete_error"));
    }
  }

  async function handleConnectionAction(actionId: "edit" | "remove", connectionId: string) {
    if (actionId === "edit") {
      await openEditModal(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    await handleRemoveConnection(connectionId);
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
                onClick={openCreateModal}
              >
                <Plus size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {connections.length === 0 && !isLoadingConnections ? (
            <div className="empty-tree-state">
              <p className="empty-tree-title">{t("navigation.empty.title")}</p>
              <p className="empty-tree-copy">{t("navigation.empty.description")}</p>
              <button type="button" className="primary-button" onClick={openCreateModal}>
                {t("navigation.empty.cta")}
              </button>
            </div>
          ) : (
            <div className="tree-panel">
              <ul className="tree-root">
                {connections.map((connection) => (
                  <li key={connection.id} className="tree-item">
                    <div
                      className={`tree-node-row${selectedConnection?.id === connection.id ? " is-selected" : ""}`}
                    >
                      <button
                        type="button"
                        className="tree-node-button"
                        onClick={() => handleSelectConnection(connection.id)}
                      >
                        <span className="tree-node-main">
                          <span className="tree-node-icon" aria-hidden="true">
                            <Cloud size={16} strokeWidth={1.9} />
                          </span>

                          <span className="tree-node-copy">
                            <span>{connection.name}</span>
                            <span className="tree-node-meta">{connection.region}</span>
                          </span>
                        </span>

                        <span className={`provider-badge provider-${connection.provider}`}>
                          {connection.provider.toUpperCase()}
                        </span>
                      </button>

                      <TreeItemMenu
                        connectionId={connection.id}
                        isOpen={openMenuConnectionId === connection.id}
                        onToggle={setOpenMenuConnectionId}
                        onAction={(actionId, connectionId) => {
                          void handleConnectionAction(actionId, connectionId);
                        }}
                        t={t}
                      />
                    </div>
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
                <h1 className="content-title">
                  {selectedConnection?.name ?? t("content.empty.title")}
                </h1>
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

                <label
                  className="field-group compact-field-group home-locale-field"
                  htmlFor={localeFieldId}
                >
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

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          ) : selectedConnection ? (
            <div className="content-card">
              <p className="content-description">{t("content.connection.description")}</p>

              <div className="details-grid">
                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.type")}</span>
                  <strong>{t("content.type.connection")}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.provider")}</span>
                  <strong>{t(`content.provider.${selectedConnection.provider}`)}</strong>
                </article>

                <article className="detail-card">
                  <span className="detail-label">{t("content.detail.identifier")}</span>
                  <strong>{selectedConnection.id}</strong>
                </article>

                <article className="detail-card detail-card-wide">
                  <span className="detail-label">{t("content.detail.cache_path")}</span>
                  <strong>
                    {selectedConnection.localCacheDirectory ??
                      t("content.local_cache.not_configured")}
                  </strong>
                </article>
              </div>

              <div className="action-row">
                {getConnectionActions(t).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`secondary-button${action.variant === "danger" ? " secondary-button-danger" : ""}`}
                    onClick={() => {
                      void handleConnectionAction(action.id, selectedConnection.id);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {submitError ? <p className="status-message-error">{submitError}</p> : null}
            </div>
          ) : (
            <div className="content-card content-empty">
              <p className="content-description">{t("content.empty.description")}</p>
            </div>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="connection-modal-title">
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
                void handleSaveConnection();
              }}
            >
              <label className="field-group" htmlFor={nameFieldId}>
                <span>{t("navigation.modal.name_label")}</span>
                <input
                  id={nameFieldId}
                  type="text"
                  value={connectionName}
                  placeholder={t("navigation.modal.name_placeholder")}
                  onChange={(event) => {
                    setConnectionName(event.target.value);
                    resetConnectionTestState();
                  }}
                  autoFocus
                />
                {formErrors.connectionName ? (
                  <span className="field-error">{formErrors.connectionName}</span>
                ) : null}
              </label>

              <label className="field-group" htmlFor={providerFieldId}>
                <span>{t("navigation.modal.type_label")}</span>
                <select
                  id={providerFieldId}
                  value={connectionProvider}
                  onChange={(event) => {
                    setConnectionProvider(event.target.value as ConnectionProvider);
                    resetConnectionTestState();
                  }}
                >
                  <option value="aws">{t("content.provider.aws")}</option>
                  <option value="azure">{t("content.provider.azure")}</option>
                </select>
              </label>

              {connectionProvider === "aws" ? (
                <AwsConnectionFields
                  regionFieldId={regionFieldId}
                  accessKeyFieldId={accessKeyFieldId}
                  secretKeyFieldId={secretKeyFieldId}
                  cacheDirectoryFieldId={cacheDirectoryFieldId}
                  region={region}
                  accessKeyId={accessKeyId}
                  secretAccessKey={secretAccessKey}
                  localCacheDirectory={localCacheDirectory}
                  errors={{
                    region: formErrors.region,
                    accessKeyId: formErrors.accessKeyId,
                    secretAccessKey: formErrors.secretAccessKey
                  }}
                  connectionTestStatus={connectionTestStatus}
                  connectionTestMessage={connectionTestMessage}
                  isTestButtonDisabled={isSubmitting || connectionTestStatus === "testing"}
                  onRegionChange={(value) => {
                    setRegion(value);
                    resetConnectionTestState();
                  }}
                  onAccessKeyIdChange={(value) => {
                    setAccessKeyId(value);
                    resetConnectionTestState();
                  }}
                  onSecretAccessKeyChange={(value) => {
                    setSecretAccessKey(value);
                    resetConnectionTestState();
                  }}
                  onLocalCacheDirectoryChange={(value) => {
                    setLocalCacheDirectory(value);
                    resetConnectionTestState();
                  }}
                  onTestConnection={handleTestConnection}
                  t={t}
                />
              ) : (
                <AzureConnectionPlaceholder t={t} />
              )}

              {submitError ? <p className="status-message-error">{submitError}</p> : null}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeModal}>
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting || connectionProvider !== "aws"}
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

type TreeItemMenuProps = {
  connectionId: string;
  isOpen: boolean;
  onToggle: (connectionId: string | null) => void;
  onAction: (actionId: "edit" | "remove", connectionId: string) => void;
  t: (key: string) => string;
};

function TreeItemMenu({ connectionId, isOpen, onToggle, onAction, t }: TreeItemMenuProps) {
  return (
    <div className="tree-item-menu">
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
          {getConnectionActions(t).map((action) => (
            <button
              key={action.id}
              type="button"
              className={`tree-menu-action${action.variant === "danger" ? " tree-menu-action-danger" : ""}`}
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
