import { useEffect, useMemo, useRef, useState } from "react";
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
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionNavigator } from "../components/ui/SectionNavigator";
import { SourcePanel } from "../components/ui/SourcePanel";

export function OutputPage() {
  const [memo, setMemo] = useState<FollowUpMemo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    api
      .demoFollowUpMemo()
      .then((m) => {
        setMemo(m);
        if (m.sections.length > 0) setActiveId(m.sections[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!memo) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-section-id");
          if (id) setActiveId(id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [memo]);

  const plaintext = useMemo(() => {
    if (!memo) return "";
    return [
      memo.title,
      `Generated: ${memo.generatedAt}`,
      "",
      ...memo.sections.flatMap((s, i) => [`${i + 1}. ${s.title}`, s.body, ""]),
    ].join("\n");
  }, [memo]);

  const copy = async () => {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const scrollTo = (id: string) => {
    sectionRefs.current
      .get(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        title="Loading follow-up memo…"
        description="Fetching /api/demo/follow-up-memo"
      />
    );
  }

  const generatedDate = new Date(memo.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-5">
      {/* Memo title bar */}
      <header className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-ink)] text-white tracking-wider">
              RATEGAIN
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              RateGain Travel Technologies · Generated {generatedDate}
            </span>
            <Badge tone="warning" dot>
              Demo
            </Badge>
          </div>
          <h1
            className="text-[24px] font-semibold tracking-tight text-[var(--color-text)] mt-1"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {memo.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={copy}
            leadingIcon={
              copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />
            }
          >
            {copied ? "Copied" : "Copy memo"}
          </Button>
          <Button
            variant="outline"
            disabled
            title="Coming in Phase 2"
            leadingIcon={<FileDown className="w-4 h-4" />}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            disabled
            title="Coming in Phase 2"
            leadingIcon={<FileText className="w-4 h-4" />}
          >
            Export Word
          </Button>
          <Button
            variant="outline"
            disabled
            title="Coming in Phase 2"
            leadingIcon={<Save className="w-4 h-4" />}
          >
            Save version
          </Button>
        </div>
      </header>

      {/* Reader layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left — section navigator */}
        <div className="lg:col-span-2 hidden lg:block">
          <SectionNavigator
            sections={memo.sections.map((s) => ({ id: s.id, title: s.title }))}
            activeId={activeId}
            onSelect={scrollTo}
          />
        </div>

        {/* Center — memo body */}
        <article className="lg:col-span-7 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] px-8 sm:px-10 py-8">
          {memo.sections.map((section, i) => (
            <section
              key={section.id}
              data-section-id={section.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el);
                else sectionRefs.current.delete(section.id);
              }}
              className={`scroll-mt-24 ${i > 0 ? "pt-10" : ""}`}
            >
              {i > 0 && <div className="hairline mb-10" />}
              <div className="flex items-baseline gap-4 mb-4">
                <span
                  className="tnum text-[36px] font-light text-[var(--color-text-subtle)] leading-none"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2
                  className="text-[20px] font-semibold tracking-tight text-[var(--color-text)] leading-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {section.title}
                </h2>
              </div>
              <p
                className="text-[15.5px] text-[var(--color-text)] leading-[1.7]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {section.body}
              </p>
            </section>
          ))}
        </article>

        {/* Right — source rail */}
        <div className="lg:col-span-3">
          <SourcePanel sections={memo.sections} activeId={activeId} />
        </div>
      </div>
    </div>
  );
}
