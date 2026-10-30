// Week 8 "The Price is Right" dashboard: the deals the agent pipeline found, each
// with its actual price, the pricer agent's estimated fair price, and the discount.
// The biggest discount is highlighted. "Scan for deals" calls GET /api/deals to
// re-scan. All data is clearly-labelled SAMPLE data - no live scanning here.
//
// The dashboard loads pre-ranked sample deals on first render (so it is useful even
// as a static build), and the shared sample set is imported from src/deals.ts - the
// same module the Hono API serves - so the two can never drift apart.
import { useState } from "react";
import {
  type Deal,
  sampleDeals,
  rankByDiscount,
  discountPercent,
} from "../../src/deals";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const INITIAL_DEALS = rankByDiscount(sampleDeals());

export function App() {
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function scan() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/deals");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed");
        return;
      }
      const data = (await res.json()) as { deals: Deal[] };
      setDeals(data.deals);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // The single best discount drives the "top deal" highlight.
  const bestDiscount = deals.reduce((max, d) => Math.max(max, d.discount), 0);

  return (
    <main className="wrap">
      <header>
        <h1>The Price is Right - Week 8</h1>
        <p className="sub">
          An autonomous multi-agent deal hunter. A Planning agent coordinates a Scanner
          (RSS deal feeds), an Ensemble pricer (frontier + fine-tuned + RAG models), and a
          Messaging agent to surface products priced well below their estimated value.
        </p>
        <p className="note">
          Demo dashboard - shows <strong>sample data</strong>, not a live scan. The real
          agent pipeline is Python.
        </p>
      </header>

      <div className="toolbar">
        <button onClick={scan} disabled={busy}>
          {busy ? "Scanning..." : "Scan for deals"}
        </button>
        <span className="count">
          {deals.length} deals - ranked by discount
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards">
        {deals.map((deal) => {
          const top = deal.discount === bestDiscount && bestDiscount > 0;
          const pct = discountPercent(deal);
          return (
            <article className={top ? "card top" : "card"} key={deal.url}>
              {top && <div className="badge">Biggest discount</div>}
              <h2 className="title">
                <a href={deal.url} target="_blank" rel="noreferrer">
                  {deal.title}
                </a>
              </h2>
              <div className="prices">
                <div className="price">
                  <span className="label">Price</span>
                  <span className="value">{usd(deal.price)}</span>
                </div>
                <div className="price">
                  <span className="label">Estimate</span>
                  <span className="value est">{usd(deal.estimate)}</span>
                </div>
                <div className="price">
                  <span className="label">Discount</span>
                  <span className="value save">
                    {usd(deal.discount)}
                    <small>{pct}%</small>
                  </span>
                </div>
              </div>
              <div className="bar" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
