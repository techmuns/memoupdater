import { useEffect, useState } from "react";
import { Building2, Check, Cloud, HardDrive, Lock } from "lucide-react";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useMemoSync } from "../lib/useSavedMemos";
import { getSyncId, setSyncId } from "../lib/syncId";
import { useOrgSync } from "../lib/orgSync";

// Settings panel for cross-device memo sync. When the host hands the app a
// session token, the library is locked to the analyst's ORGANIZATION id (from
// the JWT) — shown read-only. Without a token, the analyst sets an editable
// sync ID (same on every device) and the memo library follows them.
export function MemoSyncSettings() {
  const { status } = useMemoSync();
  const { orgId } = useOrgSync();

  // Token present → org-locked, read-only. The org id IS the sync scope.
  if (orgId) {
    return <OrgLockedSync orgId={orgId} synced={status === "synced"} />;
  }

  return <EditableSync />;
}

// Org-scoped, non-editable sync — the sync id comes from the session token.
function OrgLockedSync({ orgId, synced }: { orgId: string; synced: boolean }) {
  return (
    <Panel
      eyebrow="Library"
      title="Cross-device sync"
      actions={
        synced ? (
          <Badge tone="success" className="gap-1">
            <Cloud className="w-3 h-3" /> Synced
          </Badge>
        ) : (
          <Badge tone="neutral" className="gap-1">
            <Cloud className="w-3 h-3" /> Organization
          </Badge>
        )
      }
    >
      <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed mb-3">
        Your memo library is synced with your organization. Everyone signed in
        to your organization shares this library automatically — there's nothing
        to set up.
      </p>

      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] mb-1.5">
        Organization sync ID
      </label>
      <div className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[13px] text-[var(--color-text)]">
        <Building2 className="w-4 h-4 text-[var(--color-text-subtle)] shrink-0" />
        <span className="tnum font-medium">{orgId}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-text-subtle)]">
          <Lock className="w-3 h-3" /> Locked
        </span>
      </div>

      <p className="text-[11px] text-[var(--color-text-subtle)] mt-3 leading-relaxed">
        This is set from your signed-in session and can't be changed here.
      </p>
    </Panel>
  );
}

// Manual, editable sync id — used only when there is no session token.
function EditableSync() {
  const { status, reason } = useMemoSync();
  const [draft, setDraft] = useState<string>(() => getSyncId());
  const [savedAt, setSavedAt] = useState(0);

  // Keep the field in step if the id changes in another tab.
  useEffect(() => {
    const onFocus = () => setDraft(getSyncId());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const current = getSyncId();
  const dirty = draft.trim() !== current;

  const save = () => {
    setSyncId(draft);
    setSavedAt(Date.now());
  };

  const statusLine =
    status === "synced"
      ? "Synced — your memos are backed up and shared across every device using this sync ID."
      : reason === "server_unavailable"
        ? "A sync ID is set, but the server storage isn't reachable yet — the worker needs to be deployed with the memo KV namespace. It'll sync automatically once deployed."
        : reason === "offline"
          ? "Couldn't reach the sync server; retrying on reload. Using this device's local copy meanwhile."
          : "No sync ID set — memos are saved only in this browser. Set one below to sync across devices.";

  return (
    <Panel
      eyebrow="Library"
      title="Cross-device sync"
      actions={
        status === "synced" ? (
          <Badge tone="success" className="gap-1">
            <Cloud className="w-3 h-3" /> Synced
          </Badge>
        ) : (
          <Badge tone="neutral" className="gap-1">
            <HardDrive className="w-3 h-3" /> This device
          </Badge>
        )
      }
    >
      <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed mb-3">
        {statusLine}
      </p>

      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] mb-1.5">
        Sync ID
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. your email — use the SAME on every device"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 h-10 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:border-[var(--color-ink)] focus:outline-none bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
        />
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={!dirty} leadingIcon={<Check className="w-4 h-4" />}>
            Save
          </Button>
          {current && (
            <Button
              variant="outline"
              onClick={() => {
                setDraft("");
                setSyncId("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {savedAt > 0 && !dirty && (
        <p className="text-[11.5px] text-[var(--color-success)] mt-2">
          Saved. Enter the same sync ID on your other devices to share this library.
        </p>
      )}

      <p className="text-[11px] text-[var(--color-text-subtle)] mt-3 leading-relaxed">
        The sync ID scopes your library on the server and can't be verified, so
        treat it like a shared key — use something only you would (your email, or
        a long private phrase), not a guessable value.
      </p>
    </Panel>
  );
}
