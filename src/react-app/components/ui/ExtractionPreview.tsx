import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { ExtractionResult, ExtractionStatus } from "@shared/types";
import { Panel } from "./Panel";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { snippet } from "../../lib/text";
import { formatBytes } from "../../lib/fileMeta";

interface ExtractionPreviewProps {
  status: ExtractionStatus;
  result: ExtractionResult | null;
  onGenerateDna: () => void;
  onReset: () => void;
  generatedDnaPending?: boolean;
}

export function ExtractionPreview({
  status,
  result,
  onGenerateDna,
  onReset,
  generatedDnaPending,
}: ExtractionPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (status === "idle" || !result) {
    return null;
  }

  if (status === "extracting") {
    return (
      <Panel eyebrow="Extraction" title="Reading the initial memo">
        <div className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-ink)]" />
          Extracting text in your browser… large PDFs may take a few seconds.
        </div>
      </Panel>
    );
  }

  const isSuccess = status === "success" || status === "partial";
  const tone =
    status === "success" ? "success" : status === "partial" ? "warning" : "down";

  return (
    <Panel
      eyebrow="Extraction"
      title="Initial memo · extracted text preview"
      actions={
        <div className="flex items-center gap-1.5">
          <StatusBadge status={status} />
          <Button
            size="sm"
            variant="ghost"
            onClick={onReset}
            leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge tone="neutral">
          {result.source.filename}
        </Badge>
        <Badge tone="neutral">
          .{result.source.extension || "?"} · {formatBytes(result.source.sizeBytes)}
        </Badge>
        {result.pageCount !== undefined && (
          <Badge tone="neutral">{result.pageCount} pages</Badge>
        )}
        {isSuccess && (
          <>
            <Badge tone="accent">{result.wordCount.toLocaleString()} words</Badge>
            <Badge tone="accent">{result.characterCount.toLocaleString()} chars</Badge>
          </>
        )}
      </div>

      {result.warnings.length > 0 && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] px-3 py-2 flex gap-2 items-start">
          <FileWarning className="w-3.5 h-3.5 text-[var(--color-warning)] mt-0.5 shrink-0" />
          <ul className="text-[12px] text-[var(--color-warning)] leading-relaxed space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {status === "error" && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-signal-down)_22%,white)] bg-[var(--color-signal-down-soft)] px-3 py-2 flex gap-2 items-start">
          <AlertCircle className="w-3.5 h-3.5 text-[var(--color-signal-down)] mt-0.5 shrink-0" />
          <div className="text-[12px] text-[var(--color-signal-down)] leading-relaxed">
            Extraction failed: {result.errorMessage ?? "Unknown error"}
          </div>
        </div>
      )}

      {isSuccess && result.text && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)] mb-2">
            Preview
          </div>
          <div
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-[13px] leading-relaxed text-[var(--color-text)] whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {expanded ? result.text : snippet(result.text, 600)}
          </div>

          {result.text.length > 600 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-ink)] hover:text-[var(--color-ink-hover)]"
            >
              {expanded ? (
                <>
                  Collapse <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  Expand full text <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}

          <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[12px] text-[var(--color-text-muted)] leading-relaxed max-w-md">
              Heuristic v0 generates a deterministic Memo DNA draft from the
              extracted text. Real LLM extraction lands in Phase 3.
            </div>
            <Button
              onClick={onGenerateDna}
              disabled={generatedDnaPending}
              leadingIcon={
                generatedDnaPending ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
              trailingIcon={<ArrowRight className="w-4 h-4" />}
            >
              {generatedDnaPending ? "DNA generated" : "Generate Memo DNA"}
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function StatusBadge({ status }: { status: ExtractionStatus }) {
  const label = {
    idle: "Idle",
    extracting: "Extracting",
    success: "Success",
    partial: "Partial",
    unsupported: "Unsupported",
    error: "Error",
  }[status];

  const tone: "neutral" | "success" | "warning" | "down" = {
    idle: "neutral" as const,
    extracting: "neutral" as const,
    success: "success" as const,
    partial: "warning" as const,
    unsupported: "warning" as const,
    error: "down" as const,
  }[status];

  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
