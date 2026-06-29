import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { WorkflowRail } from "@/components/layout/WorkflowRail";
import type { MissionStep } from "@/lib/missionTrackerState";

// Render smoke test for the two-pane rail. Verifies the new component renders
// to HTML without throwing, shows every step label, and surfaces the active
// step's live progress count. Pure props (no context/router/network), so it is
// a clean runtime signal for the biggest new UI piece.

const STEPS: MissionStep[] = [
  { id: "upload", index: 1, label: "Upload memo", helper: "Drop the original memo to begin", status: "complete" },
  { id: "detect", index: 2, label: "Extract insights", helper: "Parse text and analyze the memo with AI", status: "complete" },
  { id: "research", index: 3, label: "Run research", helper: "Six focused web-search passes", status: "active" },
  { id: "generate", index: 4, label: "Draft <3-page memo", helper: "Section-by-section, with sourced facts", status: "pending" },
  { id: "review", index: 5, label: "Download / print", helper: "PDF, ready for the analyst", status: "pending" },
];

describe("WorkflowRail", () => {
  it("renders every step label and the active step's progress count", () => {
    const html = renderToString(
      createElement(WorkflowRail, {
        steps: STEPS,
        effectiveStepId: "research",
        onSelectStep: () => {},
        progressByStep: { research: { done: 2, total: 6, noun: "passes" } },
        onStartOver: () => {},
      }),
    );

    expect(html).toContain("Workflow");
    // Labels appear in the HTML (escaping the `<` in "Draft <3-page memo",
    // which SSR renders as &lt;, matching how the browser would).
    const escape = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    for (const step of STEPS) {
      expect(html).toContain(escape(step.label));
    }
    // Active step's live count + the Start over affordance.
    expect(html).toContain("2");
    expect(html).toContain("passes");
    expect(html).toContain("Start over");
  });

  it("omits Start over when no reset handler is provided", () => {
    const html = renderToString(
      createElement(WorkflowRail, {
        steps: STEPS,
        effectiveStepId: "upload",
        onSelectStep: () => {},
      }),
    );
    expect(html).not.toContain("Start over");
  });
});
