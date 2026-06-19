// Pure helpers run client-side over the extracted memo text BEFORE the
// memo-understanding LLM call. They drive two decisions:
//
// 1. The memo's WRITTEN-ON date — every memo has one ("Beas Capital, 7 May
//    2024", "Dated: 07-05-2024", "as of May 7, 2024"). We need a deterministic
//    pick so return calculations have a real start date and the period panel
//    surfaces a confirmable field instead of "fiscal calendar unknown · LOW
//    CONFIDENCE".
//
// 2. SECTION COVERAGE — which topics did this memo actually cover?
//    Shareholding-pattern data, financial forecasts, sizing, etc. The
//    follow-up memo generation skips sections the original memo didn't touch
//    (e.g. don't print a Shareholding section when the original memo never
//    mentioned promoter / FII / DII / mutual-fund holding).
//
// Both helpers are intentionally simple regex/keyword scans — deterministic,
// auditable, and easy to extend without re-prompting the LLM.

export type MemoDateConfidence = "high" | "medium" | "low";

export interface MemoWrittenOn {
  iso: string;            // YYYY-MM-DD
  raw: string;            // the literal substring we matched
  confidence: MemoDateConfidence;
  reason: string;         // short human explanation, e.g. "explicit 'Dated:' anchor"
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const MONTH_LOOKUP = new Map<string, number>();
for (let i = 0; i < MONTHS.length; i++) {
  const full = MONTHS[i].toLowerCase();
  const abbr = full.slice(0, 3);
  MONTH_LOOKUP.set(full, i + 1);
  MONTH_LOOKUP.set(abbr, i + 1);
}
// Common 4-letter month abbreviations
MONTH_LOOKUP.set("sept", 9);

const ANCHOR_TOKENS_RE =
  /(dated|date of report|report date|publication date|as of|written on|published|stage\s*1\s*(?:memo|note)|investment memo|initiation)\s*[:\-—–]?\s*/i;

// "7 May 2024" / "7th May 2024" / "07 May, 2024"
const DMY_NAMED_RE =
  /\b(\d{1,2})(?:st|nd|rd|th)?[\s,]+([A-Za-z]+)[\s,]+(\d{2,4})\b/g;
// "May 7, 2024" / "May 7 2024" / "May, 2024"
const MDY_NAMED_RE =
  /\b([A-Za-z]+)[\s,]+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(\d{2,4})\b/g;
// Month + year only ("May 2024") — coarser, low confidence
const MY_RE = /\b([A-Za-z]+)[\s,]+(\d{4})\b/g;
// ISO 2024-05-07
const ISO_RE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
// Numeric DD-MM-YYYY / DD/MM/YYYY (and the MM-DD-YYYY twin). We default to
// DAY-MONTH-YEAR (Indian/European convention, the dominant style in the memos
// this dashboard sees); we'd flip on a clear US signal in the text.
const NUMERIC_DMY_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;

// Extract the memo's "written on" date. Strategy:
//   1. Look for an explicit anchor token nearby (dated:, as of, ...). The
//      anchor wins; mark high confidence.
//   2. Look in the FIRST ~1500 chars (header region) for a "DD Month YYYY"
//      style date — these are almost always the publication date. High
//      confidence.
//   3. Look near a "financial summary" block (a date next to 'CMP', 'EPS',
//      'Target price', 'Multiple' — a very common Indian buy-side layout).
//      High confidence when matched.
//   4. Fall back to any "Month DD, YYYY" / ISO / numeric date in the
//      ~16k-char scan window. Medium confidence.
//   5. If only a "Month YYYY" or a numeric date with ambiguous order
//      survives, return it at low confidence so the UI prompts the user.
//
// (We intentionally also wire the LLM's `understanding.memo.publishedDate`
// from MemoUnderstanding as the AUTHORITATIVE override once the deeper
// analysis lands — see MemoProjectContext.SET_UNDERSTANDING — so this regex
// is a fast first pass, not the final source of truth.)
export function detectMemoWrittenOn(text: string): MemoWrittenOn | null {
  if (typeof text !== "string" || text.length === 0) return null;
  // Scan window: expanded from 3000 to 16k so dates printed in the
  // financial-summary footer (a common Indian buy-side layout) aren't
  // missed. Most memos are shorter than 16k chars; broker decks rarely
  // longer.
  const head = text.slice(0, 16_000);

  // 1. Anchored: "dated: 7 May 2024", "as of 07-05-2024"
  const anchored = scanAnchored(text);
  if (anchored) return anchored;

  // 2. Header DD-Month-YYYY (the very common "Beas Capital, 7 May 2024")
  const header = scanFirstNamedDate(head.slice(0, 1500));
  if (header) return header;

  // 3. Financial-summary block — a date sitting beside CMP / EPS / Target
  // price / Multiple. Almost always the memo publication date.
  const finSummary = scanFinancialSummaryDate(head);
  if (finSummary) return finSummary;

  // 4. Any clear named date in the expanded window
  const named = scanFirstNamedDate(head);
  if (named) return named;

  // 5. ISO
  const iso = scanFirstIso(head);
  if (iso) return iso;

  // 6. Numeric DD-MM-YYYY (assumed)
  const num = scanFirstNumeric(head);
  if (num) return num;

  // 7. Last resort: "Month YYYY" (e.g. "May 2024") → snap to 1st of month, low conf
  const my = scanMonthYear(head);
  if (my) return my;

  return null;
}

function scanAnchored(text: string): MemoWrittenOn | null {
  const window = text.slice(0, 5000);
  let m: RegExpExecArray | null;
  const reAnchor = new RegExp(ANCHOR_TOKENS_RE.source, "gi");
  while ((m = reAnchor.exec(window)) !== null) {
    const after = window.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const dmy = matchOnce(DMY_NAMED_RE, after);
    if (dmy) {
      const iso = isoFromDMYNamed(dmy[1], dmy[2], dmy[3]);
      if (iso) return { iso, raw: dmy[0], confidence: "high", reason: "explicit anchor (\"dated:\" / \"as of\" / similar)" };
    }
    const mdy = matchOnce(MDY_NAMED_RE, after);
    if (mdy) {
      const iso = isoFromMDYNamed(mdy[1], mdy[2], mdy[3]);
      if (iso) return { iso, raw: mdy[0], confidence: "high", reason: "explicit anchor (\"dated:\" / \"as of\" / similar)" };
    }
    const isoM = matchOnce(ISO_RE, after);
    if (isoM) {
      const iso = isoFromIso(isoM[1], isoM[2], isoM[3]);
      if (iso) return { iso, raw: isoM[0], confidence: "high", reason: "explicit anchor + ISO date" };
    }
    const numM = matchOnce(NUMERIC_DMY_RE, after);
    if (numM) {
      const iso = isoFromNumericDMY(numM[1], numM[2], numM[3]);
      if (iso) return { iso, raw: numM[0], confidence: "high", reason: "explicit anchor + numeric date (DD-MM-YYYY assumed)" };
    }
  }
  return null;
}

// Indian buy-side memos very often print the date inline with the financial
// summary block: "07-05-2024 CMP 670 EPS 24 Multiple 40x 45x FY26 Target
// price 960 ...". A date directly adjacent (within ~120 chars) to one of
// these markers is almost certainly the publication date — promote it to
// high confidence even though the standalone numeric scan would only give
// medium.
const FIN_SUMMARY_TOKENS = [
  "CMP",
  "EPS",
  "Target price",
  "Multiple",
  "Forward P/E",
  "XIRR",
  "Upside",
];
function scanFinancialSummaryDate(window: string): MemoWrittenOn | null {
  for (const token of FIN_SUMMARY_TOKENS) {
    const idx = window.indexOf(token);
    if (idx < 0) continue;
    const ctx = window.slice(Math.max(0, idx - 120), idx + 120);
    // Try forms in priority order.
    const candidates: Array<{ re: RegExp; build: (m: RegExpExecArray) => string | null }> = [
      { re: DMY_NAMED_RE, build: (m) => isoFromDMYNamed(m[1], m[2], m[3]) },
      { re: MDY_NAMED_RE, build: (m) => isoFromMDYNamed(m[1], m[2], m[3]) },
      { re: ISO_RE, build: (m) => isoFromIso(m[1], m[2], m[3]) },
      { re: NUMERIC_DMY_RE, build: (m) => isoFromNumericDMY(m[1], m[2], m[3]) },
    ];
    for (const c of candidates) {
      const m = matchOnce(c.re, ctx);
      if (!m) continue;
      const iso = c.build(m);
      if (!iso) continue;
      return {
        iso,
        raw: m[0],
        confidence: "high",
        reason: `date adjacent to financial-summary marker ("${token}")`,
      };
    }
  }
  return null;
}

function scanFirstNamedDate(window: string): MemoWrittenOn | null {
  // Try DMY first (more common in Indian memos)
  const dmy = matchOnce(DMY_NAMED_RE, window);
  if (dmy) {
    const iso = isoFromDMYNamed(dmy[1], dmy[2], dmy[3]);
    if (iso) {
      return { iso, raw: dmy[0], confidence: "high", reason: "named-month date in header (DD Month YYYY)" };
    }
  }
  const mdy = matchOnce(MDY_NAMED_RE, window);
  if (mdy) {
    const iso = isoFromMDYNamed(mdy[1], mdy[2], mdy[3]);
    if (iso) {
      return { iso, raw: mdy[0], confidence: "high", reason: "named-month date in header (Month DD, YYYY)" };
    }
  }
  return null;
}

function scanFirstIso(window: string): MemoWrittenOn | null {
  const m = matchOnce(ISO_RE, window);
  if (!m) return null;
  const iso = isoFromIso(m[1], m[2], m[3]);
  if (!iso) return null;
  return { iso, raw: m[0], confidence: "medium", reason: "ISO YYYY-MM-DD date in header" };
}

function scanFirstNumeric(window: string): MemoWrittenOn | null {
  const m = matchOnce(NUMERIC_DMY_RE, window);
  if (!m) return null;
  const iso = isoFromNumericDMY(m[1], m[2], m[3]);
  if (!iso) return null;
  return { iso, raw: m[0], confidence: "low", reason: "numeric date — DD-MM-YYYY assumed; please confirm" };
}

function scanMonthYear(window: string): MemoWrittenOn | null {
  const m = matchOnce(MY_RE, window);
  if (!m) return null;
  const monthIdx = monthNumber(m[1]);
  const year = normaliseYear(m[2]);
  if (!monthIdx || !year) return null;
  return {
    iso: `${pad4(year)}-${pad2(monthIdx)}-01`,
    raw: m[0],
    confidence: "low",
    reason: "month-year only — snapped to 1st of month; please confirm",
  };
}

function matchOnce(re: RegExp, text: string): RegExpExecArray | null {
  // Create a fresh, sticky-free regex from the source so the global state
  // doesn't carry between calls.
  const local = new RegExp(re.source, re.flags.replace("g", "") + "g");
  return local.exec(text);
}

function monthNumber(token: string | undefined): number | null {
  if (!token) return null;
  const k = token.toLowerCase().replace(/[.,]/g, "");
  return MONTH_LOOKUP.get(k) ?? null;
}

function normaliseYear(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 100 && n < 1000) return null;
  if (n < 100) return 2000 + n; // '24 -> 2024
  return n;
}

function isoFromDMYNamed(d: string, mName: string, y: string): string | null {
  const day = parseInt(d, 10);
  const month = monthNumber(mName);
  const year = normaliseYear(y);
  if (!month || !year || !Number.isFinite(day)) return null;
  if (day < 1 || day > 31) return null;
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}
function isoFromMDYNamed(mName: string, d: string, y: string): string | null {
  return isoFromDMYNamed(d, mName, y);
}
function isoFromIso(y: string, m: string, d: string): string | null {
  const year = normaliseYear(y);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}
function isoFromNumericDMY(a: string, b: string, c: string): string | null {
  // Default DAY-MONTH-YEAR. Reject if either of the first two > 12 in a
  // direction that would force MDY.
  const day = parseInt(a, 10);
  const month = parseInt(b, 10);
  const year = normaliseYear(c);
  if (!year || !Number.isFinite(day) || !Number.isFinite(month)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function pad4(n: number): string {
  return n < 1000 ? `0000${n}`.slice(-4) : `${n}`;
}

// Parse a free-form date string (typically MemoUnderstanding's
// `memo.publishedDate`, which the LLM may emit as ISO, "7 May 2024", "May
// 7, 2024", "07-05-2024", etc.) into ISO YYYY-MM-DD. Returns null on
// anything we can't confidently parse. Reuses the same building blocks as
// the document-scanning regex pass so the two paths stay consistent.
export function parseFreeFormDateToIso(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Try ISO first (most common LLM emission).
  const iso = matchOnce(ISO_RE, trimmed);
  if (iso) {
    const out = isoFromIso(iso[1], iso[2], iso[3]);
    if (out) return out;
  }
  const dmy = matchOnce(DMY_NAMED_RE, trimmed);
  if (dmy) {
    const out = isoFromDMYNamed(dmy[1], dmy[2], dmy[3]);
    if (out) return out;
  }
  const mdy = matchOnce(MDY_NAMED_RE, trimmed);
  if (mdy) {
    const out = isoFromMDYNamed(mdy[1], mdy[2], mdy[3]);
    if (out) return out;
  }
  const num = matchOnce(NUMERIC_DMY_RE, trimmed);
  if (num) {
    const out = isoFromNumericDMY(num[1], num[2], num[3]);
    if (out) return out;
  }
  return null;
}

// ---------- COVERAGE SIGNALS --------------------------------------------

export interface MemoCoverageSignals {
  shareholding: boolean;       // memo discussed promoter / FII / DII / pledge / QIP / insider
  forecasts: boolean;          // memo gave forward financial forecasts
  valuationFramework: boolean; // memo cited a multiple + target methodology
  governance: boolean;         // memo discussed board, auditor, CFO, KMP
  industry: boolean;           // memo discussed sector / regulation / competition
  positionSizing: boolean;     // memo recommended a portfolio weight / sizing
}

const SHAREHOLDING_RE = /\b(promoter|FII|FPI|DII|mutual fund|shareholding|pledge|QIP|insider|preferential allotment|warrant|rights issue|buyback)\b/i;
const FORECAST_RE = /\b(FY\d|forecast|target|estimate|guided|guidance|projection|next year|over\s+\d\s*years|in\s*\d\s*years)\b/i;
const VALUATION_RE = /\b(P\/E|EV\/EBITDA|EV\/Sales|target price|valuation|multiple|DCF|SOTP|fair value|target\s*INR|target\s*Rs|target\s*\$|target\s*£)\b/i;
const GOVERNANCE_RE = /\b(board|auditor|CFO|CEO|COO|chairman|independent director|KMP|key managerial|management quality|governance)\b/i;
const INDUSTRY_RE = /\b(industry|sector|regulation|regulator|competit|market share|TAM|demand|pricing power|consolidation|disruption|peer|peers)\b/i;
const SIZING_RE = /\b(portfolio|position size|sizing|weight|conviction|add\s*\d+\s*%|up to \d+\s*%|maximum|recommend.{0,30}\d+\s*%)\b/i;

export function computeMemoCoverage(text: string): MemoCoverageSignals {
  const t = typeof text === "string" ? text : "";
  return {
    shareholding: SHAREHOLDING_RE.test(t),
    forecasts: FORECAST_RE.test(t),
    valuationFramework: VALUATION_RE.test(t),
    governance: GOVERNANCE_RE.test(t),
    industry: INDUSTRY_RE.test(t),
    positionSizing: SIZING_RE.test(t),
  };
}
