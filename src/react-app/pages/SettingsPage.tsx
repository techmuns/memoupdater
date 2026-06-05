import { Database, HardDrive, KeyRound, Workflow } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Panel } from "../components/ui/Panel";

const STORAGE_ROWS = [
  {
    icon: HardDrive,
    label: "R2 bucket",
    detail: "MEMO_UPLOADS — uploaded memos, financial PDFs, transcripts",
    status: "Not connected",
  },
  {
    icon: Database,
    label: "D1 database",
    detail: "DB — projects, MemoDNA extractions, generation runs",
    status: "Not connected",
  },
  {
    icon: Workflow,
    label: "Queues + Workflows",
    detail: "MEMO_QUEUE / MEMO_WORKFLOW — async extraction & generation",
    status: "Not connected",
  },
];

const SECRET_ROWS = [
  {
    icon: KeyRound,
    label: "Anthropic API key",
    detail: "ANTHROPIC_API_KEY — set via `wrangler secret put`",
    status: "Not set",
  },
  {
    icon: KeyRound,
    label: "OpenAI API key",
    detail: "OPENAI_API_KEY — set via `wrangler secret put`",
    status: "Not set",
  },
];

export function SettingsPage() {
  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Settings"
        title="Bindings and secrets"
        description="Phase 1 ships without real R2, D1, Queues, or LLM keys. Placeholders are kept in wrangler.jsonc (commented) so Phase 2 wiring is mechanical."
      />

      <Panel eyebrow="Storage and pipelines" title="Cloudflare bindings">
        <RowList rows={STORAGE_ROWS} />
      </Panel>

      <Panel eyebrow="Provider credentials" title="LLM secrets">
        <RowList rows={SECRET_ROWS} />
      </Panel>
    </div>
  );
}

function RowList({
  rows,
}: {
  rows: {
    icon: typeof Database;
    label: string;
    detail: string;
    status: string;
  }[];
}) {
  return (
    <ul className="divide-y divide-[var(--color-border)] -mx-5">
      {rows.map(({ icon: Icon, label, detail, status }) => (
        <li
          key={label}
          className="px-5 py-3 flex items-center gap-4 opacity-80"
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
          <Badge tone="neutral" dot>
            {status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
