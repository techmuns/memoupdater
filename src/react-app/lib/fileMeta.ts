import type { DocumentKind } from "@shared/types";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

const EXTRACTABLE = new Set(["txt", "md", "markdown", "pdf"]);

export function extractionSupported(ext: string): boolean {
  return EXTRACTABLE.has(ext.toLowerCase());
}

export function extractionPlannedNext(ext: string): boolean {
  return ["docx", "doc", "rtf"].includes(ext.toLowerCase());
}

export function mimeForFile(file: File): string {
  if (file.type) return file.type;
  const ext = getExtension(file.name);
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "md":
    case "markdown":
      return "text/markdown";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export function describeKind(kind: DocumentKind): string {
  const map: Record<DocumentKind, string> = {
    initial_memo: "Initial memo",
    financials: "Financials",
    management_commentary: "Mgmt commentary",
    broker_notes: "Broker notes",
    competitor_notes: "Competitor notes",
    macro_notes: "Macro / AI",
    market_data: "Market data",
  };
  return map[kind];
}
