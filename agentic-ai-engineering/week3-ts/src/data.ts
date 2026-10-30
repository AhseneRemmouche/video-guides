import type { StockPickResult } from "./types";

// --- DEMO DATA ---------------------------------------------------------------
// This is a hard-coded, REPRESENTATIVE result, not a live crew run. CrewAI is
// Python-only; this React page exists purely to visualize the SHAPE of what the
// stock_picker crew produces (trending companies -> research -> a final pick).
// The companies and tickers are real, well-known public companies; the analysis
// text is illustrative and must NOT be read as investment advice.
export const demoResult: StockPickResult = {
  sector: "Technology",
  generatedAt: "2026-10-30",
  trending: [
    {
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      reason:
        "Datacenter GPU demand for AI training/inference keeps setting records; new accelerator generation announced.",
    },
    {
      name: "Advanced Micro Devices",
      ticker: "AMD",
      reason:
        "Gaining server-CPU and AI-accelerator share; strong design wins with hyperscalers in the news.",
    },
    {
      name: "ASML Holding",
      ticker: "ASML",
      reason:
        "Sole supplier of EUV lithography; order book and export-policy headlines keep it in the spotlight.",
    },
  ],
  research: [
    {
      name: "NVIDIA Corporation",
      ticker: "NVDA",
      marketPosition:
        "Dominant in AI accelerators with a deep CUDA software moat and leading datacenter share.",
      futureOutlook:
        "Multi-year AI capex cycle supports growth; main risks are competition and customer concentration.",
      investmentPotential:
        "High growth but a premium valuation — most of the good news may already be priced in.",
    },
    {
      name: "Advanced Micro Devices",
      ticker: "AMD",
      marketPosition:
        "Strong #2 in CPUs and an emerging AI-accelerator challenger with improving execution.",
      futureOutlook:
        "Room to take share from incumbents; AI GPU ramp is the key swing factor.",
      investmentPotential:
        "Attractive risk/reward if the AI roadmap lands; more upside optionality than the leader.",
    },
    {
      name: "ASML Holding",
      ticker: "ASML",
      marketPosition:
        "Monopoly on EUV lithography — a structural choke point for advanced-node manufacturing.",
      futureOutlook:
        "Secular demand for leading-edge chips; cyclicality and export controls are the main risks.",
      investmentPotential:
        "Durable moat and steady demand make it the most defensive pick of the three.",
    },
  ],
  decision: {
    chosenTicker: "AMD",
    rationale:
      "AMD offers the best risk/reward: a credible AI-accelerator ramp and CPU share gains at a less demanding valuation than the market leader.",
    report:
      "AMD was chosen for its combination of improving execution, genuine AI-accelerator optionality, and a more reasonable valuation than NVDA. NVIDIA remains the category leader but already trades at a premium that prices in much of the AI cycle. ASML has the most durable moat but the least near-term catalyst and more exposure to export-policy swings. On a 12–24 month view, AMD has the widest gap between expectations and potential.",
    notSelected: [
      {
        ticker: "NVDA",
        why: "Best-in-class business, but a premium valuation leaves less margin of safety.",
      },
      {
        ticker: "ASML",
        why: "Strongest moat, but fewer near-term catalysts and more policy risk.",
      },
    ],
  },
};
