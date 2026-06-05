import { FileText } from "lucide-react";
import type { MemoSection } from "@shared/types";

interface SourcePanelProps {
  sections: MemoSection[];
  activeId: string | null;
}

export function SourcePanel({ sections, activeId }: SourcePanelProps) {
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <aside className="sticky top-[68px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
          Source audit
        </div>
        <div className="text-[12px] font-semibold text-[var(--color-text)] mt-0.5 truncate">
          {active?.title ?? "Select a section"}
        </div>
      </div>
      <div className="px-4 py-3">
        {active && active.sources.length > 0 ? (
          <ul className="space-y-2">
            {active.sources.map((src, i) => (
              <li
                key={`${src.documentId}-${i}`}
                className="flex items-start gap-2 text-[12px] leading-snug"
              >
                <FileText className="w-3.5 h-3.5 text-[var(--color-text-subtle)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-[var(--color-text)] truncate">
                    {src.documentId}
                  </div>
                  {src.page && (
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      page {src.page}
                    </div>
                  )}
                  {src.quote && (
                    <div className="text-[11px] text-[var(--color-text-muted)] italic mt-0.5 line-clamp-2">
                      "{src.quote}"
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[12px] text-[var(--color-text-subtle)] italic leading-relaxed">
            No sources tagged for this section. In Phase 2, every claim will
            cite back to its source document.
          </div>
        )}
      </div>
    </aside>
  );
}
