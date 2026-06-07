import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Sparkles,
  ArrowRight,
  FileText,
  AlertCircle,
  RefreshCcw,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { StatusChip } from "../components/ui/StatusChip";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { ThesisMap } from "../components/ui/ThesisMap";
import { useMemoProject } from "../state/MemoProjectContext";
import { analyzeUpdatePack } from "../lib/updateAnalysis";
import { describeKind } from "../lib/fileMeta";
import type { GenerationStep } from "@shared/types";

const STEP_TEMPLATE: Omit<GenerationStep, "status">[] = [
  {
    id: "step_read_original",
    label: "Read original memo",
    description: "Ingest the canonical memo; lock thesis structure as template.",
  },
  {
    id: "step_map_checkpoints",
    label: "Map thesis checkpoints",
    description: "Walk key assumptions; tag each with re-test metric.",
  },
  {
    id: "step_read_update_pack",
    label: "Read update pack",
    description: "Parse financials, transcript, broker / competitor / macro.",
  },
  {
    id: "step_identify_changes",
    label: "Identify what changed",
    description: "Diff new evidence; flag where memo held vs broke.",
  },
  {
    id: "step_rebuild_bridge",
    label: "Rebuild EPS / valuation bridge",
    description: "Re-walk forward EPS; refresh multiple and peer-gap framing.",
  },
  {
    id: "step_generate",
    label: "Generate follow-up memo",
    description: "Compose in original house voice across all 9 sections.",
  },
];

export function BuilderPage() {
  const navigate = useNavigate();
  const {
    currentDna,
    currentMode,
    state,
    generationStatus,
    usableUpdateCount,
    generateFollowUp,
    generateLlmFollowUp,
  } = useMemoProject();
  const [busy, setBusy] = useState(false);

  const checkpoints = currentDna?.thesisCheckpoints ?? [];
  const isExtracted = currentMode === "extracted" && state.extractedDna;
  const anchorLabel = isExtracted
    ? (state.extraction?.source.filename ?? "Extracted memo")
    : "Demo memo";

  const analysisPreview = useMemo(
    () =>
      analyzeUpdatePack({
        extractions: state.updateExtractions,
        uploads: state.uploads,
      }),
    [state.updateExtractions, state.uploads],
  );

  const steps: GenerationStep[] = useMemo(() => {
    const done = (b: boolean): "demo_generated" | "ready" =>
      b ? "demo_generated" : "ready";
    const hasDna = Boolean(state.extractedDna);
    const hasCheckpoints = (currentDna?.thesisCheckpoints.length ?? 0) > 0;
    const hasUsableUpdate = usableUpdateCount > 0;
    const hasSignals = analysisPreview.signals.length > 0;
    const hasMemo = Boolean(state.generatedMemo);
    return STEP_TEMPLATE.map((step) => {
      switch (step.id) {
        case "step_read_original":
          return { ...step, status: done(hasDna) };
        case "step_map_checkpoints":
          return { ...step, status: done(hasCheckpoints) };
        case "step_read_update_pack":
          return { ...step, status: done(hasUsableUpdate) };
        case "step_identify_changes":
          return { ...step, status: done(hasSignals) };
        case "step_rebuild_bridge":
          return { ...step, status: done(hasMemo) };
        case "step_generate":
          return {
            ...step,
            status: hasMemo ? "demo_generated" : "not_started",
          };
        default:
          return { ...step, status: "not_started" };
      }
    });
  }, [
    state.extractedDna,
    state.generatedMemo,
    currentDna?.thesisCheckpoints.length,
    usableUpdateCount,
    analysisPreview.signals.length,
  ]);

  const completedCount = steps.filter(
    (s) => s.status === "demo_generated",
  ).length;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const result = generateFollowUp();
      if (result) navigate("/output");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateLlm = async () => {
    await generateLlmFollowUp();
    navigate("/output");
  };

  const buttonDisabled =
    busy ||
    generationStatus === "missing_initial_memo" ||
    generationStatus === "missing_update_pack";

  const buttonLabel = (() => {
    if (busy) return "Generating…";
    if (state.generationError) return "Retry generation";
    if (generationStatus === "generated") return "Regenerate";
    return "Generate Follow-up Memo v0";
  })();

  const llmConfigured = state.llmProviderStatus?.configured === true;
  const llmLoading = state.llm.kind === "loading";
  const llmHasSuccess = state.llm.kind === "success";
  const llmButtonDisabled =
    llmLoading ||
    !llmConfigured ||
    generationStatus === "missing_initial_memo" ||
    generationStatus === "missing_update_pack";
  const llmButtonLabel = (() => {
    if (llmLoading) return "Generating LLM…";
    if (llmHasSuccess) return "Regenerate LLM memo";
    return "Generate LLM Memo v1";
  })();

  const memo = state.generatedMemo ?? state.demoFollowUpMemo;
  const memoIsGenerated = Boolean(state.generatedMemo);
  const anyUserMemoAvailable = memoIsGenerated || llmHasSuccess;

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 3 · Builder"
        title="Follow-up memo workflow engine"
        description="Three-column cockpit. Pipeline left, thesis checkpoint mapping center, memo assembly preview right. Generation runs deterministically from the active DNA + extracted update-pack signals."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleGenerate}
              disabled={buttonDisabled}
              leadingIcon={
                state.generationError ? (
                  <RefreshCcw className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
            >
              {buttonLabel}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateLlm}
              disabled={llmButtonDisabled}
              leadingIcon={<Bot className="w-4 h-4" />}
              title={
                llmConfigured
                  ? undefined
                  : "LLM generation is not configured on the server"
              }
            >
              {llmButtonLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/output")}
              disabled={!anyUserMemoAvailable}
              trailingIcon={<ArrowRight className="w-4 h-4" />}
            >
              View output
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={generationStatus} hasError={Boolean(state.generationError)} />
        <Badge tone={isExtracted ? "success" : "accent"}>
          Anchored on: {anchorLabel}
        </Badge>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={llmConfigured ? "success" : "neutral"} dot>
            {llmConfigured
              ? "LLM generation enabled"
              : "LLM generation not configured"}
          </Badge>
          {llmConfigured && state.llmProviderStatus && (
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {state.llmProviderStatus.provider} ·{" "}
              {state.llmProviderStatus.model}
            </span>
          )}
          <span className="text-[11px] text-[var(--color-text-subtle)] inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Deterministic v0 fallback is always available
          </span>
        </div>
        <p className="text-[11.5px] text-[var(--color-text-muted)] leading-snug">
          LLM Memo v1 sends extracted memo and update-pack text to the
          configured LLM provider. Deterministic v0 stays local/browser-side.
        </p>
      </div>

      {state.llm.kind === "error" && (
        <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)] bg-[var(--color-signal-down-soft)] px-4 py-3 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-[var(--color-signal-down)] mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-[var(--color-signal-down)] leading-relaxed">
            <span className="font-semibold">LLM generation failed:</span>{" "}
            {state.llm.error}
          </div>
        </div>
      )}

      {state.generationError && (
        <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)] bg-[var(--color-signal-down-soft)] px-4 py-3 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-[var(--color-signal-down)] mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-[var(--color-signal-down)] leading-relaxed">
            <span className="font-semibold">Generation failed:</span>{" "}
            {state.generationError}
          </div>
        </div>
      )}

      <Panel
        eyebrow="Readiness"
        title="Update-pack signal preview"
        actions={
          <Badge tone="ink">
            {analysisPreview.signals.length} signal
            {analysisPreview.signals.length === 1 ? "" : "s"}
          </Badge>
        }
      >
        {analysisPreview.documentsAnalyzed.length === 0 &&
        analysisPreview.unsupportedDocuments.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-subtle)] italic">
            No update-pack documents uploaded yet. Drop financials, transcripts,
            or notes on the Intake screen to populate signals.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysisPreview.documentsAnalyzed.map((k) => (
              <Badge key={k} tone="success" dot>
                {describeKind(k)}
              </Badge>
            ))}
            {analysisPreview.unsupportedDocuments.map((k) => (
              <Badge key={k} tone="warning" dot>
                {describeKind(k)} — unsupported
              </Badge>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left — pipeline */}
        <Panel
          eyebrow="Pipeline"
          title="Generation steps"
          actions={
            <Badge tone="ink">
              {completedCount} / {steps.length}
            </Badge>
          }
          className="lg:col-span-4"
          bodyClassName="px-0 py-0"
        >
          <ol>
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="px-5 py-3.5 border-b border-[var(--color-border)] last:border-b-0 flex items-start gap-3"
              >
                <div
                  className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold tnum shrink-0 border ${
                    step.status === "demo_generated"
                      ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
                      {step.label}
                    </h4>
                    <StatusChip status={step.status} />
                  </div>
                  <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1 leading-snug">
                    {step.description}
                  </p>
                </div>
                <button
                  disabled
                  className="text-[var(--color-text-subtle)] opacity-50 cursor-not-allowed pt-1"
                  title="Driven by the Generate button"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Center — checkpoint mapping */}
        <Panel
          eyebrow="Thesis checkpoints"
          title="What we re-test"
          actions={
            checkpoints.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {checkpoints.length} mapped
              </span>
            )
          }
          className="lg:col-span-4"
        >
          {checkpoints.length > 0 ? (
            <ThesisMap checkpoints={checkpoints} columns={1} compact />
          ) : (
            <div className="text-[12px] text-[var(--color-text-subtle)] italic">
              No checkpoints in the active DNA. Heuristic v0 didn't find
              testable assumptions — try a richer memo or fall back to demo
              mode on the Memo DNA screen.
            </div>
          )}
        </Panel>

        {/* Right — memo assembly preview */}
        <Panel
          eyebrow="Assembly"
          title="Follow-up memo skeleton"
          actions={
            memoIsGenerated && (
              <Badge tone="success" dot>
                Drafted
              </Badge>
            )
          }
          className="lg:col-span-4"
        >
          {memo ? (
            <ol className="space-y-2">
              {memo.sections.map((s, i) => (
                <li
                  key={s.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] border transition-colors ${
                    memoIsGenerated
                      ? "border-[var(--color-border)] bg-[var(--color-surface)]"
                      : "border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40"
                  }`}
                >
                  <span className="tnum text-[10px] font-mono text-[var(--color-text-subtle)] w-5">
                    0{i + 1}
                  </span>
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      memoIsGenerated
                        ? "text-[var(--color-ink)]"
                        : "text-[var(--color-text-subtle)]"
                    }`}
                  />
                  <span
                    className={`text-[12.5px] truncate ${
                      memoIsGenerated
                        ? "text-[var(--color-text)] font-medium"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {s.title}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-[12px] text-[var(--color-text-subtle)] italic">
              Loading memo skeleton…
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  hasError,
}: {
  status:
    | "missing_initial_memo"
    | "missing_update_pack"
    | "ready"
    | "generated";
  hasError: boolean;
}) {
  if (hasError) {
    return (
      <Badge tone="down" dot>
        Generation failed
      </Badge>
    );
  }
  switch (status) {
    case "missing_initial_memo":
      return (
        <Badge tone="warning" dot>
          Upload an initial memo first
        </Badge>
      );
    case "missing_update_pack":
      return (
        <Badge tone="accent" dot>
          Add at least one update-pack document to generate a follow-up memo
        </Badge>
      );
    case "ready":
      return (
        <Badge tone="success" dot>
          Ready to generate
        </Badge>
      );
    case "generated":
      return (
        <Badge tone="ink" dot>
          Follow-up Memo v0 generated
        </Badge>
      );
  }
}
