import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

export type WorkflowState = "complete" | "active" | "upcoming";

export interface WorkflowStep {
  id: string;
  index: number;
  icon: LucideIcon;
  title: string;
  input: string;
  output: string;
  state: WorkflowState;
}

export function WorkflowTimeline({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-0 relative">
      {steps.map((step, i) => (
        <div key={step.id} className="relative">
          {/* Connector line on md+ */}
          {i < steps.length - 1 && (
            <div
              aria-hidden
              className={cn(
                "hidden md:block absolute top-7 left-1/2 right-0 h-[2px] -translate-y-1/2",
                step.state === "complete"
                  ? "bg-[var(--color-ink)]"
                  : "bg-[var(--color-border)]",
              )}
              style={{ width: "calc(100% - 3.5rem)" }}
            />
          )}
          <StepNode step={step} />
        </div>
      ))}
    </div>
  );
}

function StepNode({ step }: { step: WorkflowStep }) {
  const Icon = step.icon;
  const isComplete = step.state === "complete";
  const isActive = step.state === "active";

  return (
    <div className="flex flex-col items-start md:items-center text-left md:text-center gap-3 px-3 py-2">
      <div
        className={cn(
          "relative w-14 h-14 rounded-full border-2 grid place-items-center transition-colors shrink-0",
          isComplete &&
            "bg-[var(--color-ink)] border-[var(--color-ink)] text-white shadow-[var(--shadow-sm)]",
          isActive &&
            "bg-[var(--color-surface)] border-[var(--color-ink)] text-[var(--color-ink)] shadow-[var(--shadow-md)]",
          !isComplete &&
            !isActive &&
            "bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-text-subtle)]",
        )}
      >
        {isComplete ? (
          <Check className="w-5 h-5" strokeWidth={2.5} />
        ) : (
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        )}
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center border",
            isComplete || isActive
              ? "bg-[var(--color-surface)] border-[var(--color-ink)] text-[var(--color-ink)]"
              : "bg-[var(--color-surface)] border-[var(--color-border-strong)] text-[var(--color-text-subtle)]",
          )}
        >
          {step.index}
        </span>
      </div>

      <div className="space-y-2 md:max-w-[180px]">
        <div className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
          {step.title}
        </div>
        <div className="space-y-0.5">
          <KeyValue k="In" v={step.input} />
          <KeyValue k="Out" v={step.output} />
        </div>
      </div>
    </div>
  );
}

function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px] leading-snug">
      <span className="font-mono uppercase tracking-wider text-[9px] text-[var(--color-text-subtle)] shrink-0">
        {k}
      </span>
      <span className="text-[var(--color-text-muted)]">{v}</span>
    </div>
  );
}
