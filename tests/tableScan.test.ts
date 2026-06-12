import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  scanTables,
  selectFinancialRows,
  selectSegmentRows,
} from "../src/worker/memoUnderstanding/tableScan";

const havells = readFileSync(
  path.resolve(__dirname, "fixtures/havells-3qfy26.txt"),
  "utf-8",
);

// Phase 6H: the table scanner is the deterministic path that pulls the
// dense quarterly segment tables (Phase 6G). Replay the real Havells
// tables and assert the headline numbers + beat/miss reads survive.
describe("table scanner — Havells quarterly tables", () => {
  const rows = scanTables(havells);

  it("scans a non-trivial number of aligned rows", () => {
    expect(rows.length).toBeGreaterThan(8);
  });

  it("recovers the Cables +33% beat with its estimate", () => {
    const seg = selectSegmentRows(rows, 6);
    const cables = seg.find((r) => /cables/i.test(r.label));
    expect(cables).toBeTruthy();
    expect(cables!.value).toContain("33%");
    expect(cables!.estimate).toBeTruthy();
  });

  it("recovers an EBITDA margin row at 9.4%", () => {
    const fin = selectFinancialRows(rows, 8);
    const dump = JSON.stringify(fin);
    expect(dump).toContain("9.4%");
  });

  it("preserves Indian-grouped numbers (no comma truncation)", () => {
    // e.g. Net Revenue 55,734 — must not become "55" or "734".
    const dump = JSON.stringify(rows);
    expect(dump).toContain("55,734");
  });
});
