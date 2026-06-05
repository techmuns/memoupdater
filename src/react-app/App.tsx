import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { OverviewPage } from "./pages/OverviewPage";
import { IntakePage } from "./pages/IntakePage";
import { MemoDnaPage } from "./pages/MemoDnaPage";
import { BuilderPage } from "./pages/BuilderPage";
import { OutputPage } from "./pages/OutputPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/memo-dna" element={<MemoDnaPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/output" element={<OutputPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default App;
