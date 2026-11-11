import { GLYPHS, GLYPH_ROWS, signedArea, traceGlyph } from "../../src/game/title/letters";

/**
 * Drawings for the loading page, made at build time as plain SVG strings so
 * they paint before any script runs.
 *
 * The page is Dad's notebook lying open on his workbench at night: his pen
 * drawing of the game's title in the same chunky block letters the 3D title
 * is built from, and the things around the book (a mug, letters tied with
 * twine, a pencil, a ruler, a few of Milo's spare parts).
 */

const INK = "#2b2622";

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Nudges every number in a path a little, the way a hand never draws the same line twice. */
function jitter(path: string, random: () => number, amount: number): string {
  return path.replace(/-?\d+(\.\d+)?/g, (n) => (Number(n) + (random() - 0.5) * 2 * amount).toFixed(1));
}

type Point = [number, number];

/** A loop of grid points as an SVG path with rounded corners. Grid y runs up; SVG y runs down. */
function roundedLoop(loop: Point[], hole: boolean, ox: number, cell: number): string {
  const n = loop.length;
  const P = (x: number, y: number): string => `${((ox + x) * cell).toFixed(1)} ${((GLYPH_ROWS - y) * cell).toFixed(1)}`;
  const corner = (i: number): { b: Point; pin: Point; pout: Point } => {
    const a = loop[(i - 1 + n) % n]!;
    const b = loop[i]!;
    const c = loop[(i + 1) % n]!;
    const din: Point = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    const dout: Point = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])];
    const convex = din[0] * dout[1] - din[1] * dout[0] > 0;
    const r = hole ? 0.16 : convex ? 0.42 : 0.12;
    return { b, pin: [b[0] - din[0] * r, b[1] - din[1] * r], pout: [b[0] + dout[0] * r, b[1] + dout[1] * r] };
  };
  const first = corner(0);
  let d = `M${P(first.pout[0], first.pout[1])}`;
  for (let i = 1; i <= n; i += 1) {
    const k = i === n ? first : corner(i);
    d += ` L${P(k.pin[0], k.pin[1])} Q${P(k.b[0], k.b[1])} ${P(k.pout[0], k.pout[1])}`;
  }
  return `${d} Z`;
}

function simplify(loop: Point[]): Point[] {
  return loop.filter((b, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length]!;
    const c = loop[(i + 1) % loop.length]!;
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0;
  });
}

/** One block letter's outline (with its holes) as a single path, placed `ox` cells from the left. */
function letterPath(letter: string, ox: number, cell: number): string {
  const loops = traceGlyph(GLYPHS[letter]!).map(simplify);
  return loops.map((loop) => roundedLoop(loop, signedArea(loop) < 0, ox, cell)).join(" ");
}

const width = (letter: string): number => GLYPHS[letter]![0]!.length;

/**
 * Dad's pen drawing of the title: block letters with a hatched shadow, the
 * outline gone over twice the way a pen sketch is, and the O of HOME drawn
 * as a light bulb that lights when the lamp comes on. "of" is in his hand.
 */
export function titleArt(): string {
  const cell = 10;
  const gap = 0.8;
  const random = seeded(77);
  const lines: { word: string; x: number; y: number }[] = [
    { word: "PIECES", x: 0, y: 0 },
    { word: "HOME", x: 4.6, y: GLYPH_ROWS + 1.7 },
  ];
  const faces: string[] = [];
  const shadows: string[] = [];
  let bulb = "";
  let maxX = 0;
  for (const line of lines) {
    let x = line.x;
    for (const letter of line.word) {
      if (line.word === "HOME" && letter === "O") {
        // The bulb: a round glass over a screw base, with a coiled filament.
        const cx = (x + 2) * cell;
        const cy = (line.y + 2.05) * cell;
        bulb = `<g class="bulb" transform="translate(0 ${line.y * cell})">
          <circle class="bulb-glow" cx="${cx}" cy="${2.05 * cell}" r="${3.6 * cell}" fill="url(#t-glow)"/>
          <path class="bulb-glass" d="${jitter(`M${cx - 1.15 * cell} ${3.55 * cell} C ${cx - 1.15 * cell} ${3.0 * cell}, ${cx - 2.05 * cell} ${2.55 * cell}, ${cx - 2.05 * cell} ${1.75 * cell} C ${cx - 2.05 * cell} ${0.55 * cell}, ${cx - 1.1 * cell} ${-0.05 * cell}, ${cx} ${-0.05 * cell} C ${cx + 1.1 * cell} ${-0.05 * cell}, ${cx + 2.05 * cell} ${0.55 * cell}, ${cx + 2.05 * cell} ${1.75 * cell} C ${cx + 2.05 * cell} ${2.55 * cell}, ${cx + 1.15 * cell} ${3.0 * cell}, ${cx + 1.15 * cell} ${3.55 * cell} Z`, random, 0.5)}"/>
          <path class="bulb-wire" d="M${cx - 0.55 * cell} ${3.5 * cell} L ${cx - 0.45 * cell} ${2.2 * cell} M${cx + 0.55 * cell} ${3.5 * cell} L ${cx + 0.45 * cell} ${2.2 * cell} M${cx - 0.45 * cell} ${2.2 * cell} C ${cx - 0.3 * cell} ${1.6 * cell}, ${cx - 0.15 * cell} ${2.6 * cell}, ${cx} ${2.0 * cell} C ${cx + 0.15 * cell} ${1.4 * cell}, ${cx + 0.3 * cell} ${2.6 * cell}, ${cx + 0.45 * cell} ${2.2 * cell}"/>
          <path class="bulb-base" d="M${cx - 1.15 * cell} ${3.6 * cell} L ${cx + 1.15 * cell} ${3.6 * cell} L ${cx + 1.05 * cell} ${4.0 * cell} L ${cx - 1.05 * cell} ${4.0 * cell} Z M${cx - 1.05 * cell} ${4.0 * cell} L ${cx + 1.05 * cell} ${4.0 * cell} L ${cx + 0.95 * cell} ${4.4 * cell} L ${cx - 0.95 * cell} ${4.4 * cell} Z M${cx - 0.6 * cell} ${4.4 * cell} C ${cx - 0.5 * cell} ${4.95 * cell}, ${cx + 0.5 * cell} ${4.95 * cell}, ${cx + 0.6 * cell} ${4.4 * cell}"/>
          <path class="bulb-rays" d="M${cx - 2.6 * cell} ${0.2 * cell} l ${-0.6 * cell} ${-0.5 * cell} M${cx + 2.6 * cell} ${0.2 * cell} l ${0.6 * cell} ${-0.5 * cell} M${cx} ${-0.6 * cell} l 0 ${-0.75 * cell} M${cx - 2.9 * cell} ${1.9 * cell} l ${-0.75 * cell} 0 M${cx + 2.9 * cell} ${1.9 * cell} l ${0.75 * cell} 0"/>
        </g>`;
      } else {
        const d = letterPath(letter, x, cell);
        const placed = `<g transform="translate(0 ${line.y * cell})">`;
        shadows.push(`${placed}<path d="${d}" transform="translate(${cell * 0.38} ${cell * 0.42})"/></g>`);
        faces.push(`${placed}<path class="ink1" d="${jitter(d, random, 0.35)}"/><path class="ink2" d="${jitter(d, random, 0.7)}"/></g>`);
      }
      x += width(letter) + gap;
    }
    maxX = Math.max(maxX, x - gap);
  }
  const w = (maxX + 0.6) * cell;
  const h = (GLYPH_ROWS * 2 + 1.7 + 0.6) * cell;
  // "of", in Dad's hand, tucked in front of HOME.
  const of = `<text class="of" x="${0.4 * cell}" y="${(GLYPH_ROWS + 1.7 + 3.9) * cell}" transform="rotate(-8 ${1.8 * cell} ${(GLYPH_ROWS + 4.6) * cell})">of</text>`;
  const swash = `<path class="swash" d="M${0.3 * cell} ${(GLYPH_ROWS + 6.2) * cell} C ${1.5 * cell} ${(GLYPH_ROWS + 6.9) * cell}, ${3.2 * cell} ${(GLYPH_ROWS + 6.5) * cell}, ${4.1 * cell} ${(GLYPH_ROWS + 5.6) * cell}"/>`;
  return `<svg class="title-art" viewBox="${-0.4 * cell} ${-1.4 * cell} ${w + 0.8 * cell} ${h + 1.4 * cell}" role="img" aria-labelledby="boot-title">
    <defs>
      <pattern id="t-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 0 L0 5" stroke="${INK}" stroke-width="1.5"/></pattern>
      <radialGradient id="t-glow"><stop offset="0" stop-color="#fff2c6"/><stop offset="0.35" stop-color="#ffcf74" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="shadow">${shadows.join("")}</g>
    <g class="faces">${faces.join("")}</g>
    ${bulb}${of}${swash}
  </svg>`;
}

/** A postmark: two rings of words round a small lamp, like the ink stamps at the end of each chapter. */
export function postmark(text: string): string {
  const words = `${text} • ${text} • `;
  return `<svg class="postmark" viewBox="0 0 160 160" aria-hidden="true">
    <defs><path id="pm-ring" d="M80 80 m -56 0 a 56 56 0 1 1 112 0 a 56 56 0 1 1 -112 0"/></defs>
    <circle cx="80" cy="80" r="72" fill="none" stroke-width="3.2"/>
    <circle cx="80" cy="80" r="43" fill="none" stroke-width="2"/>
    <text><textPath href="#pm-ring" textLength="350">${words}</textPath></text>
    <path fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M64 98 L96 98 M70 98 C 70 92, 90 92, 90 98 M80 92 L72 72 L88 62 M84 60 L100 66 L96 78 Z"/>
    <path fill="none" stroke-width="2" d="M14 132 C 40 124, 60 140, 86 132 C 112 124, 132 140, 158 132 M10 146 C 36 138, 56 154, 82 146 C 108 138, 128 154, 154 146"/>
  </svg>`;
}

/** A hand-drawn square for a checklist line. */
export function checkbox(seed: number): string {
  const random = seeded(seed);
  return `<svg class="box" viewBox="0 0 24 24" aria-hidden="true"><path class="sq" d="${jitter("M4 5 L 19 4 L 20 19 L 5 20 Z", random, 0.9)}"/><path class="tick" pathLength="1" d="${jitter("M6 12 C 8 14, 9 16, 10 18 C 13 12, 17 7, 23 1", random, 0.6)}"/></svg>`;
}

// ---------------------------------------------------------------- things on the bench

const mug = `<svg class="item mug" viewBox="0 0 220 180" aria-hidden="true">
  <path class="sh" d="M178 74 C 214 70, 220 118, 178 114"/>
  <path d="M176 72 C 210 66, 214 116, 176 112" fill="none" stroke="#e9dfcf" stroke-width="14" stroke-linecap="round"/>
  <path d="M176 72 C 210 66, 214 116, 176 112" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>
  <circle cx="100" cy="92" r="74" fill="#e9dfcf" stroke="${INK}" stroke-width="3"/>
  <circle cx="100" cy="92" r="62" fill="#c9bba4"/>
  <circle cx="100" cy="94" r="57" fill="#3b2518"/>
  <circle cx="100" cy="94" r="44" fill="none" stroke="#5a3a26" stroke-width="5" opacity="0.6"/>
  <ellipse cx="78" cy="72" rx="16" ry="7" fill="#fff6e6" opacity="0.28" transform="rotate(-30 78 72)"/>
  <path d="M54 46 C 70 30, 104 24, 132 36" fill="none" stroke="#fffaf0" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
</svg>`;

/** A letter in its envelope, front up: stamp, postmark and Dad's handwriting. */
function envelope(to: string, stamp: "moon" | "mars", seed: number): string {
  const random = seeded(seed);
  const art =
    stamp === "moon"
      ? `<rect x="240" y="26" width="52" height="64" fill="#2e2a4f"/><circle cx="272" cy="52" r="15" fill="#f4ecdd"/><circle cx="279" cy="47" r="14" fill="#2e2a4f"/><circle cx="252" cy="78" r="1.6" fill="#f4ecdd"/><circle cx="283" cy="80" r="1.2" fill="#f4ecdd"/><circle cx="250" cy="40" r="1.2" fill="#f4ecdd"/>`
      : `<rect x="240" y="26" width="52" height="64" fill="#e3a26a"/><circle cx="266" cy="58" r="17" fill="#b5643a"/><path d="M252 52 C 260 48, 270 56, 280 50 M254 66 C 262 62, 272 70, 282 64" stroke="#8e3f2a" stroke-width="2.4" fill="none"/>`;
  return `<svg class="env-one" viewBox="0 0 320 200" aria-hidden="true">
    <path d="${jitter("M10 12 L 310 8 L 312 190 L 8 192 Z", random, 1.2)}" fill="#efe4cf" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M10 12 L 160 96 L 310 8" fill="none" stroke="${INK}" stroke-width="1.4" opacity="0.25"/>
    <rect x="234" y="20" width="64" height="76" fill="#fffaf0" stroke="#d8ccb4" stroke-width="5" stroke-dasharray="2 3"/>
    ${art}
    <g fill="none" stroke="#2e2a4f" stroke-width="2" opacity="0.55"><circle cx="232" cy="88" r="24"/><path d="M182 78 C 196 72, 206 84, 220 78 M180 92 C 194 86, 204 98, 218 92 M182 106 C 196 100, 206 112, 220 106"/></g>
    <text x="40" y="146" class="addr">${to}</text>
    <path d="M40 160 C 100 154, 170 162, 230 156" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>
  </svg>`;
}

const letters = `<div class="item envelopes" aria-hidden="true">
  ${envelope("To the Moon", "moon", 5)}
  ${envelope("To Mars", "mars", 9)}
</div>`;

const pencilSvg = `<svg viewBox="0 0 400 40" aria-hidden="true">
  <path d="M0 20 L 34 8 L 34 32 Z" fill="#e7c9a0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M0 20 L 11 16 L 11 24 Z" fill="#3a3530"/>
  <rect x="34" y="8" width="290" height="24" fill="#e8b53a" stroke="${INK}" stroke-width="2"/>
  <rect x="34" y="8" width="290" height="7" fill="#f6cf6a"/>
  <rect x="34" y="25" width="290" height="7" fill="#c9952a"/>
  <rect x="324" y="7" width="34" height="26" fill="#bdb6aa" stroke="${INK}" stroke-width="2"/>
  <path d="M334 7 L 334 33 M346 7 L 346 33" stroke="#8a8478" stroke-width="2"/>
  <rect x="358" y="8" width="34" height="24" rx="6" fill="#e58b8b" stroke="${INK}" stroke-width="2"/>
</svg>`;

/** The pencil that ticks the list. It is drawn on the page, not on the bench. */
export const pencil = `<div class="pencil" aria-hidden="true">${pencilSvg}</div>`;

const ruler = `<svg class="item ruler" viewBox="0 0 900 70" aria-hidden="true">
  <rect x="2" y="2" width="896" height="66" rx="4" fill="#d9b884" stroke="${INK}" stroke-width="2.5"/>
  <rect x="2" y="2" width="896" height="10" fill="#e8cb98"/>
  <path d="${Array.from({ length: 89 }, (_, i) => `M${12 + i * 10} 68 L ${12 + i * 10} ${i % 10 === 0 ? 40 : i % 5 === 0 ? 48 : 56}`).join(" ")}" stroke="${INK}" stroke-width="1.6" opacity="0.75"/>
  <circle cx="870" cy="26" r="7" fill="#3b2a20" stroke="${INK}" stroke-width="2"/>
</svg>`;

const parts = `<svg class="item parts" viewBox="0 0 260 200" aria-hidden="true">
  <g transform="translate(60 60)"><path d="${gear(36, 26, 10)}" fill="#c8a14a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle r="10" fill="#3b2a20" stroke="${INK}" stroke-width="2"/></g>
  <g transform="translate(176 52) rotate(18)"><path d="M-22 0 L -11 -19 L 11 -19 L 22 0 L 11 19 L -11 19 Z" fill="#a9a49a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle r="9" fill="#3b2a20"/></g>
  <g transform="translate(130 140)"><circle r="15" fill="#bdb6aa" stroke="${INK}" stroke-width="2.5"/><path d="M-9 -4 L 9 4" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/></g>
  <g transform="translate(212 150)"><circle r="12" fill="#bdb6aa" stroke="${INK}" stroke-width="2.5"/><path d="M-7 5 L 7 -5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
  <g transform="translate(46 158) rotate(-30)"><rect x="-6" y="-26" width="12" height="44" rx="3" fill="#bdb6aa" stroke="${INK}" stroke-width="2"/><path d="M-6 -14 L 6 -10 M-6 -4 L 6 0 M-6 6 L 6 10" stroke="${INK}" stroke-width="1.6"/><circle cy="-30" r="11" fill="#bdb6aa" stroke="${INK}" stroke-width="2.5"/></g>
</svg>`;

function gear(outer: number, inner: number, teeth: number): string {
  let d = "";
  for (let i = 0; i < teeth; i += 1) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / teeth / 2;
    const pts = [
      [inner, a0],
      [outer, a0 + 0.06],
      [outer, a1 - 0.06],
      [inner, a1],
    ] as const;
    for (const [r, a] of pts) d += `${d ? "L" : "M"}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)} `;
  }
  return `${d}Z`;
}

/** Everything on the bench round the book. */
export function deskItems(): string {
  return `${mug}${letters}${ruler}${parts}`;
}

/**
 * Moonlight through the workshop window: four soft panes of cool light lying
 * across the bench, with the window bars as gaps. Drawn in screen percent.
 */
export function moonlight(): string {
  const panes = [
    "-8,-6 22,-14 36,22 2,32",
    "24,-14 54,-22 70,14 38,22",
    "4,36 38,26 54,64 18,76",
    "40,26 72,18 88,56 56,64",
  ];
  return `<svg class="moonlight" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><filter id="moon-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.7"/></filter>
    <linearGradient id="moon-fade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c6ff" stop-opacity="0.5"/><stop offset="1" stop-color="#b9c6ff" stop-opacity="0.12"/></linearGradient></defs>
    <g filter="url(#moon-soft)" fill="url(#moon-fade)">${panes.map((p) => `<polygon points="${p}"/>`).join("")}</g>
  </svg>`;
}

/**
 * Dad's little map in the corner of the sketch page: home, the Moon and Mars,
 * with dotted paths and letters on their way. It is a doodle, not a chart.
 */
export function travelDoodle(): string {
  const random = seeded(23);
  const j = (d: string, a = 0.8): string => jitter(d, random, a);
  const envelope = (x: number, y: number, r: number): string =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-11" y="-7.5" width="22" height="15" rx="1.5" class="fill"/><path d="M-11 -7.5 L 0 1.5 L 11 -7.5"/></g>`;
  return `<svg class="travel" viewBox="0 0 430 170" aria-hidden="true">
    <g class="ink">
      <path class="dash" d="${j("M82 86 C 116 34, 168 22, 206 36")}"/>
      <path d="M196 28 L 208 37 L 194 42"/>
      <path class="dash" d="${j("M240 58 C 278 116, 318 124, 346 108")}"/>
      <path d="M334 104 L 348 107 L 340 119"/>
      ${envelope(136, 40, -18)}${envelope(292, 116, 14)}
      <circle cx="52" cy="104" r="30" class="fill"/>
      <path d="${j("M24 112 C 40 104, 62 106, 80 98")}"/>
      <path d="${j("M44 92 L 44 80 L 52 72 L 60 80 L 60 92 Z")}" class="fill"/>
      <rect x="49" y="83" width="6" height="9" class="glow"/>
      <circle cx="226" cy="44" r="17" class="fill"/>
      <path d="${j("M219 33 C 230 38, 230 52, 219 56", 0.5)}"/>
      <circle cx="230" cy="40" r="2.2"/><circle cx="222" cy="50" r="1.6"/>
      <circle cx="372" cy="104" r="22" class="mars"/>
      <path d="${j("M356 98 C 366 94, 378 102, 388 96 M358 112 C 368 108, 380 116, 390 110", 0.5)}"/>
      <path d="M150 140 l 0 -9 M145.5 135.5 l 9 0 M410 30 l 0 -10 M405 25 l 10 0 M30 26 l 0 -8 M26 22 l 8 0"/>
    </g>
    <g class="labels"><text x="52" y="156" text-anchor="middle">home</text><text x="226" y="86" text-anchor="middle">the Moon</text><text x="372" y="150" text-anchor="middle">Mars</text></g>
  </svg>`;
}
