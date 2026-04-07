import React from "react";
import ReactDOM from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { AppProviders } from "./app/providers";
import { App } from "./app/App";
import "./styles.css";

const FRONTEND_READY_EVENT = "frontend://ready";
const FRONTEND_BOOT_FAILED_EVENT = "frontend://boot-failed";
const BOOT_RELOAD_STORAGE_KEY = "cloudeasyfiles.boot-reload-count";
const MAX_BOOT_RELOADS = 1;
const BOOT_RENDER_TIMEOUT_MS = 4500;
const BOOT_HEALTHY_SELECTOR = ".app-shell";

let hasFinishedBootstrap = false;

function readBootReloadCount() {
  try {
    return Number(window.sessionStorage.getItem(BOOT_RELOAD_STORAGE_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeBootReloadCount(value: number) {
  try {
    window.sessionStorage.setItem(BOOT_RELOAD_STORAGE_KEY, String(value));
  } catch {
    console.warn("[ui] failed to persist bootstrap reload counter");
  }
}

function clearBootReloadCount() {
  try {
    window.sessionStorage.removeItem(BOOT_RELOAD_STORAGE_KEY);
  } catch {
    console.warn("[ui] failed to clear bootstrap reload counter");
  }
}

function renderBootstrapFallback(rootElement: HTMLElement, message: string) {
  rootElement.innerHTML = `
    <main class="app-shell">
      <section class="app-window">
        <section class="app-frame">
          <div class="content-card content-empty">
            <p class="status-message status-message-error">${message}</p>
          </div>
        </section>
      </section>
    </main>
  `;

  void notifyFrontendBootFailed();
}

function reloadOnceForStartupFailure(reason: string) {
  if (hasFinishedBootstrap) {
    return false;
  }

  const reloadCount = readBootReloadCount();

  if (reloadCount >= MAX_BOOT_RELOADS) {
    return false;
  }

  writeBootReloadCount(reloadCount + 1);
  console.warn(`[ui] retrying startup after ${reason}`);
  window.location.reload();
  return true;
}

async function notifyFrontendReady() {
  if (!isTauri()) {
    return;
  }

  await emit(FRONTEND_READY_EVENT);
}

async function notifyFrontendBootFailed() {
  if (!isTauri()) {
    return;
  }

  await emit(FRONTEND_BOOT_FAILED_EVENT);
}

function mountApp(rootElement: HTMLElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>
  );
}

function isHealthyInitialRender(rootElement: HTMLElement) {
  const appShell = rootElement.querySelector(BOOT_HEALTHY_SELECTOR);

  if (!(appShell instanceof HTMLElement)) {
    return false;
  }

  const { width, height } = appShell.getBoundingClientRect();
  return width > 0 && height > 0;
}

function installBootstrapErrorRecovery(rootElement: HTMLElement) {
  const handleWindowError = (event: ErrorEvent) => {
    console.error("[ui] unhandled startup error", event.error ?? event.message);

    if (reloadOnceForStartupFailure("window error")) {
      return;
    }

    renderBootstrapFallback(
      rootElement,
      "The interface failed during startup. Use Reload to retry."
    );
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("[ui] unhandled startup rejection", event.reason);

    if (reloadOnceForStartupFailure("unhandled rejection")) {
      return;
    }

    renderBootstrapFallback(
      rootElement,
      "The interface failed during startup. Use Reload to retry."
    );
  };

  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleWindowError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}

function bootstrap() {
  const rootElement = document.querySelector("#root");

  if (!(rootElement instanceof HTMLElement)) {
    throw new Error("Root element #root was not found.");
  }

  const removeErrorRecovery = installBootstrapErrorRecovery(rootElement);
  const renderTimeout = window.setTimeout(() => {
    if (isHealthyInitialRender(rootElement)) {
      return;
    }

    const reloaded = reloadOnceForStartupFailure("render timeout");

    if (!reloaded) {
      renderBootstrapFallback(
        rootElement,
        "The interface did not finish loading automatically. Use Reload to retry."
      );
    }
  }, BOOT_RENDER_TIMEOUT_MS);

  try {
    mountApp(rootElement);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!isHealthyInitialRender(rootElement)) {
          return;
        }

        window.clearTimeout(renderTimeout);
        hasFinishedBootstrap = true;
        removeErrorRecovery();
        clearBootReloadCount();
        void notifyFrontendReady();
      });
    });
  } catch (error) {
    window.clearTimeout(renderTimeout);
    console.error("[ui] failed to bootstrap application", error);

    const reloaded = reloadOnceForStartupFailure("bootstrap exception");

    if (!reloaded) {
      removeErrorRecovery();
      renderBootstrapFallback(
        rootElement,
        "The interface failed during startup. Use Reload to retry."
      );
    }
  }
}

bootstrap();
