import type { MemoDNA } from "../types";

export const demoMemoDna: MemoDNA = {
  projectId: "proj_demo_rategain",
  originalThesis:
    "RateGain is a structurally compounding travel-SaaS franchise where the mix shift toward MarTech (BCV, Adara, Myhotelshop) is dragging gross margin and ARR quality up while DaaS commoditizes. The bull case rests on the next 8 quarters proving that the acquired MarTech stack is cross-sellable into the hotel chain base, that ARR growth holds in the high-20s, and that the company crosses the Rule of 40 threshold by FY27. Position size scales with evidence of cross-sell, not headline revenue growth.",
  keyAssumptions: [
    "DaaS revenue grows mid-teens; MarTech grows 30%+ for the next 8 quarters.",
    "Recurring revenue share crosses 85% of total revenue by FY27.",
    "Adjusted EBITDA margin expands from ~17% (FY25) to 22-24% by FY27 via MarTech operating leverage.",
    "Gross retention stays above 95%; net revenue retention re-accelerates to 110%+ as cross-sell lands.",
    "No further large acquisitions; capital allocation pivots to buybacks once net cash crosses INR 12bn.",
    "FY27 EPS lands in the INR 18-20 range, supporting a 45x forward multiple at the entry point.",
  ],
  styleTone: {
    adjectives: [
      "concise",
      "thesis-driven",
      "buy-side, not sell-side",
      "evidence-weighted",
      "skeptical on guidance",
      "explicit about position sizing",
    ],
    sampleSentences: [
      "We size into RateGain only on quarters that prove cross-sell, not quarters that prove growth.",
      "Rule of 40 is the single number we track; everything else is a leading indicator for it.",
      "Management's MarTech narrative is credible but unproven at the chain-account level.",
      "We discount guidance by one standard deviation of historical beat magnitude before re-modeling EPS.",
    ],
  },
  analyticalFramework: [
    "Segment-level ARR walk: DaaS vs MarTech vs Distribution, quarter over quarter.",
    "Recurring revenue quality: subscription share, multi-year contracts, gross/net retention.",
    "Rule of 40 decomposition: revenue growth + adjusted EBITDA margin, deconstructed by segment.",
    "Acquisition discipline scorecard: payback period, revenue synergy realization, integration milestones.",
    "Unit economics: implied LTV/CAC by cohort, sales efficiency (magic number).",
    "Capital allocation: cash conversion, M&A pipeline, buyback authorization.",
  ],
  valuationFramework: {
    method: "Forward P/E with peer-multiple cross-check",
    targetMultiple: "45x FY27 EPS",
    bridgeNotes: [
      "Base case: 45x FY27 EPS of INR 18 = INR 810 fair value.",
      "Bull case: 50x FY27 EPS of INR 20 = INR 1,000 (cross-sell evidence visible).",
      "Bear case: 35x FY27 EPS of INR 15 = INR 525 (MarTech decoupling fails).",
      "Cross-check vs global travel-tech peers (Sabre, Amadeus, IDS Next) on EV/Sales and EV/EBITDA.",
    ],
  },
  openQuestions: [
    "Does the FY26 MarTech ARR walk show evidence of chain-level cross-sell, or only new-logo wins?",
    "What is the gross margin trajectory after BCV and Adara integration costs roll off?",
    "How is management thinking about AI-driven disintermediation of travel distribution metasearch?",
    "Is the deferred acquisition consideration tail (BCV + Adara) fully cleared by end FY27?",
    "Does net revenue retention re-accelerate above 110%, or is the post-pandemic catch-up effect fading?",
    "What is the credible buyback size once net cash crosses INR 12bn?",
  ],
  riskChecklist: [
    {
      category: "Business model risk",
      risks: [
        "DaaS commoditization accelerates as GenAI scrapes booking data.",
        "MarTech cross-sell motion fails to land in chain accounts.",
        "Net revenue retention drops below 100% as price competition intensifies.",
      ],
    },
    {
      category: "Execution / M&A risk",
      risks: [
        "Adara or BCV integration overruns push EBITDA margin expansion out by 12+ months.",
        "Management hires another acquisition rather than returning capital.",
        "Cultural and product-stack fragmentation slows shared roadmap.",
      ],
    },
    {
      category: "AI / macro risk",
      risks: [
        "OTA-side LLM agents bypass traditional metasearch distribution.",
        "Travel demand normalizes faster than expected post-2025 peak.",
        "INR strengthens vs USD, compressing reported revenue.",
      ],
    },
    {
      category: "Valuation risk",
      risks: [
        "Multiple de-rates if Rule of 40 slips below 30 in any single quarter.",
        "Indian SaaS multiples mean-revert toward global SaaS averages.",
        "Free-float overhang from PE exits caps upside.",
      ],
    },
  ],
  thesisCheckpoints: [
    {
      id: "cp_arr_growth",
      label: "ARR growth >25% YoY",
      expectedDirection: "up",
      rationale:
        "Mix shift to MarTech (30%+ growth) should pull blended ARR growth above 25% even with DaaS slowing.",
      sources: [{ documentId: "doc_demo_01", page: 4 }],
    },
    {
      id: "cp_rule_of_40",
      label: "Rule of 40 >35 by Q4 FY27",
      expectedDirection: "up",
      rationale:
        "EBITDA margin expansion from ~17% to 22-24% plus ~20% revenue growth puts the company comfortably over 40 by FY27.",
      sources: [{ documentId: "doc_demo_01", page: 6 }],
    },
    {
      id: "cp_nrr",
      label: "Net revenue retention >=110%",
      expectedDirection: "up",
      rationale:
        "Cross-sell of MarTech into the hotel chain base is the lever; we need to see seat expansion, not price.",
      sources: [{ documentId: "doc_demo_01", page: 8 }],
    },
    {
      id: "cp_capital_allocation",
      label: "First buyback authorization announced",
      expectedDirection: "up",
      rationale:
        "Signals discipline; absence of buyback by FY27 implies another acquisition is being prepared.",
      sources: [{ documentId: "doc_demo_01", page: 11 }],
    },
  ],
  isDemo: true,
};
