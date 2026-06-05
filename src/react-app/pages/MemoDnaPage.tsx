import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle, Quote } from "lucide-react";
import { api } from "../lib/api";
import type { MemoDNA } from "@shared/types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { ThesisMap } from "../components/ui/ThesisMap";

export function MemoDnaPage() {
  const navigate = useNavigate();
  const [dna, setDna] = useState<MemoDNA | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .demoMemoDna()
      .then(setDna)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-8 h-8" />}
        title="Could not load demo DNA"
        description={error}
      />
    );
  }

  if (!dna) {
    return (
      <EmptyState
        title="Loading demo DNA…"
        description="Fetching /api/demo/memo-dna"
      />
    );
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 2 · Memo DNA"
        title="Extracted memo DNA"
        description="The structural fingerprint of the original memo — thesis, assumptions, voice, valuation logic, and what to re-test in the next quarter."
        actions={
          <Button
            onClick={() => navigate("/builder")}
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue to Builder
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone="warning" dot>
          Demo extraction
        </Badge>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          Real LLM-driven parsing arrives in Phase 2. Current data is
          deterministic and sourced from the RateGain demo project.
        </span>
      </div>

      {/* Scorecard strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Scorecard
          label="Recurring rev mix"
          value="≥85% by FY27"
          hint="Mix shift to MarTech drags ARR quality up"
          tone="up"
        />
        <Scorecard
          label="ARR growth"
          value=">25% YoY"
          hint="MarTech 30%+ pulls blended growth"
          tone="up"
        />
        <Scorecard
          label="Rule of 40"
          value="≥35 by Q4 FY27"
          hint="Single number we track"
          tone="up"
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
          title="What the original memo argues"
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
            <MiniStat
              k="Method"
              v={dna.valuationFramework.method}
            />
            <MiniStat
              k="Multiple"
              v={dna.valuationFramework.targetMultiple}
            />
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
        <ThesisMap checkpoints={dna.thesisCheckpoints} columns={2} />
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
