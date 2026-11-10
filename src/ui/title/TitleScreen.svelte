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
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const p = engine.titleTag();
      if (p) tag = p;
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
  .chain:focus-visible {
    outline: 3px solid var(--paper-light);
    outline-offset: 2px;
    box-shadow: 0 0 0 6px rgba(43, 38, 34, 0.35);
  }
  .chain:active {
    cursor: grabbing;
  }
  .pull-hint {
    position: fixed;
    margin: -26px 0 0 70px;
    display: flex;
    align-items: center;
    gap: 2px;
    font: 700 1.3rem var(--hand);
    color: var(--paper-light);
    text-shadow: 0 2px 0 rgba(30, 20, 40, 0.6);
    pointer-events: none;
    animation: nudge 1.8s ease-in-out infinite;
  }
  .pull-hint svg path {
    fill: none;
    stroke: var(--paper-light);
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  @keyframes nudge {
    50% {
      transform: translateX(6px);
    }
  }
  :global(:root[data-motion="reduce"]) .pull-hint {
    animation: none;
  }
</style>
