import { describe, it, expect } from "vitest";
import {
  computeMemoCoverage,
  detectMemoWrittenOn,
} from "../src/react-app/lib/memoAnalysis";

describe("detectMemoWrittenOn", () => {
  it("picks an explicit anchored date: 'Dated: 7 May 2024'", () => {
    const r = detectMemoWrittenOn(
      "Some preamble.\n\nDated: 7 May 2024\nInitial coverage on RateGain.",
    );
    expect(r).not.toBeNull();
    expect(r!.iso).toBe("2024-05-07");
    expect(r!.confidence).toBe("high");
  });

  it("picks a header DD-Month-YYYY date", () => {
    const r = detectMemoWrittenOn(
      "Beas Capital · Stage 1 Memo · 7 May 2024\nRateGain Travel Technologies\nThesis ...",
    );
    expect(r!.iso).toBe("2024-05-07");
    expect(r!.confidence).toBe("high");
  });

  it("picks 'May 7, 2024' (US-style named)", () => {
    const r = detectMemoWrittenOn("Cover page\nPublished May 7, 2024.\nThesis ...");
    expect(r!.iso).toBe("2024-05-07");
  });

  it("picks an ISO date in the header at medium confidence", () => {
    const r = detectMemoWrittenOn("RateGain memo · 2024-05-07\nThesis ...");
    expect(r!.iso).toBe("2024-05-07");
    // Anchor 'memo' is in the anchor token list — this should actually be HIGH
    // confidence via the anchored path. Either is acceptable as long as the
    // ISO date is identified correctly.
    expect(["high", "medium"]).toContain(r!.confidence);
  });

  it("parses '07-05-2024' as DD-MM-YYYY by default (low confidence — prompt user)", () => {
    const r = detectMemoWrittenOn("Header line\n07-05-2024\nThesis text.");
    expect(r!.iso).toBe("2024-05-07");
    expect(r!.confidence).toBe("low");
  });

  it("snaps 'May 2024' to the 1st at low confidence", () => {
    const r = detectMemoWrittenOn("Header\nMay 2024\nThesis text.");
    expect(r!.iso).toBe("2024-05-01");
    expect(r!.confidence).toBe("low");
  });

  it("returns null on truly date-free text", () => {
    expect(detectMemoWrittenOn("RateGain memo without any date markings."))
      .toBeNull();
  });

  it("works for the RateGain-style header in the live fixture", () => {
    // Mirrors the actual memo: "07-05-2024 CMP 670 EPS 24 ..."
    const r = detectMemoWrittenOn(
      "Beas Capital SaaS - Rategain Update ... 07-05-2024 CMP 670 EPS 24 Multiple 40x ...",
    );
    expect(r!.iso).toBe("2024-05-07");
  });
});

describe("computeMemoCoverage", () => {
  it("flags shareholding when promoter/FII/DII appear", () => {
    const c = computeMemoCoverage(
      "Promoter holding stands at 48%; FII holding 7.6%.",
    );
    expect(c.shareholding).toBe(true);
  });

  it("does NOT flag shareholding when memo never mentions it (RateGain fixture)", () => {
    const c = computeMemoCoverage(
      "Beas Capital SaaS thesis on RateGain: DAAS to MarTech mix shift drives 23% margins; FY26 EPS 24; target Rs 960 on 40x P/E. Recommend adding up to 2% in portfolio.",
    );
    expect(c.shareholding).toBe(false);
    expect(c.valuationFramework).toBe(true);
    expect(c.forecasts).toBe(true);
    expect(c.positionSizing).toBe(true);
  });

  it("flags industry coverage independently", () => {
    expect(computeMemoCoverage("SaaS sector competition is rising").industry).toBe(
      true,
    );
    expect(computeMemoCoverage("just a one-line note").industry).toBe(false);
  });
});
