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
  // Default baseline-to-baseline = font size × 0.46 (was 0.42). The tighter
  // value was just shy of safe — a wrapped 9.5pt summary's cap-height could
  // catch the trailing rule of a heading above it; the looser default gives
  // every block consistent breathing room without lengthening the memo.
  const lineGap = opts.lineGap ?? opts.size * 0.46;
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

function drawBridge(
  ctx: DocCtx,
  rows: NonNullable<MemoSection["bridge"]>,
  dense: boolean,
  scale = 1,
): void {
  if (rows.length === 0) return;
  const { doc } = ctx;
  const cellSize = (dense ? 7.5 : 8) * scale;
  const lineGap = cellSize * 0.46; // baseline-to-baseline within a cell
  // Box-model paddings in MILLIMETRES (absolute), so a tall wrapped cell can
  // never visually collide with the row above/below regardless of the font
  // size. Previously these were fractions of lineGap; at 7.5pt that left only
  // ~3.6 pt between the descender of a wrapped line and the row divider —
  // close enough to read as an overlap. 1.8 mm top + 1.6 mm bottom gives a
  // comfortable, consistent clearance.
  const topPad = 1.8 * scale;
  const botPad = 1.6 * scale;
  const ascent = cellSize * 0.30; // baseline-from-row-top offset (a bit under the cap height)
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

// Hard cap on the final printed memo. EVERY company, EVERY AMC, every memo
// must fit. We enforce it by rendering at progressively denser typography
// until the page count satisfies it.
const MAX_PAGES = 3;

// Tiered density. Each tier nudges fonts and margins tighter; the outer
// builder walks the tiers until the rendered memo fits MAX_PAGES.
interface DensityTier {
  label: string;
  dense: boolean; // controls per-section "dense" branches
  scale: number; // additional uniform shrink applied on top of dense=true
  manualChecksCap: number;
}
const DENSITY_TIERS: readonly DensityTier[] = [
  { label: "comfortable", dense: false, scale: 1.0, manualChecksCap: 5 },
  { label: "dense", dense: true, scale: 1.0, manualChecksCap: 4 },
  { label: "tight", dense: true, scale: 0.94, manualChecksCap: 3 },
  { label: "max-compress", dense: true, scale: 0.88, manualChecksCap: 2 },
];

export async function buildMemoPdf(
  memo: FollowUpMemo,
  opts: BuildMemoPdfOptions = {},
): Promise<Blob> {
  const panels = selectPrintedPanels(memo);
  // Pre-pick a starting tier from a char-count heuristic, then upgrade tiers
  // until the rendered output fits the 3-page budget. The retry is cheap
  // (jsPDF is in-memory, no I/O) and bounds the outcome regardless of how
  // verbose the model's section text is.
  const chars = visibleCharCount(memo, panels);
  const startIdx = chars > 7_500 ? 1 : 0;
  let lastBlob: Blob | null = null;
  for (let i = startIdx; i < DENSITY_TIERS.length; i++) {
    const tier = DENSITY_TIERS[i];
    const { doc, pageCount } = await buildMemoPdfAtTier(memo, panels, opts, tier);
    lastBlob = doc.output("blob");
    if (pageCount <= MAX_PAGES) return lastBlob;
  }
  // Even the tightest tier overflowed — return its output. (In practice we'd
  // truncate further, but going below max-compress hurts readability more
  // than a fourth page does.)
  return lastBlob!;
}

async function buildMemoPdfAtTier(
  memo: FollowUpMemo,
  panels: MemoSection[],
  opts: BuildMemoPdfOptions,
  tier: DensityTier,
): Promise<{ doc: jsPDF; pageCount: number }> {
  const dense = tier.dense;
  const s = tier.scale;
  const ctx = await newCtx(dense);
  const { doc } = ctx;

  // Header
  writeWrapped(ctx, memo.title, {
    size: (dense ? 13 : 14) * s,
    bold: true,
  });
  const date = new Date(memo.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" });
  const metaParts = [
    `Generated ${date}`,
    opts.researchWindowLabel ?? null,
    "Confidential — internal research draft",
  ].filter(Boolean) as string[];
  writeWrapped(ctx, metaParts.join("  ·  "), {
    size: 7.5 * s,
    color: [110, 116, 124],
    lineGap: 3.2 * s,
  });
  ctx.y += 1;
  drawHr(ctx, 0.6);

  // Core sections
  memo.sections.forEach((sec, i) => {
    renderSection(ctx, sec, i + 1, dense, s);
  });

  // Promoted supplementary panels — valuation bridge + memo-vs-actual
  // financials, compact (table-first; full prose stays in the dashboard).
  if (panels.length > 0) {
    ctx.y += (dense ? 3 : 4) * s;
    drawHr(ctx, 0.6);
    ctx.y += 0.5;
    writeWrapped(ctx, "VALUATION & FINANCIALS DETAIL", {
      size: (dense ? 8 : 8.5) * s,
      bold: true,
      color: [67, 56, 202],
      lineGap: (dense ? 3.4 : 3.6) * s,
    });
    ctx.y += (dense ? 0.6 : 0.8) * s;
    for (const p of panels) {
      renderSupplementaryPanelCompact(ctx, p, dense, s);
    }
  }

  // Manual checks — capped per tier so a long list can't overflow the page
  // budget. Truncated lines are surfaced as 'See dashboard for full list'.
  const checks = memo.manualChecksRemaining ?? [];
  if (checks.length > 0) {
    ctx.y += (dense ? 3 : 4) * s;
    ensureRoom(ctx, 12);
    writeWrapped(ctx, "Manual checks remaining", {
      size: (dense ? 10 : 10.5) * s,
      bold: true,
    });
    drawHeadingRule(ctx);
    ctx.y += (dense ? 1.2 : 1.6) * s;
    const cap = tier.manualChecksCap;
    const shown = checks.slice(0, cap);
    for (const m of shown) {
      writeBullet(ctx, m, dense, s);
      ctx.y += (dense ? 0.5 : 0.7) * s;
    }
    if (checks.length > cap) {
      writeBullet(
        ctx,
        `…and ${checks.length - cap} more — see the dashboard for the full list.`,
        dense,
        s,
      );
    }
  }

  // Footer caveat on the LAST page only — placed after content rendering so it
  // sits on whichever page the doc ended on, not page 1.
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  ctx.y = PAGE_H - MARGIN_BOTTOM - 6;
  drawHr(ctx, 0.3);
  writeWrapped(
    ctx,
    "Draft for research support — not investment advice; analyst sign-off required.  The full EPS-credibility bridge and per-section sources are available in the dashboard.",
    { size: 7 * s, color: [130, 135, 142] },
  );

  return { doc, pageCount: doc.getNumberOfPages() };
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
// "clear division between blocks" marker. The trailing gap is sized in mm
// (not as a fraction of a font size) so the next block's glyphs always clear
// the rule by a comfortable margin regardless of typography.
function drawHeadingRule(ctx: DocCtx): void {
  ctx.y += 0.8;
  ctx.doc.setLineWidth(0.3);
  ctx.doc.setDrawColor(209, 213, 219);
  ctx.doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  // Trailing gap large enough that a 9.5pt summary's cap-height (~2.35mm)
  // still has ~1mm clearance to the rule, instead of crossing it.
  ctx.y += 3.4;
}

// One bullet with a HANGING indent — the glyph sits at the margin and wrapped
// lines align under the text, not under the bullet. Far more readable than the
// old inline "• text" which wrapped back to the margin.
function writeBullet(
  ctx: DocCtx,
  text: string,
  dense: boolean,
  scale = 1,
): void {
  const { doc } = ctx;
  const size = (dense ? 8.5 : 9) * scale;
  const lineGap = (dense ? 4.2 : 4.5) * scale;
  const indent = 4.0 * scale;
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

function renderSection(
  ctx: DocCtx,
  s: MemoSection,
  index: number,
  dense: boolean,
  scale = 1,
): void {
  // Generous space before each section, then a heading + rule for a clean
  // top-of-section division.
  ctx.y += (dense ? 3 : 4) * scale;
  ensureRoom(ctx, 14 * scale);
  const headingTop = ctx.y;
  const heading = `${String(index).padStart(2, "0")}  ${s.title}`;
  writeWrapped(ctx, heading, { size: (dense ? 11 : 11.5) * scale, bold: true });
  drawSignalTag(ctx, s.signal, headingTop);
  drawHeadingRule(ctx);
  // drawHeadingRule already leaves a comfortable trailing gap; no extra advance.

  if (s.summary && s.summary !== s.body) {
    writeWrapped(ctx, s.summary, {
      size: (dense ? 9 : 9.5) * scale,
      bold: true,
      lineGap: (dense ? 4.2 : 4.5) * scale,
    });
    ctx.y += (dense ? 1.4 : 1.8) * scale;
  }
  if (s.bridge && s.bridge.length > 0) {
    drawBridge(ctx, s.bridge, dense, scale);
    ctx.y += (dense ? 1.2 : 1.6) * scale;
  }
  if (s.body) {
    writeWrapped(ctx, s.body, {
      size: (dense ? 8.5 : 9) * scale,
      lineGap: (dense ? 4.2 : 4.5) * scale,
    });
  }
  if (s.bullets && s.bullets.length > 0) {
    // Clear gap before the key-points group so it reads as its own block.
    ctx.y += (dense ? 1.8 : 2.2) * scale;
    for (const b of s.bullets) {
      writeBullet(ctx, b, dense, scale);
      ctx.y += (dense ? 0.8 : 1.0) * scale;
    }
  }
  // The generic "Research source 1 · 2 · 3" line is intentionally NOT printed
  // — it added clutter with no information. Full sources live in the dashboard.
  ctx.y += (dense ? 1.2 : 1.6) * scale;
}

// Compact print of a promoted supplementary panel: title + signal + one
// summary line + the bridge table. Body/bullets/sources are intentionally
// omitted in print (they live in the dashboard drawer) to protect the
// 3-page budget — the bridge IS the decision content here.
function renderSupplementaryPanelCompact(
  ctx: DocCtx,
  s: MemoSection,
  dense: boolean,
  scale = 1,
): void {
  ctx.y += (dense ? 2.4 : 3) * scale;
  ensureRoom(ctx, 16 * scale);
  const headingTop = ctx.y;
  writeWrapped(ctx, s.title, {
    size: (dense ? 10 : 10.5) * scale,
    bold: true,
  });
  drawSignalTag(ctx, s.signal, headingTop);
  drawHeadingRule(ctx);
  if (s.summary && s.summary !== s.body) {
    writeWrapped(ctx, s.summary, {
      size: (dense ? 8.5 : 9) * scale,
      bold: true,
      lineGap: (dense ? 4.0 : 4.3) * scale,
    });
    ctx.y += (dense ? 1.2 : 1.6) * scale;
  }
  if (s.bridge && s.bridge.length > 0) {
    drawBridge(ctx, s.bridge, dense, scale);
  }
  ctx.y += (dense ? 1.4 : 1.8) * scale;
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
