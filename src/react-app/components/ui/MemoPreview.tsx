import { useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText } from "lucide-react";
import { Panel } from "./Panel";
import { Badge } from "./Badge";

interface MemoPreviewSection {
  index: number;
  title: string;
  teaser: string;
}

const SECTIONS: MemoPreviewSection[] = [
  {
    index: 1,
    title: "Original Thesis Snapshot",
    teaser:
      "MarTech mix shift drags ARR quality up; Rule of 40 is the single number to track.",
  },
  {
    index: 2,
    title: "Q4 Financial Re-test",
    teaser:
      "Revenue +21%, ARR +24%, EBITDA margin 19.4% — on track. NRR 108% misses the 110% checkpoint.",
  },
  {
    index: 3,
    title: "Management Commentary",
    teaser:
      "Chain-level cross-sell landing in 3 named accounts; CFO floats 'capital return framework'.",
  },
  {
    index: 4,
    title: "AI / Macro Risk",
    teaser:
      "OTA-side LLM compression carves out B2B hotel distribution; RevPAR +3%, INR neutral.",
  },
  {
    index: 5,
    title: "Valuation & Peer Gap",
    teaser:
      "Fair value INR 792 base / INR 1,125 bull; rich on snapshot, cheap on ARR-growth differential.",
  },
  {
    index: 6,
    title: "Final Investment Action",
    teaser:
      "Hold at 3% weight. Add on NRR ≥110% or first buyback authorization. Trim on NRR <105%.",
  },
];

export function MemoPreview() {
  const navigate = useNavigate();

  return (
    <Panel
      eyebrow="Follow-up output"
      title="RateGain Follow-up Memo — Demo Output"
      actions={
        <button
          onClick={() => navigate("/output")}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-ink)] hover:text-[var(--color-ink-hover)]"
        >
          Open memo
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="flex items-center gap-2 mb-4">
        <Badge tone="ink" dot>
          Demo generated
        </Badge>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          9 sections · serif memo reader · sources audit rail
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {SECTIONS.map((s) => (
          <div
            key={s.index}
            className="flex gap-3 py-2 border-b border-[var(--color-border)] last:border-b-0 md:[&:nth-last-child(2)]:border-b-0"
          >
            <div className="shrink-0 w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] border border-[var(--color-border)] grid place-items-center">
              <FileText className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-[var(--color-text-subtle)] tnum">
                  0{s.index}
                </span>
                <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
                  {s.title}
                </h4>
              </div>
              <p
                className="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {s.teaser}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
