import { describe, expect, it } from "vitest";

import {
  buildBucketNodes,
  buildHomeSelectionState,
  buildNodeSelectionState,
  clearConnectionBucketNodes,
  findTreeNodeById,
  getTransferCancelLabel,
  setBucketPath,
  sortTreeNodes,
  toggleCollapsedConnection,
  updateBucketNodeMap,
  type NavigationExplorerTreeNode
} from "./navigationTreeState";

describe("navigationTreeState", () => {
  it("builds transfer cancel labels by transfer kind", () => {
    const t = (key: string) => key;

    expect(getTransferCancelLabel("upload", t)).toBe("navigation.menu.cancel_upload");
    expect(getTransferCancelLabel("cache", t)).toBe("navigation.menu.cancel_download");
    expect(getTransferCancelLabel("direct", t)).toBe("navigation.menu.cancel_download");
  });

  it("clears bucket maps and updates bucket paths", () => {
    expect(
      clearConnectionBucketNodes(
        {
          "conn-1": [{ id: "bucket-1" }],
          "conn-2": [{ id: "bucket-2" }]
        },
        "conn-1"
      )
    ).toEqual({
      "conn-2": [{ id: "bucket-2" }]
    });

    expect(setBucketPath({ "bucket-1": "docs/" }, "bucket-2", "reports/")).toEqual({
      "bucket-1": "docs/",
      "bucket-2": "reports/"
    });
  });

  it("updates bucket nodes inside the targeted connection only", () => {
    const buckets: Record<string, NavigationExplorerTreeNode[]> = {
      "conn-1": [
        {
          id: "conn-1:bucket:a",
          kind: "bucket",
          connectionId: "conn-1",
          provider: "aws",
          name: "bucket-a",
          region: "us-east-1"
        },
        {
          id: "conn-1:bucket:b",
          kind: "bucket",
          connectionId: "conn-1",
          provider: "aws",
          name: "bucket-b"
        }
      ],
      "conn-2": [
        {
          id: "conn-2:bucket:c",
          kind: "bucket",
          connectionId: "conn-2",
          provider: "azure",
          name: "bucket-c"
        }
      ]
    };

    expect(
      updateBucketNodeMap(buckets, "conn-1", "conn-1:bucket:b", (node) => ({
        ...node,
        region: "sa-east-1"
      }))
    ).toEqual({
      "conn-1": [
        {
          id: "conn-1:bucket:a",
          kind: "bucket",
          connectionId: "conn-1",
          provider: "aws",
          name: "bucket-a",
          region: "us-east-1"
        },
        {
          id: "conn-1:bucket:b",
          kind: "bucket",
          connectionId: "conn-1",
          provider: "aws",
          name: "bucket-b",
          region: "sa-east-1"
        }
      ],
      "conn-2": [
        {
          id: "conn-2:bucket:c",
          kind: "bucket",
          connectionId: "conn-2",
          provider: "azure",
          name: "bucket-c"
        }
      ]
    });
  });

  it("toggles collapsed connections and builds selection states", () => {
    expect(toggleCollapsedConnection({ "conn-1": true }, "conn-1")).toEqual({
      "conn-1": false
    });
    expect(toggleCollapsedConnection({}, "conn-2")).toEqual({
      "conn-2": true
    });

    expect(buildHomeSelectionState()).toEqual({
      selectedView: "home",
      selectedNodeId: null,
      openMenuConnectionId: null
    });
    expect(buildNodeSelectionState("conn-1")).toEqual({
      selectedView: "node",
      selectedNodeId: "conn-1",
      openMenuConnectionId: null
    });
  });

  it("sorts tree nodes, builds bucket nodes and finds nodes by id", () => {
    const unsortedNodes: NavigationExplorerTreeNode[] = [
      {
        id: "conn-1",
        kind: "connection",
        connectionId: "conn-1",
        provider: "aws",
        name: "Zulu",
        children: [
          {
            id: "conn-1:bucket:b",
            kind: "bucket",
            connectionId: "conn-1",
            provider: "aws",
            name: "20-logs"
          },
          {
            id: "conn-1:bucket:a",
            kind: "bucket",
            connectionId: "conn-1",
            provider: "aws",
            name: "3-reports"
          }
        ]
      },
      {
        id: "bucket-root",
        kind: "bucket",
        connectionId: "conn-2",
        provider: "azure",
        name: "alpha"
      }
    ];

    const sorted = sortTreeNodes(unsortedNodes);
    expect(sorted.map((node) => node.id)).toEqual(["bucket-root", "conn-1"]);
    expect(sorted[1]?.children?.map((node) => node.id)).toEqual([
      "conn-1:bucket:a",
      "conn-1:bucket:b"
    ]);

    expect(
      buildBucketNodes(
        { id: "aws-1", name: "AWS Main", provider: "aws" },
        [{ name: "reports" }, { name: "logs", region: "sa-east-1" }],
        "..."
      )
    ).toEqual([
      {
        id: "aws-1:bucket:logs",
        kind: "bucket",
        connectionId: "aws-1",
        provider: "aws",
        name: "logs",
        region: "sa-east-1",
        bucketName: "logs",
        path: "",
        children: []
      },
      {
        id: "aws-1:bucket:reports",
        kind: "bucket",
        connectionId: "aws-1",
        provider: "aws",
        name: "reports",
        region: "...",
        bucketName: "reports",
        path: "",
        children: []
      }
    ]);

    expect(
      buildBucketNodes(
        {
          id: "az-1",
          name: "Azure Main",
          provider: "azure",
          storageAccountName: "storageaccount",
          authenticationMethod: "shared_key"
        },
        [{ name: "archive" }],
        "..."
      )[0]
    ).toEqual({
      id: "az-1:bucket:archive",
      kind: "bucket",
      connectionId: "az-1",
      provider: "azure",
      name: "archive",
      region: undefined,
      bucketName: "archive",
      path: "",
      children: []
    });

    expect(findTreeNodeById(sorted, "conn-1:bucket:b")?.name).toBe("20-logs");
    expect(findTreeNodeById(sorted, null)).toBeNull();
    expect(findTreeNodeById(sorted, "missing")).toBeNull();
  });
});
