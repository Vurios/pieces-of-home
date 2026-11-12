<script lang="ts">
  import type { Snippet } from "svelte";
  import { cubicIn } from "svelte/easing";
  import { fade } from "svelte/transition";
  import { trap } from "./focus";
  import Icon, { type IconName } from "./Icon.svelte";
  import { settings, t } from "./settings.svelte";

  /**
   * A warm card over the dimmed world, used for settings, credits, play
   * together and chapters. It always fits the screen: the header stays put and
   * the body scrolls, with soft fades where there is more to see. It is a real
   * modal dialog: focus stays inside, Escape closes it, focus returns after.
   */
  interface Props {
    title: string;
    lede?: string;
    icon?: IconName;
    onclose: () => void;
    children: Snippet;
    size?: "sm" | "md" | "lg";
    /** The body handles its own layout and scrolling (settings). */
    flush?: boolean;
    wide?: boolean;
  }
  let { title, lede, icon, onclose, children, size = "md", flush = false, wide = false }: Props = $props();
  const id = `panel-${Math.random().toString(36).slice(2, 8)}`;
  const width = $derived(wide ? "lg" : size);

  let body: HTMLElement | null = $state(null);
  let fadeTop = $state(false);
  let fadeBottom = $state(false);

  function measure(): void {
    if (!body) return;
    fadeTop = body.scrollTop > 4;
    fadeBottom = body.scrollTop + body.clientHeight < body.scrollHeight - 4;
  }

  $effect(() => {
    if (!body) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  });

  /** On the way out the sheet lifts off and fades, quicker than it came in. */
  function lift(_node: Element): { duration: number; easing: (t: number) => number; css: (t: number) => string } {
    return {
      duration: settings.reducedMotion ? 0 : 170,
      easing: cubicIn,
      css: (k) => `opacity: ${k}; transform: translateY(${(1 - k) * 14}px) rotate(-0.35deg) scale(${0.97 + 0.03 * k});`,
    };
  }

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }
</script>

<div class="scrim" aria-hidden="true" onpointerdown={onclose} out:fade|global={{ duration: settings.reducedMotion ? 0 : 200 }}></div>
<div class="wrap">
  <div class={`sheet card ${width}`} out:lift|global role="dialog" aria-modal="true" aria-labelledby={id} tabindex="-1" use:trap onkeydown={onkey}>
    <span class="tape left" aria-hidden="true"></span>
    <span class="tape right" aria-hidden="true"></span>
    <header>
      {#if icon}
        <span class="badge" aria-hidden="true">
          <svg class="ring" viewBox="0 0 60 60"><path d="M30 4.5 C 46 4, 56 15, 55.5 30 C 55 46, 44 55.5, 29.5 55.6 C 14 55.4, 4.6 45, 4.4 30.5 C 4.2 15, 15 4.9, 31.5 5.6" /></svg>
          <Icon name={icon} size={26} />
        </span>
      {/if}
      <div class="titles">
        <h2 {id}>{title}</h2>
        <svg class="underline" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6.5 C 40 3, 80 7.5, 120 4.6 C 150 2.8, 175 5.8, 198 4" /></svg>
        {#if lede}<p class="lede">{lede}</p>{/if}
      </div>
      <button type="button" class="close" onclick={onclose} aria-label={t("panel.close")}><Icon name="close" size={20} /></button>
    </header>
    {#if flush}
      <div class="flush">{@render children()}</div>
    {:else}
      <div class="body" class:fade-top={fadeTop} class:fade-bottom={fadeBottom} bind:this={body} onscroll={measure}>
        {@render children()}
      </div>
    {/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: radial-gradient(ellipse at 50% 40%, rgba(30, 18, 12, 0.35), rgba(16, 9, 6, 0.66));
    animation: dim 0.3s ease both;
  }
  .wrap {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: max(28px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
    pointer-events: none;
  }
  /* A sheet torn from Dad's notebook, taped over the world. */
  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: min(780px, calc(100dvh - 48px));
    pointer-events: auto;
    transform: rotate(-0.35deg);
    animation: drop 0.5s var(--ease-spring) both;
  }
  .sm {
    max-width: 480px;
  }
  .md {
    max-width: 600px;
  }
  .lg {
    max-width: 880px;
  }
  .tape {
    position: absolute;
    z-index: 2;
    top: -13px;
    width: 104px;
    height: 28px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
    clip-path: polygon(2% 6%, 98% 0, 100% 34%, 97% 62%, 100% 100%, 3% 95%, 0 66%, 2% 36%);
    pointer-events: none;
  }
  .tape.left {
    left: 26px;
    transform: rotate(-7deg);
  }
  .tape.right {
    right: 30px;
    transform: rotate(5deg);
    background: rgba(196, 220, 196, 0.75);
  }
  header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 28px 22px 14px 28px;
  }
  .badge {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    color: var(--ink);
  }
  .badge .ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: #f9d79a;
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .badge :global(.icon) {
    position: relative;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .titles {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 2px 0 0;
    font: 700 2rem/1.05 var(--hand);
    color: var(--ink);
  }
  :global(:root[data-font="dyslexic"]) h2 {
    font-family: var(--read);
    font-size: 1.6rem;
  }
  .underline {
    display: block;
    width: min(180px, 70%);
    height: 10px;
    margin-top: 2px;
    overflow: visible;
  }
  .underline path {
    fill: none;
    stroke: var(--amber);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .lede {
    margin: 8px 0 0;
    color: var(--ink-soft);
    font-size: 0.98rem;
    line-height: 1.45;
  }
  .close {
    flex: none;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border: var(--outline);
    border-radius: 50% 46% 52% 48%;
    background: #fffaf0;
    box-shadow: var(--lift);
    color: var(--ink);
    cursor: pointer;
    transition:
      transform 0.2s var(--ease-spring),
      box-shadow 0.15s,
      background 0.15s;
  }
  .close :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.8;
    stroke-linecap: round;
  }
  .close:hover {
    background: #f9d79a;
    transform: translateY(-2px) rotate(90deg);
    box-shadow: var(--lift-hi);
  }
  .close:active {
    transform: translateY(2px);
    box-shadow: var(--lift-lo);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px 28px 28px;
    font-size: 1rem;
    line-height: 1.5;
    scrollbar-width: thin;
    scrollbar-color: rgba(43, 38, 34, 0.35) transparent;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--ft, 0px), #000 calc(100% - var(--fb, 0px)), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, #000 var(--ft, 0px), #000 calc(100% - var(--fb, 0px)), transparent 100%);
  }
  .body.fade-top {
    --ft: 24px;
  }
  .body.fade-bottom {
    --fb: 36px;
  }
  .flush {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 0 0 var(--radius) var(--radius);
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(26px) rotate(2.5deg) scale(0.97);
    }
  }
  @keyframes dim {
    from {
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .sheet,
  :global(:root[data-motion="reduce"]) .scrim {
    animation: none;
  }
  @media (max-width: 640px) {
    .wrap {
      padding: 22px 10px 10px;
      align-items: end;
    }
    .sheet {
      max-height: calc(100dvh - 34px);
      transform: none;
    }
    header {
      padding: 24px 14px 10px 18px;
    }
    .body {
      padding: 8px 18px 22px;
    }
    h2 {
      font-size: 1.6rem;
    }
    .badge {
      width: 44px;
      height: 44px;
    }
  }
</style>
