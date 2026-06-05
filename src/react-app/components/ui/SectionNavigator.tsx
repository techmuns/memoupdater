import { cn } from "../../lib/cn";

interface SectionNavigatorProps {
  sections: { id: string; title: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function SectionNavigator({
  sections,
  activeId,
  onSelect,
}: SectionNavigatorProps) {
  return (
    <nav className="sticky top-[68px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)] mb-3 px-2">
        Sections
      </div>
      <ol className="space-y-0.5">
        {sections.map((s, i) => {
          const active = activeId === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group w-full flex items-baseline gap-3 px-2 py-1.5 rounded-[var(--radius-sm)] text-left transition-colors",
                  active
                    ? "bg-[var(--color-ink-soft)] text-[var(--color-ink)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                <span
                  className={cn(
                    "tnum text-[10px] font-mono w-5 shrink-0",
                    active
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-text-subtle)]",
                  )}
                >
                  0{i + 1}
                </span>
                <span
                  className={cn(
                    "text-[12px] leading-snug",
                    active && "font-semibold",
                  )}
                >
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
