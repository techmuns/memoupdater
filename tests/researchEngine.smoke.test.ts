import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ResearchEngine } from "@/components/ResearchEngine";
import { RESEARCH_REPORT_SECTION_ORDER } from "@shared/researchReport";
import { RESEARCH_REPORT_SECTION_TITLES } from "@shared/researchReport";
import type { ResearchReportSectionRunState } from "@shared/types";

// The engine is the showpiece — this verifies it renders to HTML without
// throwing across mixed section states, shows the company core, the live count,
// and a completed section's summary + sources in the feed.

const sections: ResearchReportSectionRunState[] = RESEARCH_REPORT_SECTION_ORDER.map(
  (id, i) => ({
    id,
    title: RESEARCH_REPORT_SECTION_TITLES[id],
    status: i < 2 ? "success" : i === 2 ? "running" : "pending",
    attempt: 0,
    ...(i < 2
      ? {
          findingCount: 3,
          sourceCount: 2,
          sourceDomains: ["bseindia.com", "screener.in"],
          summary: "FIIs added 180bps; promoter holding steady.",
        }
      : {}),
  }),
);

describe("ResearchEngine", () => {
  it("renders the core, live count, and feed without throwing", () => {
    const html = renderToString(
      createElement(ResearchEngine, {
        company: "RATEGAIN",
        sections,
        phase: "researching",
      }),
    );
    // (SSR splits adjacent dynamic text with comment markers, so assert on
    // the stable pieces rather than a fully-contiguous count string.)
    expect(html).toContain("RATEGAIN");
    expect(html).toContain("sections");
    expect(html).toContain("Researching the company");
    expect(html).toContain("bseindia.com");
    expect(html).toContain("FIIs added");
  });

  it("renders the drafting phase", () => {
    const html = renderToString(
      createElement(ResearchEngine, {
        company: "RATEGAIN",
        sections: sections.map((s) => ({ ...s, status: "success" as const })),
        phase: "drafting",
      }),
    );
    expect(html).toContain("Drafting the follow-up memo");
  });
});
