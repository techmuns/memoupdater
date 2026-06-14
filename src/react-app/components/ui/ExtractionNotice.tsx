import { AlertCircle, FileWarning } from "lucide-react";
import type { ExtractionResult, ExtractionStatus } from "@shared/types";

interface ExtractionNoticeProps {
  status: ExtractionStatus;
  result: ExtractionResult | null;
}

// Replaces the old "extracted text preview" panel. That panel printed the raw
// pdf.js text layer, which (a) duplicated the clean Memo Intelligence analysis
// and the "Memo loaded · N words" readiness tile, and (b) looked low-quality
// because the pdf.js text layer carries glyph-run spacing artifacts. The text
// itself still feeds DNA / period detection / the LLM — we just stopped
// showing the raw blob.
//
// This notice stays SILENT on a clean extraction and surfaces only what the
// user must act on: an unsupported / scanned file, a partial read, or an
// error. Those reasons were previously only visible in this panel; the
// readiness strip shows them at high level only.
export function ExtractionNotice({ status, result }: ExtractionNoticeProps) {
  if (!result) return null;
  if (status === "idle" || status === "extracting" || status === "success") {
    return null;
  }

  const isError = status === "error";
  const messages = isError
    ? [result.errorMessage ?? "Unknown extraction error."]
    : result.warnings;
  if (messages.length === 0) return null;

  const title =
    status === "unsupported"
      ? "Couldn't read this file"
      : isError
        ? "Extraction failed"
        : "Memo read with caveats";

  const tone = isError
    ? {
        border: "border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)]",
        bg: "bg-[var(--color-signal-down-soft)]",
        fg: "text-[var(--color-signal-down)]",
        Icon: AlertCircle,
      }
    : {
        border: "border-[color-mix(in_srgb,var(--color-warning)_22%,white)]",
        bg: "bg-[var(--color-warning-soft)]",
        fg: "text-[var(--color-warning)]",
        Icon: FileWarning,
      };
  const Icon = tone.Icon;

  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-xl)] border ${tone.border} ${tone.bg} px-4 py-3 flex items-start gap-3`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone.fg}`} />
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-semibold ${tone.fg}`}>{title}</div>
        <ul className="mt-1 space-y-1">
          {messages.map((m, i) => (
            <li
              key={i}
              className="text-[12px] text-[var(--color-text-muted)] leading-snug"
            >
              {m}
            </li>
          ))}
        </ul>
        {status === "unsupported" && (
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-subtle)] leading-snug">
            Supported formats: .txt, .md, and text-based .pdf. Scanned or
            image-only PDFs need OCR first.
          </p>
        )}
      </div>
    </div>
  );
}
