import type {
  FollowUpMemo,
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoResponse,
  HealthResponse,
  LlmStatusResponse,
  MemoDNA,
  MemoProject,
} from "@shared/types";

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${res.statusText}`);
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
    throw new Error(`${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<TResponse>;
}

export const api = {
  health: () => getJson<HealthResponse>("/api/health"),
  demoProject: () => getJson<MemoProject>("/api/demo/project"),
  demoMemoDna: () => getJson<MemoDNA>("/api/demo/memo-dna"),
  demoFollowUpMemo: () => getJson<FollowUpMemo>("/api/demo/follow-up-memo"),
  llmStatus: () => getJson<LlmStatusResponse>("/api/llm/status"),
  generateFollowUpMemo: (
    req: GenerateFollowUpMemoRequest,
    signal?: AbortSignal,
    gateToken?: string,
  ) =>
    postJson<GenerateFollowUpMemoResponse, GenerateFollowUpMemoRequest>(
      "/api/generate/follow-up-memo",
      req,
      {
        signal,
        headers: gateToken ? { "X-Memo-LLM-Gate": gateToken } : undefined,
      },
    ),
};
