import type { FollowUpMemo } from "@shared/types";

// Client-side library of generated follow-up memos. Persisted in
// localStorage (per browser) so the analyst can close the dashboard and come
// back to everything they've produced. There is no server-side user identity
// in this app, so per-browser local persistence is the correct scope — it
// survives reloads without leaking one user's memos to another.

export interface SavedMemoCompany {
  ticker: string;
  companyName: string;
}

export interface SavedMemo {
  id: string;
  savedAt: string;
  company: SavedMemoCompany | null;
  researchWindowLabel?: string;
  generationType: "openai" | "demo";
  memo: FollowUpMemo;
}

const STORAGE_KEY = "memo.library.v1";
const MAX_ENTRIES = 50;
const CHANGE_EVENT = "memo:library-changed";

// One saved entry per (memo project, company). Re-generating the same memo
// updates that entry instead of piling up duplicates; a different file or
// company is a distinct entry. Kept URL-safe so it can be a route param.
function identityFor(
  projectId: string,
  company: SavedMemoCompany | null,
): string {
  const ticker = (company?.ticker ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return `${projectId}__${ticker || "na"}`;
}

function read(): SavedMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedMemo[]) : [];
  } catch {
    return [];
  }
}

function write(list: SavedMemo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
    // Notify same-tab listeners (the storage event only fires in OTHER tabs).
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage unavailable or over quota — fail silently; the in-memo project
    // still works, the library just won't persist this entry.
  }
}

// Newest first.
export function loadSavedMemos(): SavedMemo[] {
  return read().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function getSavedMemo(id: string): SavedMemo | null {
  return read().find((m) => m.id === id) ?? null;
}

export interface SaveMemoInput {
  memo: FollowUpMemo;
  company: SavedMemoCompany | null;
  researchWindowLabel?: string;
  generationType: "openai" | "demo";
}

export function saveMemo(input: SaveMemoInput): SavedMemo {
  const list = read();
  const id = identityFor(input.memo.projectId, input.company);
  const existingIdx = list.findIndex((m) => m.id === id);
  const record: SavedMemo = {
    id,
    savedAt: new Date().toISOString(),
    company: input.company,
    researchWindowLabel: input.researchWindowLabel,
    generationType: input.generationType,
    memo: input.memo,
  };
  if (existingIdx >= 0) {
    list[existingIdx] = record;
  } else {
    list.unshift(record);
  }
  write(list);
  return record;
}

export function deleteSavedMemo(id: string): void {
  write(read().filter((m) => m.id !== id));
}

// Subscribe to library changes from this tab (custom event) and other tabs
// (the native storage event). Returns an unsubscribe function.
export function subscribeSavedMemos(callback: () => void): () => void {
  const handler = (): void => callback();
  const storageHandler = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
