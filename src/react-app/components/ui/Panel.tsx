import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
  tone?: "default" | "tinted";
  bodyClassName?: string;
}

export function Panel({
  eyebrow,
  title,
  actions,
  tone = "default",
  bodyClassName,
  className,
  children,
  ...rest
}: PanelProps) {
  const surface =
    tone === "tinted"
      ? "bg-[var(--color-surface-muted)]"
      : "bg-[var(--color-surface)]";

  return (
    <section
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-md)]",
        surface,
        className,
      )}
      {...rest}
    >
      {(eyebrow || title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)] mt-0.5">
                {title}
              </h2>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
          )}
        </header>
      )}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
