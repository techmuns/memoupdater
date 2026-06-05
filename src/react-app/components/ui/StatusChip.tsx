import { CircleDashed, CircleDot, CheckCircle2 } from "lucide-react";
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
    "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_20%,white)]",
  demo_generated:
    "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_20%,white)]",
};

const icons: Record<GenerationStepStatus, typeof CircleDashed> = {
  not_started: CircleDashed,
  ready: CircleDot,
  demo_generated: CheckCircle2,
};

export function StatusChip({ status, className }: StatusChipProps) {
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap",
        styles[status],
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {labels[status]}
    </span>
  );
}
