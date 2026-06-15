import { describe, it, expect } from "vitest";
import { pdfSafeText } from "../src/react-app/lib/pdfText";

// Regression for the garbled downloadable memo PDF. jsPDF's standard Times
// font is WinAnsi-only, so ₹ rendered as "¹" (and drifted spacing). These
// cases mirror the actual broken output.
describe("pdfSafeText", () => {
  it("transliterates the Indian Rupee sign, collapsing a trailing space", () => {
    expect(pdfSafeText("~₹671 memo-implied entry")).toBe(
      "~Rs 671 memo-implied entry",
    );
    expect(pdfSafeText("₹960 base; 43% upside")).toBe("Rs 960 base; 43% upside");
    expect(pdfSafeText("₹ 24 EPS")).toBe("Rs 24 EPS");
    expect(pdfSafeText("40x P/E × ₹24 EPS = ₹960")).toBe(
      "40x P/E × Rs 24 EPS = Rs 960",
    );
  });

  it("transliterates the research-window arrow", () => {
    expect(pdfSafeText("Research 2025-12 → 2026-06")).toBe(
      "Research 2025-12 -> 2026-06",
    );
  });

  it("preserves WinAnsi-renderable typography (curly quotes, dashes, bullet)", () => {
    const s = "RateGain’s “growth” — strong • Sojern";
    expect(pdfSafeText(s)).toBe(s);
  });

  it("preserves the multiply sign (Latin-1) used in P/E math", () => {
    expect(pdfSafeText("4.0x × 23x")).toBe("4.0x × 23x");
  });

  it("maps common math/relation symbols", () => {
    expect(pdfSafeText("margin ≥ 23% and ≤ 25%, ≈ flat, ≠ guidance")).toBe(
      "margin >= 23% and <= 25%, ~ flat, != guidance",
    );
  });

  it("normalizes non-breaking / zero-width spaces", () => {
    expect(pdfSafeText("INR 1,000​cr")).toBe("INR 1,000cr");
  });

  it("replaces unknown non-WinAnsi characters with a single placeholder", () => {
    expect(pdfSafeText("rocket 🚀 end")).toBe("rocket ? end");
  });

  it("handles empty input", () => {
    expect(pdfSafeText("")).toBe("");
  });
});
