<script lang="ts">
  import { audio } from "../../audio/audio";
  import { COVER, SPREADS, factText, isComplete, spreadYear, type MachineSpread } from "../../content/notebook";
  import { readPhotos } from "../photos";
  import { readLastPage } from "../story/last-page";
  import { logNoteText, readLogNote } from "../story/log-note";
  import { CHAPTERS } from "../../content/chapters";
  import type { GameState } from "../../game/core/state";
  import { DRAWINGS } from "../drawing/machines";
  import Sketch from "../drawing/Sketch.svelte";
  import { gamepadNav, trap } from "../focus";
  import Icon from "../Icon.svelte";
  import { settings, t } from "../settings.svelte";
  import Envelope from "./Envelope.svelte";
  import InkStamp from "./InkStamp.svelte";
  import MissionPatch, { type PatchId } from "./MissionPatch.svelte";
  import Polaroid from "./Polaroid.svelte";
  import Underline from "./Underline.svelte";

  /**
   * Dad's notebook: a cloth-bound hardcover lying open over the dimmed world.
   * The first spread is the dedication and contents; each one after is a
   * machine. A page stays in pencil, with Dad's sealed letter clipped to it,
   * until its chapter is done. Then it is inked in.
   *
   * Turning a page is a real leaf: its front shows the page you are leaving
   * and its back shows the page you are turning to, so nothing pops.
   *
   * Each machine has two spreads, the way a real notebook would: first the
   * drawing, the photos and what we learned; then Then and Now, the stamp
   * and Dad's deeper notes. Pages never scroll. If a page is a little too
   * full on a short screen, its writing shrinks a touch to fit.
   */
  interface Props {
    game: Readonly<GameState>;
    page: number;
    onclose: () => void;
    onpage: (page: number) => void;
  }
  let { game, page, onclose, onpage }: Props = $props();

  // The cover, two spreads per machine, and the last page (Finale).
  const PER = 2;
  const LAST = SPREADS.length * PER + 1;
  const total = LAST + 1;
  /** The machine and which of its two spreads a page index shows, or null for the cover and the last page. */
  function machineAt(index: number): { spread: MachineSpread; part: number; at: number } | null {
    if (index <= 0 || index >= LAST) return null;
    const at = Math.floor((index - 1) / PER);
    return { spread: SPREADS[at]!, part: (index - 1) % PER, at };
  }
  const logNote = readLogNote();
  const POSTS: Record<MachineSpread["world"], string> = { Home: "HOME POST", Moon: "MOON POST", Mars: "MARS POST", Space: "DEEP SPACE POST" };
  /** The stamp that closes a machine's chapter. */
  function stampFor(spread: MachineSpread): [string, string] | null {
    if (spread.id === "lamp") return ["Left on.", "Still shining."];
    if (spread.id === "voyager") return ["Not left behind.", "Still sending."];
    return CHAPTERS.find((c) => c.spread === spread.id)?.stamp ?? null;
  }

  /** Shrinks a page's writing a little when it would not fit, so no page ever scrolls. */
  function fit(node: HTMLElement): { destroy(): void } {
    const inner = node.firstElementChild as HTMLElement | null;
    const apply = (): void => {
      if (!inner) return;
      inner.style.zoom = "1";
      const style = getComputedStyle(node);
      const room = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const need = inner.scrollHeight;
      if (room > 0 && need > room) inner.style.zoom = String(Math.max(0.72, (room / need) * 0.99));
    };
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    if (inner) observer.observe(inner);
    // Pictures and fonts can change the height once they load.
    node.addEventListener("load", apply, true);
    void document.fonts?.ready.then(apply);
    apply();
    return {
      destroy() {
        observer.disconnect();
        node.removeEventListener("load", apply, true);
      },
    };
  }
  const lastPage = readLastPage();
  const groupPhoto = lastPage?.photoAt ? (readPhotos().find((p) => p.at === lastPage.photoAt)?.data ?? null) : null;
  const finished = $derived(game.stamps.includes("finale"));
  const lastSticker = lastPage?.sticker ? (SPREADS.find((x) => x.id === lastPage.sticker)?.nickname ?? null) : null;
  const lastName = lastPage?.first && lastPage.second ? `${lastPage.first} ${lastPage.second}` : null;
  const FLIP_MS = 760;
  const OPEN_MS = 1150;
  const narrowQuery = typeof window !== "undefined" ? window.matchMedia("(max-width: 820px)") : null;

  let shown = $state(0);
  let flip = $state<{ from: number; to: number; dir: 1 | -1 } | null>(null);
  let slide = $state<1 | -1 | null>(null);
  let opening = $state(!settings.reducedMotion && !narrowQuery?.matches);
  let reading = $state(false);
  let book: HTMLElement | null = $state(null);
  let dragX: number | null = null;

  $effect(() => {
    shown = Math.max(0, Math.min(total - 1, page));
  });

  $effect(() => {
    if (!opening) return;
    const id = window.setTimeout(() => (opening = false), OPEN_MS);
    return () => window.clearTimeout(id);
  });

  // While a leaf turns, the page under each half is whichever one it reveals.
  const leftIndex = $derived(flip ? (flip.dir > 0 ? flip.from : flip.to) : shown);
  const rightIndex = $derived(flip ? (flip.dir > 0 ? flip.to : flip.from) : shown);
  const pageLabel = $derived(t("notebook.page", { a: shown * 2 + 1, b: shown * 2 + 2, n: total * 2 }));
  const current = $derived(machineAt(shown)?.spread ?? null);
  const currentPart = $derived(machineAt(shown)?.part ?? 0);
  const currentInked = $derived(current ? inkedFor(current) : true);

  function inkedFor(spread: MachineSpread): boolean {
    return settings.value.exploreFreely || isComplete(spread, game);
  }

  /** Extra classes for a page, so a copy on a turning leaf looks exactly like the real one. */
  function kind(index: number): string {
    if (index === 0) return "cover";
    if (index === LAST) return finished ? "" : "pencil-page";
    return inkedFor(machineAt(index)!.spread) ? "" : "pencil-page";
  }

  function show(next: number, dir: 1 | -1): void {
    stopReading();
    audio.ui("page");
    if (settings.reducedMotion) {
      shown = next;
      onpage(next);
      return;
    }
    if (narrowQuery?.matches) {
      slide = dir;
      shown = next;
      onpage(next);
      window.setTimeout(() => (slide = null), 380);
      return;
    }
    flip = { from: shown, to: next, dir };
    shown = next;
    onpage(next);
    window.setTimeout(() => (flip = null), FLIP_MS);
  }

  function turn(dir: 1 | -1): void {
    const next = shown + dir;
    if (next < 0 || next >= total || flip) return;
    // No waiting for the cover: a turn while it opens just lands it open.
    opening = false;
    show(next, dir);
  }

  function goTo(index: number): void {
    if (index === shown || flip) return;
    opening = false;
    show(index, index > shown ? 1 : -1);
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
    if ((event.target as HTMLElement).closest("a, button, summary")) return;
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
    if (shown === LAST) return finished ? `What will you discover next? ${lastName ?? ""} Leave the light on for whoever comes next.` : "The last page is still blank.";
    if (!current) return `${COVER.title}. ${COVER.dedication} ${COVER.signature}.`;
    if (currentPart === 1) {
      const more: string[] = [current.nickname];
      if (currentInked) {
        if (current.thenNow.length) more.push(`${t("notebook.thenNow")}. ${current.thenNow.map((f) => factText(f)).join(" ")}`);
        if (current.deeper.length) more.push(`${t("notebook.deeper")}. ${current.deeper.map((f) => f.kid).join(" ")}`);
      }
      return more.join(". ");
    }
    const parts = [current.nickname, current.name, `${t("notebook.forWhat")}. ${current.forWhat}`];
    if (currentInked && current.learned.length) parts.push(`${t("notebook.learned")}. ${current.learned.map((f) => factText(f)).join(" ")}`);
    parts.push(`${t("notebook.dad")}. ${current.dadNote}`);
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

  const TILTS = [-2.4, 1.8, -1.2, 2.6, -1.8];
  const TAPES = ["amber", "sage", "sky"] as const;
</script>

{#snippet coverLeft()}
  <!-- Dad's own patch for the notebook, sewn on the first page, with the title on a paper ribbon. -->
  <div class="emblem">
    <span class="emblem-tape" aria-hidden="true"></span>
    <MissionPatch id="notebook" size={208} tilt={-4} />
    <h2 class="plate-title">
      <svg class="ribbon" viewBox="0 0 320 64" preserveAspectRatio="none" aria-hidden="true">
        <path class="tail" d="M4 22 L 40 22 L 40 58 L 4 58 L 16 40 Z" />
        <path class="tail" d="M316 22 L 280 22 L 280 58 L 316 58 L 304 40 Z" />
        <path class="fold" d="M40 50 L 52 58 L 52 50 Z M280 50 L 268 58 L 268 50 Z" />
        <path class="band" d="M30 8 C 110 2, 210 2, 290 8 L 290 50 C 210 44, 110 44, 30 50 Z" />
      </svg>
      <span>{COVER.title}</span>
    </h2>
  </div>
  <p class="dedication">{COVER.dedication}</p>
  <p class="signature">{COVER.signature}</p>
  <svg class="cover-doodle" viewBox="0 0 330 92" aria-hidden="true">
    <g class="ink">
      <path class="dash" d="M52 52 C 86 10, 140 6, 170 22" />
      <path class="dash" d="M190 34 C 222 74, 260 78, 286 62" />
      <circle cx="34" cy="62" r="22" class="paper" />
      <path d="M14 68 C 26 62, 42 64, 56 58" />
      <path d="M28 54 L 28 44 L 34 38 L 40 44 L 40 54 Z" class="paper" />
      <circle cx="180" cy="26" r="14" class="paper" />
      <path d="M174 17 C 183 21, 183 32, 174 35" />
      <circle cx="304" cy="60" r="17" class="mars" />
      <path d="M292 56 C 300 52, 308 59, 316 54" />
      <g transform="translate(108 18) rotate(-16)"><rect x="-10" y="-7" width="20" height="14" rx="1.5" class="paper" /><path d="M-10 -7 L 0 1 L 10 -7" /></g>
      <g transform="translate(240 70) rotate(12)"><rect x="-10" y="-7" width="20" height="14" rx="1.5" class="paper" /><path d="M-10 -7 L 0 1 L 10 -7" /></g>
      <path d="M126 70 l 0 -8 M122 66 l 8 0 M250 14 l 0 -8 M246 10 l 8 0" />
    </g>
  </svg>
{/snippet}

{#snippet coverRight()}
  <h2 class="toc-title">{COVER.contentsTitle}</h2>
  <p class="log">{t("notebook.log")}</p>
  <ol class="toc">
    {#each SPREADS as s, i (s.id)}
      {@const done = isComplete(s, game)}
      <li>
        <button type="button" onclick={() => goTo(i * PER + 1)}>
          <span class="patch-slot" aria-hidden="true"><MissionPatch id={s.id as PatchId} earned={done} size={40} tilt={[-6, 4, -3, 5, -4, 3][i]} /></span>
          <span class="nick">{s.nickname}</span>
          <span class="dots" aria-hidden="true"></span>
          <span class={`world w-${s.world.toLowerCase()}`}>{s.world}</span>
          <span class="pg" aria-hidden="true">{(i * PER + 1) * 2 + 1}</span>
          <span class="sr-only">{done ? "Done" : ""}</span>
        </button>
      </li>
    {/each}
  </ol>
  <h3 class="memories-title">{COVER.memoriesTitle}</h3>
  <div class="memories">
    {#each [0, 1, 2] as i (i)}<div class="mem" aria-hidden="true"><Envelope empty tilt={[-3, 2, -1][i]} /></div>{/each}
  </div>
  <p class="memories-note">{COVER.memoriesEmpty}</p>
{/snippet}

{#snippet machineLeft(spread: MachineSpread, index: number)}
  {@const inked = inkedFor(spread)}
  {@const year = spreadYear(spread)}
  <header class="head">
    <p class="kicker"><span>{spread.world}</span>{#if year}<span class="sep" aria-hidden="true"></span><span>{year}</span>{/if}</p>
    <h2 class="nick-title" class:pencil={!inked}>{spread.nickname}</h2>
    <Underline width={210} seed={index * 5} color={inked ? "var(--amber)" : "rgba(140,129,115,0.45)"} />
    <p class="real">{spread.name}</p>
  </header>
  <figure class="drawing">
    <Sketch id={`draw-${spread.id}`} prims={DRAWINGS[spread.drawing]} seed={20 + index} pencil={!inked} color="var(--dad-ink)" label={`Dad's sketch of ${spread.name}`} />
    <figcaption>{t("notebook.model")}</figcaption>
  </figure>
  <section class="for">
    <h3 class="label">{spread.world === "Home" ? t("notebook.forWhatHome") : t("notebook.forWhat")}</h3>
    <p>{spread.forWhat}</p>
  </section>
  <aside class="note">
    <span class="note-tape" aria-hidden="true"></span>
    <h3 class="sr-only">{t("notebook.dad")}</h3>
    <p>{spread.dadNote}</p>
    <p class="note-sig">{COVER.signature}</p>
  </aside>
{/snippet}

{#snippet machineRight(spread: MachineSpread, index: number)}
  {#if inkedFor(spread)}
    {#if spread.images.length > 0}
      <div class="photos" class:two={spread.images.length > 1}>
        {#each spread.images as image, i (image.id)}
          <Polaroid {image} tilt={i % 2 ? 2.2 : -1.8} tape={TAPES[(index + i) % 3]} strips={spread.images.length > 1 ? "middle" : "corners"} />
        {/each}
      </div>
    {/if}
    {#if spread.place}
      <p class="place"><Icon name="pin" size={18} /> <span>{spread.place.kid}</span></p>
    {/if}
    {#if spread.learned.length}
      <section class="learned">
        <h3 class="label">{t("notebook.learned")}</h3>
        <ul class="facts">
          {#each spread.learned as f (f.id)}
            <li>{factText(f)} <a class="src" href={f.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t("notebook.source")}: ${f.sourceTitle}`}>{t("notebook.source")}</a></li>
          {/each}
        </ul>
      </section>
    {/if}
  {:else}
    <div class="pending">
      {#if spread.images.length > 0}
        <div class="corners" class:two={spread.images.length > 1} aria-hidden="true">
          {#each spread.images as image (image.id)}<span class="slot"><i></i><i></i><i></i><i></i></span>{/each}
        </div>
      {/if}
      <div class="waiting">
        <div class="clipped">
          <span class="clip-wire" aria-hidden="true"></span>
          <Envelope to={spread.letterTo} world={spread.world} tilt={-3} />
        </div>
        <p class="pencil-note">{t("notebook.pencil")}</p>
      </div>
      <h3 class="label ghost-label">{t("notebook.learned")}</h3>
      <div class="ghost-lines" aria-hidden="true">
        {#each [92, 78, 86, 54] as w, i (i)}<span style:width={`${w}%`}></span>{/each}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet moreLeft(spread: MachineSpread, index: number)}
  {@const inked = inkedFor(spread)}
  {@const stamp = stampFor(spread)}
  <header class="head small">
    <p class="kicker"><span>{spread.world}</span><span class="sep" aria-hidden="true"></span><span>{t("notebook.continued")}</span></p>
    <h2 class="nick-title" class:pencil={!inked}>{spread.nickname}</h2>
    <Underline width={170} seed={index * 7} color={inked ? "var(--amber)" : "rgba(140,129,115,0.45)"} />
  </header>
  {#if inked}
    {#if spread.thenNow.length}
      <section class="now big">
        <h3 class="label">{t("notebook.thenNow")}</h3>
        {#each spread.thenNow as f (f.id)}<p>{factText(f)} <a class="src" href={f.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t("notebook.source")}: ${f.sourceTitle}`}>{t("notebook.source")}</a></p>{/each}
      </section>
    {/if}
    {#if spread.id === "ingenuity" && logNote}
      <aside class="log-note">
        <h3 class="label">{t("notebook.yourNote")}</h3>
        <p>{logNoteText(logNote)}</p>
      </aside>
    {/if}
    {#if stamp}
      <div class="stamp-mark"><InkStamp lines={stamp} top="DELIVERED BY REMI" bottom={POSTS[spread.world]} size={168} tilt={index % 2 ? -6 : 5} label={`Stamp: ${stamp[0]} ${stamp[1]}`} /></div>
    {/if}
  {:else}
    <p class="pencil-note">{t("notebook.pencil")}</p>
    <div class="ghost-lines" aria-hidden="true">
      {#each [88, 72, 80] as w, i (i)}<span style:width={`${w}%`}></span>{/each}
    </div>
    <div class="stamp-ghost" aria-hidden="true"></div>
  {/if}
{/snippet}

{#snippet moreRight(spread: MachineSpread)}
  {#if inkedFor(spread)}
    {#if spread.deeper.length}
      <section class="deeper open">
        <h3 class="label">{t("notebook.deeper")}</h3>
        {#each spread.deeper as f (f.id)}
          <p>{f.kid}{f.deeper ? ` ${f.deeper}` : ""} <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{f.sourceTitle}</a></p>
        {/each}
      </section>
    {/if}
    {#if spread.id === "lamp"}
      <section class="letters">
        <h3 class="label">{t("notebook.letters")}</h3>
        <p class="help">{t("notebook.lettersHelp")}</p>
        <ul>
          {#each SPREADS.filter((x) => x.id !== "lamp") as s, i (s.id)}
            <li><Envelope to={s.letterTo} world={s.world} done={isComplete(s, game)} doneLabel={t("notebook.delivered")} tilt={TILTS[i % 5]! * 0.6} /></li>
          {/each}
        </ul>
      </section>
    {:else if !spread.deeper.length}
      <p class="dad-last">{spread.dadNote}</p>
      <p class="signoff">{COVER.signature}</p>
    {/if}
  {:else}
    <h3 class="label ghost-label">{t("notebook.deeper")}</h3>
    <div class="ghost-lines" aria-hidden="true">
      {#each [92, 78, 86, 54, 70] as w, i (i)}<span style:width={`${w}%`}></span>{/each}
    </div>
  {/if}
{/snippet}

{#snippet lastLeft()}
  <header class="head">
    <p class="kicker"><span>Home</span></p>
    <h2 class="name">What will you discover next?</h2>
  </header>
  {#if finished}
    {#if groupPhoto}
      <figure class="group"><img src={groupPhoto} alt="Remi and friends in Dad's workshop" /><figcaption>All of us, in the workshop</figcaption></figure>
    {/if}
    {#if lastSticker}
      <p class="label">{t("notebook.favorite")}</p>
      <p class="sticker-big">{lastSticker}</p>
    {/if}
    {#if lastName}
      <p class="label">{t("notebook.nextAdventure")}</p>
      <p class="adventure">{lastName}</p>
    {/if}
  {:else}
    <p class="pencil-note">{t("notebook.lastBlank")}</p>
  {/if}
{/snippet}

{#snippet lastRight()}
  {#if finished}
    <div class="stamp-mark"><InkStamp lines={["Not left behind.", "Still sending."]} top="DELIVERED BY REMI" bottom="DEEP SPACE POST" size={150} tilt={-5} label="Stamp: Not left behind. Still sending." /></div>
    <p class="dad-last">Leave the light on for whoever comes next.</p>
    <p class="signoff">Dad</p>
    <p class="help">{t("notebook.museum")}</p>
  {:else}
    <div class="ghost-lines" aria-hidden="true">
      {#each [92, 78, 86, 54] as w, i (i)}<span style:width={`${w}%`}></span>{/each}
    </div>
  {/if}
{/snippet}

{#snippet face(index: number, side: "left" | "right")}
  {@const m = machineAt(index)}
  <div class="scroll" use:fit>
    <div class="fit">
      {#if index === 0}
        {#if side === "left"}{@render coverLeft()}{:else}{@render coverRight()}{/if}
      {:else if index === LAST}
        {#if side === "left"}{@render lastLeft()}{:else}{@render lastRight()}{/if}
      {:else if m && m.part === 1}
        {#if side === "left"}{@render moreLeft(m.spread, index)}{:else}{@render moreRight(m.spread)}{/if}
      {:else if m && side === "left"}
        {@render machineLeft(m.spread, m.at + 1)}
      {:else if m}
        {@render machineRight(m.spread, m.at + 1)}
      {/if}
    </div>
  </div>
  <span class="folio" aria-hidden="true">{index * 2 + (side === "left" ? 1 : 2)}</span>
{/snippet}

<div class="notebook" role="dialog" aria-modal="true" aria-labelledby="nb-title" tabindex="-1" use:trap={{ initial: ".nav.next" }} onkeydown={onkey} bind:this={book}>
  <h1 id="nb-title" class="sr-only">{t("notebook.label")}</h1>
  <p class="sr-only" aria-live="polite">{pageLabel}</p>

  <div class="book" class:opening onpointerdown={down} onpointerup={up} role="presentation">
    <span class="board l" aria-hidden="true"></span>
    <span class="board r" aria-hidden="true"></span>
    <span class="band" aria-hidden="true"></span>

    <div class="spread" class:slide-next={slide === 1} class:slide-prev={slide === -1}>
      {#key leftIndex}
        <article class="page left {kind(leftIndex)}">{@render face(leftIndex, "left")}</article>
      {/key}
      {#key rightIndex}
        <article class="page right {kind(rightIndex)}">{@render face(rightIndex, "right")}</article>
      {/key}
      <span class="gutter" aria-hidden="true"></span>

      {#if flip}
        <span class="shade" aria-hidden="true"></span>
        <div class="leaf" class:next={flip.dir > 0} class:prev={flip.dir < 0} aria-hidden="true" inert>
          {#if flip.dir > 0}
            <div class="side front page right {kind(flip.from)}">{@render face(flip.from, "right")}</div>
            <div class="side back page left {kind(flip.to)}">{@render face(flip.to, "left")}</div>
          {:else}
            <div class="side front page left {kind(flip.from)}">{@render face(flip.from, "left")}</div>
            <div class="side back page right {kind(flip.to)}">{@render face(flip.to, "right")}</div>
          {/if}
        </div>
      {/if}
    </div>

    {#if opening}
      <!-- The cover swings open; its inside is the left page you are about to read. -->
      <div class="cover-leaf" aria-hidden="true" inert>
        <div class="side front outside">
          <span class="emboss">
            <Sketch id="cover-emboss" prims={DRAWINGS.lamp} seed={4} color="rgba(255, 233, 196, 0.55)" />
            <span>{COVER.title}</span>
          </span>
        </div>
        <div class="side back inside">
          <div class="page left {kind(shown)}">{@render face(shown, "left")}</div>
        </div>
      </div>
    {/if}
  </div>

  <div class="bar">
    <button type="button" class="nav prev" onclick={() => turn(-1)} disabled={shown === 0} aria-label={t("notebook.prev")}><Icon name="left" size={26} /></button>
    <span class="clip" aria-hidden="true">{shown + 1} / {total}</span>
    <button type="button" class="nav next" onclick={() => turn(1)} disabled={shown === total - 1} aria-label={t("notebook.next")}><Icon name="right" size={26} /></button>
    {#if settings.value.readAloud}
      <span class="divider" aria-hidden="true"></span>
      <button type="button" class="read" onclick={readAloud}><Icon name="speaker" size={22} /> <span>{reading ? t("notebook.stopReading") : t("notebook.readAloud")}</span></button>
    {/if}
    <span class="divider" aria-hidden="true"></span>
    <button type="button" class="nav close" onclick={onclose} aria-label={t("notebook.close")}><Icon name="close" size={22} /></button>
  </div>
</div>

<style>
  /* ---------- The book ---------- */
  .notebook {
    --flip: 760ms;
    --margin: 13px;
    /* Darker cousins of amber and pencil, for small text on cream (4.5:1 or better). */
    --amber-ink: #8f4c10;
    --pencil-ink: #6b6258;
    --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.31 0 0 0 0 0.16 0.22 0 0 0 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    justify-items: center;
    align-items: center;
    gap: 16px;
    padding: max(18px, 3vh) 20px max(16px, 2.4vh);
    pointer-events: auto;
    background: radial-gradient(ellipse at 50% 45%, rgba(20, 16, 36, 0.15), rgba(10, 8, 22, 0.55));
    perspective: 2400px;
  }
  .book {
    position: relative;
    width: min(1200px, 100%);
    height: min(760px, 100%);
    animation: lift 0.5s var(--ease-out) both;
    transform-style: preserve-3d;
  }
  /* Leather boards, the same worn brown as the notebook on the loading bench, with stitching. */
  .board {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    background:
      radial-gradient(ellipse 80% 50% at 30% 15%, rgba(255, 200, 150, 0.13), transparent 60%),
      var(--grain),
      linear-gradient(165deg, #6e3828, #4e271d 65%, #3f1f17);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      inset 0 -3px 8px rgba(0, 0, 0, 0.3),
      0 40px 60px -30px rgba(6, 4, 14, 0.75),
      0 16px 26px -14px rgba(6, 4, 14, 0.55);
  }
  .board.l {
    left: 0;
    border-radius: 16px 5px 5px 16px;
  }
  .board.r {
    right: 0;
    border-radius: 5px 16px 16px 5px;
  }
  .board::after {
    content: "";
    position: absolute;
    inset: 5px;
    border: 1.6px dashed rgba(240, 200, 150, 0.4);
    border-radius: inherit;
    pointer-events: none;
  }
  /* The elastic band that keeps it shut, resting along the back board. */
  .band {
    position: absolute;
    top: -3px;
    bottom: -3px;
    right: 30px;
    width: 9px;
    border-radius: 3px;
    background: linear-gradient(90deg, #1b1714, #3a312a 45%, #221c18);
    box-shadow: 1px 0 2px rgba(0, 0, 0, 0.35);
    z-index: 0;
  }
  .spread {
    position: absolute;
    inset: var(--margin);
    display: grid;
    grid-template-columns: 1fr 1fr;
    perspective: 2600px;
    transform-style: preserve-3d;
    touch-action: pan-y;
    /* The page block's edge: a few sheets peeking out below. */
    border-radius: 6px;
    box-shadow:
      0 1px 0 #efe6d3,
      0 2px 0 #e2d6bd,
      0 3px 0 #efe6d3,
      0 4px 0 #d8cab0,
      0 6px 10px -2px rgba(10, 8, 6, 0.35);
  }

  /* ---------- Paper ---------- */
  .page {
    position: relative;
    overflow: hidden;
    color: var(--ink);
    line-height: 1.5;
    background-color: #fbf6ea;
  }
  /* Left pages are Dad's drawing paper: a faint engineering grid. */
  .page.left {
    border-radius: 6px 0 0 6px;
    background-image:
      var(--grain),
      linear-gradient(90deg, rgba(120, 90, 40, 0.06) 0, transparent 7%, transparent 80%, rgba(110, 80, 40, 0.1) 93%, rgba(70, 50, 24, 0.3) 100%),
      linear-gradient(rgba(64, 108, 170, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(64, 108, 170, 0.1) 1px, transparent 1px);
    background-size: 180px 180px, 100% 100%, 22px 22px, 22px 22px;
  }
  /* Right pages are his writing paper: blue lines and a red margin. */
  .page.right {
    border-radius: 0 6px 6px 0;
    background-image:
      var(--grain),
      linear-gradient(270deg, rgba(120, 90, 40, 0.06) 0, transparent 7%, transparent 80%, rgba(110, 80, 40, 0.1) 93%, rgba(70, 50, 24, 0.3) 100%),
      linear-gradient(90deg, transparent 38px, rgba(196, 80, 60, 0.32) 38px 39.5px, transparent 39.5px),
      repeating-linear-gradient(180deg, transparent 0 31px, rgba(64, 108, 170, 0.12) 31px 32px);
    background-size: 180px 180px, 100% 100%, 100% 100%, 100% 100%;
    background-position: 0 0, 0 0, 0 0, 0 20px;
  }
  /* A soft highlight where the paper curves up out of the gutter. */
  .page.left::after,
  .page.right::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 26px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255, 252, 240, 0.5), transparent);
  }
  .page.left::after {
    right: 16px;
  }
  .page.right::after {
    left: 16px;
  }
  .gutter {
    position: absolute;
    top: 18px;
    bottom: 18px;
    left: 50%;
    width: 1px;
    background: repeating-linear-gradient(to bottom, rgba(120, 96, 60, 0.5) 0 10px, transparent 10px 22px);
    pointer-events: none;
  }
  /* A page never scrolls: it holds what fits, and the "fit" action shrinks the writing a touch when it must. */
  .scroll {
    position: absolute;
    inset: 0;
    overflow: hidden;
    padding: 38px 46px 54px;
  }
  .head.small {
    margin-bottom: 8px;
  }
  .now.big {
    margin-top: 30px;
    padding: 22px 22px 12px;
  }
  .now.big p {
    font-size: 1.12rem;
    line-height: 1.55;
  }
  .log-note {
    margin-top: 22px;
    padding: 14px 18px 10px;
    background: repeating-linear-gradient(#fffdf6 0 27px, #d9e3ea 27px 28px);
    border: 1.5px solid rgba(43, 38, 34, 0.35);
    border-radius: 3px;
    rotate: -0.8deg;
    box-shadow: 0 6px 14px -10px rgba(40, 30, 20, 0.5);
  }
  .log-note .label {
    margin: 0 0 4px;
  }
  .log-note p {
    margin: 0;
    font: 700 1.25rem/28px var(--hand);
  }
  .deeper.open {
    margin-top: 0;
    border-top: 0;
  }
  .deeper.open p {
    margin: 0 0 12px;
    font-size: 1rem;
    line-height: 1.5;
  }
  .stamp-ghost {
    width: 150px;
    height: 150px;
    margin: 28px auto 0;
    border: 3px dashed rgba(140, 129, 115, 0.35);
    border-radius: 50%;
  }
  .page.left .scroll {
    padding-right: 54px;
  }
  .page.right .scroll {
    padding-left: 54px;
  }
  .folio {
    position: absolute;
    bottom: 16px;
    font: 700 1rem/1 var(--hand);
    color: #6f665b;
  }
  .page.left .folio {
    left: 26px;
  }
  .page.right .folio {
    right: 26px;
  }

  /* ---------- Type on the page ---------- */
  p {
    margin: 0 0 8px;
  }
  .label {
    margin: 22px 0 8px;
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .label::before {
    content: "★";
    margin-right: 7px;
    color: var(--amber-deep);
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 10px;
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--amber-ink);
  }
  .kicker .sep {
    width: 18px;
    height: 1.5px;
    background: currentColor;
    opacity: 0.6;
  }
  .nick-title {
    margin: 0;
    font: 700 2.5rem/1.05 var(--hand);
    color: var(--dad-ink);
    letter-spacing: -0.005em;
  }
  .nick-title.pencil {
    color: #6f6a7a;
  }
  .real {
    margin: 6px 0 0;
    font: 400 1.12rem/1.35 var(--hand);
    color: var(--ink-soft);
  }

  /* ---------- Cover spread ---------- */
  .page.cover.left .scroll {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  /* Dad's notebook patch, taped to the first page, with the title on a paper ribbon across it. */
  .emblem {
    position: relative;
    display: grid;
    justify-items: center;
    width: 100%;
    margin-top: 6px;
  }
  .emblem-tape {
    position: absolute;
    top: -10px;
    left: 50%;
    z-index: 1;
    width: 96px;
    height: 24px;
    margin-left: -48px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
    transform: rotate(4deg);
  }
  .plate-title {
    position: relative;
    display: grid;
    place-items: center;
    width: min(360px, 98%);
    height: 72px;
    margin: -26px 0 0;
    font: 700 2.15rem/1 var(--hand);
    white-space: nowrap;
    color: var(--ink);
    transform: rotate(-1.5deg);
  }
  .plate-title span {
    position: relative;
    margin-top: -6px;
  }
  .ribbon {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 3px 0 rgba(43, 38, 34, 0.9));
  }
  .ribbon path {
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .ribbon .band {
    fill: #fffaf0;
  }
  .ribbon .tail {
    fill: #f2a541;
  }
  .ribbon .fold {
    fill: #a4621b;
  }
  /* Dad's own words, in fountain-pen ink. */
  .dedication {
    max-width: 16em;
    margin: 22px 0 0;
    font: 400 1.55rem/1.36 var(--hand);
    color: var(--dad-ink);
    text-wrap: balance;
  }
  .signature {
    align-self: flex-end;
    position: relative;
    margin: 4px 14% 0 0;
    font: 700 1.8rem/1 var(--hand);
    color: var(--dad-ink);
    transform: rotate(-5deg);
  }
  .signature::after {
    content: "";
    position: absolute;
    left: -8px;
    right: -14px;
    bottom: -8px;
    height: 9px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 10' preserveAspectRatio='none'%3E%3Cpath d='M2 7 C 20 2, 44 9, 60 4 C 66 2, 72 3, 78 6' fill='none' stroke='%23233f73' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  }
  .cover-doodle {
    width: min(330px, 86%);
    margin-top: 26px;
    overflow: visible;
  }
  .cover-doodle .ink {
    fill: none;
    stroke: var(--dad-ink);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .cover-doodle .dash {
    stroke-dasharray: 2 7;
    stroke-width: 2.6;
  }
  .cover-doodle .paper {
    fill: #fffaf0;
  }
  .cover-doodle .mars {
    fill: #e6a47a;
  }
  .toc-title {
    display: inline-block;
    margin: 0;
    padding: 0 6px;
    font: 700 2.2rem/1.2 var(--hand);
    background: linear-gradient(transparent 58%, rgba(242, 165, 65, 0.45) 58%, rgba(242, 165, 65, 0.45) 88%, transparent 88%);
  }
  .toc {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  .toc button {
    display: flex;
    align-items: baseline;
    gap: 12px;
    width: calc(100% + 16px);
    min-height: 50px;
    padding: 10px 8px;
    margin: 0 -8px;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid rgba(43, 38, 34, 0.1);
    border-radius: 8px;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }
  .toc button:hover {
    background: rgba(242, 165, 65, 0.13);
  }
  /* "Mission log, kept by Dad": typed on a label strip under the title. */
  .log {
    margin: 6px 0 14px 6px;
    font: 700 0.74rem/1 var(--label);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .log::before {
    content: "★";
    margin-right: 8px;
    color: var(--amber-deep);
  }
  /* Each machine's patch: in thread once earned, a pencil circle until then. */
  .toc .patch-slot {
    align-self: center;
    flex: none;
    width: 40px;
    height: 40px;
  }
  .toc .nick {
    font: 700 1.32rem/1.2 var(--hand);
    color: var(--dad-ink);
  }
  .toc .dots {
    flex: 1;
    min-width: 16px;
    border-bottom: 2px dotted rgba(43, 38, 34, 0.25);
    transform: translateY(-4px);
  }
  /* Destination tags, like luggage labels: one colour per world. */
  .toc .world {
    align-self: center;
    padding: 4px 8px 3px;
    border: 1.5px solid currentColor;
    border-radius: 3px;
    font: 700 0.64rem/1 var(--label);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transform: rotate(-2deg);
  }
  .toc .w-home {
    color: #8f4c10;
    background: rgba(242, 165, 65, 0.16);
  }
  .toc .w-moon {
    color: #33507e;
    background: rgba(142, 164, 192, 0.2);
  }
  .toc .w-mars {
    color: #9a3a22;
    background: rgba(217, 130, 95, 0.18);
  }
  .toc .w-space {
    color: #333d78;
    background: rgba(76, 90, 154, 0.14);
  }
  /* Page numbers in red pencil. */
  .toc .pg {
    width: 1.6em;
    text-align: right;
    font: 700 1.15rem/1 var(--hand);
    color: #b5523a;
  }
  .memories-title {
    margin: 30px 0 12px;
    font: 700 1.45rem/1.1 var(--hand);
  }
  .memories {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 96px));
    gap: 16px;
  }
  .memories-note {
    margin-top: 12px;
    color: var(--ink-soft);
    font-size: 0.92rem;
  }

  /* ---------- Machine, left page ---------- */
  .drawing {
    position: relative;
    margin: 14px auto 0;
    max-width: 360px;
  }
  .drawing figcaption {
    margin-top: 2px;
    text-align: right;
    font: 400 1rem/1.2 var(--hand);
    color: var(--ink-soft);
  }
  .for p {
    font-size: 1.04rem;
  }
  /* Dad's note: a slip of lined paper, taped down a little crooked. */
  .note {
    position: relative;
    margin: 22px 6px 6px;
    padding: 18px 20px 12px 22px;
    background:
      repeating-linear-gradient(to bottom, transparent 0 29px, rgba(92, 115, 147, 0.22) 29px 30px) 0 14px / 100% calc(100% - 14px) no-repeat,
      #fffcf3;
    box-shadow: 0 1px 2px rgba(46, 30, 12, 0.12), 0 10px 16px -12px rgba(46, 30, 12, 0.5);
    transform: rotate(-0.8deg);
  }
  .note p {
    margin: 0;
    font: 400 1.32rem/30px var(--hand);
    color: var(--dad-ink);
  }
  .note .note-sig {
    text-align: right;
    font-weight: 700;
  }
  .note-tape {
    position: absolute;
    top: -10px;
    left: 50%;
    width: 84px;
    height: 20px;
    margin-left: -42px;
    background: linear-gradient(90deg, rgba(242, 178, 92, 0.6), rgba(236, 190, 120, 0.68));
    clip-path: polygon(4% 0, 96% 0, 100% 18%, 95% 36%, 100% 54%, 96% 72%, 100% 90%, 96% 100%, 4% 100%, 0 82%, 5% 64%, 0 46%, 4% 28%, 0 10%);
    transform: rotate(2deg);
    mix-blend-mode: multiply;
  }

  /* ---------- Machine, right page ---------- */
  .photos {
    display: grid;
    justify-items: center;
    gap: 22px;
    margin: 10px 4px 18px;
  }
  .photos > :global(.photo) {
    width: min(100%, 330px);
  }
  .photos.two {
    grid-template-columns: 1fr 1fr;
  }
  .photos.two > :global(.photo) {
    width: 100%;
  }
  .place {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
  .place :global(.icon) {
    flex: none;
    margin-top: 2px;
    color: var(--clay);
  }
  .facts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 7px;
  }
  .facts li {
    position: relative;
    padding-left: 22px;
  }
  .facts li::before {
    content: "";
    position: absolute;
    left: 2px;
    top: 0.55em;
    width: 8px;
    height: 8px;
    border: 2px solid var(--amber-deep);
    border-radius: 50% 45% 55% 50%;
  }
  .src {
    margin-left: 2px;
    padding: 6px 0;
    font: 700 0.74rem var(--read);
    color: var(--amber-ink);
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 3px;
  }
  /* Then and now: a museum-style label with its heading set into the border. */
  .now {
    position: relative;
    margin-top: 26px;
    padding: 18px 18px 8px;
    border: 1.5px solid rgba(43, 38, 34, 0.35);
    border-radius: 4px;
  }
  .now .label {
    position: absolute;
    top: -6px;
    left: 12px;
    margin: 0;
    padding: 0 8px;
    background: #fbf6ea;
  }
  .now p {
    font-weight: 600;
  }
  .deeper {
    margin-top: 16px;
    border-top: 1px dashed rgba(43, 38, 34, 0.25);
  }
  .deeper p {
    font-size: 0.95rem;
  }
  .deeper a {
    color: var(--amber-ink);
    font-weight: 700;
    font-size: 0.88rem;
  }
  .stamp-mark {
    display: flex;
    justify-content: center;
    margin: 22px 0 0;
    opacity: 0.92;
  }
  .letters {
    margin-top: 18px;
  }
  .letters .help {
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  .letters ul {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12.5rem), 1fr));
    gap: 16px 14px;
  }

  /* ---------- Pencil pages ---------- */
  .pencil-page .label {
    color: var(--pencil-ink);
  }
  .pending {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 100%;
  }
  .corners {
    display: grid;
    gap: 22px;
    justify-items: center;
    margin: 10px 4px 22px;
  }
  .corners.two {
    grid-template-columns: 1fr 1fr;
  }
  /* Photo corners waiting for a picture. */
  .slot {
    position: relative;
    width: min(100%, 330px);
    aspect-ratio: 4 / 3.4;
  }
  .corners.two .slot {
    width: 100%;
  }
  .slot i {
    position: absolute;
    width: 26px;
    height: 26px;
    border: 0 solid rgba(140, 129, 115, 0.75);
  }
  .slot i:nth-child(1) {
    left: 0;
    top: 0;
    border-width: 1.5px 0 0 1.5px;
  }
  .slot i:nth-child(2) {
    right: 0;
    top: 0;
    border-width: 1.5px 1.5px 0 0;
  }
  .slot i:nth-child(3) {
    left: 0;
    bottom: 0;
    border-width: 0 0 1.5px 1.5px;
  }
  .slot i:nth-child(4) {
    right: 0;
    bottom: 0;
    border-width: 0 1.5px 1.5px 0;
  }
  .waiting {
    display: grid;
    grid-template-columns: minmax(0, 190px) 1fr;
    align-items: center;
    gap: 22px;
  }
  .clipped {
    position: relative;
  }
  /* A paper clip holding Dad's letter to the page. */
  .clip-wire {
    position: absolute;
    top: -14px;
    left: 26px;
    z-index: 1;
    width: 13px;
    height: 40px;
    border: 2px solid #8d9196;
    border-radius: 7px 7px 7px 7px;
    transform: rotate(-8deg);
  }
  .clip-wire::after {
    content: "";
    position: absolute;
    left: 2px;
    top: 7px;
    width: 5px;
    height: 24px;
    border: 2px solid #8d9196;
    border-top: 0;
    border-radius: 0 0 5px 5px;
  }
  .pencil-note {
    margin: 0;
    font: 400 1.28rem/1.35 var(--hand);
    color: #6f6a7a;
  }
  .ghost-label {
    margin-top: 30px;
  }
  .ghost-lines {
    display: grid;
    gap: 16px;
    padding-top: 6px;
  }
  .ghost-lines span {
    height: 1.5px;
    background: linear-gradient(90deg, rgba(140, 129, 115, 0.5), rgba(140, 129, 115, 0.3));
    border-radius: 2px;
  }

  /* ---------- Turning a page ---------- */
  .leaf {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    z-index: 5;
    pointer-events: none;
    transform-style: preserve-3d;
  }
  .leaf.next {
    left: 50%;
    transform-origin: left center;
    animation: flip-next var(--flip) cubic-bezier(0.36, 0.06, 0.18, 1) both;
  }
  .leaf.prev {
    left: 0;
    transform-origin: right center;
    animation: flip-prev var(--flip) cubic-bezier(0.36, 0.06, 0.18, 1) both;
  }
  .side {
    position: absolute;
    inset: 0;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }
  .side.back {
    transform: rotateY(180deg);
  }
  /* Light falls off the leaf as it stands up, and comes back as it lands. */
  .leaf .side::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }
  .leaf .front::before {
    animation: dim-front var(--flip) linear both;
  }
  .leaf .back::before {
    animation: dim-back var(--flip) linear both;
  }
  .leaf.next .front::before,
  .leaf.prev .back::before {
    background: linear-gradient(90deg, rgba(40, 26, 10, 0.45), rgba(40, 26, 10, 0.12));
  }
  .leaf.next .back::before,
  .leaf.prev .front::before {
    background: linear-gradient(270deg, rgba(40, 26, 10, 0.45), rgba(40, 26, 10, 0.12));
  }
  .shade {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: linear-gradient(90deg, transparent 18%, rgba(30, 20, 8, 0.2) 50%, transparent 82%);
    animation: shade var(--flip) ease-in-out both;
  }
  @keyframes flip-next {
    0% {
      transform: rotateY(0deg);
    }
    50% {
      transform: rotateY(-90deg) translateZ(6px);
    }
    100% {
      transform: rotateY(-180deg);
    }
  }
  @keyframes flip-prev {
    0% {
      transform: rotateY(0deg);
    }
    50% {
      transform: rotateY(90deg) translateZ(6px);
    }
    100% {
      transform: rotateY(180deg);
    }
  }
  @keyframes dim-front {
    0% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 1;
    }
  }
  @keyframes dim-back {
    0%,
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  @keyframes shade {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
  }

  /* ---------- Opening the cover ---------- */
  .cover-leaf {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 50%;
    z-index: 6;
    transform-origin: left center;
    transform-style: preserve-3d;
    animation: open-cover 0.95s 0.2s cubic-bezier(0.5, 0.02, 0.2, 1) both;
  }
  .cover-leaf .outside {
    display: grid;
    place-items: center;
    border-radius: 5px 16px 16px 5px;
    background:
      radial-gradient(ellipse 80% 50% at 30% 15%, rgba(255, 200, 150, 0.13), transparent 60%),
      var(--grain),
      linear-gradient(165deg, #6e3828, #4e271d 65%, #3f1f17);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      inset 0 -3px 8px rgba(0, 0, 0, 0.3);
  }
  .emboss {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: 46%;
    padding: 28px 18px 22px;
    border: 1.6px dashed rgba(240, 200, 150, 0.5);
    border-radius: 4px;
    color: #f0c37a;
    font: 700 2rem/1.1 var(--hand);
    text-align: center;
    text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.35);
  }
  .emboss :global(.sketch) {
    width: 72%;
  }
  .cover-leaf .inside {
    border-radius: 16px 5px 5px 16px;
    background:
      radial-gradient(ellipse 80% 50% at 30% 15%, rgba(255, 200, 150, 0.13), transparent 60%),
      var(--grain),
      linear-gradient(165deg, #6e3828, #4e271d 65%, #3f1f17);
  }
  .cover-leaf .inside .page {
    position: absolute;
    inset: var(--margin) 0 var(--margin) var(--margin);
  }
  .opening .board.l,
  .opening .spread > .page.left {
    visibility: hidden;
  }
  .opening .spread {
    clip-path: inset(-40px -40px -40px 50%);
  }
  @keyframes open-cover {
    from {
      transform: rotateY(0deg);
    }
    to {
      transform: rotateY(-180deg);
    }
  }
  @keyframes lift {
    from {
      opacity: 0;
      transform: translateY(34px) rotateX(9deg) scale(0.97);
    }
  }

  /* ---------- Phones: one long page, a soft slide between spreads ---------- */
  .slide-next .page {
    animation: slide-in-next 0.36s var(--ease-out);
  }
  .slide-prev .page {
    animation: slide-in-prev 0.36s var(--ease-out);
  }
  @keyframes slide-in-next {
    from {
      opacity: 0;
      transform: translateX(28px);
    }
  }
  @keyframes slide-in-prev {
    from {
      opacity: 0;
      transform: translateX(-28px);
    }
  }

  /* ---------- Controls ---------- */
  /* The page controls: paper stickers on a strip of tape. */
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 3px;
    background: rgba(238, 222, 170, 0.92);
    box-shadow: inset 0 0 0 1px rgba(150, 128, 80, 0.25), 0 14px 26px -14px rgba(0, 0, 0, 0.6);
    color: var(--ink);
    rotate: -0.6deg;
    animation: bar-in 0.5s 0.15s var(--ease-out) both;
  }
  .nav,
  .read {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 46px;
    border: 2.2px solid var(--ink);
    border-radius: 50% 46% 52% 48%;
    background: #fffaf0;
    box-shadow: 0 3px 0 var(--ink);
    color: var(--ink);
    cursor: pointer;
    transition:
      background 0.15s,
      box-shadow 0.15s,
      transform 0.18s var(--ease-spring);
  }
  .nav {
    width: 48px;
  }
  .read {
    padding: 0 16px 0 12px;
    border-radius: 14px 12px 15px 11px;
    font: 700 1.05rem var(--hand);
  }
  .nav:hover:not(:disabled),
  .read:hover {
    background: #f9d79a;
    transform: translateY(-2px);
    box-shadow: 0 5px 0 var(--ink);
  }
  .nav:active:not(:disabled),
  .read:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }
  .nav:disabled {
    opacity: 0.35;
    box-shadow: none;
    cursor: default;
  }
  .nav.next {
    width: 54px;
    height: 54px;
    background: var(--amber);
  }
  .nav.next:hover:not(:disabled) {
    background: #f7bd62;
  }
  .nav.next:disabled {
    background: #fffaf0;
  }
  .bar :global(:focus-visible) {
    outline: 3px solid var(--clay);
    outline-offset: 3px;
  }
  .clip {
    min-width: 64px;
    text-align: center;
    font: 700 1.25rem/1 var(--hand);
    font-variant-numeric: tabular-nums;
  }
  .divider {
    width: 2px;
    height: 30px;
    margin: 0 2px;
    background: repeating-linear-gradient(to bottom, rgba(43, 38, 34, 0.35) 0 4px, transparent 4px 8px);
  }
  @keyframes bar-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  :global(:root[data-motion="reduce"]) .book,
  :global(:root[data-motion="reduce"]) .bar,
  :global(:root[data-motion="reduce"]) .page {
    animation: none;
  }

  @media (max-width: 820px) {
    .notebook {
      --margin: 7px;
      padding: 10px 10px max(12px, env(safe-area-inset-bottom));
      gap: 10px;
    }
    .book {
      height: 100%;
    }
    .band {
      right: 14px;
      width: 7px;
    }
    .spread {
      display: block;
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: 6px;
      background: #fbf6ea;
    }
    .page {
      overflow: visible;
    }
    .page.left,
    .page.right {
      border-radius: 0;
      background-image: var(--grain);
    }
    .page.left::after,
    .page.right::after,
    .gutter {
      display: none;
    }
    .page.right {
      border-top: 1px dashed rgba(43, 38, 34, 0.2);
    }
    .scroll {
      position: relative;
      inset: auto;
      overflow: visible;
      padding: 26px 22px 40px !important;
      -webkit-mask-image: none;
      mask-image: none;
    }
    .page.cover.left .scroll {
      min-height: 0;
    }
    .folio {
      bottom: 12px;
    }
    .page.left .folio {
      left: auto;
      right: 18px;
    }
    .page.right .folio {
      right: 18px;
    }
    .nick-title {
      font-size: 2.1rem;
    }
    .waiting {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
    }
    .clipped {
      width: min(220px, 80%);
    }
    .read span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .read {
      width: 48px;
      padding: 0;
    }
  }
  .group {
    margin: 6px 0 14px;
    padding: 8px 8px 26px;
    background: #fff;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
    rotate: -2deg;
    max-width: 72%;
  }
  .group img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
  }
  .group figcaption {
    margin-top: 6px;
    font: 700 1rem/1 var(--hand);
    text-align: center;
  }
  .sticker-big {
    display: inline-block;
    margin: 4px 0 12px;
    padding: 8px 16px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #c9dcc0;
    font: 700 1.05rem/1 var(--read);
    rotate: -3deg;
  }
  .adventure {
    margin: 2px 0 0;
    font: 700 1.8rem/1.15 var(--hand);
  }
  .dad-last {
    margin: 18px 0 4px;
    font: 700 1.6rem/1.3 var(--hand);
    color: #2c4a7a;
  }
  .signoff {
    margin: 0 0 18px;
    font: 700 1.2rem/1 var(--hand);
    color: #2c4a7a;
    text-align: right;
  }
</style>
