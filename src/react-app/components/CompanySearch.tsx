import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  Loader2,
  Search,
  X,
} from "lucide-react";
import type { StockSearchResult } from "@shared/types";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { api, ApiError } from "../lib/api";
import { useMemoProject } from "../state/MemoProjectContext";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_VISIBLE_RESULTS = 20;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; results: StockSearchResult[]; total: number }
  | { kind: "empty" }
  | { kind: "not_configured"; message: string }
  | { kind: "error"; message: string };

// Step 1 of the workflow: pick the company this memo is about. The picked
// company becomes the authoritative project identity (name + ticker + sector)
// for memo understanding, research, and generation — overriding the heuristic
// company detector, which can mistake a segment line-item (e.g. "Lloyd
// Electric" inside a Havells report) for the subject company. The upload slot
// stays locked until a company is selected.
export function CompanySearch() {
  const { state, setSelectedCompany, clearSelectedCompany } = useMemoProject();
  const selected = state.selectedCompany;

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  // Guards against out-of-order responses: only the latest issued query may
  // commit its result into state.
  const latestQueryRef = useRef("");

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    latestQueryRef.current = q;
    if (q.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setSearch({ kind: "idle" });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearch({ kind: "loading" });
    try {
      const res = await api.stockSearch({ query: q }, controller.signal);
      if (latestQueryRef.current !== q) return; // stale
      if (res.ok) {
        setSearch(
          res.results.length === 0
            ? { kind: "empty" }
            : {
                kind: "results",
                results: res.results.slice(0, MAX_VISIBLE_RESULTS),
                total: res.totalResults,
              },
        );
      } else if (res.code === "not_configured") {
        setSearch({ kind: "not_configured", message: res.message });
      } else {
        setSearch({ kind: "error", message: res.message });
      }
    } catch (err) {
      if (controller.signal.aborted || latestQueryRef.current !== q) return;
      const message =
        err instanceof ApiError
          ? err.serverMessage || err.message
          : err instanceof Error
            ? err.message
            : "Search failed.";
      setSearch({ kind: "error", message });
    }
  }, []);

  // Debounce keystrokes. Skip entirely while a company is selected (the input
  // is hidden then).
  useEffect(() => {
    if (selected) return;
    const handle = setTimeout(() => void runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, selected, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSelect = useCallback(
    (r: StockSearchResult) => {
      abortRef.current?.abort();
      setSelectedCompany({
        ticker: r.ticker,
        companyName: r.name || r.ticker,
        country: r.country || undefined,
        sector: r.sector || undefined,
      });
      setQuery("");
      setSearch({ kind: "idle" });
    },
    [setSelectedCompany],
  );

  const handleChange = useCallback(() => {
    clearSelectedCompany();
    setQuery("");
    setSearch({ kind: "idle" });
  }, [clearSelectedCompany]);

  if (selected) {
    return (
      <Panel
        eyebrow="Step 1"
        title="Company"
        actions={
          <Badge tone="success" dot>
            Selected
          </Badge>
        }
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-ink)] text-white grid place-items-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[var(--color-text)] truncate">
                {selected.companyName}
              </span>
              <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0">
                {selected.ticker}
              </span>
            </div>
            <div className="text-[11.5px] text-[var(--color-text-muted)] truncate mt-0.5">
              {[selected.country, selected.sector].filter(Boolean).join(" · ") ||
                "Company selected"}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleChange}
            leadingIcon={<X className="w-3.5 h-3.5" />}
            className="shrink-0"
          >
            Change
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="Step 1"
      title="Select the company this memo is about"
    >
      <p className="text-[12.5px] text-[var(--color-text-muted)] leading-relaxed mb-3">
        Search by name or ticker and pick the subject company. This becomes the
        source of truth for research and the generated memo, so it can't be
        mis-read from the memo body. Upload unlocks once a company is selected.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-subtle)] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="e.g. Havells, RELIANCE, Reliance Industries…"
          aria-label="Search for a company"
          className="w-full h-11 pl-9 pr-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)]/15 focus:border-[var(--color-ink)]"
        />
        {search.kind === "loading" && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink)] animate-spin" />
        )}
        {search.kind !== "loading" && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSearch({ kind: "idle" });
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded text-[var(--color-text-subtle)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <SearchBody
        state={search}
        query={query}
        onSelect={handleSelect}
      />
    </Panel>
  );
}

function SearchBody({
  state,
  query,
  onSelect,
}: {
  state: SearchState;
  query: string;
  onSelect: (r: StockSearchResult) => void;
}) {
  if (state.kind === "not_configured") {
    return (
      <Hint tone="warning" icon={<AlertCircle className="w-4 h-4" />}>
        {state.message}
      </Hint>
    );
  }
  if (state.kind === "error") {
    return (
      <Hint tone="warning" icon={<AlertCircle className="w-4 h-4" />}>
        Company search failed: {state.message}
      </Hint>
    );
  }
  if (state.kind === "idle") {
    if (query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH) {
      return (
        <p className="mt-2 text-[11.5px] text-[var(--color-text-subtle)]">
          Type at least {MIN_QUERY_LENGTH} characters to search.
        </p>
      );
    }
    return null;
  }
  if (state.kind === "loading") {
    return (
      <p className="mt-3 text-[12px] text-[var(--color-text-muted)] inline-flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
      </p>
    );
  }
  if (state.kind === "empty") {
    return (
      <Hint tone="neutral" icon={<Search className="w-4 h-4" />}>
        No companies matched “{query.trim()}”. Try a different name or ticker.
      </Hint>
    );
  }

  // results
  return (
    <div className="mt-3">
      <ul
        role="listbox"
        aria-label="Company search results"
        className="max-h-[320px] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] divide-y divide-[var(--color-border)]"
      >
        {state.results.map((r) => (
          <li key={r.ticker} role="option" aria-selected={false}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="group w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--color-ink-soft)] transition-colors"
            >
              <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0 min-w-[68px] text-center">
                {r.ticker}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-text)] truncate">
                  {r.name || r.ticker}
                </span>
                <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                  {[r.country, r.sector].filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
              <Check className="w-4 h-4 text-[var(--color-ink)] opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      {state.total > state.results.length && (
        <p className="mt-2 text-[11px] text-[var(--color-text-subtle)]">
          Showing {state.results.length} of {state.total} matches — refine your
          search to narrow the list.
        </p>
      )}
    </div>
  );
}

function Hint({
  tone,
  icon,
  children,
}: {
  tone: "neutral" | "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "warning"
      ? "border-[color-mix(in_srgb,var(--color-warning)_22%,white)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";
  return (
    <div
      className={`mt-3 rounded-[var(--radius-md)] border px-3 py-2.5 flex items-start gap-2 text-[12px] leading-snug ${cls}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
