import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SavedMemoPage } from "./pages/SavedMemoPage";
import { useMunshotHost } from "./state/MunshotHostContext";
import { disableMemoSync, enableMemoSync } from "./lib/memoSync";

// Turn on cross-device memo sync once the host tells us who the user is. The
// id (falling back to email) scopes the server-side library; with no identity
// (standalone / local dev) the library stays local-only.
function useMemoLibrarySync(): void {
  const { host } = useMunshotHost();
  const userId = host?.user?.id ?? host?.user?.email ?? null;
  useEffect(() => {
    if (userId) void enableMemoSync(userId);
    else disableMemoSync();
  }, [userId]);
}

function App() {
  useMemoLibrarySync();
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
