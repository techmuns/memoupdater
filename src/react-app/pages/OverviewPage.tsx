import { useNavigate } from "react-router-dom";
import {
  Upload,
  Fingerprint,
  FilePlus2,
  FileCheck2,
  ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";

const STEPS = [
  {
    icon: Upload,
    title: "Upload initial memo",
    body: "Drop your house-style memo. We'll treat it as the canonical source of voice, thesis, and analytical framework.",
  },
  {
    icon: Fingerprint,
    title: "Extract memo DNA",
    body: "Parse out original thesis, key assumptions, tone, valuation framework, open questions, and risks.",
  },
  {
    icon: FilePlus2,
    title: "Upload update pack",
    body: "Latest financials, earnings transcript, broker / competitor notes, macro and AI risk material, market data.",
  },
  {
    icon: FileCheck2,
    title: "Generate follow-up memo",
    body: "Same style, same thesis structure, mapped to what actually changed in the new quarter.",
  },
];

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="Project setup"
        title="Memo Updater Dashboard"
        description="Take an existing investment memo, re-test it against the latest data, and produce a follow-up memo in the same house style. Phase 1 runs end-to-end on RateGain demo data."
        actions={
          <Button
            size="lg"
            trailingIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => navigate("/intake")}
          >
            Start Memo Update
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <Card key={title}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-medium text-[var(--color-text-subtle)]">
                  Step {i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">
                  {title}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                  {body}
                </p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                RateGain demo project
              </h3>
              <Badge tone="warning">Demo data</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-2xl leading-relaxed">
              The reference project is a Beas-Capital-style memo on RateGain
              Travel Technologies. Every screen below is wired to the same demo
              project so you can walk the full intake → DNA → builder → output
              flow without uploading anything real.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate("/memo-dna")}
            trailingIcon={<ArrowRight className="w-4 h-4" />}
          >
            Inspect demo DNA
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
