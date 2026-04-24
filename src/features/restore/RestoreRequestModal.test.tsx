import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RestoreRequestModal } from "./RestoreRequestModal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const t = (key: string) => key;
const noop = () => {};

describe("RestoreRequestModal", () => {
  it("renders AWS single-file modal with file name in title", () => {
    render(
      <RestoreRequestModal
        locale="en-US"
        request={{ provider: "aws", fileName: "report.txt", fileSizeLabel: "1.2 MB" }}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmitAwsRequest={noop}
        onSubmitAzureRequest={noop}
        t={t}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/restore\.modal\.aws\.eyebrow/)).toBeInTheDocument();
    expect(screen.getByText(/report\.txt/)).toBeInTheDocument();
  });

  it("renders AWS batch modal with count in title", () => {
    render(
      <RestoreRequestModal
        locale="en-US"
        request={{
          provider: "aws",
          fileCount: 5,
          totalSizeLabel: "10 MB",
          storageClassLabel: "GLACIER"
        }}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmitAwsRequest={noop}
        onSubmitAzureRequest={noop}
        t={t}
      />
    );
    expect(screen.getByText("10 MB")).toBeInTheDocument();
    expect(screen.getByText("GLACIER")).toBeInTheDocument();
  });

  it("renders Azure single-file modal", () => {
    render(
      <RestoreRequestModal
        locale="en-US"
        request={{ provider: "azure", fileName: "archive.zip", fileSizeLabel: "500 KB" }}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmitAwsRequest={noop}
        onSubmitAzureRequest={noop}
        t={t}
      />
    );
    expect(screen.getByText(/restore\.modal\.azure\.eyebrow/)).toBeInTheDocument();
    expect(screen.getByText(/archive\.zip/)).toBeInTheDocument();
  });

  it("renders Azure batch modal", () => {
    render(
      <RestoreRequestModal
        locale="en-US"
        request={{ provider: "azure", fileCount: 3, totalSizeLabel: "6 MB" }}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmitAwsRequest={noop}
        onSubmitAzureRequest={noop}
        t={t}
      />
    );
    expect(screen.getByText("6 MB")).toBeInTheDocument();
  });

  it("renders generic placeholder for unknown provider", () => {
    render(
      <RestoreRequestModal
        locale="en-US"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request={{ provider: "other" as any, fileName: "file.txt", fileSizeLabel: "100 KB" }}
        isSubmitting={false}
        submitError={null}
        onCancel={noop}
        onSubmitAwsRequest={noop}
        onSubmitAzureRequest={noop}
        t={t}
      />
    );
    expect(screen.getByText("restore.modal.generic.placeholder")).toBeInTheDocument();
    expect(screen.getByText("common.close")).toBeInTheDocument();
  });
});
