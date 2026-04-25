import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContentExplorerHeader, type ContentExplorerHeaderProps } from "./ContentExplorerHeader";

function renderHeader(overrides: Partial<ContentExplorerHeaderProps> = {}) {
  const props: ContentExplorerHeaderProps = {
    title: "reports",
    selectedNodeKind: "bucket",
    breadcrumbs: [
      { label: "AWS Main", path: null },
      { label: "archive", path: "" },
      { label: "reports", path: "reports/" }
    ],
    connectionIndicator: { status: "connected" },
    contentFilterText: "",
    contentStatusFilters: [],
    allContentStatusFilters: ["directory", "downloaded", "available", "restoring", "archived"],
    contentStatusSummaryItems: [
      { key: "directory", label: "Directories", count: 2 },
      { key: "available", label: "Available", count: 3 }
    ],
    contentViewMode: "list",
    isFilePreviewEnabled: false,
    t: (key) => key,
    onNavigateConnectionBreadcrumb: vi.fn(),
    onNavigateBucketBreadcrumb: vi.fn(),
    onContentFilterTextChange: vi.fn(),
    onToggleContentStatusFilter: vi.fn(),
    onContentViewModeChange: vi.fn(),
    onFilePreviewEnabledChange: vi.fn(),
    ...overrides
  };

  render(<ContentExplorerHeader {...props} />);

  return props;
}

describe("ContentExplorerHeader", () => {
  it("renders title, connection status, and bucket breadcrumbs", () => {
    renderHeader();

    expect(screen.getByRole("heading", { name: "reports" })).toBeInTheDocument();
    expect(screen.getByText("navigation.connection_status.connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AWS Main" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "archive" })).toBeInTheDocument();
    expect(screen.getAllByText("reports")).toHaveLength(2);
  });

  it("dispatches breadcrumb navigation", () => {
    const props = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "AWS Main" }));
    fireEvent.click(screen.getByRole("button", { name: "archive" }));

    expect(props.onNavigateConnectionBreadcrumb).toHaveBeenCalledTimes(1);
    expect(props.onNavigateBucketBreadcrumb).toHaveBeenCalledWith("");
  });

  it("updates and clears content filter text", () => {
    const props = renderHeader({ contentFilterText: "invoice" });

    fireEvent.change(screen.getByLabelText("content.filter.label"), {
      target: { value: "receipt" }
    });
    fireEvent.click(screen.getByRole("button", { name: "common.clear" }));

    expect(props.onContentFilterTextChange).toHaveBeenCalledWith("receipt");
    expect(props.onContentFilterTextChange).toHaveBeenCalledWith("");
  });

  it("renders status filters for buckets and toggles selected filters", () => {
    const props = renderHeader({ contentStatusFilters: ["available"] });

    fireEvent.click(screen.getByTitle("Available: 3"));

    expect(screen.getByTitle("Directories: 2")).toBeInTheDocument();
    expect(screen.getByTitle("Available: 3")).toHaveAttribute("aria-pressed", "true");
    expect(props.onToggleContentStatusFilter).toHaveBeenCalledWith("available");
  });

  it("hides status filters for connection nodes", () => {
    renderHeader({
      selectedNodeKind: "connection",
      breadcrumbs: [],
      contentStatusSummaryItems: []
    });

    expect(screen.queryByRole("group", { name: "content.filter.status_label" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("content.filter.placeholder_buckets")).toBeInTheDocument();
  });

  it("changes content view mode", () => {
    const props = renderHeader({ contentViewMode: "compact" });

    fireEvent.click(screen.getByRole("button", { name: "content.view_mode.list" }));
    fireEvent.click(screen.getByRole("button", { name: "content.view_mode.compact" }));

    expect(props.onContentViewModeChange).toHaveBeenCalledWith("list");
    expect(props.onContentViewModeChange).toHaveBeenCalledWith("compact");
  });

  it("toggles file preview for bucket nodes", () => {
    const props = renderHeader();

    fireEvent.click(screen.getByLabelText("content.preview.toggle"));

    expect(props.onFilePreviewEnabledChange).toHaveBeenCalledWith(true);
  });
});
