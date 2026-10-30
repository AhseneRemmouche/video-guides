import { demoResult } from "./data";
import type { TrendingCompanyResearch } from "./types";

function researchFor(ticker: string): TrendingCompanyResearch | undefined {
  return demoResult.research.find((r) => r.ticker === ticker);
}

export default function App() {
  const { sector, generatedAt, trending, decision } = demoResult;
  const chosen = researchFor(decision.chosenTicker);

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            SP
          </span>
          <div>
            <h1>Stock Picker</h1>
            <p className="sub">
              CrewAI multi-agent result &middot; sector <strong>{sector}</strong>
            </p>
          </div>
        </div>
        <span className="demo-badge" title="This is sample data, not a live run">
          DEMO DATA
        </span>
      </header>

      <p className="disclaimer">
        This page is a small React + TypeScript <strong>demo UI</strong>. CrewAI is
        Python-only, so this is <em>not</em> a CrewAI port — it simply visualizes the
        shape of one representative <code>stock_picker</code> result. Not investment advice.
      </p>

      {/* The 1-sentence rationale the crew "pushes" to the user via PushNotificationTool */}
      <section className="pick-card">
        <div className="pick-head">
          <span className="pill">PICK</span>
          <span className="ticker">{decision.chosenTicker}</span>
          {chosen && <span className="company">{chosen.name}</span>}
        </div>
        <p className="rationale">{decision.rationale}</p>
        <p className="push-note">
          <span className="push-icon" aria-hidden="true">
            &#9993;
          </span>
          Sent as a push notification (logged to console in the local build)
        </p>
      </section>

      <section>
        <h2 className="section-title">Trending companies considered</h2>
        <div className="grid">
          {trending.map((c) => {
            const r = researchFor(c.ticker);
            const isChosen = c.ticker === decision.chosenTicker;
            return (
              <article
                key={c.ticker}
                className={isChosen ? "card card-chosen" : "card"}
              >
                <div className="card-top">
                  <div>
                    <h3>{c.name}</h3>
                    <span className="mono">{c.ticker}</span>
                  </div>
                  {isChosen && <span className="chosen-tag">Chosen</span>}
                </div>
                <p className="reason">{c.reason}</p>
                {r && (
                  <dl className="research">
                    <div>
                      <dt>Market position</dt>
                      <dd>{r.marketPosition}</dd>
                    </div>
                    <div>
                      <dt>Future outlook</dt>
                      <dd>{r.futureOutlook}</dd>
                    </div>
                    <div>
                      <dt>Investment potential</dt>
                      <dd>{r.investmentPotential}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="report">
        <h2 className="section-title">Decision report</h2>
        <p>{decision.report}</p>
        <h3 className="mini-title">Not selected</h3>
        <ul className="not-selected">
          {decision.notSelected.map((n) => (
            <li key={n.ticker}>
              <span className="mono">{n.ticker}</span> — {n.why}
            </li>
          ))}
        </ul>
      </section>

      <footer className="foot">
        Generated {generatedAt} &middot; data is illustrative &middot; week3-ts demo
      </footer>
    </div>
  );
}
