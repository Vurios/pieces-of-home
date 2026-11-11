import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { LOADER } from "../../src/content/loader";

/**
 * Draws the loading page into `index.html` at build time (and in dev), so the
 * page paints before any script runs:
 *
 * - Dad's desk lamp as five ink strokes (base, arm, joint, shade, bulb). Each
 *   stroke comes in three hand-wobbled copies that swap at about 10 frames a
 *   second, the "boiling line" of hand-drawn animation.
 * - The "Things that kept working" list, each line a fact's short wording.
 */
interface FactRow {
  id: string;
  short?: string;
  kid: string;
  status: string;
}

/** Strokes in drawing order. Absolute M, L, C and Z commands only, so every number can wobble. */
const STROKES: string[][] = [
  // 0 base: a weighted dome with a flat foot.
  ["M92 338 C 96 312, 204 312, 208 338", "M84 340 L 216 340 C 220 348, 214 352, 206 352 L 94 352 C 86 352, 80 348, 84 340 Z"],
  // 1 arm: two parallel bars up to the elbow and on to the head, with a spring.
  ["M144 322 L 106 202 L 206 120", "M158 320 L 120 206 L 216 130", coil(162, 300, 140, 232, 7, 6), "M162 300 L 152 316 M140 232 L 126 214"],
  // 2 joints: three round pivots.
  [circle(151, 322, 10), circle(113, 203, 11), circle(211, 124, 9)],
  // 3 shade: a cone tipped down toward the page, with a rim.
  [
    "M214 104 C 226 92, 246 92, 258 102 L 316 166 C 304 190, 262 206, 236 198 L 210 126 C 206 116, 208 108, 214 104 Z",
    "M236 198 C 262 188, 300 176, 316 166",
  ],
  // 4 bulb: a round bulb peeking out under the shade, with its filament.
  ["M246 196 C 244 226, 300 226, 306 180", "M262 204 C 266 196, 270 212, 274 202 C 278 194, 282 210, 286 198"],
];

/** A coiled spring between two points, as a tight wave of curves. */
function coil(ax: number, ay: number, bx: number, by: number, turns: number, amp: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const at = (t: number, side: number): string => `${(ax + dx * t + nx * amp * side).toFixed(1)} ${(ay + dy * t + ny * amp * side).toFixed(1)}`;
  const steps = turns * 2;
  let d = `M${at(0, 0)}`;
  for (let i = 0; i < steps; i += 1) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const side = i % 2 === 0 ? 1.35 : -1.35;
    // Each half turn leans back a little, the way a drawn coil overlaps itself.
    d += ` C ${at(t0 - 0.02, side)}, ${at(t1 + 0.02, side)}, ${at(t1, 0)}`;
  }
  return d;
}

function circle(cx: number, cy: number, r: number): string {
  const k = r * 0.5523;
  return `M${cx + r} ${cy} C ${cx + r} ${cy + k}, ${cx + k} ${cy + r}, ${cx} ${cy + r} C ${cx - k} ${cy + r}, ${cx - r} ${cy + k}, ${cx - r} ${cy} C ${cx - r} ${cy - k}, ${cx - k} ${cy - r}, ${cx} ${cy - r} C ${cx + k} ${cy - r}, ${cx + r} ${cy - k}, ${cx + r} ${cy} Z`;
}

function seeded(seed: number): () => number {
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

/** Where each of Dad's notes sits: a leader line from the part out to the text. */
const NOTES: { from: [number, number]; lead: string; x: number; y: number; anchor: "start" | "end" }[] = [
  { from: [210, 348], lead: "M210 348 C 240 360, 270 370, 296 374", x: 304, y: 379, anchor: "start" },
  { from: [150, 268], lead: "M150 268 C 110 262, 70 256, 32 252", x: 24, y: 257, anchor: "end" },
  { from: [106, 196], lead: "M106 196 C 86 180, 66 166, 44 156", x: 36, y: 160, anchor: "end" },
  { from: [246, 96], lead: "M246 96 C 262 76, 280 64, 304 58", x: 312, y: 62, anchor: "start" },
  { from: [304, 212], lead: "M304 212 C 314 232, 322 248, 328 262", x: 334, y: 274, anchor: "start" },
];

/**
 * Dad's blueprint of the lamp: construction lines, the five strokes in three
 * boiling copies, a glow behind the bulb for when the light comes on, and his
 * notes beside each part.
 */
export function lampSvg(): string {
  const groups: string[] = [];
  STROKES.forEach((paths, i) => {
    const frames: string[] = [];
    for (let f = 0; f < 3; f += 1) {
      const random = seeded(101 + i * 17 + f * 1009);
      const d = paths.map((p) => `<path pathLength="1" d="${f === 0 ? p : wobble(p, random, 1.1)}"/>`).join("");
      frames.push(`<g class="f f${f}">${d}</g>`);
    }
    groups.push(`<g class="s s${i}">${frames.join("")}</g>`);
  });
  const notes = NOTES.map((n, i) => {
    const lines = LOADER.parts[i] ?? [];
    const text = lines.map((line, k) => `<tspan x="${n.x}" dy="${k === 0 ? 0 : 20}">${escape(line)}</tspan>`).join("");
    return `<g class="a a${i}"><path class="lead" pathLength="1" d="${n.lead}"/><circle class="dot" r="2.8" cx="${n.from[0]}" cy="${n.from[1]}"/><text x="${n.x}" y="${n.y}" text-anchor="${n.anchor}">${text}</text></g>`;
  }).join("");
  // Construction lines come first, the way a drawing starts: a compass circle, center marks, a ground line.
  const guides = `<g class="guides"><circle cx="200" cy="222" r="176"/><path d="M200 30 L 200 66 M200 378 L 200 414 M6 222 L 42 222 M358 222 L 394 222"/><path d="M-70 353 L 470 353"/></g>`;
  const halo = `<defs><radialGradient id="bulb-glow"><stop offset="0" stop-color="#fff0c8" stop-opacity="1"/><stop offset="0.3" stop-color="#ffc66e" stop-opacity="0.5"/><stop offset="1" stop-color="#ffae48" stop-opacity="0"/></radialGradient></defs><circle class="halo" cx="278" cy="204" r="130" fill="url(#bulb-glow)"/>`;
  return `<svg id="lamp" viewBox="-120 24 640 400" aria-hidden="true" focusable="false">${halo}${guides}${groups.join("")}${notes}</svg>`;
}

/** The engineer's title block in the corner of the drawing. */
export function titleBlockHtml(): string {
  return LOADER.titleBlock.map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`).join("");
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function listHtml(facts: FactRow[]): string {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const items = LOADER.lines.map((ref) => {
    const id = /\{F:([a-z0-9-]+)\}/.exec(ref)?.[1];
    const fact = id ? byId.get(id) : undefined;
    if (!fact || fact.status !== "checked" || !fact.short) throw new Error(`Loader line ${ref} needs a checked fact with short wording.`);
    return fact.short;
  });
  items.push(LOADER.last);
  return items.map((text, i) => `<li data-step="${i}"><svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path pathLength="1" d="M3 11 C 5 13, 7 15, 8 16 C 11 11, 14 7, 18 3"/></svg><span>${escape(text)}</span></li>`).join("");
}

export function loaderPlugin(): Plugin {
  return {
    name: "poh-loader",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!ctx.filename.replaceAll("\\", "/").endsWith("/index.html") || /field-guide|about/.test(ctx.filename)) return html;
        const facts = (JSON.parse(readFileSync(new URL("../../src/data/facts.json", import.meta.url), "utf8")) as { facts: FactRow[] }).facts;
        return html
          .replace("<!--poh:lamp-->", lampSvg())
          .replace("<!--poh:kicker-->", escape(LOADER.kicker))
          .replace("<!--poh:title-->", escape(LOADER.title))
          .replace("<!--poh:titleblock-->", titleBlockHtml())
          .replace("<!--poh:list-->", listHtml(facts))
          .replace("<!--poh:heading-->", escape(LOADER.heading))
          .replace("<!--poh:ready-->", escape(LOADER.ready))
          .replace("<!--poh:prompt-->", escape(LOADER.prompt))
          .replace("<!--poh:hint-->", escape(LOADER.promptHint))
          .replace("<!--poh:slow-->", escape(LOADER.slow))
          .replace("<!--poh:nowebgl-->", escape(LOADER.noWebgl))
          .replace("<!--poh:nowebgl-link-->", escape(LOADER.noWebglLink))
          .replace("/*poh:milestones*/", JSON.stringify(LOADER.milestones));
      },
    },
  };
}
