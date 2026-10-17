import type { AgentRole } from "@/lib/db/schema";

/**
 * The AI office: an illustrated room where each team member sits at a desk with a name tag. Agents that
 * are working get a glowing screen and a pulsing tag. Pure SVG, so it scales and needs no image files.
 */

const DESKS: { role: Exclude<AgentRole, "master">; label: string; emoji: string; x: number; y: number; hair: string; shirt: string }[] = [
  { role: "creator", label: "Creator Agent", emoji: "✍️", x: 300, y: 250, hair: "#5b3a29", shirt: "#ec4899" },
  { role: "scheduler", label: "Scheduler Agent", emoji: "📅", x: 560, y: 300, hair: "#3f2a1d", shirt: "#16a34a" },
  { role: "research", label: "Research Agent", emoji: "🔎", x: 170, y: 380, hair: "#d08a2c", shirt: "#f5f5f4" },
  { role: "analytics", label: "Analytics Agent", emoji: "📊", x: 450, y: 440, hair: "#6b3f2a", shirt: "#f472b6" },
];

function Desk({ x, y, hair, shirt, working }: { x: number; y: number; hair: string; shirt: string; working: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* rug */}
      <ellipse cx="70" cy="62" rx="125" ry="40" fill="#f3d9b9" opacity="0.55" />
      {/* desk top and legs */}
      <polygon points="-40,0 120,-40 170,-15 10,25" fill="#c98b4e" />
      <polygon points="10,25 170,-15 170,-5 10,35" fill="#a8703b" />
      <polygon points="-40,0 10,25 10,35 -40,10" fill="#8f5d30" />
      <rect x="150" y="-8" width="6" height="55" fill="#3f3f46" />
      <rect x="-36" y="8" width="6" height="55" fill="#3f3f46" />
      {/* drawers */}
      <polygon points="115,-10 150,-19 150,38 115,47" fill="#d9a36a" />
      {/* monitors, screens turned toward the chair */}
      <g>
        <polygon points="20,-45 75,-60 75,-20 20,-5" fill="#1f2937" />
        <polygon points="23,-42 72,-56 72,-23 23,-9" fill={working ? "#93c5fd" : "#cbd5e1"} />
        <polygon points="80,-62 130,-75 130,-36 80,-22" fill="#1f2937" />
        <polygon points="83,-59 127,-71 127,-39 83,-26" fill={working ? "#a5b4fc" : "#e2e8f0"} />
        {working && <polygon points="88,-55 120,-63 120,-58 88,-50" fill="#4f6bff" opacity="0.7" />}
        {working && <polygon points="28,-36 64,-46 64,-41 28,-31" fill="#4f6bff" opacity="0.5" />}
      </g>
      {/* plant */}
      <rect x="140" y="-40" width="14" height="14" rx="3" fill="#f5f5f4" />
      <circle cx="141" cy="-48" r="9" fill="#4ade80" />
      <circle cx="152" cy="-50" r="8" fill="#22c55e" />
      {/* mug and keyboard */}
      <rect x="5" y="2" width="9" height="10" rx="2" fill="#374151" />
      <polygon points="45,4 100,-10 106,-6 51,8" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
      {/* the agent, in front of the desk and seen from behind, facing the screens */}
      <ellipse cx="78" cy="92" rx="28" ry="8" fill="#27272a" opacity="0.25" />
      <rect x="74" y="74" width="8" height="14" fill="#3f3f46" />
      <rect x="58" y="84" width="40" height="6" rx="3" fill="#3f3f46" />
      {/* arms reaching for the keyboard */}
      <rect x="58" y="14" width="10" height="24" rx="5" fill={shirt} transform="rotate(28 63 34)" />
      <rect x="88" y="14" width="10" height="24" rx="5" fill={shirt} transform="rotate(-28 93 34)" />
      {/* body and head */}
      <circle cx="78" cy="34" r="19" fill={shirt} />
      <rect x="59" y="34" width="38" height="28" rx="10" fill={shirt} />
      <circle cx="78" cy="12" r="14" fill={hair} />
      {/* chair back, in front of the agent's lower back */}
      <rect x="57" y="48" width="42" height="30" rx="10" fill="#27272a" />
    </g>
  );
}

export function Office({ working = [], className = "" }: { working?: AgentRole[]; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 to-amber-50 shadow-inner ${className}`}>
      <svg viewBox="0 0 800 560" className="h-full w-full" role="img" aria-label="The AI office: the Research, Creator, Scheduler and Analytics agents at their desks">
        {/* back wall with windows and a city skyline */}
        <rect width="800" height="230" fill="#fdf6ec" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(${240 + i * 135} 30)`}>
            <rect width="120" height="150" rx="6" fill="#bae6fd" stroke="#e7d3b5" strokeWidth="6" />
            <rect x="10" y="70" width="18" height="80" fill="#93c5fd" />
            <rect x="34" y="45" width="22" height="105" fill="#7dd3fc" />
            <rect x="62" y="85" width="16" height="65" fill="#a5d8ff" />
            <rect x="84" y="55" width="26" height="95" fill="#93c5fd" />
          </g>
        ))}
        {/* shelf and sofa on the left */}
        <rect x="20" y="40" width="160" height="10" fill="#c98b4e" />
        <rect x="35" y="18" width="18" height="22" fill="#f472b6" />
        <rect x="60" y="22" width="14" height="18" fill="#60a5fa" />
        <circle cx="120" cy="28" r="12" fill="#4ade80" />
        <rect x="20" y="150" width="190" height="55" rx="18" fill="#e9d5ff" />
        <rect x="30" y="130" width="60" height="40" rx="10" fill="#fcd34d" />
        <rect x="120" y="130" width="60" height="40" rx="10" fill="#93c5fd" />
        {/* floor */}
        <polygon points="0,230 800,230 800,560 0,560" fill="#f5deb3" />
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={i * 70 - 200} y1="560" x2={i * 70 + 60} y2="230" stroke="#e8c999" strokeWidth="2" />
        ))}
        {/* tall plants */}
        <g transform="translate(740 210)">
          <rect x="-14" y="40" width="28" height="30" rx="4" fill="#f5f5f4" />
          <circle cx="-8" cy="20" r="22" fill="#22c55e" />
          <circle cx="12" cy="10" r="20" fill="#16a34a" />
        </g>
        {DESKS.map((d) => (
          <Desk key={d.role} x={d.x} y={d.y} hair={d.hair} shirt={d.shirt} working={working.includes(d.role)} />
        ))}
      </svg>
      {/* name tags as HTML so they stay sharp and readable at any size */}
      {DESKS.map((d) => {
        const on = working.includes(d.role);
        return (
          <span
            key={d.role}
            className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-md md:text-xs ${on ? "working ring-2 ring-brand-500" : ""}`}
            style={{ left: `${(d.x / 800) * 100}%`, top: `${((d.y - 105) / 560) * 100}%` }}
          >
            {d.emoji} {d.label}
            {on && <span className="ml-1 text-brand-600">· working</span>}
          </span>
        );
      })}
    </div>
  );
}
