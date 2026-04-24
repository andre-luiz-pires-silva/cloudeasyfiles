import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ConnectionsSidebar,
  type ConnectionsSidebarProps,
  type ConnectionsSidebarTreeNode
} from "./ConnectionsSidebar";

const awsConnection: ConnectionsSidebarTreeNode = {
  id: "connection-1",
  kind: "connection",
  connectionId: "connection-1",
  provider: "aws",
  name: "AWS Main",
  children: [
    {
      id: "bucket-1",
      kind: "bucket",
      connectionId: "connection-1",
      provider: "aws",
      name: "archive",
      bucketName: "archive",
      region: "us-east-1"
    }
  ]
};

function renderSidebar(overrides: Partial<ConnectionsSidebarProps> = {}) {
  const props: ConnectionsSidebarProps = {
    selectedView: "node",
    selectedNodeId: null,
    connectionsCount: 1,
    isLoadingConnections: false,
    sidebarFilterText: "",
    filteredTreeNodes: [awsConnection],
    normalizedSidebarFilterLength: 0,
    collapsedConnectionIds: {},
    openMenuConnectionId: null,
    connectionIndicators: { "connection-1": { status: "connected" } },
    t: (key) => key,
    onSelectHome: vi.fn(),
    onOpenCreateModal: vi.fn(),
    onSidebarFilterTextChange: vi.fn(),
    onSelectNode: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onOpenMenuConnectionChange: vi.fn(),
    onConnectionAction: vi.fn(),
    onDefaultConnectionAction: vi.fn(),
    ...overrides
  };

  render(<ConnectionsSidebar {...props} />);

  return props;
}

describe("ConnectionsSidebar", () => {
  it("renders navigation actions, filter, connection, and bucket nodes", () => {
    renderSidebar();

    expect(screen.getByLabelText("navigation.home")).toBeInTheDocument();
    expect(screen.getByLabelText("navigation.new_connection")).toBeInTheDocument();
    expect(screen.getByLabelText("navigation.filter.label")).toBeInTheDocument();
    expect(screen.getByText("AWS Main")).toBeInTheDocument();
    expect(screen.getByText("archive")).toBeInTheDocument();
    expect(screen.getByText("us-east-1")).toBeInTheDocument();
  });

  it("dispatches home, create, filter, and clear actions", () => {
    const props = renderSidebar({ sidebarFilterText: "prod" });

    fireEvent.click(screen.getByLabelText("navigation.home"));
    fireEvent.click(screen.getByLabelText("navigation.new_connection"));
    fireEvent.change(screen.getByLabelText("navigation.filter.label"), {
      target: { value: "archive" }
    });
    fireEvent.click(screen.getByLabelText("common.clear"));

    expect(props.onSelectHome).toHaveBeenCalledTimes(1);
    expect(props.onOpenCreateModal).toHaveBeenCalledTimes(1);
    expect(props.onSidebarFilterTextChange).toHaveBeenCalledWith("archive");
    expect(props.onSidebarFilterTextChange).toHaveBeenCalledWith("");
  });

  it("selects nodes and dispatches default connection action on double click", () => {
    const props = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /AWS Main/i }));
    fireEvent.doubleClick(screen.getByRole("button", { name: /AWS Main/i }));
    fireEvent.click(screen.getByRole("button", { name: /archive/i }));

    expect(props.onSelectNode).toHaveBeenCalledWith(awsConnection);
    expect(props.onDefaultConnectionAction).toHaveBeenCalledWith("connection-1");
    expect(props.onSelectNode).toHaveBeenCalledWith(awsConnection.children?.[0]);
  });

  it("collapses connection nodes", () => {
    const props = renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "navigation.collapse" }));

    expect(props.onToggleCollapsed).toHaveBeenCalledWith("connection-1");
  });

  it("opens the connection menu and dispatches menu actions", () => {
    const props = renderSidebar({
      openMenuConnectionId: "connection-1",
      connectionIndicators: { "connection-1": { status: "disconnected" } }
    });

    fireEvent.click(screen.getByLabelText("navigation.item_menu"));
    fireEvent.click(screen.getByRole("menuitem", { name: "navigation.menu.connect" }));

    expect(props.onOpenMenuConnectionChange).toHaveBeenCalledWith(null);
    expect(props.onConnectionAction).toHaveBeenCalledWith("connect", "connection-1");
  });

  it("renders empty states", () => {
    const { rerender } = render(
      <ConnectionsSidebar
        {...renderSidebarProps({
          connectionsCount: 0,
          filteredTreeNodes: []
        })}
      />
    );

    expect(screen.getByText("navigation.empty.title")).toBeInTheDocument();

    rerender(
      <ConnectionsSidebar
        {...renderSidebarProps({
          connectionsCount: 1,
          filteredTreeNodes: []
        })}
      />
    );

    expect(screen.getByText("navigation.filter.empty")).toBeInTheDocument();
  });
});

function renderSidebarProps(overrides: Partial<ConnectionsSidebarProps> = {}): ConnectionsSidebarProps {
  return {
    selectedView: "node",
    selectedNodeId: null,
    connectionsCount: 1,
    isLoadingConnections: false,
    sidebarFilterText: "",
    filteredTreeNodes: [awsConnection],
    normalizedSidebarFilterLength: 0,
    collapsedConnectionIds: {},
    openMenuConnectionId: null,
    connectionIndicators: { "connection-1": { status: "connected" } },
    t: (key) => key,
    onSelectHome: vi.fn(),
    onOpenCreateModal: vi.fn(),
    onSidebarFilterTextChange: vi.fn(),
    onSelectNode: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onOpenMenuConnectionChange: vi.fn(),
    onConnectionAction: vi.fn(),
    onDefaultConnectionAction: vi.fn(),
    ...overrides
  };
}
