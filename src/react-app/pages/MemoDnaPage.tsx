import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import type { MemoDNA } from "@shared/types";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";

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
      <EmptyState title="Loading demo DNA..." description="Fetching /api/demo/memo-dna" />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Step 2 · Memo DNA"
        title="Extracted memo DNA"
        description="The structural fingerprint of the original memo — thesis, assumptions, tone, valuation logic, and what to re-test."
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
        <Badge tone="warning">Demo extraction</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          Real parsing to be added later — this is deterministic placeholder
          data sourced from the RateGain demo project.
        </span>
      </div>

      <Section title="Original thesis">
        <p className="text-sm leading-relaxed text-[var(--color-text)]">
          {dna.originalThesis}
        </p>
      </Section>

      <Section title="Key assumptions">
        <BulletList items={dna.keyAssumptions} />
      </Section>

      <Section title="Style and tone">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
              House voice
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dna.styleTone.adjectives.map((a) => (
                <Badge key={a} tone="accent">
                  {a}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-subtle)] mb-2">
              Sample sentences
            </div>
            <ul className="space-y-2 text-sm text-[var(--color-text)] leading-relaxed">
              {dna.styleTone.sampleSentences.map((s, i) => (
                <li key={i} className="pl-3 border-l-2 border-[var(--color-border-strong)] italic">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Analytical framework">
        <BulletList items={dna.analyticalFramework} />
      </Section>

      <Section title="Valuation framework">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Stat label="Method" value={dna.valuationFramework.method} />
          <Stat
            label="Target multiple"
            value={dna.valuationFramework.targetMultiple}
          />
          <Stat label="Checkpoints" value={`${dna.thesisCheckpoints.length} tracked`} />
        </div>
        <BulletList items={dna.valuationFramework.bridgeNotes} />
      </Section>

      <Section title="Open questions to retest">
        <BulletList items={dna.openQuestions} />
      </Section>

      <Section title="Risk checklist">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dna.riskChecklist.map((r) => (
            <Card key={r.category} className="bg-[var(--color-surface-muted)]">
              <CardBody>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  {r.category}
                </h4>
                <BulletList items={r.risks} compact />
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          {title}
        </h2>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
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
          ? "space-y-1.5 text-xs text-[var(--color-text)] leading-relaxed"
          : "space-y-2 text-sm text-[var(--color-text)] leading-relaxed"
      }
    >
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-[var(--color-accent)] mt-0.5">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 bg-[var(--color-surface-muted)] rounded-md border border-[var(--color-border)]">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--color-text)] mt-1">
        {value}
      </div>
    </div>
  );
}
