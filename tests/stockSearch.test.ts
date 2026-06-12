import { describe, it, expect } from "vitest";
import {
  normalizeStockSearchResults,
  extractStockSearchTotal,
} from "@shared/stockSearch";

// The fixture mirrors the documented upstream shape for query "RELI":
// data.results is a ticker -> [country, name, sector] map.
const UPSTREAM_SAMPLE = {
  data: {
    total_results: 3,
    results: {
      RELIANCE: ["India", "Reliance Industries Ltd", "Refineries & Marketing"],
      RS: ["United States", "Reliance Inc", "Steel"],
      RCOM: [
        "India",
        "Reliance Communications Ltd",
        "Telecom - Cellular & Fixed line services",
      ],
    },
  },
  message: "",
  success: true,
};

describe("normalizeStockSearchResults", () => {
  it("maps the ticker -> [country, name, sector] tuples in order", () => {
    const rows = normalizeStockSearchResults(UPSTREAM_SAMPLE);
    expect(rows).toEqual([
      {
        ticker: "RELIANCE",
        country: "India",
        name: "Reliance Industries Ltd",
        sector: "Refineries & Marketing",
      },
      {
        ticker: "RS",
        country: "United States",
        name: "Reliance Inc",
        sector: "Steel",
      },
      {
        ticker: "RCOM",
        country: "India",
        name: "Reliance Communications Ltd",
        sector: "Telecom - Cellular & Fixed line services",
      },
    ]);
  });

  it("returns [] for missing / malformed payloads instead of throwing", () => {
    expect(normalizeStockSearchResults(null)).toEqual([]);
    expect(normalizeStockSearchResults({})).toEqual([]);
    expect(normalizeStockSearchResults({ data: {} })).toEqual([]);
    expect(normalizeStockSearchResults({ data: { results: [] } })).toEqual([]);
    expect(
      normalizeStockSearchResults({ data: { results: "nope" } }),
    ).toEqual([]);
  });

  it("degrades partial tuples to empty strings, skips non-array values", () => {
    const rows = normalizeStockSearchResults({
      data: {
        results: {
          AAA: ["India"],
          BBB: "not-an-array",
          CCC: ["United States", "Some Co", "Tech", "extra-ignored"],
        },
      },
    });
    expect(rows).toEqual([
      { ticker: "AAA", country: "India", name: "", sector: "" },
      { ticker: "CCC", country: "United States", name: "Some Co", sector: "Tech" },
    ]);
  });
});

describe("extractStockSearchTotal", () => {
  it("prefers the upstream total when finite", () => {
    expect(extractStockSearchTotal(UPSTREAM_SAMPLE, 0)).toBe(3);
  });

  it("falls back to the provided count when total is absent or invalid", () => {
    expect(extractStockSearchTotal({ data: {} }, 7)).toBe(7);
    expect(extractStockSearchTotal({ data: { total_results: "x" } }, 5)).toBe(5);
    expect(extractStockSearchTotal(null, 2)).toBe(2);
  });
});
