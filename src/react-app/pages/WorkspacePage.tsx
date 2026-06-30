import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Circle,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type {
  MemoUnderstandingState,
  ResearchPassId,
  ResearchPassRunState,
  SectionRunState,
} from "@shared/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { UploadSlot } from "../components/ui/UploadSlot";
import { ExtractionNotice } from "../components/ui/ExtractionNotice";
import { CompanySearch } from "../components/CompanySearch";
import { ResearchFindingsCard } from "../components/ResearchFindingsCard";
import { MemoReview } from "../components/MemoReview";
import { WorkflowRail } from "../components/layout/WorkflowRail";
import type { RailProgress } from "../components/layout/WorkflowRail";
import { MemoCompletionBanner } from "../components/MemoCompletionBanner";
import { UserPrioritiesPanel } from "../components/UserPrioritiesPanel";
import { deriveMissionTrackerSteps } from "../lib/missionTrackerState";
import {
  buildMemoUnderstandingDigest,
  selectTasksForPass,
} from "../lib/memoUnderstandingSummary";
import { useMemoProject } from "../state/MemoProjectContext";
import { saveMemo } from "../lib/savedMemos";
import type { MissionStepId } from "../lib/missionTrackerState";

// Phase 6D: anchors that match these bare category names alone are too
// generic to print as "Validating: X". When this matches, the
// per-pass task list falls back to the research question text instead.
const GENERIC_ANCHOR_RE =
  /^(valuation anchor|earnings quality|segment driver|margin driver|financial claim|management claim|catalyst|risk|must verify|source gap|contradiction)$/i;
function isGenericAnchor(anchor: string): boolean {
  return GENERIC_ANCHOR_RE.test(anchor.trim());
}

export function WorkspacePage() {
  const {
    state,
    extractInitialMemo,
    runResearch,
    retryFailedResearchPasses,
    retryAllResearch,
    generateMemo,
    retryFailedSection,
    retryFullMemo,
    startOver,
    setUserResearchPriorities,
    rerunMemoUnderstanding,
  } = useMemoProject();

  const status = state.llmProviderStatus;
  const llmReady = status?.llmReady === true;
  const researchAvailable = status?.researchAvailable === true;
  const gateEnabled = status?.gateEnabled === true;
  const gateBlocking = gateEnabled && !state.gateTokenSet;
  const canCall = llmReady && !gateBlocking;

  const onFile = async (file: File) => {
    await extractInitialMemo(file);
  };

  const dnaReady = state.dna !== null;
  const researchLoading = state.researchState.kind === "loading";
  const researchError =
    state.researchState.kind === "error" ? state.researchState : null;
  const researchSuccess =
    state.researchState.kind === "success" ? state.researchState : null;
  const memoLoading = state.llm.kind === "loading";
  const memoError = state.llm.kind === "error" ? state.llm : null;
  const memoSuccess = state.llm.kind === "success" ? state.llm : null;

  const researchWindowLabel = useMemo(() => {
    if (state.research) {
      return `Research ${state.research.researchWindow.startIsoMonth} → ${state.research.researchWindow.endIsoMonth}`;
    }
    return undefined;
  }, [state.research]);

  // Phase 6C/6D: per-pass memo-anchored task list. Used by the research
  // progress UI to show the SPECIFIC items being validated under each
  // pass, instead of just generic pass titles. We also fold user-supplied
  // priorities (rendered as plain bullets per pass — every pass sees them,
  // matching how the worker prompt block works).
  // Phase 6D: if the memoAnchor is a bare category name (the baseline
  // tier can emit "Valuation anchor" with no specific suffix), prefer
  // the research question text so the visible line is distinct.
  const tasksByPass = useMemo<Record<ResearchPassId, string[]>>(() => {
    const empty: Record<ResearchPassId, string[]> = {
      official_results: [],
      management_call: [],
      investor_presentation: [],
      press_and_results: [],
      valuation_market: [],
      risks_competition: [],
    };
    if (state.understanding.kind !== "success") return empty;
    const digest = buildMemoUnderstandingDigest(state.understanding.understanding);
    const out = empty;
    (Object.keys(out) as ResearchPassId[]).forEach((passId) => {
      const rawTasks = selectTasksForPass(digest, passId);
      const seen = new Set<string>();
      const lines: string[] = [];
      for (const t of rawTasks) {
        const anchor = (t.memoAnchor || "").trim();
        const isGeneric = isGenericAnchor(anchor);
        const candidate = ((isGeneric ? t.question : anchor) || t.question)
          .trim()
          .slice(0, 110);
        if (!candidate) continue;
        const dedupeKey = candidate.toLowerCase().slice(0, 60);
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        lines.push(candidate);
        if (lines.length >= 4) break;
      }
      out[passId] = lines;
    });
    return out;
  }, [state.understanding]);

  const userPriorityLines = useMemo(() => {
    const trimmed = state.userResearchPriorities.trim();
    if (!trimmed) return [] as string[];
    return trimmed
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 6);
  }, [state.userResearchPriorities]);

  const missionSteps = useMemo(
    () =>
      deriveMissionTrackerSteps({
        initialFile: state.initialFile,
        extractionStatus: state.extractionStatus,
        dna: state.dna,
        understanding: state.understanding,
        skipUnderstanding: state.skipUnderstanding,
        research: state.research,
        researchState: state.researchState,
        generatedMemo: state.generatedMemo,
        llm: state.llm,
      }),
    [
      state.initialFile,
      state.extractionStatus,
      state.dna,
      state.understanding,
      state.skipUnderstanding,
      state.research,
      state.researchState,
      state.generatedMemo,
      state.llm,
    ],
  );

  // Compact live counts for the rail's active step ("2 / 6 passes",
  // "4 / 9 sections"). The rail conveys momentum at a glance; the detailed
  // per-pass / per-section list lives in the main pane for the active step,
  // so the two no longer duplicate each other.
  const progressByStep = useMemo<Partial<Record<MissionStepId, RailProgress>>>(
    () => {
      const passes = state.researchProgress.passes;
      const sections = state.progress.sections;
      const out: Partial<Record<MissionStepId, RailProgress>> = {};
      if (passes.some((p) => p.status !== "pending")) {
        out.research = {
          done: passes.filter((p) => p.status === "success").length,
          total: passes.length,
          noun: "passes",
        };
      }
      if (sections.some((s) => s.status !== "pending")) {
        out.generate = {
          done: sections.filter((s) => s.status === "success").length,
          total: sections.length,
          noun: "sections",
        };
      }
      return out;
    },
    [state.researchProgress.passes, state.progress.sections],
  );

  // The two-pane main area renders ONLY the active step. "Active" is the first
  // step the workflow says is in progress; once everything is complete the
  // user lands on Review.
  const activeStepId: MissionStepId = useMemo(() => {
    const active = missionSteps.find((s) => s.status === "active");
    if (active) return active.id;
    if (memoSuccess) return "review";
    return missionSteps[0].id;
  }, [missionSteps, memoSuccess]);

  // The rail lets the user revisit a completed/active step. `viewStep` is that
  // manual override; it auto-clears whenever the live active step advances, so
  // the main pane follows the workflow forward unless the user deliberately
  // looks back.
  const [viewStep, setViewStep] = useState<MissionStepId | null>(null);
  const [prevActiveStep, setPrevActiveStep] = useState(activeStepId);
  if (activeStepId !== prevActiveStep) {
    setPrevActiveStep(activeStepId);
    setViewStep(null);
  }
  const effectiveStep = viewStep ?? activeStepId;

  // Auto-save every generated (non-demo) memo to the per-browser library so the
  // analyst can reopen it later. The effect keys on the memo object, so it runs
  // once per generation; saveMemo upserts by project+company, so re-generating
  // the same memo updates its entry instead of creating duplicates.
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
    });
  }, [generatedMemo, state.selectedCompany, researchWindowLabel]);

  return (
    <div className="space-y-6">
      {/* Phase 6H: stale-bundle banner. Shown when this tab's build id no
          longer matches the deployed worker — a hard refresh clears the
          class of "provider_error · 400" failures that a stale tab
          produces against a newer backend. */}
      {state.staleClient && <StaleClientBanner />}

      {/* Two-pane workbench. Left = persistent workflow rail (the single
          progress source + step navigation). Right = ONLY the active step's
          content, so the next action is always the focus of the pane and can
          never fall below the fold. The rail collapses above the pane on
          narrow screens. */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
        <WorkflowRail
          steps={missionSteps}
          effectiveStepId={effectiveStep}
          onSelectStep={(id) =>
            setViewStep(id === activeStepId ? null : id)
          }
          progressByStep={progressByStep}
          onStartOver={
            state.initialFile || state.dna || state.research || memoSuccess
              ? startOver
              : undefined
          }
        />

        <div className="min-w-0 space-y-6">
          {/* Step 1 — Upload (company picker + memo upload). Stays the pane
              until the local text extraction has produced memo DNA, so any
              extraction error remains visible here instead of being hidden
              behind the analysis step. */}
          {effectiveStep === "upload" && (
            <>
              <CompanySearch />
              <UploadSlot
                title="Upload the original investment memo"
                description="Supports .txt, .md, and .pdf. We extract the text locally to build memo DNA and detect the latest period covered."
                acceptedTypes=".txt,.md,.pdf"
                variant="primary"
                icon={UploadCloud}
                currentFile={state.initialFile}
                onFileSelected={onFile}
                disabled={state.selectedCompany === null}
                disabledHint="Use the company search above to choose the subject company, then the memo upload unlocks."
              />
              <ExtractionNotice
                status={state.extractionStatus}
                result={state.extraction}
              />
            </>
          )}

          {/* Step 2 — Extract insights. The AI analysis runs automatically;
              this pane shows its live status and lets the user fill in
              research priorities while it works. */}
          {effectiveStep === "detect" && (
            <>
              <ExtractionNotice
                status={state.extractionStatus}
                result={state.extraction}
              />
              <AnalysisPane
                dnaReady={dnaReady}
                extractionFailed={
                  state.extractionStatus === "error" ||
                  state.extractionStatus === "unsupported"
                }
                understanding={state.understanding}
                skip={state.skipUnderstanding}
                onRerun={() => void rerunMemoUnderstanding()}
              />
              {dnaReady && (
                <UserPrioritiesPanel
                  value={state.userResearchPriorities}
                  onChange={setUserResearchPriorities}
                  researchHasRun={Boolean(state.research)}
                  disabled={researchLoading || memoLoading}
                />
              )}
            </>
          )}

          {/* Step 3 — Research. Priorities stay editable here (so "Hold — add
              priorities" works) until research has succeeded. */}
          {effectiveStep === "research" && (
            <>
              {dnaReady && !researchSuccess && (
                <UserPrioritiesPanel
                  value={state.userResearchPriorities}
                  onChange={setUserResearchPriorities}
                  researchHasRun={Boolean(state.research)}
                  disabled={researchLoading || memoLoading}
                />
              )}
              <Panel
                eyebrow="Step 3"
                title="Research latest developments"
                actions={
                  state.researchProgress.kind === "complete_with_warnings" ? (
                    <Badge tone="warning" dot>
                      Research complete with warnings
                    </Badge>
                  ) : researchSuccess ? (
                    <Badge tone="success" dot>
                      Research complete
                    </Badge>
                  ) : researchError ? (
                    <Badge tone="warning" dot>
                      Research failed
                    </Badge>
                  ) : null
                }
              >
                {gateBlocking ? (
                  <SetupRequiredPanel
                    title="Internal access token required"
                    message="The app-level gate is enabled. Open Settings → Advanced to enter the internal access token, or ask your operator to disable the gate after configuring Cloudflare Access / WAF / rate limiting."
                  />
                ) : !canCall ? (
                  <SetupRequiredPanel
                    title="LLM not configured"
                    message={
                      status
                        ? "Configure LLM_API_KEY (or OPENAI_API_KEY) and provider settings in the deployed Worker, then refresh."
                        : "Could not read /api/llm/status. Refresh the page or check Settings."
                    }
                  />
                ) : !researchAvailable ? (
                  <SetupRequiredPanel
                    title="Research requires the OpenAI provider"
                    message="Set LLM_PROVIDER=openai and a valid OpenAI key to enable web research."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {state.understanding.kind !== "success" &&
                      !state.skipUnderstanding && (
                        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-[11.5px] text-[var(--color-text-muted)] leading-snug">
                          {state.understanding.kind === "loading"
                            ? "Memo analysis in progress. Research will use the extracted memo understanding."
                            : state.understanding.kind === "error"
                              ? "Memo analysis didn't finish — open the Extract insights step in the workflow to retry, so research stays memo-specific."
                              : "Memo analysis hasn't run yet."}
                        </div>
                      )}
                    <Button
                      size="lg"
                      className="self-start"
                      onClick={() => void runResearch()}
                      disabled={
                        researchLoading ||
                        (state.understanding.kind !== "success" &&
                          !state.skipUnderstanding)
                      }
                      leadingIcon={
                        researchLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )
                      }
                      trailingIcon={
                        !researchLoading ? (
                          <ArrowRight className="w-4 h-4" />
                        ) : undefined
                      }
                    >
                      {researchLoading
                        ? "Researching…"
                        : researchSuccess
                          ? "Re-run research"
                          : "Research latest developments"}
                    </Button>
                  </div>
                )}

                {(researchLoading ||
                  state.researchProgress.kind === "complete_with_warnings" ||
                  researchError) &&
                  state.researchProgress.passes.some(
                    (p) => p.status !== "pending",
                  ) && (
                    <ResearchProgressList
                      passes={state.researchProgress.passes}
                      tasksByPass={tasksByPass}
                      userPriorityLines={userPriorityLines}
                    />
                  )}

                {state.researchProgress.kind === "complete_with_warnings" &&
                  !researchError && (
                    <ResearchWarningsBanner
                      passes={state.researchProgress.passes}
                      onRetryFailed={() => void retryFailedResearchPasses()}
                      disabled={researchLoading}
                    />
                  )}

                {researchError && (
                  <ResearchFailureBanner
                    code={researchError.code}
                    message={researchError.message}
                    hasFailedPasses={
                      state.researchProgress.failedPassIds.length > 0 &&
                      state.researchProgress.failedPassIds.length <
                        state.researchProgress.passes.length
                    }
                    onRetryFailed={() => void retryFailedResearchPasses()}
                    onRetryAll={() => void retryAllResearch()}
                    disabled={researchLoading}
                  />
                )}

                {/* Escape hatch: reachable even when research is unavailable
                    or failed, so the user is never stranded on this step. */}
                {canCall &&
                  !researchSuccess &&
                  !researchLoading && (
                    <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                      <p className="text-[11.5px] text-[var(--color-text-muted)] leading-relaxed mb-2">
                        No external research? Skip straight to the draft. The
                        without-research memo states that no research was
                        performed and flags every forward-looking claim for
                        manual verification.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void generateMemo(false)}
                        disabled={memoLoading}
                      >
                        Generate without research (explicit)
                      </Button>
                    </div>
                  )}
              </Panel>

              {researchSuccess && !memoSuccess && (
                <ResearchFindingsCard research={researchSuccess.research} />
              )}
            </>
          )}

          {/* Step 4 — Generate. Findings sit above the action so the user can
              review what research found before drafting. */}
          {effectiveStep === "generate" && (
            <>
              {researchSuccess && (
                <ResearchFindingsCard research={researchSuccess.research} />
              )}
              <Panel eyebrow="Step 4" title="Generate follow-up memo">
                {canCall ? (
                  <div className="flex flex-col gap-3">
                    <Button
                      size="lg"
                      className="self-start"
                      onClick={() => void generateMemo(true)}
                      disabled={memoLoading || !researchSuccess}
                      leadingIcon={
                        memoLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )
                      }
                      trailingIcon={
                        !memoLoading ? (
                          <ArrowRight className="w-4 h-4" />
                        ) : undefined
                      }
                    >
                      {memoLoading
                        ? "Generating…"
                        : memoSuccess
                          ? "Re-generate memo"
                          : "Generate follow-up memo"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    Configure the LLM and (if needed) unlock the gate in
                    Settings to enable generation.
                  </p>
                )}

                {(memoLoading || memoError) && (
                  <SectionProgressList sections={state.progress.sections} />
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
              </Panel>
            </>
          )}

          {/* Step 5 — Review. The memo is the deliverable; research details
              move below it. */}
          {effectiveStep === "review" && memoSuccess && (
            <>
              <MemoCompletionBanner
                memo={memoSuccess.memo}
                research={state.research}
              />
              <MemoReview
                memo={memoSuccess.memo}
                generationType="openai"
                researchWindowLabel={researchWindowLabel}
              />
              {researchSuccess && (
                <ResearchFindingsCard
                  key="post-memo"
                  research={researchSuccess.research}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Phase 6H: persistent reload prompt when the browser bundle is stale.
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
            This tab is running an older build than the server. Reload to pick
            up the latest version — it prevents generation errors caused by the
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

// Step 2 pane: live status of the memo analysis (which runs on its own after
// upload). Covers the local extraction phase, the AI analysis phase, success,
// the explicit-skip path, and analysis errors (with a Retry). When it reaches
// success the Research button unlocks — research is run manually by the
// analyst, so they get time to add priorities first.
function AnalysisPane({
  dnaReady,
  extractionFailed,
  understanding,
  skip,
  onRerun,
}: {
  dnaReady: boolean;
  extractionFailed: boolean;
  understanding: MemoUnderstandingState;
  skip: boolean;
  onRerun: () => void;
}) {
  let tone: "loading" | "success" | "warning";
  let title: string;
  let detail: string;
  let showRetry = false;

  if (extractionFailed) {
    tone = "warning";
    title = "We couldn't read this file";
    detail =
      "Open the Upload step in the workflow and try a .txt, .md, or text-based .pdf.";
  } else if (!dnaReady) {
    tone = "loading";
    title = "Reading your memo…";
    detail = "Extracting the text locally to build memo DNA.";
  } else if (skip) {
    tone = "success";
    title = "Analysis skipped";
    detail = "Research will run without the AI memo analysis.";
  } else if (understanding.kind === "success") {
    tone = "success";
    title = "Analysis complete";
    detail =
      "Research will use the extracted memo understanding. Add any priorities, then run research.";
  } else if (understanding.kind === "loading") {
    tone = "loading";
    title = "Analyzing your memo with AI…";
    detail =
      "Pulling out the thesis, valuation anchors, and claims that research should verify. This runs on its own.";
  } else if (understanding.kind === "error") {
    tone = "warning";
    title = "Memo analysis didn't finish";
    detail =
      understanding.code === "timeout"
        ? "The analysis timed out. Retry so research stays memo-specific."
        : understanding.code === "parse_error"
          ? "The analysis returned malformed data. Retry so research stays memo-specific."
          : "The analysis failed. Retry so research stays memo-specific.";
    showRetry = true;
  } else {
    tone = "loading";
    title = "Preparing analysis…";
    detail = "Starting the AI memo analysis.";
  }

  return (
    <Panel eyebrow="Step 2" title="Extract insights">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {tone === "loading" ? (
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink)]" />
          ) : tone === "success" ? (
            <Check
              className="w-5 h-5 text-[var(--color-success)]"
              strokeWidth={2.5}
            />
          ) : (
            <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-[var(--color-text)]">
            {title}
          </div>
          <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
            {detail}
          </p>
          {showRetry && (
            <Button
              size="sm"
              className="mt-2.5"
              onClick={onRerun}
              leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry analysis
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function SetupRequiredPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 flex items-start gap-3">
      <Lock className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[var(--color-text)]">
          {title}
        </div>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
          {message}
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-[var(--color-ink)] hover:underline"
        >
          Open Settings <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// Phase 5E / 6C: 6-row per-pass research progress list. Shown while
// research is running, after partial-success ("complete_with_warnings"),
// and after hard failure so the user can see exactly which passes
// completed, failed, or were skipped. Phase 6C adds per-pass
// "Validating: …" lines so the workflow visibility is concrete (the
// specific memo-anchored items being checked under each pass), plus a
// global user-priorities chip row at the top when the user supplied any.
function ResearchProgressList({
  passes,
  tasksByPass,
  userPriorityLines,
}: {
  passes: ResearchPassRunState[];
  tasksByPass: Record<ResearchPassId, string[]>;
  userPriorityLines: string[];
}) {
  const total = passes.length;
  const completed = passes.filter((p) => p.status === "success").length;
  const running = passes.find((p) => p.status === "running");
  const failed = passes.filter((p) => p.status === "failed");
  const headline = running
    ? `Researching pass ${passes.indexOf(running) + 1} of ${total} — ${running.title}`
    : failed.length > 0
      ? `${completed} of ${total} passes complete · ${failed.length} failed`
      : `${completed} of ${total} passes complete`;
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-2">
        {headline}
      </div>
      {userPriorityLines.length > 0 && (
        <div className="mb-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] mb-1">
            Your priorities (echoed into every pass)
          </div>
          <ul className="space-y-0.5">
            {userPriorityLines.map((line, i) => (
              <li
                key={i}
                className="text-[11.5px] text-[var(--color-text)] leading-snug"
              >
                · {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="space-y-2">
        {passes.map((p, i) => {
          const tasks = tasksByPass[p.id] ?? [];
          return (
            <li
              key={p.id}
              className="text-[12px] text-[var(--color-text)]"
            >
              <div className="flex items-center gap-2">
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
                <span className="tnum w-5 text-right text-[var(--color-text-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    p.status === "pending"
                      ? "text-[var(--color-text-subtle)]"
                      : "font-medium"
                  }
                >
                  {p.title}
                </span>
                {p.status === "success" && typeof p.findingCount === "number" && (
                  <span className="text-[10.5px] text-[var(--color-text-subtle)]">
                    · {p.findingCount} finding{p.findingCount === 1 ? "" : "s"}
                  </span>
                )}
                {p.status === "running" && p.attempt === 2 && (
                  <span className="text-[10.5px] text-[var(--color-text-subtle)]">
                    · retrying (compact)
                  </span>
                )}
                {p.status === "failed" && p.errorCode && (
                  <span className="text-[10.5px] text-[var(--color-warning)]">
                    · {p.errorCode}
                  </span>
                )}
              </div>
              {tasks.length > 0 && (
                <ul className="mt-1 pl-11 space-y-0.5">
                  {tasks.map((t, ti) => (
                    <li
                      key={ti}
                      className="text-[10.5px] text-[var(--color-text-muted)] leading-snug"
                    >
                      <span className="text-[var(--color-text-subtle)]">
                        Validating:
                      </span>{" "}
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResearchWarningsBanner({
  passes,
  onRetryFailed,
  disabled,
}: {
  passes: ResearchPassRunState[];
  onRetryFailed: () => void;
  disabled: boolean;
}) {
  const failed = passes.filter((p) => p.status === "failed");
  if (failed.length === 0) return null;
  const titles = failed.map((p) => p.title).join(", ");
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)] leading-snug">
            Research complete with warnings — {failed.length} of {passes.length} passes failed.
          </div>
          <p className="text-[11.5px] text-[var(--color-warning)] mt-1 leading-snug">
            Failed: {titles}. Memo generation is enabled and will use the
            passes that succeeded. Retry the failed passes below to top up
            coverage.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetryFailed} disabled={disabled}>
          Retry failed research passes
        </Button>
      </div>
    </div>
  );
}

function ResearchFailureBanner({
  code,
  message,
  hasFailedPasses,
  onRetryFailed,
  onRetryAll,
  disabled,
}: {
  code: string;
  message: string;
  hasFailedPasses: boolean;
  onRetryFailed: () => void;
  onRetryAll: () => void;
  disabled: boolean;
}) {
  const headline =
    code === "research_no_sources"
      ? "Research failed — no verified sources were returned across the run."
      : "Research failed.";
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)] leading-snug">
            {headline}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug font-mono">
            {code} · {message}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasFailedPasses && (
          <Button size="sm" onClick={onRetryFailed} disabled={disabled}>
            Retry failed research passes
          </Button>
        )}
        <Button
          size="sm"
          variant={hasFailedPasses ? "outline" : "primary"}
          onClick={onRetryAll}
          disabled={disabled}
        >
          Retry all research
        </Button>
      </div>
    </div>
  );
}

// Phase 5D: 9-row per-section progress list shown while generation is
// running OR after a failure (so the user sees which sections completed,
// which one broke, and what's still pending).
function SectionProgressList({ sections }: { sections: SectionRunState[] }) {
  const total = sections.length;
  const completed = sections.filter((s) => s.status === "success").length;
  const running = sections.find((s) => s.status === "running");
  const failed = sections.find((s) => s.status === "failed");
  const headline = running
    ? `Generating section ${sections.indexOf(running) + 1} of ${total} — ${running.title}`
    : failed
      ? `Section ${sections.indexOf(failed) + 1} of ${total} failed — ${failed.title}`
      : `${completed} of ${total} sections complete`;
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-2">
        {headline}
      </div>
      <ol className="space-y-1.5">
        {sections.map((s, i) => (
          <li
            key={s.id}
            className="flex items-center gap-2 text-[12px] text-[var(--color-text)]"
          >
            <span className="w-4 inline-flex justify-center">
              {s.status === "success" ? (
                <Check className="w-3.5 h-3.5 text-[var(--color-success)]" />
              ) : s.status === "running" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-ink)]" />
              ) : s.status === "failed" ? (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
              ) : (
                <Circle className="w-3 h-3 text-[var(--color-text-subtle)]" />
              )}
            </span>
            <span className="tnum w-5 text-right text-[var(--color-text-subtle)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={
                s.status === "pending"
                  ? "text-[var(--color-text-subtle)]"
                  : ""
              }
            >
              {s.title}
            </span>
            {s.status === "running" && s.attempt === 2 && (
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

// Phase 5D: section-failure banner. Replaces the Phase 5C MemoErrorBanner.
// No fallback button — failure offers only "Retry failed section" (resumes
// from the failed section, preserving completed ones) or "Retry full memo"
// (re-runs all 9 sections).
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
  const failed = idx >= 0 ? sections[idx] : null;
  const sectionNumber = idx >= 0 ? idx + 1 : 0;
  const sectionTitle = failed?.title ?? "unknown section";
  const headline = `Memo generation failed while drafting Section ${sectionNumber}: ${sectionTitle}.`;
  const lower = detail.toLowerCase();
  const hint = lower.includes("rate_limited") || lower.includes("rate limit")
    ? "OpenAI rate-limited the request; wait ~10 s before retrying."
    : lower.includes("timeout")
      ? "The section call exceeded the 60 s limit. Retrying with a tighter prompt is automatic; if it failed twice, the network may be slow."
      : lower.includes("parse")
        ? "OpenAI returned a section that didn't match the schema. Retrying with a tighter prompt usually fixes this."
        : null;
  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-[var(--color-warning)] leading-snug">
            {headline}
          </div>
          {hint && (
            <p className="text-[11.5px] text-[var(--color-warning)] mt-1 leading-snug">
              {hint}
            </p>
          )}
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug font-mono">
            {detail}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetryFailed} disabled={disabled}>
          Retry failed section
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetryFull}
          disabled={disabled}
        >
          Retry full memo
        </Button>
      </div>
    </div>
  );
}
