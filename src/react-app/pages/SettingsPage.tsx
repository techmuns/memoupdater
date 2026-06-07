import { useEffect } from "react";
import {
  Database,
  HardDrive,
  KeyRound,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Panel } from "../components/ui/Panel";
import { useMemoProject } from "../state/MemoProjectContext";

type RowTone =
  | "neutral"
  | "ink"
  | "accent"
  | "warning"
  | "success";

interface SettingsRow {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  detail: string;
  status: string;
  tone: RowTone;
}

const STORAGE_ROWS: SettingsRow[] = [
  {
    icon: HardDrive,
    label: "R2 bucket",
    detail: "MEMO_UPLOADS — uploaded memos, financial PDFs, transcripts",
    status: "Not connected",
    tone: "neutral",
  },
  {
    icon: Database,
    label: "D1 database",
    detail: "DB — projects, MemoDNA extractions, generation runs",
    status: "Not connected",
    tone: "neutral",
  },
  {
    icon: Workflow,
    label: "Queues + Workflows",
    detail: "MEMO_QUEUE / MEMO_WORKFLOW — async extraction & generation",
    status: "Not connected",
    tone: "neutral",
  },
];

export function SettingsPage() {
  const { state, refreshLlmProviderStatus } = useMemoProject();
  const status = state.llmProviderStatus;
  const configured = Boolean(status?.configured);

  useEffect(() => {
    void refreshLlmProviderStatus();
  }, [refreshLlmProviderStatus]);

  const llmRows: SettingsRow[] = [
    {
      icon: ShieldCheck,
      label: "LLM enabled",
      detail: 'LLM_ENABLED — server must set this var to "true"',
      status: configured ? "Configured" : "Not configured",
      tone: configured ? "success" : "neutral",
    },
    {
      icon: Settings,
      label: "Provider",
      detail: "LLM_PROVIDER",
      status: status?.provider ?? "—",
      tone: status?.provider ? "ink" : "neutral",
    },
    {
      icon: Sparkles,
      label: "Model",
      detail: "LLM_MODEL",
      status: status?.model ?? "—",
      tone: status?.model ? "ink" : "neutral",
    },
    {
      icon: KeyRound,
      label: "API key",
      detail: "LLM_API_KEY — set via `wrangler secret put LLM_API_KEY`",
      status: configured ? "Configured" : "Not set",
      tone: configured ? "success" : "neutral",
    },
    {
      icon: ShieldCheck,
      label: "Deterministic fallback",
      detail:
        "Deterministic v0 always runs in the browser if the LLM is unavailable or fails",
      status: "Always available",
      tone: "success",
    },
  ];

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Settings"
        title="Bindings and secrets"
        description="Phase 4A adds an optional LLM Follow-up Memo v1 generated server-side in the Worker. Default is OFF; deterministic v0 remains the always-available baseline."
      />

      <Panel
        eyebrow="LLM generation"
        title={configured ? "LLM is enabled" : "LLM is not configured"}
        actions={
          <Badge tone={configured ? "success" : "neutral"} dot>
            {configured ? "Enabled" : "Disabled"}
          </Badge>
        }
      >
        <p className="text-[12px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
          {configured
            ? "LLM generation is enabled. Memo and update-pack text will be sent to the configured provider when you click Generate LLM Memo v1."
            : "LLM generation is not configured. Deterministic generation remains available."}
        </p>
        <p className="text-[11.5px] text-[var(--color-text-subtle)] mb-1">
          LLM Memo v1 sends extracted memo and update-pack text to the
          configured LLM provider. Deterministic v0 stays local/browser-side.
        </p>
        <RowList rows={llmRows} />
      </Panel>

      <Panel eyebrow="Storage and pipelines" title="Cloudflare bindings">
        <RowList rows={STORAGE_ROWS} />
      </Panel>
    </div>
  );
}

function RowList({ rows }: { rows: SettingsRow[] }) {
  return (
    <ul className="divide-y divide-[var(--color-border)] -mx-5">
      {rows.map(({ icon: Icon, label, detail, status, tone }) => (
        <li
          key={label}
          className="px-5 py-3 flex items-center gap-4"
        >
          <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] grid place-items-center shrink-0 border border-[var(--color-border)]">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[var(--color-text)]">
              {label}
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5 font-mono">
              {detail}
            </div>
          </div>
          <Badge tone={tone} dot>
            {status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
