import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ui] unhandled render error", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="app-window">
            <section className="app-frame">
              <div className="content-card content-empty">
                <p className="status-message-error">
                  The interface failed to render. Reload the window to retry.
                </p>
              </div>
            </section>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
