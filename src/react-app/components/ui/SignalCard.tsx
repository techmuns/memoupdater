import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SignalCardProps {
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  metric?: string;
  metricSub?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function SignalCard({
  icon: Icon,
  eyebrow,
  title,
  metric,
  metricSub,
  children,
  footer,
  className,
}: SignalCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden",
        className,
      )}
    >
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
            {eyebrow}
          </div>
          <h3 className="text-[14px] font-semibold text-[var(--color-text)] mt-0.5 tracking-tight">
            {title}
          </h3>
        </div>
        {Icon && (
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-ink-soft)] text-[var(--color-ink)] grid place-items-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {metric && (
        <div className="px-5 pb-3">
          <div className="tnum text-[22px] font-semibold text-[var(--color-text)] tracking-tight leading-none">
            {metric}
          </div>
          {metricSub && (
            <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {metricSub}
            </div>
          )}
        </div>
      )}

      {children && (
        <div className="flex-1 px-5 pb-4 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
          {children}
        </div>
      )}

      {footer && (
        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[12px]">
          {footer}
        </div>
      )}
    </article>
  );
}
