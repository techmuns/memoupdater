import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import type { FullResearchReport, ResearchReportSection } from "@shared/types";
import { Panel } from "./ui/Panel";
import { Badge } from "./ui/Badge";
import { Markdown } from "./ui/Markdown";

// Viewer for the comprehensive internal research report (Stage 1). Renders each
// section as a collapsible block with its prose, sources, and any not-disclosed
// datapoints. This is the long report we keep internally — the <3-page memo is
// condensed from it (Stage 2) and Q&A answers from it (Stage 3).
export function FullResearchReportCard({
  report,
}: {
  report: FullResearchReport;
}) {
  return (
    <Panel
      eyebrow="Internal research report"
      title={`Full research — ${report.company}`}
      actions={
        <Badge tone="accent" dot>
          {report.sections.length} section
          {report.sections.length === 1 ? "" : "s"}
        </Badge>
      }
    >
      <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed -mt-1 mb-3">
        The complete company-wide research the dashboard generated. It's kept
        internally to condense into the follow-up memo and to answer follow-up
        questions — no need to re-run research.
      </p>
      <div className="flex flex-col gap-2">
        {report.sections.map((section, i) => (
          <ReportSectionBlock key={section.id} section={section} defaultOpen={i === 0} />
        ))}
      </div>
    </Panel>
  );
}

function ReportSectionBlock({
  section,
  defaultOpen,
}: {
  section: ResearchReportSection;
  defaultOpen: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] open:bg-[var(--color-surface)]"
    >
      <summary className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer list-none select-none">
        <FileText className="w-4 h-4 text-[var(--color-ink)] shrink-0" />
        <span className="text-[13px] font-semibold text-[var(--color-text)] flex-1 min-w-0">
          {section.title}
        </span>
        {section.sources.length > 0 && (
          <span className="text-[10.5px] text-[var(--color-text-subtle)] tnum">
            {section.sources.length} source
            {section.sources.length === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-[var(--color-text-subtle)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3.5 pb-3.5 pt-0 border-t border-[var(--color-border)]">
        <Markdown text={section.markdown} />

        {section.notDisclosed && section.notDisclosed.length > 0 && (
          <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] mb-1">
              Not disclosed
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              {section.notDisclosed.map((n, i) => (
                <li key={i} className="text-[11.5px] text-[var(--color-text-muted)]">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {section.sources.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] mb-1.5">
              Sources
            </div>
            <ul className="space-y-1">
              {section.sources.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-[var(--color-text-subtle)]" />
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11.5px] text-[var(--color-ink)] hover:underline break-all leading-snug"
                  >
                    {s.title || s.url}
                    {s.date ? (
                      <span className="text-[var(--color-text-subtle)]"> · {s.date}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
