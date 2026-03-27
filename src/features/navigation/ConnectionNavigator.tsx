import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  CircleAlert,
  Cloud,
  Ellipsis,
  File,
  Folder,
  Home,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus
} from "lucide-react";
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
import {
  type AwsBucketSummary,
  getAwsBucketRegion,
  listAwsBucketItems,
  listAwsBuckets,
  testAwsConnection
} from "../../lib/tauri/awsConnections";
import type { AwsBucketItemsResult } from "../../lib/tauri/awsConnections";
import type { Locale } from "../../lib/i18n/I18nProvider";
import { useI18n } from "../../lib/i18n/useI18n";

type NavigatorView = "home" | "node";
type ConnectionTestStatus = "idle" | "testing" | "success" | "error";
type ConnectionIndicatorStatus = "disconnected" | "connecting" | "connected" | "error";
type FormErrors = Partial<
  Record<"connectionName" | "accessKeyId" | "secretAccessKey", string>
>;
type NodeAction = {
  id: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove";
  label: string;
  variant?: "danger";
  disabled?: boolean;
};

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";
const MISSING_MINIMUM_S3_PERMISSION_ERROR = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
const CONNECTING_CONNECTION_TITLE_KEY = "navigation.connection_status.connecting";
const CONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.connected";
const DISCONNECTED_CONNECTION_TITLE_KEY = "navigation.connection_status.disconnected";
const BUCKET_REGION_PLACEHOLDER = "...";
const MAX_BUCKET_REGION_REQUESTS = 4;
const CONTENT_VIEW_MODE_STORAGE_KEY = "cloudeasyfiles.content-view-mode";

type ConnectionIndicator = {
  status: ConnectionIndicatorStatus;
  message?: string;
};

type ContentViewMode = "list" | "compact";

type ContentExplorerItem = {
  id: string;
  kind: "directory" | "file";
  name: string;
  path: string;
  size?: number;
  lastModified?: string | null;
  storageClass?: string | null;
};

type TreeNodeKind = "connection" | "bucket";

type ExplorerTreeNode = {
  id: string;
  kind: TreeNodeKind;
  connectionId: string;
  provider: ConnectionProvider;
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  localCacheDirectory?: string;
  children?: ExplorerTreeNode[];
};

function sortTreeNodes(nodes: ExplorerTreeNode[]): ExplorerTreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined
    }))
    .sort((left, right) => {
      const kindOrder = (node: ExplorerTreeNode) => (node.kind === "bucket" ? 0 : 1);

      const kindDifference = kindOrder(left) - kindOrder(right);

      if (kindDifference !== 0) {
        return kindDifference;
      }

      return left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      });
    });
}

function buildBucketNodes(
  connection: SavedConnectionSummary,
  buckets: AwsBucketSummary[]
): ExplorerTreeNode[] {
  return sortTreeNodes(
    buckets.map((bucket) => ({
      id: `${connection.id}:bucket:${bucket.name}`,
      kind: "bucket",
      connectionId: connection.id,
      provider: connection.provider,
      name: bucket.name,
      region: BUCKET_REGION_PLACEHOLDER,
      bucketName: bucket.name,
      path: "",
      children: []
    }))
  );
}

function findNodeById(
  nodes: ExplorerTreeNode[],
  nodeId: string | null
): ExplorerTreeNode | null {
  if (!nodeId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const match = findNodeById(node.children ?? [], nodeId);

    if (match) {
      return match;
    }
  }

  return null;
}

function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

function buildContentItems(result: AwsBucketItemsResult): ContentExplorerItem[] {
  const directories: ContentExplorerItem[] = result.directories
    .map((directory) => ({
      id: `directory:${directory.path}`,
      kind: "directory" as const,
      name: directory.name,
      path: directory.path
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      })
    );

  const files: ContentExplorerItem[] = result.files
    .map((file) => ({
      id: `file:${file.key}`,
      kind: "file" as const,
      name: file.key.split("/").pop() || file.key,
      path: file.key,
      size: file.size,
      lastModified: file.lastModified,
      storageClass: file.storageClass
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
        numeric: true
      })
    );

  return [...directories, ...files];
}

function getPathTitle(path: string, fallback: string): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const name = trimmed.split("/").pop();

  return name && name.length > 0 ? name : path;
}

function buildBreadcrumbs(connectionName: string, bucketName: string, path: string) {
  const breadcrumbs = [
    { label: connectionName, path: null as string | null },
    { label: bucketName, path: "" }
  ];

  if (!path) {
    return breadcrumbs;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = trimmed.split("/");
  let accumulatedPath = "";

  for (const segment of segments) {
    accumulatedPath += `${segment}/`;
    breadcrumbs.push({
      label: segment || "/",
      path: accumulatedPath
    });
  }

  return breadcrumbs;
}

function formatBytes(size: number | undefined, locale: Locale): string {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return "-";
  }

  if (size < 1024) {
    return `${new Intl.NumberFormat(locale).format(size)} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
}

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function buildConnectionFailureMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const errorMessage = extractErrorMessage(error);

  if (errorMessage === MISSING_MINIMUM_S3_PERMISSION_ERROR) {
    return t("navigation.modal.aws.test_connection_missing_minimum_permission");
  }

  return errorMessage ?? t("navigation.modal.aws.test_connection_failure");
}

function getConnectionActions(
  t: (key: string) => string,
  indicator: ConnectionIndicator
): NodeAction[] {
  return [
    indicator.status === "connecting"
      ? { id: "cancelConnect", label: t("navigation.menu.cancel_connect") }
      : indicator.status === "connected"
      ? { id: "disconnect", label: t("navigation.menu.disconnect") }
      : {
          id: "connect",
          label: t("navigation.menu.connect")
        },
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
  const accessKeyFieldId = useId();
  const secretKeyFieldId = useId();
  const cacheDirectoryFieldId = useId();
  const localeFieldId = useId();
  const [connections, setConnections] = useState<SavedConnectionSummary[]>([]);
  const [selectedView, setSelectedView] = useState<NavigatorView>("home");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionFormMode>("create");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionProvider>("aws");
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
  const [pendingDeleteConnectionId, setPendingDeleteConnectionId] = useState<string | null>(null);
  const [connectionIndicators, setConnectionIndicators] = useState<
    Record<string, ConnectionIndicator>
  >({});
  const [connectionProviderAccountIds, setConnectionProviderAccountIds] = useState<
    Record<string, string>
  >({});
  const [connectionBuckets, setConnectionBuckets] = useState<
    Record<string, ExplorerTreeNode[]>
  >({});
  const [bucketContentPaths, setBucketContentPaths] = useState<Record<string, string>>({});
  const [contentItems, setContentItems] = useState<ContentExplorerItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>(() => {
    if (typeof window === "undefined") {
      return "list";
    }

    const savedMode = window.localStorage.getItem(CONTENT_VIEW_MODE_STORAGE_KEY);
    return savedMode === "compact" ? "compact" : "list";
  });
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
  const connectionTestRequestIdRef = useRef(0);
  const connectionRequestIdsRef = useRef<Record<string, number>>({});
  const contentRequestIdRef = useRef(0);

  const treeNodes = useMemo(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        kind: "connection" as const,
        connectionId: connection.id,
        provider: connection.provider,
        name: connection.name,
        localCacheDirectory: connection.localCacheDirectory,
        children: connectionBuckets[connection.id] ?? []
      })),
    [connections, connectionBuckets]
  );

  const selectedNode = useMemo(
    () => findNodeById(treeNodes, selectedNodeId),
    [treeNodes, selectedNodeId]
  );

  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === selectedNode?.connectionId) ?? null,
    [connections, selectedNode]
  );

  const pendingDeleteConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === pendingDeleteConnectionId) ?? null,
    [connections, pendingDeleteConnectionId]
  );
  const selectedConnectionIndicator = selectedConnection
    ? (connectionIndicators[selectedConnection.id] ?? { status: "disconnected" })
    : { status: "disconnected" as const };

  const selectedBucketPath =
    selectedNode?.kind === "bucket" ? (bucketContentPaths[selectedNode.id] ?? "") : "";
  const selectedBucketConnectionId =
    selectedNode?.kind === "bucket" ? selectedNode.connectionId : null;
  const selectedBucketId = selectedNode?.kind === "bucket" ? selectedNode.id : null;
  const selectedBucketName =
    selectedNode?.kind === "bucket" ? (selectedNode.bucketName ?? selectedNode.name) : null;
  const selectedBucketProvider = selectedNode?.kind === "bucket" ? selectedNode.provider : null;
  const selectedBucketRegion =
    selectedNode?.kind === "bucket" ? selectedNode.region ?? null : null;
  const displayedContentTitle =
    selectedNode?.kind === "bucket"
      ? getPathTitle(selectedBucketPath, selectedNode.name)
      : (selectedNode?.name ?? t("content.empty.title"));
  const selectedBreadcrumbs =
    selectedNode?.kind === "bucket" && selectedConnection
      ? buildBreadcrumbs(
          selectedConnection.name,
          selectedNode.bucketName ?? selectedNode.name,
          selectedBucketPath
        )
      : [];

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
      setSelectedNodeId(null);
      return;
    }

    const selectedStillExists = selectedNodeId
      ? findNodeById(treeNodes, selectedNodeId) !== null
      : false;

    if (!selectedStillExists) {
      setSelectedView("home");
      setSelectedNodeId(null);
    }
  }, [connections, selectedNodeId, treeNodes]);

  useEffect(() => {
    setConnectionIndicators((previousIndicators) => {
      const nextIndicators: Record<string, ConnectionIndicator> = {};

      for (const connection of connections) {
        nextIndicators[connection.id] = previousIndicators[connection.id] ?? {
          status: "disconnected"
        };
      }

      return nextIndicators;
    });
  }, [connections]);

  useEffect(() => {
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds: Record<string, string> = {};

      for (const connection of connections) {
        const providerAccountId = previousProviderAccountIds[connection.id];

        if (providerAccountId) {
          nextProviderAccountIds[connection.id] = providerAccountId;
        }
      }

      return nextProviderAccountIds;
    });
  }, [connections]);

  useEffect(() => {
    setConnectionBuckets((previousConnectionBuckets) => {
      const nextConnectionBuckets: Record<string, ExplorerTreeNode[]> = {};

      for (const connection of connections) {
        if (previousConnectionBuckets[connection.id]) {
          nextConnectionBuckets[connection.id] = previousConnectionBuckets[connection.id];
        }
      }

      return nextConnectionBuckets;
    });
  }, [connections]);

  useEffect(() => {
    setBucketContentPaths((previousBucketContentPaths) => {
      const nextBucketContentPaths: Record<string, string> = {};

      for (const connectionId of Object.keys(previousBucketContentPaths)) {
        if (findNodeById(treeNodes, connectionId)) {
          nextBucketContentPaths[connectionId] = previousBucketContentPaths[connectionId];
        }
      }

      return nextBucketContentPaths;
    });
  }, [treeNodes]);

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
      connectionTestRequestIdRef.current += 1;
      contentRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    async function loadContentItems() {
      if (!selectedBucketId || !selectedBucketConnectionId || !selectedBucketName) {
        contentRequestIdRef.current += 1;
        setContentItems([]);
        setContentError(null);
        setIsLoadingContent(false);
        return;
      }

      const requestId = contentRequestIdRef.current + 1;
      contentRequestIdRef.current = requestId;
      setIsLoadingContent(true);
      setContentError(null);

      try {
        if (selectedBucketProvider !== "aws") {
          throw new Error(t("navigation.connection_status.unsupported_provider"));
        }

        const draft = await connectionService.getAwsConnectionDraft(selectedBucketConnectionId);
        const result = await listAwsBucketItems(
          draft.accessKeyId.trim(),
          draft.secretAccessKey.trim(),
          selectedBucketName,
          selectedBucketPath || undefined,
          selectedBucketRegion && selectedBucketRegion !== BUCKET_REGION_PLACEHOLDER
            ? selectedBucketRegion
            : undefined
        );

        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        setContentItems(buildContentItems(result));
        setIsLoadingContent(false);

        if (result.bucketRegion && result.bucketRegion !== selectedBucketRegion) {
          updateBucketNode(selectedBucketConnectionId, selectedBucketId, (node) => ({
            ...node,
            region: result.bucketRegion
          }));
        }
      } catch (error) {
        if (contentRequestIdRef.current !== requestId) {
          return;
        }

        const message = extractErrorMessage(error) ?? t("content.list.load_error");
        setContentItems([]);
        setContentError(message);
        setIsLoadingContent(false);
      }
    }

    void loadContentItems();
  }, [
    selectedBucketConnectionId,
    selectedBucketId,
    selectedBucketName,
    selectedBucketPath,
    selectedBucketProvider,
    selectedBucketRegion,
    t
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(CONTENT_VIEW_MODE_STORAGE_KEY, contentViewMode);
  }, [contentViewMode]);

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
    connectionTestRequestIdRef.current += 1;
    setConnectionTestStatus("idle");
    setConnectionTestMessage(null);
  }

  function updateConnectionIndicator(connectionId: string, indicator: ConnectionIndicator) {
    setConnectionIndicators((previousIndicators) => ({
      ...previousIndicators,
      [connectionId]: indicator
    }));
  }

  function clearConnectionBuckets(connectionId: string) {
    setConnectionBuckets((previousConnectionBuckets) => {
      const nextConnectionBuckets = { ...previousConnectionBuckets };
      delete nextConnectionBuckets[connectionId];
      return nextConnectionBuckets;
    });
  }

  function navigateBucketPath(bucketNodeId: string, nextPath: string) {
    setBucketContentPaths((previousBucketContentPaths) => ({
      ...previousBucketContentPaths,
      [bucketNodeId]: nextPath
    }));
  }

  function updateBucketNode(
    connectionId: string,
    bucketNodeId: string,
    updater: (node: ExplorerTreeNode) => ExplorerTreeNode
  ) {
    setConnectionBuckets((previousConnectionBuckets) => ({
      ...previousConnectionBuckets,
      [connectionId]: (previousConnectionBuckets[connectionId] ?? []).map((bucket) =>
        bucket.id === bucketNodeId ? updater(bucket) : bucket
      )
    }));
  }

  async function hydrateBucketRegions(
    connectionId: string,
    requestId: number,
    accessKeyIdValue: string,
    secretAccessKeyValue: string,
    buckets: AwsBucketSummary[]
  ) {
    let nextBucketIndex = 0;

    async function worker() {
      while (nextBucketIndex < buckets.length) {
        const bucketIndex = nextBucketIndex;
        nextBucketIndex += 1;

        const bucket = buckets[bucketIndex];

        try {
          const region = await getAwsBucketRegion(
            accessKeyIdValue,
            secretAccessKeyValue,
            bucket.name
          );

          if (connectionRequestIdsRef.current[connectionId] !== requestId) {
            return;
          }

          updateBucketNode(connectionId, `${connectionId}:bucket:${bucket.name}`, (node) => ({
            ...node,
            region
          }));
        } catch {
          if (connectionRequestIdsRef.current[connectionId] !== requestId) {
            return;
          }
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_BUCKET_REGION_REQUESTS, buckets.length) }, () => worker())
    );
  }

  async function connectConnection(
    connectionId: string,
    connectionOverride?: SavedConnectionSummary
  ): Promise<void> {
    const connection =
      connectionOverride ?? connections.find((item) => item.id === connectionId);

    if (!connection) {
      return;
    }

    const requestId = (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    connectionRequestIdsRef.current[connectionId] = requestId;

    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "connecting" });

    if (connection.provider !== "aws") {
      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      updateConnectionIndicator(connectionId, {
        status: "error",
        message: t("navigation.connection_status.unsupported_provider")
      });
      return;
    }

    try {
      const draft = await connectionService.getAwsConnectionDraft(connectionId);
      const result = await testAwsConnection(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim()
      );

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      if (!result.accountId) {
        updateConnectionIndicator(connectionId, {
          status: "error",
          message: t("navigation.modal.aws.test_connection_failure")
        });
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) => ({
        ...previousProviderAccountIds,
        [connectionId]: result.accountId
      }));
      const buckets = await listAwsBuckets(
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim()
      );

      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionBuckets((previousConnectionBuckets) => ({
        ...previousConnectionBuckets,
        [connectionId]: buildBucketNodes(connection, buckets)
      }));

      void hydrateBucketRegions(
        connectionId,
        requestId,
        draft.accessKeyId.trim(),
        draft.secretAccessKey.trim(),
        buckets
      );

      updateConnectionIndicator(connectionId, { status: "connected" });
    } catch (error) {
      if (connectionRequestIdsRef.current[connectionId] !== requestId) {
        return;
      }

      setConnectionProviderAccountIds((previousProviderAccountIds) => {
        const nextProviderAccountIds = { ...previousProviderAccountIds };
        delete nextProviderAccountIds[connectionId];
        return nextProviderAccountIds;
      });
      updateConnectionIndicator(connectionId, {
        status: "error",
        message: buildConnectionFailureMessage(error, t)
      });
      clearConnectionBuckets(connectionId);
    }
  }

  async function disconnectConnection(connectionId: string) {
    connectionRequestIdsRef.current[connectionId] =
      (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "disconnected" });
  }

  async function cancelConnectionAttempt(connectionId: string) {
    connectionRequestIdsRef.current[connectionId] =
      (connectionRequestIdsRef.current[connectionId] ?? 0) + 1;
    setConnectionProviderAccountIds((previousProviderAccountIds) => {
      const nextProviderAccountIds = { ...previousProviderAccountIds };
      delete nextProviderAccountIds[connectionId];
      return nextProviderAccountIds;
    });
    clearConnectionBuckets(connectionId);
    updateConnectionIndicator(connectionId, { status: "disconnected" });
  }

  function validateConnectionTestFields(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!accessKeyId.trim()) {
      nextErrors.accessKeyId = t("navigation.modal.validation.access_key_required");
    }

    if (!secretAccessKey.trim()) {
      nextErrors.secretAccessKey = t("navigation.modal.validation.secret_key_required");
    }

    return nextErrors;
  }

  async function handleTestConnection() {
    const nextErrors = validateConnectionTestFields();
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setConnectionTestStatus("error");
      setConnectionTestMessage(t("navigation.modal.aws.test_connection_validation_error"));
      return;
    }

    setConnectionTestStatus("testing");
    setConnectionTestMessage(t("navigation.modal.aws.test_connection_in_progress"));

    const requestId = connectionTestRequestIdRef.current + 1;
    connectionTestRequestIdRef.current = requestId;

    try {
      const result = await testAwsConnection(
        accessKeyId.trim(),
        secretAccessKey.trim()
      );

      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      if (!result.accountId) {
        setConnectionTestStatus("error");
        setConnectionTestMessage(t("navigation.modal.aws.test_connection_failure"));
        return;
      }

      setConnectionTestStatus("success");
      setConnectionTestMessage(
        t("navigation.modal.aws.test_connection_success").replace(
          "{accountId}",
          result.accountId
        )
      );
    } catch (error) {
      if (connectionTestRequestIdRef.current !== requestId) {
        return;
      }

      setConnectionTestStatus("error");
      setConnectionTestMessage(buildConnectionFailureMessage(error, t));
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setModalMode("create");
    setEditingConnectionId(null);
    resetForm();
  }

  function handleSelectHome() {
    setSelectedView("home");
    setSelectedNodeId(null);
    setOpenMenuConnectionId(null);
  }

  function handleSelectNode(node: ExplorerTreeNode) {
    if (node.kind === "bucket") {
      navigateBucketPath(node.id, "");
    }

    setSelectedView("node");
    setSelectedNodeId(node.id);
    setOpenMenuConnectionId(null);
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!connectionName.trim()) {
      nextErrors.connectionName = t("navigation.modal.validation.connection_name_required");
    }

    if (connectionProvider === "aws") {
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
        accessKeyId,
        secretAccessKey: secretAccessKey.trim(),
        localCacheDirectory
      } satisfies AwsConnectionDraft);

      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
      setSelectedView("node");
      setSelectedNodeId(savedConnection.id);
      setOpenMenuConnectionId(null);
      closeModal();
      setIsSubmitting(false);
      void connectConnection(savedConnection.id, savedConnection);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.modal.save_error"));
      setIsSubmitting(false);
    }
  }

  async function handleRemoveConnection(connectionId: string) {
    setPendingDeleteConnectionId(connectionId);
    setOpenMenuConnectionId(null);
  }

  async function confirmRemoveConnection() {
    if (!pendingDeleteConnectionId) {
      return;
    }

    try {
      const connectionId = pendingDeleteConnectionId;
      setPendingDeleteConnectionId(null);

      await connectionService.deleteConnection(connectionId);
      const savedConnections = await connectionService.listConnections();
      setConnections(savedConnections);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("navigation.connections.delete_error"));
    }
  }

  async function handleConnectionAction(
    actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
    connectionId: string
  ) {
    if (actionId === "connect") {
      setOpenMenuConnectionId(null);
      await connectConnection(connectionId);
      return;
    }

    if (actionId === "cancelConnect") {
      await cancelConnectionAttempt(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    if (actionId === "disconnect") {
      await disconnectConnection(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    if (actionId === "edit") {
      await openEditModal(connectionId);
      setOpenMenuConnectionId(null);
      return;
    }

    await handleRemoveConnection(connectionId);
  }

  async function handleDefaultConnectionAction(connectionId: string) {
    const indicator = connectionIndicators[connectionId] ?? { status: "disconnected" };

    if (indicator.status === "connecting") {
      return;
    }

    if (indicator.status === "connected") {
      await openEditModal(connectionId);
      return;
    }

    await connectConnection(connectionId);
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
                      className={`tree-node-row${selectedNode?.connectionId === connection.id ? " is-selected" : ""}`}
                    >
                      <ConnectionTreeNodeItem
                        node={treeNodes.find((node) => node.id === connection.id)!}
                        selectedNodeId={selectedNodeId}
                        connectionIndicators={connectionIndicators}
                        onSelect={handleSelectNode}
                        onConnectionDoubleClick={(connectionId) => {
                          void handleDefaultConnectionAction(connectionId);
                        }}
                        t={t}
                      />

                      <TreeItemMenu
                        connectionId={connection.id}
                        indicator={
                          connectionIndicators[connection.id] ?? { status: "disconnected" }
                        }
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
              <div className="content-toolbar-copy">
                <p className="content-eyebrow">{t("content.eyebrow")}</p>
                <h1 className="content-title">
                  {displayedContentTitle}
                </h1>

                {selectedNode?.kind === "bucket" ? (
                  <nav
                    className="content-breadcrumb"
                    aria-label={t("content.breadcrumb.aria_label")}
                  >
                    {selectedBreadcrumbs.map((breadcrumb, index) => {
                      const isCurrent = index === selectedBreadcrumbs.length - 1;

                      return (
                        <span
                          key={`${breadcrumb.path}:${index}`}
                          className="content-breadcrumb-item"
                        >
                          {index > 0 ? (
                            <ChevronRight
                              size={14}
                              strokeWidth={2}
                              className="content-breadcrumb-separator"
                            />
                          ) : null}

                          {isCurrent ? (
                            <span className="content-breadcrumb-current">
                              {breadcrumb.label}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="content-breadcrumb-link"
                              onClick={() => {
                                if (breadcrumb.path === null) {
                                  const connectionNode = treeNodes.find(
                                    (node) => node.id === selectedNode.connectionId
                                  );

                                  if (connectionNode) {
                                    handleSelectNode(connectionNode);
                                  }

                                  return;
                                }

                                navigateBucketPath(selectedNode.id, breadcrumb.path);
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

              {selectedConnection ? (
                <div className="content-toolbar-side">
                  <div className="content-toolbar-status">
                    <ConnectionStatusIcon
                      indicator={
                        connectionIndicators[selectedConnection.id] ?? { status: "disconnected" }
                      }
                      connectingTitle={t(CONNECTING_CONNECTION_TITLE_KEY)}
                      connectedTitle={t(CONNECTED_CONNECTION_TITLE_KEY)}
                      disconnectedTitle={t(DISCONNECTED_CONNECTION_TITLE_KEY)}
                      size={22}
                    />
                    <span>
                      {getConnectionStatusLabel(
                        connectionIndicators[selectedConnection.id] ?? { status: "disconnected" },
                        t
                      )}
                    </span>
                  </div>

                  {selectedNode && (selectedNode.kind === "bucket" || selectedNode.kind === "connection") ? (
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
                        onClick={() => setContentViewMode("list")}
                      >
                        <List size={16} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className={`content-view-button${contentViewMode === "compact" ? " is-active" : ""}`}
                        aria-label={t("content.view_mode.compact")}
                        title={t("content.view_mode.compact")}
                        onClick={() => setContentViewMode("compact")}
                      >
                        <LayoutGrid size={16} strokeWidth={2} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
          ) : selectedNode ? (
            <div className="content-card">
              {selectedNode.kind === "connection" ? (
                <>
                  <div className="details-grid">
                    <article className="detail-card">
                      <span className="detail-label">{t("content.detail.type")}</span>
                      <strong>{t(`content.type.${selectedNode.kind}`)}</strong>
                    </article>

                    <article className="detail-card">
                      <span className="detail-label">{t("content.detail.provider")}</span>
                      <strong>{t(`content.provider.${selectedNode.provider}`)}</strong>
                    </article>

                    <article className="detail-card">
                      <span className="detail-label">{t("content.detail.identifier")}</span>
                      <strong>
                        {connectionProviderAccountIds[selectedNode.id] ??
                          t("content.detail.identifier_unavailable")}
                      </strong>
                    </article>

                    <article className="detail-card detail-card-wide">
                      <span className="detail-label">{t("content.detail.cache_path")}</span>
                      <strong>
                        {selectedNode.localCacheDirectory ??
                          t("content.local_cache.not_configured")}
                      </strong>
                    </article>
                  </div>

                  <div className="action-row">
                    {getConnectionActions(
                      t,
                      connectionIndicators[selectedNode.id] ?? { status: "disconnected" }
                    ).map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={`secondary-button${action.variant === "danger" ? " secondary-button-danger" : ""}`}
                        disabled={action.disabled}
                        onClick={() => {
                          void handleConnectionAction(action.id, selectedNode.id);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>

                  <div className="content-list-section content-list-section-nested">
                    {selectedConnectionIndicator.status === "connecting" ? (
                      <p className="content-list-state">{t("content.list.loading_containers")}</p>
                    ) : selectedConnectionIndicator.status === "error" ? (
                      <p className="status-message-error">
                        {selectedConnectionIndicator.message ??
                          t("navigation.connection_status.error")}
                      </p>
                    ) : selectedConnectionIndicator.status !== "connected" ? (
                      <p className="content-list-state">{t("content.list.connect_to_load")}</p>
                    ) : (connectionBuckets[selectedNode.id] ?? []).length === 0 ? (
                      <p className="content-list-state">{t("content.list.empty_connection")}</p>
                    ) : (
                      <div
                        className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}
                      >
                        {(connectionBuckets[selectedNode.id] ?? []).map((bucketNode) => (
                          <button
                            key={bucketNode.id}
                            type="button"
                            className={`content-list-item content-list-item-action${contentViewMode === "compact" ? " is-compact" : ""}`}
                            onClick={() => handleSelectNode(bucketNode)}
                          >
                            <span className="content-list-item-main">
                              <span className="content-list-item-icon content-list-item-icon-directory">
                                <Folder size={18} strokeWidth={1.9} />
                              </span>
                              <span className="content-list-item-copy">
                                <strong>{bucketNode.name}</strong>
                                {contentViewMode === "list" ? (
                                  <span>{bucketNode.region ?? BUCKET_REGION_PLACEHOLDER}</span>
                                ) : null}
                              </span>
                            </span>

                            {contentViewMode === "compact" ? (
                              <span className="content-list-item-meta is-compact">
                                <ChevronRight size={16} strokeWidth={2} />
                              </span>
                            ) : (
                              <span className="content-list-item-meta">
                                <span>{t("content.type.container")}</span>
                                <ChevronRight size={16} strokeWidth={2} />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="content-list-section">
                  {isLoadingContent ? (
                    <p className="content-list-state">{t("content.list.loading")}</p>
                  ) : contentError ? (
                    <p className="status-message-error">{contentError}</p>
                  ) : contentItems.length === 0 ? (
                    <p className="content-list-state">
                      {selectedBucketPath
                        ? t("content.list.empty_directory")
                        : t("content.list.empty_container")}
                    </p>
                  ) : (
                    <div
                      className={`content-list${contentViewMode === "compact" ? " is-compact" : ""}`}
                    >
                      {contentItems.map((item) =>
                        item.kind === "directory" ? (
                          <button
                            key={item.id}
                            type="button"
                            className={`content-list-item content-list-item-action${contentViewMode === "compact" ? " is-compact" : ""}`}
                            onClick={() => navigateBucketPath(selectedNode.id, item.path)}
                          >
                            <span className="content-list-item-main">
                              <span className="content-list-item-icon content-list-item-icon-directory">
                                <Folder size={18} strokeWidth={1.9} />
                              </span>
                              <span className="content-list-item-copy content-list-item-copy-directory">
                                <strong>{item.name}</strong>
                              </span>
                            </span>

                            {contentViewMode === "compact" ? (
                              <span className="content-list-item-meta is-compact">
                                <ChevronRight size={16} strokeWidth={2} />
                              </span>
                            ) : (
                              <span className="content-list-item-meta">
                                <span>{t("content.type.directory")}</span>
                                <ChevronRight size={16} strokeWidth={2} />
                              </span>
                            )}
                          </button>
                        ) : (
                          <div
                            key={item.id}
                            className={`content-list-item${contentViewMode === "compact" ? " is-compact" : ""}`}
                          >
                            <span className="content-list-item-main">
                              <span className="content-list-item-icon content-list-item-icon-file">
                                <File size={18} strokeWidth={1.9} />
                              </span>
                              <span className="content-list-item-copy content-list-item-copy-file">
                                <strong>{item.name}</strong>
                                {item.storageClass ? (
                                  <span>{item.storageClass}</span>
                                ) : null}
                              </span>
                            </span>

                            {contentViewMode === "compact" ? null : (
                              <span className="content-list-item-meta content-list-item-meta-stack">
                                <span>{formatBytes(item.size, locale)}</span>
                                <span>{formatDateTime(item.lastModified, locale)}</span>
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

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
                  accessKeyFieldId={accessKeyFieldId}
                  secretKeyFieldId={secretKeyFieldId}
                  cacheDirectoryFieldId={cacheDirectoryFieldId}
                  accessKeyId={accessKeyId}
                  secretAccessKey={secretAccessKey}
                  localCacheDirectory={localCacheDirectory}
                  errors={{
                    accessKeyId: formErrors.accessKeyId,
                    secretAccessKey: formErrors.secretAccessKey
                  }}
                  connectionTestStatus={connectionTestStatus}
                  connectionTestMessage={connectionTestMessage}
                  isTestButtonDisabled={isSubmitting || connectionTestStatus === "testing"}
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

      {pendingDeleteConnection ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card modal-card-compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-connection-modal-title"
          >
            <div className="modal-header">
              <div>
                <p className="modal-eyebrow">{t("navigation.connections.delete_title")}</p>
                <h2 id="delete-connection-modal-title" className="modal-title">
                  {t("navigation.connections.delete_confirm").replace(
                    "{name}",
                    pendingDeleteConnection.name
                  )}
                </h2>
              </div>
            </div>

            <p className="modal-copy">
              {t("navigation.connections.delete_description")
                .replace("{name}", pendingDeleteConnection.name)
                .replace(
                  "{provider}",
                  t(`content.provider.${pendingDeleteConnection.provider}`)
                )}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingDeleteConnectionId(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-danger"
                onClick={() => {
                  void confirmRemoveConnection();
                }}
              >
                {t("navigation.menu.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ConnectionTreeNodeItemProps = {
  node: ExplorerTreeNode;
  selectedNodeId: string | null;
  connectionIndicators: Record<string, ConnectionIndicator>;
  onSelect: (node: ExplorerTreeNode) => void;
  onConnectionDoubleClick: (connectionId: string) => void;
  t: (key: string) => string;
};

function ConnectionTreeNodeItem({
  node,
  selectedNodeId,
  connectionIndicators,
  onSelect,
  onConnectionDoubleClick,
  t
}: ConnectionTreeNodeItemProps) {
  const isSelected = selectedNodeId === node.id;
  const isConnectionNode = node.kind === "connection";
  const indicator = connectionIndicators[node.connectionId] ?? { status: "disconnected" };

  return (
    <div className="tree-node-branch">
      <button
        type="button"
        className={`tree-node-button${!isConnectionNode ? " tree-node-nested" : ""}${isSelected ? " is-selected" : ""}`}
        onClick={() => onSelect(node)}
        onDoubleClick={() => {
          if (isConnectionNode) {
            onConnectionDoubleClick(node.connectionId);
          }
        }}
      >
        <span className="tree-node-main">
          {isConnectionNode ? (
            <ConnectionStatusIcon
              indicator={indicator}
              connectingTitle={t(CONNECTING_CONNECTION_TITLE_KEY)}
              connectedTitle={t(CONNECTED_CONNECTION_TITLE_KEY)}
              disconnectedTitle={t(DISCONNECTED_CONNECTION_TITLE_KEY)}
            />
          ) : (
            <TreeNodeIcon />
          )}

          <span className="tree-node-copy">
            <span>{node.name}</span>
            {node.kind === "bucket" && node.region ? (
              <span className="tree-node-meta">{node.region}</span>
            ) : null}
          </span>
          {node.kind === "connection" ? (
            <span className={`provider-badge provider-${node.provider}`}>
              {node.provider.toUpperCase()}
            </span>
          ) : null}
        </span>
      </button>

      {node.children && node.children.length > 0 ? (
        <ul className="tree-children">
          {node.children.map((childNode) => (
            <li key={childNode.id} className="tree-item">
              <ConnectionTreeNodeItem
                node={childNode}
                selectedNodeId={selectedNodeId}
                connectionIndicators={connectionIndicators}
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

function TreeNodeIcon() {
  return (
    <span className="tree-node-glyph tree-node-glyph-folder" aria-hidden="true">
      <Folder size={16} strokeWidth={1.9} />
    </span>
  );
}

type ConnectionStatusIconProps = {
  indicator: ConnectionIndicator;
  connectingTitle: string;
  connectedTitle: string;
  disconnectedTitle: string;
  size?: number;
};

function ConnectionStatusIcon({
  indicator,
  connectingTitle,
  connectedTitle,
  disconnectedTitle,
  size = 16
}: ConnectionStatusIconProps) {
  if (indicator.status === "connecting") {
    return (
      <span className="connection-status-icon connection-status-icon-connecting" title={connectingTitle}>
        <LoaderCircle size={size} strokeWidth={2} />
      </span>
    );
  }

  if (indicator.status === "connected") {
    return (
      <span className="connection-status-icon connection-status-icon-connected" title={connectedTitle}>
        <Cloud size={size} strokeWidth={1.9} />
      </span>
    );
  }

  if (indicator.status === "error") {
    return (
      <span
        className="connection-status-icon connection-status-icon-error"
        title={indicator.message ?? disconnectedTitle}
      >
        <CircleAlert size={size} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className="connection-status-icon connection-status-icon-disconnected" title={disconnectedTitle}>
      <Cloud size={size} strokeWidth={1.9} />
    </span>
  );
}

type TreeItemMenuProps = {
  connectionId: string;
  indicator: ConnectionIndicator;
  isOpen: boolean;
  onToggle: (connectionId: string | null) => void;
  onAction: (
    actionId: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove",
    connectionId: string
  ) => void;
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

function getConnectionStatusLabel(
  indicator: ConnectionIndicator,
  t: (key: string) => string
): string {
  if (indicator.status === "connected") {
    return t(CONNECTED_CONNECTION_TITLE_KEY);
  }

  if (indicator.status === "connecting") {
    return t(CONNECTING_CONNECTION_TITLE_KEY);
  }

  if (indicator.status === "error") {
    return t("navigation.connection_status.error");
  }

  return t(DISCONNECTED_CONNECTION_TITLE_KEY);
}
