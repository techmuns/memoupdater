import { NavLink, useNavigate } from "react-router-dom";
import { FolderClock, Moon, Plus, Sun } from "lucide-react";
import { Button } from "../ui/Button";
import { useMemoProject } from "../../state/MemoProjectContext";
import { useSavedMemos } from "../../lib/useSavedMemos";
import { useTheme } from "../../lib/theme";
import { deriveCommandBarValues } from "./commandBarState";

// Command strip: sticky 48px header that blends into the shell ground (no
// separate bar). Left = product mark + title + active ticker pill (shown ONLY
// when a company is selected). Right = stage indicator + theme toggle +
// New Memo + Settings. Theme-aware via CSS tokens (see index.css).
export function CommandBar() {
  const navigate = useNavigate();
  const { state, startOver } = useMemoProject();
  const savedMemos = useSavedMemos();
  const [theme, setTheme] = useTheme();

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
      ? "var(--color-success)"
      : stageTone === "warning"
        ? "var(--color-warning)"
        : "var(--color-text-subtle)";

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
        background: "var(--bar-bg)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--bar-border)",
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
              color: "var(--color-text)",
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
              color: "var(--color-ink)",
              padding: "5px 11px",
              borderRadius: 99,
              background: "var(--color-ink-soft)",
              border:
                "1px solid color-mix(in srgb, var(--color-ink) 32%, transparent)",
              cursor: "pointer",
            }}
          >
            <span
              className="animate-pulse"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--color-ink)",
                boxShadow:
                  "0 0 8px color-mix(in srgb, var(--color-ink) 70%, transparent)",
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
              color: "var(--color-text-muted)",
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
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
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
        background: "var(--color-ink-soft)",
        color: "var(--color-ink)",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        border:
          "1px solid color-mix(in srgb, var(--color-ink) 28%, transparent)",
        maxWidth: 260,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: "var(--color-ink)",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      />
      {ticker}
      {company && (
        <span
          style={{
            color: "var(--color-text-muted)",
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
