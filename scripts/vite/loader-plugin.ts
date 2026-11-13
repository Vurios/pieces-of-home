import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { LOADER } from "../../src/content/loader";
import { blockTitle } from "./loader-art";
import { cloudSvg, farSvg, lettersSvg, planetSvg, remiSvg, sparklesHtml, starsSvg } from "./loader-scene";

/**
 * Draws the loading page into `index.html` at build time (and in dev), so the
 * page paints before any script runs. It is the game's own look in 2.5D (see
 * `loader-scene.ts`): the little home planet turning under the night sky with
 * Remi walking on top, the Moon and Mars, and the game's block-letter title.
 * A paper card under it ticks through "Things that kept working" as the game
 * loads, then turns into "Turn on the light".
 */
interface FactRow {
  id: string;
  short?: string;
  kid: string;
  status: string;
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

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "Things that kept working": one line per loading milestone, each a checked fact's short wording, then the lamp. */
export function listHtml(facts: FactRow[]): string {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const items = LOADER.lines.map((ref) => {
    const id = /\{F:([a-z0-9-]+)\}/.exec(ref)?.[1];
    const fact = id ? byId.get(id) : undefined;
    if (!fact || fact.status !== "checked" || !fact.short) throw new Error(`Loader line ${ref} needs a checked fact with short wording.`);
    return fact.short;
  });
  items.push(LOADER.last);
  return items.map((text, i) => `<li data-step="${i}"><span class="tick" aria-hidden="true"></span>${escape(text)}</li>`).join("");
}

/** Little lights drifting up in front of the planet, at different depths. */
function firefliesHtml(): string {
  const random = seeded(41);
  return Array.from({ length: 9 }, () => {
    const x = (random() * 100).toFixed(1);
    const y = (55 + random() * 40).toFixed(1);
    const s = (4 + random() * 6).toFixed(1);
    const t = 6 + random() * 5;
    // About ten frames a second, like the rest of the page.
    return `<i style="left:${x}%;top:${y}%;--s:${s}px;--d:${(random() * 6).toFixed(1)}s;--t:${t.toFixed(1)}s;--n:${Math.round(t * 10)}"></i>`;
  }).join("");
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
          .replace("<!--poh:stars-->", starsSvg())
          .replace("<!--poh:sparkles-->", sparklesHtml())
          .replace("<!--poh:far-->", farSvg())
          .replace("<!--poh:letters-->", lettersSvg())
          .replace("<!--poh:cloud1-->", cloudSvg(3))
          .replace("<!--poh:cloud2-->", cloudSvg(9))
          .replace("<!--poh:cloud3-->", cloudSvg(15))
          .replace("<!--poh:planet-->", `<img class="planet" alt="" aria-hidden="true" draggable="false" src="data:image/svg+xml,${encodeURIComponent(planetSvg())}" />`)
          .replace("<!--poh:remi-->", remiSvg())
          .replace("<!--poh:fireflies-->", firefliesHtml())
          .replace("<!--poh:title-->", `<h1 id="boot-title" class="sr">${escape(LOADER.title)}</h1>${blockTitle()}`)
          .replace("<!--poh:kicker-->", escape(LOADER.kicker))
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
