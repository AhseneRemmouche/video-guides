// The portfolio value line chart (app.py draws it with Plotly Express: px.line(df, x="datetime", y="value")).
// Plain SVG here, so there is no chart library to learn: scale each point into a 400x300 box and join them with a line.
import { money } from "./util";

type Point = { datetime: string; value: number };
const W = 400, H = 300, M = { l: 48, r: 16, t: 16, b: 40 }; // size and margins, like fig.update_layout(height=300, margin=...)

export function Chart({ points }: { points: Point[] }) {
  if (points.length === 0) return <div className="chart empty">No portfolio values yet</div>;
  const times = points.map((p) => new Date(p.datetime.replace(" ", "T")).getTime());
  const values = points.map((p) => p.value);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  let [v0, v1] = [Math.min(...values), Math.max(...values)];
  if (v1 - v0 < 1) [v0, v1] = [v0 - 50, v1 + 50]; // a flat line still gets a sensible y axis

  const x = (t: number) => M.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - v0) / (v1 - v0)) * (H - M.t - M.b);
  const line = points.map((_, i) => `${x(times[i]).toFixed(1)},${y(values[i]).toFixed(1)}`).join(" ");
  const yTicks = [0, 1, 2, 3].map((i) => v0 + ((v1 - v0) * i) / 3);
  const xTicks = t1 === t0 ? [t0] : [0, 1, 2, 3, 4].map((i) => t0 + ((t1 - t0) * i) / 4);
  const mmdd = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }); // tickformat="%m/%d"

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Portfolio value over time">
      <rect width={W} height={H} fill="#bbb" />
      <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="#dde" />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#fff" />
          <text x={M.l - 4} y={y(v) + 3} textAnchor="end" fontSize="8">{money(v)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(t)} y={H - M.b + 14} fontSize="8" textAnchor="end" transform={`rotate(-45 ${x(t)} ${H - M.b + 14})`}>{mmdd(t)}</text>
      ))}
      <polyline points={line} fill="none" stroke="#636efa" strokeWidth="2" />
      {points.length === 1 && <circle cx={x(times[0])} cy={y(values[0])} r="3" fill="#636efa" />}
    </svg>
  );
}
