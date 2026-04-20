import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeStorageClassModal } from "./ChangeStorageClassModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const t = (key: string) => key;
const noop = () => {};

const awsRequest = { fileCount: 1 };
const batchRequest = { fileCount: 3, totalSizeLabel: "12 MB", currentStorageClassLabel: "GLACIER" };

describe("ChangeStorageClassModal — AWS provider", () => {
  it("renders the modal with storage class options", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });

  it("shows spinner and submitting label while submitting", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        isSubmitting={true}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("content.storage_class_change.submitting")).toBeInTheDocument();
  });

  it("shows submit error message", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        isSubmitting={false}
        submitError="Upload failed"
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("Upload failed")).toBeInTheDocument();
  });

  it("shows same-class error when initial and selected storage class match", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        initialStorageClass="GLACIER"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("content.storage_class_change.same_class_error")).toBeInTheDocument();
  });

  it("shows batch request metadata", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={batchRequest}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("12 MB")).toBeInTheDocument();
    expect(screen.getByText("GLACIER")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        isSubmitting={false}
        submitError={null}
        onCancel={onCancel}
        onSubmit={noop}
        t={t}
      />
    );
    fireEvent.click(screen.getByText("common.cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows choose-destination error when no initial class and nothing selected", () => {
    render(
      <ChangeStorageClassModal
        provider="aws"
        locale="en-US"
        request={awsRequest}
        initialStorageClass={null}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(
      screen.getByText("content.storage_class_change.choose_destination_error")
    ).toBeInTheDocument();
  });
});

describe("ChangeStorageClassModal — Azure provider", () => {
  it("renders the modal with Azure tier options", () => {
    render(
      <ChangeStorageClassModal
        provider="azure"
        locale="en-US"
        request={awsRequest}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });

  it("shows Azure submitting label while submitting", () => {
    render(
      <ChangeStorageClassModal
        provider="azure"
        locale="en-US"
        request={awsRequest}
        isSubmitting={true}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("content.azure_storage_class_change.submitting")).toBeInTheDocument();
  });
});
