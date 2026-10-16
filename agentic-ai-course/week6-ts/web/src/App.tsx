// The trading-floor dashboard — port of app.py's create_ui(): one column per trader, side by side.
import { useEffect, useState } from "react";
import { TraderView, type TraderInfo } from "./TraderView";

export function App() {
  const [traders, setTraders] = useState<TraderInfo[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/traders").then((r) => r.json()).then(setTraders).catch(() => setError("Cannot reach the API: is pnpm api running?"));
  }, []);

  return (
    <main className="floor">
      {error && <p className="error">{error}</p>}
      {traders.map((t) => <TraderView key={t.name} trader={t} />)}
    </main>
  );
}
