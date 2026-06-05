import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { StatusChip } from "../components/ui/StatusChip";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import type { GenerationStep } from "@shared/types";

const INITIAL_STEPS: GenerationStep[] = [
  {
    id: "step_read_original",
    label: "Read original memo",
    description:
      "Ingest the canonical memo and lock in thesis structure as the section template.",
    status: "ready",
  },
  {
    id: "step_map_checkpoints",
    label: "Map thesis checkpoints",
    description:
      "Walk through key assumptions and tag each with the metric needed to validate it.",
    status: "ready",
  },
  {
    id: "step_read_update_pack",
    label: "Read update pack",
    description:
      "Parse latest financials, transcript, broker / competitor / macro material.",
    status: "ready",
  },
  {
    id: "step_identify_changes",
    label: "Identify what changed",
    description:
      "Diff new evidence against original assumptions; flag where memo held and where it broke.",
    status: "ready",
  },
  {
    id: "step_rebuild_bridge",
    label: "Rebuild EPS / valuation bridge",
    description:
      "Re-walk forward EPS components; refresh target multiple and peer-gap framing.",
    status: "ready",
  },
  {
    id: "step_generate",
    label: "Generate follow-up memo",
    description:
      "Compose the follow-up in the original house voice across all 9 standard sections.",
    status: "not_started",
  },
];

export function BuilderPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<GenerationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);

  const allDemoGenerated = steps.every((s) => s.status === "demo_generated");

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
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Step 3 · Builder"
        title="Follow-up memo builder"
        description="Six-step process tracker that walks from original memo through to a generated follow-up. In Phase 1 the steps cycle through demo statuses — no real LLM call is made."
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={generate}
              disabled={running || allDemoGenerated}
              leadingIcon={<Sparkles className="w-4 h-4" />}
            >
              {running
                ? "Generating demo..."
                : allDemoGenerated
                  ? "Demo generated"
                  : "Generate Demo Follow-up"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/output")}
              disabled={!allDemoGenerated}
            >
              View output
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone="warning">Demo workflow</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          Each step advances on a timer. Real generation runs (Queues +
          Workflows + LLM) arrive in Phase 2.
        </span>
      </div>

      <Card>
        <CardBody className="p-0">
          <ol className="divide-y divide-[var(--color-border)]">
            {steps.map((step, i) => (
              <li
                key={step.id}
                className="px-6 py-5 flex items-start gap-4 hover:bg-[var(--color-surface-muted)]/40 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-muted)] border border-[var(--color-border)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-muted)] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      {step.label}
                    </h3>
                    <StatusChip status={step.status} />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  leadingIcon={<Play className="w-3.5 h-3.5" />}
                >
                  Run
                </Button>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
