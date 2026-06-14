import type { MemoSection } from "./types";

// Phase 5G: display sanitization for generated memo sections. The model is
// prompted not to write machine ids into prose, but this is the belt-and-
// braces layer: it strips internal ids (research finding ids like r01/f01,
// upload ids like local_initial_1234) from VISIBLE fields only. Structured
// sources[] are never touched — documentId stays intact for validation,
// React keys, and debugging; it just never renders as visible label text
// (see humanSourceLabel).
//
// All id patterns are lowercase-only on purpose: finance prose is full of
// FY26 / Q4 / R&D / F2026 tokens that must never be mangled, and every id
// this app generates is lowercase.

const ID_TOKEN = String.raw`(?:[rf]\d{2}|local_initial_\d+)`;
// "(r01)", "(see r01, r03)", "[f02]", "(per local_initial_123 and r02)"
const BRACKETED_ID_REF = new RegExp(
  String.raw`\s*[(\[]\s*(?:see\s+|per\s+|from\s+|findings?\s+|sources?\s+)?${ID_TOKEN}(?:\s*(?:,|;|&|and)\s*(?:findings?\s+)?${ID_TOKEN})*\s*[)\]]`,
  "g",
);
// "finding r01", "Research findings r01 and r03", "Sources r02, r04".
// Case-insensitive so a sentence-initial "Sources"/"Findings" is rewritten
// as a phrase too — otherwise the leading word was left orphaned ("Sources,
// confirm this.") while BARE_ID stripped its ids. The id TOKEN itself is
// still effectively lowercase (every id this app emits is lowercase).
const ID_PHRASE = new RegExp(
  String.raw`\b(?:research\s+)?(?:findings?|sources?)\s+${ID_TOKEN}(?:\s*(?:,|and)\s*${ID_TOKEN})*`,
  "gi",
);
// Kept lowercase-only on purpose (see header note): uppercase finance tokens
// like FY26 / F2026 / F26 must never be stripped.
const LOCAL_INITIAL = /\blocal_initial_\d+\b/g;
const BARE_ID = /\b[rf]\d{2}\b/g;

export function sanitizeMemoTextForDisplay(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  out = out.replace(BRACKETED_ID_REF, "");
  out = out.replace(ID_PHRASE, (match) => {
    const phrase = /sources?/i.test(match)
      ? "the cited sources"
      : "the cited evidence";
    // Preserve sentence-initial capitalization of the removed phrase.
    return /^[A-Z]/.test(match)
      ? phrase[0].toUpperCase() + phrase.slice(1)
      : phrase;
  });
  out = out.replace(LOCAL_INITIAL, "the original memo");
  out = out.replace(BARE_ID, "");
  // Cleanup artifacts left by removing ids from prose.
  // dangling list glue ("and"/"&") before punctuation or a closing bracket
  out = out.replace(/\s+(?:and|&)\b(?=\s*(?:[.,;:!?)\]]|$))/gi, "");
  // collapse orphaned comma runs ("a, , b") into a single comma
  out = out.replace(/,(?:\s*,)+/g, ",");
  // orphaned comma right after a label/opening bracket ("Catalysts: ," / "(,")
  out = out.replace(/([:;([])\s*,\s*/g, "$1 ");
  // orphaned comma right before sentence punctuation or a closing bracket
  out = out.replace(/\s*,\s*(?=[.;:!?)\]])/g, "");
  // empty brackets left behind
  out = out.replace(/\(\s*\)|\[\s*\]/g, "");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([,.;:!?])/g, "$1");
  out = out.replace(/([,.;:])\1+/g, "$1");
  return out.trim();
}

export function sanitizeMemoSectionForDisplay(section: MemoSection): MemoSection {
  const out: MemoSection = {
    ...section,
    body: sanitizeMemoTextForDisplay(section.body),
  };
  if (typeof section.summary === "string") {
    out.summary = sanitizeMemoTextForDisplay(section.summary);
  }
  if (Array.isArray(section.bullets)) {
    out.bullets = section.bullets
      .map((b) => sanitizeMemoTextForDisplay(b))
      .filter((b) => b.length > 0);
  }
  if (typeof section.confidenceNote === "string") {
    out.confidenceNote = sanitizeMemoTextForDisplay(section.confidenceNote);
  }
  if (Array.isArray(section.bridge)) {
    out.bridge = section.bridge.map((row) => {
      const clean = { ...row, metric: sanitizeMemoTextForDisplay(row.metric) };
      if (typeof row.original === "string") {
        clean.original = sanitizeMemoTextForDisplay(row.original);
      }
      if (typeof row.latest === "string") {
        clean.latest = sanitizeMemoTextForDisplay(row.latest);
      }
      if (typeof row.readThrough === "string") {
        clean.readThrough = sanitizeMemoTextForDisplay(row.readThrough);
      }
      return clean;
    });
  }
  // sources[] intentionally untouched: documentId/page/quote are internal
  // structured data; visible labels come from humanSourceLabel.
  return out;
}

// Human-readable label for a source reference. documentId never renders as
// visible text — the workspace accordion and the Markdown export both use
// this label instead. Index is 0-based position within the section's
// sources[].
export function humanSourceLabel(documentId: string, index: number): string {
  if (/^local_initial_\d+$/.test(documentId)) {
    return "Original memo";
  }
  if (/^[rf]\d{2}$/.test(documentId)) {
    return `Research source ${index + 1}`;
  }
  return `Source ${index + 1}`;
}
