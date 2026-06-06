export type MemoProjectStatus = "demo" | "draft" | "active" | "archived";

export type DocumentKind =
  | "initial_memo"
  | "financials"
  | "management_commentary"
  | "broker_notes"
  | "competitor_notes"
  | "macro_notes"
  | "market_data";

export interface UploadedDocument {
  id: string;
  projectId: string;
  kind: DocumentKind;
  filename: string;
  sizeBytes: number;
  isDemo: boolean;
  uploadedAt: string;
}

export interface MemoProject {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  status: MemoProjectStatus;
  createdAt: string;
  updatedAt: string;
  uploads: UploadedDocument[];
}

export interface SourceReference {
  documentId: string;
  page?: number;
  quote?: string;
}

export interface ThesisCheckpoint {
  id: string;
  label: string;
  expectedDirection: "up" | "down" | "flat";
  rationale: string;
  sources: SourceReference[];
}

export interface MemoDNA {
  projectId: string;
  originalThesis: string;
  keyAssumptions: string[];
  styleTone: {
    adjectives: string[];
    sampleSentences: string[];
  };
  analyticalFramework: string[];
  valuationFramework: {
    method: string;
    targetMultiple: string;
    bridgeNotes: string[];
  };
  openQuestions: string[];
  riskChecklist: {
    category: string;
    risks: string[];
  }[];
  thesisCheckpoints: ThesisCheckpoint[];
  isDemo: boolean;
}

export interface UpdatePack {
  projectId: string;
  financials?: UploadedDocument;
  commentary?: UploadedDocument;
  brokerNotes?: UploadedDocument[];
  competitorNotes?: UploadedDocument[];
  macroNotes?: UploadedDocument[];
  marketData?: UploadedDocument[];
}

export interface MemoSection {
  id: string;
  title: string;
  body: string;
  sources: SourceReference[];
}

export interface FollowUpMemo {
  projectId: string;
  title: string;
  generatedAt: string;
  sections: MemoSection[];
  isDemo: boolean;
}

export type GenerationStepStatus = "not_started" | "ready" | "demo_generated";

export interface GenerationStep {
  id: string;
  label: string;
  description: string;
  status: GenerationStepStatus;
}

export type GenerationRunStatus =
  | "not_started"
  | "ready"
  | "demo_generated"
  | "running"
  | "complete"
  | "failed";

export interface GenerationRun {
  id: string;
  projectId: string;
  status: GenerationRunStatus;
  steps: GenerationStep[];
  startedAt?: string;
  completedAt?: string;
}

export interface HealthResponse {
  status: "ok";
  phase: "1-demo";
  timestamp: string;
}

// ---------- Phase 2 additions ----------

export type MemoAnalysisMode = "demo" | "extracted";

export type ExtractionStatus =
  | "idle"
  | "extracting"
  | "success"
  | "partial"
  | "unsupported"
  | "error";

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string;
  characterCount: number;
  wordCount: number;
  pageCount?: number;
  warnings: string[];
  errorMessage?: string;
  source: {
    filename: string;
    sizeBytes: number;
    mime: string;
    extension: string;
  };
  extractedAt: string;
}

export interface LocalUploadedFile {
  id: string;
  kind: DocumentKind;
  filename: string;
  sizeBytes: number;
  mime: string;
  extension: string;
  uploadedAt: string;
  extractionSupported: boolean;
}

export interface KeywordSignal {
  phrase: string;
  category: string;
  weight: number;
  hits: number;
}

export interface StyleSignal {
  avgSentenceLength: number;
  firstPersonRatio: number;
  hedgeRatio: number;
  bulletDensity: number;
  numericalDensity: number;
}
