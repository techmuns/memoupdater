import type jsPDF from "jspdf";
import type { FullResearchReport, ResearchReportSection } from "@shared/types";
import { pdfSafeText } from "./pdfText";

// Downloadable PDF of the complete internal research report. The dashboard no
// longer renders the long report inline — the analyst downloads it as a clean,
// searchable document (real embedded text, proper page breaks). We render the
// per-section markdown with a light markdown flow (headings, bullets, tables)
// plus each section's sources. jsPDF + deps are lazy-loaded on first download.

let JsPdfCtor: typeof jsPDF | null = null;
async function getJsPdfCtor(): Promise<typeof jsPDF> {
  if (JsPdfCtor) return JsPdfCtor;
  const mod = await import("jspdf");
  JsPdfCtor = mod.default;
  return JsPdfCtor;
}

// All measurements in mm. A4 = 210×297.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 16;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 18;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;
const FONT = "helvetica";

interface DocCtx {
  doc: jsPDF;
  y: number;
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
  opts: {
    size: number;
    bold?: boolean;
    italic?: boolean;
    lineGap?: number;
    color?: [number, number, number];
    indent?: number;
    width?: number;
    font?: string;
  },
): void {
  const { doc } = ctx;
  const font = opts.font ?? FONT;
  doc.setFont(font, opts.bold ? "bold" : opts.italic ? "italic" : "normal");
  doc.setFontSize(opts.size);
  doc.setTextColor(...(opts.color ?? [24, 27, 36]));
  const lineGap = opts.lineGap ?? opts.size * 0.5;
  const indent = opts.indent ?? 0;
  const width = (opts.width ?? CONTENT_W) - indent;
  const lines = doc.splitTextToSize(pdfSafeText(text), width) as string[];
  for (const line of lines) {
    ensureRoom(ctx, lineGap);
    doc.text(line, MARGIN_X + indent, ctx.y);
    ctx.y += lineGap;
  }
}

function drawRule(ctx: DocCtx, weight = 0.4, color: [number, number, number] = [206, 210, 220]): void {
  ensureRoom(ctx, 1.5);
  ctx.doc.setLineWidth(weight);
  ctx.doc.setDrawColor(...color);
  ctx.doc.line(MARGIN_X, ctx.y, PAGE_W - MARGIN_X, ctx.y);
  ctx.y += 2;
}

// ----- light markdown -> PDF flow -----------------------------------------

// Strip inline markdown so the plain text renders cleanly (jsPDF can't do
// mid-line bold anyway). Links collapse to their label.
function cleanInline(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/(\S)\*(\S)/g, "$1$2")
    .replace(/\s\*(\S)/g, " $1")
    .replace(/(\S)\*\s/g, "$1 ")
    .trim();
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function splitCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => cleanInline(c.trim()));
}

function renderTable(ctx: DocCtx, rows: string[]): void {
  const { doc } = ctx;
  const data = rows.filter((r) => !isTableSeparator(r)).map(splitCells);
  if (data.length === 0) return;
  const cols = Math.max(...data.map((r) => r.length));
  const colW = CONTENT_W / cols;
  const size = 8;
  const lineGap = size * 0.5;
  const padY = 1.4;
  ctx.y += 1;
  data.forEach((row, ri) => {
    const cells = Array.from({ length: cols }, (_, ci) => row[ci] ?? "");
    doc.setFont("courier", ri === 0 ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = cells.map((c) =>
      doc.splitTextToSize(pdfSafeText(c), colW - 2) as string[],
    );
    const rowH = padY * 2 + Math.max(...wrapped.map((w) => w.length)) * lineGap;
    ensureRoom(ctx, rowH);
    const top = ctx.y;
    if (ri === 0) {
      doc.setFillColor(238, 240, 247);
      doc.rect(MARGIN_X, top, CONTENT_W, rowH, "F");
    } else if (ri % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN_X, top, CONTENT_W, rowH, "F");
    }
    doc.setTextColor(ri === 0 ? 55 : 40, ri === 0 ? 65 : 46, ri === 0 ? 81 : 56);
    wrapped.forEach((linesArr, ci) => {
      linesArr.forEach((ln, li) => {
        doc.text(ln, MARGIN_X + ci * colW + 1, top + padY + size * 0.32 + li * lineGap);
      });
    });
    doc.setLineWidth(0.2);
    doc.setDrawColor(226, 229, 236);
    doc.line(MARGIN_X, top + rowH, PAGE_W - MARGIN_X, top + rowH);
    ctx.y = top + rowH;
  });
  ctx.y += 2;
}

function renderMarkdown(ctx: DocCtx, markdown: string): void {
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");
    if (isTableRow(line)) {
      const block: string[] = [];
      while (i < lines.length && isTableRow(lines[i].replace(/\s+$/, ""))) {
        block.push(lines[i].replace(/\s+$/, ""));
        i++;
      }
      renderTable(ctx, block);
      continue;
    }
    i++;
    const trimmed = line.trim();
    if (!trimmed) {
      ctx.y += 1.6;
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      ctx.y += 2;
      writeWrapped(ctx, cleanInline(heading[2]), {
        size: heading[1].length <= 2 ? 11 : 10,
        bold: true,
        color: [17, 24, 39],
        lineGap: 5,
      });
      ctx.y += 0.8;
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      writeBullet(ctx, cleanInline(bullet[1]));
      continue;
    }
    const numbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      writeBullet(ctx, `${numbered[1]}. ${cleanInline(numbered[2])}`, false);
      continue;
    }
    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      writeWrapped(ctx, cleanInline(quote[1]), {
        size: 9,
        italic: true,
        color: [90, 96, 108],
        indent: 3,
        lineGap: 4.4,
      });
      continue;
    }
    writeWrapped(ctx, cleanInline(trimmed), { size: 9.5, lineGap: 4.6 });
    ctx.y += 0.8;
  }
}

function writeBullet(ctx: DocCtx, text: string, showDot = true): void {
  const { doc } = ctx;
  const size = 9.5;
  const lineGap = 4.6;
  const indent = 4.2;
  doc.setFont(FONT, "normal");
  doc.setFontSize(size);
  doc.setTextColor(34, 40, 50);
  const lines = doc.splitTextToSize(pdfSafeText(text), CONTENT_W - indent) as string[];
  lines.forEach((ln, li) => {
    ensureRoom(ctx, lineGap);
    if (li === 0 && showDot) doc.text("•", MARGIN_X + 0.6, ctx.y);
    doc.text(ln, MARGIN_X + indent, ctx.y);
    ctx.y += lineGap;
  });
  ctx.y += 0.6;
}

function renderSources(ctx: DocCtx, section: ResearchReportSection): void {
  if (section.sources.length === 0) return;
  ctx.y += 1.6;
  writeWrapped(ctx, "Sources", {
    size: 7.5,
    bold: true,
    color: [120, 124, 132],
  });
  ctx.y += 0.4;
  section.sources.forEach((src) => {
    const label = src.title ? `${src.title} — ${src.url}` : src.url;
    const meta = src.date ? `${label}  ·  ${src.date}` : label;
    writeBullet(ctx, meta, true);
  });
}

export async function buildResearchPdf(report: FullResearchReport): Promise<Blob> {
  const Ctor = await getJsPdfCtor();
  const doc = new Ctor({ unit: "mm", format: "a4", compress: true });
  const ctx: DocCtx = { doc, y: MARGIN_TOP };

  // Cover header
  writeWrapped(ctx, `Full research — ${report.company}`, {
    size: 17,
    bold: true,
    color: [17, 24, 39],
    lineGap: 8,
  });
  const generated = new Date(report.generatedAt).toLocaleDateString("en-US", {
    dateStyle: "medium",
  });
  const meta = [
    report.ticker ? report.ticker : null,
    report.periodLabel ? report.periodLabel : null,
    `Generated ${generated}`,
    `${report.sections.length} sections`,
    "Confidential — internal research",
  ]
    .filter(Boolean)
    .join("  ·  ");
  writeWrapped(ctx, meta, { size: 8, color: [110, 116, 124], lineGap: 4 });
  ctx.y += 1.5;
  drawRule(ctx, 0.6);

  // Sections
  report.sections.forEach((section, i) => {
    ctx.y += 4;
    ensureRoom(ctx, 16);
    writeWrapped(ctx, `${String(i + 1).padStart(2, "0")}  ${section.title}`, {
      size: 12.5,
      bold: true,
      color: [30, 27, 90],
      lineGap: 6,
    });
    drawRule(ctx, 0.4, [199, 197, 240]);
    ctx.y += 1.2;

    renderMarkdown(ctx, section.markdown);

    if (section.notDisclosed && section.notDisclosed.length > 0) {
      ctx.y += 2;
      writeWrapped(ctx, "Not disclosed", {
        size: 8,
        bold: true,
        color: [120, 124, 132],
      });
      section.notDisclosed.forEach((n) => writeBullet(ctx, cleanInline(n)));
    }

    renderSources(ctx, section);
  });

  // Page numbers on every page.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont(FONT, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 154, 162);
    doc.text(
      `${report.company} · full research · ${p} / ${pages}`,
      MARGIN_X,
      PAGE_H - 8,
    );
  }

  return doc.output("blob");
}

export function researchFilenameStem(report: FullResearchReport): string {
  const dateIso = report.generatedAt.slice(0, 10);
  const slug = (report.ticker || report.company)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${slug || "research"}-full-research-${dateIso}`;
}

export async function downloadResearchPdf(report: FullResearchReport): Promise<void> {
  const blob = await buildResearchPdf(report);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${researchFilenameStem(report)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
