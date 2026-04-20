import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AwsRestoreRequestPanel } from "./AwsRestoreRequestPanel";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const t = (key: string) => key;
const noop = () => {};

describe("AwsRestoreRequestPanel", () => {
  it("renders all three restore tiers for non-DEEP_ARCHIVE storage", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClass="GLACIER"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const radioValues = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value);
    expect(radioValues).toContain("expedited");
    expect(radioValues).toContain("standard");
    expect(radioValues).toContain("bulk");
  });

  it("excludes expedited tier for DEEP_ARCHIVE storage class", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClass="DEEP_ARCHIVE"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const radioValues = screen
      .getAllByRole("radio")
      .map((r) => (r as HTMLInputElement).value);
    expect(radioValues).not.toContain("expedited");
    expect(radioValues).toContain("standard");
    expect(radioValues).toContain("bulk");
  });

  it("excludes expedited tier when any storageClass in batch contains DEEP_ARCHIVE", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClasses={["GLACIER", "DEEP_ARCHIVE"]}
        fileCount={2}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const radioValues = screen
      .getAllByRole("radio")
      .map((r) => (r as HTMLInputElement).value);
    expect(radioValues).not.toContain("expedited");
  });

  it("shows spinner and submitting label while submitting", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClass="GLACIER"
        isSubmitting={true}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("restore.modal.submitting")).toBeInTheDocument();
  });

  it("shows submit error when present", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClass="GLACIER"
        isSubmitting={false}
        submitError="Restore failed"
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("Restore failed")).toBeInTheDocument();
  });

  it("renders retention days input", () => {
    render(
      <AwsRestoreRequestPanel
        locale="en-US"
        storageClass="GLACIER"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("7");
  });
});
