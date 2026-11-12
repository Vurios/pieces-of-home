import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import credits from "../../src/data/credits.json";
import { ABOUT, GUIDE } from "../../src/content/guide";
import { ARCHIVE } from "../../src/content/archive";
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
  return `<figure class="sketch"><svg viewBox="0 0 320 220" role="img" aria-label="${esc(`Dad's sketch of ${spread.name}`)}">${d}</svg><figcaption class="note-cap">${esc(GUIDE.sketch)}</figcaption></figure>`;
}

/** Dad's lamp in chalk on the dusk header, with a warm glow at the bulb. Decoration only. */
function heroLamp(): string {
  const paths = sketch(DRAWINGS.lamp(), 5, { roughness: 1.2, strokeWidth: 2 });
  const d = paths.map((p) => `<path d="${p}"/>`).join("");
  return `<div class="hero-art" aria-hidden="true"><svg viewBox="40 10 260 210"><defs><radialGradient id="glow"><stop offset="0" stop-color="#ffd38a" stop-opacity=".75"/><stop offset=".45" stop-color="#f2a541" stop-opacity=".25"/><stop offset="1" stop-color="#f2a541" stop-opacity="0"/></radialGradient></defs><circle cx="226" cy="118" r="78" fill="url(#glow)"/><g class="chalk">${d}</g></svg></div>`;
}

/** A section heading with a small amber number in front. The number is decoration. */
const heading = (id: string, n: number, text: string): string =>
  `<h2 id="${id}"><span class="num" aria-hidden="true">${String(n).padStart(2, "0")}</span>${esc(text)}</h2>`;

/** Facts in the order the guide first shows them, for the numbered source list. */
function collectFacts(): FactEntry[] {
  const seen = new Map<string, FactEntry>();
  for (const spread of SPREADS) {
    for (const entry of [...(spread.place ? [spread.place] : []), ...spread.learned, ...spread.thenNow, ...spread.deeper]) seen.set(entry.id, entry);
  }
  for (const card of ARCHIVE) for (const entry of [card.place, ...card.facts, ...card.more]) seen.set(entry.id, entry);
  return [...seen.values()];
}

function guideBody(today: Date): string {
  const facts = collectFacts();
  const number = new Map(facts.map((f, i) => [f.id, i + 1]));
  const cite = (f: FactEntry): string => ` <a class="cite" href="#src-${number.get(f.id)}" aria-label="${esc(`${GUIDE.source} ${number.get(f.id)}`)}">${number.get(f.id)}</a>`;
  // Date-aware facts carry both wordings; a tiny script picks the right one on the day it is read.
  const item = (f: FactEntry): string => {
    if (f.id === "v1-light-day" && f.date) {
      const after = factText(f, new Date(8.64e15));
      return `<li><span data-when="${f.date}T10:16:07Z" data-after="${esc(after)}">${esc(factText(f, today))}</span>${cite(f)}</li>`;
    }
    return `<li>${esc(factText(f, today))}${cite(f)}</li>`;
  };

  const machines = SPREADS.map((spread, i) => {
    const year = spreadYear(spread);
    const kicker = `<p class="m-kicker">${esc(spread.world)}${year ? `<span class="dot" aria-hidden="true"></span>${esc(year)}` : ""}</p>`;
    const dad = `<blockquote class="dad"><p>${esc(spread.dadNote)}</p><footer>${esc(GUIDE.dadSays)}</footer></blockquote>`;
    const top = `<div class="m-top">${drawing(spread, 20 + i)}<div class="m-head">${kicker}<h3 id="m-${spread.id}">${esc(spread.nickname)}</h3><p class="real">${esc(spread.name)}</p><p class="chapter">${esc(spread.chapter)}</p>${dad}</div></div>`;
    const body: string[] = [];
    if (spread.place) body.push(`<p class="where"><strong>${esc(GUIDE.where)}:</strong> ${esc(spread.place.kid)}${cite(spread.place)}</p>`);
    body.push(`<h4>${esc(GUIDE.forWhat)}</h4><p>${esc(spread.forWhat)}</p>`);
    if (spread.learned.length) body.push(`<h4>${esc(GUIDE.learned)}</h4><ul class="facts">${spread.learned.map(item).join("")}</ul>`);
    if (spread.thenNow.length) body.push(`<div class="now"><h4>${esc(GUIDE.thenNow)}</h4><ul class="facts">${spread.thenNow.map(item).join("")}</ul></div>`);
    if (spread.deeper.length) {
      body.push(`<h4>${esc(GUIDE.deeper)}</h4><ul class="facts deeper">${spread.deeper.map((f) => `<li>${esc(f.kid)}${f.deeper ? ` ${esc(f.deeper)}` : ""}${cite(f)}</li>`).join("")}</ul>`);
    }
    let pics = "";
    if (spread.images.length) {
      const figures = spread.images
        .map(
          (img) =>
            `<figure class="photo"><img src="${esc(img.file)}" alt="${esc(img.alt)}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async"/><figcaption>${esc(img.title)}${img.date ? `, ${esc(formatDate(img.date))}` : ""}. ${esc(GUIDE.photoBy)}: ${esc(img.credit)}. ${link(img.sourceUrl, GUIDE.source)}</figcaption></figure>`,
        )
        .join("");
      pics = `<div class="photos${spread.images.length > 1 ? " two" : ""}">${figures}</div>`;
    }
    return `<article class="machine" aria-labelledby="m-${spread.id}">${top}<div class="m-body">${body.join("")}</div>${pics}</article>`;
  }).join("");

  const archive = ARCHIVE.map((card) => {
    const img = card.image;
    const photo = `<figure class="photo"><img src="${esc(img.file)}" alt="${esc(img.alt)}" width="${img.width}" height="${img.height}" loading="lazy" decoding="async"/><figcaption>${esc(img.title)}${img.date ? `, ${esc(formatDate(img.date))}` : ""}. ${esc(GUIDE.photoBy)}: ${esc(img.credit)}. ${link(img.sourceUrl, GUIDE.source)}</figcaption></figure>`;
    const dad = `<blockquote class="dad"><p>${esc(card.note)}</p><footer>${esc(GUIDE.dadSays)}</footer></blockquote>`;
    return `<article class="machine archive-card" aria-labelledby="a-${card.id}"><div class="m-top"><div class="m-head"><p class="m-kicker">${esc(card.world)}</p><h3 id="a-${card.id}">${esc(card.name)}</h3>${dad}</div></div><div class="m-body"><p class="where"><strong>${esc(GUIDE.where)}:</strong> ${esc(card.place.kid)}${cite(card.place)}</p><ul class="facts">${[...card.facts, ...card.more].map(item).join("")}</ul></div><div class="photos">${photo}</div></article>`;
  }).join("");

  const sources = facts
    .map(
      (f, i) =>
        `<li id="src-${i + 1}"><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(f.kid)} ${link(f.sourceUrl, f.sourceTitle)}${f.checkedOn ? ` <span class="checked">(${esc(GUIDE.checked)} ${esc(formatDate(f.checkedOn))})</span>` : ""}</span></li>`,
    )
    .join("");

  const media = credits.media.map((m) => `<li><strong>${esc(m.title)}.</strong> ${esc(m.credit)}. ${esc(m.license)}. ${link(m.page ?? m.sourceUrl, GUIDE.source)}</li>`).join("");
  const fonts = credits.fonts.map((f) => `<li><strong>${esc(f.name)}</strong> by ${esc(f.by)}, ${esc(f.license)}. ${link(f.sourceUrl, GUIDE.source)}</li>`).join("");
  const libs = credits.libraries.map((l) => `<li><strong>${esc(l.name)}</strong>, ${esc(l.license)}. ${link(l.sourceUrl, GUIDE.source)}</li>`).join("");

  const toc = [
    [`story`, GUIDE.storyTitle],
    [`machines`, GUIDE.machinesTitle],
    [`archive`, GUIDE.archiveTitle],
    [`class`, GUIDE.forClassTitle],
    [`sources`, GUIDE.sourcesTitle],
    [`credits`, GUIDE.creditsTitle],
  ]
    .map(([id, text], i) => `<li><a href="#${id}"><span class="n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>${esc(text!)}</a></li>`)
    .join("");
  const machineLinks = SPREADS.map((s) => `<li><a href="#m-${s.id}">${esc(s.nickname)}</a></li>`).join("");

  return `
<a class="skip" href="#main">Skip to the guide</a>
<header class="hero">
  <div class="hero-in">
    <div class="hero-text">
      <p class="kicker">${esc(GUIDE.kicker)}</p>
      <h1>Pieces of Home: <span>Field Guide</span></h1>
      <p class="lede">${esc(GUIDE.lede)}</p>
      <p class="actions"><a class="btn amber" href="/">${esc(GUIDE.play)}</a> <a class="btn ghost" href="/about/">${esc(GUIDE.about)}</a> <button class="btn ghost" type="button" onclick="window.print()">${esc(GUIDE.print)}</button></p>
    </div>
    ${heroLamp()}
  </div>
</header>
<div class="layout">
  <nav class="toc" aria-labelledby="toc-title"><h2 id="toc-title">${esc(GUIDE.contents)}</h2><ol>${toc}</ol><ul class="sub">${machineLinks}</ul></nav>
  <main id="main">
    <section id="story" aria-labelledby="story-title" class="story">${heading("story-title", 1, GUIDE.storyTitle)}${GUIDE.story.map((p, i) => `<p${i === 0 ? ' class="first"' : ""}>${esc(p)}</p>`).join("")}
      <aside class="models"><h3>${esc(GUIDE.modelsTitle)}</h3><p>${esc(GUIDE.models)}</p></aside></section>
    <section id="machines" aria-labelledby="machines-title">${heading("machines-title", 2, GUIDE.machinesTitle)}${machines}</section>
    <section id="archive" aria-labelledby="archive-title">${heading("archive-title", 3, GUIDE.archiveTitle)}<p>${esc(GUIDE.archiveLede)}</p>${archive}</section>
    <section id="class" aria-labelledby="class-title">${heading("class-title", 4, GUIDE.forClassTitle)}<ol class="steps">${GUIDE.forClass.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>
    <section id="sources" aria-labelledby="sources-title">${heading("sources-title", 5, GUIDE.sourcesTitle)}<p>${esc(GUIDE.sourcesLede)}</p><ol class="sources">${sources}</ol></section>
    <section id="credits" aria-labelledby="credits-title">${heading("credits-title", 6, GUIDE.creditsTitle)}
      <div class="credit-cols"><div><h3>Pictures</h3><ul class="small">${media}</ul></div><div><h3>Fonts</h3><ul class="small">${fonts}</ul><h3>Code</h3><ul class="small">${libs}</ul></div></div>
    </section>
  </main>
</div>
<footer class="foot"><p>${esc(GUIDE.notEndorsed)}</p></footer>
<script>for(const el of document.querySelectorAll("[data-when]"))if(Date.now()>=Date.parse(el.dataset.when))el.textContent=el.dataset.after;</script>`;
}

function aboutBody(): string {
  return `
<a class="skip" href="#main">Skip to the page</a>
<header class="hero">
  <div class="hero-in">
    <div class="hero-text">
      <p class="kicker">${esc(ABOUT.kicker)}</p>
      <h1>${esc(ABOUT.title)}</h1>
      <p class="lede">${esc(ABOUT.lede)}</p>
      <p class="actions"><a class="btn amber" href="/">${esc(GUIDE.play)}</a> <a class="btn ghost" href="/field-guide/">${esc(ABOUT.guideLink)}</a></p>
    </div>
    ${heroLamp()}
  </div>
</header>
<main id="main" class="about">
  <section aria-labelledby="a-play" class="card-s">${heading("a-play", 1, ABOUT.playTitle)}<ul class="facts">${ABOUT.play.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>
  <section aria-labelledby="a-safe" class="card-s">${heading("a-safe", 2, ABOUT.safeTitle)}<p>${esc(ABOUT.safe)}</p></section>
  <section aria-labelledby="a-grown" class="grown">${heading("a-grown", 3, ABOUT.grownTitle)}${ABOUT.grown.map((p) => `<p>${esc(p)}</p>`).join("")}</section>
  <section aria-labelledby="a-facts" class="card-s">${heading("a-facts", 4, ABOUT.factsTitle)}<p>${esc(ABOUT.facts)}</p><p class="links"><a href="/field-guide/#sources">${esc(GUIDE.sourcesTitle)}</a> <a href="/field-guide/#credits">${esc(ABOUT.creditsLink)}</a></p></section>
  <section aria-labelledby="a-made" class="card-s">${heading("a-made", 5, ABOUT.madeTitle)}<p>${esc(ABOUT.made)}</p></section>
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
