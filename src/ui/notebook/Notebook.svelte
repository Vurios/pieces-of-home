<script lang="ts">
  import { audio } from "../../audio/audio";
  import { COVER, SPREADS, factText, isComplete, spreadYear } from "../../content/notebook";
  import type { GameState } from "../../game/core/state";
  import { DRAWINGS } from "../drawing/machines";
  import Sketch from "../drawing/Sketch.svelte";
  import { gamepadNav, trap } from "../focus";
  import Icon from "../Icon.svelte";
  import { settings, t } from "../settings.svelte";
  import Polaroid from "./Polaroid.svelte";
  import Underline from "./Underline.svelte";

  /**
   * Dad's notebook: a two-page spread over the dimmed world. The first spread
   * is the dedication and contents; each one after is a machine. A page is
   * a pencil sketch until its chapter is done, then it is inked in.
   */
  interface Props {
    game: Readonly<GameState>;
    page: number;
    onclose: () => void;
    onpage: (page: number) => void;
  }
  let { game, page, onclose, onpage }: Props = $props();

  const total = SPREADS.length + 1;
  let shown = $state(0);
  let turning = $state<"next" | "prev" | null>(null);
  let reading = $state(false);
  let book: HTMLElement | null = $state(null);
  let dragX: number | null = null;

  $effect(() => {
    shown = Math.max(0, Math.min(total - 1, page));
  });

  const spread = $derived(shown === 0 ? null : SPREADS[shown - 1]!);
  const inked = $derived(spread ? settings.value.exploreFreely || isComplete(spread, game) : true);
  const pageLabel = $derived(t("notebook.page", { a: shown * 2 + 1, b: shown * 2 + 2, n: total * 2 }));

  function turn(dir: 1 | -1): void {
    const next = shown + dir;
    if (next < 0 || next >= total || turning) return;
    stopReading();
    audio.ui("page");
    if (settings.reducedMotion) {
      shown = next;
      onpage(next);
      return;
    }
    turning = dir > 0 ? "next" : "prev";
    // Swap the words at the middle of the turn, when the leaf covers them.
    window.setTimeout(() => {
      shown = next;
      onpage(next);
    }, 260);
    window.setTimeout(() => (turning = null), 540);
  }

  function goTo(index: number): void {
    if (index === shown) return;
    audio.ui("page");
    shown = index;
    onpage(index);
  }

  function onkey(event: KeyboardEvent): void {
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      turn(1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      turn(-1);
    } else if (event.key === "Escape" || (event.code === "KeyN" && !(event.target instanceof HTMLInputElement))) {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }

  function down(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest("a, button")) return;
    dragX = event.clientX;
  }

  function up(event: PointerEvent): void {
    if (dragX === null) return;
    const dx = event.clientX - dragX;
    dragX = null;
    if (dx < -70) turn(1);
    else if (dx > 70) turn(-1);
  }

  function pageText(): string {
    if (!spread) return `${COVER.title}. ${COVER.dedication} ${COVER.signature}.`;
    const parts = [spread.nickname, spread.name, `${t("notebook.forWhat")}. ${spread.forWhat}`];
    if (inked) {
      if (spread.learned.length) parts.push(`${t("notebook.learned")}. ${spread.learned.map((f) => factText(f)).join(" ")}`);
      if (spread.thenNow.length) parts.push(`${t("notebook.thenNow")}. ${spread.thenNow.map((f) => factText(f)).join(" ")}`);
    }
    parts.push(`${t("notebook.dad")}. ${spread.dadNote}`);
    return parts.join(". ");
  }

  function readAloud(): void {
    if (!("speechSynthesis" in window)) return;
    if (reading) {
      stopReading();
      return;
    }
    const u = new SpeechSynthesisUtterance(pageText());
    u.rate = 0.95;
    u.lang = settings.value.language === "fil" ? "fil-PH" : "en-US";
    u.onend = () => (reading = false);
    reading = true;
    window.speechSynthesis.speak(u);
  }

  function stopReading(): void {
    if (reading && "speechSynthesis" in window) window.speechSynthesis.cancel();
    reading = false;
  }

  $effect(() => {
    const stop = gamepadNav(() => book, onclose, (dir) => turn(dir));
    return () => {
      stop();
      stopReading();
    };
  });
</script>

<div class="notebook" role="dialog" aria-modal="true" aria-labelledby="nb-title" tabindex="-1" use:trap={{ initial: ".nav.next" }} onkeydown={onkey} bind:this={book}>
  <h1 id="nb-title" class="sr-only">{t("notebook.label")}</h1>
  <p class="sr-only" aria-live="polite">{pageLabel}</p>

  <div class="spread" class:turn-next={turning === "next"} class:turn-prev={turning === "prev"} onpointerdown={down} onpointerup={up} role="presentation">
    <span class="rings" aria-hidden="true"></span>
    <span class="leaf" aria-hidden="true"></span>

    {#if !spread}
      <!-- Cover: Dad's dedication, and the contents. -->
      <article class="page left cover">
        <h2 class="hand big">{COVER.title}</h2>
        <Underline width={220} seed={3} />
        <div class="lamp-sketch"><Sketch id="cover-lamp" prims={DRAWINGS.lamp} seed={11} /></div>
        <p class="dedication hand">{COVER.dedication}</p>
        <p class="signature hand">{COVER.signature}</p>
      </article>
      <article class="page right">
        <h2 class="hand">{COVER.contentsTitle}</h2>
        <Underline width={240} seed={8} />
        <ol class="contents">
          {#each SPREADS as s, i (s.id)}
            {@const done = isComplete(s, game)}
            <li>
              <button type="button" onclick={() => goTo(i + 1)}>
                <span class="tick" class:done aria-hidden="true"></span>
                <span class="nick hand">{s.nickname}</span>
                <span class="tag">{s.world}</span>
                <span class="sr-only">{done ? "Done" : ""}</span>
              </button>
            </li>
          {/each}
        </ol>
        <h3 class="hand">{COVER.memoriesTitle}</h3>
        <div class="memories">
          {#each [0, 1, 2] as i (i)}<span class="envelope" aria-hidden="true"></span>{/each}
          <p>{COVER.memoriesEmpty}</p>
        </div>
      </article>
    {:else}
      {@const year = spreadYear(spread)}
      <article class="page left">
        <header class="title">
          <span class="tag">{spread.world}{year ? ` · ${year}` : ""}</span>
          <h2 class="hand">{spread.nickname}</h2>
          <Underline width={200} seed={shown * 5} color={inked ? "var(--amber)" : "rgba(140,129,115,0.5)"} />
          <p class="real">{spread.name}</p>
        </header>
        <div class="drawing">
          <Sketch id={`draw-${spread.id}`} prims={DRAWINGS[spread.drawing]} seed={20 + shown} pencil={!inked} label={`Dad's sketch of ${spread.name}`} />
          <span class="model tag">{t("notebook.model")}</span>
        </div>
        <section>
          <h3>{spread.world === "Home" ? t("notebook.forWhatHome") : t("notebook.forWhat")}</h3>
          <p>{spread.forWhat}</p>
        </section>
        <aside class="dad">
          <h3 class="sr-only">{t("notebook.dad")}</h3>
          <p class="hand">{spread.dadNote}</p>
        </aside>
      </article>
      <article class="page right" class:pencil={!inked}>
        {#if inked}
          {#if spread.images.length > 0}
            <div class="photos" class:two={spread.images.length > 1}>
              {#each spread.images as image, i (image.id)}
                <Polaroid {image} tilt={i % 2 ? 2.4 : -2.2} />
              {/each}
            </div>
          {/if}
          {#if spread.place}
            <p class="place"><span class="tag">{spread.world}</span> {spread.place.kid}</p>
          {/if}
          {#if spread.learned.length}
            <section>
              <h3>{t("notebook.learned")}</h3>
              <ul class="facts">
                {#each spread.learned as f (f.id)}
                  <li>{factText(f)} <a class="src" href={f.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t("notebook.source")}: ${f.sourceTitle}`}>{t("notebook.source")}</a></li>
                {/each}
              </ul>
            </section>
          {/if}
          {#if spread.thenNow.length}
            <section class="then-now">
              <h3>{t("notebook.thenNow")}</h3>
              {#each spread.thenNow as f (f.id)}<p>{factText(f)}</p>{/each}
            </section>
          {/if}
          {#if spread.deeper.length}
            <details class="deeper">
              <summary>{t("notebook.deeper")}</summary>
              {#each spread.deeper as f (f.id)}
                <p>{f.kid}{f.deeper ? ` ${f.deeper}` : ""} <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{f.sourceTitle}</a></p>
              {/each}
            </details>
          {/if}
          {#if spread.id === "lamp"}
            <p class="stamp-mark" aria-label="Stamp: Left on. Still shining.">LEFT ON.<br />STILL SHINING.</p>
            <section class="letters">
              <h3>{t("notebook.letters")}</h3>
              <p class="help">{t("notebook.lettersHelp")}</p>
              <ul>
                {#each SPREADS.filter((x) => x.id !== "lamp") as s, i (s.id)}
                  {@const done = isComplete(s, game)}
                  <li class="letter" class:done style:--tilt={`${[-2, 1.5, -1, 2.2, -1.6][i % 5]}deg`}>
                    <span class="flap" aria-hidden="true"></span>
                    <span class="to hand">{s.letterTo}</span>
                    <span class="tag">{s.world}</span>
                    {#if done}<span class="posted">{t("notebook.delivered")}</span>{/if}
                  </li>
                {/each}
              </ul>
            </section>
          {/if}
        {:else}
          <p class="pencil-note hand">{t("notebook.pencil")}</p>
          <div class="ghosts" aria-hidden="true">
            {#each spread.images as image (image.id)}<span class="ghost"></span>{/each}
          </div>
        {/if}
      </article>
    {/if}
  </div>

  <div class="bar">
    <button type="button" class="nav prev" onclick={() => turn(-1)} disabled={shown === 0} aria-label={t("notebook.prev")}><Icon name="left" size={30} /></button>
    <span class="clip" aria-hidden="true">{shown + 1} / {total}</span>
    {#if settings.value.readAloud}
      <button type="button" class="btn quiet read" onclick={readAloud}><Icon name="speaker" size={22} /> {reading ? t("notebook.stopReading") : t("notebook.readAloud")}</button>
    {/if}
    <button type="button" class="nav next" onclick={() => turn(1)} disabled={shown === total - 1} aria-label={t("notebook.next")}><Icon name="right" size={30} /></button>
    <button type="button" class="nav close" onclick={onclose} aria-label={t("notebook.close")}><Icon name="close" size={26} /></button>
  </div>
</div>

<style>
  .notebook {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: 1fr auto;
    justify-items: center;
    align-items: center;
    padding: max(20px, 4vh) 16px 16px;
    pointer-events: auto;
    background: rgba(20, 14, 26, 0.25);
    animation: lift 0.45s var(--ease-spring);
  }
  .spread {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: min(1180px, 100%);
    height: min(740px, calc(100vh - 140px));
    perspective: 2200px;
    touch-action: pan-y;
    filter: drop-shadow(0 26px 30px rgba(10, 6, 14, 0.5));
  }
  .page {
    position: relative;
    overflow-y: auto;
    padding: 34px 38px 30px;
    background-color: var(--paper-light);
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 20px 20px;
    color: var(--ink);
    line-height: 1.5;
  }
  .page.left {
    border-radius: 10px 2px 2px 10px;
    box-shadow: inset -26px 0 30px -24px rgba(60, 40, 20, 0.45);
  }
  .page.right {
    border-radius: 2px 10px 10px 2px;
    box-shadow: inset 26px 0 30px -24px rgba(60, 40, 20, 0.45);
  }
  /* The wire binding down the middle. */
  .rings {
    position: absolute;
    left: 50%;
    top: 22px;
    bottom: 22px;
    width: 26px;
    margin-left: -13px;
    z-index: 3;
    pointer-events: none;
    background: radial-gradient(ellipse 11px 6px at 50% 50%, transparent 55%, #7d756b 60%, #b9b2a6 72%, transparent 76%) 0 0 / 26px 34px repeat-y;
  }
  /* A blank leaf that sweeps over the spread while the words change. */
  .leaf {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    z-index: 4;
    pointer-events: none;
    background: var(--paper-light);
    backface-visibility: hidden;
    opacity: 0;
  }
  .turn-next .leaf {
    left: 50%;
    transform-origin: left center;
    animation: leaf-next 0.54s cubic-bezier(0.45, 0.05, 0.3, 1);
  }
  .turn-prev .leaf {
    left: 0;
    transform-origin: right center;
    animation: leaf-prev 0.54s cubic-bezier(0.45, 0.05, 0.3, 1);
  }
  @keyframes leaf-next {
    0% { opacity: 1; transform: rotateY(0deg); filter: brightness(1); }
    50% { filter: brightness(0.8); }
    100% { opacity: 1; transform: rotateY(-180deg); filter: brightness(1); }
  }
  @keyframes leaf-prev {
    0% { opacity: 1; transform: rotateY(0deg); }
    100% { opacity: 1; transform: rotateY(180deg); }
  }
  @keyframes lift {
    from { transform: translateY(40px) rotate(1deg); opacity: 0; }
  }
  .hand {
    font-family: var(--hand);
  }
  h2 {
    margin: 0;
    font: 700 2rem/1.1 var(--hand);
  }
  h2.big {
    font-size: 2.6rem;
  }
  h3 {
    margin: 16px 0 4px;
    font: 700 0.8rem/1 var(--label);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .page :global(h3.hand) {
    font: 700 1.4rem/1.1 var(--hand);
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink);
    margin-top: 24px;
  }
  p {
    margin: 0 0 8px;
  }
  .title .tag {
    margin-bottom: 8px;
  }
  .real {
    margin-top: 4px;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
  .drawing {
    position: relative;
    margin: 12px auto 0;
    max-width: 380px;
  }
  .model {
    position: absolute;
    right: 0;
    bottom: -6px;
    transform: rotate(-3deg);
  }
  .dad {
    margin-top: 18px;
    padding: 10px 14px 6px;
    background: rgba(242, 165, 65, 0.16);
    border-left: 3px solid var(--amber);
    transform: rotate(-0.7deg);
  }
  .dad p {
    font-size: 1.25rem;
    line-height: 1.35;
  }
  .cover {
    text-align: center;
    display: grid;
    justify-items: center;
    align-content: center;
  }
  .lamp-sketch {
    width: min(300px, 80%);
    margin: 16px 0;
  }
  .dedication {
    font-size: 1.45rem;
    line-height: 1.35;
    max-width: 18em;
  }
  .signature {
    font-size: 1.6rem;
    font-weight: 700;
    align-self: end;
    justify-self: end;
    margin-right: 12%;
    transform: rotate(-4deg);
  }
  .contents {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .contents button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 4px 8px;
    background: none;
    border: 0;
    border-bottom: 1.5px dashed rgba(43, 38, 34, 0.2);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .contents button:hover {
    background: rgba(242, 165, 65, 0.15);
  }
  .nick {
    flex: 1;
    font-size: 1.25rem;
    font-weight: 700;
  }
  .tick {
    width: 22px;
    height: 22px;
    flex: none;
    border: 2px solid var(--ink-soft);
    border-radius: 4px 6px 5px 4px;
    position: relative;
  }
  .tick.done::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 1px;
    width: 8px;
    height: 13px;
    border-right: 3px solid var(--clay);
    border-bottom: 3px solid var(--clay);
    transform: rotate(40deg);
  }
  .memories {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .memories p {
    flex-basis: 100%;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
  .envelope {
    width: 62px;
    height: 42px;
    border: 2px dashed rgba(140, 129, 115, 0.7);
    border-radius: 3px;
    background: linear-gradient(155deg, transparent 49%, rgba(140, 129, 115, 0.5) 50%, transparent 52%), linear-gradient(25deg, transparent 49%, rgba(140, 129, 115, 0.5) 50%, transparent 52%);
    background-size: 50% 60%;
    background-position: 0 0, 100% 0;
    background-repeat: no-repeat;
  }
  .photos {
    display: grid;
    gap: 18px;
    margin: 6px 0 14px;
  }
  .photos.two {
    grid-template-columns: 1fr 1fr;
  }
  .place {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 0.95rem;
    color: var(--ink-soft);
  }
  .facts {
    margin: 0;
    padding-left: 1.2em;
  }
  .facts li {
    margin-bottom: 6px;
  }
  .facts li::marker {
    color: var(--clay);
  }
  .src {
    font: 700 0.72rem var(--label);
    color: var(--ink-soft);
    text-decoration-color: var(--amber);
    text-underline-offset: 2px;
    margin-left: 4px;
    padding: 6px 0;
  }
  .then-now p {
    font-weight: 600;
  }
  .deeper {
    margin-top: 14px;
    padding: 8px 12px;
    background: rgba(92, 115, 147, 0.08);
    border: 1.5px dashed rgba(92, 115, 147, 0.5);
    border-radius: 6px;
  }
  .deeper summary {
    min-height: 40px;
    display: flex;
    align-items: center;
    font: 700 1.05rem var(--hand);
    cursor: pointer;
  }
  .deeper a {
    color: var(--ink);
    font-size: 0.9rem;
  }
  .stamp-mark {
    margin: 24px auto 0;
    width: max-content;
    padding: 10px 18px 8px;
    border: 4px solid #a83a28;
    outline: 2px solid #a83a28;
    outline-offset: 4px;
    color: #a83a28;
    font: 700 1.6rem/1 var(--label);
    letter-spacing: 0.05em;
    text-align: center;
    transform: rotate(-6deg);
    opacity: 0.9;
  }
  .letters {
    margin-top: 34px;
  }
  .letters .help {
    margin: 0 0 12px;
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  .letters ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
    gap: 12px;
  }
  .letter {
    position: relative;
    display: grid;
    gap: 6px;
    justify-items: start;
    padding: 22px 12px 10px;
    background: #f6ead2;
    border: 1.5px solid var(--paper-edge);
    border-radius: 3px;
    box-shadow: 0 4px 8px -5px rgba(30, 20, 10, 0.45);
    transform: rotate(var(--tilt));
    overflow: hidden;
  }
  /* The envelope flap: a soft V across the top. */
  .flap {
    position: absolute;
    inset: 0 0 auto;
    height: 22px;
    background: linear-gradient(to bottom right, transparent 48%, var(--paper-edge) 49%, transparent 54%) left / 50% 100% no-repeat,
      linear-gradient(to bottom left, transparent 48%, var(--paper-edge) 49%, transparent 54%) right / 50% 100% no-repeat;
  }
  .to {
    font-size: 1.12rem;
    line-height: 1.2;
  }
  .letter.done {
    background: #efe6d6;
  }
  .letter.done .to {
    color: var(--ink-soft);
  }
  .posted {
    position: absolute;
    right: 8px;
    bottom: 8px;
    padding: 2px 6px;
    border: 2px solid #a83a28;
    border-radius: 4px;
    color: #a83a28;
    font: 700 0.7rem/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transform: rotate(-8deg);
  }
  .pencil-note {
    margin-top: 30%;
    text-align: center;
    font-size: 1.35rem;
    color: var(--pencil);
  }
  .ghosts {
    display: flex;
    justify-content: center;
    gap: 22px;
    margin-top: 26px;
  }
  .ghost {
    width: 150px;
    height: 130px;
    border: 2px dashed rgba(140, 129, 115, 0.55);
    transform: rotate(-3deg);
  }
  .ghost:nth-child(2) {
    transform: rotate(3deg);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 12px;
  }
  .nav {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    color: var(--ink);
    background: var(--paper-light);
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    box-shadow: 2px 3px 0 var(--ink);
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring);
  }
  .nav:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .nav:active:not(:disabled) {
    transform: translateY(2px);
  }
  .nav:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .clip {
    font: 700 1rem var(--label);
    color: var(--paper-light);
    background: #6f6a63;
    padding: 6px 12px;
    border-radius: 14px;
  }
  .read {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--paper-light);
    border-color: var(--paper-light);
  }
  :global(:root[data-motion="reduce"]) .notebook,
  :global(:root[data-motion="reduce"]) .leaf {
    animation: none;
  }
  @media (max-width: 820px) {
    .spread {
      grid-template-columns: 1fr;
      height: auto;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    }
    .page.left,
    .page.right {
      border-radius: 8px;
      box-shadow: none;
      overflow: visible;
    }
    .rings {
      display: none;
    }
    .leaf {
      width: 100%;
      left: 0 !important;
    }
  }
</style>
