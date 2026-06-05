import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent)] mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
