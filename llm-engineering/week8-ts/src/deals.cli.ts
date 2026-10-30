// CLI for the Week 8 demo: print the sample deals ranked by discount.
// Kept separate from deals.ts so that module stays browser-safe (no Node APIs),
// letting both the Hono server and the React bundle import it.
//
// Run with: npm run deals
import { rankByDiscount, sampleDeals, discountPercent } from "./deals.js";

const ranked = rankByDiscount(sampleDeals());
console.log("Week 8 - sample deals ranked by discount (SAMPLE DATA, not live):\n");
for (const deal of ranked) {
  const line = [
    `$${deal.price}`.padEnd(7),
    `est $${deal.estimate}`.padEnd(11),
    `save $${deal.discount} (${discountPercent(deal)}%)`.padEnd(20),
    deal.title,
  ].join("  ");
  console.log(line);
}

const top = ranked[0];
if (top) {
  console.log(
    `\nTop deal: ${top.title} - $${top.price} vs est $${top.estimate}, ` +
      `save $${top.discount} (${discountPercent(top)}%).`,
  );
}
