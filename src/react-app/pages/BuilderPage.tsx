import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Sparkles, ArrowRight, FileText } from "lucide-react";
import { Button } from "../components/ui/Button";
import { StatusChip } from "../components/ui/StatusChip";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { ThesisMap } from "../components/ui/ThesisMap";
import { api } from "../lib/api";
import type {
  FollowUpMemo,
  GenerationStep,
  ThesisCheckpoint,
} from "@shared/types";

const INITIAL_STEPS: GenerationStep[] = [
  {
    id: "step_read_original",
    label: "Read original memo",
    description: "Ingest the canonical memo; lock thesis structure as template.",
    status: "ready",
  },
  {
    id: "step_map_checkpoints",
    label: "Map thesis checkpoints",
    description: "Walk key assumptions; tag each with re-test metric.",
    status: "ready",
  },
  {
    id: "step_read_update_pack",
    label: "Read update pack",
    description: "Parse financials, transcript, broker / competitor / macro.",
    status: "ready",
  },
  {
    id: "step_identify_changes",
    label: "Identify what changed",
    description: "Diff new evidence; flag where memo held vs broke.",
    status: "ready",
  },
  {
    id: "step_rebuild_bridge",
    label: "Rebuild EPS / valuation bridge",
    description: "Re-walk forward EPS; refresh multiple and peer-gap framing.",
    status: "ready",
  },
  {
    id: "step_generate",
    label: "Generate follow-up memo",
    description: "Compose in original house voice across all 9 sections.",
    status: "not_started",
  },
];

export function BuilderPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<GenerationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [memo, setMemo] = useState<FollowUpMemo | null>(null);
  const [checkpoints, setCheckpoints] = useState<ThesisCheckpoint[]>([]);

  useEffect(() => {
    api.demoFollowUpMemo().then(setMemo).catch(() => {});
    api
      .demoMemoDna()
      .then((d) => setCheckpoints(d.thesisCheckpoints))
      .catch(() => {});
  }, []);

  const allDemoGenerated = steps.every((s) => s.status === "demo_generated");
  const completedCount = steps.filter(
    (s) => s.status === "demo_generated",
  ).length;

  const generate = async () => {
    setRunning(true);
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, status: "demo_generated" } : s,
        ),
      );
    }
    setRunning(false);
  };

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 3 · Builder"
        title="Follow-up memo workflow engine"
        description="Three-column cockpit. Pipeline left, thesis checkpoint mapping center, memo assembly preview right. Drive the demo run from the pipeline header."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={generate}
              disabled={running || allDemoGenerated}
              leadingIcon={<Sparkles className="w-4 h-4" />}
            >
              {running
                ? "Generating demo…"
                : allDemoGenerated
                  ? "Demo generated"
                  : "Generate Demo Follow-up"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/output")}
              disabled={!allDemoGenerated}
              trailingIcon={<ArrowRight className="w-4 h-4" />}
            >
              View output
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone="warning" dot>
          Demo workflow
        </Badge>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          Real generation (Queues + Workflows + LLM) arrives in Phase 2.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left — pipeline */}
        <Panel
          eyebrow="Pipeline"
          title="Generation steps"
          actions={
            <Badge tone="ink">
              {completedCount} / {steps.length}
            </Badge>
          }
          className="lg:col-span-4"
          bodyClassName="px-0 py-0"
        >
          <ol>
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="px-5 py-3.5 border-b border-[var(--color-border)] last:border-b-0 flex items-start gap-3"
              >
                <div
                  className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold tnum shrink-0 border ${
                    step.status === "demo_generated"
                      ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
                      {step.label}
                    </h4>
                    <StatusChip status={step.status} />
                  </div>
                  <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1 leading-snug">
                    {step.description}
                  </p>
                </div>
                <button
                  disabled
                  className="text-[var(--color-text-subtle)] opacity-50 cursor-not-allowed pt-1"
                  title="Phase 2"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Center — checkpoint mapping */}
        <Panel
          eyebrow="Thesis checkpoints"
          title="What we re-test"
          actions={
            checkpoints.length > 0 && (
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {checkpoints.length} mapped
              </span>
            )
          }
          className="lg:col-span-4"
        >
          {checkpoints.length > 0 ? (
            <ThesisMap
              checkpoints={checkpoints}
              columns={1}
              compact
            />
          ) : (
            <div className="text-[12px] text-[var(--color-text-subtle)] italic">
              Loading thesis checkpoints…
            </div>
          )}
        </Panel>

        {/* Right — memo assembly preview */}
        <Panel
          eyebrow="Assembly"
          title="Follow-up memo skeleton"
          actions={
            allDemoGenerated && (
              <Badge tone="success" dot>
                Drafted
              </Badge>
            )
          }
          className="lg:col-span-4"
        >
          {memo ? (
            <ol className="space-y-2">
              {memo.sections.map((s, i) => {
                const filled = allDemoGenerated;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] border transition-colors ${
                      filled
                        ? "border-[var(--color-border)] bg-[var(--color-surface)]"
                        : "border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40"
                    }`}
                  >
                    <span className="tnum text-[10px] font-mono text-[var(--color-text-subtle)] w-5">
                      0{i + 1}
                    </span>
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        filled
                          ? "text-[var(--color-ink)]"
                          : "text-[var(--color-text-subtle)]"
                      }`}
                    />
                    <span
                      className={`text-[12.5px] truncate ${
                        filled
                          ? "text-[var(--color-text)] font-medium"
                          : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {s.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="text-[12px] text-[var(--color-text-subtle)] italic">
              Loading memo skeleton…
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
