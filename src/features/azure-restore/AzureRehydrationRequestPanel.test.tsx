import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AzureRehydrationRequestPanel } from "./AzureRehydrationRequestPanel";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const t = (key: string) => key;
const noop = () => {};

describe("AzureRehydrationRequestPanel", () => {
  it("renders tier selector with Hot, Cool, Cold options (no Archive)", () => {
    render(
      <AzureRehydrationRequestPanel
        locale="en-US"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const tierRadios = screen
      .getAllByRole("radio")
      .filter((r) => ["Hot", "Cool", "Cold"].includes((r as HTMLInputElement).value));
    expect(tierRadios.length).toBe(3);
    const archiveRadio = screen
      .queryAllByRole("radio")
      .find((r) => (r as HTMLInputElement).value === "Archive");
    expect(archiveRadio).toBeUndefined();
  });

  it("renders priority radios for Standard and High", () => {
    render(
      <AzureRehydrationRequestPanel
        locale="en-US"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    const priorityRadios = screen
      .getAllByRole("radio")
      .filter((r) => ["Standard", "High"].includes((r as HTMLInputElement).value));
    expect(priorityRadios.length).toBe(2);
  });

  it("shows spinner and submitting label while submitting", () => {
    render(
      <AzureRehydrationRequestPanel
        locale="en-US"
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
      <AzureRehydrationRequestPanel
        locale="en-US"
        isSubmitting={false}
        submitError="Rehydration failed"
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(screen.getByText("Rehydration failed")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <AzureRehydrationRequestPanel
        locale="en-US"
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

  it("calls onSubmit with selected tier and priority on form submit", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <AzureRehydrationRequestPanel
        locale="en-US"
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={onSubmit}
        t={t}
      />
    );
    fireEvent.submit(container.querySelector("form")!);
    expect(onSubmit).toHaveBeenCalledWith({ targetTier: "Hot", priority: "Standard" });
  });

  it("renders confirmation summary for batch requests", () => {
    render(
      <AzureRehydrationRequestPanel
        locale="en-US"
        fileCount={4}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmit={noop}
        t={t}
      />
    );
    expect(
      screen.getByText(/restore\.modal\.azure\.confirmation_summary_batch/)
    ).toBeInTheDocument();
  });
});
