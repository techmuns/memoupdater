import type { ResearchFindings } from "@shared/types";

// Phase 5C: pure helper. Produces the counts the collapsed
// ResearchFindingsCard header renders by default. Kept out of the
// component file so synthetic tests can import it under Node without
// pulling React / lucide-react / Tailwind / browser APIs.
export interface ResearchSummary {
  findings: number;
  positive: number;
  negative: number;
  watch: number;
  unresolved: number;
  warnings: number;
  verifiedSourceFindings: number;
  checkpointsSupported: number;
  checkpointsChallenged: number;
  checkpointsNoUpdate: number;
}

export function buildResearchSummary(r: ResearchFindings): ResearchSummary {
  let supported = 0;
  let challenged = 0;
  let noUpdate = 0;
  for (const c of r.thesisCheckpointImpact) {
    if (c.impact === "supported") supported += 1;
    else if (c.impact === "challenged") challenged += 1;
    else if (c.impact === "no_update") noUpdate += 1;
  }
  let verified = 0;
  for (const f of r.findings) {
    if (f.sources.some((s) => s.verifiedByWebSearch)) verified += 1;
  }
  return {
    findings: r.findings.length,
    positive: r.positiveDevelopments.length,
    negative: r.negativeDevelopments.length,
    watch: r.neutralOrWatch.length,
    unresolved: r.unresolvedQuestions.length,
    warnings: r.warnings.length,
    verifiedSourceFindings: verified,
    checkpointsSupported: supported,
    checkpointsChallenged: challenged,
    checkpointsNoUpdate: noUpdate,
  };
}
