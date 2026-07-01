// Strict OpenAI json_schema for a comprehensive research report section.
// Prose-first (markdown) plus the grounding sources and any not-disclosed
// datapoints. Kept minimal so the model spends its budget on the report body.

export const REPORT_SECTION_FORMAT_NAME = "research_report_section";

export const REPORT_SECTION_OPENAI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    markdown: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          title: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
        },
        required: ["url", "title", "date"],
      },
    },
    notDisclosed: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["markdown", "sources", "notDisclosed"],
} as const;

export interface CoercedReportSection {
  markdown: string;
  sources: { url: string; title?: string; date?: string }[];
  notDisclosed: string[];
}

// Defensive coercion — the strict schema should already guarantee shape, but
// we never trust the model's output blindly.
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
    ? (obj.notDisclosed as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
  return { markdown: obj.markdown, sources, notDisclosed };
}
