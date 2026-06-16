import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { MemoProjectProvider } from "./state/MemoProjectContext";
import { MunshotHostProvider } from "./state/MunshotHostContext";
import { HostBridge } from "./state/HostBridge";
import "./index.css";

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
