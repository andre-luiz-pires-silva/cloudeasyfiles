export type NavigationConnectionMenuAction =
  | "connect"
  | "cancelConnect"
  | "disconnect"
  | "edit"
  | "remove";

export type NavigationConnectionDispatchStep =
  | "connect"
  | "cancelConnect"
  | "disconnect"
  | "edit"
  | "remove"
  | "closeMenu";

export type NavigationDefaultConnectionStep = "noop" | "connect" | "edit";

export type NavigationContentAreaAction = "createFolder" | "refresh";

export type NavigationContentAreaDispatchStep = "openCreateFolder" | "refresh";

export function getConnectionActionDispatchSteps(
  actionId: NavigationConnectionMenuAction
): NavigationConnectionDispatchStep[] {
  if (actionId === "connect") {
    return ["closeMenu", "connect"];
  }

  if (actionId === "cancelConnect") {
    return ["cancelConnect", "closeMenu"];
  }

  if (actionId === "disconnect") {
    return ["disconnect", "closeMenu"];
  }

  if (actionId === "edit") {
    return ["edit", "closeMenu"];
  }

  return ["remove"];
}

export function getDefaultConnectionActionStep(params: {
  status: "disconnected" | "connecting" | "connected" | "error";
}): NavigationDefaultConnectionStep {
  if (params.status === "connecting") {
    return "noop";
  }

  if (params.status === "connected") {
    return "edit";
  }

  return "connect";
}

export function getContentAreaActionDispatchStep(
  actionId: NavigationContentAreaAction
): NavigationContentAreaDispatchStep {
  return actionId === "createFolder" ? "openCreateFolder" : "refresh";
}
