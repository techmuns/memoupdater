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
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { UploadSlot } from "../components/ui/UploadSlot";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { Panel } from "../components/ui/Panel";
import { ExtractionPreview } from "../components/ui/ExtractionPreview";
import { demoProject } from "@shared/demo/rategain-project";
import type { DocumentKind } from "@shared/types";
import { useMemoProject } from "../state/MemoProjectContext";
import { describeKind } from "../lib/fileMeta";

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
  const {
    state,
    extractInitialMemo,
    extractUpdateDoc,
    buildDnaFromCurrentExtraction,
    resetExtracted,
  } = useMemoProject();
  const demoByKind = new Map(demoProject.uploads.map((u) => [u.kind, u]));
  const initialMemoDemo = demoByKind.get("initial_memo");
  const initialUpload = state.uploads.initial_memo ?? null;
  const isLive = Boolean(state.extraction);

  const uploadedUpdateCount = UPDATE_SLOTS.filter(
    (s) => state.uploads[s.kind],
  ).length;
  const extractedUpdateCount = UPDATE_SLOTS.filter((s) => {
    const st = state.updateExtractions[s.kind]?.status;
    return st === "success" || st === "partial";
  }).length;
  const unsupportedUpdateCount = UPDATE_SLOTS.filter((s) => {
    if (!state.uploads[s.kind]) return false;
    const st = state.updateExtractions[s.kind]?.status;
    return st === "unsupported" || st === "error";
  }).length;

  const handleInitialPick = async (file: File) => {
    await extractInitialMemo(file);
  };

  const handleUpdatePick = (kind: DocumentKind) => async (file: File) => {
    await extractUpdateDoc(kind, file);
  };

  const handleGenerateDna = () => {
    const dna = buildDnaFromCurrentExtraction();
    if (dna) navigate("/memo-dna");
  };

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Step 1 · Intake"
        title="Upload control room"
        description="Drop the canonical memo on the left; load the latest update pack on the right. Every file is parsed in your browser — nothing is uploaded to the cloud."
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

      <div className="flex items-start gap-2 flex-wrap">
        {isLive ? (
          <>
            <Badge tone="success" dot>
              Live extracted memo loaded
            </Badge>
            <span className="text-[12px] text-[var(--color-text-muted)]">
              The dashboard is now reading from your uploaded memo. Demo data
              remains as a fallback.
            </span>
            <div className="flex flex-col items-start">
              <button
                onClick={resetExtracted}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-ink)] hover:text-[var(--color-ink-hover)]"
              >
                <RefreshCw className="w-3 h-3" /> Switch back to demo
              </button>
              <span className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-snug max-w-md">
                Clears your uploaded initial memo, extracted DNA, all
                update-pack uploads + extractions, and the generated
                follow-up memo.
              </span>
            </div>
          </>
        ) : (
          <>
            <Badge tone="warning" dot>
              Local demo mode
            </Badge>
            <span className="text-[12px] text-[var(--color-text-muted)]">
              Files are parsed in your browser and not saved to cloud.
            </span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 flex flex-col gap-4">
          <UploadSlot
            variant="primary"
            icon={FileText}
            title="Initial investment memo"
            description="The original house-style memo that defines voice, thesis, analytical framework, and valuation logic. Drop a .txt, .md, or .pdf — the dashboard extracts text and builds a Memo DNA draft."
            demoFilename={initialMemoDemo?.filename}
            currentFile={initialUpload}
            onFileSelected={handleInitialPick}
          />

          <ExtractionPreview
            status={state.extractionStatus}
            result={state.extraction}
            onGenerateDna={handleGenerateDna}
            onReset={resetExtracted}
            generatedDnaPending={Boolean(state.extractedDna)}
          />

          {!isLive && (
            <Panel
              eyebrow="Why this matters"
              title="The initial memo is the source of truth"
              tone="tinted"
            >
              <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed">
                Every later screen pulls from this. The follow-up memo will
                mirror the same section order, the same skepticism, the same
                valuation method, and the same position-sizing logic. Drop your
                house memo to switch the dashboard out of demo mode.
              </p>
            </Panel>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <Panel
            eyebrow="Update Pack"
            title="Re-test material"
            actions={
              <Badge tone="ink">
                {uploadedUpdateCount}/{UPDATE_SLOTS.length} uploaded ·{" "}
                {extractedUpdateCount} extracted · {unsupportedUpdateCount}{" "}
                unsupported
              </Badge>
            }
            bodyClassName="space-y-2"
          >
            {UPDATE_SLOTS.map((slot) => {
              const current = state.uploads[slot.kind] ?? null;
              const ex = state.updateExtractions[slot.kind] ?? null;
              const exStatus =
                state.updateExtractionStatuses[slot.kind] ?? "idle";
              return (
                <div key={slot.kind} className="space-y-2">
                  <UploadSlot
                    title={slot.title}
                    description={slot.description}
                    icon={slot.icon}
                    demoFilename={demoByKind.get(slot.kind)?.filename}
                    currentFile={current}
                    onFileSelected={handleUpdatePick(slot.kind)}
                  />
                  {current && (
                    <ExtractionPreview
                      status={exStatus}
                      result={ex}
                      variant="compact"
                      label={`${describeKind(slot.kind)} · extracted preview`}
                    />
                  )}
                </div>
              );
            })}
            <div className="pt-2 mt-1 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-subtle)] leading-snug">
              Update Pack uploads are extracted in your browser. .txt, .md,
              and .pdf are supported; .xlsx and .docx are recognized as
              unsupported (xlsx parsing lands later).
            </div>
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
