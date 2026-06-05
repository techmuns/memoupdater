import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { UploadCard } from "../components/ui/UploadCard";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { demoProject } from "@shared/demo/rategain-project";
import type { DocumentKind } from "@shared/types";

const SLOTS: {
  kind: DocumentKind;
  title: string;
  description: string;
}[] = [
  {
    kind: "initial_memo",
    title: "Initial investment memo",
    description:
      "The original house-style memo that defines voice, thesis, and analytical framework.",
  },
  {
    kind: "financials",
    title: "Latest financials",
    description:
      "Quarterly / annual results pack, investor presentation, segmental disclosures.",
  },
  {
    kind: "management_commentary",
    title: "Management commentary / earnings call",
    description:
      "Earnings transcript, investor day script, or written management commentary.",
  },
  {
    kind: "broker_notes",
    title: "Broker notes",
    description:
      "Sell-side initiations, updates, model revisions, target price changes.",
  },
  {
    kind: "competitor_notes",
    title: "Competitor / industry notes",
    description:
      "Read-across from peers, channel checks, industry primer updates.",
  },
  {
    kind: "macro_notes",
    title: "Macro / AI risk notes",
    description:
      "AI disruption framing, macro travel demand, FX, regulatory shifts.",
  },
  {
    kind: "market_data",
    title: "Market data / valuation inputs",
    description:
      "Peer comp tables, consensus estimates, price history, multiple bands.",
  },
];

export function IntakePage() {
  const navigate = useNavigate();
  const demoByKind = new Map(demoProject.uploads.map((u) => [u.kind, u]));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Step 1 · Intake"
        title="Upload initial memo and update pack"
        description="Drop the original memo plus the new quarter's material. Phase 1 stores nothing — files stay in your browser. Demo filenames are pre-populated to mirror a real RateGain Q4 FY26 pack."
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
        <Badge tone="warning">Demo mode</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          Uploads are local-only and not persisted. Real R2 storage arrives in
          Phase 2.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SLOTS.map((slot) => (
          <UploadCard
            key={slot.kind}
            title={slot.title}
            description={slot.description}
            demoFilename={demoByKind.get(slot.kind)?.filename}
          />
        ))}
      </div>
    </div>
  );
}
