import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]/60",
        className,
      )}
    >
      {icon && (
        <div className="text-[var(--color-text-subtle)] mb-3">{icon}</div>
      )}
      <h3 className="text-[13px] font-semibold text-[var(--color-text)]">
        {title}
      </h3>
      {description && (
        <p className="text-[12px] text-[var(--color-text-muted)] mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
