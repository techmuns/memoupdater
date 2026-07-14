import { useMemo } from "react";
import { Download, FileSearch, FileText, Loader2, Printer } from "lucide-react";
import type { FollowUpMemo, MemoConfidence, MemoSection } from "@shared/types";
import { humanSourceLabel } from "@shared/sanitizeMemo";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { SIGNAL_BADGE_TONE, SIGNAL_LABEL } from "../lib/signalDisplay";
import { buildMemoPdf, downloadMemoPdf } from "../lib/memoPdf";
import { useMemoProject } from "../state/MemoProjectContext";

const CONFIDENCE_TONE: Record<MemoConfidence, "success" | "warning" | "neutral"> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

const CONFIDENCE_LABEL: Record<MemoConfidence, string> = {
  high: "Confidence: High",
  medium: "Confidence: Medium",
  low: "Confidence: Low",
};

interface MemoReviewProps {
  memo: FollowUpMemo;
  generationType: "openai" | "demo";
  researchWindowLabel?: string;
  // When provided, a "Download full research" action appears beside the memo
  // downloads — the complete internal research report as a PDF.
  onDownloadResearch?: () => void;
  downloadingResearch?: boolean;
  // Render the full follow-up memo body inline (the dashboard read view). When
  // false, only the header + a short "downloads" strip show.
  showBody?: boolean;
}

export function MemoReview({
  memo,
  generationType,
  researchWindowLabel,
  onDownloadResearch,
  downloadingResearch = false,
  showBody = false,
}: MemoReviewProps) {
  const filenameStem = useMemo(() => buildFilenameStem(memo), [memo]);

  // Print uses the SAME jsPDF output as Download PDF, so the printed result is
  // byte-for-byte the clean ≤3-page memo. (The old path rendered the on-screen
  // HTML at web font sizes, which ballooned to ~20 pages and didn't match the
  // download.) The clean PDF is loaded into a hidden iframe and printed via
  // its own print dialog; if that isn't available, it opens in a new tab so
  // the user can print from the browser's PDF viewer.
  const printMemo = async (): Promise<void> => {
    const blob = await buildMemoPdf(memo, { researchWindowLabel });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
    });
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, "_blank", "noopener");
      }
    };
    iframe.src = url;
    document.body.appendChild(iframe);
    // Revoke + remove after the dialog has had time to read the blob.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 60_000);
  };

  const downloadPdf = async (): Promise<void> => {
    await downloadMemoPdf(memo, filenameStem, { researchWindowLabel });
  };

  const generatedDate = new Date(memo.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const typeBadge =
    generationType === "openai" ? (
      <Badge tone="success" dot>
        OpenAI research memo
      </Badge>
    ) : (
      <Badge tone="warning" dot>
        Demo memo
      </Badge>
    );

  return (
    <div className="space-y-5" data-print="memo">
      <header className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {typeBadge}
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Generated {generatedDate}
              {researchWindowLabel ? ` · ${researchWindowLabel}` : ""}
            </span>
          </div>
          <h2
            className="text-[22px] font-semibold tracking-tight text-[var(--color-text)] mt-1"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {memo.title}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap memo-actions">
          <Button
            variant="primary"
            onClick={downloadPdf}
            leadingIcon={<Download className="w-4 h-4" />}
          >
            Download memo PDF
          </Button>
          {onDownloadResearch && (
            <Button
              variant="secondary"
              onClick={onDownloadResearch}
              disabled={downloadingResearch}
              leadingIcon={
                downloadingResearch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSearch className="w-4 h-4" />
                )
              }
            >
              {downloadingResearch ? "Preparing…" : "Download full research"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={printMemo}
            leadingIcon={<Printer className="w-4 h-4" />}
          >
            Print
          </Button>
        </div>
      </header>

      {showBody ? (
        <MemoBody memo={memo} />
      ) : (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-5 py-4">
          <div className="text-[12.5px] text-[var(--color-text-muted)] leading-snug">
            The full {memo.sections.length}-section follow-up memo is ready —
            designed to fit under three pages. Use{" "}
            <span className="font-semibold text-[var(--color-text)]">
              Download memo PDF
            </span>{" "}
            (or Print) above to read it, or{" "}
            <span className="font-semibold text-[var(--color-text)]">
              Download full research
            </span>{" "}
            for the complete underlying report.
          </div>
        </section>
      )}

      <PrioritiesAnswerCard />
    </div>
  );
}

// The full follow-up memo, rendered for on-dashboard reading. Mirrors the PDF's
// content: numbered sections with a signal + confidence tag, the summary lead,
// the memo-vs-actual bridge, body prose, key-point bullets, and sources.
function MemoBody({ memo }: { memo: FollowUpMemo }) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-6 sm:px-8 py-6 space-y-6">
      {memo.sections.map((section, i) => (
        <MemoSectionBlock key={section.id} section={section} index={i + 1} />
      ))}
    </article>
  );
}

function MemoSectionBlock({
  section,
  index,
}: {
  section: MemoSection;
  index: number;
}) {
  return (
    <section className="scroll-mt-4">
      <div className="flex items-baseline gap-3 border-b border-[var(--color-border)] pb-2 mb-3">
        <span className="tnum text-[12px] font-semibold text-[var(--color-text-subtle)] leading-none">
          {String(index).padStart(2, "0")}
        </span>
        <h3
          className="text-[16px] font-semibold tracking-tight text-[var(--color-text)] flex-1 min-w-0"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {section.title}
        </h3>
        {section.signal && (
          <Badge tone={SIGNAL_BADGE_TONE[section.signal]} dot>
            {SIGNAL_LABEL[section.signal]}
          </Badge>
        )}
      </div>

      {section.summary && section.summary !== section.body && (
        <p
          className="text-[14px] text-[var(--color-text)] leading-[1.65] font-medium mb-3"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {section.summary}
        </p>
      )}

      {section.bridge && section.bridge.length > 0 && (
        <BridgeTable rows={section.bridge} />
      )}

      {section.body && (
        <p
          className="text-[14px] text-[var(--color-text)] leading-[1.65] whitespace-pre-line"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {section.body}
        </p>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 list-disc pl-5 marker:text-[var(--color-text-subtle)]">
          {section.bullets.map((b, bi) => (
            <li
              key={bi}
              className="text-[13.5px] text-[var(--color-text)] leading-[1.6]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {b}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BridgeTable({
  rows,
}: {
  rows: NonNullable<MemoSection["bridge"]>;
}) {
  return (
    <div className="my-3 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-[13px] border-collapse">
        <thead className="bg-[var(--color-surface-muted)]">
          <tr className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            <th className="text-left font-semibold px-3 py-2">Metric</th>
            <th className="text-left font-semibold px-3 py-2">Original anchor</th>
            <th className="text-left font-semibold px-3 py-2">Latest</th>
            <th className="text-left font-semibold px-3 py-2">Read-through</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i === 0 ? "" : "border-t border-[var(--color-border)]"}
            >
              <td
                className="px-3 py-2 font-medium text-[var(--color-text)] align-top"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {row.metric}
              </td>
              <td
                className="px-3 py-2 text-[var(--color-text)] align-top"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {row.original || "—"}
              </td>
              <td
                className="px-3 py-2 text-[var(--color-text)] align-top"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {row.latest || "—"}
              </td>
              <td
                className="px-3 py-2 text-[var(--color-text)] italic align-top"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {row.readThrough || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Dashboard-only card: directly answers the user's "Your priorities"
// questions in a separate place from the memo. Generated by the worker
// route /api/generate/priorities-answer right after the memo lands; the
// PDF is intentionally unaffected.
function PrioritiesAnswerCard() {
  const { state } = useMemoProject();
  const s = state.prioritiesAnswer;
  // No priorities typed → nothing to render.
  if (state.userResearchPriorities.trim().length === 0 && s.kind === "idle") {
    return null;
  }
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] px-6 sm:px-8 py-6">
      <header className="flex items-baseline gap-2 mb-4">
        <h3
          className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Your priorities — answered
        </h3>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Dashboard-only · not included in the downloadable memo
        </span>
      </header>

      {s.kind === "loading" && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
            >
              <div className="h-3 w-1/2 rounded shimmer mb-2" />
              <div className="h-3 w-full rounded shimmer mb-1" />
              <div className="h-3 w-2/3 rounded shimmer" />
            </div>
          ))}
          <p className="text-[11.5px] text-[var(--color-text-muted)]">
            Answering your priority questions from the research findings…
          </p>
        </div>
      )}

      {s.kind === "error" && (
        <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)] leading-snug">
            Priorities answer failed.
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono leading-snug">
            {s.code} · {s.message}
          </p>
        </div>
      )}

      {s.kind === "success" && s.answer.items.length === 0 && (
        <p className="text-[12.5px] italic text-[var(--color-text-muted)]">
          The model didn't produce any answers — re-run if you want to retry.
        </p>
      )}

      {s.kind === "success" && s.answer.items.length > 0 && (
        <ol className="space-y-4">
          {s.answer.items.map((it, i) => (
            <li
              key={i}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
            >
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className="tnum text-[13px] font-semibold text-[var(--color-text-muted)] leading-none"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Q{i + 1}
                </span>
                <p
                  className="text-[13.5px] font-semibold text-[var(--color-text)] leading-snug"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {it.question}
                </p>
                {it.confidence && (
                  <Badge tone={CONFIDENCE_TONE[it.confidence]}>
                    {CONFIDENCE_LABEL[it.confidence]}
                  </Badge>
                )}
              </div>
              <p
                className="text-[13.5px] text-[var(--color-text)] leading-[1.6] mt-1"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {it.answer}
              </p>
              {it.sources && it.sources.length > 0 && (
                <ul className="mt-2 space-y-1 border-l-2 border-[var(--color-border)] pl-3">
                  {it.sources.map((src, si) => (
                    <li
                      key={`${src.documentId}-${si}`}
                      className="text-[11px] text-[var(--color-text-muted)] leading-snug inline-flex items-start gap-1.5"
                    >
                      <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium text-[var(--color-text)]">
                          {humanSourceLabel(src.documentId, si)}
                        </span>
                        {src.page && <> · p.{src.page}</>}
                        {src.quote && <> — "{src.quote}"</>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function buildFilenameStem(memo: FollowUpMemo): string {
  const dateIso = memo.generatedAt.slice(0, 10);
  const slug = memo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug ? `${slug}-${dateIso}` : `follow-up-memo-${dateIso}`;
}
