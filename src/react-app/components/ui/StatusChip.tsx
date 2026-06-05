import type { GenerationStepStatus } from "@shared/types";
import { cn } from "../../lib/cn";

interface StatusChipProps {
  status: GenerationStepStatus;
  className?: string;
}

const labels: Record<GenerationStepStatus, string> = {
  not_started: "Not started",
  ready: "Ready",
  demo_generated: "Demo generated",
};

const styles: Record<GenerationStepStatus, string> = {
  not_started:
    "bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)] border-[var(--color-border)]",
  ready:
    "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_22%,white)]",
  demo_generated:
    "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_22%,white)]",
};

const dot: Record<GenerationStepStatus, string> = {
  not_started: "bg-[var(--color-text-subtle)]",
  ready: "bg-[var(--color-warning)]",
  demo_generated: "bg-[var(--color-success)]",
};

export function StatusChip({ status, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border whitespace-nowrap",
        styles[status],
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dot[status])} />
      {labels[status]}
    </span>
  );
}
