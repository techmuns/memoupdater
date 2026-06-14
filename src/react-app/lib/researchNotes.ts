// Pure helper for the research "method notes" shown in ResearchFindingsCard.
//
// Each research pass emits process caveats — period/fiscal-calendar
// assumptions, source-access failures (gated PDFs, 403s), and scope notes
// ("this pass only covered X"). Merged across six passes these pile up and
// repeat (several variants of "Multiple periods were detected; …"). They are
// informational, NOT company signal, so the UI shows them collapsed and
// muted. This helper keeps that list short and non-repetitive.
//
// Node-safe (no React) so it can be unit-tested under the existing vitest
// setup the same way researchSummary.ts is.

// Collapse near-duplicate notes (keyed on their leading clause, which is the
// recurring stock phrase) and cap the result. Preserves first-seen order and
// the full original text of the first occurrence.
export function dedupeResearchNotes(notes: string[], cap = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of notes) {
    if (typeof raw !== "string") continue;
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const key = leadClauseKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

// Key on the first clause — up to the first separator (; : . — ) — lowercased
// and length-bounded. The passes lead with a recurring phrase ("Multiple
// periods were detected", "Research window assumption", "Because the findings
// rely only on press"), so near-identical notes collapse to one entry.
function leadClauseKey(text: string): string {
  const head = text.split(/[;:.—]/)[0] ?? text;
  return head.toLowerCase().trim().slice(0, 60);
}
