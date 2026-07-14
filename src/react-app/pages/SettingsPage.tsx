import { SectionHeader } from "../components/ui/SectionHeader";
import { MemoSyncSettings } from "../components/MemoSyncSettings";

// Settings is intentionally minimal: the only user-facing control is the
// cross-device Sync ID. Server-side LLM readiness / gating is an operator
// concern (configured via env vars) and is no longer surfaced here.
export function SettingsPage() {
  return (
    <div className="max-w-[1040px] mx-auto space-y-7">
      <SectionHeader
        eyebrow="Settings"
        title="Cross-device sync"
        description="Set a Sync ID to back up your memo library and share it across every device. Enter the same ID on another device to see the same memos."
      />

      <MemoSyncSettings />
    </div>
  );
}
