import type { SavedConnectionSummary } from "../connections/models";
import type { CloudContainerSummary } from "./providerReadAdapters";

export type NavigationExplorerTreeNode = {
  id: string;
  kind: "connection" | "bucket";
  connectionId: string;
  provider: "aws" | "azure";
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  children?: NavigationExplorerTreeNode[];
};

export type NavigationSelectedState = {
  selectedView: "home" | "node";
  selectedNodeId: string | null;
  openMenuConnectionId: string | null;
};

export function getTransferCancelLabel(
  transferKind: "cache" | "direct" | "upload",
  t: (key: string) => string
): string {
  return transferKind === "upload"
    ? t("navigation.menu.cancel_upload")
    : t("navigation.menu.cancel_download");
}

export function clearConnectionBucketNodes<T>(
  previousConnectionBuckets: Record<string, T[]>,
  connectionId: string
): Record<string, T[]> {
  const nextConnectionBuckets = { ...previousConnectionBuckets };
  delete nextConnectionBuckets[connectionId];
  return nextConnectionBuckets;
}

export function setBucketPath(
  previousBucketContentPaths: Record<string, string>,
  bucketNodeId: string,
  nextPath: string
): Record<string, string> {
  return {
    ...previousBucketContentPaths,
    [bucketNodeId]: nextPath
  };
}

export function updateBucketNodeMap<T extends NavigationExplorerTreeNode>(
  previousConnectionBuckets: Record<string, T[]>,
  connectionId: string,
  bucketNodeId: string,
  updater: (node: T) => T
): Record<string, T[]> {
  return {
    ...previousConnectionBuckets,
    [connectionId]: (previousConnectionBuckets[connectionId] ?? []).map((bucket) =>
      bucket.id === bucketNodeId ? updater(bucket) : bucket
    )
  };
}

export function toggleCollapsedConnection(
  currentCollapsedConnectionIds: Record<string, boolean>,
  connectionId: string
): Record<string, boolean> {
  return {
    ...currentCollapsedConnectionIds,
    [connectionId]: !currentCollapsedConnectionIds[connectionId]
  };
}

export function buildHomeSelectionState(): NavigationSelectedState {
  return {
    selectedView: "home",
    selectedNodeId: null,
    openMenuConnectionId: null
  };
}

export function buildNodeSelectionState(nodeId: string): NavigationSelectedState {
  return {
    selectedView: "node",
    selectedNodeId: nodeId,
    openMenuConnectionId: null
  };
}

export function sortTreeNodes(
  nodes: NavigationExplorerTreeNode[]
): NavigationExplorerTreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.children ? sortTreeNodes(node.children) : undefined
    }))
    .sort((left, right) => {
      const kindOrder = (node: NavigationExplorerTreeNode) =>
        node.kind === "bucket" ? 0 : 1;
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

export function buildBucketNodes(
  connection: SavedConnectionSummary,
  buckets: CloudContainerSummary[],
  bucketRegionPlaceholder: string
): NavigationExplorerTreeNode[] {
  return sortTreeNodes(
    buckets.map((bucket) => ({
      id: `${connection.id}:bucket:${bucket.name}`,
      kind: "bucket" as const,
      connectionId: connection.id,
      provider: connection.provider,
      name: bucket.name,
      region:
        connection.provider === "aws"
          ? bucket.region ?? bucketRegionPlaceholder
          : undefined,
      bucketName: bucket.name,
      path: "",
      children: []
    }))
  );
}

export function findTreeNodeById(
  nodes: NavigationExplorerTreeNode[],
  nodeId: string | null
): NavigationExplorerTreeNode | null {
  if (!nodeId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const match = findTreeNodeById(node.children ?? [], nodeId);

    if (match) {
      return match;
    }
  }

  return null;
}
