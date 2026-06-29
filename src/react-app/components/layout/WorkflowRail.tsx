import {
  Check,
  Crosshair,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { MissionStep, MissionStepId } from "../../lib/missionTrackerState";

// Two-pane workbench: the persistent left rail. It is the SINGLE source of
// workflow truth (it replaces the old stacked MemoMissionTracker and the
// per-step progress lists' duplicated overviews). Each step shows
// pending / active / complete; the active step also shows a compact live
// count ("2 / 6 passes") so the rail conveys momentum without the main pane
// having to. Completed and active steps are clickable to revisit; future
// steps are inert.

const ICONS: Record<MissionStepId, LucideIcon> = {
  upload: UploadCloud,
  detect: Crosshair,
  research: Search,
  generate: Sparkles,
  review: FileCheck2,
};

export interface RailProgress {
  done: number;
  total: number;
  noun: string;
}

interface WorkflowRailProps {
  steps: MissionStep[];
  effectiveStepId: MissionStepId;
  onSelectStep: (id: MissionStepId) => void;
  progressByStep?: Partial<Record<MissionStepId, RailProgress>>;
  onStartOver?: () => void;
}

export function WorkflowRail({
  steps,
  effectiveStepId,
  onSelectStep,
  progressByStep,
  onStartOver,
}: WorkflowRailProps) {
  const completedCount = steps.filter((s) => s.status === "complete").length;
  return (
    <aside
      className="lg:sticky lg:top-0 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-4 py-4"
      aria-label="Workflow progress"
    >
      <header className="flex items-center justify-between gap-3 mb-3 px-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
          Workflow
        </div>
        <div className="text-[11px] tnum text-[var(--color-text-muted)]">
          {completedCount} of {steps.length}
        </div>
      </header>
      <ol className="space-y-1">
        {steps.map((step, i) => (
          <RailStep
            key={step.id}
            step={step}
            isLast={i === steps.length - 1}
            isViewing={step.id === effectiveStepId}
            progress={progressByStep?.[step.id]}
            onSelect={() => onSelectStep(step.id)}
          />
        ))}
      </ol>
      {onStartOver && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onStartOver}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Start over
          </button>
        </div>
      )}
    </aside>
  );
}

function RailStep({
  step,
  isLast,
  isViewing,
  progress,
  onSelect,
}: {
  step: MissionStep;
  isLast: boolean;
  isViewing: boolean;
  progress?: RailProgress;
  onSelect: () => void;
}) {
  const Icon = ICONS[step.id];
  const isComplete = step.status === "complete";
  const isActive = step.status === "active";
  const isPending = step.status === "pending";
  // Completed and active steps can be revisited; future steps are inert.
  const selectable = !isPending;

  return (
    <li className="relative">
      {/* Connector down to the next bubble */}
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[19px] top-9 h-[calc(100%-12px)] w-[2px] transition-colors",
            isComplete ? "bg-[var(--color-ink)]" : "bg-[var(--color-border)]",
          )}
        />
      )}
      <button
        type="button"
        onClick={selectable ? onSelect : undefined}
        disabled={!selectable}
        aria-current={isViewing ? "step" : undefined}
        className={cn(
          "relative w-full flex items-start gap-3 rounded-[var(--radius-md)] px-1.5 py-1.5 text-left transition-colors",
          selectable && "hover:bg-[var(--color-surface-muted)] cursor-pointer",
          !selectable && "cursor-default",
          isViewing && "bg-[var(--color-ink-soft)]",
        )}
      >
        {/* Bubble */}
        <span
          className={cn(
            "relative w-10 h-10 rounded-full border-2 grid place-items-center shrink-0 transition-colors",
            isComplete &&
              "bg-[var(--color-ink)] border-[var(--color-ink)] text-white",
            isActive &&
              "bg-[var(--color-surface)] border-[var(--color-ink)] text-[var(--color-ink)]",
            isPending &&
              "bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-text-subtle)]",
          )}
        >
          {isActive && (
            <span
              aria-hidden
              className="absolute inset-[-4px] rounded-full ring-2 ring-[var(--color-ink)]/15 animate-pulse"
            />
          )}
          {isComplete ? (
            <Check className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          )}
        </span>

        <span className="min-w-0 flex-1 pt-0.5">
          <span
            className={cn(
              "flex items-center gap-1.5 text-[13px] font-semibold tracking-tight",
              isComplete || isActive
                ? "text-[var(--color-text)]"
                : "text-[var(--color-text-subtle)]",
            )}
          >
            <span className="truncate">{step.label}</span>
          </span>
          <span className="block text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">
            {step.helper}
          </span>
          {isActive && progress && progress.total > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-text-muted)]">
              {progress.done < progress.total && (
                <Loader2 className="w-3 h-3 animate-spin text-[var(--color-ink)]" />
              )}
              <span className="tnum">
                {progress.done} / {progress.total}
              </span>{" "}
              {progress.noun}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
