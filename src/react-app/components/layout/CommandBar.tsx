import { NavLink, useNavigate } from "react-router-dom";
import { FolderClock, Plus, Settings as SettingsIcon } from "lucide-react";
import { Button } from "../ui/Button";
import { useMemoProject } from "../../state/MemoProjectContext";
import { useSavedMemos } from "../../lib/useSavedMemos";
import { deriveCommandBarValues } from "./commandBarState";

// Dark command strip: sticky 48px header that blends into the engine-world
// ground (no separate white bar). Left = product mark + title + active ticker
// pill (shown ONLY when a company is selected). Right = stage indicator +
// New Memo + Settings. No charts/tables/large descriptions live here.
export function CommandBar() {
  const navigate = useNavigate();
  const { state, startOver } = useMemoProject();
  const savedMemos = useSavedMemos();

  // "New Memo" clears the current project and returns to the workbench, so the
  // analyst always starts from a clean slate. Completed memos are auto-saved
  // to the library, so nothing is lost.
  const startNewMemo = (): void => {
    startOver();
    navigate("/workspace");
  };
  const { stageLabel, stageTone } = deriveCommandBarValues({
    selectedCompany: state.selectedCompany
      ? {
          companyName: state.selectedCompany.companyName,
          ticker: state.selectedCompany.ticker,
        }
      : null,
    detection: state.detection,
    periodOverride: state.periodOverride,
    extraction: state.extraction
      ? { source: { filename: state.extraction.source.filename } }
      : null,
    dna: state.dna,
    research: state.research,
    researchState: state.researchState,
    generatedMemo: state.generatedMemo,
    llm: state.llm,
  });

  const company = state.selectedCompany;
  const stageDotColor =
    stageTone === "success"
      ? "#37d3a6"
      : stageTone === "warning"
        ? "#e6aa3c"
        : "#8f95af";

  // A workflow is "running" whenever any async step is in flight. The button
  // below jumps back to the live workspace so the analyst can leave (browse
  // saved memos, tweak settings) and return without losing the run.
  const workflowRunning =
    state.extractionStatus === "extracting" ||
    state.understanding.kind === "loading" ||
    state.researchState.kind === "loading" ||
    state.llm.kind === "loading" ||
    // hold through the research→draft handoff (armed, research done, draft not
    // yet started) so the button doesn't blink off for a frame
    (state.engineArmed &&
      state.researchState.kind === "success" &&
      state.llm.kind === "idle");
  const goToWorkflow = (): void => {
    void navigate("/workspace");
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 48,
        background: "rgba(10, 12, 19, 0.72)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <NavLink
          to="/workspace"
          aria-label="Memo Updater home"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background:
                "linear-gradient(135deg, #7c7bff 0%, #6a68f5 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
              boxShadow: "0 0 18px -4px rgba(124, 123, 255, 0.6)",
            }}
          >
            M
          </span>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#eaecf4",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Memo Updater
          </h1>
        </NavLink>
        {company && (
          <TickerPill ticker={company.ticker} company={company.companyName} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {workflowRunning ? (
          <button
            type="button"
            onClick={goToWorkflow}
            aria-label="Go to the running workflow"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              fontWeight: 600,
              color: "#c9c8ff",
              padding: "5px 11px",
              borderRadius: 99,
              background: "rgba(124, 123, 255, 0.14)",
              border: "1px solid rgba(124, 123, 255, 0.32)",
              cursor: "pointer",
            }}
          >
            <span
              className="animate-pulse"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#7c7bff",
                boxShadow: "0 0 8px rgba(124, 123, 255, 0.8)",
              }}
            />
            Resume workflow
          </button>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#c2c7da",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: stageDotColor,
              }}
            />
            {stageLabel}
          </span>
        )}
        <Button
          size="sm"
          leadingIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={startNewMemo}
        >
          New Memo
        </Button>
        <NavLink
          to="/library"
          aria-label="Saved memos"
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-[var(--radius-md)] transition-colors ${
              isActive
                ? "bg-[var(--color-ink-soft)] text-[var(--color-ink)] font-semibold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            }`
          }
        >
          <FolderClock className="w-4 h-4" />
          <span className="hidden sm:inline">Memos</span>
          {savedMemos.length > 0 && (
            <span className="tnum inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-ink)] text-white text-[9px] font-bold">
              {savedMemos.length}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/settings"
          aria-label="Settings"
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium rounded-[var(--radius-md)] transition-colors ${
              isActive
                ? "bg-[var(--color-ink-soft)] text-[var(--color-ink)] font-semibold"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            }`
          }
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </NavLink>
      </div>
    </header>
  );
}

// Active ticker pill — indigo, shown only when a company is selected.
function TickerPill({ ticker, company }: { ticker: string; company?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        background: "rgba(124, 123, 255, 0.14)",
        color: "#b8b7ff",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid rgba(124, 123, 255, 0.28)",
        maxWidth: 260,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: "#7c7bff",
          borderRadius: "50%",
          boxShadow: "0 0 8px rgba(124, 123, 255, 0.7)",
          flexShrink: 0,
        }}
      />
      {ticker}
      {company && (
        <span
          style={{
            color: "#8f8ee0",
            fontWeight: 400,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          - {company}
        </span>
      )}
    </span>
  );
}
