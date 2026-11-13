<script lang="ts">
  import { audio } from "../../audio/audio";
  import { STORY } from "../../content/story";
  import type { Engine } from "../../game/engine";
  import { settings } from "../settings.svelte";

  /**
   * The short story before a new game, told in the world itself: each page
   * frames one shot of the little home planet (the planet at dusk, Dad's bench,
   * the workshop door, the little worlds under glass, Milo in pieces, the
   * mailbox), with the lamp light closing and opening between them and the
   * camera drifting slowly in. The words sit on a paper card between
   * letterbox bars. Pages turn on their own after enough time to read, or with
   * Next, a click, a tap or any key. Escape (or gamepad B) skips the lot. The
   * last shot is where the game starts, so the camera flies straight down to
   * Remi when the story ends.
   */
  interface Props {
    engine: Engine;
    ondone: () => void;
  }
  let { engine, ondone }: Props = $props();

  let index = $state(0);
  let next: HTMLButtonElement | null = $state(null);
  const pages = STORY.pages;
  const page = $derived(pages[index]!);
  const last = $derived(index === pages.length - 1);
  /** Long enough to read at a slow pace: a base plus a little for every word. */
  const hold = $derived(2800 + page.text.split(/\s+/).length * 330);
  let finished = false;

  function finish(): void {
    if (finished) return;
    finished = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    engine.storyEnd();
    ondone();
  }

  function go(step: 1 | -1): void {
    const to = index + step;
    if (to < 0) return;
    if (to >= pages.length) return finish();
    index = to;
    audio.ui("page");
  }

  // Each page frames its own shot in the world.
  $effect(() => {
    void engine.storyShot(page.art);
  });

  // Turn the page on its own once there has been time to read it.
  $effect(() => {
    const wait = hold * (settings.reducedMotion ? 1.3 : 1);
    const id = window.setTimeout(() => go(1), wait);
    return () => window.clearTimeout(id);
  });

  // Read each page aloud when the player has asked for that.
  $effect(() => {
    const text = page.text;
    if (!settings.value.readAloud || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  });

  $effect(() => {
    queueMicrotask(() => next?.focus({ preventScroll: true }));
  });

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  }
</script>

<svelte:window onkeydown={onkey} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="story" role="dialog" tabindex="-1" aria-modal="true" aria-label={STORY.label} onclick={() => go(1)}>
  <div class="bar top" aria-hidden="true"></div>
  <div class="bar bottom" aria-hidden="true"></div>
  <p class="story-tag" aria-hidden="true">{STORY.label}</p>
  <div class="card">
    {#key index}
      <p class="words" aria-live="polite">{page.text}</p>
      <span class="timer" aria-hidden="true" style:animation-duration={`${hold * (settings.reducedMotion ? 1.3 : 1)}ms`}></span>
    {/key}
    <div class="foot">
      <span class="dots" aria-hidden="true">
        {#each pages as p, i (p.art)}<i class:on={i <= index}></i>{/each}
      </span>
      <button type="button" class="skip" onclick={(e) => (e.stopPropagation(), finish())}>{STORY.skip}</button>
      <button type="button" class="btn amber next" bind:this={next} onclick={(e) => (e.stopPropagation(), go(1))}>
        {last ? STORY.begin : STORY.next}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12 C 9 11.6, 14 12.2, 18 12 M13 6.5 C 15 8.5, 17 10.5, 19 12 C 17 13.5, 15 15.5, 13 17.5" /></svg>
      </button>
    </div>
  </div>
</div>

<style>
  .story {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: auto;
    cursor: pointer;
    /* A soft vignette, so the words read over any shot. */
    background: radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(16, 12, 30, 0.45) 100%);
    animation: fade-in 0.6s ease both;
  }
  /* Letterbox bars: the story is a little film. */
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 7.5vh;
    background: #15122b;
    animation: bar-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .bar.top {
    top: 0;
    --from: -100%;
  }
  .bar.bottom {
    bottom: 0;
    --from: 100%;
  }
  .story-tag {
    position: absolute;
    left: clamp(16px, 3vw, 40px);
    top: calc(7.5vh + 18px);
    margin: 0;
    padding: 5px 12px;
    border: 2px solid #ffe2ae;
    border-radius: 6px;
    color: #ffe2ae;
    background: rgba(21, 18, 43, 0.55);
    font: 700 0.78rem/1.2 var(--label);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    rotate: -1.5deg;
    animation: fade-in 0.6s ease 0.5s both;
  }
  .card {
    position: absolute;
    left: 50%;
    bottom: calc(7.5vh + 18px);
    width: min(760px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 20px 26px 16px;
    background-color: #fbf6ec;
    background-image: var(--grain);
    border: 3px solid var(--ink);
    border-radius: 14px;
    box-shadow:
      0 6px 0 var(--ink),
      0 20px 44px rgba(10, 8, 24, 0.45);
    cursor: default;
    translate: -50% 0;
    rotate: -0.5deg;
    overflow: hidden;
    animation: card-in 0.6s cubic-bezier(0.25, 1.3, 0.45, 1) 0.3s both;
  }
  .words {
    margin: 0;
    min-height: 2.7em;
    font: 400 clamp(1.15rem, 1.7vw, 1.5rem) / 1.35 var(--hand);
    color: var(--ink);
    animation: words-in 0.5s ease both;
  }
  .timer {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 4px;
    width: 100%;
    background: var(--amber);
    transform-origin: left;
    animation: timer linear both;
  }
  @keyframes timer {
    from {
      transform: scaleX(0);
    }
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 12px;
  }
  .dots {
    display: flex;
    gap: 6px;
    margin-right: auto;
  }
  .dots i {
    width: 11px;
    height: 11px;
    box-sizing: border-box;
    border: 2px solid rgba(43, 38, 34, 0.45);
    border-radius: 50%;
  }
  .dots i.on {
    border-color: var(--ink);
    background: var(--amber);
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
  @keyframes card-in {
    from {
      opacity: 0;
      translate: -50% 40px;
    }
  }
  @keyframes words-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  :global(:root[data-motion="reduce"]) :is(.story, .bar, .story-tag, .card, .words) {
    animation: none;
  }
  @media (max-width: 640px) {
    .card {
      padding: 16px 14px 12px;
      rotate: 0deg;
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
