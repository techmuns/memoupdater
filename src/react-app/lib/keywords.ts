export interface KeywordEntry {
  phrase: string;
  pattern: RegExp;
  category:
    | "saas"
    | "recurring"
    | "rule_of_40"
    | "unit_economics"
    | "valuation"
    | "growth"
    | "execution"
    | "ai_macro"
    | "acquisition"
    | "guidance"
    | "position_sizing";
  weight: number;
}

const w = (phrase: string, category: KeywordEntry["category"], weight = 1): KeywordEntry => ({
  phrase,
  pattern: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
  category,
  weight,
});

export const KEYWORDS: KeywordEntry[] = [
  // SaaS / business model
  w("SaaS", "saas", 2),
  w("Software-as-a-Service", "saas", 2),
  w("subscription", "saas", 1),
  w("MarTech", "saas", 2),
  w("DaaS", "saas", 2),
  w("Distribution", "saas", 1),
  w("platform", "saas", 1),

  // Recurring revenue quality
  w("ARR", "recurring", 2),
  w("annual recurring revenue", "recurring", 2),
  w("recurring revenue", "recurring", 2),
  w("net revenue retention", "recurring", 2),
  w("NRR", "recurring", 2),
  w("gross retention", "recurring", 2),
  w("churn", "recurring", 1),
  w("cohort", "recurring", 1),

  // Rule of 40
  w("Rule of 40", "rule_of_40", 3),

  // Unit economics
  w("LTV/CAC", "unit_economics", 2),
  w("LTV", "unit_economics", 1),
  w("CAC", "unit_economics", 1),
  w("magic number", "unit_economics", 1),
  w("payback period", "unit_economics", 1),
  w("gross margin", "unit_economics", 1),

  // Valuation
  w("EV/EBITDA", "valuation", 2),
  w("EV/Sales", "valuation", 2),
  w("P/E", "valuation", 2),
  w("DCF", "valuation", 1),
  w("target price", "valuation", 2),
  w("fair value", "valuation", 2),
  w("target multiple", "valuation", 2),
  w("upside", "valuation", 1),
  w("downside", "valuation", 1),
  w("peer multiple", "valuation", 1),

  // Growth / metrics
  w("EBITDA margin", "growth", 2),
  w("EBITDA", "growth", 1),
  w("EPS", "growth", 2),
  w("revenue growth", "growth", 1),
  w("YoY", "growth", 1),
  w("guidance", "guidance", 2),
  w("management guidance", "guidance", 2),

  // Execution / acquisition
  w("execution", "execution", 1),
  w("track record", "execution", 1),
  w("acquisition", "acquisition", 2),
  w("integration", "acquisition", 1),
  w("M&A", "acquisition", 2),
  w("inorganic", "acquisition", 1),

  // AI / macro
  w("AI", "ai_macro", 1),
  w("GenAI", "ai_macro", 1),
  w("disruption", "ai_macro", 1),
  w("macro", "ai_macro", 1),
  w("FX", "ai_macro", 1),
  w("regulatory", "ai_macro", 1),

  // Position sizing
  w("position size", "position_sizing", 2),
  w("portfolio weight", "position_sizing", 2),
  w("conviction", "position_sizing", 1),
  w("Hold", "position_sizing", 1),
  w("Buy", "position_sizing", 1),
  w("Sell", "position_sizing", 1),
  w("Trim", "position_sizing", 1),
  w("Add", "position_sizing", 1),
];

export const CATEGORY_LABEL: Record<KeywordEntry["category"], string> = {
  saas: "SaaS / business model",
  recurring: "Recurring revenue quality",
  rule_of_40: "Rule of 40",
  unit_economics: "Unit economics",
  valuation: "Valuation framework",
  growth: "Growth & profitability",
  execution: "Execution",
  ai_macro: "AI / macro",
  acquisition: "Acquisition discipline",
  guidance: "Management guidance",
  position_sizing: "Position sizing",
};

const COMMON_STOPWORD_TICKERS = new Set([
  "THE",
  "AND",
  "FOR",
  "WITH",
  "FROM",
  "THIS",
  "THAT",
  "WAS",
  "ARE",
  "HAS",
  "HAVE",
  "WILL",
  "WHICH",
  "WHAT",
  "WHEN",
  "WHERE",
  "WHY",
  "HOW",
  "INTO",
  "BUT",
  "NOT",
  "YOU",
  "OUR",
  "WE",
  "USD",
  "EUR",
  "INR",
  "GBP",
  "FY",
  "FY24",
  "FY25",
  "FY26",
  "FY27",
  "FY28",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "CEO",
  "CFO",
  "COO",
  "CTO",
  "AI",
  "GDP",
  "EPS",
  "ARR",
  "NRR",
  "DCF",
  "EBITDA",
  "DAU",
  "MAU",
  "GMV",
  "SAAS",
]);

export function isPotentialTicker(token: string): boolean {
  return (
    /^[A-Z]{2,6}$/.test(token) &&
    !COMMON_STOPWORD_TICKERS.has(token.toUpperCase())
  );
}

const SECTOR_KEYWORDS: { sector: string; patterns: RegExp[] }[] = [
  {
    sector: "Travel / Hospitality",
    patterns: [/\btravel\b/i, /\bhotel\b/i, /\bhospitality\b/i, /\bairline\b/i, /\bRevPAR\b/i],
  },
  {
    sector: "SaaS / Software",
    patterns: [/\bSaaS\b/i, /\bsoftware\b/i, /\bsubscription\b/i, /\bplatform\b/i],
  },
  {
    sector: "Fintech / Financials",
    patterns: [/\bfintech\b/i, /\bbank\b/i, /\bpayments?\b/i, /\binsurance\b/i, /\blending\b/i],
  },
  {
    sector: "E-commerce / Internet",
    patterns: [/\be-?commerce\b/i, /\bmarketplace\b/i, /\bGMV\b/i],
  },
  {
    sector: "Healthcare",
    patterns: [/\bpharma\b/i, /\bhospitals?\b/i, /\bbiotech\b/i, /\bmedical\b/i],
  },
  {
    sector: "Industrial / Energy",
    patterns: [/\bindustrial\b/i, /\benergy\b/i, /\bsolar\b/i, /\bwind\b/i, /\boil\b/i, /\bcapex\b/i],
  },
  {
    sector: "Consumer",
    patterns: [/\bconsumer\b/i, /\bretail\b/i, /\bFMCG\b/i, /\bbrand\b/i],
  },
];

export function detectSector(text: string): string | undefined {
  const scores: { sector: string; score: number }[] = [];
  for (const s of SECTOR_KEYWORDS) {
    let score = 0;
    for (const p of s.patterns) {
      // The sector patterns have no `g` flag, so a plain match() returns only
      // the first hit (length 1). Count every occurrence so a strongly-themed
      // memo actually outscores one with a single stray keyword.
      const g = p.global ? p : new RegExp(p.source, p.flags + "g");
      const matches = text.match(g);
      if (matches) score += matches.length;
    }
    if (score > 0) scores.push({ sector: s.sector, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.sector;
}
