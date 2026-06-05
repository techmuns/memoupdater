import { useLocation } from "react-router-dom";
import { Badge } from "../ui/Badge";

const LABELS: Record<string, string> = {
  "/": "Overview",
  "/intake": "Memo Intake",
  "/memo-dna": "Memo DNA",
  "/builder": "Follow-up Builder",
  "/output": "Follow-up Memo Output",
  "/settings": "Settings",
};

export function Topbar() {
  const { pathname } = useLocation();
  const label = LABELS[pathname] ?? "Memo Updater";

  return (
    <header className="h-16 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-subtle)] uppercase tracking-wider">
          Project
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">/</span>
        <span className="text-sm font-medium text-[var(--color-text)]">
          RateGain Travel Technologies
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">/</span>
        <span className="text-sm text-[var(--color-text)]">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone="warning">Demo mode</Badge>
        <Badge tone="neutral">tech@muns.io</Badge>
      </div>
    </header>
  );
}
