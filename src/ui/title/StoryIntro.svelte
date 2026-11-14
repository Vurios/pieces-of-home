<script lang="ts">
  import { audio } from "../../audio/audio";
  import { STORY, type StoryArt } from "../../content/story";
  import type { Engine } from "../../game/engine";
  import { settings } from "../settings.svelte";

  /**
   * The short story before a new game, told as Dad's storybook over the
   * world itself. Each page is one shot of the little home planet, filmed
   * with a slow camera move (the planet at dusk, Dad's bench, the workshop
   * door, the little worlds under glass, Milo in pieces, the mailbox). The
   * words sit on a torn notebook page taped over the bottom of the picture,
   * next to one of Dad's ink doodles that draws itself, and they ink in word
   * by word. Turning the page is a real page: a sheet of Dad's grid paper
   * sweeps across the screen, and the next shot is behind it.
   *
   * Pages turn on their own after enough time to read, or with Next, a click,
   * a tap or any key. Escape (or gamepad B) skips the lot. The last shot is
   * where the game starts, so the camera flies straight down to Remi when the
   * story ends. With reduced motion the pages cut instead of turning.
   */
  interface Props {
    engine: Engine;
    ondone: () => void;
  }
  let { engine, ondone }: Props = $props();

  const pages = STORY.pages;
  /** The page on screen. -1 until the first page turn reveals it. */
  let index = $state(-1);
  /** The page the turning sheet is carrying in. */
  let incoming = $state(0);
  let turning = $state(false);
  let sheet: HTMLDivElement | null = $state(null);
  let next: HTMLButtonElement | null = $state(null);
  const page = $derived(pages[Math.max(0, index)]!);
  const last = $derived(index === pages.length - 1);
  const reduced = $derived(settings.reducedMotion);
  /** Long enough to read at a slow pace: a base plus a little for every word. */
  const hold = $derived(3000 + page.text.split(/\s+/).length * 340);
  const words = $derived(page.text.split(/\s+/));
  let finished = false;
  let cutTimer = 0;

  function finish(): void {
    if (finished) return;
    finished = true;
    window.clearTimeout(cutTimer);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    engine.storyEnd();
    ondone();
  }

  /** Turns to page `to`: the sheet covers the screen, the shot changes behind it, the sheet sweeps on. */
  function turnTo(to: number): void {
    if (finished || turning || to < 0) return;
    if (to >= pages.length) return finish();
    const art = pages[to]!.art;
    incoming = to;
    if (reduced || !sheet) {
      engine.storyCut(art);
      index = to;
      if (index >= 0) audio.ui("page");
      return;
    }
    turning = true;
    audio.ui("page");
    const forward = to >= index;
    const from = forward ? 1 : -1;
    const motion = sheet.animate(
      [
        { transform: `translateX(${108 * from}%) perspective(1800px) rotateY(${-34 * from}deg) rotate(${3 * from}deg)`, offset: 0 },
        { transform: "translateX(0%) perspective(1800px) rotateY(0deg) rotate(0deg)", offset: 0.44, easing: "linear" },
        { transform: "translateX(0%) perspective(1800px) rotateY(0deg) rotate(0deg)", offset: 0.56 },
        { transform: `translateX(${-114 * from}%) perspective(1800px) rotateY(${28 * from}deg) rotate(${-2 * from}deg)`, offset: 1 },
      ],
      { duration: 1050, easing: "cubic-bezier(0.55, 0.05, 0.4, 1)" },
    );
    // While the paper covers everything, the shot and the words change.
    cutTimer = window.setTimeout(() => {
      engine.storyCut(art);
      index = to;
    }, 500);
    void motion.finished.then(
      () => (turning = false),
      () => (turning = false),
    );
  }

  // The storybook opens with its first page turn.
  $effect(() => {
    queueMicrotask(() => turnTo(0));
    return () => window.clearTimeout(cutTimer);
  });

  // Turn the page on its own once there has been time to read it.
  $effect(() => {
    if (index < 0 || turning) return;
    const at = index;
    const id = window.setTimeout(() => turnTo(at + 1), hold * (reduced ? 1.3 : 1));
    return () => window.clearTimeout(id);
  });

  // Read each page aloud when the player has asked for that.
  $effect(() => {
    if (index < 0) return;
    const text = page.text;
    if (!settings.value.readAloud || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  });

  $effect(() => {
    void index;
    queueMicrotask(() => next?.focus({ preventScroll: true }));
  });

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      turnTo(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      turnTo(index + 1);
    }
  }

  /** A torn top edge for the caption page, the same every time. */
  const torn = (() => {
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const points: string[] = [];
    for (let x = 0; x <= 100; x += 2.5) points.push(`${x}% ${(rnd() * 7).toFixed(1)}px`);
    return `polygon(${points.join(", ")}, 100% 100%, 0% 100%)`;
  })();

  /** Dad's ink doodle for each page, in his navy pen: drawn in, stroke by stroke. */
  const DOODLES: Record<StoryArt, string[]> = {
    home: [
      "M18 66 C 18 44, 36 28, 56 28 C 76 28, 92 44, 92 64 C 92 84, 76 96, 56 96 C 36 96, 18 86, 18 66 Z",
      "M24 58 C 40 52, 66 54, 88 50",
      "M44 30 L 44 18 L 54 10 L 64 18 L 64 30",
      "M51 30 L 51 23 L 57 23 L 57 30",
      "M84 14 C 92 16, 94 28, 86 32 C 92 26, 90 18, 84 14 Z",
    ],
    bench: [
      "M30 90 C 32 82, 58 82, 60 90 Z",
      "M44 84 L 34 52 L 62 30",
      "M48 84 L 38 54 L 64 34",
      "M60 22 C 64 18, 72 18, 76 22 L 92 42 C 86 50, 74 54, 68 52 L 58 32 C 56 28, 57 24, 60 22 Z",
      "M70 54 C 70 62, 84 62, 88 48",
      "M82 64 L 88 70 M76 68 L 78 76 M88 56 L 96 58",
    ],
    door: [
      "M22 94 L 22 14 L 64 14 L 64 94",
      "M64 14 L 84 22 L 84 88 L 64 94",
      "M78 54 C 80 52, 82 54, 80 56",
      "M28 30 L 40 24 M28 48 L 44 46 M28 66 L 42 70",
      "M10 94 L 96 94",
    ],
    letters: [
      "M14 40 L 62 36 L 64 72 L 16 76 Z",
      "M14 40 L 40 58 L 62 36",
      "M40 56 C 36 52, 32 58, 40 64 C 48 58, 44 52, 40 56 Z",
      "M70 76 C 70 52, 96 52, 96 76",
      "M66 78 L 100 78",
      "M80 66 C 80 64, 84 64, 84 66",
    ],
    milo: [
      "M30 46 C 30 30, 70 30, 70 46 C 70 62, 30 62, 30 46 Z",
      "M42 46 C 42 42, 47 42, 47 46 C 47 50, 42 50, 42 46 Z M54 46 C 54 42, 59 42, 59 46 C 59 50, 54 50, 54 46 Z",
      "M50 30 L 50 18 M46 14 C 46 10, 54 10, 54 14 C 54 18, 46 18, 46 14 Z",
      "M28 70 L 72 70 L 72 92 L 28 92 Z",
      "M80 78 C 86 72, 94 76, 92 84 M84 92 L 90 86",
      "M8 84 L 18 78 L 20 90 Z",
    ],
    go: [
      "M46 94 L 46 52",
      "M26 52 L 66 52 L 66 30 C 66 18, 26 18, 26 30 Z",
      "M66 30 L 74 30 L 74 12 L 88 16 L 74 22",
      "M32 40 L 48 40",
      "M12 94 L 90 94",
    ],
  };
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="story" class:open={index >= 0} role="dialog" tabindex="-1" aria-modal="true" aria-label={STORY.label} onclick={() => turnTo(index + 1)}>
  <div class="bar top" aria-hidden="true"></div>
  <div class="bar bottom" aria-hidden="true"></div>
  <p class="story-tag" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M12 3 C 7 3, 5 7, 5 10 C 5 14, 9 15, 9 18 L 15 18 C 15 15, 19 14, 19 10 C 19 7, 17 3, 12 3 Z M10 21 L 14 21" /></svg>
    {STORY.label}
  </p>

  {#if index >= 0}
    <div class="caption" style:clip-path={torn}>
      <span class="tape left" aria-hidden="true"></span>
      <span class="tape right" aria-hidden="true"></span>
      {#key index}
        <svg class="doodle" viewBox="0 0 104 104" aria-hidden="true">
          {#each DOODLES[page.art] as d, i (i)}<path d={d} pathLength="1" style:--i={i} />{/each}
        </svg>
        <div class="text">
          <p class="words" aria-live="polite">
            {#each words as word, i (i)}<span style:--i={i}>{word}</span>{" "}{/each}
          </p>
        </div>
        <svg class="timer" viewBox="0 0 400 8" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2 4 C 90 2, 180 6, 260 4 C 320 3, 360 5, 398 4" pathLength="1" style:animation-duration={`${hold * (reduced ? 1.3 : 1)}ms`} />
        </svg>
      {/key}
      <div class="foot">
        <span class="count" aria-hidden="true">
          {#each pages as p, i (p.art)}<i class:on={i <= index}></i>{/each}
          <b>{index + 1} / {pages.length}</b>
        </span>
        <button type="button" class="skip" onclick={(e) => (e.stopPropagation(), finish())}>{STORY.skip}</button>
        <button type="button" class="btn amber next" bind:this={next} onclick={(e) => (e.stopPropagation(), turnTo(index + 1))}>
          {last ? STORY.begin : STORY.next}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 C 9 11.6, 14 12.2, 18 12 M13 6.5 C 15 8.5, 17 10.5, 19 12 C 17 13.5, 15 15.5, 13 17.5" /></svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- The turning page: a sheet of Dad's grid paper, carrying the next page's doodle. -->
  <div class="sheet" bind:this={sheet} aria-hidden="true">
    <svg class="sheet-doodle" viewBox="0 0 104 104">
      {#each DOODLES[pages[incoming]!.art] as d, i (i)}<path d={d} />{/each}
    </svg>
    <span class="sheet-folio">{incoming + 1}</span>
  </div>
</div>

<style>
  .story {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: auto;
    cursor: pointer;
    overflow: hidden;
    /* A soft vignette, so the words read over any shot. */
    background: radial-gradient(ellipse 85% 75% at 50% 42%, transparent 55%, rgba(16, 12, 30, 0.42) 100%);
  }
  /* Letterbox bars: the story is a little film. */
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 8vh;
    background: #120f22;
    animation: bar-in 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .bar.top {
    top: 0;
    --from: -100%;
  }
  .bar.bottom {
    bottom: 0;
    --from: 100%;
  }
  /* A rubber stamp on the film's edge. */
  .story-tag {
    position: absolute;
    left: clamp(16px, 3vw, 40px);
    top: calc(8vh - 17px);
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 6px 14px 6px 10px;
    border: 2.5px double rgba(255, 226, 174, 0.85);
    border-radius: 6px;
    color: #ffe2ae;
    background: #120f22;
    font: 700 0.8rem/1.2 var(--label);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    rotate: -2deg;
    animation: fade-in 0.6s ease 0.9s both;
  }
  .story-tag svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---------- The torn page with the words ---------- */
  .caption {
    position: absolute;
    left: 50%;
    bottom: calc(8vh - 26px);
    width: min(860px, calc(100vw - 32px));
    box-sizing: border-box;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: 22px;
    padding: 26px 30px 16px 26px;
    background-color: #fbf6ec;
    background-image:
      linear-gradient(90deg, transparent 120px, rgba(192, 87, 62, 0.32) 120px 122px, transparent 122px),
      repeating-linear-gradient(0deg, rgba(70, 110, 140, 0.11) 0 1px, transparent 1px 24px),
      repeating-linear-gradient(90deg, rgba(70, 110, 140, 0.07) 0 1px, transparent 1px 24px),
      var(--grain);
    filter: drop-shadow(0 18px 26px rgba(10, 8, 24, 0.5)) drop-shadow(0 3px 0 rgba(43, 38, 34, 0.35));
    cursor: default;
    translate: -50% 0;
    rotate: -0.6deg;
    animation: caption-in 0.5s cubic-bezier(0.25, 1.3, 0.45, 1) both;
  }
  .tape {
    position: absolute;
    top: 2px;
    width: 92px;
    height: 24px;
    background: var(--tape);
    border-left: 1px dashed var(--tape-edge);
    border-right: 1px dashed var(--tape-edge);
  }
  .tape.left {
    left: 38px;
    rotate: -5deg;
  }
  .tape.right {
    right: 46px;
    rotate: 4deg;
  }
  .doodle {
    grid-row: span 2;
    width: 84px;
    height: 84px;
    fill: none;
    stroke: var(--dad-ink);
    stroke-width: 3.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    overflow: visible;
  }
  .doodle path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw 0.5s ease-out calc(0.15s + var(--i) * 0.16s) forwards;
  }
  .words {
    margin: 0;
    min-height: 2.7em;
    font: 400 clamp(1.15rem, 1.65vw, 1.5rem) / 1.38 var(--hand);
    color: var(--ink);
  }
  /* The words ink in one after another, like a pen across the page. */
  .words span {
    display: inline-block;
    animation: ink 0.42s ease-out calc(0.1s + var(--i) * 0.055s) both;
  }
  .timer {
    position: absolute;
    left: 26px;
    right: 30px;
    bottom: 6px;
    width: calc(100% - 56px);
    height: 6px;
    overflow: visible;
  }
  .timer path {
    fill: none;
    stroke: rgba(35, 63, 115, 0.45);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: draw linear forwards;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 8px;
  }
  .count {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
  }
  .count i {
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    border: 2px solid rgba(35, 63, 115, 0.4);
    border-radius: 50% 45% 55% 50%;
  }
  .count i.on {
    border-color: var(--dad-ink);
    background: var(--dad-ink);
  }
  .count b {
    margin-left: 6px;
    color: var(--ink-soft);
    font: 700 1rem/1 var(--hand);
  }
  .skip {
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    background: none;
    color: var(--ink-soft);
    font: 700 1.05rem var(--hand);
    text-decoration: underline 2px wavy rgba(43, 38, 34, 0.3);
    text-underline-offset: 5px;
    cursor: pointer;
  }
  .skip:hover {
    color: var(--ink);
  }
  .next svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ---------- The turning page ---------- */
  .sheet {
    position: absolute;
    inset: -6vh -4vw;
    z-index: 2;
    pointer-events: none;
    transform: translateX(110%);
    transform-origin: 0% 50%;
    background-color: #f6efe1;
    background-image:
      linear-gradient(90deg, rgba(43, 38, 34, 0.28), rgba(43, 38, 34, 0.06) 3%, transparent 9%, transparent 91%, rgba(255, 255, 255, 0.5) 97%, rgba(43, 38, 34, 0.18)),
      repeating-linear-gradient(0deg, rgba(70, 110, 140, 0.12) 0 1px, transparent 1px 30px),
      repeating-linear-gradient(90deg, rgba(70, 110, 140, 0.12) 0 1px, transparent 1px 30px),
      var(--grain);
    box-shadow:
      -40px 0 70px rgba(8, 6, 18, 0.45),
      40px 0 70px rgba(8, 6, 18, 0.45);
    will-change: transform;
  }
  .sheet-doodle {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(34vh, 300px);
    translate: -50% -55%;
    fill: none;
    stroke: rgba(35, 63, 115, 0.22);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .sheet-folio {
    position: absolute;
    right: calc(4vw + 48px);
    bottom: calc(6vh + 36px);
    color: rgba(43, 38, 34, 0.45);
    font: 700 2.2rem/1 var(--hand);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @keyframes bar-in {
    from {
      transform: translateY(var(--from));
    }
  }
  @keyframes caption-in {
    from {
      opacity: 0;
      translate: -50% 30px;
    }
  }
  @keyframes ink {
    from {
      opacity: 0;
      transform: translateY(5px) rotate(-2deg);
      filter: blur(2px);
    }
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  :global(:root[data-motion="reduce"]) :is(.bar, .story-tag, .caption, .words span, .doodle path) {
    animation: none;
  }
  :global(:root[data-motion="reduce"]) .doodle path {
    stroke-dashoffset: 0;
  }
  @media (max-width: 640px) {
    .caption {
      grid-template-columns: 1fr;
      padding: 22px 14px 14px;
      rotate: 0deg;
      background-image:
        repeating-linear-gradient(0deg, rgba(70, 110, 140, 0.11) 0 1px, transparent 1px 24px),
        var(--grain);
    }
    .doodle {
      display: none;
    }
    .foot {
      flex-wrap: wrap;
      gap: 8px;
    }
    .next {
      flex: 1;
    }
  }
</style>
