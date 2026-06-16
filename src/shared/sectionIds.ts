// Phase 6H: SINGLE SOURCE OF TRUTH for the follow-up memo's canonical
// section ids, titles, and prefix helpers.
//
// This module is imported by BOTH bundles:
//   - the Cloudflare Worker (schema, request validation, prompts, parse)
//   - the React client (orchestration, rendering, fallback, demo)
//
// Before this consolidation the id list was copy-pasted into 11 files.
// When the Phase 6B restructure renamed the sections, a stale browser
// bundle kept POSTing the OLD ids to a NEW worker, which rejected them
// with HTTP 400 ("sectionId is not a canonical section id") — surfaced
// to the user as an opaque "provider_error · 400". One list, imported
// everywhere, makes that drift impossible to introduce.

export const CORE_MEMO_SECTION_PREFIX = "sec_";
export const SUPPLEMENTARY_PANEL_PREFIX = "sup_";

// Core memo sections — rendered in the printed <3-page memo body.
export const CORE_SECTION_IDS = [
  "sec_thesis_scorecard",
  "sec_what_changed",
  "sec_shareholding",
  "sec_industry_regulatory",
  "sec_corporate_events",
  "sec_investment_action",
] as const;

// Supplementary panels — collapsible drawers rendered BELOW the memo.
export const SUPPLEMENTARY_PANEL_IDS = [
  "sup_valuation_detail",
  "sup_eps_bridge",
  "sup_financials_actuals",
] as const;

// All nine canonical ids, in generation + render order.
export const CANONICAL_SECTION_IDS = [
  ...CORE_SECTION_IDS,
  ...SUPPLEMENTARY_PANEL_IDS,
] as const;

export type CanonicalSectionId = (typeof CANONICAL_SECTION_IDS)[number];

export const CANONICAL_SECTION_TITLES: Record<CanonicalSectionId, string> = {
  sec_thesis_scorecard: "Memo vs Reality Scorecard",
  sec_what_changed: "What Changed — Industry · Company · Financials",
  sec_shareholding: "Shareholding & Ownership Changes",
  sec_industry_regulatory: "Industry & Regulatory Developments",
  sec_corporate_events: "Corporate Events, Management & Governance",
  sec_investment_action: "Updated Investment View",
  sup_valuation_detail: "Valuation Detail · Then vs Now",
  sup_eps_bridge: "EPS Credibility Bridge",
  sup_financials_actuals: "Memo Forecasts vs Reported Financials",
};

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_SECTION_IDS);

export function isCanonicalSectionId(id: unknown): id is CanonicalSectionId {
  return typeof id === "string" && CANONICAL_SET.has(id);
}

export function isCoreSectionId(id: string): boolean {
  return id.startsWith(CORE_MEMO_SECTION_PREFIX);
}

export function isSupplementaryPanelId(id: string): boolean {
  return id.startsWith(SUPPLEMENTARY_PANEL_PREFIX);
}
