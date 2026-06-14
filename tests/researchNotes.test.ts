import { describe, it, expect } from "vitest";
import { dedupeResearchNotes } from "../src/react-app/lib/researchNotes";

describe("dedupeResearchNotes", () => {
  it("collapses near-duplicate notes that share a leading clause", () => {
    const notes = [
      "Multiple periods were detected; using the most recent official company result found in the pass: Q4FY26/FY26 dated May 21, 2026.",
      "Multiple periods were detected; this pass prioritized the most recent available company-attributable earnings commentary, Q4/FY26.",
      "Multiple periods were detected; using most recent available result period in this pass: Q4FY26/FY26, with FY27 guidance where press reported it.",
    ];
    const out = dedupeResearchNotes(notes);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(notes[0]);
  });

  it("keeps genuinely distinct notes", () => {
    const notes = [
      "Research window assumption: the prompt labels the memo period as FY26 but fiscal calendar mapping was not provided.",
      "The Q4FY26 investor presentation PDF URL was found via search but could not be opened by the browsing tool.",
      "Because the findings rely only on press / market-data summaries, all directional implications are marked as watch.",
    ];
    expect(dedupeResearchNotes(notes)).toHaveLength(3);
  });

  it("trims, drops empties/non-strings, and collapses whitespace", () => {
    const notes = [
      "  Multiple   periods were detected;  using X  ",
      "",
      "   ",
      // @ts-expect-error intentional bad input
      null,
      "Multiple periods were detected; using Y",
    ];
    const out = dedupeResearchNotes(notes);
    expect(out).toEqual(["Multiple periods were detected; using X"]);
  });

  it("caps the list length", () => {
    const notes = Array.from({ length: 20 }, (_, i) => `Distinct note number ${i}`);
    expect(dedupeResearchNotes(notes, 5)).toHaveLength(5);
  });
});
