import {
  Check,
  Crosshair,
  FileCheck2,
  Loader2,
  Search,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";
import type { MissionStep, MissionStepId } from "../lib/missionTrackerState";

// Workflow-progress rail — the live "tick · tick · tick" the analyst watches.
// Each top-level step shows pending / active / complete; the Research and
// Generate steps also expand into a per-sub-task list (the 6 research passes
// and the up-to-9 memo sections) so the user sees real-time progress instead
// of one big spinner.

const ICONS: Record<MissionStepId, LucideIcon> = {
  upload: UploadCloud,
  detect: Crosshair,
  research: Search,
  generate: Sparkles,
  review: FileCheck2,
};

// Live sub-task per step. We only show sub-tasks for steps that have any.
export type SubTaskStatus = "pending" | "running" | "complete" | "failed";
export interface MissionSubTask {
  label: string;
  status: SubTaskStatus;
}

interface MemoMissionTrackerProps {
  steps: MissionStep[];
  // Optional per-step sub-task lists. Keys are MissionStepId. When present
  // the step's panel renders a tick list below the headline label.
  subTasks?: Partial<Record<MissionStepId, MissionSubTask[]>>;
}

export function MemoMissionTracker({
  steps,
  subTasks,
}: MemoMissionTrackerProps) {
  const completedCount = steps.filter((s) => s.status === "complete").length;
  return (
    <section
      className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-5 py-4"
      aria-label="Workflow progress"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
          Workflow progress
        </div>
        <div className="text-[11px] tnum text-[var(--color-text-muted)]">
          {completedCount} of {steps.length} complete
        </div>
      </header>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            isLast={i === steps.length - 1}
            subTasks={subTasks?.[step.id]}
          />
        ))}
      </ol>
    </section>
  );
}

function StepRow({
  step,
  isLast,
  subTasks,
}: {
  step: MissionStep;
  isLast: boolean;
  subTasks?: MissionSubTask[];
}) {
  const Icon = ICONS[step.id];
  const isComplete = step.status === "complete";
  const isActive = step.status === "active";
  const hasSubs = isActive && subTasks && subTasks.length > 0;
  return (
    <li className="relative flex items-start gap-3">
      {/* Vertical connector down to the next step */}
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[19px] top-10 bottom-[-12px] w-[2px] transition-colors",
            isComplete ? "bg-[var(--color-ink)]" : "bg-[var(--color-border)]",
          )}
        />
      )}

      {/* Step bubble */}
      <div
        className={cn(
          "relative w-10 h-10 rounded-full border-2 grid place-items-center shrink-0 transition-colors",
          isComplete &&
            "bg-[var(--color-ink)] border-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]",
          isActive &&
            "bg-[var(--color-surface)] border-[var(--color-ink)] text-[var(--color-ink)]",
          !isComplete &&
            !isActive &&
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
        <span
          className={cn(
            "absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold grid place-items-center border",
            isComplete || isActive
              ? "bg-[var(--color-surface)] border-[var(--color-ink)] text-[var(--color-ink)]"
              : "bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-text-subtle)]",
          )}
        >
          {step.index}
        </span>
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={cn(
            "text-[13px] font-semibold tracking-tight transition-colors",
            isComplete || isActive
              ? "text-[var(--color-text)]"
              : "text-[var(--color-text-subtle)]",
          )}
        >
          {step.label}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">
          {step.helper}
        </div>

        {hasSubs && (
          <ul className="mt-2 space-y-1">
            {subTasks!.map((t, ti) => (
              <SubTaskRow key={ti} task={t} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function SubTaskRow({ task }: { task: MissionSubTask }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px] leading-snug">
      <span className="w-4 inline-flex justify-center">
        {task.status === "complete" ? (
          <Check className="w-3.5 h-3.5 text-[var(--color-success)]" strokeWidth={2.5} />
        ) : task.status === "running" ? (
          <Loader2 className="w-3.5 h-3.5 text-[var(--color-ink)] animate-spin" />
        ) : task.status === "failed" ? (
          <span
            aria-label="failed"
            className="w-2 h-2 rounded-full bg-[var(--color-warning)]"
          />
        ) : (
          <span
            aria-hidden
            className="w-2 h-2 rounded-full bg-[var(--color-border-strong)]"
          />
        )}
      </span>
      <span
        className={cn(
          task.status === "complete" && "text-[var(--color-text)]",
          task.status === "running" && "text-[var(--color-text)] font-medium",
          task.status === "failed" && "text-[var(--color-warning)]",
          task.status === "pending" && "text-[var(--color-text-subtle)]",
        )}
      >
        {task.label}
      </span>
    </li>
  );
}
