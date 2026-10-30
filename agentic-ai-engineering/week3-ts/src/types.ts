// These mirror the Pydantic models in the Python crew (src/stock_picker/crew.py):
//   TrendingCompany, TrendingCompanyResearch, and the final pick_best_company output.

export interface TrendingCompany {
  name: string;
  ticker: string;
  reason: string;
}

export interface TrendingCompanyResearch {
  name: string;
  ticker: string;
  marketPosition: string;
  futureOutlook: string;
  investmentPotential: string;
}

export interface StockPickResult {
  sector: string;
  generatedAt: string;
  trending: TrendingCompany[];
  research: TrendingCompanyResearch[];
  decision: {
    chosenTicker: string;
    rationale: string; // the 1-sentence rationale "pushed" to the user
    report: string; // the longer decision report
    notSelected: { ticker: string; why: string }[];
  };
}
