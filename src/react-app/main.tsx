import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { MemoProjectProvider } from "./state/MemoProjectContext";
import { MunshotHostProvider } from "./state/MunshotHostContext";
import { HostBridge } from "./state/HostBridge";
import { applyTheme, getStoredTheme } from "./lib/theme";
import "./index.css";

// Apply the saved theme before first paint so there's no light/dark flash.
applyTheme(getStoredTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MunshotHostProvider>
        <MemoProjectProvider>
          <HostBridge />
          <App />
        </MemoProjectProvider>
      </MunshotHostProvider>
    </BrowserRouter>
  </StrictMode>,
);
