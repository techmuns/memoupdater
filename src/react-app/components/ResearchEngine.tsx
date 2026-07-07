import { useMemo } from "react";
import type {
  ResearchReportSectionId,
  ResearchReportSectionRunState,
} from "@shared/types";

// The immersive research engine — a real-data-driven "agent swarm": the
// company at the core, the 9 research sections ringed around it, lighting up as
// they run and lock green when done, with a live feed where each finished
// section's summary + sources merge in. Every state maps to real progress
// (fullReportProgress) — no faked theater.

export type EnginePhase = "reading" | "researching" | "drafting";

const SHORT_LABEL: Record<ResearchReportSectionId, string> = {
  stock_valuation: "Stock & Valuation",
  executive_update: "Executive Update",
  shareholding: "Shareholding",
  industry_regulatory: "Industry",
  corporate_events: "Corporate Events",
  management_governance: "Management",
  concall: "Concall",
  memo_vs_actual: "Memo vs Actual",
  updated_view: "Updated View",
};

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

interface Props {
  company: string;
  sections: ResearchReportSectionRunState[];
  phase: EnginePhase;
}

export function ResearchEngine({ company, sections, phase }: Props) {
  const n = sections.length;
  const nodes = useMemo(
    () =>
      sections.map((s, i) => {
        const ang = ((-90 + i * (360 / n)) * Math.PI) / 180;
        return {
          s,
          x: 50 + Math.cos(ang) * 40,
          y: 50 + Math.sin(ang) * 40,
        };
      }),
    [sections, n],
  );

  const done = sections.filter((s) => s.status === "success").length;
  const running = sections.find((s) => s.status === "running");
  const totalSources = sections.reduce((a, s) => a + (s.sourceCount ?? 0), 0);
  const completed = sections.filter((s) => s.status === "success");

  const label =
    phase === "reading"
      ? "Reading the memo…"
      : phase === "drafting"
        ? "Drafting the follow-up memo…"
        : "Researching the company…";

  const foot =
    phase === "reading" ? (
      "Extracting the thesis, anchors & claims…"
    ) : phase === "drafting" ? (
      "Condensing the research into a <3-page memo…"
    ) : running ? (
      <>
        Scanning <b>{SHORT_LABEL[running.id]}</b> …
      </>
    ) : (
      <>
        <b>{totalSources} sources</b> verified across {n} research streams
      </>
    );

  const lineColor = (status: ResearchReportSectionRunState["status"]) =>
    status === "success"
      ? "var(--e-good)"
      : status === "running"
        ? "var(--e-ink)"
        : status === "failed"
          ? "#e6aa3c"
          : "var(--e-line2)";

  return (
    <div className="rengine" aria-label="Research in progress">
      <div className="re-phase">
        <span className="re-live" />
        <span className="re-lbl">{label}</span>
        {phase === "researching" && (
          <span className="re-ct">
            {done} / {n} sections
          </span>
        )}
      </div>

      <div className="re-wrap">
        <div className="re-stage">
          <div className="re-ring" />
          <div className="re-ring r2" />
          <div className="re-ring r3" />
          <div className="re-sweep" />
          <svg
            className="re-wire"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {nodes.map(({ s, x, y }) => (
              <line
                key={s.id}
                x1={50}
                y1={50}
                x2={x}
                y2={y}
                stroke={lineColor(s.status)}
                strokeWidth={s.status === "running" ? 0.7 : 0.4}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className={`re-core${phase === "drafting" ? " draft" : ""}`}>
            <div>
              <div className="tk">{company}</div>
              <div className="mt">subject</div>
            </div>
          </div>

          {nodes.map(({ s, x, y }) => (
            <div
              key={s.id}
              className={`re-node ${s.status === "running" ? "run" : s.status === "success" ? "done" : s.status === "failed" ? "failed" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="re-disc">{CHECK}</span>
              <span className="re-nm">{SHORT_LABEL[s.id]}</span>
              <span className="re-fnd">
                {s.findingCount != null ? `${s.findingCount} findings` : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="re-feed">
          <div className="re-feedhead">
            Live research
            <span>
              {totalSources} source{totalSources === 1 ? "" : "s"}
            </span>
          </div>
          <div className="re-feedlist">
            {completed.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "var(--e-faint)" }}>
                Findings appear here as each stream completes…
              </div>
            ) : (
              completed.map((s) => (
                <div key={s.id} className="re-item">
                  <div className="top">
                    {CHECK}
                    {SHORT_LABEL[s.id]}
                    {s.findingCount != null && (
                      <span className="n">{s.findingCount} findings</span>
                    )}
                  </div>
                  {s.summary && <div className="sum">{s.summary}</div>}
                  {s.sourceDomains && s.sourceDomains.length > 0 && (
                    <div className="src">{s.sourceDomains.join("  ·  ")}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="re-foot">{foot}</div>
    </div>
  );
}
