import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  FileDown,
  FileText,
  Save,
  Check,
} from "lucide-react";
import type { FollowUpMemo } from "@shared/types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionNavigator } from "../components/ui/SectionNavigator";
import { SourcePanel } from "../components/ui/SourcePanel";
import { useMemoProject } from "../state/MemoProjectContext";
import { SIGNAL_BADGE_TONE, SIGNAL_LABEL } from "../lib/signalDisplay";

type View = "generated" | "demo";

export function OutputPage() {
  const { state } = useMemoProject();
  const generated = state.generatedMemo;
  const demo = state.demoFollowUpMemo;

  const [view, setView] = useState<View>(() =>
    generated && !state.generationError ? "generated" : "demo",
  );
  const [copied, setCopied] = useState(false);
  const [scrolledId, setScrolledId] = useState<string | null>(null);

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Pick the visible memo with a guaranteed fallback.
  const memo: FollowUpMemo | null =
    view === "generated" && generated ? generated : (demo ?? null);

  // Derived active section id: observer-set value, or fall back to the first section.
  const activeId = scrolledId ?? memo?.sections[0]?.id ?? null;

  useEffect(() => {
    if (!memo) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-section-id");
          if (id) setScrolledId(id);
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
      ...memo.sections.flatMap((s, i) => {
        const lines = [`${i + 1}. ${s.title}`];
        if (s.summary) lines.push(s.summary);
        if (s.body && s.body !== s.summary) lines.push(s.body);
        if (s.bullets && s.bullets.length > 0) {
          lines.push(...s.bullets.map((b) => `  • ${b}`));
        }
        lines.push("");
        return lines;
      }),
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

  if (!memo) {
    return (
      <EmptyState
        title="No memo to display yet"
        description="Generate a follow-up memo on the Builder, or wait for the demo memo to load."
      />
    );
  }

  const generatedDate = new Date(memo.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isGeneratedView = view === "generated" && generated;
  const showToggle = Boolean(generated && demo);

  return (
    <div className="space-y-5">
      {/* Memo title bar */}
      <header className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-ink)] text-white tracking-wider">
              {isGeneratedView ? "GENERATED" : "RATEGAIN"}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {isGeneratedView
                ? `Deterministic draft · Generated ${generatedDate}`
                : `RateGain Travel Technologies · Generated ${generatedDate}`}
            </span>
            {isGeneratedView ? (
              <Badge tone="success" dot>
                Generated Follow-up Memo v0
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                Demo Follow-up Memo
              </Badge>
            )}
          </div>
          <h1
            className="text-[24px] font-semibold tracking-tight text-[var(--color-text)] mt-1"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {memo.title}
          </h1>
          <p className="text-[11.5px] text-[var(--color-text-muted)] mt-1">
            Deterministic draft — LLM refinement to be added later.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showToggle && (
            <div className="inline-flex rounded-[var(--radius-sm)] border border-[var(--color-border)] overflow-hidden">
              <button
                onClick={() => setView("generated")}
                className={`text-[11.5px] font-medium px-3 py-1.5 ${
                  view === "generated"
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                Generated
              </button>
              <button
                onClick={() => setView("demo")}
                className={`text-[11.5px] font-medium px-3 py-1.5 border-l border-[var(--color-border)] ${
                  view === "demo"
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                Demo
              </button>
            </div>
          )}
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
            title="Export not yet wired"
            leadingIcon={<FileDown className="w-4 h-4" />}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            disabled
            title="Export not yet wired"
            leadingIcon={<FileText className="w-4 h-4" />}
          >
            Export Word
          </Button>
          <Button
            variant="outline"
            disabled
            title="Save not yet wired"
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
                {section.signal && (
                  <Badge tone={SIGNAL_BADGE_TONE[section.signal]} dot>
                    {SIGNAL_LABEL[section.signal]}
                  </Badge>
                )}
              </div>
              {section.summary && section.summary !== section.body && (
                <p
                  className="text-[15.5px] text-[var(--color-text)] leading-[1.7] font-medium mb-3"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {section.summary}
                </p>
              )}
              {section.body && (
                <p
                  className="text-[15.5px] text-[var(--color-text)] leading-[1.7]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {section.body}
                </p>
              )}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-3 space-y-1.5 list-disc pl-5">
                  {section.bullets.map((b, bi) => (
                    <li
                      key={bi}
                      className="text-[14px] text-[var(--color-text)] leading-[1.65]"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {section.confidenceNote && (
                <p className="mt-3 text-[11px] italic text-[var(--color-text-subtle)]">
                  {section.confidenceNote}
                </p>
              )}
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
