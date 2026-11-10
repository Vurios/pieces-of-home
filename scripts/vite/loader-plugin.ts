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
  [
    "M144 322 L 106 202 L 206 120",
    "M158 320 L 120 206 L 216 130",
    "M132 296 L 124 286 L 138 278 L 128 268 L 142 260 L 132 250 L 146 242",
  ],
  // 2 joints: three round pivots.
  [circle(151, 322, 10), circle(113, 203, 11), circle(211, 124, 9)],
  // 3 shade: a cone tipped down toward the page, with a rim.
  [
    "M214 104 C 226 92, 246 92, 258 102 L 316 166 C 304 190, 262 206, 236 198 L 210 126 C 206 116, 208 108, 214 104 Z",
    "M236 198 C 262 188, 300 176, 316 166",
  ],
  // 4 bulb: peeking out under the shade.
  ["M250 196 C 248 220, 290 220, 302 182", "M266 212 L 262 222", "M282 210 L 286 220"],
];

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

export function lampSvg(): string {
  const groups: string[] = [];
  STROKES.forEach((paths, i) => {
    const frames: string[] = [];
    for (let f = 0; f < 3; f += 1) {
      const random = seeded(101 + i * 17 + f * 1009);
      const d = paths.map((p) => `<path pathLength="1" d="${f === 0 ? p : wobble(p, random, 1.3)}"/>`).join("");
      frames.push(`<g class="f f${f}">${d}</g>`);
    }
    groups.push(`<g class="s s${i}">${frames.join("")}</g>`);
  });
  return `<svg id="lamp" viewBox="60 70 280 300" aria-hidden="true" focusable="false">${groups.join("")}</svg>`;
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
  return items.map((text, i) => `<li data-step="${i}"><span>${escape(text)}</span></li>`).join("");
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
