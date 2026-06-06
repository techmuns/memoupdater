import { useNavigate } from "react-router-dom";
import {
  FileText,
  Fingerprint,
  Layers,
  FileCheck2,
  ArrowRight,
  Compass,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Hero } from "../components/ui/Hero";
import {
  WorkflowTimeline,
  type WorkflowStep,
} from "../components/ui/WorkflowTimeline";
import { SignalCard } from "../components/ui/SignalCard";
import { MemoPreview } from "../components/ui/MemoPreview";
import { useMemoProject } from "../state/MemoProjectContext";
import { describeKind } from "../lib/fileMeta";

export function OverviewPage() {
  const navigate = useNavigate();
  const { currentDna, currentMode, state } = useMemoProject();

  const uploadEntries = Object.values(state.uploads).filter(
    (u): u is NonNullable<typeof u> => Boolean(u),
  );
  const uploadCount = uploadEntries.length;
  const updatePackCount = uploadEntries.filter(
    (u) => u.kind !== "initial_memo",
  ).length;
  const totalUpdateSlots = 6;
  const hasExtraction = Boolean(state.extraction);
  const isLive = currentMode === "extracted" && state.extractedDna;

  const steps: WorkflowStep[] = [
    {
      id: "initial",
      index: 1,
      icon: FileText,
      title: "Initial Memo",
      input: ".txt · .md · .pdf",
      output: "Browser-extracted text",
      state: hasExtraction ? "complete" : "active",
    },
    {
      id: "dna",
      index: 2,
      icon: Fingerprint,
      title: "Memo DNA",
      input: "Initial memo",
      output: isLive ? "Extracted (Heuristic v0)" : "Demo DNA",
      state: isLive ? "complete" : hasExtraction ? "active" : "upcoming",
    },
    {
      id: "update",
      index: 3,
      icon: Layers,
      title: "Update Pack",
      input: `${updatePackCount} / ${totalUpdateSlots} loaded`,
      output: "Re-test evidence",
      state:
        updatePackCount === totalUpdateSlots
          ? "complete"
          : updatePackCount > 0
            ? "active"
            : "upcoming",
    },
    {
      id: "followup",
      index: 4,
      icon: FileCheck2,
      title: "Follow-up Memo",
      input: "DNA + update pack",
      output: "9-section memo in house voice",
      state: "upcoming",
    },
  ];

  return (
    <div className="space-y-7">
      <Hero
        eyebrow={isLive ? "Workbench · Live extraction" : "Workbench · Demo"}
        title="Memo Updater Workbench"
        description={
          isLive
            ? `Reading ${state.extraction?.source.filename}. Heuristic v0 has generated a Memo DNA draft — open Memo DNA to inspect, or upload more pack material on Intake.`
            : "Take an existing house-style investment memo, re-test it against the latest financials, transcripts, and broker / macro material, and ship a follow-up memo in the same voice. Wired end-to-end on a RateGain demo."
        }
        chips={
          <>
            {isLive ? (
              <Badge tone="success" dot>
                Live extracted memo
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Demo data
              </Badge>
            )}
            <Badge tone="accent" dot>
              RateGain reference
            </Badge>
            <Badge tone="neutral" dot>
              No cloud storage yet
            </Badge>
          </>
        }
        primaryAction={
          <Button
            size="lg"
            onClick={() => navigate("/intake")}
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          >
            {hasExtraction ? "Continue intake" : "Start Memo Update"}
          </Button>
        }
        secondaryAction={
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/memo-dna")}
          >
            Inspect Memo DNA
          </Button>
        }
      />

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Pipeline
            </div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text)] tracking-tight mt-0.5">
              Memo update workflow
            </h2>
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {isLive ? "Stage: Update Pack" : "Stage: Initial Memo"}
          </span>
        </div>
        <WorkflowTimeline steps={steps} />
      </section>

      <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SignalCard
            icon={Compass}
            eyebrow="Original Thesis Map"
            title={
              isLive
                ? "Extracted thesis anchors"
                : "Buy-side conviction anchors"
            }
            footer={
              <button
                onClick={() => navigate("/memo-dna")}
                className="inline-flex items-center gap-1 text-[var(--color-ink)] font-medium hover:text-[var(--color-ink-hover)]"
              >
                Open Memo DNA <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {currentDna && currentDna.thesisCheckpoints.length > 0 ? (
              <ul className="space-y-2">
                {currentDna.thesisCheckpoints.slice(0, 4).map((cp) => (
                  <li key={cp.id} className="flex items-start gap-2">
                    <Badge tone={cp.expectedDirection} dot>
                      {cp.expectedDirection}
                    </Badge>
                    <span className="text-[12.5px] text-[var(--color-text)] leading-snug">
                      {cp.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] italic text-[var(--color-text-subtle)]">
                Loading thesis anchors…
              </p>
            )}
          </SignalCard>

          <SignalCard
            icon={PackageCheck}
            eyebrow="Update Pack Readiness"
            title={
              uploadCount > 0
                ? `${uploadCount} / 7 slots populated`
                : "7 / 7 demo files loaded"
            }
            metric={uploadCount > 0 ? `${uploadCount}` : "7"}
            metricSub={
              uploadCount > 0
                ? "Local uploads · demo files fill the rest"
                : "of 7 intake slots populated with RateGain Q4 FY26 demo files"
            }
            footer={
              <button
                onClick={() => navigate("/intake")}
                className="inline-flex items-center gap-1 text-[var(--color-ink)] font-medium hover:text-[var(--color-ink-hover)]"
              >
                Manage intake <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {uploadCount > 0 ? (
              <ul className="space-y-1.5 mt-1">
                {uploadEntries.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    {describeKind(u.kind)}
                    <span className="text-[var(--color-text-subtle)] truncate">
                      · {u.filename}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 mt-1">
                {[
                  "Initial memo",
                  "Latest financials",
                  "Management commentary",
                  "Broker compilation",
                  "Competitor read-across",
                  "AI / macro notes",
                  "Market data / comps",
                ].map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </SignalCard>

          <SignalCard
            icon={Sparkles}
            eyebrow="Follow-up Output"
            title="Demo memo ready"
            metric="9"
            metricSub="sections drafted in the house voice from the RateGain DNA"
            footer={
              <button
                onClick={() => navigate("/output")}
                className="inline-flex items-center gap-1 text-[var(--color-ink)] font-medium hover:text-[var(--color-ink-hover)]"
              >
                Open output <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Status
                </span>
                <Badge tone="success" dot>
                  Generated
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Voice
                </span>
                <span className="text-[11.5px] text-[var(--color-text)] font-medium">
                  Beas-style · thesis-driven
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Audit
                </span>
                <span className="text-[11.5px] text-[var(--color-text)] font-medium">
                  Source rail per section
                </span>
              </div>
            </div>
          </SignalCard>
        </div>
      </section>

      <MemoPreview />
    </div>
  );
}
