import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  CanonicalSectionId,
  ExtractionResult,
  ExtractionStatus,
  FollowUpMemo,
  LlmGenerationErrorCode,
  LlmGenerationState,
  LlmStatusResponse,
  LocalUploadedFile,
  MemoDNA,
  MemoGenerationProgress,
  MemoSection,
  PeriodDetectionResult,
  ResearchFindings,
  ResearchGenerationState,
  ResearchUpdatesRequest,
  ResearchUpdatesResponse,
  SectionRunState,
} from "@shared/types";
import { api } from "../lib/api";
import { extractText } from "../lib/extract";
import {
  extractionSupported,
  getExtension,
  mimeForFile,
} from "../lib/fileMeta";
import { buildMemoDnaFromText } from "../lib/memoDna";
import { detectPeriodFromMemoText } from "../lib/periodDetect";
import {
  CANONICAL_SECTION_IDS,
  SECTION_TITLES,
  runSectionGeneration,
} from "../lib/sectionGeneration";
import { getLlmGateToken } from "../lib/llmGateToken";

const GATE_TOKEN_POLL_KEY = "memo.llm.gate";

export interface PeriodOverride {
  detectedCompany?: string;
  periodLabel?: string;
  researchStart?: string;
}

interface State {
  initialFile: LocalUploadedFile | null;
  extraction: ExtractionResult | null;
  extractionStatus: ExtractionStatus;
  dna: MemoDNA | null;
  detection: PeriodDetectionResult | null;
  periodOverride: PeriodOverride;
  research: ResearchFindings | null;
  researchState: ResearchGenerationState;
  generatedMemo: FollowUpMemo | null;
  llm: LlmGenerationState;
  progress: MemoGenerationProgress;
  completedSections: Partial<Record<CanonicalSectionId, MemoSection>>;
  llmProviderStatus: LlmStatusResponse | null;
  demoFollowUpMemo: FollowUpMemo | null;
  gateTokenSet: boolean;
}

type Action =
  | { type: "SET_INITIAL_FILE"; file: LocalUploadedFile | null }
  | { type: "SET_EXTRACTION_STATUS"; status: ExtractionStatus }
  | { type: "SET_EXTRACTION"; result: ExtractionResult }
  | {
      type: "SET_DNA_AND_DETECTION";
      dna: MemoDNA;
      detection: PeriodDetectionResult;
    }
  | { type: "SET_PERIOD_OVERRIDE"; override: PeriodOverride }
  | { type: "SET_RESEARCH_STATE"; state: ResearchGenerationState }
  | { type: "SET_RESEARCH"; research: ResearchFindings | null }
  | { type: "SET_LLM_STATE"; state: LlmGenerationState }
  | { type: "SET_GENERATED_MEMO"; memo: FollowUpMemo | null }
  | { type: "START_GENERATION"; startedAt: string; resumeFromIdx: number }
  | { type: "SECTION_STARTED"; sectionId: CanonicalSectionId; attempt: 1 | 2 }
  | { type: "SECTION_SUCCESS"; sectionId: CanonicalSectionId; section: MemoSection }
  | {
      type: "SECTION_FAILED";
      sectionId: CanonicalSectionId;
      code: LlmGenerationErrorCode;
      message: string;
    }
  | { type: "RESET_PROGRESS" }
  | { type: "SET_LLM_PROVIDER_STATUS"; status: LlmStatusResponse | null }
  | { type: "SET_DEMO_MEMO"; memo: FollowUpMemo | null }
  | { type: "SET_GATE_TOKEN_SET"; value: boolean }
  | { type: "RESET" };

function buildInitialProgress(): MemoGenerationProgress {
  return {
    kind: "idle",
    sections: CANONICAL_SECTION_IDS.map<SectionRunState>((id) => ({
      id,
      title: SECTION_TITLES[id],
      status: "pending",
      attempt: 0,
    })),
    completedCount: 0,
  };
}

const initialState: State = {
  initialFile: null,
  extraction: null,
  extractionStatus: "idle",
  dna: null,
  detection: null,
  periodOverride: {},
  research: null,
  researchState: { kind: "idle" },
  generatedMemo: null,
  llm: { kind: "idle" },
  progress: buildInitialProgress(),
  completedSections: {},
  llmProviderStatus: null,
  demoFollowUpMemo: null,
  gateTokenSet: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_INITIAL_FILE":
      return { ...state, initialFile: action.file };
    case "SET_EXTRACTION_STATUS":
      return { ...state, extractionStatus: action.status };
    case "SET_EXTRACTION":
      return {
        ...state,
        extraction: action.result,
        extractionStatus: action.result.status,
      };
    case "SET_DNA_AND_DETECTION":
      return {
        ...state,
        dna: action.dna,
        detection: action.detection,
        periodOverride: {
          detectedCompany: action.detection.detectedCompany,
          periodLabel: action.detection.best
            ? renderPeriodLabel(action.detection.best)
            : undefined,
          researchStart: action.detection.researchStart,
        },
        research: null,
        researchState: { kind: "idle" },
        generatedMemo: null,
        llm: { kind: "idle" },
        progress: buildInitialProgress(),
        completedSections: {},
      };
    case "SET_PERIOD_OVERRIDE":
      return {
        ...state,
        periodOverride: { ...state.periodOverride, ...action.override },
      };
    case "SET_RESEARCH_STATE":
      return { ...state, researchState: action.state };
    case "SET_RESEARCH":
      return { ...state, research: action.research };
    case "SET_LLM_STATE":
      return { ...state, llm: action.state };
    case "SET_GENERATED_MEMO":
      return { ...state, generatedMemo: action.memo };
    case "START_GENERATION": {
      const fresh = buildInitialProgress();
      const sections = fresh.sections.map<SectionRunState>((row, i) => {
        const prev =
          i < action.resumeFromIdx ? state.progress.sections[i] : undefined;
        if (prev && prev.status === "success") {
          return { ...prev, attempt: 0, errorCode: undefined, errorMessage: undefined };
        }
        return row;
      });
      const completedCount = sections.filter((s) => s.status === "success").length;
      return {
        ...state,
        progress: {
          kind: "running",
          startedAt: action.startedAt,
          sections,
          completedCount,
        },
      };
    }
    case "SECTION_STARTED": {
      const sections = state.progress.sections.map<SectionRunState>((row) =>
        row.id === action.sectionId
          ? {
              ...row,
              status: "running",
              attempt: action.attempt,
              errorCode: undefined,
              errorMessage: undefined,
            }
          : row,
      );
      return { ...state, progress: { ...state.progress, sections } };
    }
    case "SECTION_SUCCESS": {
      const sections = state.progress.sections.map<SectionRunState>((row) =>
        row.id === action.sectionId
          ? { ...row, status: "success" }
          : row,
      );
      const completedCount = sections.filter((s) => s.status === "success").length;
      return {
        ...state,
        completedSections: {
          ...state.completedSections,
          [action.sectionId]: action.section,
        },
        progress: {
          ...state.progress,
          sections,
          completedCount,
        },
      };
    }
    case "SECTION_FAILED": {
      const sections = state.progress.sections.map<SectionRunState>((row) =>
        row.id === action.sectionId
          ? {
              ...row,
              status: "failed",
              errorCode: action.code,
              errorMessage: action.message,
            }
          : row,
      );
      return {
        ...state,
        progress: {
          ...state.progress,
          kind: "failed",
          sections,
          failedSectionId: action.sectionId,
        },
      };
    }
    case "RESET_PROGRESS":
      return {
        ...state,
        progress: buildInitialProgress(),
        completedSections: {},
        generatedMemo: null,
        llm: { kind: "idle" },
      };
    case "SET_LLM_PROVIDER_STATUS":
      return { ...state, llmProviderStatus: action.status };
    case "SET_DEMO_MEMO":
      return { ...state, demoFollowUpMemo: action.memo };
    case "SET_GATE_TOKEN_SET":
      return { ...state, gateTokenSet: action.value };
    case "RESET":
      return {
        ...initialState,
        progress: buildInitialProgress(),
        llmProviderStatus: state.llmProviderStatus,
        demoFollowUpMemo: state.demoFollowUpMemo,
        gateTokenSet: state.gateTokenSet,
      };
  }
}

interface MemoProjectContextValue {
  state: State;
  effectiveDetection: {
    detectedCompany: string;
    periodLabel: string;
    researchStart?: string;
    researchCurrent: string;
    assumptionNotes: string[];
  } | null;
  extractInitialMemo: (file: File) => Promise<ExtractionResult>;
  setPeriodOverride: (override: PeriodOverride) => void;
  runResearch: () => Promise<void>;
  generateMemo: (withResearch: boolean) => Promise<void>;
  retryFailedSection: () => Promise<void>;
  retryFullMemo: () => Promise<void>;
  refreshLlmProviderStatus: () => Promise<void>;
  syncGateTokenSet: () => void;
  startOver: () => void;
}

const Ctx = createContext<MemoProjectContextValue | null>(null);

export function MemoProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const researchAbort = useRef<AbortController | null>(null);
  const generateAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .demoFollowUpMemo()
      .then((memo) => dispatch({ type: "SET_DEMO_MEMO", memo }))
      .catch(() => {});
    api
      .llmStatus()
      .then((status) =>
        dispatch({ type: "SET_LLM_PROVIDER_STATUS", status }),
      )
      .catch(() =>
        dispatch({ type: "SET_LLM_PROVIDER_STATUS", status: null }),
      );
    dispatch({
      type: "SET_GATE_TOKEN_SET",
      value: Boolean(getLlmGateToken()),
    });
    // Cross-tab gate-token changes:
    const onStorage = (e: StorageEvent): void => {
      if (e.key === GATE_TOKEN_POLL_KEY) {
        dispatch({
          type: "SET_GATE_TOKEN_SET",
          value: Boolean(getLlmGateToken()),
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const extractInitialMemo = useCallback(
    async (file: File): Promise<ExtractionResult> => {
      const ext = getExtension(file.name);
      const local: LocalUploadedFile = {
        id: `local_initial_${Date.now()}`,
        kind: "initial_memo",
        filename: file.name,
        sizeBytes: file.size,
        mime: mimeForFile(file),
        extension: ext,
        uploadedAt: new Date().toISOString(),
        extractionSupported: extractionSupported(ext),
      };
      dispatch({ type: "SET_INITIAL_FILE", file: local });
      dispatch({ type: "SET_EXTRACTION_STATUS", status: "extracting" });
      const result = await extractText(file);
      dispatch({ type: "SET_EXTRACTION", result });
      if (result.status === "success" || result.status === "partial") {
        const dna = buildMemoDnaFromText({
          text: result.text,
          filename: result.source.filename,
        });
        const detection = detectPeriodFromMemoText(result.text);
        dispatch({ type: "SET_DNA_AND_DETECTION", dna, detection });
      }
      return result;
    },
    [],
  );

  const setPeriodOverride = useCallback((override: PeriodOverride) => {
    dispatch({ type: "SET_PERIOD_OVERRIDE", override });
  }, []);

  const refreshLlmProviderStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await api.llmStatus();
      dispatch({ type: "SET_LLM_PROVIDER_STATUS", status });
    } catch {
      dispatch({ type: "SET_LLM_PROVIDER_STATUS", status: null });
    }
  }, []);

  const syncGateTokenSet = useCallback((): void => {
    dispatch({
      type: "SET_GATE_TOKEN_SET",
      value: Boolean(getLlmGateToken()),
    });
  }, []);

  const runResearch = useCallback(async (): Promise<void> => {
    if (!state.dna || !state.extraction || !state.initialFile) return;
    const periodLabel =
      state.periodOverride.periodLabel ??
      (state.detection?.best ? renderPeriodLabel(state.detection.best) : "");
    if (!periodLabel) return;

    const companyName =
      state.periodOverride.detectedCompany ??
      state.detection?.detectedCompany ??
      state.initialFile.filename.replace(/\.[^.]+$/, "");

    const req: ResearchUpdatesRequest = {
      project: {
        id: state.dna.projectId,
        companyName,
      },
      initialMemo: {
        id: state.initialFile.id,
        text: state.extraction.text,
        sourceFilename: state.extraction.source.filename,
        sizeBytes: state.extraction.source.sizeBytes,
      },
      dna: state.dna,
      detection: {
        detectedCompany: companyName,
        periodLabel,
        researchStart: state.periodOverride.researchStart,
        researchCurrent:
          state.detection?.researchCurrent ??
          new Date().toISOString().slice(0, 7),
        assumptionNotes: state.detection?.assumptionNotes ?? [],
      },
      thesisCheckpoints: state.dna.thesisCheckpoints,
    };

    researchAbort.current?.abort();
    const controller = new AbortController();
    researchAbort.current = controller;
    dispatch({ type: "SET_RESEARCH_STATE", state: { kind: "loading" } });

    let response: ResearchUpdatesResponse | null = null;
    let networkMessage = "";
    try {
      response = await api.researchUpdates(req, controller.signal);
    } catch (err) {
      networkMessage = err instanceof Error ? err.message : "Network error";
    }
    if (researchAbort.current !== controller) return;
    researchAbort.current = null;

    if (response && response.ok) {
      dispatch({
        type: "SET_RESEARCH_STATE",
        state: {
          kind: "success",
          research: response.research,
          providerMetadata: response.providerMetadata,
          warnings: response.warnings,
        },
      });
      dispatch({ type: "SET_RESEARCH", research: response.research });
      return;
    }
    if (response) {
      dispatch({
        type: "SET_RESEARCH_STATE",
        state: {
          kind: "error",
          code: response.code,
          message: response.message,
        },
      });
      return;
    }
    dispatch({
      type: "SET_RESEARCH_STATE",
      state: {
        kind: "error",
        code: "provider_error",
        message: networkMessage || "Network error",
      },
    });
  }, [
    state.dna,
    state.extraction,
    state.initialFile,
    state.detection,
    state.periodOverride,
  ]);

  const runOrchestratedGeneration = useCallback(
    async (
      withResearch: boolean,
      mode: "fresh" | "resume",
    ): Promise<void> => {
      if (!state.dna || !state.extraction || !state.initialFile) return;
      const companyName =
        state.periodOverride.detectedCompany ??
        state.detection?.detectedCompany ??
        state.initialFile.filename.replace(/\.[^.]+$/, "");
      const periodLabel =
        state.periodOverride.periodLabel ??
        (state.detection?.best ? renderPeriodLabel(state.detection.best) : "");
      const research = withResearch ? state.research : null;

      const failedId =
        mode === "resume" ? state.progress.failedSectionId : undefined;
      const resumeFromIdx =
        mode === "resume" && failedId
          ? Math.max(0, CANONICAL_SECTION_IDS.indexOf(failedId))
          : 0;
      const existingSections =
        mode === "resume" ? state.completedSections : {};

      generateAbort.current?.abort();
      const controller = new AbortController();
      generateAbort.current = controller;
      dispatch({
        type: "START_GENERATION",
        startedAt: new Date().toISOString(),
        resumeFromIdx,
      });
      dispatch({ type: "SET_LLM_STATE", state: { kind: "loading" } });

      const result = await runSectionGeneration({
        project: {
          id: state.dna.projectId,
          ticker: companyName,
          companyName,
        },
        dna: state.dna,
        detection: periodLabel
          ? {
              detectedCompany: companyName,
              periodLabel,
              researchStart: state.periodOverride.researchStart,
              researchCurrent:
                state.detection?.researchCurrent ??
                new Date().toISOString().slice(0, 7),
              assumptionNotes: state.detection?.assumptionNotes ?? [],
            }
          : undefined,
        research,
        initialMemoId: state.initialFile.id,
        apiCall: (req, signal) => api.generateMemoSection(req, signal),
        signal: controller.signal,
        onSectionStart: (sectionId, attempt) => {
          dispatch({ type: "SECTION_STARTED", sectionId, attempt });
        },
        onSectionDone: (sectionId, section) => {
          dispatch({ type: "SECTION_SUCCESS", sectionId, section });
        },
        onSectionFail: () => {
          // SECTION_FAILED dispatch happens after the result resolves so we
          // can also set the LLM error state in lockstep.
        },
        startFromSectionId: failedId,
        existingSections,
      });

      if (generateAbort.current !== controller) return;
      generateAbort.current = null;

      if (result.ok) {
        dispatch({ type: "SET_GENERATED_MEMO", memo: result.memo });
        dispatch({
          type: "SET_LLM_STATE",
          state: {
            kind: "success",
            memo: result.memo,
            providerMetadata: {
              providerName: "openai",
              modelUsed: "gpt-section",
            },
            usedFallback: false,
            warnings: [],
          },
        });
        return;
      }

      if (result.code === "aborted") {
        return;
      }

      if (result.failedSectionId) {
        dispatch({
          type: "SECTION_FAILED",
          sectionId: result.failedSectionId,
          code: result.code,
          message: result.message,
        });
      }
      dispatch({
        type: "SET_LLM_STATE",
        state: {
          kind: "error",
          error: `${result.code} · ${result.message}`,
        },
      });
    },
    [
      state.dna,
      state.extraction,
      state.initialFile,
      state.research,
      state.detection,
      state.periodOverride,
      state.progress.failedSectionId,
      state.completedSections,
    ],
  );

  const generateMemo = useCallback(
    (withResearch: boolean): Promise<void> => {
      dispatch({ type: "RESET_PROGRESS" });
      return runOrchestratedGeneration(withResearch, "fresh");
    },
    [runOrchestratedGeneration],
  );

  const retryFailedSection = useCallback(
    (): Promise<void> =>
      runOrchestratedGeneration(Boolean(state.research), "resume"),
    [runOrchestratedGeneration, state.research],
  );

  const retryFullMemo = useCallback((): Promise<void> => {
    dispatch({ type: "RESET_PROGRESS" });
    return runOrchestratedGeneration(Boolean(state.research), "fresh");
  }, [runOrchestratedGeneration, state.research]);

  const startOver = useCallback(() => {
    researchAbort.current?.abort();
    generateAbort.current?.abort();
    researchAbort.current = null;
    generateAbort.current = null;
    dispatch({ type: "RESET" });
  }, []);

  const value = useMemo<MemoProjectContextValue>(() => {
    const effectiveDetection = state.detection
      ? {
          detectedCompany:
            state.periodOverride.detectedCompany ??
            state.detection.detectedCompany ??
            "",
          periodLabel:
            state.periodOverride.periodLabel ??
            (state.detection.best
              ? renderPeriodLabel(state.detection.best)
              : ""),
          researchStart: state.periodOverride.researchStart,
          researchCurrent: state.detection.researchCurrent,
          assumptionNotes: state.detection.assumptionNotes,
        }
      : null;

    return {
      state,
      effectiveDetection,
      extractInitialMemo,
      setPeriodOverride,
      runResearch,
      generateMemo,
      retryFailedSection,
      retryFullMemo,
      refreshLlmProviderStatus,
      syncGateTokenSet,
      startOver,
    };
  }, [
    state,
    extractInitialMemo,
    setPeriodOverride,
    runResearch,
    generateMemo,
    retryFailedSection,
    retryFullMemo,
    refreshLlmProviderStatus,
    syncGateTokenSet,
    startOver,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemoProject(): MemoProjectContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useMemoProject must be used inside <MemoProjectProvider>");
  }
  return ctx;
}

function renderPeriodLabel(p: {
  kind: string;
  isoDate?: string;
  isoMonth?: string;
  monthLabel?: string;
  quarter?: string;
  fiscalYearLabel?: string;
  rawMatch: string;
}): string {
  switch (p.kind) {
    case "iso_date":
      return p.isoDate ?? p.rawMatch;
    case "month_year":
      return p.monthLabel ?? p.isoMonth ?? p.rawMatch;
    case "quarter_fy":
      return `${p.quarter ?? ""} ${p.fiscalYearLabel ?? ""}`.trim();
    case "fiscal_year":
      return p.fiscalYearLabel ?? p.rawMatch;
    default:
      return p.rawMatch;
  }
}
