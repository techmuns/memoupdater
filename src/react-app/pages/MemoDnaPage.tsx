import { useNavigate } from "react-router-dom";
import { ArrowRight, Quote, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { ThesisMap } from "../components/ui/ThesisMap";
import { useMemoProject } from "../state/MemoProjectContext";

export function MemoDnaPage() {
  const navigate = useNavigate();
  const { currentDna, currentMode, state, setMode, resetExtracted } =
    useMemoProject();
  const dna = currentDna;
  const isExtracted = currentMode === "extracted" && state.extractedDna;
  const hasBothModes = Boolean(state.extractedDna && state.demoDna);

  if (!dna) {
    return (
      <EmptyState
        title="Loading Memo DNA…"
        description="Fetching demo extraction"
      />
    );
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 2 · Memo DNA"
        title={
          isExtracted
            ? "Extracted Memo DNA from uploaded memo"
            : "Demo Memo DNA"
        }
        description={
          isExtracted
            ? `Heuristic v0 fingerprint derived from ${state.extraction?.source.filename ?? "your uploaded memo"}.`
            : "The structural fingerprint of the RateGain reference memo — thesis, assumptions, voice, valuation logic, and what to re-test."
        }
        actions={
          <Button
            onClick={() => navigate("/builder")}
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue to Builder
          </Button>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        {isExtracted ? (
          <Badge tone="success" dot>
            Extracted · Heuristic v0
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            Demo Memo DNA
          </Badge>
        )}
        <span className="text-[12px] text-[var(--color-text-muted)]">
          {isExtracted
            ? "Rule-based extraction. Real LLM extraction lands in Phase 3."
            : "Mock RateGain DNA. Upload a memo on Intake to switch into extracted mode."}
        </span>
        {hasBothModes && (
          <div className="ml-auto inline-flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden text-[11px] font-semibold">
            <button
              onClick={() => setMode("demo")}
              className={`px-2.5 py-1 ${
                currentMode === "demo"
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              Demo
            </button>
            <button
              onClick={() => setMode("extracted")}
              className={`px-2.5 py-1 ${
                currentMode === "extracted"
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              Extracted
            </button>
          </div>
        )}
        {state.extractedDna && (
          <button
            onClick={resetExtracted}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-ink)] hover:text-[var(--color-ink-hover)]"
          >
            <RefreshCw className="w-3 h-3" /> Reset to demo
          </button>
        )}
      </div>

      {/* Scorecard strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Scorecard
          label="Mode"
          value={isExtracted ? "Live extraction" : "Demo data"}
          hint={
            isExtracted
              ? state.extraction?.source.filename
              : "RateGain reference"
          }
          tone={isExtracted ? "up" : "accent"}
        />
        <Scorecard
          label="Thesis checkpoints"
          value={`${dna.thesisCheckpoints.length}`}
          hint="Tracked to re-test"
          tone="accent"
        />
        <Scorecard
          label="Risk categories"
          value={`${dna.riskChecklist.length}`}
          hint="Surfaced by heuristic"
          tone="accent"
        />
        <Scorecard
          label="Target multiple"
          value={dna.valuationFramework.targetMultiple}
          hint={dna.valuationFramework.method}
          tone="accent"
        />
      </div>

      {/* Two-column hero: thesis + style fingerprint */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Panel
          eyebrow="Original thesis"
          title="What the memo argues"
          className="lg:col-span-3"
        >
          <p
            className="text-[14px] leading-relaxed text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {dna.originalThesis}
          </p>
          <div className="hairline my-5" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)] mb-2">
              Key assumptions
            </div>
            <BulletList items={dna.keyAssumptions} />
          </div>
        </Panel>

        <Panel
          eyebrow="Voice fingerprint"
          title="How the memo speaks"
          className="lg:col-span-2"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-subtle)] mb-2">
            House voice
          </div>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {dna.styleTone.adjectives.map((a) => (
              <Badge key={a} tone="accent">
                {a}
              </Badge>
            ))}
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-subtle)] mb-2">
            Sample sentences
          </div>
          <ul className="space-y-2">
            {dna.styleTone.sampleSentences.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-[12.5px] text-[var(--color-text)] leading-relaxed"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                <Quote className="w-3 h-3 text-[var(--color-ink)] mt-1 shrink-0" />
                <span className="italic">{s}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Framework + valuation bridge */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Panel
          eyebrow="Analytical framework"
          title="How we read the company"
          className="lg:col-span-3"
        >
          <BulletList items={dna.analyticalFramework} />
        </Panel>

        <Panel
          eyebrow="Valuation"
          title="Bridge to fair value"
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-2 gap-2 mb-4">
            <MiniStat k="Method" v={dna.valuationFramework.method} />
            <MiniStat k="Multiple" v={dna.valuationFramework.targetMultiple} />
          </div>
          <BulletList items={dna.valuationFramework.bridgeNotes} compact />
        </Panel>
      </div>

      {/* Thesis checkpoints */}
      <Panel
        eyebrow="Thesis checkpoints"
        title="What we re-test next quarter"
        actions={
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {dna.thesisCheckpoints.length} tracked
          </span>
        }
      >
        {dna.thesisCheckpoints.length > 0 ? (
          <ThesisMap checkpoints={dna.thesisCheckpoints} columns={2} />
        ) : (
          <p className="text-[12px] text-[var(--color-text-subtle)] italic">
            Heuristic v0 did not detect explicit checkpoints. Real LLM
            extraction in Phase 3 will pull every testable claim from the memo.
          </p>
        )}
      </Panel>

      {/* Open questions + risk retest */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Panel
          eyebrow="Open questions"
          title="Forced re-tests"
          className="lg:col-span-2"
        >
          <BulletList items={dna.openQuestions} />
        </Panel>

        <Panel
          eyebrow="Risk checklist"
          title="What could break the thesis"
          className="lg:col-span-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dna.riskChecklist.map((r) => (
              <div
                key={r.category}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] mb-1.5">
                  {r.category}
                </div>
                <BulletList items={r.risks} compact />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Scorecard({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "up" | "down" | "flat";
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <Badge tone={tone} dot>
          {tone === "accent" ? "Anchor" : tone}
        </Badge>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
          {label}
        </span>
      </div>
      <div className="tnum text-[18px] font-semibold text-[var(--color-text)] mt-1.5 tracking-tight">
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}

function MiniStat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        {k}
      </div>
      <div className="text-[12.5px] font-medium text-[var(--color-text)] mt-0.5 leading-tight">
        {v}
      </div>
    </div>
  );
}

function BulletList({
  items,
  compact,
}: {
  items: string[];
  compact?: boolean;
}) {
  return (
    <ul
      className={
        compact
          ? "space-y-1.5 text-[12px] text-[var(--color-text)] leading-relaxed"
          : "space-y-2 text-[13px] text-[var(--color-text)] leading-relaxed"
      }
    >
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span
            className="w-1 h-1 rounded-full bg-[var(--color-ink)] mt-2 shrink-0"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
