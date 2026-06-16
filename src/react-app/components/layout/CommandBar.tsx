import { NavLink, useNavigate } from "react-router-dom";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { Button } from "../ui/Button";
import { useMemoProject } from "../../state/MemoProjectContext";
import { deriveCommandBarValues } from "./commandBarState";

// Munshot Zone 1: sticky 48px header. Left = product mark + title + active
// ticker pill (shown ONLY when a company is selected). Right = stage indicator
// + New Memo + Settings. No charts/tables/large descriptions live here.
export function CommandBar() {
  const navigate = useNavigate();
  const { state } = useMemoProject();
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
      ? "#16a34a"
      : stageTone === "warning"
        ? "#d97706"
        : "#9ca3af";

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
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid #e5e7eb",
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
              background: "#4f46e5",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            M
          </span>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
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
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#6b7280",
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
        <Button
          size="sm"
          leadingIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => navigate("/intake")}
        >
          New Memo
        </Button>
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
        background: "#eef2ff",
        color: "#4338ca",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid #e0e7ff",
        maxWidth: 260,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: "#6366f1",
          borderRadius: "50%",
          flexShrink: 0,
        }}
      />
      {ticker}
      {company && (
        <span
          style={{
            color: "#818cf8",
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
