import { AlertCircle, Check, Circle, FileSearch, Loader2 } from "lucide-react";
import type { ResearchReportSectionRunState } from "@shared/types";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { FullResearchReportCard } from "./FullResearchReportCard";
import { useMemoProject } from "../state/MemoProjectContext";

// Stage 1 UI: trigger + progress + viewer for the comprehensive internal
// research report. Self-contained (reads the project context directly) so the
// workspace just drops it in. Additive for now — generating the report is an
// explicit action and does not change the existing memo pipeline.
export function FullResearchReportSection() {
  const { state, generateFullResearchReport } = useMemoProject();

  const status = state.llmProviderStatus;
  const llmReady = status?.llmReady === true;
  const researchAvailable = status?.researchAvailable === true;
  const gateBlocking = status?.gateEnabled === true && !state.gateTokenSet;
  const canRun = llmReady && !gateBlocking && researchAvailable;

  const report = state.fullReport;
  const loading = report.kind === "loading";
  const success = report.kind === "success" ? report.report : null;
  const error = report.kind === "error" ? report : null;
  const progress = state.fullReportProgress;
  const doneCount = progress.filter((p) => p.status === "success").length;
  const failedCount = progress.filter((p) => p.status === "failed").length;

  return (
    <>
      <Panel
        eyebrow="Step 3"
        title="Research latest developments"
        actions={
          success ? (
            <Badge tone={failedCount > 0 ? "warning" : "success"} dot>
              {failedCount > 0
                ? `${doneCount}/${progress.length} sections`
                : "Report ready"}
            </Badge>
          ) : loading ? (
            <Badge tone="accent" dot>
              {doneCount}/{progress.length}
            </Badge>
          ) : null
        }
      >
        <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
          Runs a full, company-wide research report (stock &amp; valuation
          evolution, shareholding, industry, corporate events, management &amp;
          governance, concall, memo-vs-actual financials, and an updated view).
          We keep the long report internally — the follow-up memo is condensed
          from it, and you can ask follow-up questions against it later without
          re-running research.
        </p>

        {!canRun ? (
          <p className="mt-3 text-[11.5px] text-[var(--color-text-muted)]">
            Requires the OpenAI provider and a configured LLM (see Settings).
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <Button
              size="lg"
              className="self-start"
              onClick={() => void generateFullResearchReport()}
              disabled={loading}
              leadingIcon={
                loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSearch className="w-4 h-4" />
                )
              }
            >
              {loading
                ? "Researching…"
                : success
                  ? "Re-run research"
                  : "Run comprehensive research"}
            </Button>

            {(loading || failedCount > 0) &&
              progress.some((p) => p.status !== "pending") && (
                <ReportProgressList
                  progress={progress}
                  doneCount={doneCount}
                  failedCount={failedCount}
                />
              )}

            {error && (
              <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[var(--color-warning)]">
                      Research report failed
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono leading-snug">
                      {error.code} · {error.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {success && <FullResearchReportCard report={success} />}
    </>
  );
}

function ReportProgressList({
  progress,
  doneCount,
  failedCount,
}: {
  progress: ResearchReportSectionRunState[];
  doneCount: number;
  failedCount: number;
}) {
  const running = progress.find((p) => p.status === "running");
  const headline = running
    ? `Researching — ${running.title}`
    : failedCount > 0
      ? `${doneCount} of ${progress.length} sections · ${failedCount} failed`
      : `${doneCount} of ${progress.length} sections complete`;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-2">
        {headline}
      </div>
      <ol className="space-y-1.5">
        {progress.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-[12px]">
            <span className="w-4 inline-flex justify-center">
              {p.status === "success" ? (
                <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
              ) : p.status === "running" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-ink)]" />
              ) : p.status === "failed" ? (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
              ) : (
                <Circle className="w-3 h-3 text-[var(--color-text-subtle)]" />
              )}
            </span>
            <span
              className={
                p.status === "pending"
                  ? "text-[var(--color-text-subtle)]"
                  : "text-[var(--color-text)]"
              }
            >
              {p.title}
            </span>
            {p.status === "running" && p.attempt === 2 && (
              <span className="text-[10.5px] text-[var(--color-text-subtle)]">
                · retrying (compact)
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
