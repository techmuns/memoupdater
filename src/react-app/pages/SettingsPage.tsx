import { Database, HardDrive, KeyRound, Workflow } from "lucide-react";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";

const ROWS = [
  {
    icon: HardDrive,
    label: "R2 bucket",
    detail: "MEMO_UPLOADS — stores uploaded memos, financial PDFs, transcripts",
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
    detail: "MEMO_QUEUE / MEMO_WORKFLOW — async LLM extraction + generation",
    status: "Not connected",
  },
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
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Settings"
        title="Bindings and secrets"
        description="Phase 1 ships without real R2, D1, Queues, or LLM keys. Placeholders are kept in wrangler.jsonc (commented) so Phase 2 wiring is mechanical."
      />

      <Card>
        <CardBody className="p-0">
          <ul className="divide-y divide-[var(--color-border)]">
            {ROWS.map(({ icon: Icon, label, detail, status }) => (
              <li
                key={label}
                className="px-6 py-4 flex items-center gap-4 opacity-70"
              >
                <div className="w-9 h-9 rounded-md bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text)]">
                    {label}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {detail}
                  </div>
                </div>
                <Badge tone="neutral">{status}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
