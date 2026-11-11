<script lang="ts">
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";

  /**
   * Story cards: Dad's handwritten notes on his lined paper, and true facts on
   * index cards with where they come from. A card stays until the player says
   * "Got it" (click, tap, E, Enter, Space or the gamepad's A), and the world
   * keeps going around it.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  interface Card {
    key: number;
    kind: "note" | "fact";
    text: string;
    source: string | null;
  }
  let card = $state<Card | null>(null);
  let button = $state<HTMLButtonElement | null>(null);

  $effect(() =>
    engine.bus.on("story:card", (p) => {
      card = { key: p.key, kind: p.kind, text: p.text, source: p.fact ? fact(p.fact).sourceTitle : null };
      audio.ui(p.kind === "note" ? "page" : "toast");
    }),
  );

  // Focus the button without scrolling, so Enter and Space work at once.
  $effect(() => {
    if (card && button) button.focus({ preventScroll: true });
  });

  function done(): void {
    if (!card) return;
    const key = card.key;
    card = null;
    audio.ui("tick");
    engine.bus.emit("story:card-done", { key });
  }

  $effect(() => {
    if (!card) return;
    const shownAt = performance.now();
    const onKey = (event: KeyboardEvent): void => {
      // A short pause first, so a key held from walking or delivering never skips a card unread.
      if (performance.now() - shownAt < 450) return;
      if (event.code === "KeyE" || event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        done();
      }
    };
    let frame = 0;
    let wasDown = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      const down = Boolean(pad?.buttons[0]?.pressed);
      if (down && !wasDown && performance.now() - shownAt > 450) done();
      wasDown = down;
    };
    window.addEventListener("keydown", onKey);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if card}
  {#key card.key}
    <div class="card {card.kind}" role="dialog" aria-live="polite" aria-label={card.kind === "note" ? "A note from Dad" : "A true fact"}>
      {#if card.kind === "note"}
        <p class="from">A note from Dad</p>
        <p class="text">{card.text}</p>
        <p class="sign">Dad</p>
      {:else}
        <p class="from"><span class="pin" aria-hidden="true"></span>True story</p>
        <p class="text">{card.text}</p>
        {#if card.source}<p class="source">From: {card.source}</p>{/if}
      {/if}
      <button type="button" class="btn amber got" bind:this={button} onclick={done}>Got it <kbd>E</kbd></button>
    </div>
  {/key}
{/if}

<style>
  .card {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    width: min(560px, calc(100vw - 32px));
    padding: 22px 28px 18px;
    transform: translateX(-50%) rotate(-0.8deg);
    color: var(--ink);
    box-shadow: var(--shadow-card);
    animation: drop 0.5s var(--ease-spring);
    z-index: 30;
  }
  .card::before {
    content: "";
    position: absolute;
    top: -12px;
    left: 50%;
    width: 120px;
    height: 26px;
    margin-left: -60px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    transform: rotate(-2deg);
  }
  .note {
    background:
      var(--grain),
      repeating-linear-gradient(to bottom, transparent 0 31px, rgba(92, 115, 147, 0.28) 31px 32px),
      linear-gradient(to right, transparent 0 46px, rgba(192, 87, 62, 0.35) 46px 47px, transparent 47px),
      var(--paper-light);
    background-position: 0 0, 0 14px, 0 0, 0 0;
  }
  .fact {
    background: var(--grain), var(--card);
    transform: translateX(-50%) rotate(0.7deg);
    border-top: 6px solid var(--sky);
  }
  .from {
    margin: 0 0 6px;
    font: 700 0.82rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .note .from {
    padding-left: 30px;
    color: var(--clay-deep);
  }
  .pin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--clay);
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25);
  }
  .text {
    margin: 0;
    font: 400 1.18rem/1.45 var(--read);
  }
  .note .text {
    padding-left: 30px;
    font: 700 1.45rem/32px var(--hand);
    color: var(--dad-ink);
  }
  .sign {
    margin: 2px 0 0;
    text-align: right;
    font: 700 1.3rem/1 var(--hand);
    color: var(--dad-ink);
    transform: rotate(-4deg);
  }
  .source {
    margin: 10px 0 0;
    font: 400 0.82rem/1.3 var(--read);
    color: var(--ink-soft);
  }
  .got {
    display: flex;
    margin: 12px 0 0 auto;
    align-items: center;
    gap: 10px;
  }
  kbd {
    font: 700 0.8rem/1 var(--label);
    padding: 3px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    opacity: 0.7;
  }
  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 30px;
    }
  }
  :global(:root[data-motion="reduce"]) .card {
    animation: none;
  }
</style>
