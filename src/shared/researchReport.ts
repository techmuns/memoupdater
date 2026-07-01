import type { ResearchReportSectionId } from "./types";

// Section order + human titles for the comprehensive research report. Shared
// between the worker (authoritative titles on the stored report) and the
// client (progress rail + report viewer).

export const RESEARCH_REPORT_SECTION_ORDER: readonly ResearchReportSectionId[] = [
  "stock_valuation",
  "executive_update",
  "shareholding",
  "industry_regulatory",
  "corporate_events",
  "management_governance",
  "concall",
  "memo_vs_actual",
  "updated_view",
];

export const RESEARCH_REPORT_SECTION_TITLES: Record<
  ResearchReportSectionId,
  string
> = {
  stock_valuation: "Stock Performance & Valuation Evolution",
  executive_update: "Executive Update — Top 3 Changes",
  shareholding: "Shareholding & Ownership Changes",
  industry_regulatory: "Industry & Regulatory Developments",
  corporate_events: "Top Corporate Events (Last 12 Months)",
  management_governance: "Management, Board & Governance Review",
  concall: "Latest Earnings Call Review",
  memo_vs_actual: "Memo Financials vs Actual + Variance",
  updated_view: "Updated Investment View",
};
