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

export async function executeContentAreaActionDispatch(params: {
  step: NavigationContentAreaDispatchStep;
  handlers: {
    openCreateFolder: () => void;
    refresh: () => Promise<void>;
  };
}): Promise<void> {
  if (params.step === "openCreateFolder") {
    params.handlers.openCreateFolder();
    return;
  }

  await params.handlers.refresh();
}

export async function executeConnectionActionDispatch(params: {
  steps: NavigationConnectionDispatchStep[];
  handlers: {
    closeMenu: () => void;
    connect: () => Promise<void>;
    cancelConnect: () => Promise<void>;
    disconnect: () => Promise<void>;
    edit: () => Promise<void>;
    remove: () => Promise<void>;
  };
}): Promise<void> {
  for (const step of params.steps) {
    if (step === "closeMenu") {
      params.handlers.closeMenu();
    } else if (step === "connect") {
      await params.handlers.connect();
    } else if (step === "cancelConnect") {
      await params.handlers.cancelConnect();
    } else if (step === "disconnect") {
      await params.handlers.disconnect();
    } else if (step === "edit") {
      await params.handlers.edit();
    } else if (step === "remove") {
      await params.handlers.remove();
    }
  }
}

export async function executeDefaultConnectionAction(params: {
  step: NavigationDefaultConnectionStep;
  handlers: {
    connect: () => Promise<void>;
    edit: () => Promise<void>;
  };
}): Promise<void> {
  if (params.step === "edit") {
    await params.handlers.edit();
  } else if (params.step === "connect") {
    await params.handlers.connect();
  }
}
