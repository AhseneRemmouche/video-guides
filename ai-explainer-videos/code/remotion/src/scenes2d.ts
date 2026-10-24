// The 2D explainer drawing, as one pure function of time.
// buildStage(t) returns the full SVG markup for second t. The browser demo
// (web2d/explainer.html) and the Remotion composition both call this exact
// logic, so what you preview is what renders to MP4.

export const TIMELINE = {
  fps: 30,
  durationSec: 37.295,
  lines: [
    { i: 0, start: 0.0, end: 5.664 },
    { i: 1, start: 5.664, end: 10.842 },
    { i: 2, start: 10.842, end: 14.696 },
    { i: 3, start: 14.696, end: 17.03 },
    { i: 4, start: 17.03, end: 22.174 },
    { i: 5, start: 22.174, end: 26.443 },
    { i: 6, start: 26.443, end: 30.412 },
    { i: 7, start: 30.412, end: 34.691 },
    { i: 8, start: 34.691, end: 37.295 },
  ],
};

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const ease = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p));

const sp = (t: number, i: number) => {
  const l = TIMELINE.lines[i];
  return clamp((t - l.start) / (l.end - l.start), 0, 1);
};
const sceneOpacity = (t: number, i: number) => {
  const l = TIMELINE.lines[i];
  const d = l.end - l.start;
  const fin = clamp((t - l.start) / Math.min(0.5, d / 3), 0, 1);
  const fout = clamp((l.end - t) / Math.min(0.5, d / 3), 0, 1);
  return t >= l.start - 0.01 && t <= l.end + 0.01 ? Math.min(fin, fout) : 0;
};

function plane(cx: number, cy: number, s: number) {
  return `<g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="0" cy="0" rx="120" ry="30" fill="#e5e7eb"/>
    <polygon points="20,-8 95,-70 60,-6" fill="#93c5fd"/>
    <polygon points="20,8 95,70 60,6" fill="#60a5fa"/>
    <polygon points="-95,-6 -120,-48 -80,-6" fill="#93c5fd"/>
    <circle cx="70" cy="-2" r="7" fill="#1d4ed8"/><circle cx="90" cy="-1" r="6" fill="#1d4ed8"/>
  </g>`;
}

export function buildStage(t: number): string {
  t = clamp(t, 0, TIMELINE.durationSec);
  const op = (i: number) => sceneOpacity(t, i).toFixed(3);
  let p: number;

  // Scene 0
  p = sp(t, 0);
  const s0 = `<g opacity="${op(0)}">
    <g transform="translate(${-40 * p} 0)" fill="#fff" opacity="0.95">
      <ellipse cx="300" cy="500" rx="150" ry="55"/><ellipse cx="900" cy="560" rx="190" ry="65"/><ellipse cx="640" cy="620" rx="220" ry="70"/>
    </g>${plane(lerp(120, 1160, ease(p)), lerp(250, 210, p), 1.0)}</g>`;

  // Scene 1 - elephants
  p = sp(t, 1);
  const n = Math.floor(ease(p) * 10 + 0.001);
  let eh = "";
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / 5), col = k % 5;
    eh += `<g transform="translate(${500 + col * 60} ${520 - row * 44})"><ellipse rx="26" ry="18" fill="#9ca3af"/><circle cx="-22" cy="2" r="10" fill="#9ca3af"/></g>`;
  }
  const s1 = `<g opacity="${op(1)}"><text x="640" y="90" text-anchor="middle" font-size="44" font-weight="800" fill="#1b2a4a">So heavy!</text>
    <rect x="610" y="560" width="60" height="90" fill="#6b7280"/><rect x="470" y="545" width="340" height="24" rx="12" fill="#374151"/>${eh}</g>`;

  // Scene 2
  const s2 = `<g opacity="${op(2)}"><text x="640" y="330" text-anchor="middle" font-size="150" font-weight="900" fill="#1b2a4a" opacity="0.9">?</text>
    <text x="640" y="470" text-anchor="middle" font-size="40" font-weight="700" fill="#1b2a4a">How does it stay up?</text></g>`;

  // Scene 3
  const s3 = `<g opacity="${op(3)}"><text x="640" y="110" text-anchor="middle" font-size="46" font-weight="800" fill="#1b2a4a">The wings</text>
    <ellipse cx="640" cy="420" rx="360" ry="70" fill="#2b3a67"/><ellipse cx="640" cy="405" rx="360" ry="60" fill="#3f5591"/></g>`;

  // Scene 4 - runway
  p = sp(t, 4);
  const px = lerp(-150, 900, ease(p));
  let marks = "";
  for (let k = 0; k < 12; k++) { const mx = ((k * 140) - ((px * 0.6) % 140) + 1400) % 1400 - 60; marks += `<rect x="${mx}" y="652" width="70" height="10" fill="#f9fafb"/>`; }
  const s4 = `<g opacity="${op(4)}"><rect x="0" y="600" width="1280" height="120" fill="#4b5563"/>${marks}${plane(px, 520, 0.9)}</g>`;

  // Scene 5 - airfoil
  p = sp(t, 5);
  const adv = ease(p);
  const s5 = `<g opacity="${op(5)}"><text x="640" y="90" text-anchor="middle" font-size="40" font-weight="800" fill="#1b2a4a">Air moves faster on top</text>
    <path d="M 360 430 C 560 360, 820 360, 960 420 C 820 450, 560 455, 360 430 Z" fill="#334155"/>
    <path d="M 300 405 C 520 330, 820 330, ${lerp(300, 1000, adv)} 388" stroke="#ef4444" stroke-width="5" fill="none"/>
    <path d="M 300 455 C 520 470, 820 470, ${lerp(300, 820, adv * 0.72)} 452" stroke="#2563eb" stroke-width="5" fill="none"/></g>`;

  // Scene 6 - lift
  p = sp(t, 6);
  const la = lerp(0, 90, ease(p));
  const arrows = [520, 640, 760].map((x) => `<line x1="${x}" y1="560" x2="${x}" y2="${560 - la}" stroke="#16a34a" stroke-width="10"/><polygon points="${x - 10},${560 - la} ${x + 10},${560 - la} ${x},${560 - la - 20}" fill="#16a34a"/>`).join("");
  const s6 = `<g opacity="${op(6)}">${plane(640, lerp(470, 300, ease(p)), 1.1)}${arrows}<text x="640" y="660" text-anchor="middle" font-size="40" font-weight="800" fill="#16a34a">LIFT</text></g>`;

  // Scene 7 - thrust + lift
  p = sp(t, 7);
  const g = ease(Math.min(1, p * 1.4));
  const s7 = `<g opacity="${op(7)}">${plane(640, 400, 1.15)}
    <line x1="${520 - 120 * g}" y1="400" x2="520" y2="400" stroke="#f97316" stroke-width="10"/><polygon points="520,390 520,410 545,400" fill="#f97316"/>
    <line x1="640" y1="360" x2="640" y2="${360 - 120 * g}" stroke="#16a34a" stroke-width="10"/><polygon points="630,${360 - 120 * g} 650,${360 - 120 * g} 640,${340 - 120 * g}" fill="#16a34a"/>
    <text x="300" y="640" text-anchor="middle" font-size="34" font-weight="800" fill="#f97316">THRUST</text>
    <text x="980" y="200" text-anchor="middle" font-size="34" font-weight="800" fill="#16a34a">LIFT</text></g>`;

  // Scene 8 - finale
  p = sp(t, 8);
  const s8 = `<g opacity="${op(8)}">${plane(lerp(500, 820, ease(p)), lerp(430, 360, p), 1.25)}
    <text x="640" y="140" text-anchor="middle" font-size="52" font-weight="900" fill="#1b2a4a">That's how planes fly!</text></g>`;

  return `<svg viewBox="0 0 1280 720" width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ff"/><stop offset="1" stop-color="#e8f4ff"/></linearGradient>
      <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffe27a"/></radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#sky)"/><circle cx="1120" cy="130" r="70" fill="url(#sun)"/>
    ${s0}${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}
  </svg>`;
}
