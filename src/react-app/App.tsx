import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SavedMemoPage } from "./pages/SavedMemoPage";
import { useMunshotHost } from "./state/MunshotHostContext";
import { useHostContext } from "./hooks/useHostContext";
import { useOrgSync } from "./lib/orgSync";
import { disableMemoSync, enableMemoSync } from "./lib/memoSync";
import { useSyncId } from "./lib/syncId";

// Turn on cross-device memo sync. When the host hands us a session token, the
// library is scoped to the ORGANIZATION id from the JWT (locked). Without a
// token, a manually-set sync id (Settings) is used, falling back to the
// host-provided user id / email. With no identity anywhere, the library stays
// local-only and the UI explains why.
function useMemoLibrarySync(): void {
  const { host } = useMunshotHost();
  const { orgId } = useOrgSync();
  const manualId = useSyncId();
  const identity =
    orgId || manualId || host?.user?.id || host?.user?.email || null;
  useEffect(() => {
    if (identity) void enableMemoSync(identity);
    else disableMemoSync("no_identity");
  }, [identity]);
}

function App() {
  useMemoLibrarySync();

  // Host session (JWT) from the Munshot parent window, via the single SDK
  // client. The host owns identity — we only READ the token here. The app runs
  // with OR without a token (no token → editable sync id in Settings), so we
  // don't gate the UI on it; we just log it once for handshake confirmation.
  const { session } = useHostContext();

  useEffect(() => {
    if (!session.token) return;
    console.info("[dashboard] token:", session.token);
  }, [session.token]);

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
