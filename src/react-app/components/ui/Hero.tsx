import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface HeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  chips?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function Hero({
  eyebrow,
  title,
  description,
  chips,
  primaryAction,
  secondaryAction,
  className,
}: HeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 grid-bg opacity-50 pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full opacity-[0.04] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, var(--color-ink) 0%, transparent 65%)",
        }}
      />
      <div className="relative px-7 py-8 flex flex-col gap-5 sm:gap-6">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-ink)]" />
            {eyebrow}
          </div>
        )}

        <div className="max-w-3xl">
          <h1 className="text-[30px] sm:text-[34px] leading-[1.1] tracking-tight font-semibold text-[var(--color-text)]">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] sm:text-[15px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {chips && <div className="flex flex-wrap items-center gap-1.5">{chips}</div>}

        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-2 pt-1">
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
    </section>
  );
}
