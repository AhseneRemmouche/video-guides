// One trader's column — port of app.py's Trader + TraderView classes: title, portfolio value (green when up, red when
// down), value chart, log panel, holdings and recent transactions. Like Gradio's timers, the account data refreshes
// every 120 seconds and the log panel every 0.5 seconds.
import { useEffect, useState } from "react";
import { Chart } from "./Chart";
import { mapper, money, Color } from "./util";

export type TraderInfo = { name: string; lastname: string; modelName: string };
type Transaction = { timestamp: string; symbol: string; quantity: number; price: number; rationale: string };
type AccountView = {
  portfolioValue: number;
  pnl: number;
  timeSeries: { datetime: string; value: number }[];
  holdings: { symbol: string; quantity: number }[];
  transactions: Transaction[];
};
type LogRow = { datetime: string; type: string; message: string };

/** Call load() now and then every `seconds` (gr.Timer(value=seconds).tick(...)). */
function usePolling<T>(url: string, seconds: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(url).then((r) => r.json()).then((d) => alive && setData(d)).catch(() => {});
    load();
    const id = setInterval(load, seconds * 1000);
    return () => { alive = false; clearInterval(id); };
  }, [url, seconds]);
  return data;
}

export function TraderView({ trader }: { trader: TraderInfo }) {
  const account = usePolling<AccountView>(`/api/traders/${trader.name}`, 120);
  const logs = usePolling<LogRow[]>(`/api/traders/${trader.name}/logs`, 0.5);
  const up = (account?.pnl ?? 0) >= 0;

  return (
    <section className="trader">
      <div className="title">
        {trader.name}<span> ({trader.modelName}) - {trader.lastname}</span>
      </div>
      <div className={`value ${up ? "up" : "down"}`}>
        <span className="big">${money(account?.portfolioValue ?? 0)}</span>
        <span className="pnl">&nbsp;&nbsp;&nbsp;{up ? "⬆" : "⬇"}&nbsp;${money(account?.pnl ?? 0)}</span>
      </div>
      <Chart points={account?.timeSeries ?? []} />
      <div className="logs">
        {(logs ?? []).map((log, i) => (
          <div key={i} style={{ color: mapper[log.type] ?? Color.WHITE }}>
            {log.datetime} : [{log.type}] {log.message}
          </div>
        ))}
      </div>
      <h3>Holdings</h3>
      <div className="table small">
        <table>
          <thead><tr><th>Symbol</th><th>Quantity</th></tr></thead>
          <tbody>{(account?.holdings ?? []).map((h) => <tr key={h.symbol}><td>{h.symbol}</td><td>{h.quantity}</td></tr>)}</tbody>
        </table>
      </div>
      <h3>Recent Transactions</h3>
      <div className="table">
        <table>
          <thead><tr><th>Timestamp</th><th>Symbol</th><th>Quantity</th><th>Price</th><th>Rationale</th></tr></thead>
          <tbody>
            {(account?.transactions ?? []).map((t, i) => (
              <tr key={i}><td>{t.timestamp}</td><td>{t.symbol}</td><td>{t.quantity}</td><td>{t.price.toFixed(2)}</td><td>{t.rationale}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
