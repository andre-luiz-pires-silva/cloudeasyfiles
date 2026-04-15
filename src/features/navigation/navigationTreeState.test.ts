import { describe, expect, it } from "vitest";

import {
  buildHomeSelectionState,
  buildNodeSelectionState,
  clearConnectionBucketNodes,
  getTransferCancelLabel,
  setBucketPath,
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
});
