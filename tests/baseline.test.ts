import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildBaselineMemoUnderstanding } from "../src/worker/memoUnderstanding/baseline";
import { detectCompanyFromTextDetailed } from "../src/react-app/lib/memoDna";

const havells = readFileSync(
  path.resolve(__dirname, "fixtures/havells-3qfy26.txt"),
  "utf-8",
);

// Phase 6H: replay the REAL JM Financial Havells extract through the
// deterministic baseline tier. Every assertion here corresponds to a
// content bug we shipped a fix for this session — so a regression in any
// of them fails CI instead of reaching the user.
describe("baseline memo understanding — Havells fixture", () => {
  const out = buildBaselineMemoUnderstanding({
    projectId: "p_test",
    companyName: "Havells",
    ticker: "HAVL",
    extractedText: havells,
    recoveryReason: "test",
  });

  it("extracts the recommendation and full target price (not 'INR 1')", () => {
    expect(out.memo.recommendation).toBe("BUY");
    // The bug was truncation at the thousand-separator → "INR 1".
    expect(out.memo.targetPrice).toContain("1,750");
    expect(JSON.stringify(out)).not.toMatch(/INR 1(?![,\d])/);
  });

  it("one-line summary carries the target, not a generic template", () => {
    expect(out.summary.oneLineSummary.toLowerCase()).toContain("havells");
    expect(out.summary.oneLineSummary).toContain("1,750");
    expect(out.summary.oneLineSummary).not.toMatch(
      /anchored on the memo's specific claims/i,
    );
  });

  it("does NOT leak broker letterhead / page-footer / disclaimer into the summary", () => {
    const s = out.summary.shortSummary;
    expect(s).not.toMatch(/Page \d+/i);
    expect(s).not.toMatch(/JM Financial Institutional Securities/i);
    expect(s).not.toMatch(/price expected to move in the range/i);
    expect(s).not.toMatch(/history of recommendation/i);
  });

  it("produces specific, non-degenerate flag labels", () => {
    const labels = out.flaggedDetails.map((f) => f.label);
    expect(labels.length).toBeGreaterThan(0);
    // No "Segment driver — segment" style category-echo suffixes.
    for (const l of labels) {
      expect(l).not.toMatch(
        /—\s*(segment|risk|margin|catalyst|valuation|earnings)s?$/i,
      );
    }
    // No broker-acronym letterhead noise like "( IIFL cap )".
    for (const l of labels) {
      expect(l).not.toMatch(/\(\s*[A-Z]{2,}\s+[a-z]+\s*\)/);
    }
  });

  it("surfaces the thesis-critical table numbers via key/segment claims", () => {
    const fin = JSON.stringify(out.financials);
    // C&W +33% is the literal headline; EBITDA margin 9.4% is the miss.
    expect(fin).toContain("33%");
    expect(fin).toContain("9.4%");
    // Beat/miss read from the estimate column survived.
    expect(fin).toMatch(/vs .*est/);
  });
});

// Phase 6I: a risk-dominated or very short memo can yield no valuation /
// financial sentence. The baseline tier must still produce a non-blank
// summary + thesis (fall back to a risk sentence, then the one-line summary).
describe("baseline memo understanding — no valuation/financial sentences", () => {
  const out = buildBaselineMemoUnderstanding({
    projectId: "p_empty",
    companyName: "Acme Corp",
    extractedText: "Risks remain elevated heading into the print.",
    recoveryReason: "test",
  });

  it("never emits a blank shortSummary / detailedThesis", () => {
    expect(out.summary.shortSummary.trim().length).toBeGreaterThan(0);
    expect(out.thesis.detailedThesis.trim().length).toBeGreaterThan(0);
    expect(out.summary.oneLineSummary).toContain("Acme Corp");
  });
});

describe("company detection — broker is not the company", () => {
  it("does not pick the broker (JM Financial / Beas Capital) as company", () => {
    const det = detectCompanyFromTextDetailed(havells, "havells_note.pdf");
    expect(det.company.toLowerCase()).toContain("havells");
    expect(det.company).not.toMatch(/jm financial/i);
    expect(det.company).not.toMatch(/^beas/i);
  });

  it("picks a camelCase company name over a broker (RateGain case)", () => {
    const text = `Beas Capital Stage 1 SaaS memo on RateGain Travel Technologies.
We rate RateGain BUY with a target price of INR 960.
RateGain Travel Technologies Limited published Q4 results.`;
    const det = detectCompanyFromTextDetailed(text, "BeasCapital_RateGain.pdf");
    expect(det.company).toMatch(/rategain/i);
    expect(det.company).not.toMatch(/beas/i);
  });
});
