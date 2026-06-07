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
  DocumentKind,
  ExtractionResult,
  ExtractionStatus,
  FollowUpMemo,
  FollowUpMemoGenerationResult,
  GeneratedMemoStatus,
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoResponse,
  GenerateFollowUpMemoUpdateDoc,
  LlmGenerationState,
  LlmGenerationWarning,
  LlmStatusResponse,
  LocalUploadedFile,
  MemoAnalysisMode,
  MemoDNA,
} from "@shared/types";
import { api } from "../lib/api";
import { extractText } from "../lib/extract";
import { extractionSupported, getExtension, mimeForFile } from "../lib/fileMeta";
import { buildMemoDnaFromText } from "../lib/memoDna";
import { analyzeUpdatePack } from "../lib/updateAnalysis";
import { generateFollowUpMemo } from "../lib/followUpMemo";

interface State {
  uploads: Partial<Record<DocumentKind, LocalUploadedFile>>;
  extraction: ExtractionResult | null;
  extractionStatus: ExtractionStatus;
  updateExtractions: Partial<Record<DocumentKind, ExtractionResult>>;
  updateExtractionStatuses: Partial<Record<DocumentKind, ExtractionStatus>>;
  extractedDna: MemoDNA | null;
  demoDna: MemoDNA | null;
  demoFollowUpMemo: FollowUpMemo | null;
  generatedMemo: FollowUpMemo | null;
  generationError: string | null;
  llm: LlmGenerationState;
  llmProviderStatus: LlmStatusResponse | null;
  mode: MemoAnalysisMode;
}

type Action =
  | { type: "SET_UPLOAD"; kind: DocumentKind; file: LocalUploadedFile }
  | { type: "REMOVE_UPLOAD"; kind: DocumentKind }
  | { type: "SET_EXTRACTION_STATUS"; status: ExtractionStatus }
  | { type: "SET_EXTRACTION"; result: ExtractionResult }
  | {
      type: "SET_UPDATE_EXTRACTION_STATUS";
      kind: DocumentKind;
      status: ExtractionStatus;
    }
  | { type: "SET_UPDATE_EXTRACTION"; kind: DocumentKind; result: ExtractionResult }
  | { type: "SET_EXTRACTED_DNA"; dna: MemoDNA }
  | { type: "SET_DEMO_DNA"; dna: MemoDNA }
  | { type: "SET_DEMO_FOLLOW_UP"; memo: FollowUpMemo }
  | { type: "SET_GENERATED_MEMO"; memo: FollowUpMemo }
  | { type: "CLEAR_GENERATED_MEMO" }
  | { type: "SET_GENERATION_ERROR"; error: string | null }
  | { type: "SET_LLM_STATE"; state: LlmGenerationState }
  | { type: "SET_LLM_PROVIDER_STATUS"; status: LlmStatusResponse | null }
  | { type: "SET_MODE"; mode: MemoAnalysisMode }
  | { type: "RESET_EXTRACTED" };

const initialState: State = {
  uploads: {},
  extraction: null,
  extractionStatus: "idle",
  updateExtractions: {},
  updateExtractionStatuses: {},
  extractedDna: null,
  demoDna: null,
  demoFollowUpMemo: null,
  generatedMemo: null,
  generationError: null,
  llm: { kind: "idle" },
  llmProviderStatus: null,
  mode: "demo",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_UPLOAD":
      return {
        ...state,
        uploads: { ...state.uploads, [action.kind]: action.file },
      };
    case "REMOVE_UPLOAD": {
      const nextUploads = { ...state.uploads };
      delete nextUploads[action.kind];
      const nextExtractions = { ...state.updateExtractions };
      delete nextExtractions[action.kind];
      const nextStatuses = { ...state.updateExtractionStatuses };
      delete nextStatuses[action.kind];
      return {
        ...state,
        uploads: nextUploads,
        updateExtractions: nextExtractions,
        updateExtractionStatuses: nextStatuses,
      };
    }
    case "SET_EXTRACTION_STATUS":
      return { ...state, extractionStatus: action.status };
    case "SET_EXTRACTION":
      return {
        ...state,
        extraction: action.result,
        extractionStatus: action.result.status,
      };
    case "SET_UPDATE_EXTRACTION_STATUS":
      return {
        ...state,
        updateExtractionStatuses: {
          ...state.updateExtractionStatuses,
          [action.kind]: action.status,
        },
      };
    case "SET_UPDATE_EXTRACTION":
      return {
        ...state,
        updateExtractions: {
          ...state.updateExtractions,
          [action.kind]: action.result,
        },
        updateExtractionStatuses: {
          ...state.updateExtractionStatuses,
          [action.kind]: action.result.status,
        },
      };
    case "SET_EXTRACTED_DNA":
      return { ...state, extractedDna: action.dna, mode: "extracted" };
    case "SET_DEMO_DNA":
      return { ...state, demoDna: action.dna };
    case "SET_DEMO_FOLLOW_UP":
      return { ...state, demoFollowUpMemo: action.memo };
    case "SET_GENERATED_MEMO":
      return { ...state, generatedMemo: action.memo, generationError: null };
    case "CLEAR_GENERATED_MEMO":
      return {
        ...state,
        generatedMemo: null,
        generationError: null,
        llm: { kind: "idle" },
      };
    case "SET_GENERATION_ERROR":
      return { ...state, generationError: action.error };
    case "SET_LLM_STATE":
      return { ...state, llm: action.state };
    case "SET_LLM_PROVIDER_STATUS":
      return { ...state, llmProviderStatus: action.status };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "RESET_EXTRACTED":
      return {
        ...state,
        uploads: {},
        extraction: null,
        extractionStatus: "idle",
        updateExtractions: {},
        updateExtractionStatuses: {},
        extractedDna: null,
        generatedMemo: null,
        generationError: null,
        llm: { kind: "idle" },
        mode: "demo",
      };
  }
}

interface MemoProjectContextValue {
  state: State;
  currentDna: MemoDNA | null;
  currentMode: MemoAnalysisMode;
  generationStatus: GeneratedMemoStatus;
  usableUpdateCount: number;
  setUpload: (kind: DocumentKind, file: File) => LocalUploadedFile;
  removeUpload: (kind: DocumentKind) => void;
  extractInitialMemo: (file: File) => Promise<ExtractionResult>;
  extractUpdateDoc: (kind: DocumentKind, file: File) => Promise<ExtractionResult>;
  buildDnaFromCurrentExtraction: () => MemoDNA | null;
  generateFollowUp: () => FollowUpMemoGenerationResult | null;
  generateLlmFollowUp: () => Promise<void>;
  refreshLlmProviderStatus: () => Promise<void>;
  clearGeneratedMemo: () => void;
  setMode: (mode: MemoAnalysisMode) => void;
  resetExtracted: () => void;
}

const Ctx = createContext<MemoProjectContextValue | null>(null);

export function MemoProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const llmAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .demoMemoDna()
      .then((dna) => dispatch({ type: "SET_DEMO_DNA", dna }))
      .catch(() => {});
    api
      .demoFollowUpMemo()
      .then((memo) => dispatch({ type: "SET_DEMO_FOLLOW_UP", memo }))
      .catch(() => {});
    api
      .llmStatus()
      .then((status) =>
        dispatch({ type: "SET_LLM_PROVIDER_STATUS", status }),
      )
      .catch(() =>
        dispatch({ type: "SET_LLM_PROVIDER_STATUS", status: null }),
      );
  }, []);

  const setUpload = useCallback(
    (kind: DocumentKind, file: File): LocalUploadedFile => {
      const ext = getExtension(file.name);
      const local: LocalUploadedFile = {
        id: `local_${kind}_${Date.now()}`,
        kind,
        filename: file.name,
        sizeBytes: file.size,
        mime: mimeForFile(file),
        extension: ext,
        uploadedAt: new Date().toISOString(),
        extractionSupported: extractionSupported(ext),
      };
      dispatch({ type: "SET_UPLOAD", kind, file: local });
      return local;
    },
    [],
  );

  const removeUpload = useCallback((kind: DocumentKind) => {
    dispatch({ type: "REMOVE_UPLOAD", kind });
  }, []);

  const extractInitialMemo = useCallback(
    async (file: File): Promise<ExtractionResult> => {
      setUpload("initial_memo", file);
      dispatch({ type: "SET_EXTRACTION_STATUS", status: "extracting" });
      const result = await extractText(file);
      dispatch({ type: "SET_EXTRACTION", result });
      return result;
    },
    [setUpload],
  );

  const extractUpdateDoc = useCallback(
    async (kind: DocumentKind, file: File): Promise<ExtractionResult> => {
      setUpload(kind, file);
      dispatch({
        type: "SET_UPDATE_EXTRACTION_STATUS",
        kind,
        status: "extracting",
      });
      const result = await extractText(file);
      dispatch({ type: "SET_UPDATE_EXTRACTION", kind, result });
      // A successful re-extract invalidates any previously generated memo.
      dispatch({ type: "CLEAR_GENERATED_MEMO" });
      return result;
    },
    [setUpload],
  );

  const buildDnaFromCurrentExtraction = useCallback((): MemoDNA | null => {
    const e = state.extraction;
    if (!e || (e.status !== "success" && e.status !== "partial")) return null;
    const dna = buildMemoDnaFromText({ text: e.text, filename: e.source.filename });
    dispatch({ type: "SET_EXTRACTED_DNA", dna });
    dispatch({ type: "CLEAR_GENERATED_MEMO" });
    return dna;
  }, [state.extraction]);

  const generateFollowUp = useCallback((): FollowUpMemoGenerationResult | null => {
    const dna =
      state.mode === "extracted" && state.extractedDna
        ? state.extractedDna
        : state.demoDna;
    if (!dna) return null;
    try {
      dispatch({ type: "SET_GENERATION_ERROR", error: null });
      const analysis = analyzeUpdatePack({
        extractions: state.updateExtractions,
        uploads: state.uploads,
      });
      if (analysis.documentsAnalyzed.length === 0) {
        dispatch({
          type: "SET_GENERATION_ERROR",
          error: "No update-pack documents successfully extracted yet.",
        });
        return null;
      }
      const generatedAt = new Date().toISOString();
      const result = generateFollowUpMemo({
        dna,
        analysis,
        uploads: state.uploads,
        generatedAt,
      });
      dispatch({ type: "SET_GENERATED_MEMO", memo: result.memo });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      dispatch({ type: "SET_GENERATION_ERROR", error: msg });
      return null;
    }
  }, [
    state.mode,
    state.extractedDna,
    state.demoDna,
    state.updateExtractions,
    state.uploads,
  ]);

  const refreshLlmProviderStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await api.llmStatus();
      dispatch({ type: "SET_LLM_PROVIDER_STATUS", status });
    } catch {
      dispatch({ type: "SET_LLM_PROVIDER_STATUS", status: null });
    }
  }, []);

  const generateLlmFollowUp = useCallback(async (): Promise<void> => {
    const dna =
      state.mode === "extracted" && state.extractedDna
        ? state.extractedDna
        : state.demoDna;
    if (!dna || !state.extraction) return;
    if (
      state.extraction.status !== "success" &&
      state.extraction.status !== "partial"
    ) {
      return;
    }
    const analysis = analyzeUpdatePack({
      extractions: state.updateExtractions,
      uploads: state.uploads,
    });
    if (analysis.documentsAnalyzed.length === 0) return;

    llmAbortRef.current?.abort();
    const controller = new AbortController();
    llmAbortRef.current = controller;

    dispatch({ type: "SET_LLM_STATE", state: { kind: "loading" } });

    const updateDocs: GenerateFollowUpMemoUpdateDoc[] = (
      Object.keys(state.updateExtractions) as DocumentKind[]
    ).reduce<GenerateFollowUpMemoUpdateDoc[]>((acc, kind) => {
      const ext = state.updateExtractions[kind];
      const upload = state.uploads[kind];
      if (!ext || !upload) return acc;
      if (ext.status !== "success" && ext.status !== "partial") return acc;
      acc.push({
        id: upload.id,
        kind,
        filename: upload.filename,
        text: ext.text,
      });
      return acc;
    }, []);

    const initialUpload = state.uploads.initial_memo;
    const initialFilename = state.extraction.source.filename;
    const initialSizeBytes =
      initialUpload?.sizeBytes ?? state.extraction.source.sizeBytes;

    const projectLabel = dna.projectId;
    const req: GenerateFollowUpMemoRequest = {
      project: {
        id: dna.projectId,
        ticker: projectLabel,
        companyName: projectLabel,
      },
      initialMemo: {
        id: initialUpload?.id,
        text: state.extraction.text,
        sourceFilename: initialFilename,
        sizeBytes: initialSizeBytes,
      },
      updateDocs,
      dna,
      analysis,
    };

    let response: GenerateFollowUpMemoResponse | null = null;
    let networkError = "";
    try {
      response = await api.generateFollowUpMemo(req, controller.signal);
    } catch (err) {
      networkError = err instanceof Error ? err.message : "Network error";
    }

    // Bail if a newer generation superseded us.
    if (llmAbortRef.current !== controller) return;
    llmAbortRef.current = null;

    if (response && response.ok) {
      dispatch({
        type: "SET_LLM_STATE",
        state: {
          kind: "success",
          memo: response.memo,
          providerMetadata: response.providerMetadata,
          usedFallback: false,
          warnings: response.warnings,
        },
      });
      return;
    }

    const warning: LlmGenerationWarning = response
      ? { code: response.code, message: response.message }
      : { code: "llm_error", message: networkError || "Network error" };

    try {
      const generatedAt = new Date().toISOString();
      const fallback = generateFollowUpMemo({
        dna,
        analysis,
        uploads: state.uploads,
        generatedAt,
      });
      dispatch({
        type: "SET_LLM_STATE",
        state: {
          kind: "success",
          memo: fallback.memo,
          providerMetadata: {
            providerName: "none",
            modelUsed: "deterministic-fallback",
          },
          usedFallback: true,
          warnings: [warning],
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Fallback generation failed";
      dispatch({
        type: "SET_LLM_STATE",
        state: { kind: "error", error: msg },
      });
    }
  }, [
    state.mode,
    state.extractedDna,
    state.demoDna,
    state.extraction,
    state.updateExtractions,
    state.uploads,
  ]);

  const clearGeneratedMemo = useCallback(() => {
    dispatch({ type: "CLEAR_GENERATED_MEMO" });
  }, []);

  const setMode = useCallback((mode: MemoAnalysisMode) => {
    dispatch({ type: "SET_MODE", mode });
  }, []);

  const resetExtracted = useCallback(() => {
    dispatch({ type: "RESET_EXTRACTED" });
  }, []);

  const value = useMemo<MemoProjectContextValue>(() => {
    const currentDna =
      state.mode === "extracted" && state.extractedDna
        ? state.extractedDna
        : state.demoDna;

    const usableUpdateCount = (
      Object.keys(state.updateExtractions) as DocumentKind[]
    ).filter((k) => {
      const s = state.updateExtractions[k]?.status;
      return s === "success" || s === "partial";
    }).length;

    const generationStatus: GeneratedMemoStatus = state.generatedMemo
      ? "generated"
      : !state.extractedDna
        ? "missing_initial_memo"
        : usableUpdateCount === 0
          ? "missing_update_pack"
          : "ready";

    return {
      state,
      currentDna,
      currentMode: state.mode,
      generationStatus,
      usableUpdateCount,
      setUpload,
      removeUpload,
      extractInitialMemo,
      extractUpdateDoc,
      buildDnaFromCurrentExtraction,
      generateFollowUp,
      generateLlmFollowUp,
      refreshLlmProviderStatus,
      clearGeneratedMemo,
      setMode,
      resetExtracted,
    };
  }, [
    state,
    setUpload,
    removeUpload,
    extractInitialMemo,
    extractUpdateDoc,
    buildDnaFromCurrentExtraction,
    generateFollowUp,
    generateLlmFollowUp,
    refreshLlmProviderStatus,
    clearGeneratedMemo,
    setMode,
    resetExtracted,
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
