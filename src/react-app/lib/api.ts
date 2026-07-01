import type {
  FollowUpMemo,
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoResponse,
  GenerateMemoSectionRequest,
  GenerateMemoSectionResponse,
  GeneratePrioritiesAnswerRequest,
  GeneratePrioritiesAnswerResponse,
  HealthResponse,
  LlmStatusResponse,
  MemoDNA,
  MemoProject,
  MemoUnderstandRequest,
  MemoUnderstandResponse,
  ResearchPassRequest,
  ResearchPassResponse,
  ReportAskRequest,
  ReportAskResponse,
  ResearchReportSectionRequest,
  ResearchReportSectionResponse,
  ResearchUpdatesRequest,
  ResearchUpdatesResponse,
  StockQuoteRequest,
  StockQuoteResponse,
  StockSearchRequest,
  StockSearchResponse,
  VersionResponse,
} from "@shared/types";
import { getLlmGateToken } from "./llmGateToken";

// Phase 6H: a typed API error that PRESERVES the worker's response body.
// The worker returns actionable detail on a 4xx (e.g.
// `{ error: "invalid_request", message: "stale_client: sectionId is not
// a canonical section id: sec_thesis_snapshot" }`). The old code threw
// away the body and surfaced only "→ 400", so a stale-bundle bug looked
// identical to a real backend failure. `staleClient` flags the specific
// case so the UI can prompt a reload.
export class ApiError extends Error {
  readonly status: number;
  readonly serverError?: string;
  readonly serverMessage?: string;
  readonly staleClient: boolean;
  constructor(args: {
    path: string;
    status: number;
    statusText: string;
    serverError?: string;
    serverMessage?: string;
  }) {
    const detail = args.serverMessage || args.serverError || args.statusText;
    super(`${args.path} → ${args.status} ${detail}`);
    this.name = "ApiError";
    this.status = args.status;
    this.serverError = args.serverError;
    this.serverMessage = args.serverMessage;
    this.staleClient =
      typeof args.serverMessage === "string" &&
      args.serverMessage.includes("stale_client");
  }
}

async function readErrorBody(
  res: Response,
): Promise<{ error?: string; message?: string }> {
  try {
    const data = (await res.json()) as { error?: unknown; message?: unknown };
    return {
      error: typeof data.error === "string" ? data.error : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
    };
  } catch {
    return {};
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError({
      path,
      status: res.status,
      statusText: res.statusText,
      serverError: body.error,
      serverMessage: body.message,
    });
  }
  return res.json() as Promise<T>;
}

async function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
  init?: RequestInit,
): Promise<TResponse> {
  const res = await fetch(path, {
    ...init,
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new ApiError({
      path,
      status: res.status,
      statusText: res.statusText,
      serverError: errBody.error,
      serverMessage: errBody.message,
    });
  }
  return res.json() as Promise<TResponse>;
}

// Generic JSON request for verbs other than GET/POST (PUT, DELETE). Body is
// omitted entirely when undefined so DELETE requests don't send one.
async function requestJson<T>(
  method: "PUT" | "DELETE",
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await readErrorBody(res);
    throw new ApiError({
      path,
      status: res.status,
      statusText: res.statusText,
      serverError: errBody.error,
      serverMessage: errBody.message,
    });
  }
  return res.json() as Promise<T>;
}

function userHeader(userId: string): Record<string, string> {
  return { "X-Munshot-User": userId };
}

// Attach the X-Memo-LLM-Gate header only when a non-empty token is set in
// session storage (Settings → Advanced). When the gate is off, the worker
// ignores the missing header; when the gate is on and the header is
// missing, the worker returns {ok:false, code:"llm_access_denied"} which
// the workspace surfaces as a "Setup required" panel.
function gateHeader(): Record<string, string> {
  const token = getLlmGateToken();
  return token && token.length > 0 ? { "X-Memo-LLM-Gate": token } : {};
}

export const api = {
  health: () => getJson<HealthResponse>("/api/health"),
  version: () => getJson<VersionResponse>("/api/version"),
  demoProject: () => getJson<MemoProject>("/api/demo/project"),
  demoMemoDna: () => getJson<MemoDNA>("/api/demo/memo-dna"),
  demoFollowUpMemo: () => getJson<FollowUpMemo>("/api/demo/follow-up-memo"),
  llmStatus: () => getJson<LlmStatusResponse>("/api/llm/status"),
  generateFollowUpMemo: (
    req: GenerateFollowUpMemoRequest,
    signal?: AbortSignal,
  ) =>
    postJson<GenerateFollowUpMemoResponse, GenerateFollowUpMemoRequest>(
      "/api/generate/follow-up-memo",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  generateMemoSection: (
    req: GenerateMemoSectionRequest,
    signal?: AbortSignal,
  ) =>
    postJson<GenerateMemoSectionResponse, GenerateMemoSectionRequest>(
      "/api/generate/memo-section",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  // Dashboard-only Q&A — see worker/priorities/route.ts. The result lives
  // ONLY on the dashboard; the downloadable PDF is unaffected.
  generatePrioritiesAnswer: (
    req: GeneratePrioritiesAnswerRequest,
    signal?: AbortSignal,
  ) =>
    postJson<GeneratePrioritiesAnswerResponse, GeneratePrioritiesAnswerRequest>(
      "/api/generate/priorities-answer",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  researchUpdates: (
    req: ResearchUpdatesRequest,
    signal?: AbortSignal,
  ) =>
    postJson<ResearchUpdatesResponse, ResearchUpdatesRequest>(
      "/api/research/updates",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  researchPass: (
    req: ResearchPassRequest,
    signal?: AbortSignal,
  ) =>
    postJson<ResearchPassResponse, ResearchPassRequest>(
      "/api/research/pass",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  // Comprehensive research report — one web-grounded section per call.
  researchReportSection: (
    req: ResearchReportSectionRequest,
    signal?: AbortSignal,
  ) =>
    postJson<ResearchReportSectionResponse, ResearchReportSectionRequest>(
      "/api/research/report-section",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  // Stage 3: ask a follow-up question, answered from the stored report.
  reportAsk: (req: ReportAskRequest, signal?: AbortSignal) =>
    postJson<ReportAskResponse, ReportAskRequest>("/api/report/ask", req, {
      signal,
      headers: gateHeader(),
    }),
  memoUnderstand: (
    req: MemoUnderstandRequest,
    signal?: AbortSignal,
  ) =>
    postJson<MemoUnderstandResponse, MemoUnderstandRequest>(
      "/api/memo/understand",
      req,
      {
        signal,
        headers: gateHeader(),
      },
    ),
  // Company picker. The bearer token lives in the Worker — the browser only
  // sends the free-text query and receives normalized rows back.
  stockSearch: (
    req: StockSearchRequest,
    signal?: AbortSignal,
  ) =>
    postJson<StockSearchResponse, StockSearchRequest>(
      "/api/stock/search",
      req,
      { signal },
    ),
  // Live price for the selected company. The Worker scrapes Google Finance /
  // Yahoo Finance / Screener server-side so the LLM doesn't have to (and
  // can't fabricate a stale snippet).
  stockQuote: (
    req: StockQuoteRequest,
    signal?: AbortSignal,
  ) =>
    postJson<StockQuoteResponse, StockQuoteRequest>(
      "/api/stock/quote",
      req,
      { signal },
    ),

  // Cross-device saved-memo library. The user identity travels in the
  // X-Munshot-User header (the host iframe's user id). When the server's KV
  // binding is absent these return { synced: false } and the client stays
  // local-only. Memos are passed as opaque records to avoid a type cycle with
  // lib/savedMemos; lib/memoSync casts them back to SavedMemo.
  memosList: (userId: string) =>
    getJson<{ synced: boolean; memos: unknown[] }>("/api/memos", {
      headers: userHeader(userId),
    }),
  memoPut: (userId: string, id: string, memo: unknown) =>
    requestJson<{ synced: boolean }>(
      "PUT",
      `/api/memos/${encodeURIComponent(id)}`,
      memo,
      { headers: userHeader(userId) },
    ),
  memoDelete: (userId: string, id: string) =>
    requestJson<{ synced: boolean }>(
      "DELETE",
      `/api/memos/${encodeURIComponent(id)}`,
      undefined,
      { headers: userHeader(userId) },
    ),
};
