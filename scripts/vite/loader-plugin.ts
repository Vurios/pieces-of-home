import { existsSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { LOADER } from "../../src/content/loader";
import { blockTitle } from "./loader-art";
import { checkbox, coverEmboss, escape, lampSketch, lightSwitch, pencil, postmark, seeded, travelDoodle } from "./loader-book";

export { wobble } from "./loader-book";

/**
 * Draws the loading page into `index.html` at build time (and in dev), so the
 * page paints before any script runs.
 *
 * It is Dad's notebook, held open in his dark workshop. The workshop behind
 * it is a picture the game draws of itself (`scripts/render-backdrop.ts`),
 * lined up with the first frame of the title flight, so when the light is
 * switched on, the live 3D workshop takes the picture's place unseen. The
 * notebook's drawings come from `loader-book.ts`; the block-letter title is
 * the same one the 3D title is built from (`loader-art.ts`).
 */
interface FactRow {
  id: string;
  short?: string;
  kid: string;
  status: string;
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
  return items.map((text, i) => `<li data-step="${i}">${checkbox(31 + i * 7)}<span>${escape(text)}</span></li>`).join("");
}

/** Dust drifting in the dark workshop, at different depths. */
function motesHtml(): string {
  const random = seeded(57);
  return Array.from({ length: 16 }, () => {
    const x = (random() * 100).toFixed(1);
    const y = (20 + random() * 75).toFixed(1);
    const s = (3 + random() * 5).toFixed(1);
    const t = (9 + random() * 9).toFixed(1);
    const dx = ((random() - 0.5) * 60).toFixed(0);
    return `<i style="left:${x}%;top:${y}%;--s:${s}px;--t:${t}s;--d:-${(random() * 12).toFixed(1)}s;--dx:${dx}px"></i>`;
  }).join("");
}

/** The tiny copy of the workshop picture, inlined as the first paint while the picture loads. */
function tinyBackdrop(): string {
  const file = new URL("../../public/loader/workshop-tiny.txt", import.meta.url);
  return existsSync(file) ? `url("${readFileSync(file, "utf8").trim()}")` : "none";
}

export function loaderPlugin(): Plugin {
  return {
    name: "poh-loader",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!ctx.filename.replaceAll("\\", "/").endsWith("/index.html") || /field-guide|about|audio-lab/.test(ctx.filename)) return html;
        const facts = (JSON.parse(readFileSync(new URL("../../src/data/facts.json", import.meta.url), "utf8")) as { facts: FactRow[] }).facts;
        return html
          .replace("/*poh:tiny*/", tinyBackdrop())
          .replace("<!--poh:motes-->", motesHtml())
          .replace("<!--poh:emboss-->", coverEmboss())
          .replace("<!--poh:cover-->", escape(LOADER.cover))
          .replace("<!--poh:cover-for-->", escape(LOADER.coverFor))
          .replace("<!--poh:tag-->", escape(LOADER.tag))
          .replace("<!--poh:page-->", escape(LOADER.page))
          .replace("<!--poh:page-note-->", escape(LOADER.pageNote))
          .replace("<!--poh:sketch-->", lampSketch())
          .replace("<!--poh:travel-->", travelDoodle())
          .replace("<!--poh:postmark-->", postmark())
          .replace("<!--poh:title-->", `<h1 id="boot-title" class="sr">${escape(LOADER.title)}</h1>${blockTitle()}`)
          .replace("<!--poh:kicker-->", escape(LOADER.kicker))
          .replace("<!--poh:heading-->", escape(LOADER.heading))
          .replace("<!--poh:list-->", listHtml(facts))
          .replace("<!--poh:pencil-->", pencil)
          .replace("<!--poh:loading-->", escape(LOADER.loading))
          .replace("<!--poh:ready-->", escape(LOADER.ready))
          .replace("<!--poh:switch-->", lightSwitch)
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
