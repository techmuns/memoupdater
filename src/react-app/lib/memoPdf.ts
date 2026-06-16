import type jsPDF from "jspdf";
import type { FollowUpMemo, MemoSection } from "@shared/types";
import { pdfSafeText } from "./pdfText";

// Phase 6F.2: jsPDF + its html2canvas/dompurify transitive deps are
// ~400 KB unzipped. Only load them when the user actually requests a
// PDF — keeps the initial bundle the same size as before this feature.
let JsPdfCtor: typeof jsPDF | null = null;
async function getJsPdfCtor(): Promise<typeof jsPDF> {
  if (JsPdfCtor) return JsPdfCtor;
  const mod = await import("jspdf");
  JsPdfCtor = mod.default;
  return JsPdfCtor;
}

// Phase 6F.2: real downloadable PDF.
//
// Why: the previous Print / Save as PDF path opened a styled HTML
// window and called window.print(). When the user selected
// "Microsoft Print to PDF" the OS driver outlined every glyph into
// vector paths — the resulting PDF carried 80 streams of bezier curves
// and ZERO fonts, so it was unsearchable, accessibility-hostile, and
// ~2 MB for what should be a ≤120 KB text PDF.
//
// This builder uses jsPDF directly. The output carries real text
// (selectable, searchable, copy-pasteable), embedded Times Roman, and
// proper page breaks. It targets the same ≤3-page budget as the print
// document, and content scope is the SAME as the print HTML: core
// sec_* sections only, with manual checks at the foot. Supplementary
// sup_* panels are out of scope to protect the page budget.

export interface BuildMemoPdfOptions {
  researchWindowLabel?: string;
}

// All measurements in mm. A4 = 210×297.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 14;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 16;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

interface DocCtx {
  doc: jsPDF;
  y: number;
}

async function newCtx(dense: boolean): Promise<DocCtx> {
  const Ctor = await getJsPdfCtor();
  const doc = new Ctor({ unit: "mm", format: "a4", compress: true });
  doc.setFont("times", "normal");
  doc.setFontSize(dense ? 9 : 10);
  return { doc, y: MARGIN_TOP };
}

function ensureRoom(ctx: DocCtx, needed: number): void {
  if (ctx.y + needed > PAGE_H - MARGIN_BOTTOM) {
    ctx.doc.addPage();
    ctx.y = MARGIN_TOP;
  }
}

function writeWrapped(
  ctx: DocCtx,
  text: string,
  opts: { size: number; bold?: boolean; lineGap?: number; color?: [number, number, number] },
): void {
  const { doc } = ctx;
  doc.setFontSize(opts.size);
  doc.setFont("times", opts.bold ? "bold" : "normal");
  doc.setTextColor(...(opts.color ?? [16, 20, 24]));
  const lineGap = opts.lineGap ?? opts.size * 0.42;
  // Standard-14 fonts are WinAnsi-only; transliterate ₹ and friends so the
  // text renders as real glyphs instead of "¹"-style garbage.
  const lines = doc.splitTextToSize(pdfSafeText(text), CONTENT_W);
  for (const line of lines) {
    ensureRoom(ctx, lineGap);
    doc.text(line, MARGIN_X, ctx.y);
    ctx.y += lineGap;
  }
}

function drawHr(ctx: DocCtx, weight = 0.4): void {
  ensureRoom(ctx, 1.5);
  ctx.doc.setLineWidth(weight);
  ctx.doc.setDrawColor(180, 184, 190);
  ctx.doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 2;
}

function drawBridge(ctx: DocCtx, rows: NonNullable<MemoSection["bridge"]>, dense: boolean): void {
  if (rows.length === 0) return;
  const { doc } = ctx;
  const cellSize = dense ? 7.5 : 8;
  const lineGap = cellSize * 0.42; // baseline-to-baseline within a cell
  // Box-model paddings so a tall wrapped cell never collides with the row
  // above/below. The previous code drew the first baseline AT the row top
  // (ascenders bled into the prior row) and put the border a fixed offset up —
  // long cells overlapped. Now: first baseline sits topPad+ascent below the
  // row top, the row is exactly tall enough for its tallest cell, and the
  // divider is drawn at the row's true bottom.
  const topPad = lineGap * 0.5;
  const botPad = lineGap * 0.4;
  const ascent = lineGap * 0.78;
  // Column layout: Metric | Original | Latest | Read-through (sum = CONTENT_W).
  const widths = [
    CONTENT_W * 0.22,
    CONTENT_W * 0.22,
    CONTENT_W * 0.22,
    CONTENT_W * 0.34,
  ];
  const xs = [
    MARGIN_X,
    MARGIN_X + widths[0],
    MARGIN_X + widths[0] + widths[1],
    MARGIN_X + widths[0] + widths[1] + widths[2],
  ];

  doc.setFontSize(cellSize);
  doc.setFont("times", "normal");
  const cells: string[][] = [
    ["Metric", "Original anchor", "Latest", "Read-through"],
    ...rows.map((r) => [
      r.metric,
      r.original ?? "—",
      r.latest ?? "—",
      r.readThrough ?? "—",
    ]),
  ];
  const wrapped: string[][][] = cells.map((row, ri) =>
    row.map((cell, ci) => {
      doc.setFont("times", ri === 0 ? "bold" : "normal");
      doc.setFontSize(cellSize);
      return doc.splitTextToSize(pdfSafeText(cell), widths[ci] - 2.4) as string[];
    }),
  );
  const heights = wrapped.map((row) => {
    const maxLines = Math.max(...row.map((cell) => cell.length));
    return topPad + maxLines * lineGap + botPad;
  });
  // Keep the header row with at least the first data row (avoid an orphan
  // header at a page bottom); rows still break individually after that.
  ensureRoom(ctx, heights[0] + (heights[1] ?? 0));

  for (let ri = 0; ri < wrapped.length; ri++) {
    const row = wrapped[ri];
    const h = heights[ri];
    ensureRoom(ctx, h);
    const rowTop = ctx.y;
    // Header gets an indigo-tinted band; data rows zebra-stripe (every other
    // row a very light gray) so a dense table stays scannable.
    if (ri === 0) {
      doc.setFillColor(238, 242, 255);
      doc.rect(MARGIN_X, rowTop, CONTENT_W, h, "F");
    } else if (ri % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN_X, rowTop, CONTENT_W, h, "F");
    }
    for (let ci = 0; ci < row.length; ci++) {
      doc.setFont("times", ri === 0 ? "bold" : "normal");
      doc.setFontSize(cellSize);
      // Header indigo, first column (metric) darker, value cells near-black.
      if (ri === 0) doc.setTextColor(67, 56, 202);
      else if (ci === 0) doc.setTextColor(17, 24, 39);
      else doc.setTextColor(55, 65, 81);
      const lines = row[ci];
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], xs[ci] + 1.4, rowTop + topPad + ascent + li * lineGap);
      }
    }
    // Divider at the row's true bottom.
    doc.setLineWidth(0.2);
    doc.setDrawColor(229, 231, 235);
    doc.line(MARGIN_X, rowTop + h, PAGE_W - MARGIN_X, rowTop + h);
    ctx.y = rowTop + h;
  }
  ctx.y += 1.5;
}

// The valuation bridge and the memo-vs-actual financials are the two
// supplementary panels a follow-up memo must show IN PRINT (a PM reads them
// first). They are promoted into the 3-page PDF in COMPACT form — heading +
// summary line + bridge table only; the prose/bullets stay in the dashboard
// drawer. Only panels that actually carry a bridge are printed (a "no data"
// panel adds nothing and is skipped to protect the page budget).
const PRINTED_PANEL_IDS: readonly string[] = [
  "sup_valuation_detail",
  "sup_financials_actuals",
];

function selectPrintedPanels(memo: FollowUpMemo): MemoSection[] {
  const panels = memo.supplementaryPanels ?? [];
  return PRINTED_PANEL_IDS.map((id) => panels.find((p) => p.id === id)).filter(
    (p): p is MemoSection => Boolean(p && p.bridge && p.bridge.length > 0),
  );
}

function bridgeCharCount(s: MemoSection): number {
  let n = (s.summary ?? "").length;
  for (const row of s.bridge ?? []) {
    n +=
      row.metric.length +
      (row.original ?? "").length +
      (row.latest ?? "").length +
      (row.readThrough ?? "").length;
  }
  return n;
}

function visibleCharCount(memo: FollowUpMemo, panels: MemoSection[]): number {
  let n = memo.title.length;
  for (const s of memo.sections) {
    n += (s.summary ?? "").length;
    n += (s.body ?? "").length;
    for (const b of s.bullets ?? []) n += b.length;
    n += bridgeCharCount({ ...s, summary: undefined });
  }
  for (const p of panels) n += bridgeCharCount(p);
  for (const m of memo.manualChecksRemaining ?? []) n += m.length;
  return n;
}

function signalLabel(signal: NonNullable<MemoSection["signal"]>): string {
  switch (signal) {
    case "positive": return "Positive";
    case "negative": return "Negative";
    case "watch": return "Watch";
    case "neutral": return "Neutral";
  }
}

export async function buildMemoPdf(
  memo: FollowUpMemo,
  opts: BuildMemoPdfOptions = {},
): Promise<Blob> {
  // Adaptive density — keeps a long memo inside the 3-page budget. The
  // promoted valuation + financials panels count toward the budget so a
  // content-heavy memo compresses automatically.
  const panels = selectPrintedPanels(memo);
  // Lowered from 9k → 7.5k: the richer section content + the now-spacier,
  // more-readable layout mean a heavy memo should switch to the compact
  // typography sooner to hold the 3-page budget.
  const dense = visibleCharCount(memo, panels) > 7_500;
  const ctx = await newCtx(dense);
  const { doc } = ctx;

  // Header
  writeWrapped(ctx, memo.title, {
    size: dense ? 13 : 14,
    bold: true,
  });
  const date = new Date(memo.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" });
  const metaParts = [
    `Generated ${date}`,
    opts.researchWindowLabel ?? null,
    "Confidential — internal research draft",
  ].filter(Boolean) as string[];
  writeWrapped(ctx, metaParts.join("  ·  "), {
    size: 7.5,
    color: [110, 116, 124],
    lineGap: 3.2,
  });
  ctx.y += 1;
  drawHr(ctx, 0.6);

  // Core sections
  memo.sections.forEach((s, i) => {
    renderSection(ctx, s, i + 1, dense);
  });

  // Promoted supplementary panels — valuation bridge + memo-vs-actual
  // financials, compact (table-first; full prose stays in the dashboard).
  if (panels.length > 0) {
    ctx.y += dense ? 3 : 4;
    drawHr(ctx, 0.6);
    ctx.y += 0.5;
    writeWrapped(ctx, "VALUATION & FINANCIALS DETAIL", {
      size: dense ? 8 : 8.5,
      bold: true,
      color: [67, 56, 202],
      lineGap: dense ? 3.4 : 3.6,
    });
    ctx.y += dense ? 0.6 : 0.8;
    for (const p of panels) {
      renderSupplementaryPanelCompact(ctx, p, dense);
    }
  }

  // Manual checks
  if (memo.manualChecksRemaining && memo.manualChecksRemaining.length > 0) {
    ctx.y += dense ? 3 : 4;
    ensureRoom(ctx, 12);
    writeWrapped(ctx, "Manual checks remaining", {
      size: dense ? 10 : 10.5,
      bold: true,
    });
    drawHeadingRule(ctx);
    ctx.y += dense ? 1.2 : 1.6;
    for (const m of memo.manualChecksRemaining) {
      writeBullet(ctx, m, dense);
      ctx.y += dense ? 0.5 : 0.7;
    }
  }

  // Footer caveat on the last page
  ensureRoom(ctx, 8);
  ctx.y = PAGE_H - MARGIN_BOTTOM - 6;
  drawHr(ctx, 0.3);
  writeWrapped(
    ctx,
    "Draft for research support — not investment advice; analyst sign-off required.  The full EPS-credibility bridge and per-section sources are available in the dashboard.",
    { size: 7, color: [130, 135, 142] },
  );

  return doc.output("blob");
}

// Draw the section/panel signal tag RIGHT-ALIGNED on the heading's first
// baseline. Previously it was placed at a fixed left x (MARGIN_X + 4) on the
// heading baseline, so "(Watch)" printed ON TOP of the section title. The
// title is left-aligned and short, so right-aligning the tag at the page
// margin makes a collision impossible regardless of title length.
function drawSignalTag(
  ctx: DocCtx,
  signal: MemoSection["signal"] | undefined,
  baselineY: number,
): void {
  if (!signal) return;
  const { doc } = ctx;
  doc.setFontSize(7);
  doc.setFont("times", "italic");
  doc.setTextColor(120, 124, 132);
  const label = `(${signalLabel(signal)})`;
  const w = doc.getTextWidth(label);
  doc.text(label, PAGE_W - MARGIN_X - w, baselineY);
}

// Thin divider drawn directly under a section/panel heading — the main
// "clear division between blocks" marker.
function drawHeadingRule(ctx: DocCtx): void {
  ctx.y += 0.6;
  ctx.doc.setLineWidth(0.3);
  ctx.doc.setDrawColor(209, 213, 219);
  ctx.doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 0.4;
}

// One bullet with a HANGING indent — the glyph sits at the margin and wrapped
// lines align under the text, not under the bullet. Far more readable than the
// old inline "• text" which wrapped back to the margin.
function writeBullet(ctx: DocCtx, text: string, dense: boolean): void {
  const { doc } = ctx;
  const size = dense ? 8.5 : 9;
  const lineGap = dense ? 3.9 : 4.2;
  const indent = 3.8;
  doc.setFontSize(size);
  doc.setFont("times", "normal");
  doc.setTextColor(40, 46, 56);
  const lines = doc.splitTextToSize(
    pdfSafeText(text),
    CONTENT_W - indent,
  ) as string[];
  lines.forEach((line, i) => {
    ensureRoom(ctx, lineGap);
    if (i === 0) doc.text("•", MARGIN_X + 0.4, ctx.y);
    doc.text(line, MARGIN_X + indent, ctx.y);
    ctx.y += lineGap;
  });
}

function renderSection(ctx: DocCtx, s: MemoSection, index: number, dense: boolean): void {
  // Generous space before each section, then a heading + rule for a clean
  // top-of-section division.
  ctx.y += dense ? 3 : 4;
  ensureRoom(ctx, 14);
  const headingTop = ctx.y;
  const heading = `${String(index).padStart(2, "0")}  ${s.title}`;
  writeWrapped(ctx, heading, { size: dense ? 11 : 11.5, bold: true });
  drawSignalTag(ctx, s.signal, headingTop);
  drawHeadingRule(ctx);
  ctx.y += dense ? 1.4 : 1.8;

  if (s.summary && s.summary !== s.body) {
    writeWrapped(ctx, s.summary, {
      size: dense ? 9 : 9.5,
      bold: true,
      lineGap: dense ? 3.9 : 4.2,
    });
    ctx.y += dense ? 0.8 : 1.0;
  }
  if (s.bridge && s.bridge.length > 0) {
    drawBridge(ctx, s.bridge, dense);
    ctx.y += dense ? 0.6 : 0.8;
  }
  if (s.body) {
    writeWrapped(ctx, s.body, {
      size: dense ? 8.5 : 9,
      lineGap: dense ? 3.9 : 4.2,
    });
  }
  if (s.bullets && s.bullets.length > 0) {
    // Clear gap before the key-points group so it reads as its own block.
    ctx.y += dense ? 1.4 : 1.8;
    for (const b of s.bullets) {
      writeBullet(ctx, b, dense);
      ctx.y += dense ? 0.5 : 0.7;
    }
  }
  // The generic "Research source 1 · 2 · 3" line is intentionally NOT printed
  // — it added clutter with no information. Full sources live in the dashboard.
  ctx.y += dense ? 1.2 : 1.6;
}

// Compact print of a promoted supplementary panel: title + signal + one
// summary line + the bridge table. Body/bullets/sources are intentionally
// omitted in print (they live in the dashboard drawer) to protect the
// 3-page budget — the bridge IS the decision content here.
function renderSupplementaryPanelCompact(
  ctx: DocCtx,
  s: MemoSection,
  dense: boolean,
): void {
  ctx.y += dense ? 2.4 : 3;
  ensureRoom(ctx, 16);
  const headingTop = ctx.y;
  writeWrapped(ctx, s.title, { size: dense ? 10 : 10.5, bold: true });
  drawSignalTag(ctx, s.signal, headingTop);
  drawHeadingRule(ctx);
  ctx.y += dense ? 1.2 : 1.6;
  if (s.summary && s.summary !== s.body) {
    writeWrapped(ctx, s.summary, {
      size: dense ? 8.5 : 9,
      bold: true,
      lineGap: dense ? 3.7 : 4.0,
    });
    ctx.y += dense ? 0.6 : 0.8;
  }
  if (s.bridge && s.bridge.length > 0) {
    drawBridge(ctx, s.bridge, dense);
  }
  ctx.y += dense ? 1.0 : 1.4;
}

export async function downloadMemoPdf(
  memo: FollowUpMemo,
  filenameStem: string,
  opts: BuildMemoPdfOptions = {},
): Promise<void> {
  const blob = await buildMemoPdf(memo, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameStem}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
