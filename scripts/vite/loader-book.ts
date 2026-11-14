import { LOADER } from "../../src/content/loader";

/**
 * The drawings in Dad's notebook on the loading page, made at build time as
 * plain SVG strings so they paint before any script runs. Everything is in
 * Dad's navy ink, the same as the notebook inside the game.
 */

const INK = "#233F73";

export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Nudges every coordinate a little, the way a hand never draws the same line twice. */
export function wobble(path: string, random: () => number, amount: number): string {
  return path.replace(/-?\d+(\.\d+)?/g, (n) => (Number(n) + (random() - 0.5) * 2 * amount).toFixed(1));
}

export function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------- Dad's lamp

/** A coiled spring between two points, as a tight wave of curves. */
function coil(ax: number, ay: number, bx: number, by: number, turns: number, amp: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  const at = (t: number, side: number): string => `${(ax + dx * t + nx * amp * side).toFixed(1)} ${(ay + dy * t + ny * amp * side).toFixed(1)}`;
  const steps = turns * 2;
  let d = `M${at(0, 0)}`;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const side = i % 2 === 0 ? 1.35 : -1.35;
    d += ` C ${at(t0 - 0.02, side)}, ${at(t1 + 0.02, side)}, ${at(t1, 0)}`;
  }
  return d;
}

function circle(cx: number, cy: number, r: number): string {
  const k = r * 0.5523;
  return `M${cx + r} ${cy} C ${cx + r} ${cy + k}, ${cx + k} ${cy + r}, ${cx} ${cy + r} C ${cx - k} ${cy + r}, ${cx - r} ${cy + k}, ${cx - r} ${cy} C ${cx - r} ${cy - k}, ${cx - k} ${cy - r}, ${cx} ${cy - r} C ${cx + k} ${cy - r}, ${cx + r} ${cy - k}, ${cx + r} ${cy} Z`;
}

/** The lamp in five strokes, in drawing order: base, arm, pivots, shade, bulb. Absolute commands only, so every number can wobble. */
const STROKES: string[][] = [
  ["M92 338 C 96 312, 204 312, 208 338", "M84 340 L 216 340 C 220 348, 214 352, 206 352 L 94 352 C 86 352, 80 348, 84 340 Z"],
  ["M144 322 L 106 202 L 206 120", "M158 320 L 120 206 L 216 130", coil(162, 300, 140, 232, 7, 6), "M162 300 L 152 316 M140 232 L 126 214"],
  [circle(151, 322, 10), circle(113, 203, 11), circle(211, 124, 9)],
  ["M214 104 C 226 92, 246 92, 258 102 L 316 166 C 304 190, 262 206, 236 198 L 210 126 C 206 116, 208 108, 214 104 Z", "M236 198 C 262 188, 300 176, 316 166"],
  ["M246 196 C 244 226, 300 226, 306 180", "M262 204 C 266 196, 270 212, 274 202 C 278 194, 282 210, 286 198"],
];

/** Where each of Dad's notes sits: a leader line from the part out to the words. */
const NOTES: { from: [number, number]; lead: string; x: number; y: number; anchor: "start" | "end" }[] = [
  { from: [210, 348], lead: "M210 348 C 240 360, 270 370, 296 374", x: 304, y: 379, anchor: "start" },
  { from: [150, 268], lead: "M150 268 C 110 262, 70 256, 32 252", x: 24, y: 257, anchor: "end" },
  { from: [106, 196], lead: "M106 196 C 86 180, 66 166, 44 156", x: 36, y: 160, anchor: "end" },
  { from: [246, 96], lead: "M246 96 C 262 76, 280 64, 304 58", x: 312, y: 62, anchor: "start" },
  { from: [304, 212], lead: "M304 212 C 314 232, 322 248, 328 262", x: 334, y: 274, anchor: "start" },
];

/**
 * Dad's drawing of his lamp. Each stroke draws itself in as its share of the
 * game loads, then holds still: no boiling line here, because three copies
 * swapping ten times a second read as a flicker on the page. His notes appear
 * beside each part once it is drawn, and a warm glow sits behind the bulb for
 * when the light comes on.
 */
export function lampSketch(): string {
  const groups = STROKES.map((paths, i) => `<g class="s s${i}">${paths.map((p) => `<path pathLength="1" d="${p}"/>`).join("")}</g>`).join("");
  const notes = NOTES.map((n, i) => {
    const lines = LOADER.parts[i] ?? [];
    const text = lines.map((line, k) => `<tspan x="${n.x}" dy="${k === 0 ? 0 : 22}">${escape(line)}</tspan>`).join("");
    return `<g class="a a${i}"><path class="lead" pathLength="1" d="${n.lead}"/><circle class="dot" r="3" cx="${n.from[0]}" cy="${n.from[1]}"/><text x="${n.x}" y="${n.y}" text-anchor="${n.anchor}">${text}</text></g>`;
  }).join("");
  // Construction lines come first, the way a drawing starts: a compass circle, center marks, a ground line.
  const guides = `<g class="guides"><circle cx="200" cy="222" r="176"/><path d="M200 30 L 200 66 M200 378 L 200 414 M6 222 L 42 222 M358 222 L 394 222"/><path d="M-70 353 L 470 353"/></g>`;
  const halo = `<defs><radialGradient id="ld-bulb"><stop offset="0" stop-color="#fff0c8"/><stop offset="0.3" stop-color="#ffc66e" stop-opacity="0.55"/><stop offset="1" stop-color="#ffae48" stop-opacity="0"/></radialGradient></defs><circle class="halo" cx="278" cy="204" r="130" fill="url(#ld-bulb)"/>`;
  return `<svg class="sketch" viewBox="-84 30 594 380" aria-hidden="true" focusable="false">${halo}${guides}${groups}${notes}</svg>`;
}

// ---------------------------------------------------------------- the trip doodle

/**
 * Home, the Moon and Mars on a dotted route along the foot of the page, with
 * one of Dad's letters flying it, out to the Moon, on to Mars and home again.
 */
export function travelDoodle(): string {
  const random = seeded(23);
  const j = (d: string, a = 0.8): string => wobble(d, random, a);
  const route = "M82 86 C 116 34, 168 22, 206 40 C 230 52, 236 62, 246 70 C 278 112, 318 124, 346 108";
  const back = "M346 108 C 300 150, 170 150, 82 86";
  const [home, moon, mars] = LOADER.travel;
  return `<svg class="travel" viewBox="0 0 430 170" aria-hidden="true" focusable="false">
    <g class="ink">
      <path class="dash" d="${j(route)}"/>
      <path class="dash faint" d="${j(back)}"/>
      <circle cx="52" cy="104" r="30" class="home"/>
      <path d="${j("M24 112 C 40 104, 62 106, 80 98")}"/>
      <path d="${j("M44 92 L 44 80 L 52 72 L 60 80 L 60 92 Z")}" class="fill"/>
      <rect x="49" y="83" width="6" height="9" class="glow"/>
      <circle cx="226" cy="44" r="17" class="moon"/>
      <path d="${j("M219 33 C 230 38, 230 52, 219 56", 0.5)}"/>
      <circle cx="230" cy="40" r="2.2"/><circle cx="222" cy="50" r="1.6"/>
      <circle cx="372" cy="104" r="22" class="mars"/>
      <path d="${j("M356 98 C 366 94, 378 102, 388 96 M358 112 C 368 108, 380 116, 390 110", 0.5)}"/>
      <path d="M150 150 l 0 -9 M145.5 145.5 l 9 0 M410 30 l 0 -10 M405 25 l 10 0 M30 26 l 0 -8 M26 22 l 8 0"/>
      <g class="letter"><g transform="rotate(-8)"><rect x="-12" y="-8" width="24" height="16" rx="1.5" class="ld-paper"/><path d="M-12 -8 L 0 1.5 L 12 -8"/><circle cx="0" cy="1.5" r="2.6" class="seal"/></g>
        <animateMotion dur="8s" repeatCount="indefinite" path="${route} ${back.replace("M346 108", "")}"/>
      </g>
    </g>
    <g class="labels"><text x="52" y="160" text-anchor="middle">${escape(home ?? "")}</text><text x="226" y="86" text-anchor="middle">${escape(moon ?? "")}</text><text x="372" y="150" text-anchor="middle">${escape(mars ?? "")}</text></g>
  </svg>`;
}

// ---------------------------------------------------------------- small pieces

/** A hand-drawn checkbox with a red pencil tick that draws itself in. */
export function checkbox(seed: number): string {
  const random = seeded(seed);
  return `<svg class="box" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="sq" d="${wobble("M4 5 L 19 4 L 20 19 L 5 20 Z", random, 0.9)}"/><path class="tick" pathLength="1" d="${wobble("M6 12 C 8 14, 9 16, 10 18 C 13 12, 17 7, 23 1", random, 0.6)}"/></svg>`;
}

/** The lamp pressed into the leather cover, like the notebook in the game. */
export function coverEmboss(): string {
  return `<svg class="emboss-lamp" viewBox="60 80 280 290" aria-hidden="true" focusable="false">${STROKES.flat()
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;
}

/** A round postal cancellation, in red: the same postmark Dad's letters get in the game. */
export function postmark(): string {
  const words = "HOME POST • BY LAMPLIGHT • ";
  return `<svg class="postmark" viewBox="0 0 220 120" aria-hidden="true" focusable="false">
    <defs><path id="ld-ring" d="M60 60 m -38 0 a 38 38 0 1 1 76 0 a 38 38 0 1 1 -76 0"/></defs>
    <circle cx="60" cy="60" r="50"/><circle cx="60" cy="60" r="28"/>
    <text class="ring"><textPath href="#ld-ring">${words}${words}</textPath></text>
    <text class="mid" x="60" y="57" text-anchor="middle">LEFT ON</text><text class="mid small" x="60" y="71" text-anchor="middle">STILL SHINING</text>
    <path class="waves" d="M112 36 C 128 28, 142 44, 158 36 C 174 28, 188 44, 204 36 M114 52 C 130 44, 144 60, 160 52 C 176 44, 190 60, 206 52 M114 68 C 130 60, 144 76, 160 68 C 176 60, 190 76, 206 68 M112 84 C 128 76, 142 92, 158 84 C 174 76, 188 92, 204 84"/>
  </svg>`;
}

/** A wall light switch: a cream plate with two screws and a lever that flips up when pressed. */
export const lightSwitch = `<svg class="ld-switch" viewBox="0 0 64 96" aria-hidden="true" focusable="false">
  <rect class="plate" x="4" y="4" width="56" height="88" rx="10"/>
  <rect class="plate-hi" x="9" y="9" width="46" height="78" rx="7"/>
  <circle class="screw" cx="32" cy="16" r="3.6"/><path class="slot" d="M29.6 16 L 34.4 16"/>
  <circle class="screw" cx="32" cy="80" r="3.6"/><path class="slot" d="M30.4 78.4 L 33.6 81.6"/>
  <rect class="well" x="22" y="30" width="20" height="36" rx="4"/>
  <g class="lever"><rect x="24.5" y="48" width="15" height="17" rx="4"/><rect class="lever-hi" x="27" y="50" width="10" height="3.5" rx="1.75"/></g>
</svg>`;

/** A pencil, lying across the page, that moves to each tick as it is made. */
export const pencil = `<svg class="pencil" viewBox="0 0 180 24" aria-hidden="true" focusable="false">
  <path d="M2 12 L 22 5 L 22 19 Z" fill="#E7C9A0" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M2 12 L 9 9.6 L 9 14.4 Z" fill="#3B3330"/>
  <rect x="22" y="5" width="128" height="14" fill="#F2B544" stroke="${INK}" stroke-width="1.6"/>
  <path d="M22 9.6 L 150 9.6 M22 14.4 L 150 14.4" stroke="#D3922A" stroke-width="1.2"/>
  <rect x="150" y="5" width="12" height="14" fill="#C8C2B6" stroke="${INK}" stroke-width="1.6"/>
  <rect x="162" y="5" width="14" height="14" rx="3" fill="#E6928A" stroke="${INK}" stroke-width="1.6"/>
</svg>`;
