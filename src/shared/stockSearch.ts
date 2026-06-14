// Pure, runtime-free helpers for the stock-search company picker. Kept in
// @shared so the Worker proxy (src/worker/stock/searchRoute.ts) and the
// Node-only vitest suite can both import them without pulling the Cloudflare
// runtime.
//
// Upstream shape (devde.muns.io/stock/search), example query "RELI":
//   {
//     "data": {
//       "total_results": 15,
//       "results": {
//         "RELIANCE": ["India", "Reliance Industries Ltd", "Refineries & Marketing"],
//         ...
//       }
//     },
//     "message": "",
//     "success": true
//   }
// Each results value is the positional tuple [country, name, sector].
import type { StockSearchResult } from "./types";

interface RawStockSearchUpstream {
  data?: {
    total_results?: unknown;
    results?: unknown;
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Flatten the upstream ticker→[country, name, sector] map into a stable
// array. Malformed entries (non-array values, missing fields) degrade
// gracefully to empty strings rather than throwing — the upstream service is
// outside our control, so we never let a stray shape break the picker.
export function normalizeStockSearchResults(raw: unknown): StockSearchResult[] {
  const results = (raw as RawStockSearchUpstream | null)?.data?.results;
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    return [];
  }
  const out: StockSearchResult[] = [];
  for (const [ticker, value] of Object.entries(results as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const [country, name, sector] = value;
    out.push({
      ticker: String(ticker),
      country: asString(country),
      name: asString(name),
      sector: asString(sector),
    });
  }
  return out;
}

// Prefer the upstream-declared total when it is a finite number; otherwise
// fall back to the number of rows we actually parsed.
export function extractStockSearchTotal(raw: unknown, fallback: number): number {
  const total = (raw as RawStockSearchUpstream | null)?.data?.total_results;
  return typeof total === "number" && Number.isFinite(total) && total >= 0
    ? total
    : fallback;
}
