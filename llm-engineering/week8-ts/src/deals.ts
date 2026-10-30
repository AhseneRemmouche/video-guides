// Week 8 - "The Price is Right" deal model (TypeScript demo port).
//
// In the real course build, a Planning agent coordinates a Scanner agent (pulls
// items from RSS deal feeds), an Ensemble pricer agent (a frontier model + a
// fine-tuned open-source pricer deployed on Modal + a RAG model) to estimate each
// item's fair price, and a Messaging agent that pushes a notification when an item
// is priced well below the estimate. That whole pipeline is Python.
//
// This file is ONLY the data shape the dashboard displays, plus clearly-labelled
// SAMPLE deals and pure helpers. No models, no network, no keys, no Node APIs, so
// it is safe to import from both the Hono server and the browser bundle.
//
// `npm run deals` (src/deals.cli.ts) prints the sample deals ranked by discount.

export interface Deal {
  // Short product title as the Scanner agent would extract it from the feed.
  title: string;
  // Link back to the original deal listing.
  url: string;
  // The advertised price in USD (what the item is actually selling for).
  price: number;
  // The pricer agent's estimate of the item's fair market value in USD.
  estimate: number;
  // How far below the estimate the price is, in USD (estimate - price).
  // A larger discount means a better deal. Rounded to whole dollars.
  discount: number;
}

// Build a Deal from a title/url/price/estimate, computing the discount so it can
// never drift out of sync with the two prices it is derived from.
export function makeDeal(
  title: string,
  url: string,
  price: number,
  estimate: number,
): Deal {
  return { title, url, price, estimate, discount: Math.round(estimate - price) };
}

// The discount as a percentage of the estimated fair price (0 when estimate <= 0).
export function discountPercent(deal: Deal): number {
  if (deal.estimate <= 0) return 0;
  return Math.round((deal.discount / deal.estimate) * 100);
}

// ~6 realistic SAMPLE deals. These are hand-written stand-ins for what the Scanner
// + pricer agents would surface at runtime - NOT live data. The URLs are
// illustrative example.com links, not real listings.
export function sampleDeals(): Deal[] {
  return [
    makeDeal(
      "Sony WH-1000XM5 Wireless Noise-Cancelling Headphones",
      "https://example.com/deals/sony-wh1000xm5",
      248,
      399,
    ),
    makeDeal(
      "LG 65-inch C3 OLED 4K Smart TV (2023)",
      "https://example.com/deals/lg-c3-65",
      1299,
      1899,
    ),
    makeDeal(
      "Ninja Foodi 8-Quart 9-in-1 Pressure Cooker & Air Fryer",
      "https://example.com/deals/ninja-foodi-8qt",
      119,
      199,
    ),
    makeDeal(
      "Bose QuietComfort Ultra Earbuds",
      "https://example.com/deals/bose-qc-ultra",
      229,
      299,
    ),
    makeDeal(
      "DeWalt 20V MAX Cordless Drill Combo Kit (2-Tool)",
      "https://example.com/deals/dewalt-20v-combo",
      179,
      249,
    ),
    makeDeal(
      "Apple AirPods Pro (2nd generation, USB-C)",
      "https://example.com/deals/airpods-pro-2",
      189,
      249,
    ),
  ];
}

// Pure function: return a new array sorted by discount, biggest first.
// Does not mutate the input (the course's Planning agent surfaces the best deals
// at the top; this is the sort behind that).
export function rankByDiscount(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => b.discount - a.discount);
}
