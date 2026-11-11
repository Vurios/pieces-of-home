<script lang="ts">
  import { audio } from "../../audio/audio";
  import { STORY } from "../../content/story";
  import { settings } from "../settings.svelte";
  import { STORY_ART } from "./StoryArt";

  /**
   * The short story before a new game: a few pages of Dad's drawings that ink
   * themselves in, each with a line or two. Pages turn on their own after
   * enough time to read, or with Next, a click, a tap or any key.
   * Escape (or gamepad B) skips the lot.
   */
  interface Props {
    ondone: () => void;
  }
  let { ondone }: Props = $props();

  let index = $state(0);
  let next: HTMLButtonElement | null = $state(null);
  const pages = STORY.pages;
  const page = $derived(pages[index]!);
  const last = $derived(index === pages.length - 1);
  /** Long enough to read at a slow pace: a base plus a little for every word. */
  const hold = $derived(2600 + page.text.split(/\s+/).length * 330);
  let finished = false;

  /** Adds pathLength and a stagger index to every ink shape so it can draw itself in. Dashed lines fade in instead. */
  function inkify(svg: string): string {
    let n = 0;
    return svg.replace(/<(path|circle|rect)\b([^>]*)>/g, (whole: string, tag: string, rest: string) =>
      rest.includes('class="keep"') ? whole : `<${tag} pathLength="1" style="--n:${n++}"${rest}>`,
    );
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    ondone();
  }

  function go(step: 1 | -1): void {
    const to = index + step;
    if (to < 0) return;
    if (to >= pages.length) return finish();
    index = to;
    audio.ui("page");
  }

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

<div class="story" role="dialog" aria-modal="true" aria-label={STORY.label}>
  <div class="bench" aria-hidden="true"></div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="card" onclick={() => go(1)}>
    <span class="tape a" aria-hidden="true"></span>
    <span class="tape b" aria-hidden="true"></span>
    {#key index}
      <figure class="page">
        <svg class="art" viewBox="0 0 480 300" aria-hidden="true">
          <g class="wash">{@html STORY_ART[page.art].wash}</g>
          <g class="ink">{@html inkify(STORY_ART[page.art].ink)}</g>
        </svg>
        <figcaption aria-live="polite">{page.text}</figcaption>
      </figure>
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
    display: grid;
    place-items: center;
    padding: max(24px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
    pointer-events: auto;
    animation: fade-in 0.5s ease both;
  }
  /* Dad's bench at night, under the lamp. */
  .bench {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 55% at 50% 42%, rgba(255, 196, 120, 0.28), transparent 70%),
      repeating-linear-gradient(180deg, transparent 0 166px, rgba(20, 10, 6, 0.5) 166px 168px, transparent 168px 170px),
      linear-gradient(100deg, #4a3326, #3d2a20 50%, #33231b);
  }
  .card {
    position: relative;
    width: min(780px, 100%);
    max-height: 100%;
    box-sizing: border-box;
    padding: 22px 26px 18px;
    background-color: #fbf4e4;
    background-image:
      linear-gradient(rgba(64, 108, 170, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(64, 108, 170, 0.08) 1px, transparent 1px),
      var(--grain);
    background-size: 22px 22px, 22px 22px, 180px 180px;
    border-radius: 4px;
    box-shadow:
      0 2px 0 #e2d4b8,
      0 4px 0 #d6c6a6,
      0 40px 70px -26px rgba(0, 0, 0, 0.8);
    rotate: -0.6deg;
    cursor: pointer;
    animation: card-in 0.7s var(--ease-spring) both;
  }
  .tape {
    position: absolute;
    top: -14px;
    width: 110px;
    height: 28px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
  }
  .tape.a {
    left: 40px;
    rotate: -6deg;
  }
  .tape.b {
    right: 44px;
    rotate: 5deg;
    background: rgba(196, 220, 196, 0.75);
  }
  .page {
    margin: 0;
    display: grid;
    gap: 14px;
    animation: turn-in 0.55s var(--ease-out) both;
  }
  .art {
    display: block;
    width: 100%;
    max-height: min(52vh, 440px);
    overflow: visible;
  }
  .wash {
    transform: translate(4px, 5px);
    opacity: 0;
    animation: wash-in 0.9s 0.9s ease forwards;
  }
  .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ink :global(:is(path, circle, rect):not(.keep)) {
    stroke-dasharray: 1 1.02;
    stroke-dashoffset: 1;
    animation: draw 0.9s calc(var(--n) * 70ms) cubic-bezier(0.6, 0, 0.3, 1) forwards;
  }
  .ink :global(.keep) {
    opacity: 0;
    animation: wash-in 0.6s 1.2s ease forwards;
  }
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes wash-in {
    to {
      opacity: 1;
    }
  }
  figcaption {
    min-height: 2.7em;
    font: 700 clamp(1.25rem, 2.4vw, 1.65rem) / 1.3 var(--hand);
    color: var(--ink);
    text-align: center;
    text-wrap: balance;
  }
  :global(:root[data-font="dyslexic"]) figcaption {
    font: 700 1.15rem/1.45 var(--read);
  }
  /* A pencil line that fills while the page waits to turn by itself. */
  .timer {
    display: block;
    margin-top: 10px;
    height: 3px;
    width: 100%;
    background: rgba(242, 165, 65, 0.85);
    border-radius: 2px;
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
  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(40px) rotate(3deg) scale(0.95);
    }
  }
  @keyframes turn-in {
    from {
      opacity: 0;
      transform: translateX(26px) rotate(1deg);
    }
  }
  :global(:root[data-motion="reduce"]) .story,
  :global(:root[data-motion="reduce"]) .card,
  :global(:root[data-motion="reduce"]) .page {
    animation: none;
  }
  :global(:root[data-motion="reduce"]) .wash,
  :global(:root[data-motion="reduce"]) .ink :global(*) {
    animation: none;
    opacity: 1;
    stroke-dashoffset: 0;
  }
  @media (max-width: 640px) {
    .card {
      padding: 18px 14px 12px;
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
