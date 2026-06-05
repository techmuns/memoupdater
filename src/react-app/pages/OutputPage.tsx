import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  FileDown,
  FileText,
  Save,
  AlertCircle,
  Check,
} from "lucide-react";
import { api } from "../lib/api";
import type { FollowUpMemo } from "@shared/types";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { EmptyState } from "../components/ui/EmptyState";

export function OutputPage() {
  const [memo, setMemo] = useState<FollowUpMemo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .demoFollowUpMemo()
      .then(setMemo)
      .catch((e) => setError(String(e)));
  }, []);

  const plaintext = useMemo(() => {
    if (!memo) return "";
    return [
      memo.title,
      `Generated: ${memo.generatedAt}`,
      "",
      ...memo.sections.flatMap((s, i) => [
        `${i + 1}. ${s.title}`,
        s.body,
        "",
      ]),
    ].join("\n");
  }, [memo]);

  const copy = async () => {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (error) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-8 h-8" />}
        title="Could not load follow-up memo"
        description={error}
      />
    );
  }

  if (!memo) {
    return (
      <EmptyState
        title="Loading follow-up memo..."
        description="Fetching /api/demo/follow-up-memo"
      />
    );
  }

  const generatedDate = new Date(memo.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Step 4 · Output"
        title={memo.title}
        description={`Generated ${generatedDate} · 9 sections · demo data only`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={copy}
              leadingIcon={
                copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
            >
              {copied ? "Copied" : "Copy memo"}
            </Button>
            <Button
              variant="secondary"
              disabled
              title="Coming in Phase 2"
              leadingIcon={<FileDown className="w-4 h-4" />}
            >
              Export PDF
            </Button>
            <Button
              variant="secondary"
              disabled
              title="Coming in Phase 2"
              leadingIcon={<FileText className="w-4 h-4" />}
            >
              Export Word
            </Button>
            <Button
              variant="secondary"
              disabled
              title="Coming in Phase 2"
              leadingIcon={<Save className="w-4 h-4" />}
            >
              Save version
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Badge tone="warning">Demo output</Badge>
        <span className="text-xs text-[var(--color-text-muted)]">
          Real generation, export, and versioning land in Phase 2.
        </span>
      </div>

      <article className="space-y-6">
        {memo.sections.map((section, i) => (
          <Card key={section.id}>
            <CardHeader className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-xs font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <h2 className="text-base font-semibold text-[var(--color-text)] tracking-tight">
                {section.title}
              </h2>
            </CardHeader>
            <CardBody>
              <p
                className="text-[15px] text-[var(--color-text)] leading-relaxed"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {section.body}
              </p>
              {section.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-subtle)] mr-1">
                    Sources
                  </span>
                  {section.sources.map((src, idx) => (
                    <Badge key={idx} tone="neutral">
                      {src.documentId}
                      {src.page ? ` · p.${src.page}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </article>
    </div>
  );
}
