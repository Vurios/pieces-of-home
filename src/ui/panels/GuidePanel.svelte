<script lang="ts">
  import { tick } from "svelte";
  import { audio } from "../../audio/audio";
  import { ARCHIVE } from "../../content/archive";
  import type { FactEntry } from "../../content/facts";
  import { GUIDE, guideFacts } from "../../content/guide";
  import { type MachineSpread, SPREADS, factText, formatDate, spreadYear } from "../../content/notebook";
  import { DRAWINGS } from "../drawing/machines";
  import Sketch from "../drawing/Sketch.svelte";
  import Icon from "../Icon.svelte";
  import Polaroid from "../notebook/Polaroid.svelte";
  import Panel from "../Panel.svelte";

  /**
   * The Field Guide, inside the game: the whole story and every fact, for
   * families and classrooms. A drawer of paper tabs on the left (the story,
   * one tab per machine, Dad's archive, using it in class, sources) and one
   * index card on the right. Arrow keys or the D-pad flip through the tabs.
   * Print lays out every page, one after another, for a classroom handout.
   */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  type Entry = { id: string; label: string; group: "start" | "machines" | "more"; world?: MachineSpread["world"]; spread?: MachineSpread };
  const ENTRIES: Entry[] = [
    { id: "story", label: GUIDE.storyTitle, group: "start" },
    ...SPREADS.map((spread): Entry => ({ id: spread.id, label: spread.nickname, group: "machines", world: spread.world, spread })),
    { id: "archive", label: GUIDE.archiveTitle, group: "more" },
    { id: "class", label: GUIDE.forClassTitle, group: "more" },
    { id: "sources", label: GUIDE.sourcesTitle, group: "more" },
  ];
  const GROUPS: { id: Entry["group"]; label: string }[] = [
    { id: "start", label: GUIDE.startHere },
    { id: "machines", label: GUIDE.machinesTitle },
    { id: "more", label: GUIDE.more },
  ];

  const facts = guideFacts();
  const today = new Date();
  const text = (f: FactEntry): string => factText(f, today);

  let index = $state(0);
  const entry = $derived(ENTRIES[index]!);
  let page: HTMLElement | null = $state(null);
  let drawer: HTMLElement | null = $state(null);
  let printing = $state(false);

  async function pick(i: number, focus = false): Promise<void> {
    const next = (i + ENTRIES.length) % ENTRIES.length;
    if (next === index) return;
    index = next;
    audio.ui("page");
    await tick();
    page?.scrollTo({ top: 0 });
    const tab = drawer?.querySelector<HTMLElement>(`[data-entry="${ENTRIES[next]!.id}"]`);
    tab?.scrollIntoView({ block: "nearest" });
    if (focus) tab?.focus({ preventScroll: true });
  }

  function onDrawerKey(event: KeyboardEvent): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      void pick(index + 1, true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      void pick(index - 1, true);
    }
  }

  /** Lays out every page for paper, prints, then puts the panel back. */
  async function print(): Promise<void> {
    printing = true;
    await tick();
    const done = (): void => {
      printing = false;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  /** Moves the print copy to the top of the page, so nothing else prints with it. */
  function toBody(node: HTMLElement): { destroy(): void } {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  const sketchSeed = (spread: MachineSpread): number => 20 + SPREADS.indexOf(spread);
</script>

{#snippet source(f: FactEntry)}
  <a class="src" href={f.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${GUIDE.source}: ${f.sourceTitle}`}>{GUIDE.source}</a>
{/snippet}

{#snippet storyPage(paper: boolean)}
  <div class="story">
    <div class="story-text">
      {#each GUIDE.story as p, i (i)}<p class:first={i === 0}>{p}</p>{/each}
    </div>
    <div class="story-side">
      <div class="lamp" aria-hidden="true">
        <span class="glow"></span>
        <Sketch id={`guide-lamp-${paper ? "p" : "s"}`} prims={DRAWINGS.lamp} seed={5} color="var(--dad-ink)" />
      </div>
      <aside class="sticky">
        <h4>{GUIDE.modelsTitle}</h4>
        <p>{GUIDE.models}</p>
      </aside>
    </div>
  </div>
{/snippet}

{#snippet machinePage(spread: MachineSpread, paper: boolean)}
  {@const year = spreadYear(spread)}
  <div class="machine">
    <div class="m-top">
      <figure class="sketch-box">
        <Sketch id={`guide-${spread.id}-${paper ? "p" : "s"}`} prims={DRAWINGS[spread.drawing]} seed={sketchSeed(spread)} color="var(--dad-ink)" label={`Dad's sketch of ${spread.name}`} />
        <figcaption>{GUIDE.sketch}</figcaption>
      </figure>
      <div class="m-head">
        <p class="kicker">
          <span class="chip {spread.world.toLowerCase()}">{spread.world}</span>
          {#if year}<span class="year">{year}</span>{/if}
          <span class="chapter">{spread.chapter}</span>
        </p>
        <h3>{spread.nickname}</h3>
        <p class="real">{spread.name}</p>
        <blockquote class="dad">
          <p>{spread.dadNote}</p>
          <footer>Dad</footer>
        </blockquote>
      </div>
    </div>
    <div class="m-body">
      <div class="col">
        {#if spread.place}
          <p class="where"><span class="label">{GUIDE.where}</span> {text(spread.place)} {@render source(spread.place)}</p>
        {/if}
        <h4 class="label">{GUIDE.forWhat}</h4>
        <p>{spread.forWhat}</p>
        {#if spread.learned.length}
          <h4 class="label">{GUIDE.learned}</h4>
          <ul class="facts">
            {#each spread.learned as f (f.id)}<li>{text(f)} {@render source(f)}</li>{/each}
          </ul>
        {/if}
      </div>
      <div class="col">
        {#if spread.thenNow.length}
          <div class="now">
            <h4 class="label">{GUIDE.thenNow}</h4>
            {#each spread.thenNow as f (f.id)}<p>{text(f)} {@render source(f)}</p>{/each}
          </div>
        {/if}
        {#if spread.deeper.length}
          <h4 class="label">{GUIDE.deeper}</h4>
          <ul class="facts deeper">
            {#each spread.deeper as f (f.id)}<li>{f.kid}{f.deeper ? ` ${f.deeper}` : ""} {@render source(f)}</li>{/each}
          </ul>
        {/if}
      </div>
    </div>
    {#if spread.images.length}
      <div class="photos" class:two={spread.images.length > 1}>
        {#each spread.images as image, i (image.id)}
          <Polaroid {image} tilt={i % 2 ? 1.6 : -1.8} tape={i % 2 ? "sage" : "amber"} />
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet archivePage()}
  <p class="lede">{GUIDE.archiveLede}</p>
  <div class="cards">
    {#each ARCHIVE as card (card.id)}
      <article class="mini" aria-label={card.name}>
        <img src={card.image.file} alt={card.image.alt} loading="lazy" decoding="async" />
        <div>
          <p class="kicker"><span class="chip {card.world.toLowerCase()}">{card.world}</span></p>
          <h4>{card.name}</h4>
          <p class="where small">{card.place.kid} {@render source(card.place)}</p>
          <ul class="facts small">
            {#each card.facts as f (f.id)}<li>{text(f)} {@render source(f)}</li>{/each}
          </ul>
          <p class="note">{card.note} <span class="sign">Dad</span></p>
          <p class="credit">{GUIDE.photoBy}: {card.image.credit}</p>
        </div>
      </article>
    {/each}
  </div>
{/snippet}

{#snippet classPage(paper: boolean)}
  <ol class="steps">
    {#each GUIDE.forClass as step, i (i)}<li><span class="n" aria-hidden="true">{i + 1}</span><span>{step}</span></li>{/each}
  </ol>
  {#if !paper}
    <h4 class="label">{GUIDE.pickOne}</h4>
    <div class="pick">
      {#each SPREADS as spread (spread.id)}
        <button type="button" class="pick-card" onclick={() => pick(ENTRIES.findIndex((e) => e.id === spread.id), true)}>
          <span class="pick-art" aria-hidden="true"><Sketch id={`guide-pick-${spread.id}`} prims={DRAWINGS[spread.drawing]} seed={sketchSeed(spread)} color="var(--dad-ink)" /></span>
          <span class="pick-name">{spread.nickname}</span>
          <span class="chip {spread.world.toLowerCase()}">{spread.world}</span>
        </button>
      {/each}
    </div>
    <div class="print-card">
      <p>{GUIDE.printHint}</p>
      <button type="button" class="btn amber" onclick={print}><Icon name="book" size={20} /> {GUIDE.print}</button>
    </div>
  {/if}
{/snippet}

{#snippet sourcesPage()}
  <p class="lede">{GUIDE.sourcesLede}</p>
  <ol class="sources">
    {#each facts as f, i (f.id)}
      <li>
        <span class="n" aria-hidden="true">{i + 1}</span>
        <span>
          {text(f)}
          <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{f.sourceTitle}</a>
          {#if f.checkedOn}<span class="checked">({GUIDE.checked} {formatDate(f.checkedOn)})</span>{/if}
        </span>
      </li>
    {/each}
  </ol>
{/snippet}

<Panel title={GUIDE.title.split(": ")[1] ?? GUIDE.title} lede={GUIDE.gameLede} icon="book" size="xl" flush {onclose}>
  <div class="guide">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav class="drawer" aria-label={GUIDE.contents} bind:this={drawer} onkeydown={onDrawerKey}>
      {#each GROUPS as group (group.id)}
        <p class="group">{group.label}</p>
        {#each ENTRIES.filter((e) => e.group === group.id) as e (e.id)}
          {@const i = ENTRIES.indexOf(e)}
          <button type="button" class="tab" class:on={i === index} class:machine={!!e.spread} data-entry={e.id} aria-current={i === index ? "page" : undefined} onclick={() => pick(i)}>
            {#if e.spread}
              <span class="thumb" aria-hidden="true"><Sketch id={`guide-tab-${e.id}`} prims={DRAWINGS[e.spread.drawing]} seed={sketchSeed(e.spread)} color="var(--dad-ink)" /></span>
            {:else}
              <span class="dot" aria-hidden="true"></span>
            {/if}
            <span class="tab-name">{e.label}</span>
            {#if e.world && e.world !== "Home"}<span class="chip {e.world.toLowerCase()}">{e.world}</span>{/if}
          </button>
        {/each}
      {/each}
      <button type="button" class="print-tab" onclick={print}><Icon name="book" size={16} /> {GUIDE.printShort}</button>
    </nav>
    <div class="sheet-wrap">
      {#key entry.id}
        <article class="page" aria-label={entry.label} bind:this={page} tabindex="-1">
          <span class="tape" aria-hidden="true"></span>
          {#if !entry.spread}<h3 class="page-title">{entry.label}</h3>{/if}
          {#if entry.id === "story"}
            {@render storyPage(false)}
          {:else if entry.spread}
            {@render machinePage(entry.spread, false)}
          {:else if entry.id === "archive"}
            {@render archivePage()}
          {:else if entry.id === "class"}
            {@render classPage(false)}
          {:else}
            {@render sourcesPage()}
          {/if}
        </article>
      {/key}
    </div>
  </div>
</Panel>

{#if printing}
  <div class="print-copy" use:toBody>
    <h1>{GUIDE.title}</h1>
    <p class="lede">{GUIDE.gameLede}</p>
    <section><h2>{GUIDE.storyTitle}</h2>{@render storyPage(true)}</section>
    <section>
      <h2>{GUIDE.machinesTitle}</h2>
      {#each SPREADS as spread (spread.id)}<div class="print-machine">{@render machinePage(spread, true)}</div>{/each}
    </section>
    <section><h2>{GUIDE.archiveTitle}</h2>{@render archivePage()}</section>
    <section><h2>{GUIDE.forClassTitle}</h2>{@render classPage(true)}</section>
    <section><h2>{GUIDE.sourcesTitle}</h2>{@render sourcesPage()}</section>
  </div>
{/if}

<style>
  .guide {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: 22px;
    padding: 4px 26px 24px;
    min-height: 0;
    height: min(640px, calc(100dvh - 210px));
  }

  /* The drawer: paper tabs grouped under small labels, scrolling on short screens. */
  .drawer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 10px 6px 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(43, 38, 34, 0.25) transparent;
  }
  .group {
    margin: 8px 0 0;
    color: var(--ink-soft);
    font: 700 0.7rem/1.2 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .group:first-child {
    margin-top: 0;
  }
  .tab {
    flex: none;
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    padding: 4px 10px 4px 6px;
    background: #fbf6ec;
    border: 2px solid var(--line-strong);
    border-radius: 10px 12px 11px 9px;
    color: var(--ink);
    font: 700 0.95rem/1.15 var(--read);
    text-align: left;
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      border-color 0.15s,
      background 0.15s;
  }
  .tab:hover {
    transform: translateX(3px);
  }
  .tab.on {
    background: var(--amber-wash);
    border-color: var(--ink);
    box-shadow: 0 3px 0 var(--ink);
    transform: translateX(6px);
  }
  .thumb {
    display: grid;
    place-items: center;
    width: 40px;
    height: 32px;
    background: #fffdf7;
    border: 1.5px solid var(--line-strong);
    border-radius: 5px;
    overflow: hidden;
  }
  .thumb :global(svg) {
    width: 40px;
    height: 30px;
  }
  .thumb :global(path) {
    stroke-width: 5;
  }
  .dot {
    justify-self: center;
    width: 12px;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--amber);
  }
  .print-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    margin-top: 10px;
    border: 2px dashed var(--line-strong);
    border-radius: 10px;
    background: transparent;
    color: var(--ink-soft);
    font: 700 0.9rem var(--read);
    cursor: pointer;
  }
  .print-tab:hover {
    color: var(--ink);
    border-color: var(--ink);
  }
  .chip {
    padding: 2px 7px;
    border-radius: 999px;
    background: #dcdad4;
    color: #3e3a36;
    font: 700 0.66rem/1.3 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .chip.mars {
    background: #f1cbb4;
    color: #7a3a24;
  }
  .chip.space {
    background: #cfd8e8;
    color: #2d3f62;
  }

  /* The page: a big index card, ruled, with a strip of tape. Long pages scroll inside it. */
  .sheet-wrap {
    position: relative;
    min-height: 0;
    display: flex;
  }
  .page {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 28px 26px;
    background:
      var(--grain),
      repeating-linear-gradient(to bottom, transparent 0 29px, rgba(92, 115, 147, 0.13) 29px 30px),
      #fffdf7;
    border: 2px solid var(--ink);
    border-radius: 6px 8px 7px 9px;
    box-shadow:
      0 4px 0 var(--ink),
      0 24px 40px -24px rgba(14, 8, 4, 0.6);
    scrollbar-width: thin;
    scrollbar-color: rgba(43, 38, 34, 0.3) transparent;
    animation: page-in 0.35s var(--ease-spring);
  }
  .page:focus {
    outline: none;
  }
  /* A soft fade at the foot of a long page, so it reads as "there is more below". */
  .page::after {
    content: "";
    position: sticky;
    display: block;
    bottom: -26px;
    height: 34px;
    margin: 0 -28px -26px;
    background: linear-gradient(rgba(255, 253, 247, 0), #fffdf7 80%);
    pointer-events: none;
  }
  .tape {
    position: absolute;
    top: 8px;
    right: 26px;
    width: 92px;
    height: 22px;
    background: rgba(214, 196, 150, 0.6);
    rotate: 4deg;
  }
  .page-title {
    margin: 0 0 12px;
    font: 700 1.9rem/1.1 var(--hand);
    color: var(--ink);
  }
  .lede {
    margin: 0 0 16px;
    color: var(--ink-soft);
    font: 400 1.02rem/1.5 var(--read);
    max-width: 62ch;
  }
  .label {
    margin: 14px 0 6px;
    color: var(--amber-deep);
    font: 700 0.74rem/1.2 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  p {
    margin: 0 0 8px;
    font: 400 1rem/1.55 var(--read);
    color: var(--ink);
  }
  .src {
    margin-left: 2px;
    color: var(--sky);
    font: 700 0.76rem var(--read);
    text-decoration: underline 1.5px;
    text-underline-offset: 3px;
    white-space: nowrap;
  }
  .src:hover {
    color: var(--ink);
  }

  /* The story. */
  .story {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 28px;
    align-items: start;
  }
  .story-text p {
    font: 400 1.18rem/1.6 var(--hand);
  }
  .story-text p.first::first-letter {
    float: left;
    margin: 4px 8px 0 0;
    font: 700 3.2rem/0.8 var(--hand);
    color: var(--amber-deep);
  }
  .story-side {
    display: grid;
    gap: 18px;
  }
  .lamp {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 32 / 22;
  }
  .lamp .glow {
    position: absolute;
    inset: 4% 8% 18% 34%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 211, 138, 0.7), rgba(242, 165, 65, 0.15) 55%, transparent 72%);
  }
  .lamp :global(svg) {
    position: relative;
    width: 100%;
  }
  .sticky {
    padding: 14px 16px 10px;
    background: #fbe8a6;
    border-radius: 3px;
    box-shadow: 0 10px 18px -10px rgba(40, 24, 8, 0.5);
    rotate: 1.2deg;
  }
  .sticky h4 {
    margin: 0 0 6px;
    font: 700 1.1rem var(--hand);
  }
  .sticky p {
    font-size: 0.95rem;
  }

  /* A machine. */
  .m-top {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 24px;
    align-items: center;
  }
  .sketch-box {
    margin: 0;
    padding: 8px 10px 6px;
    background: #fffdf7;
    border: 2px solid var(--line-strong);
    border-radius: 8px;
    rotate: -0.8deg;
  }
  .sketch-box :global(svg) {
    display: block;
    width: 100%;
  }
  .sketch-box figcaption {
    color: var(--ink-soft);
    font: 400 0.8rem var(--hand);
    text-align: right;
  }
  .kicker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    color: var(--ink-soft);
    font: 700 0.8rem/1.3 var(--read);
  }
  .year {
    color: var(--ink);
  }
  .chapter::before {
    content: "";
    display: inline-block;
    width: 5px;
    height: 5px;
    margin: 0 8px 2px 0;
    border-radius: 50%;
    background: var(--amber);
  }
  h3 {
    margin: 0;
    font: 700 2.1rem/1.05 var(--hand);
    color: var(--ink);
  }
  .real {
    margin: 2px 0 12px;
    color: var(--ink-soft);
    font: 700 0.95rem var(--read);
  }
  .dad {
    margin: 0;
    padding: 10px 14px 8px;
    border-left: 4px solid var(--amber);
    background: rgba(252, 235, 208, 0.6);
    border-radius: 0 8px 8px 0;
  }
  .dad p {
    margin: 0;
    font: 400 1.12rem/1.45 var(--hand);
    color: var(--dad-ink);
  }
  .dad footer {
    margin-top: 2px;
    text-align: right;
    color: var(--dad-ink);
    font: 700 0.95rem var(--hand);
  }
  .m-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 26px;
    margin-top: 10px;
  }
  .where .label {
    margin: 0 6px 0 0;
  }
  .facts {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .facts li {
    position: relative;
    padding-left: 20px;
    font: 400 0.98rem/1.5 var(--read);
  }
  .facts li::before {
    content: "";
    position: absolute;
    left: 3px;
    top: 0.58em;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--amber-deep);
  }
  .facts.deeper li {
    font-size: 0.92rem;
  }
  .now {
    margin-top: 14px;
    padding: 4px 14px 8px;
    border: 2px solid var(--sage);
    border-radius: 10px;
    background: rgba(127, 163, 122, 0.1);
  }
  .now .label {
    color: var(--sage-deep);
  }
  .photos {
    display: flex;
    justify-content: center;
    gap: 26px;
    margin: 20px 0 4px;
  }
  .photos > :global(.photo) {
    width: min(100%, 300px);
  }
  .photos.two > :global(.photo) {
    width: min(46%, 280px);
  }

  /* Dad's archive, as small cards. */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .mini {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 14px;
    padding: 12px;
    background: #fffdf7;
    border: 2px solid var(--line-strong);
    border-radius: 10px;
  }
  .mini img {
    width: 110px;
    height: 110px;
    object-fit: cover;
    border: 2px solid var(--ink);
    border-radius: 6px;
  }
  .mini h4 {
    margin: 0 0 4px;
    font: 700 1.05rem/1.2 var(--read);
  }
  .mini .kicker {
    margin-bottom: 4px;
  }
  .small,
  .small li {
    font-size: 0.88rem;
  }
  .mini .facts {
    gap: 4px;
    margin-bottom: 6px;
  }
  .note {
    font: 400 1rem/1.4 var(--hand);
    color: var(--dad-ink);
  }
  .sign {
    font-weight: 700;
  }
  .credit {
    margin: 0;
    color: var(--ink-soft);
    font-size: 0.76rem;
  }

  /* In class. */
  .steps {
    display: grid;
    gap: 14px;
    margin: 4px 0 22px;
    padding: 0;
    list-style: none;
  }
  .steps li {
    display: grid;
    grid-template-columns: 46px 1fr;
    align-items: center;
    gap: 14px;
    font: 400 1.15rem/1.5 var(--read);
  }
  .steps .n,
  .sources .n {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: var(--amber-wash);
    font: 700 1.2rem var(--hand);
  }
  .pick {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    margin: 0 0 22px;
  }
  .pick-card {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 10px 8px 12px;
    background: #fffdf7;
    border: 2px solid var(--line-strong);
    border-radius: 10px;
    color: var(--ink);
    font: 700 0.92rem/1.2 var(--read);
    text-align: center;
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      border-color 0.15s;
  }
  .pick-card:hover,
  .pick-card:focus-visible {
    transform: translateY(-3px) rotate(-0.6deg);
    border-color: var(--ink);
  }
  .pick-art :global(svg) {
    width: 110px;
    height: 76px;
  }
  .pick-name {
    min-height: 2.4em;
    display: grid;
    place-items: center;
  }
  .print-card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 16px 18px;
    border: 2px dashed var(--line-strong);
    border-radius: 12px;
  }
  .print-card p {
    margin: 0;
    max-width: 44ch;
  }
  .print-card .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  /* Sources. */
  .sources {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sources li {
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 12px;
    align-items: start;
    font: 400 0.92rem/1.5 var(--read);
  }
  .sources .n {
    width: 30px;
    height: 30px;
    font-size: 0.95rem;
    border-width: 2px;
  }
  .sources a {
    color: var(--sky);
    font-weight: 700;
    text-decoration: underline 1.5px;
    text-underline-offset: 3px;
  }
  .checked {
    color: var(--ink-soft);
    font-size: 0.82rem;
    white-space: nowrap;
  }

  @keyframes page-in {
    from {
      opacity: 0;
      transform: translateY(10px) rotate(-0.4deg);
    }
  }
  :global(:root[data-motion="reduce"]) .page {
    animation: none;
  }
  @media (max-width: 860px) {
    .guide {
      grid-template-columns: 1fr;
      height: auto;
    }
    .drawer {
      flex-direction: row;
      overflow-x: auto;
      max-height: none;
    }
    .group {
      display: none;
    }
    .tab {
      flex: none;
    }
    .story,
    .m-top,
    .m-body,
    .cards {
      grid-template-columns: 1fr;
    }
  }

  /* Paper: only the print copy, in plain black and white, page after page. */
  .print-copy {
    display: none;
  }
  @media print {
    :global(body > *:not(.print-copy)) {
      display: none !important;
    }
    :global(html),
    :global(body) {
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    .print-copy {
      display: block;
      padding: 0 8mm;
      color: #000;
      font: 400 11pt/1.5 var(--read);
    }
    .print-copy h1 {
      font: 700 24pt var(--hand);
      margin: 0 0 4pt;
    }
    .print-copy h2 {
      font: 700 18pt var(--hand);
      margin: 18pt 0 8pt;
      break-after: avoid;
    }
    .print-copy section + section {
      break-before: page;
    }
    .print-machine {
      break-inside: avoid-page;
      padding: 10pt 0 14pt;
      border-bottom: 1px solid #999;
    }
    .print-copy .story,
    .print-copy .m-top,
    .print-copy .m-body {
      display: block;
    }
    .print-copy .sketch-box {
      width: 60mm;
      float: right;
      margin: 0 0 6pt 10pt;
      rotate: 0deg;
    }
    .print-copy .lamp,
    .print-copy .src {
      display: none;
    }
    .print-copy .cards {
      display: block;
    }
    .print-copy .mini {
      break-inside: avoid;
      margin-bottom: 8pt;
    }
    .print-copy .photos {
      justify-content: flex-start;
    }
    .print-copy .photos > :global(.photo) {
      width: 55mm;
    }
  }
</style>
