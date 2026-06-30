import { beforeEach, describe, expect, it } from "vitest";
import type { FollowUpMemo } from "@shared/types";
import {
  deleteSavedMemo,
  getSavedMemo,
  loadSavedMemos,
  saveMemo,
} from "@/lib/savedMemos";

// The library module reads/writes localStorage and dispatches DOM events. The
// vitest env is "node", so shim both with minimal in-memory stand-ins before
// the tests run (functions reference these at call time, not import time).
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
  (globalThis as { window?: unknown }).window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
});

function memo(projectId: string, generatedAt: string): FollowUpMemo {
  return {
    projectId,
    title: `Memo ${projectId}`,
    generatedAt,
    sections: [
      { id: "sec_thesis", title: "Thesis", body: "…", sources: [] },
    ],
    isDemo: false,
  };
}

const RATEGAIN = { ticker: "RATEGAIN", companyName: "RateGain Travel" };
const HAVELLS = { ticker: "HAVELLS", companyName: "Havells India" };

describe("savedMemos library", () => {
  it("saves a memo and reads it back by id", () => {
    const rec = saveMemo({
      memo: memo("proj_a", "2026-01-01T00:00:00Z"),
      company: RATEGAIN,
      generationType: "openai",
    });
    expect(getSavedMemo(rec.id)?.company?.ticker).toBe("RATEGAIN");
    expect(loadSavedMemos()).toHaveLength(1);
  });

  it("dedupes by project + company (re-generation updates, not duplicates)", () => {
    saveMemo({
      memo: memo("proj_a", "2026-01-01T00:00:00Z"),
      company: RATEGAIN,
      generationType: "openai",
    });
    const updated = saveMemo({
      memo: memo("proj_a", "2026-02-01T00:00:00Z"),
      company: RATEGAIN,
      generationType: "openai",
    });
    const all = loadSavedMemos();
    expect(all).toHaveLength(1);
    expect(getSavedMemo(updated.id)?.memo.generatedAt).toBe(
      "2026-02-01T00:00:00Z",
    );
  });

  it("keeps distinct entries for different companies / projects", () => {
    saveMemo({ memo: memo("proj_a", "2026-01-01T00:00:00Z"), company: RATEGAIN, generationType: "openai" });
    saveMemo({ memo: memo("proj_b", "2026-01-02T00:00:00Z"), company: HAVELLS, generationType: "openai" });
    expect(loadSavedMemos()).toHaveLength(2);
  });

  it("deletes by id", () => {
    const rec = saveMemo({ memo: memo("proj_a", "2026-01-01T00:00:00Z"), company: RATEGAIN, generationType: "openai" });
    deleteSavedMemo(rec.id);
    expect(loadSavedMemos()).toHaveLength(0);
    expect(getSavedMemo(rec.id)).toBeNull();
  });
});
