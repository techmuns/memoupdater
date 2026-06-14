import { describe, it, expect } from "vitest";
import { sanitizeMemoTextForDisplay } from "../src/shared/sanitizeMemo";

// Phase 6I: the sanitizer strips internal machine ids (r01/f01,
// local_initial_123) from VISIBLE memo prose. These guard the two classes
// of artifact the regex pass must NOT leave behind: orphaned leading words
// ("Sources, ...") and dangling list glue ("... and." / "(FY26, )").

describe("sanitizeMemoTextForDisplay", () => {
  it("rewrites a sentence-initial 'Sources <ids>' phrase (case-insensitive)", () => {
    expect(sanitizeMemoTextForDisplay("Sources r02, r04 confirm this.")).toBe(
      "The cited sources confirm this.",
    );
    expect(
      sanitizeMemoTextForDisplay("Findings r01 and r03 support the call."),
    ).toBe("The cited evidence support the call.");
  });

  it("still rewrites lowercase phrases as before", () => {
    expect(sanitizeMemoTextForDisplay("sources r02, r04 confirm this.")).toBe(
      "the cited sources confirm this.",
    );
    expect(
      sanitizeMemoTextForDisplay("research findings r01 confirm growth."),
    ).toBe("the cited evidence confirm growth.");
  });

  it("does not leave dangling conjunctions when an id is stripped", () => {
    expect(
      sanitizeMemoTextForDisplay("Supported by local_initial_5 and r02."),
    ).toBe("Supported by the original memo.");
    expect(sanitizeMemoTextForDisplay("Net debt fell (r01) and margins held.")).toBe(
      "Net debt fell and margins held.",
    );
  });

  it("cleans orphaned commas inside parentheses and after labels", () => {
    expect(sanitizeMemoTextForDisplay("Revenue (FY26, r01) rose.")).toBe(
      "Revenue (FY26) rose.",
    );
    expect(sanitizeMemoTextForDisplay("Catalysts: r01, r02, r03.")).toBe(
      "Catalysts:.",
    );
    expect(sanitizeMemoTextForDisplay("Drivers: r01, pricing, r02.")).toBe(
      "Drivers: pricing.",
    );
  });

  it("never mangles legitimate finance tokens or real comma lists", () => {
    const finance = "FY26 and Q4 and R&D and F2026 and F26 stay.";
    expect(sanitizeMemoTextForDisplay(finance)).toBe(finance);
    const list = "EBITDA, revenue, and PAT rose.";
    expect(sanitizeMemoTextForDisplay(list)).toBe(list);
    const plain = "No ids here at all.";
    expect(sanitizeMemoTextForDisplay(plain)).toBe(plain);
  });

  it("handles empty input", () => {
    expect(sanitizeMemoTextForDisplay("")).toBe("");
  });
});
