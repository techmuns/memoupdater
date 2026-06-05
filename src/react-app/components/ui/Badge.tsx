import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Tone =
  | "neutral"
  | "ink"
  | "accent"
  | "warning"
  | "success"
  | "up"
  | "down"
  | "flat";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const tones: Record<Tone, string> = {
  neutral:
    "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
  ink: "bg-[var(--color-ink)] text-[var(--color-ink-foreground)] border-[var(--color-ink)]",
  accent:
    "bg-[var(--color-ink-soft)] text-[var(--color-ink)] border-[color-mix(in_srgb,var(--color-ink)_15%,white)]",
  warning:
    "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_22%,white)]",
  success:
    "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_22%,white)]",
  up: "bg-[var(--color-signal-up-soft)] text-[var(--color-signal-up)] border-[color-mix(in_srgb,var(--color-signal-up)_22%,white)]",
  down: "bg-[var(--color-signal-down-soft)] text-[var(--color-signal-down)] border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)]",
  flat: "bg-[var(--color-signal-flat-soft)] text-[var(--color-signal-flat)] border-[color-mix(in_srgb,var(--color-signal-flat)_22%,white)]",
};

const dotColors: Record<Tone, string> = {
  neutral: "bg-[var(--color-text-subtle)]",
  ink: "bg-white/80",
  accent: "bg-[var(--color-ink)]",
  warning: "bg-[var(--color-warning)]",
  success: "bg-[var(--color-success)]",
  up: "bg-[var(--color-signal-up)]",
  down: "bg-[var(--color-signal-down)]",
  flat: "bg-[var(--color-signal-flat)]",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full border whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[tone])}
        />
      )}
      {children}
    </span>
  );
}
