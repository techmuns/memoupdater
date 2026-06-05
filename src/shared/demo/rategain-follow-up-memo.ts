import type { FollowUpMemo } from "../types";

export const demoFollowUpMemo: FollowUpMemo = {
  projectId: "proj_demo_rategain",
  title: "RateGain Follow-up Memo — Demo Output",
  generatedAt: "2026-06-05T09:12:00.000Z",
  sections: [
    {
      id: "sec_thesis_snapshot",
      title: "Original Thesis Snapshot",
      body: "The September 2025 memo argued that RateGain is a structurally compounding travel-SaaS franchise where the mix shift toward MarTech drags ARR quality up while DaaS commoditizes. The position was sized to scale only on evidence of chain-level cross-sell, with Rule of 40 as the single number to monitor and a 45x FY27 EPS target multiple anchoring fair value at roughly INR 810. Re-test scope: have Q4 FY26 results and the May earnings call moved the needle on cross-sell evidence, Rule of 40 trajectory, and capital allocation discipline?",
      sources: [{ documentId: "doc_demo_01" }],
    },
    {
      id: "sec_q4_retest",
      title: "Q4 / Latest Financial Re-test",
      body: "Q4 FY26 print: total revenue +21% YoY, ARR +24% YoY (in line with the >25% checkpoint within margin of error). MarTech segment ARR +33% YoY — slightly above plan. DaaS held at +14% — better than feared. Adjusted EBITDA margin landed at 19.4% (vs 17% LTM), tracking the path to 22-24% by FY27. Recurring revenue share rose to 83% (vs 81% prior). Net revenue retention came in at 108% — below the 110% threshold we wanted, and the single most important miss in the print. Gross retention 96% — clean.",
      sources: [{ documentId: "doc_demo_02", page: 3 }],
    },
    {
      id: "sec_mgmt_retest",
      title: "Management Commentary Re-test",
      body: "On the call, management was direct on three things we wanted clarity on: (1) MarTech cross-sell is landing at the chain account level, with three named global hotel chains expanding from one product to three; (2) BCV and Adara integration is on the back half of the curve, with shared-platform milestones expected by Q2 FY27; (3) No new acquisitions in the immediate pipeline; the CFO referenced a 'capital return framework' for the first time. Tone was disciplined; guidance was raised modestly but management explicitly under-promised on FY27 margin to preserve credibility.",
      sources: [
        { documentId: "doc_demo_03", page: 5 },
        { documentId: "doc_demo_03", page: 11 },
      ],
    },
    {
      id: "sec_ai_macro_risk",
      title: "AI / Macro / Competitive Risk Check",
      body: "AI disintermediation thesis tested: the third-party note (June 2026) argues that OTA-side LLM agents will compress metasearch margins by 200-400 bps over the next 18 months, but explicitly carves out the B2B hotel-distribution layer where RateGain plays. Competitor read across (Sabre, Amadeus, IDS Next) suggests pricing pressure is concentrated in legacy CRS, not in dynamic-pricing or guest-acquisition SaaS. Macro travel demand normalizing — RevPAR growth slowed to +3% globally — but enterprise hotel IT spend remains a budget priority. INR weakened ~2% vs USD this quarter, neutral-to-positive for reported numbers.",
      sources: [
        { documentId: "doc_demo_05" },
        { documentId: "doc_demo_06", page: 7 },
      ],
    },
    {
      id: "sec_memo_held",
      title: "Where the Original Memo Held",
      body: "The MarTech-as-quality-engine framing held: gross margin expansion is real, ARR mix continues to improve, and chain-level cross-sell is no longer a hypothesis. The acquisition discipline call held: no new deals, first reference to capital return. Rule of 40 trajectory is intact (19.4% margin + 21% revenue growth = 40.4 LTM, with line of sight to mid-40s by FY27). The valuation framework anchoring on FY27 EPS still maps to current consensus.",
      sources: [],
    },
    {
      id: "sec_memo_broke",
      title: "Where the Original Memo Broke",
      body: "Net revenue retention at 108% vs the 110% checkpoint is a real signal — not catastrophic, but it forces a re-test of the bull-case assumption that seat expansion would re-accelerate to pre-pandemic levels. Two read-throughs: (1) the post-pandemic catch-up tailwind is fading faster than we modeled, or (2) cross-sell motion is landing in fewer accounts than the qualitative commentary suggests. Either way, FY27 ARR growth probability-weights down from 27% to 24% in our model, and that compresses fair value by ~6%.",
      sources: [{ documentId: "doc_demo_02", page: 4 }],
    },
    {
      id: "sec_eps_bridge",
      title: "FY27–FY28 EPS Credibility Bridge",
      body: "Pre-print model: FY27 EPS INR 18.4, FY28 INR 22.1. Post-print re-bridge: FY27 EPS INR 17.6 (-4% on NRR drag and slightly higher integration opex), FY28 INR 22.5 (+2% on confirmed BCV/Adara opex roll-off). Components of the FY27 walk: revenue contribution +INR 2.1, MarTech margin expansion +INR 1.4, integration cost roll-off +INR 0.6, NRR drag -INR 0.9, tax-rate normalization -INR 0.4. The FY28 number actually firms up — the bridge converges on the original FY28 thesis even as FY27 softens.",
      sources: [{ documentId: "doc_demo_02", page: 6 }],
    },
    {
      id: "sec_valuation_peer_gap",
      title: "Valuation and Peer Gap",
      body: "Current price (June 5, 2026): INR 742. Fair value at 45x revised FY27 EPS of INR 17.6 = INR 792. Bull-case at 50x FY28 EPS of INR 22.5 = INR 1,125 (12-month horizon). Bear-case at 35x FY27 of INR 16 = INR 560. Implied upside to base case ~7%; to bull case ~52%. Peer multiples: Sabre 18x, Amadeus 22x, IDS Next 38x — RateGain at ~42x current consensus screens rich on a snapshot basis but cheap relative to ARR growth differential (RateGain ARR growth ~2x peer average).",
      sources: [{ documentId: "doc_demo_07" }],
    },
    {
      id: "sec_final_action",
      title: "Final Investment Action",
      body: "Hold at current 3% portfolio weight. Do not add until either (a) net revenue retention re-accelerates above 110% in Q1 or Q2 FY27, or (b) the first concrete buyback authorization is announced. Trim trigger: NRR <105% in two consecutive quarters, or any new acquisition >INR 5bn. Add trigger: NRR >=112% with chain-account ARR disclosed separately. The thesis is intact; the position-sizing logic from the original memo (scale on cross-sell evidence, not on growth) is what's keeping us measured.",
      sources: [],
    },
  ],
  isDemo: true,
};
