import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers";
import { App } from "./app/App";
import "./styles.css";

ReactDOM.createRoot(document.querySelector("#root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
