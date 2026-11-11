<script lang="ts">
  import type { Snippet } from "svelte";
  import { trap } from "./focus";
  import Icon, { type IconName } from "./Icon.svelte";
  import { t } from "./settings.svelte";

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

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }
</script>

<div class="scrim" aria-hidden="true" onpointerdown={onclose}></div>
<div class="wrap">
  <div class={`sheet card ${width}`} role="dialog" aria-modal="true" aria-labelledby={id} tabindex="-1" use:trap onkeydown={onkey}>
    <header>
      {#if icon}<span class="badge" aria-hidden="true"><Icon name={icon} size={24} /></span>{/if}
      <div class="titles">
        <h2 {id}>{title}</h2>
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
    background: radial-gradient(ellipse at 50% 40%, rgba(29, 30, 60, 0.35), rgba(12, 11, 26, 0.6));
    animation: dim 0.3s ease both;
  }
  .wrap {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
    pointer-events: none;
  }
  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: min(780px, calc(100dvh - 40px));
    pointer-events: auto;
    overflow: hidden;
    animation: rise 0.42s var(--ease-out) both;
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
  /* A warm line along the top edge, like lamplight on the card. */
  .sheet::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 4px;
    background: linear-gradient(90deg, transparent, var(--amber) 30%, #f7c776 60%, transparent);
    opacity: 0.85;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 26px 24px 18px 28px;
    border-bottom: 1px solid var(--line);
  }
  .badge {
    flex: none;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: var(--amber-wash);
    color: var(--amber-deep);
  }
  .badge :global(.icon) {
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
    margin: 0;
    font: 600 1.7rem/1.1 var(--serif);
    letter-spacing: -0.01em;
  }
  .lede {
    margin: 6px 0 0;
    color: var(--ink-soft);
    font-size: 0.95rem;
    line-height: 1.45;
  }
  .close {
    flex: none;
    align-self: flex-start;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: var(--card-sunk);
    color: var(--ink);
    cursor: pointer;
    transition: background 0.15s, transform 0.2s var(--ease-spring);
  }
  .close :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .close:hover {
    background: #e8dfcf;
    transform: rotate(90deg);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 20px 28px 28px;
    font-size: 1rem;
    line-height: 1.5;
    scrollbar-width: thin;
    scrollbar-color: rgba(43, 38, 34, 0.25) transparent;
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
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(18px) scale(0.98);
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
      padding: 10px;
      align-items: end;
    }
    .sheet {
      max-height: calc(100dvh - 20px);
    }
    header {
      padding: 20px 16px 14px 18px;
    }
    .body {
      padding: 16px 18px 22px;
    }
    h2 {
      font-size: 1.45rem;
    }
  }
</style>
