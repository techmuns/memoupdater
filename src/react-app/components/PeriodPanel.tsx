import { AlertCircle } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Panel } from "./ui/Panel";
import { useMemoProject } from "../state/MemoProjectContext";

const CONFIDENCE_TONE = {
  high: "success",
  medium: "accent",
  low: "warning",
} as const;

export function PeriodPanel() {
  const { state, effectiveDetection, setPeriodOverride } = useMemoProject();
  const detection = state.detection;
  const eff = effectiveDetection;
  if (!detection || !eff) return null;

  const ticker = detection.detectedTicker;
  const companyConfidence = detection.companyDetectionConfidence;
  const companyReason = detection.companyDetectionReason;
  const showCompanyHint =
    Boolean(companyReason) &&
    (companyConfidence === "medium" || companyConfidence === "low");
  const writtenOn = detection.memoWrittenOn;
  const writtenOnConfidence = detection.memoWrittenOnConfidence;
  const writtenOnReason = detection.memoWrittenOnReason;
  const writtenOnRaw = detection.memoWrittenOnRaw;

  return (
    <Panel
      eyebrow="Step 2"
      title="Detected memo period"
      actions={
        <div className="flex items-center gap-2">
          {ticker && (
            <Badge tone="neutral">
              <span className="font-mono">{ticker}</span>
            </Badge>
          )}
          <Badge tone={CONFIDENCE_TONE[detection.confidence]} dot>
            {detection.confidence} confidence
          </Badge>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Detected company"
          value={eff.detectedCompany}
          placeholder="(detected from memo or filename)"
          onChange={(v) => setPeriodOverride({ detectedCompany: v })}
        />
        <Field
          label="Memo written on (deterministic)"
          value={writtenOn ?? ""}
          placeholder="YYYY-MM-DD — extracted from memo header / 'Dated:' / 'as of'"
          readOnly
          monospace
        />
        <Field
          label="Latest period (label only)"
          value={eff.periodLabel}
          placeholder="e.g. Q4 FY26 or May 2026"
          onChange={(v) => setPeriodOverride({ periodLabel: v })}
        />
        <Field
          label="Research current (today)"
          value={eff.researchCurrent}
          readOnly
          monospace
        />
        <Field
          label="Research start (ISO month)"
          value={eff.researchStart ?? ""}
          placeholder="YYYY-MM"
          onChange={(v) => setPeriodOverride({ researchStart: v || undefined })}
          monospace
        />
      </div>

      {writtenOn && writtenOnConfidence && (
        <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)] leading-snug">
          Memo date confidence:{" "}
          <span className="font-semibold">{writtenOnConfidence}</span>
          {writtenOnRaw ? ` — matched on "${writtenOnRaw}"` : ""}
          {writtenOnReason ? `. ${writtenOnReason}.` : "."}
          {writtenOnConfidence !== "high" &&
            " Override in the field above if the auto-pick is wrong."}
        </p>
      )}
      {!writtenOn && (
        <p className="mt-2 text-[11.5px] text-[var(--color-warning)] leading-snug inline-flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          No memo date was extracted. Return-period and CAGR calculations will
          be skipped until a date is available.
        </p>
      )}

      {showCompanyHint && (
        <p className="mt-3 text-[11.5px] text-[var(--color-text-muted)] leading-snug">
          Company detector: {companyReason} Please confirm the company name above.
        </p>
      )}

      {eff.assumptionNotes.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {eff.assumptionNotes.map((note) => (
            <li
              key={note}
              className="text-[11.5px] text-[var(--color-warning)] inline-flex items-start gap-1.5 leading-snug"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] text-[var(--color-text-subtle)] mt-4 leading-relaxed">
        These fields are editable — the worker uses whatever you confirm here.
        Fiscal-year and quarter labels are NOT silently mapped to calendar
        months; set the research start manually when needed.
      </p>
    </Panel>
  );
}

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  monospace?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

function Field({
  label,
  value,
  placeholder,
  monospace,
  readOnly,
  onChange,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink-soft)] ${
          monospace ? "font-mono" : ""
        } ${readOnly ? "bg-[var(--color-surface-muted)] cursor-default" : ""}`}
      />
    </label>
  );
}
