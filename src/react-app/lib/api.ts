import type {
  FollowUpMemo,
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoResponse,
  GenerateMemoSectionRequest,
  GenerateMemoSectionResponse,
  HealthResponse,
  LlmStatusResponse,
  MemoDNA,
  MemoProject,
  MemoUnderstandRequest,
  MemoUnderstandResponse,
  ResearchPassRequest,
  ResearchPassResponse,
  ResearchUpdatesRequest,
  ResearchUpdatesResponse,
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
};
