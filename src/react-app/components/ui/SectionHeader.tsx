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
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)] mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-semibold text-[var(--color-text)] tracking-tight leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
