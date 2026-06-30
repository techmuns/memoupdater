import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SavedMemoPage } from "./pages/SavedMemoPage";

function App() {
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
