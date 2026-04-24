import type { ConnectionProvider } from "../connections/models";

export type NavigationConnectionIndicator = {
  status: "disconnected" | "connecting" | "connected" | "error";
  message?: string;
};

export type NavigationConnectionTestStatus = "idle" | "testing" | "success" | "error";

export type NavigationConnectionTestState = {
  requestId: number;
  status: NavigationConnectionTestStatus;
  message: string | null;
};

export function buildResetConnectionTestState(currentRequestId: number): NavigationConnectionTestState {
  return {
    requestId: currentRequestId + 1,
    status: "idle",
    message: null
  };
}

export function updateConnectionIndicatorMap(
  previousIndicators: Record<string, NavigationConnectionIndicator>,
  connectionId: string,
  indicator: NavigationConnectionIndicator
): Record<string, NavigationConnectionIndicator> {
  return {
    ...previousIndicators,
    [connectionId]: indicator
  };
}

export function clearConnectionProviderAccountId(
  previousProviderAccountIds: Record<string, string>,
  connectionId: string
): Record<string, string> {
  const nextProviderAccountIds = { ...previousProviderAccountIds };
  delete nextProviderAccountIds[connectionId];
  return nextProviderAccountIds;
}

export function setConnectionProviderAccountId(
  previousProviderAccountIds: Record<string, string>,
  connectionId: string,
  accountLabel: string
): Record<string, string> {
  return {
    ...previousProviderAccountIds,
    [connectionId]: accountLabel
  };
}

export function buildNextConnectionRequestId(
  previousRequestIds: Record<string, number>,
  connectionId: string
): { requestId: number; requestIds: Record<string, number> } {
  const requestId = (previousRequestIds[connectionId] ?? 0) + 1;
  return {
    requestId,
    requestIds: {
      ...previousRequestIds,
      [connectionId]: requestId
    }
  };
}

export function buildConnectionTestValidationFailureState(
  provider: ConnectionProvider,
  t: (key: string) => string
): Pick<NavigationConnectionTestState, "status" | "message"> {
  return {
    status: "error",
    message:
      provider === "aws"
        ? t("navigation.modal.aws.test_connection_validation_error")
        : t("navigation.modal.azure.test_connection_validation_error")
  };
}

export function buildConnectionTestInProgressState(
  provider: ConnectionProvider,
  currentRequestId: number,
  t: (key: string) => string
): NavigationConnectionTestState {
  return {
    requestId: currentRequestId + 1,
    status: "testing",
    message:
      provider === "aws"
        ? t("navigation.modal.aws.test_connection_in_progress")
        : t("navigation.modal.azure.test_connection_in_progress")
  };
}

export function buildConnectionTestMissingAccountState(
  provider: ConnectionProvider,
  t: (key: string) => string
): Pick<NavigationConnectionTestState, "status" | "message"> {
  return {
    status: "error",
    message:
      provider === "aws"
        ? t("navigation.modal.aws.test_connection_failure")
        : t("navigation.modal.azure.test_connection_failure")
  };
}

export function buildConnectionTestSuccessState(
  provider: ConnectionProvider,
  accountLabel: string,
  t: (key: string) => string
): Pick<NavigationConnectionTestState, "status" | "message"> {
  return {
    status: "success",
    message:
      provider === "aws"
        ? t("navigation.modal.aws.test_connection_success").replace("{accountId}", accountLabel)
        : t("navigation.modal.azure.test_connection_success").replace(
            "{storageAccountName}",
            accountLabel
          )
  };
}

export function buildDisconnectedIndicator(): NavigationConnectionIndicator {
  return { status: "disconnected" };
}

export function buildConnectingIndicator(): NavigationConnectionIndicator {
  return { status: "connecting" };
}

export function buildConnectedIndicator(): NavigationConnectionIndicator {
  return { status: "connected" };
}

export function buildConnectionErrorIndicator(message: string): NavigationConnectionIndicator {
  return { status: "error", message };
}
