import type {
  ExtractionStatus,
  FollowUpMemo,
  LlmGenerationState,
  MemoDNA,
  MemoUnderstandingState,
  ResearchFindings,
  ResearchGenerationState,
} from "@shared/types";

// Phase 5I: pure helper. Derives the 5-step workflow-progress rail state
// from a minimal slice of MemoProjectContext. Mirrors the existing
// commandBarState.ts pattern so synthetic tests can import it under Node
// without pulling React. NO reducer changes, NO new context fields, NO
// new state.
//
// Naming note: the component file is named MemoMissionTracker.tsx for
// brevity, but ALL visible copy is professional ("Workflow progress",
// "Memo workflow", etc.). The "Mission" in the file name is purely an
// internal identifier — no rendered string says it.

export type MissionStepId =
  | "upload"
  | "detect"
  | "research"
  | "generate"
  | "review";

export type MissionStepStatus = "complete" | "active" | "pending";

export interface MissionStep {
  id: MissionStepId;
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  helper: string;
  status: MissionStepStatus;
}

export interface MissionTrackerStateSlice {
  initialFile: unknown | null;
  extractionStatus: ExtractionStatus;
  dna: MemoDNA | null;
  // The LLM-driven Memo Understanding stage runs in the background after
  // upload — it's what gates the Research button. The tracker MUST wait for
  // it before showing "Extract insights" as complete; otherwise the rail
  // says "done" while the Research button is still locked, which reads as
  // "the dashboard is broken".
  understanding: MemoUnderstandingState;
  skipUnderstanding: boolean;
  research: ResearchFindings | null;
  researchState: ResearchGenerationState;
  generatedMemo: FollowUpMemo | null;
  llm: LlmGenerationState;
}

const LABELS: Record<MissionStepId, { label: string; helper: string }> = {
  upload:   { label: "Upload memo",         helper: "Drop the original memo to begin" },
  detect:   { label: "Extract insights",    helper: "Parse text and analyze the memo with AI" },
  research: { label: "Run research",        helper: "Six focused web-search passes" },
  generate: { label: "Draft <3-page memo",  helper: "Section-by-section, with sourced facts" },
  review:   { label: "Download / print",    helper: "PDF, ready for the analyst" },
};

export function deriveMissionTrackerSteps(
  state: MissionTrackerStateSlice,
): MissionStep[] {
  const uploaded = state.initialFile !== null;
  const dnaReady = state.dna !== null;
  const extracting = state.extractionStatus === "extracting";

  // The "Extract insights" step is HONESTLY complete only when both the
  // local DNA build (fast, regex) AND the LLM Memo Understanding call
  // (slow, what gates the Research button) have succeeded — OR when the
  // user has explicitly hit the emergency-skip path.
  const understandingKind = state.understanding.kind;
  const insightsReady =
    dnaReady &&
    (understandingKind === "success" || state.skipUnderstanding);

  const researchKind = state.researchState.kind;
  const researchDone = researchKind === "success";
  const researchActive = researchKind === "loading" || researchKind === "error";

  const memoKind = state.llm.kind;
  const memoDone = state.generatedMemo !== null && memoKind === "success";
  const memoActive = memoKind === "loading" || memoKind === "error";

  // Step 1 — Upload
  const upload: MissionStep = {
    id: "upload", index: 1, ...LABELS.upload,
    status: uploaded ? "complete" : "active",
  };

  // Step 2 — Detect context (waits for the LLM understanding pass)
  let detectStatus: MissionStepStatus;
  if (insightsReady) detectStatus = "complete";
  else if (extracting || uploaded) detectStatus = "active";
  else detectStatus = "pending";
  const detect: MissionStep = {
    id: "detect", index: 2, ...LABELS.detect, status: detectStatus,
  };

  // Step 3 — Research changes. Only "active" once Memo Understanding (the
  // gate on the Research button) is past, so the rail never shows "ready
  // to research" while the actual button is still locked.
  let researchStatus: MissionStepStatus;
  if (researchDone) researchStatus = "complete";
  else if (researchActive) researchStatus = "active";
  else if (insightsReady) researchStatus = "active";
  else researchStatus = "pending";
  const research: MissionStep = {
    id: "research", index: 3, ...LABELS.research, status: researchStatus,
  };

  // Step 4 — Generate memo
  let generateStatus: MissionStepStatus;
  if (memoDone) generateStatus = "complete";
  else if (memoActive) generateStatus = "active";
  else if (researchDone) generateStatus = "active";
  else generateStatus = "pending";
  const generate: MissionStep = {
    id: "generate", index: 4, ...LABELS.generate, status: generateStatus,
  };

  // Step 5 — Review output (no separate "reviewed" state — completes
  // when the memo lands; user is viewing it inline).
  const review: MissionStep = {
    id: "review", index: 5, ...LABELS.review,
    status: memoDone ? "complete" : "pending",
  };

  return [upload, detect, research, generate, review];
}
