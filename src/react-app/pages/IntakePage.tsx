import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileText,
  TrendingUp,
  Mic,
  Newspaper,
  Building2,
  Globe,
  LineChart,
  Fingerprint,
  Hammer,
  FileCheck2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { UploadSlot } from "../components/ui/UploadSlot";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { demoProject } from "@shared/demo/rategain-project";
import type { DocumentKind } from "@shared/types";

const UPDATE_SLOTS: {
  kind: DocumentKind;
  title: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    kind: "financials",
    title: "Latest financials",
    description: "Q4 / annual results pack, investor deck, segmentals",
    icon: TrendingUp,
  },
  {
    kind: "management_commentary",
    title: "Earnings call / commentary",
    description: "Transcript or written management commentary",
    icon: Mic,
  },
  {
    kind: "broker_notes",
    title: "Broker notes",
    description: "Sell-side initiations, model revisions",
    icon: Newspaper,
  },
  {
    kind: "competitor_notes",
    title: "Competitor / industry notes",
    description: "Peer read-across, channel checks",
    icon: Building2,
  },
  {
    kind: "macro_notes",
    title: "Macro / AI risk notes",
    description: "Disruption framing, FX, regulatory shifts",
    icon: Globe,
  },
  {
    kind: "market_data",
    title: "Market data / comps",
    description: "Consensus, peer multiples, price history",
    icon: LineChart,
  },
];

const NEXT_STEPS = [
  {
    icon: Fingerprint,
    title: "Extract Memo DNA",
    body: "Distill the original memo's thesis, voice, valuation logic, and risk framework.",
  },
  {
    icon: Hammer,
    title: "Map thesis checkpoints",
    body: "Tag each key assumption with the metric and source needed to re-test it.",
  },
  {
    icon: FileCheck2,
    title: "Generate follow-up memo",
    body: "Compose the 9-section follow-up in the original house voice.",
  },
];

export function IntakePage() {
  const navigate = useNavigate();
  const demoByKind = new Map(demoProject.uploads.map((u) => [u.kind, u]));
  const initialMemoDemo = demoByKind.get("initial_memo");

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 1 · Intake"
        title="Upload control room"
        description="Drop the canonical memo on the left; load the latest update pack on the right. Phase 1 stores nothing — files stay in your browser."
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate("/memo-dna")}
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue to DNA
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone="warning" dot>
          Local demo mode
        </Badge>
        <span className="text-[12px] text-[var(--color-text-muted)]">
          No files are saved yet. Real R2 storage and signed uploads arrive in
          Phase 2.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <UploadSlot
            variant="primary"
            icon={FileText}
            title="Initial investment memo"
            description="The original house-style memo that defines voice, thesis, analytical framework, and valuation logic. Everything downstream is anchored on this document."
            demoFilename={initialMemoDemo?.filename}
          />

          <Panel
            eyebrow="Why this matters"
            title="The initial memo is the source of truth"
            tone="tinted"
          >
            <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
              Every later screen pulls from this. The follow-up memo will mirror
              the same section order, the same skepticism, the same valuation
              method, and the same position-sizing logic. Choose the memo that
              best represents your house voice.
            </p>
          </Panel>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <Panel
            eyebrow="Update Pack"
            title="Re-test material"
            actions={
              <Badge tone="ink">
                {UPDATE_SLOTS.length} / {UPDATE_SLOTS.length}
              </Badge>
            }
            bodyClassName="space-y-2"
          >
            {UPDATE_SLOTS.map((slot) => (
              <UploadSlot
                key={slot.kind}
                title={slot.title}
                description={slot.description}
                icon={slot.icon}
                demoFilename={demoByKind.get(slot.kind)?.filename}
              />
            ))}
          </Panel>
        </div>
      </div>

      <Panel eyebrow="What happens next" title="Downstream pipeline">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {NEXT_STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-ink-soft)] text-[var(--color-ink)] grid place-items-center">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-mono text-[var(--color-text-subtle)] tnum">
                    0{i + 2}
                  </span>
                  <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight">
                    {title}
                  </h4>
                </div>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
