import type {
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoUpdateDoc,
  ResearchFinding,
  ResearchFindings,
  ResearchSource,
  ResearchUpdatesRequest,
} from "@shared/types";

const INITIAL_MEMO_CHAR_CAP = 40_000;
const UPDATE_DOC_CHAR_CAP = 30_000;
const FINDING_TEXT_CHAR_CAP = 4_000;
const FINDING_NOTE_CHAR_CAP = 1_500;
const MAX_FINDINGS = 50;
const MAX_SOURCES_PER_FINDING = 8;
const MAX_CHECKPOINT_NOTES = 24;
const MAX_UNRESOLVED_QUESTIONS = 12;
const MAX_WARNINGS = 24;
const ELISION = "\n\n[... truncated for length ...]\n\n";

// Phase 5C: compact-mode budgets used when the client requests
// generationOptions.compact === true, or when the default-trim prompt
// blows past the safe-size threshold (see worker/index.ts auto-compact).
const COMPACT_INITIAL_MEMO_CHAR_CAP = 8_000;
const COMPACT_UPDATE_DOC_CHAR_CAP = 6_000;
const COMPACT_FINDING_TEXT_CHAR_CAP = 2_000;
const COMPACT_FINDING_NOTE_CHAR_CAP = 500;
const COMPACT_MAX_FINDINGS = 12;
const COMPACT_MAX_SOURCES_PER_FINDING = 4;
const COMPACT_MAX_CHECKPOINT_NOTES = 8;
const COMPACT_MAX_UNRESOLVED_QUESTIONS = 6;
const COMPACT_MAX_WARNINGS = 6;

// Financial documents back-load conclusions and front-load summaries, so
// head + tail elision preserves more useful context than a single head trim.
export function trimToCharBudget(text: string, charBudget: number): string {
  if (text.length <= charBudget) return text;
  const usable = Math.max(charBudget - ELISION.length, 0);
  const headLen = Math.floor(usable * 0.7);
  const tailLen = usable - headLen;
  return text.slice(0, headLen) + ELISION + text.slice(text.length - tailLen);
}

export function trimRequestBody(
  req: GenerateFollowUpMemoRequest,
): GenerateFollowUpMemoRequest {
  const updateDocs = Array.isArray(req.updateDocs)
    ? req.updateDocs.map(
        (doc): GenerateFollowUpMemoUpdateDoc => ({
          ...doc,
          text: trimToCharBudget(doc.text, UPDATE_DOC_CHAR_CAP),
        }),
      )
    : undefined;
  return {
    ...req,
    initialMemo: {
      ...req.initialMemo,
      text: trimToCharBudget(req.initialMemo.text, INITIAL_MEMO_CHAR_CAP),
    },
    updateDocs,
    research: req.research ? trimResearchFindings(req.research) : req.research,
  };
}

// Phase 5C: compact request trim. Shrinks the initial memo to 8k chars
// (head-tail) and caps research at 12 findings × 2k summary/relevance ×
// 4 sources × 500-char notes. Used as the pre-call rebuild when the
// default-trim prompt would exceed the safe size threshold, and when
// the client passes generationOptions.compact === true.
export function trimRequestBodyCompact(
  req: GenerateFollowUpMemoRequest,
): GenerateFollowUpMemoRequest {
  const updateDocs = Array.isArray(req.updateDocs)
    ? req.updateDocs.map(
        (doc): GenerateFollowUpMemoUpdateDoc => ({
          ...doc,
          text: trimToCharBudget(doc.text, COMPACT_UPDATE_DOC_CHAR_CAP),
        }),
      )
    : undefined;
  return {
    ...req,
    initialMemo: {
      ...req.initialMemo,
      text: trimToCharBudget(
        req.initialMemo.text,
        COMPACT_INITIAL_MEMO_CHAR_CAP,
      ),
    },
    updateDocs,
    research: req.research
      ? trimResearchFindingsCompact(req.research)
      : req.research,
  };
}

function trimResearchFindingsCompact(
  findings: ResearchFindings,
): ResearchFindings {
  const trimmedFindings = findings.findings
    .slice(0, COMPACT_MAX_FINDINGS)
    .map((f): ResearchFinding => ({
      ...f,
      summary: trimToCharBudget(f.summary, COMPACT_FINDING_TEXT_CHAR_CAP),
      relevance: trimToCharBudget(f.relevance, COMPACT_FINDING_TEXT_CHAR_CAP),
      sources: f.sources
        .slice(0, COMPACT_MAX_SOURCES_PER_FINDING)
        .map(
          (s): ResearchSource => ({
            ...s,
            note:
              typeof s.note === "string"
                ? trimToCharBudget(s.note, COMPACT_FINDING_NOTE_CHAR_CAP)
                : s.note,
          }),
        ),
    }));
  const keepIds = new Set(trimmedFindings.map((f) => f.id));
  return {
    ...findings,
    findings: trimmedFindings,
    positiveDevelopments: findings.positiveDevelopments.filter((id) =>
      keepIds.has(id),
    ),
    negativeDevelopments: findings.negativeDevelopments.filter((id) =>
      keepIds.has(id),
    ),
    neutralOrWatch: findings.neutralOrWatch.filter((id) => keepIds.has(id)),
    thesisCheckpointImpact: findings.thesisCheckpointImpact
      .slice(0, COMPACT_MAX_CHECKPOINT_NOTES)
      .map((c) => ({
        ...c,
        note: trimToCharBudget(c.note, COMPACT_FINDING_NOTE_CHAR_CAP),
        findingIds: c.findingIds.filter((id) => keepIds.has(id)),
      })),
    unresolvedQuestions: findings.unresolvedQuestions
      .slice(0, COMPACT_MAX_UNRESOLVED_QUESTIONS)
      .map((q) => trimToCharBudget(q, COMPACT_FINDING_NOTE_CHAR_CAP)),
    warnings: findings.warnings
      .slice(0, COMPACT_MAX_WARNINGS)
      .map((w) => trimToCharBudget(w, COMPACT_FINDING_NOTE_CHAR_CAP)),
  };
}

export function trimResearchRequestBody(
  req: ResearchUpdatesRequest,
): ResearchUpdatesRequest {
  return {
    ...req,
    initialMemo: {
      ...req.initialMemo,
      text: trimToCharBudget(req.initialMemo.text, INITIAL_MEMO_CHAR_CAP),
    },
  };
}

export function trimResearchFindings(
  findings: ResearchFindings,
): ResearchFindings {
  const trimmedFindings = findings.findings
    .slice(0, MAX_FINDINGS)
    .map((f): ResearchFinding => ({
      ...f,
      summary: trimToCharBudget(f.summary, FINDING_TEXT_CHAR_CAP),
      relevance: trimToCharBudget(f.relevance, FINDING_TEXT_CHAR_CAP),
      sources: f.sources
        .slice(0, MAX_SOURCES_PER_FINDING)
        .map(
          (s): ResearchSource => ({
            ...s,
            note:
              typeof s.note === "string"
                ? trimToCharBudget(s.note, FINDING_NOTE_CHAR_CAP)
                : s.note,
          }),
        ),
    }));
  const keepIds = new Set(trimmedFindings.map((f) => f.id));
  return {
    ...findings,
    findings: trimmedFindings,
    positiveDevelopments: findings.positiveDevelopments.filter((id) =>
      keepIds.has(id),
    ),
    negativeDevelopments: findings.negativeDevelopments.filter((id) =>
      keepIds.has(id),
    ),
    neutralOrWatch: findings.neutralOrWatch.filter((id) => keepIds.has(id)),
    thesisCheckpointImpact: findings.thesisCheckpointImpact
      .slice(0, MAX_CHECKPOINT_NOTES)
      .map((c) => ({
        ...c,
        note: trimToCharBudget(c.note, FINDING_NOTE_CHAR_CAP),
        findingIds: c.findingIds.filter((id) => keepIds.has(id)),
      })),
    unresolvedQuestions: findings.unresolvedQuestions
      .slice(0, MAX_UNRESOLVED_QUESTIONS)
      .map((q) => trimToCharBudget(q, FINDING_NOTE_CHAR_CAP)),
    warnings: findings.warnings
      .slice(0, MAX_WARNINGS)
      .map((w) => trimToCharBudget(w, FINDING_NOTE_CHAR_CAP)),
  };
}
