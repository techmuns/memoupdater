import { useState } from "react";
import { ArrowUp, Loader2, MessageCircleQuestion, User } from "lucide-react";
import type { FullResearchReport } from "@shared/types";
import { Panel } from "./ui/Panel";
import { Markdown } from "./ui/Markdown";
import { api } from "../lib/api";

// Stage 3: ask follow-up questions about the company, answered from the stored
// comprehensive report — no re-running research. Self-contained; the thread is
// kept in local state (the report itself is persisted for reuse).
interface QaTurn {
  question: string;
  answer?: string;
  error?: string;
  loading: boolean;
}

const SUGGESTIONS = [
  "What's the biggest risk to the thesis now?",
  "How did margins move vs the memo's expectations?",
  "Any governance or auditor red flags?",
  "What did management guide for next year?",
];

export function ReportQnA({
  report,
  memoContext,
}: {
  report: FullResearchReport;
  memoContext?: string;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<QaTurn[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (question: string): Promise<void> => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question: q, loading: true }]);
    try {
      const res = await api.reportAsk({
        question: q,
        company: report.company,
        report: report.sections.map((s) => ({
          title: s.title,
          markdown: s.markdown,
        })),
        memoContext,
      });
      setTurns((t) =>
        t.map((turn, i) =>
          i === idx
            ? res.ok
              ? { ...turn, loading: false, answer: res.answer }
              : { ...turn, loading: false, error: `${res.code} · ${res.message}` }
            : turn,
        ),
      );
    } catch (e) {
      setTurns((t) =>
        t.map((turn, i) =>
          i === idx
            ? {
                ...turn,
                loading: false,
                error: e instanceof Error ? e.message : "Request failed.",
              }
            : turn,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      eyebrow="Ask the research"
      title={`Questions about ${report.company}`}
    >
      <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed -mt-1 mb-3">
        Ask anything about the company — answered from the internal research
        report we already generated, so there's no need to re-run research.
      </p>

      {turns.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] shrink-0">
                  <User className="w-3.5 h-3.5" />
                </span>
                <div className="text-[13px] font-semibold text-[var(--color-text)] pt-0.5">
                  {turn.question}
                </div>
              </div>
              <div className="flex items-start gap-2 pl-8">
                {turn.loading ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-ink)]" />
                    Searching the report…
                  </div>
                ) : turn.error ? (
                  <div className="text-[12px] text-[var(--color-warning)] font-mono leading-snug">
                    {turn.error}
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
                    <Markdown text={turn.answer ?? ""} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={busy}
              className="text-[11.5px] px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-center gap-2"
      >
        <div className="flex-1 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] focus-within:border-[var(--color-ink)] bg-[var(--color-surface)] px-3">
          <MessageCircleQuestion className="w-4 h-4 text-[var(--color-text-subtle)] shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question…"
            disabled={busy}
            className="flex-1 h-10 bg-transparent text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Ask"
          className="grid place-items-center w-10 h-10 rounded-[var(--radius-md)] bg-gradient-to-b from-[var(--color-ink)] to-[var(--color-ink-hover)] text-white disabled:opacity-40 transition-opacity"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </form>
    </Panel>
  );
}
