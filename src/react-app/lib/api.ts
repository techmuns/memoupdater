import type {
  FollowUpMemo,
  HealthResponse,
  MemoDNA,
  MemoProject,
} from "@shared/types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJson<HealthResponse>("/api/health"),
  demoProject: () => getJson<MemoProject>("/api/demo/project"),
  demoMemoDna: () => getJson<MemoDNA>("/api/demo/memo-dna"),
  demoFollowUpMemo: () => getJson<FollowUpMemo>("/api/demo/follow-up-memo"),
};
