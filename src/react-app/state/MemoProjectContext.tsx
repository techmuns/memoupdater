import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  DocumentKind,
  ExtractionResult,
  ExtractionStatus,
  FollowUpMemo,
  LocalUploadedFile,
  MemoAnalysisMode,
  MemoDNA,
} from "@shared/types";
import { api } from "../lib/api";
import { extractText } from "../lib/extract";
import { extractionSupported, getExtension, mimeForFile } from "../lib/fileMeta";
import { buildMemoDnaFromText } from "../lib/memoDna";

interface State {
  uploads: Partial<Record<DocumentKind, LocalUploadedFile>>;
  extraction: ExtractionResult | null;
  extractionStatus: ExtractionStatus;
  extractedDna: MemoDNA | null;
  demoDna: MemoDNA | null;
  demoFollowUpMemo: FollowUpMemo | null;
  mode: MemoAnalysisMode;
}

type Action =
  | { type: "SET_UPLOAD"; kind: DocumentKind; file: LocalUploadedFile }
  | { type: "REMOVE_UPLOAD"; kind: DocumentKind }
  | { type: "SET_EXTRACTION_STATUS"; status: ExtractionStatus }
  | { type: "SET_EXTRACTION"; result: ExtractionResult }
  | { type: "SET_EXTRACTED_DNA"; dna: MemoDNA }
  | { type: "SET_DEMO_DNA"; dna: MemoDNA }
  | { type: "SET_DEMO_FOLLOW_UP"; memo: FollowUpMemo }
  | { type: "SET_MODE"; mode: MemoAnalysisMode }
  | { type: "RESET_EXTRACTED" };

const initialState: State = {
  uploads: {},
  extraction: null,
  extractionStatus: "idle",
  extractedDna: null,
  demoDna: null,
  demoFollowUpMemo: null,
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
      const next = { ...state.uploads };
      delete next[action.kind];
      return { ...state, uploads: next };
    }
    case "SET_EXTRACTION_STATUS":
      return { ...state, extractionStatus: action.status };
    case "SET_EXTRACTION":
      return {
        ...state,
        extraction: action.result,
        extractionStatus: action.result.status,
      };
    case "SET_EXTRACTED_DNA":
      return { ...state, extractedDna: action.dna, mode: "extracted" };
    case "SET_DEMO_DNA":
      return { ...state, demoDna: action.dna };
    case "SET_DEMO_FOLLOW_UP":
      return { ...state, demoFollowUpMemo: action.memo };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "RESET_EXTRACTED": {
      const next = { ...state.uploads };
      delete next.initial_memo;
      return {
        ...state,
        uploads: next,
        extraction: null,
        extractionStatus: "idle",
        extractedDna: null,
        mode: "demo",
      };
    }
  }
}

interface MemoProjectContextValue {
  state: State;
  currentDna: MemoDNA | null;
  currentMode: MemoAnalysisMode;
  setUpload: (kind: DocumentKind, file: File) => LocalUploadedFile;
  removeUpload: (kind: DocumentKind) => void;
  extractInitialMemo: (file: File) => Promise<ExtractionResult>;
  buildDnaFromCurrentExtraction: () => MemoDNA | null;
  setMode: (mode: MemoAnalysisMode) => void;
  resetExtracted: () => void;
}

const Ctx = createContext<MemoProjectContextValue | null>(null);

export function MemoProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load demo DNA + follow-up once on mount
  useEffect(() => {
    api
      .demoMemoDna()
      .then((dna) => dispatch({ type: "SET_DEMO_DNA", dna }))
      .catch(() => {});
    api
      .demoFollowUpMemo()
      .then((memo) => dispatch({ type: "SET_DEMO_FOLLOW_UP", memo }))
      .catch(() => {});
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

  const buildDnaFromCurrentExtraction = useCallback((): MemoDNA | null => {
    const e = state.extraction;
    if (!e || (e.status !== "success" && e.status !== "partial")) return null;
    const dna = buildMemoDnaFromText({ text: e.text, filename: e.source.filename });
    dispatch({ type: "SET_EXTRACTED_DNA", dna });
    return dna;
  }, [state.extraction]);

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
    return {
      state,
      currentDna,
      currentMode: state.mode,
      setUpload,
      removeUpload,
      extractInitialMemo,
      buildDnaFromCurrentExtraction,
      setMode,
      resetExtracted,
    };
  }, [
    state,
    setUpload,
    removeUpload,
    extractInitialMemo,
    buildDnaFromCurrentExtraction,
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
