import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContentItemList, type ContentItemListProps } from "./ContentItemList";
import type { NavigationContentExplorerItem } from "../navigationContent";

const directoryItem: NavigationContentExplorerItem = {
  id: "directory:reports",
  kind: "directory",
  name: "reports",
  path: "reports/"
};

const fileItem: NavigationContentExplorerItem = {
  id: "file:reports/a.txt",
  kind: "file",
  name: "a.txt",
  path: "reports/a.txt",
  size: 128,
  lastModified: "2025-01-01T00:00:00Z",
  storageClass: "STANDARD",
  availabilityStatus: "available",
  downloadState: "not_downloaded"
};

function renderContentItemList(overrides: Partial<ContentItemListProps> = {}) {
  const props: ContentItemListProps = {
    items: [directoryItem, fileItem],
    contentViewMode: "list",
    shouldRenderListHeaders: true,
    selectedContentItemIdSet: new Set(),
    previewedContentItemId: null,
    isContentSelectionActive: false,
    selectedBucketConnectionId: "connection-1",
    selectedBucketName: "bucket-1",
    selectedBucketProvider: "aws",
    hasValidGlobalLocalCacheDirectory: true,
    activeTransferIdentityMap: new Map(),
    activeTrackedDownloadIdentityMap: new Map(),
    activeDirectDownloadItemIds: [],
    fileActionAvailabilityContext: {
      provider: "aws",
      connectionId: "connection-1",
      bucketName: "bucket-1",
      hasValidLocalCacheDirectory: true,
      activeTransferIdentityMap: new Map()
    },
    openContentMenuItemId: null,
    contentMenuAnchor: null,
    locale: "en-US",
    t: (key) => (key === "content.selection.select_item" ? "Select {name}" : key),
    onNavigateDirectory: vi.fn(),
    onToggleContentItemSelection: vi.fn(),
    onPreviewContentItem: vi.fn(),
    onOpenContentMenu: vi.fn(),
    onPreviewFileAction: vi.fn(),
    ...overrides
  };

  const view = render(<ContentItemList {...props} />);

  return { ...props, ...view };
}

describe("ContentItemList", () => {
  it("renders headers and content rows in list mode", () => {
    renderContentItemList();

    expect(screen.getByText("navigation.modal.name_label")).toBeInTheDocument();
    expect(screen.getByText("content.detail.storage_class")).toBeInTheDocument();
    expect(screen.getByText("reports")).toBeInTheDocument();
    expect(screen.getByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("STANDARD")).toBeInTheDocument();
  });

  it("navigates when a directory row button is clicked", () => {
    const props = renderContentItemList();

    fireEvent.click(screen.getByRole("button", { name: /reports/i }));

    expect(props.onNavigateDirectory).toHaveBeenCalledWith("reports/");
  });

  it("toggles item selection from row checkboxes", () => {
    const props = renderContentItemList();

    fireEvent.click(screen.getByLabelText("Select a.txt"));

    expect(props.onToggleContentItemSelection).toHaveBeenCalledWith(fileItem.id);
  });

  it("opens a file context menu from the file row", () => {
    const props = renderContentItemList();

    fireEvent.click(screen.getByText("a.txt"));

    expect(props.onPreviewContentItem).toHaveBeenCalledWith(fileItem);
    expect(props.onOpenContentMenu).toHaveBeenCalledWith(
      fileItem.id,
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  it("marks the previewed file row", () => {
    const { container } = renderContentItemList({ previewedContentItemId: fileItem.id });

    expect(container.querySelector('[data-previewed="true"]')).toHaveTextContent("a.txt");
  });

  it("dispatches actions from an open file menu", () => {
    const props = renderContentItemList({
      openContentMenuItemId: fileItem.id,
      contentMenuAnchor: { itemId: fileItem.id, x: 10, y: 20 }
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "content.delete.action" }));

    expect(props.onPreviewFileAction).toHaveBeenCalledWith("delete", fileItem);
  });

  it("renders compact mode without column headers", () => {
    renderContentItemList({
      contentViewMode: "compact",
      shouldRenderListHeaders: false
    });

    expect(screen.queryByText("content.detail.storage_class")).not.toBeInTheDocument();
    expect(screen.getByTitle("reports")).toBeInTheDocument();
    expect(screen.getByTitle("a.txt")).toBeInTheDocument();
  });
});
