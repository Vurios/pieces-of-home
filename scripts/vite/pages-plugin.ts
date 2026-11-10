import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import credits from "../../src/data/credits.json";
import { ABOUT, GUIDE } from "../../src/content/guide";
import { type MachineSpread, SPREADS, factText, formatDate, spreadYear } from "../../src/content/notebook";
import type { FactEntry } from "../../src/content/facts";
import { DRAWINGS } from "../../src/ui/drawing/machines";
import { sketch } from "../../src/ui/drawing/sketch";

/**
 * Builds the Field Guide (`/field-guide/`) and the About page (`/about/`) as
 * plain, semantic HTML at build time, from the same notebook, fact and credit
 * data as the game. No WebGL and no script: they load fast on old machines,
 * read well with a screen reader, and print cleanly for a classroom.
 */
const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const link = (href: string, text: string): string => `<a href="${esc(href)}" rel="noopener noreferrer">${esc(text)}</a>`;

function drawing(spread: MachineSpread, seed: number): string {
  const paths = sketch(DRAWINGS[spread.drawing](), seed, { roughness: 1.1, strokeWidth: 2 });
  const d = paths.map((p) => `<path d="${p}"/>`).join("");
  return `<figure class="sketch"><svg viewBox="0 0 320 220" role="img" aria-label="${esc(`Dad's sketch of ${spread.name}`)}">${d}</svg><figcaption class="tag">${esc(GUIDE.sketch)}</figcaption></figure>`;
}

/** Facts in the order the guide first shows them, for the numbered source list. */
function collectFacts(): FactEntry[] {
  const seen = new Map<string, FactEntry>();
  for (const spread of SPREADS) {
    for (const entry of [...(spread.place ? [spread.place] : []), ...spread.learned, ...spread.thenNow, ...spread.deeper]) seen.set(entry.id, entry);
  }
  return [...seen.values()];
}

function guideBody(today: Date): string {
  const facts = collectFacts();
  const number = new Map(facts.map((f, i) => [f.id, i + 1]));
  const cite = (f: FactEntry): string => ` <a class="cite" href="#src-${number.get(f.id)}" aria-label="${esc(`${GUIDE.source} ${number.get(f.id)}`)}">[${number.get(f.id)}]</a>`;
  // Date-aware facts carry both wordings; a tiny script picks the right one on the day it is read.
  const item = (f: FactEntry): string => {
    if (f.id === "v1-light-day" && f.date) {
      const after = factText(f, new Date(8.64e15));
      return `<li><span data-when="${f.date}T06:16:07Z" data-after="${esc(after)}">${esc(factText(f, today))}</span>${cite(f)}</li>`;
    }
    return `<li>${esc(factText(f, today))}${cite(f)}</li>`;
  };

  const machines = SPREADS.map((spread, i) => {
    const year = spreadYear(spread);
    const parts: string[] = [];
    parts.push(`<header><p class="tag">${esc(spread.world)}${year ? ` · ${esc(year)}` : ""}</p><h3 id="m-${spread.id}">${esc(spread.nickname)}</h3><p class="real">${esc(spread.name)}</p><p class="chapter">${esc(spread.chapter)}</p></header>`);
    parts.push(drawing(spread, 20 + i));
    if (spread.place) parts.push(`<p><strong>${esc(GUIDE.where)}:</strong> ${esc(spread.place.kid)}${cite(spread.place)}</p>`);
    parts.push(`<h4>${esc(GUIDE.forWhat)}</h4><p>${esc(spread.forWhat)}</p>`);
    if (spread.learned.length) parts.push(`<h4>${esc(GUIDE.learned)}</h4><ul>${spread.learned.map(item).join("")}</ul>`);
    if (spread.thenNow.length) parts.push(`<h4>${esc(GUIDE.thenNow)}</h4><ul>${spread.thenNow.map(item).join("")}</ul>`);
    if (spread.deeper.length) {
      parts.push(`<h4>${esc(GUIDE.deeper)}</h4><ul class="deeper">${spread.deeper.map((f) => `<li>${esc(f.kid)}${f.deeper ? ` ${esc(f.deeper)}` : ""}${cite(f)}</li>`).join("")}</ul>`);
    }
    if (spread.images.length) {
      const pics = spread.images
        .map(
          (img) =>
            `<figure class="photo"><img src="${esc(img.file)}" alt="${esc(img.alt)}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async"/><figcaption>${esc(img.title)}${img.date ? `, ${esc(formatDate(img.date))}` : ""}. ${esc(GUIDE.photoBy)}: ${esc(img.credit)}. ${link(img.sourceUrl, GUIDE.source)}</figcaption></figure>`,
        )
        .join("");
      parts.push(`<div class="photos">${pics}</div>`);
    }
    parts.push(`<blockquote class="dad"><p>${esc(spread.dadNote)}</p><footer>${esc(GUIDE.dadSays)}</footer></blockquote>`);
    return `<article class="machine" aria-labelledby="m-${spread.id}">${parts.join("")}</article>`;
  }).join("");

  const sources = facts
    .map((f, i) => `<li id="src-${i + 1}">${esc(f.kid)} ${link(f.sourceUrl, f.sourceTitle)}${f.checkedOn ? ` <span class="checked">(${esc(GUIDE.checked)} ${esc(formatDate(f.checkedOn))})</span>` : ""}</li>`)
    .join("");

  const media = credits.media
    .map((m) => `<li>${esc(m.title)}. ${esc(m.credit)}. ${esc(m.license)}. ${link(m.page ?? m.sourceUrl, GUIDE.source)}</li>`)
    .join("");
  const fonts = credits.fonts.map((f) => `<li>${esc(f.name)} by ${esc(f.by)}, ${esc(f.license)}. ${link(f.sourceUrl, GUIDE.source)}</li>`).join("");
  const libs = credits.libraries.map((l) => `<li>${esc(l.name)}, ${esc(l.license)}. ${link(l.sourceUrl, GUIDE.source)}</li>`).join("");

  const toc = [
    [`story`, GUIDE.storyTitle],
    [`machines`, GUIDE.machinesTitle],
    [`class`, GUIDE.forClassTitle],
    [`sources`, GUIDE.sourcesTitle],
    [`credits`, GUIDE.creditsTitle],
  ]
    .map(([id, text]) => `<li><a href="#${id}">${esc(text!)}</a></li>`)
    .join("");

  return `
<a class="skip" href="#main">Skip to the guide</a>
<header class="masthead">
  <p class="kicker tag">Field Guide</p>
  <h1>${esc(GUIDE.title)}</h1>
  <p class="lede">${esc(GUIDE.lede)}</p>
  <p class="actions"><a class="btn amber" href="/">${esc(GUIDE.play)}</a> <a class="btn" href="/about/">${esc(GUIDE.about)}</a> <button class="btn quiet" type="button" onclick="window.print()">${esc(GUIDE.print)}</button></p>
</header>
<nav class="toc" aria-labelledby="toc-title"><h2 id="toc-title">${esc(GUIDE.contents)}</h2><ol>${toc}</ol></nav>
<main id="main">
  <section id="story" aria-labelledby="story-title"><h2 id="story-title">${esc(GUIDE.storyTitle)}</h2>${GUIDE.story.map((p) => `<p>${esc(p)}</p>`).join("")}
    <h3>${esc(GUIDE.modelsTitle)}</h3><p>${esc(GUIDE.models)}</p></section>
  <section id="machines" aria-labelledby="machines-title"><h2 id="machines-title">${esc(GUIDE.machinesTitle)}</h2>${machines}</section>
  <section id="class" aria-labelledby="class-title"><h2 id="class-title">${esc(GUIDE.forClassTitle)}</h2><ul>${GUIDE.forClass.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
  <section id="sources" aria-labelledby="sources-title"><h2 id="sources-title">${esc(GUIDE.sourcesTitle)}</h2><p>${esc(GUIDE.sourcesLede)}</p><ol class="sources">${sources}</ol></section>
  <section id="credits" aria-labelledby="credits-title"><h2 id="credits-title">${esc(GUIDE.creditsTitle)}</h2>
    <h3>Pictures</h3><ul class="small">${media}</ul>
    <h3>Fonts</h3><ul class="small">${fonts}</ul>
    <h3>Code</h3><ul class="small">${libs}</ul>
  </section>
</main>
<footer class="foot"><p>${esc(GUIDE.notEndorsed)}</p></footer>
<script>for(const el of document.querySelectorAll("[data-when]"))if(Date.now()>=Date.parse(el.dataset.when))el.textContent=el.dataset.after;</script>`;
}

function aboutBody(): string {
  return `
<a class="skip" href="#main">Skip to the page</a>
<header class="masthead">
  <p class="kicker tag">About</p>
  <h1>${esc(ABOUT.title)}</h1>
  <p class="lede">${esc(ABOUT.lede)}</p>
  <p class="actions"><a class="btn amber" href="/">${esc(GUIDE.play)}</a> <a class="btn" href="/field-guide/">${esc(ABOUT.guideLink)}</a></p>
</header>
<main id="main">
  <section aria-labelledby="a-play"><h2 id="a-play">${esc(ABOUT.playTitle)}</h2><ul>${ABOUT.play.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
  <section aria-labelledby="a-safe"><h2 id="a-safe">${esc(ABOUT.safeTitle)}</h2><p>${esc(ABOUT.safe)}</p></section>
  <section aria-labelledby="a-grown" class="grown"><h2 id="a-grown">${esc(ABOUT.grownTitle)}</h2>${ABOUT.grown.map((p) => `<p>${esc(p)}</p>`).join("")}</section>
  <section aria-labelledby="a-facts"><h2 id="a-facts">${esc(ABOUT.factsTitle)}</h2><p>${esc(ABOUT.facts)}</p><p><a href="/field-guide/#sources">${esc(GUIDE.sourcesTitle)}</a> · <a href="/field-guide/#credits">${esc(ABOUT.creditsLink)}</a></p></section>
  <section aria-labelledby="a-made"><h2 id="a-made">${esc(ABOUT.madeTitle)}</h2><p>${esc(ABOUT.made)}</p></section>
</main>
<footer class="foot"><p>${esc(GUIDE.notEndorsed)}</p></footer>`;
}

export function pagesPlugin(): Plugin {
  return {
    name: "poh-pages",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const file = ctx.filename.replaceAll("\\", "/");
        if (file.endsWith("/field-guide/index.html")) return html.replace("<!--poh:guide-->", guideBody(new Date()));
        if (file.endsWith("/about/index.html")) return html.replace("<!--poh:about-->", aboutBody());
        return html;
      },
    },
  };
}

/** For tests: the rendered bodies, without Vite. */
export const renderPages = { guide: guideBody, about: aboutBody, template: (name: string) => readFileSync(new URL(`../../${name}/index.html`, import.meta.url), "utf8") };
