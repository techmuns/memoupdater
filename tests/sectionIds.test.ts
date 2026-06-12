import { describe, it, expect } from "vitest";
import {
  CANONICAL_SECTION_IDS,
  CORE_SECTION_IDS,
  SUPPLEMENTARY_PANEL_IDS,
  CANONICAL_SECTION_TITLES,
  CORE_MEMO_SECTION_PREFIX,
  SUPPLEMENTARY_PANEL_PREFIX,
  isCanonicalSectionId,
  isCoreSectionId,
  isSupplementaryPanelId,
} from "@shared/sectionIds";

// Phase 6H: these guard the single source of truth. Before consolidation
// the id list lived in 11 files; a rename in one (Phase 6B) left a stale
// client POSTing dead ids → HTTP 400. Now there is one list — these
// assertions keep IT internally consistent, and the cross-bundle imports
// guarantee the worker + client can never disagree.
describe("canonical section ids", () => {
  it("is exactly core ++ supplementary, in order", () => {
    expect(CANONICAL_SECTION_IDS).toEqual([
      ...CORE_SECTION_IDS,
      ...SUPPLEMENTARY_PANEL_IDS,
    ]);
  });

  it("has 6 core + 3 supplementary = 9 total", () => {
    expect(CORE_SECTION_IDS).toHaveLength(6);
    expect(SUPPLEMENTARY_PANEL_IDS).toHaveLength(3);
    expect(CANONICAL_SECTION_IDS).toHaveLength(9);
  });

  it("has no duplicate ids", () => {
    const set = new Set(CANONICAL_SECTION_IDS);
    expect(set.size).toBe(CANONICAL_SECTION_IDS.length);
  });

  it("has a title for every id and no orphan titles", () => {
    for (const id of CANONICAL_SECTION_IDS) {
      expect(CANONICAL_SECTION_TITLES[id]).toBeTruthy();
    }
    expect(Object.keys(CANONICAL_SECTION_TITLES).sort()).toEqual(
      [...CANONICAL_SECTION_IDS].sort(),
    );
  });

  it("core ids use the sec_ prefix, supplementary use sup_", () => {
    for (const id of CORE_SECTION_IDS) {
      expect(id.startsWith(CORE_MEMO_SECTION_PREFIX)).toBe(true);
      expect(isCoreSectionId(id)).toBe(true);
      expect(isSupplementaryPanelId(id)).toBe(false);
    }
    for (const id of SUPPLEMENTARY_PANEL_IDS) {
      expect(id.startsWith(SUPPLEMENTARY_PANEL_PREFIX)).toBe(true);
      expect(isSupplementaryPanelId(id)).toBe(true);
      expect(isCoreSectionId(id)).toBe(false);
    }
  });

  it("isCanonicalSectionId accepts canonical ids, rejects stale ones", () => {
    for (const id of CANONICAL_SECTION_IDS) {
      expect(isCanonicalSectionId(id)).toBe(true);
    }
    // Phase 5 ids that a stale bundle might still POST.
    for (const stale of [
      "sec_thesis_snapshot",
      "sec_q4_retest",
      "sec_final_action",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isCanonicalSectionId(stale)).toBe(false);
    }
  });
});
