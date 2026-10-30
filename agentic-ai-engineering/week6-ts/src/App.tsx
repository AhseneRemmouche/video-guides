import { cash, holdings, recentTrades, trader } from "./data";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function App() {
  const holdingsValue = holdings.reduce((sum, h) => sum + h.shares * h.price, 0);
  const totalValue = cash + holdingsValue;
  const costBasis = holdings.reduce((sum, h) => sum + h.shares * h.avgCost, 0);
  const totalPnl = holdingsValue - costBasis;
  const pnlPct = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;

  return (
    <div className="wrap">
      <header>
        <p className="demo-badge">Demo UI — representative data, not live market data</p>
        <h1>Trading Portfolio</h1>
        <p className="tagline">
          A small React + TypeScript demo for Week 6 (MCP). It shows the shape of a
          trading-floor account — cash, holdings and recent trades — using static sample
          content. It is <strong>not</strong> connected to the Python accounts MCP server.
        </p>
      </header>

      <section className="cards" aria-label="Portfolio summary">
        <div className="card">
          <span className="card-label">Total value</span>
          <span className="card-value">{usd(totalValue)}</span>
        </div>
        <div className="card">
          <span className="card-label">Cash</span>
          <span className="card-value">{usd(cash)}</span>
        </div>
        <div className="card">
          <span className="card-label">Holdings value</span>
          <span className="card-value">{usd(holdingsValue)}</span>
        </div>
        <div className="card">
          <span className="card-label">Unrealised P/L</span>
          <span className={`card-value ${totalPnl >= 0 ? "pos" : "neg"}`}>
            {totalPnl >= 0 ? "+" : ""}
            {usd(totalPnl)} ({pnlPct >= 0 ? "+" : ""}
            {pnlPct.toFixed(1)}%)
          </span>
        </div>
      </section>

      <section aria-label="Holdings">
        <h2>
          Holdings <span className="muted">· {trader.name}</span>
        </h2>
        <p className="strategy">{trader.strategy}</p>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th className="num">Shares</th>
              <th className="num">Avg cost</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th className="num">P/L</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const value = h.shares * h.price;
              const pnl = h.shares * (h.price - h.avgCost);
              return (
                <tr key={h.symbol}>
                  <td className="sym">{h.symbol}</td>
                  <td>{h.name}</td>
                  <td className="num">{h.shares}</td>
                  <td className="num">{usd(h.avgCost)}</td>
                  <td className="num">{usd(h.price)}</td>
                  <td className="num">{usd(value)}</td>
                  <td className={`num ${pnl >= 0 ? "pos" : "neg"}`}>
                    {pnl >= 0 ? "+" : ""}
                    {usd(pnl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section aria-label="Recent trades">
        <h2>Recent trades</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Side</th>
              <th>Symbol</th>
              <th className="num">Shares</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {recentTrades.map((t, i) => (
              <tr key={i}>
                <td className="mono">{t.time}</td>
                <td>
                  <span className={`pill ${t.side === "BUY" ? "buy" : "sell"}`}>{t.side}</span>
                </td>
                <td className="sym">{t.symbol}</td>
                <td className="num">{t.shares}</td>
                <td className="num">{usd(t.price)}</td>
                <td className="num">{usd(t.shares * t.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer>
        Week 6 of the Agentic AI guide · MCP demo UI · sample data only
      </footer>
    </div>
  );
}
