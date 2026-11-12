<script lang="ts">
  import type { Engine } from "../../game/engine";
  import { flow } from "../flow.svelte";
  import { t } from "../settings.svelte";

  /**
   * The 2D side of the title: a Skip button during the flight, then an
   * accessible button laid over the 3D pull chain. Drag it down to pull,
   * or click, tap, press Enter or gamepad A.
   */
  interface Props {
    engine: Engine;
    onpull: () => void;
  }
  let { engine, onpull }: Props = $props();

  let ready = $state(false);
  let tag = $state({ x: -999, y: -999, visible: false });
  let dragStart: number | null = null;
  let dragged = 0;
  let chain: HTMLButtonElement | null = $state(null);

  $effect(() => {
    const offReady = engine.bus.on("title:ready", () => {
      ready = true;
      queueMicrotask(() => chain?.focus({ preventScroll: true }));
    });
    // The 3D tag swings on its chain, but the button, the outline and the
    // "Pull the chain" note hold still over where it hangs at rest.
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const p = engine.titleTag();
      if (p && (Math.hypot(p.x - tag.x, p.y - tag.y) > 1.5 || p.visible !== tag.visible)) tag = { x: Math.round(p.x), y: Math.round(p.y), visible: p.visible };
    };
    frame = requestAnimationFrame(tick);
    return () => {
      offReady();
      cancelAnimationFrame(frame);
    };
  });

  function skip(): void {
    engine.skipTitle();
  }

  function onkey(event: KeyboardEvent): void {
    if (flow.stage !== "title" || ready) return;
    if (event.key === "Tab" || event.key === "Shift") return;
    // Any key skips the flight.
    skip();
  }

  function down(event: PointerEvent): void {
    dragStart = event.clientY;
    dragged = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (dragStart === null) return;
    dragged = Math.max(0, (event.clientY - dragStart) / 140);
    engine.titleDrag(dragged);
  }

  function up(): void {
    if (dragStart === null) return;
    dragStart = null;
    engine.titleRelease();
    if (dragged > 0.3) pull();
  }

  function pull(): void {
    if (!ready) return;
    ready = false;
    onpull();
  }

  function click(): void {
    // A click with no real drag still pulls; a drag already pulled on release.
    if (dragged > 0.3) return;
    pull();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if !ready && flow.stage === "title"}
  <button type="button" class="skip btn quiet" onclick={skip}>{t("title.skip")}</button>
{/if}

{#if ready}
  <button
    bind:this={chain}
    type="button"
    class="chain"
    style:left={`${tag.x}px`}
    style:top={`${tag.y}px`}
    aria-label={t("title.pullLabel")}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclick={click}
  ></button>
  <p class="pull-hint" style:left={`${tag.x}px`} style:top={`${tag.y}px`} aria-hidden="true">
    <svg viewBox="0 0 80 40" width="80" height="40"><path d="M76 8 C 56 4, 30 8, 12 26 M12 26 L 24 25 M12 26 L 15 14" /></svg>
    <span>{t("title.pull")}</span>
  </p>
{/if}

<style>
  .skip {
    position: fixed;
    right: 24px;
    bottom: 24px;
    color: var(--paper-light);
    border-color: rgba(251, 246, 234, 0.7);
    font-size: 1rem;
  }
  .chain {
    position: fixed;
    width: 120px;
    height: 84px;
    margin: -52px 0 0 -60px;
    background: transparent;
    border: 0;
    border-radius: 14px;
    cursor: grab;
    touch-action: none;
  }
  :global(#ui) .chain:focus-visible {
    outline: 3px dashed #fffaf0;
    outline-offset: 2px;
  }
  .chain:active {
    cursor: grabbing;
  }
  /* "Pull the chain" on a paper tag, with Dad's pencil arrow. */
  .pull-hint {
    position: fixed;
    margin: -30px 0 0 66px;
    display: flex;
    align-items: center;
    gap: 2px;
    pointer-events: none;
  }
  .pull-hint span {
    padding: 6px 14px 7px;
    border: var(--outline);
    border-radius: var(--wobbly);
    background-color: #fffaf0;
    background-image: var(--grain);
    box-shadow: var(--lift), 0 12px 20px -10px rgba(10, 6, 20, 0.6);
    color: var(--ink);
    font: 700 1.3rem/1 var(--hand);
    white-space: nowrap;
    rotate: -3deg;
  }
  .pull-hint svg {
    filter: drop-shadow(0 2px 0 rgba(30, 20, 40, 0.7));
  }
  .pull-hint svg path {
    fill: none;
    stroke: #fffaf0;
    stroke-width: 3.2;
    stroke-linecap: round;
  }
</style>
