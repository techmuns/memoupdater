import type { ResearchFinding } from "@shared/types";
import { RESEARCH_FINDING_ARRAY_SCHEMA } from "./passSchema";

// Strict OpenAI json_schema for a comprehensive research report section.
// Emits BOTH the prose (markdown, for the internal report + Q&A) AND the
// structured, individually-sourced findings the memo drafter consumes — so a
// single comprehensive research run feeds the memo identically to the old
// narrowed passes, plus keeps the long report.

export const REPORT_SECTION_FORMAT_NAME = "research_report_section";

export const REPORT_SECTION_OPENAI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["markdown", "sources", "notDisclosed", "findings", "unresolvedQuestions"],
  properties: {
    markdown: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title", "date"],
        properties: {
          url: { type: "string" },
          title: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
        },
      },
    },
    notDisclosed: { type: "array", items: { type: "string" } },
    findings: RESEARCH_FINDING_ARRAY_SCHEMA,
    unresolvedQuestions: { type: "array", items: { type: "string" } },
  },
} as const;

export interface CoercedReportSection {
  markdown: string;
  sources: { url: string; title?: string; date?: string }[];
  notDisclosed: string[];
  findings: ResearchFinding[];
  unresolvedQuestions: string[];
}

// Defensive coercion — the strict schema should already guarantee shape, but
// we never trust the model's output blindly. `findings` are passed through
// (the route grounds them via enforceSourceGrounding); we only require the
// prose body to be present.
export function coerceReportSection(input: unknown): CoercedReportSection | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.markdown !== "string" || obj.markdown.trim().length === 0) {
    return null;
  }
  const sources: CoercedReportSection["sources"] = [];
  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      if (!s || typeof s !== "object") continue;
      const rec = s as Record<string, unknown>;
      if (typeof rec.url !== "string" || rec.url.length === 0) continue;
      sources.push({
        url: rec.url,
        title: typeof rec.title === "string" ? rec.title : undefined,
        date: typeof rec.date === "string" ? rec.date : undefined,
      });
    }
  }
  const notDisclosed: string[] = Array.isArray(obj.notDisclosed)
    ? (obj.notDisclosed as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const findings: ResearchFinding[] = Array.isArray(obj.findings)
    ? (obj.findings as ResearchFinding[])
    : [];
  const unresolvedQuestions: string[] = Array.isArray(obj.unresolvedQuestions)
    ? (obj.unresolvedQuestions as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return { markdown: obj.markdown, sources, notDisclosed, findings, unresolvedQuestions };
}
