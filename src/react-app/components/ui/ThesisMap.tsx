import { ArrowUpRight, ArrowDownRight, ArrowRight } from "lucide-react";
import type { ThesisCheckpoint } from "@shared/types";
import { cn } from "../../lib/cn";

const directionIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

const directionStyle = {
  up: "bg-[var(--color-signal-up-soft)] text-[var(--color-signal-up)] border-[color-mix(in_srgb,var(--color-signal-up)_22%,white)]",
  down: "bg-[var(--color-signal-down-soft)] text-[var(--color-signal-down)] border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)]",
  flat: "bg-[var(--color-signal-flat-soft)] text-[var(--color-signal-flat)] border-[color-mix(in_srgb,var(--color-signal-flat)_22%,white)]",
};

interface ThesisMapProps {
  checkpoints: ThesisCheckpoint[];
  columns?: 1 | 2;
  compact?: boolean;
}

export function ThesisMap({
  checkpoints,
  columns = 2,
  compact,
}: ThesisMapProps) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
      )}
    >
      {checkpoints.map((cp) => {
        const Icon = directionIcon[cp.expectedDirection];
        return (
          <div
            key={cp.id}
            className={cn(
              "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-4 flex gap-3",
              compact && "p-3",
            )}
          >
            <div
              className={cn(
                "w-9 h-9 rounded-full border grid place-items-center shrink-0",
                directionStyle[cp.expectedDirection],
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight truncate">
                  {cp.label}
                </h4>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-subtle)] shrink-0">
                  {cp.expectedDirection}
                </span>
              </div>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                {cp.rationale}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
