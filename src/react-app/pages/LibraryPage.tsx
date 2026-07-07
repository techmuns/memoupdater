import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Settings as SettingsIcon } from "lucide-react";
import {
  ArrowRight,
  Cloud,
  FileText,
  HardDrive,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { useMemoSync, useSavedMemos } from "../lib/useSavedMemos";
import { deleteSavedMemo, type SavedMemo } from "../lib/savedMemos";
import type { MemoSyncReason } from "../lib/memoSync";
import { useMemoProject } from "../state/MemoProjectContext";

// Saved-memo library. Lists every follow-up memo the analyst has generated
// (persisted per browser), newest first, with open / delete. "New memo"
// clears the current project and returns to the workbench.
export function LibraryPage() {
  const memos = useSavedMemos();
  const { status: syncStatus, reason: syncReason } = useMemoSync();
  const navigate = useNavigate();
  const { startOver } = useMemoProject();

  const startNewMemo = (): void => {
    startOver();
    navigate("/workspace");
  };

  return (
    <div className="space-y-6">
      <Panel
        eyebrow="Library"
        title="Saved memos"
        actions={
          <div className="flex items-center gap-2">
            {syncStatus === "synced" ? (
              <Badge tone="success" className="gap-1">
                <Cloud className="w-3 h-3" /> Synced across devices
              </Badge>
            ) : (
              <Badge tone="neutral" className="gap-1">
                <HardDrive className="w-3 h-3" /> This device
              </Badge>
            )}
            <Button
              size="sm"
              leadingIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={startNewMemo}
            >
              New memo
            </Button>
          </div>
        }
      >
        {syncStatus !== "synced" && <SyncNote reason={syncReason} />}
        {memos.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title="No saved memos yet"
            description="Generate a follow-up memo in the workbench and it'll be saved here automatically, ready to reopen anytime."
            action={
              <Button
                leadingIcon={<Plus className="w-4 h-4" />}
                onClick={startNewMemo}
              >
                Start a memo
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {memos.map((m) => (
              <SavedMemoRow key={m.id} memo={m} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// Explains why the library isn't syncing and how to fix it — so "This device"
// is never a silent mystery.
function SyncNote({ reason }: { reason: MemoSyncReason }) {
  const copy: Record<MemoSyncReason, { title: string; body: string } | null> = {
    ok: null,
    idle: null,
    no_identity: {
      title: "These memos are saved on this device only",
      body: "To sync across your devices, set a sync ID (e.g. your email) in Settings — use the same ID on every device and your library follows you. Without it, memos live only in this browser and can be lost if its storage is cleared.",
    },
    server_unavailable: {
      title: "Cross-device sync isn't available yet",
      body: "A sync ID is set, but the server storage isn't reachable — the worker likely needs to be deployed with the memo KV namespace. Once it's deployed, your memos will sync automatically.",
    },
    offline: {
      title: "Couldn't reach the sync server",
      body: "Working from this device's local copy for now. Reload to retry — your memos will sync once the connection is back.",
    },
  };
  const c = copy[reason];
  if (!c) return null;
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 flex items-start gap-3">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)]">
          {c.title}
        </div>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
          {c.body}
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-[var(--color-ink)] hover:underline"
        >
          <SettingsIcon className="w-3.5 h-3.5" /> Open sync settings
        </Link>
      </div>
    </div>
  );
}

function SavedMemoRow({ memo }: { memo: SavedMemo }) {
  const company = memo.company;
  const savedLabel = useMemo(() => formatSavedAt(memo.savedAt), [memo.savedAt]);
  const sectionCount = memo.memo.sections.length;

  return (
    <li className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)] transition-colors">
      <div className="flex items-center gap-4 px-4 py-3.5">
        <span className="grid place-items-center w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-ink-soft)] text-[var(--color-ink)] shrink-0">
          <FileText className="w-5 h-5" />
        </span>

        <Link
          to={`/memo/${encodeURIComponent(memo.id)}`}
          className="min-w-0 flex-1"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-semibold text-[var(--color-text)] truncate">
              {company?.companyName ?? memo.memo.title}
            </span>
            {company?.ticker && (
              <Badge tone="accent">{company.ticker}</Badge>
            )}
            {memo.generationType === "demo" && (
              <Badge tone="neutral">Demo</Badge>
            )}
          </div>
          <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5 truncate">
            {savedLabel} · {sectionCount} section{sectionCount === 1 ? "" : "s"}
            {memo.researchWindowLabel ? ` · ${memo.researchWindowLabel}` : ""}
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link to={`/memo/${encodeURIComponent(memo.id)}`}>
            <Button
              size="sm"
              variant="outline"
              trailingIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Open
            </Button>
          </Link>
          <button
            type="button"
            aria-label="Delete memo"
            onClick={() => deleteSavedMemo(memo.id)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--color-text-subtle)] hover:text-[var(--color-signal-down)] hover:bg-[var(--color-signal-down-soft)] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Saved";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
