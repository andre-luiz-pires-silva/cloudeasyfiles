const MISSING_MINIMUM_S3_PERMISSION_ERROR = "AWS_S3_LIST_BUCKETS_PERMISSION_REQUIRED";
const RESTRICTED_BUCKET_MISMATCH_ERROR = "AWS_S3_RESTRICTED_BUCKET_MISMATCH";

export function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return null;
}

export function isCancelledTransferError(error: unknown): boolean {
  return extractErrorMessage(error) === "DOWNLOAD_CANCELLED";
}

export function isUploadExistsPreflightPermissionError(error: unknown): boolean {
  const message = extractErrorMessage(error)?.toLowerCase() ?? "";

  return (
    message.includes("accessdenied") ||
    message.includes("unauthorizedaccess") ||
    message.includes("forbidden") ||
    message.includes("not authorized")
  );
}

export function buildConnectionFailureMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const errorMessage = extractErrorMessage(error);

  if (errorMessage === MISSING_MINIMUM_S3_PERMISSION_ERROR) {
    return t("navigation.modal.aws.test_connection_missing_minimum_permission");
  }

  if (errorMessage === RESTRICTED_BUCKET_MISMATCH_ERROR) {
    return t("navigation.modal.aws.test_connection_restricted_bucket_mismatch");
  }

  return errorMessage ?? t("navigation.modal.aws.test_connection_failure");
}

export function getConnectionActions(
  t: (key: string) => string,
  indicator: { status: "disconnected" | "connecting" | "connected" | "error" }
): Array<{
  id: "connect" | "cancelConnect" | "disconnect" | "edit" | "remove";
  label: string;
  variant?: "danger";
  disabled?: boolean;
}> {
  return [
    indicator.status === "connecting"
      ? { id: "cancelConnect", label: t("navigation.menu.cancel_connect") }
      : indicator.status === "connected"
        ? { id: "disconnect", label: t("navigation.menu.disconnect") }
        : {
            id: "connect",
            label: t("navigation.menu.connect")
          },
    { id: "edit", label: t("navigation.menu.edit_settings") },
    { id: "remove", label: t("navigation.menu.remove"), variant: "danger" }
  ];
}
