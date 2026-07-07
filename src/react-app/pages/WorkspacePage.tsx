import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  FileSearch,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import type { SectionRunState } from "@shared/types";
import { Button } from "../components/ui/Button";
import { UploadSlot } from "../components/ui/UploadSlot";
import { ExtractionNotice } from "../components/ui/ExtractionNotice";
import { CompanySearch } from "../components/CompanySearch";
import { MemoReview } from "../components/MemoReview";
import { ReportQnA } from "../components/ReportQnA";
import { FullResearchReportCard } from "../components/FullResearchReportCard";
import { ResearchEngine, type EnginePhase } from "../components/ResearchEngine";
import { useMemoProject } from "../state/MemoProjectContext";
import { saveMemo } from "../lib/savedMemos";

// Three acts: Drop → Watch the engine work → Read & Ask. One click runs the
// whole engine (research → draft); the animated engine carries "what's
// happening" so the screens stay clean.
export function WorkspacePage() {
  const {
    state,
    extractInitialMemo,
    generateFullResearchReport,
    generateMemo,
    retryFailedSection,
    retryFullMemo,
    startOver,
    setUserResearchPriorities,
  } = useMemoProject();

  const status = state.llmProviderStatus;
  const canCall =
    status?.llmReady === true &&
    !(status?.gateEnabled === true && !state.gateTokenSet);
  const researchAvailable = status?.researchAvailable === true;

  const dnaReady = state.dna !== null;
  const analysisReady =
    state.understanding.kind === "success" || state.skipUnderstanding;
  const analysisWorking =
    dnaReady &&
    !analysisReady &&
    (state.understanding.kind === "loading" ||
      state.understanding.kind === "idle");

  const researchLoading = state.researchState.kind === "loading";
  const researchSuccess = state.researchState.kind === "success";
  const researchError =
    state.researchState.kind === "error" ? state.researchState : null;
  const memoLoading = state.llm.kind === "loading";
  const memoError = state.llm.kind === "error" ? state.llm : null;
  const memoSuccess = state.llm.kind === "success" ? state.llm : null;

  const companyName =
    state.selectedCompany?.companyName ??
    state.detection?.detectedCompany ??
    state.initialFile?.filename.replace(/\.[^.]+$/, "") ??
    "the company";
  const engineCore = state.selectedCompany?.ticker ?? companyName;
  const researchWindowLabel = state.research
    ? `Research ${state.research.researchWindow.startIsoMonth} → ${state.research.researchWindow.endIsoMonth}`
    : undefined;

  // ---- the one-click engine: run research, then auto-draft the memo --------
  const [armed, setArmed] = useState(false);
  const chainFired = useRef(false);
  const fileKey = state.initialFile?.id ?? null;
  const [prevFileKey, setPrevFileKey] = useState(fileKey);
  if (fileKey !== prevFileKey) {
    setPrevFileKey(fileKey);
    // A new memo disarms the chain; chainFired is re-armed in runEngine. (Not
    // touching the ref here — refs must not be written during render.)
    setArmed(false);
  }

  const runEngine = (): void => {
    chainFired.current = false;
    if (researchSuccess) {
      void generateMemo(true); // research already done — go straight to drafting
      return;
    }
    setArmed(true);
    void generateFullResearchReport();
  };

  // When research succeeds under an armed run, auto-start the memo draft once.
  useEffect(() => {
    if (
      armed &&
      state.researchState.kind === "success" &&
      state.llm.kind === "idle" &&
      !chainFired.current
    ) {
      chainFired.current = true;
      void generateMemo(true);
    }
  }, [armed, state.researchState.kind, state.llm.kind, generateMemo]);

  // Auto-save the finished memo (+ its report) to the library.
  const generatedMemo = memoSuccess?.memo ?? null;
  useEffect(() => {
    if (!generatedMemo || generatedMemo.isDemo) return;
    saveMemo({
      memo: generatedMemo,
      company: state.selectedCompany
        ? {
            ticker: state.selectedCompany.ticker,
            companyName: state.selectedCompany.companyName,
          }
        : null,
      researchWindowLabel,
      generationType: "openai",
      report:
        state.fullReport.kind === "success" ? state.fullReport.report : undefined,
    });
  }, [generatedMemo, state.selectedCompany, researchWindowLabel, state.fullReport]);

  const act: "intake" | "engine" | "read" = memoSuccess
    ? "read"
    : researchLoading || memoLoading
      ? "engine"
      : // hold the engine through the research→draft handoff so it never
        // flickers back to intake for one render
        armed && researchSuccess && !memoError && state.llm.kind === "idle"
        ? "engine"
        : "intake";

  const enginePhase: EnginePhase = researchLoading ? "researching" : "drafting";
  const draftDone = state.progress.sections.filter(
    (s) => !s.skipped && s.status === "success",
  ).length;
  const draftTotal = state.progress.sections.filter((s) => !s.skipped).length;

  const canRun =
    canCall &&
    researchAvailable &&
    dnaReady &&
    analysisReady &&
    !researchLoading &&
    !memoLoading;

  return (
    <div className="space-y-6">
      {state.staleClient && <StaleClientBanner />}

      {/* ================= ACT 1 · INTAKE ================= */}
      {act === "intake" && (
        <div className="max-w-[680px] mx-auto space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink)]">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink)]"
                style={{ boxShadow: "0 0 8px var(--color-ink)" }}
              />
              Research engine
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-[var(--color-text)] mt-2 leading-tight">
              Drop the memo. The engine does the rest.
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-2 leading-relaxed max-w-[520px] mx-auto">
              Pick the company, upload the original memo, and one click runs a
              full web-grounded research sweep — then drafts the follow-up.
            </p>
          </div>

          <CompanySearch />

          <UploadSlot
            title="Upload the original investment memo"
            description=".txt, .md, or .pdf"
            acceptedTypes=".txt,.md,.pdf"
            variant="primary"
            icon={UploadCloud}
            currentFile={state.initialFile}
            onFileSelected={(file) => void extractInitialMemo(file)}
            disabled={state.selectedCompany === null}
            disabledHint="Pick the company above first."
          />
          <ExtractionNotice
            status={state.extractionStatus}
            result={state.extraction}
          />

          {dnaReady && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] mb-1.5">
                Anything specific to dig into?{" "}
                <span className="font-normal normal-case tracking-normal text-[var(--color-text-subtle)]">
                  — optional
                </span>
              </label>
              <textarea
                value={state.userResearchPriorities}
                onChange={(e) => setUserResearchPriorities(e.target.value)}
                placeholder="e.g. Are large mutual funds trimming or adding? Any auditor changes?"
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] focus:border-[var(--color-ink)] focus:outline-none bg-[var(--color-surface)] px-3 py-2.5 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-none leading-relaxed"
              />
            </div>
          )}

          {/* research / memo errors surface here with a retry */}
          {researchError && (
            <InlineError
              title="Research didn't complete"
              detail={`${researchError.code} · ${researchError.message}`}
            />
          )}
          {memoError && state.progress.failedSectionId && (
            <SectionFailureBanner
              sectionId={state.progress.failedSectionId}
              sections={state.progress.sections}
              detail={memoError.error}
              onRetryFailed={() => void retryFailedSection()}
              onRetryFull={() => void retryFullMemo()}
              disabled={memoLoading}
            />
          )}

          {!canCall || !researchAvailable ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Research needs the OpenAI provider and a configured LLM — see
              Settings.
            </p>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                size="lg"
                onClick={runEngine}
                disabled={!canRun}
                leadingIcon={
                  analysisWorking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileSearch className="w-4 h-4" />
                  )
                }
                trailingIcon={
                  !analysisWorking ? <ArrowRight className="w-4 h-4" /> : undefined
                }
              >
                {analysisWorking
                  ? "Reading your memo…"
                  : researchSuccess
                    ? "Draft the memo"
                    : "Run the engine"}
              </Button>
              {canRun && (
                <button
                  type="button"
                  onClick={() => void generateMemo(false)}
                  className="self-start text-[11.5px] text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] hover:underline"
                >
                  or draft without research
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= ACT 2 · THE ENGINE ================= */}
      {act === "engine" && (
        <div className="max-w-[860px] mx-auto">
          <ResearchEngine
            company={engineCore}
            sections={state.fullReportProgress}
            phase={enginePhase}
          />
          {enginePhase === "drafting" && draftTotal > 0 && (
            <p className="text-center text-[12px] text-[var(--color-text-muted)] mt-3 tnum">
              Writing section {Math.min(draftDone + 1, draftTotal)} of {draftTotal}
            </p>
          )}
        </div>
      )}

      {/* ================= ACT 3 · READ & ASK ================= */}
      {act === "read" && memoSuccess && (
        <div className="max-w-[760px] mx-auto space-y-5">
          <MemoReview
            memo={memoSuccess.memo}
            generationType="openai"
            researchWindowLabel={researchWindowLabel}
          />

          {state.fullReport.kind === "success" && (
            <ReportQnA
              report={state.fullReport.report}
              memoContext={state.extraction?.text?.trim() || undefined}
            />
          )}

          {state.fullReport.kind === "success" && (
            <details className="group rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer list-none select-none">
                <FileSearch className="w-4 h-4 text-[var(--color-ink)]" />
                <span className="text-[13px] font-semibold text-[var(--color-text)]">
                  View the full research report
                </span>
                <ChevronDown className="w-4 h-4 ml-auto text-[var(--color-text-subtle)] transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-3 pb-3">
                <FullResearchReportCard report={state.fullReport.report} />
              </div>
            </details>
          )}

          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={startOver}
              leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Run another memo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)]">
            {title}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono leading-snug">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

// Persistent reload prompt when the browser bundle is stale.
function StaleClientBanner() {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--color-warning)_30%,white)] bg-[var(--color-warning-soft)] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[var(--color-warning)]">
            A newer version of the dashboard is available
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            This tab is running an older build than the server. Reload to pick up
            the latest version — it prevents generation errors caused by the
            mismatch.
          </p>
        </div>
      </div>
      <Button
        onClick={() => window.location.reload()}
        leadingIcon={<RefreshCw className="w-4 h-4" />}
        className="shrink-0"
      >
        Reload now
      </Button>
    </div>
  );
}

// Memo-draft failure: retry the failed section (resumes) or the full memo.
function SectionFailureBanner({
  sectionId,
  sections,
  detail,
  onRetryFailed,
  onRetryFull,
  disabled,
}: {
  sectionId: string;
  sections: SectionRunState[];
  detail: string;
  onRetryFailed: () => void;
  onRetryFull: () => void;
  disabled: boolean;
}) {
  const idx = sections.findIndex((s) => s.id === sectionId);
  const sectionTitle = idx >= 0 ? sections[idx].title : "a section";
  return (
    <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)] leading-snug">
            The memo stalled while drafting {sectionTitle}.
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug font-mono">
            {detail}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetryFailed} disabled={disabled}>
          Retry
        </Button>
        <Button size="sm" variant="outline" onClick={onRetryFull} disabled={disabled}>
          Restart draft
        </Button>
      </div>
    </div>
  );
}
