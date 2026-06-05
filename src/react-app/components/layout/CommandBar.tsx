import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Cloud, CircleUser } from "lucide-react";
import { Button } from "../ui/Button";

export function CommandBar() {
  const navigate = useNavigate();

  return (
    <header className="h-14 shrink-0 sticky top-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/80 border-b border-[var(--color-border)]">
      <div className="h-full px-5 flex items-center gap-3">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-[var(--color-border)] h-8">
          <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-ink)] text-white grid place-items-center text-[11px] font-bold tracking-tight">
            M
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">
              Memo Updater
            </div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
              Buy-side cockpit
            </div>
          </div>
        </div>

        <CommandChip
          label="Project"
          value="RateGain Travel Technologies"
          trailing="RATEGAIN"
        />
        <ChevronRight className="w-3 h-3 text-[var(--color-text-subtle)]" />
        <CommandChip
          label="Stage"
          value="Phase 1 · Demo"
          dot="bg-[var(--color-warning)]"
        />
        <CommandChip
          label="Deploy"
          value="CF Workers"
          icon={<Cloud className="w-3 h-3" />}
        />

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            leadingIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => navigate("/intake")}
          >
            New Memo Update
          </Button>
          <div className="flex items-center gap-1.5 pl-3 ml-1 border-l border-[var(--color-border)] h-7 text-[12px] text-[var(--color-text-muted)]">
            <CircleUser className="w-4 h-4" />
            <span>tech@muns.io</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function CommandChip({
  label,
  value,
  trailing,
  dot,
  icon,
}: {
  label: string;
  value: string;
  trailing?: string;
  dot?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {icon && <span className="text-[var(--color-text-subtle)]">{icon}</span>}
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <span className="text-[12px] font-medium text-[var(--color-text)] tracking-tight">
        {value}
      </span>
      {trailing && (
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
          {trailing}
        </span>
      )}
    </div>
  );
}
