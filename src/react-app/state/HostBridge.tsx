import { useEffect, useRef } from "react";
import type { DashboardSnapshot } from "../lib/munshotSdk";
import { useMemoProject } from "./MemoProjectContext";
import { useMunshotHost } from "./MunshotHostContext";

// Bridges the Munshot host context and the live memo-project state. Renders
// nothing — it only wires effects:
//   1. host ticker selection → preselects the company (no page refresh);
//   2. registers the dashboard.capture.snapshot SOURCE from live state so the
//      host always captures what's actually rendered;
//   3. publishes namespaced telemetry on key transitions.

type MemoState = ReturnType<typeof useMemoProject>["state"];

function researchWindowLabel(state: MemoState): string | null {
  const r = state.research;
  return r
    ? `${r.researchWindow.startIsoMonth} -> ${r.researchWindow.endIsoMonth}`
    : null;
}

function deriveStage(state: MemoState): string {
  if (state.generatedMemo) return "memo_generated";
  if (state.llm.kind === "loading") return "generating";
  if (state.researchState.kind === "success") return "research_complete";
  if (state.researchState.kind === "loading") return "researching";
  if (state.understanding.kind === "success") return "memo_understood";
  if (state.dna) return "memo_loaded";
  if (state.selectedCompany) return "company_selected";
  return "idle";
}

// Map the live dashboard state to the snapshot contract: applied context,
// current selection, and the raw data actually rendered in the workbench.
function buildSnapshot(state: MemoState): DashboardSnapshot {
  const company = state.selectedCompany;
  const research = state.research;
  const memo = state.generatedMemo;
  const understanding =
    state.understanding.kind === "success"
      ? state.understanding.understanding
      : null;

  return {
    context: {
      ticker: company?.ticker ?? null,
      company: company?.companyName ?? null,
      sector: company?.sector ?? null,
      memoPeriod:
        state.periodOverride.periodLabel ??
        state.detection?.detectedCompany ??
        null,
      researchWindow: researchWindowLabel(state),
      stage: deriveStage(state),
    },
    selection: company
      ? { ticker: company.ticker, company: company.companyName }
      : null,
    data: {
      memoLoaded: Boolean(state.extraction),
      wordCount: state.extraction?.wordCount ?? null,
      understanding: understanding
        ? {
            oneLine: understanding.summary.oneLineSummary,
            recommendation: understanding.memo.recommendation ?? null,
            targetPrice: understanding.memo.targetPrice ?? null,
          }
        : null,
      research: research
        ? {
            findings: research.findings.length,
            positive: research.positiveDevelopments.length,
            negative: research.negativeDevelopments.length,
            watch: research.neutralOrWatch.length,
            unresolved: research.unresolvedQuestions.length,
            window: researchWindowLabel(state),
          }
        : null,
      memo: memo
        ? {
            title: memo.title,
            sections: memo.sections.map((s) => ({
              id: s.id,
              title: s.title,
              signal: s.signal ?? null,
              summary: s.summary ?? null,
            })),
            supplementaryPanels: (memo.supplementaryPanels ?? []).map((p) => ({
              id: p.id,
              title: p.title,
            })),
            manualChecksRemaining: memo.manualChecksRemaining ?? [],
          }
        : null,
    },
  };
}

export function HostBridge() {
  const { state, setSelectedCompany } = useMemoProject();
  const { host, setSnapshotSource, publish } = useMunshotHost();

  // 1. Host ticker → preselect company. One-shot per distinct ticker; deferred
  //    out of the effect body so it never runs as a synchronous render update.
  const lastHostTickerRef = useRef<string | null>(null);
  const hostTicker = host?.ticker ?? null;
  const hostCompany = host?.company ?? null;
  const selectedTicker = state.selectedCompany?.ticker ?? null;
  useEffect(() => {
    if (!hostTicker) return;
    if (lastHostTickerRef.current === hostTicker) return;
    lastHostTickerRef.current = hostTicker;
    if (selectedTicker === hostTicker) return;
    queueMicrotask(() => {
      setSelectedCompany({
        ticker: hostTicker,
        companyName: hostCompany ?? hostTicker,
      });
    });
  }, [hostTicker, hostCompany, selectedTicker, setSelectedCompany]);

  // 2. Keep the snapshot source pointed at the latest live state.
  useEffect(() => {
    setSnapshotSource(() => buildSnapshot(state));
    return () => setSnapshotSource(null);
  }, [state, setSnapshotSource]);

  // 3. Telemetry — company selection.
  const lastSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const ticker = state.selectedCompany?.ticker ?? null;
    if (ticker && ticker !== lastSelectedRef.current) {
      lastSelectedRef.current = ticker;
      publish("portfolio.ticker.select", {
        ticker,
        company: state.selectedCompany?.companyName ?? null,
      });
    }
  }, [state.selectedCompany?.ticker, state.selectedCompany?.companyName, publish]);

  // 3b. Telemetry — memo generated (one event per generated memo).
  const lastMemoRef = useRef<string | null>(null);
  useEffect(() => {
    const memo = state.generatedMemo;
    if (memo && memo.generatedAt !== lastMemoRef.current) {
      lastMemoRef.current = memo.generatedAt;
      publish("dashboard.metric", {
        event: "memo_generated",
        title: memo.title,
        sections: memo.sections.length,
      });
    }
  }, [state.generatedMemo, publish]);

  return null;
}
