import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SavedMemoPage } from "./pages/SavedMemoPage";
import { useMunshotHost } from "./state/MunshotHostContext";
import { useHostContext } from "./hooks/useHostContext";
import { disableMemoSync, enableMemoSync } from "./lib/memoSync";
import { useSyncId } from "./lib/syncId";

// Turn on cross-device memo sync. A manually-set sync id (Settings) wins so the
// analyst can guarantee the SAME identity on every device; otherwise we use the
// host-provided user id / email. With no identity anywhere, the library stays
// local-only and the UI explains why.
function useMemoLibrarySync(): void {
  const { host } = useMunshotHost();
  const manualId = useSyncId();
  const identity = manualId || host?.user?.id || host?.user?.email || null;
  useEffect(() => {
    if (identity) void enableMemoSync(identity);
    else disableMemoSync("no_identity");
  }, [identity]);
}

function App() {
  useMemoLibrarySync();

  // Host session (JWT) from the Munshot parent window, via the single SDK
  // client. The host owns identity — we only READ the token here.
  const { session } = useHostContext();

  useEffect(() => {
    if (!session.token) return;
    console.info("[dashboard] token:", session.token);
  }, [session.token]);

  // token === null on first render is TRANSIENT while the host:init handshake
  // completes. Show a small inline notice — never an error/redirect/retry. When
  // served standalone (outside the Munshot host) the token stays null and this
  // notice persists, which is expected.
  if (!session.token) {
    return (
      <div className="h-screen grid place-items-center text-[13px] text-[var(--color-text-muted)]">
        Waiting for session…
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" replace />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/memo/:id" element={<SavedMemoPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/intake" element={<Navigate to="/workspace" replace />} />
        <Route path="/memo-dna" element={<Navigate to="/workspace" replace />} />
        <Route path="/builder" element={<Navigate to="/workspace" replace />} />
        <Route path="/output" element={<Navigate to="/workspace" replace />} />
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
