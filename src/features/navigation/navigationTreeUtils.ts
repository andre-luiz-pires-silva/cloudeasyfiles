export type NavigationTreeNode = {
  id: string;
  kind: "connection" | "bucket";
  connectionId: string;
  provider: "aws" | "azure";
  name: string;
  region?: string;
  bucketName?: string;
  path?: string;
  children?: NavigationTreeNode[];
};

export function matchesFilter(
  parts: Array<string | null | undefined>,
  normalizedFilter: string
): boolean {
  if (!normalizedFilter) {
    return true;
  }

  return parts.some((part) => part?.toLocaleLowerCase().includes(normalizedFilter));
}

export function filterTreeNodes(
  nodes: NavigationTreeNode[],
  normalizedFilter: string
): NavigationTreeNode[] {
  if (!normalizedFilter) {
    return nodes;
  }

  return nodes.reduce<NavigationTreeNode[]>((filteredNodes, node) => {
    const filteredChildren = node.children
      ? filterTreeNodes(node.children, normalizedFilter)
      : undefined;
    const nodeMatches = matchesFilter(
      [node.name, node.provider, node.region, node.bucketName, node.path],
      normalizedFilter
    );

    if (!nodeMatches && (!filteredChildren || filteredChildren.length === 0)) {
      return filteredNodes;
    }

    filteredNodes.push({
      ...node,
      children: filteredChildren
    });

    return filteredNodes;
  }, []);
}

export function getPathTitle(path: string, fallback: string): string {
  if (!path) {
    return fallback;
  }

  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const name = trimmed.split("/").pop();

  return name && name.length > 0 ? name : path;
}

export function buildBreadcrumbs(connectionName: string, bucketName: string, path: string) {
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

export function buildContentCounterLabel(
  t: (key: string) => string,
  isFilterActive: boolean,
  displayedCount: number,
  loadedCount: number
): string {
  if (isFilterActive) {
    return t("content.list.count_filtered")
      .replace("{filtered}", String(displayedCount))
      .replace("{loaded}", String(loadedCount));
  }

  return t("content.list.count_loaded").replace("{loaded}", String(loadedCount));
}

