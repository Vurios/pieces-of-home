<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { type Goal, PROLOGUE, SEEN_NOTEBOOK, TIP_ORDER, type TipId, goalFor, tipFor } from "../../content/goals";
  import type { InputDevice, PromptInfo } from "../../game/core/events";
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";
  import Icon from "../Icon.svelte";
  import { settings } from "../settings.svelte";

  /**
   * Tells the player what to do. Three parts:
   * - a chapter card when play begins ("Prologue / The Workshop"),
   * - the goal card, always showing the one thing to do next, and where,
   * - short tips that teach one control at a time and finish when the player
   *   actually does it (walks, looks, uses something, opens the notebook).
   */
  interface Props {
    engine: Engine;
    game: Readonly<GameState>;
    hidden: boolean;
    notebookOpen: boolean;
  }
  let { engine, game, hidden, notebookOpen }: Props = $props();

  let device = $state<InputDevice>("keyboard");
  let prompt = $state<PromptInfo | null>(null);
  let steps = $state(0);
  let showChapter = $state(false);
  let tipShownAt = 0;
  let lookAtTipStart = 0;
  let now = $state(0);
  let celebrating = $state<Goal | null>(null);
  /** Fixed screenshot views (?shot=...) show the world without coaching on top. */
  const shot = new URLSearchParams(location.search).has("shot");

  const goal = $derived(goalFor(game, device));
  const done = $derived(new Set(settings.value.tipsDone));

  /**
   * The tip to show now. "Use" and "notebook" jump the queue when their moment
   * comes (a prompt is up, the letter is delivered); the rest go in order.
   */
  const tipId = $derived.by((): TipId | null => {
    if (!settings.value.tips || hidden || showChapter) return null;
    if (prompt && !done.has("use")) return "use";
    if (goal.id === "notebook" && !done.has("notebook")) return "notebook";
    for (const id of ["move", "look", "arrow"] as const) {
      if (done.has(id)) continue;
      if (id === "arrow" && goal.id !== "mailbox" && goal.id !== "lamp") continue;
      return id;
    }
    return null;
  });
  const tip = $derived(tipId ? tipFor(tipId, device, engine.input.bindings, keyLabel) : null);

  function keyLabel(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Arrow")) return code.slice(5);
    if (code.startsWith("Shift")) return "Shift";
    if (code === "Space") return "Space";
    return code;
  }

  function learn(id: TipId): void {
    if (done.has(id)) return;
    settings.update((s) => {
      if (!s.tipsDone.includes(id)) s.tipsDone = [...s.tipsDone, id];
    });
  }

  function skipTips(): void {
    settings.update((s) => {
      s.tips = false;
    });
  }

  // Engine signals: the input device, the use prompt, steps and uses.
  $effect(() => {
    device = engine.input.device;
    const offs = [
      engine.bus.on("input:device", ({ device: next }) => (device = next)),
      engine.bus.on("prompt:change", (next) => {
        prompt = next;
        if (next && tipId === "arrow") learn("arrow");
      }),
      engine.bus.on("player:step", () => {
        steps += 1;
        if (steps >= 4) learn("move");
      }),
      engine.bus.on("interact:done", () => learn("use")),
    ];
    return () => offs.forEach((off) => off());
  });

  // A slow clock for tips that finish on their own (look, arrow).
  $effect(() => {
    if (!tipId) return;
    tipShownAt = performance.now();
    lookAtTipStart = engine.input.lookTravel;
    const id = window.setInterval(() => {
      now = performance.now();
      const shown = (now - tipShownAt) / 1000;
      if (tipId === "look" && (engine.input.lookTravel - lookAtTipStart > 1.1 || shown > 12)) learn("look");
      if (tipId === "arrow" && shown > 9) learn("arrow");
    }, 250);
    return () => window.clearInterval(id);
  });

  // Opening the notebook after the first letter is a story beat, and a tip.
  $effect(() => {
    if (!notebookOpen) return;
    learn("notebook");
    if (goal.id === "notebook") {
      engine.store.update((s) => {
        if (!s.flags.includes(SEEN_NOTEBOOK)) s.flags.push(SEEN_NOTEBOOK);
      });
    }
  });

  // The chapter card, once per visit, when play first shows.
  let introduced = false;
  $effect(() => {
    if (hidden || introduced) return;
    introduced = true;
    showChapter = true;
    const id = window.setTimeout(() => (showChapter = false), settings.reducedMotion ? 2200 : 3400);
    return () => window.clearTimeout(id);
  });

  // When a goal is finished, the card shows a check for a moment before the next goal.
  const ORDER: Goal["id"][] = ["mailbox", "lamp", "notebook", "explore"];
  let last: Goal | null = null;
  $effect(() => {
    const next = goal;
    if (last && ORDER.indexOf(next.id) > ORDER.indexOf(last.id)) {
      celebrating = last;
      const id = window.setTimeout(() => (celebrating = null), 1400);
      last = next;
      return () => window.clearTimeout(id);
    }
    last = next;
  });
  const card = $derived(celebrating ?? goal);
  /** Finished steps: the one just done counts while it celebrates; exploring means all done. */
  const filled = $derived(celebrating ? card.step : card.id === "explore" ? card.steps : card.step - 1);
</script>

{#if !hidden && !shot}
  {#if showChapter}
    <div class="chapter" aria-hidden="true" transition:fade={{ duration: settings.reducedMotion ? 0 : 500 }}>
      <span class="ch-label">{PROLOGUE.label}</span>
      <span class="ch-name">{PROLOGUE.name}</span>
    </div>
  {/if}

  <section class="goal" class:done={celebrating !== null} aria-labelledby="goal-title" in:fly={{ x: -16, duration: settings.reducedMotion ? 0 : 400, delay: 300 }}>
    <p class="eyebrow-row">
      <span class="chap">{card.chapter}</span>
      <span class="count" aria-label={`Step ${card.step} of ${card.steps}`}>
        {#each Array.from({ length: card.steps }, (_, i) => i) as i (i)}<i class:on={i < filled} class:now={i === filled && card.id !== "explore"}></i>{/each}
      </span>
    </p>
    {#key card.id + (celebrating ? "-done" : "")}
      <div class="goal-body" in:fly={{ y: 8, duration: settings.reducedMotion ? 0 : 320 }}>
        <h2 id="goal-title">
          {#if celebrating}<span class="tick" aria-hidden="true"><Icon name="check" size={18} /></span>{/if}
          {card.title}
        </h2>
        <p class="detail" role="status" aria-live="polite">{celebrating ? "Done!" : card.detail}</p>
      </div>
    {/key}
  </section>

  {#if tip}
    {#key tip.id}
      <div class="tip" class:touch={device === "touch"} role="status" aria-live="polite" in:fly={{ y: 14, duration: settings.reducedMotion ? 0 : 360 }} out:fade={{ duration: settings.reducedMotion ? 0 : 180 }}>
        <span class="dots" aria-hidden="true">
          {#each TIP_ORDER as id (id)}<i class:on={done.has(id) || id === tipId}></i>{/each}
        </span>
        {#if tip.keys.length}
          <span class="caps" aria-hidden="true">
            {#each tip.keys as k, i (i)}<kbd class:wide={k.length > 2}>{k}</kbd>{/each}
          </span>
        {/if}
        <span class="tip-text">{#if tip.keys.length}<span class="sr-only">{tip.keys.join(" ")}. </span>{/if}{tip.text}</span>
        <button type="button" class="skip" onclick={skipTips}>Hide tips</button>
      </div>
    {/key}
  {/if}
{/if}

<style>
  /* ---------- Chapter card ---------- */
  .chapter {
    position: fixed;
    left: 50%;
    top: 22%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 6px;
    pointer-events: none;
    color: #fff7ea;
    text-align: center;
    text-shadow: 0 2px 18px rgba(20, 12, 30, 0.55);
    animation: chapter-in 1.1s var(--ease-out) both;
  }
  .ch-label {
    font: 700 0.85rem/1 var(--read);
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: #f6c47c;
  }
  .ch-name {
    font: italic 400 clamp(2.4rem, 6vw, 4rem) / 1.05 var(--serif);
  }
  .chapter::after {
    content: "";
    width: 90px;
    height: 1.5px;
    margin-top: 10px;
    background: linear-gradient(90deg, transparent, #f6c47c, transparent);
  }
  @keyframes chapter-in {
    from {
      opacity: 0;
      letter-spacing: 0.04em;
      transform: translateY(10px);
    }
  }

  /* ---------- Goal card ---------- */
  .goal {
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    left: max(16px, env(safe-area-inset-left));
    width: min(340px, calc(100vw - 32px));
    padding: 14px 18px 15px;
    border-radius: 18px;
    background: rgba(24, 22, 48, 0.66);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 18px 36px -18px rgba(0, 0, 0, 0.6);
    -webkit-backdrop-filter: blur(12px) saturate(1.1);
    backdrop-filter: blur(12px) saturate(1.1);
    color: #fbf3e4;
    pointer-events: none;
    transition:
      border-color 0.3s,
      box-shadow 0.3s;
  }
  .goal.done {
    border-color: rgba(156, 214, 140, 0.7);
    box-shadow:
      0 0 0 3px rgba(156, 214, 140, 0.2),
      0 18px 36px -18px rgba(0, 0, 0, 0.6);
  }
  .eyebrow-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 6px;
  }
  .chap {
    font: 700 0.68rem/1 var(--read);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #f6c47c;
  }
  .count {
    display: flex;
    gap: 4px;
  }
  .count i {
    width: 16px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.2);
    transition: background 0.4s;
  }
  .count i.on {
    background: #f2a541;
  }
  .count i.now {
    background: linear-gradient(90deg, #f2a541 40%, rgba(255, 255, 255, 0.2) 40%);
  }
  .goal h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font: 600 1.28rem/1.2 var(--serif);
    letter-spacing: -0.005em;
  }
  .tick {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #9cd68c;
    color: #173014;
  }
  .detail {
    margin: 5px 0 0;
    font: 400 0.92rem/1.45 var(--read);
    color: rgba(251, 243, 228, 0.8);
  }
  .done .detail {
    color: #b8e6ab;
    font-weight: 700;
  }

  /* ---------- Tips ---------- */
  .tip {
    position: fixed;
    left: 50%;
    bottom: calc(max(28px, env(safe-area-inset-bottom)) + 70px);
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: calc(100vw - 32px);
    padding: 10px 10px 10px 16px;
    border-radius: 999px;
    background: rgba(24, 22, 48, 0.74);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 16px 30px -14px rgba(0, 0, 0, 0.65);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    color: #fbf3e4;
    pointer-events: none;
  }
  .tip.touch {
    bottom: calc(max(24px, env(safe-area-inset-bottom)) + 170px);
  }
  .dots {
    display: grid;
    gap: 3px;
  }
  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.22);
  }
  .dots i.on {
    background: #f2a541;
  }
  .caps {
    display: flex;
    gap: 5px;
  }
  kbd {
    display: grid;
    place-items: center;
    min-width: 34px;
    height: 34px;
    padding: 0 8px;
    border-radius: 9px;
    background: linear-gradient(180deg, #fffaf0, #efe4d0);
    box-shadow:
      inset 0 -3px 0 rgba(43, 38, 34, 0.18),
      0 2px 0 rgba(0, 0, 0, 0.35);
    color: #2b2622;
    font: 700 0.92rem/1 var(--read);
    animation: press 2.4s ease-in-out infinite;
  }
  kbd:nth-child(2) {
    animation-delay: 0.15s;
  }
  kbd:nth-child(3) {
    animation-delay: 0.3s;
  }
  kbd:nth-child(4) {
    animation-delay: 0.45s;
  }
  kbd.wide {
    font-size: 0.82rem;
  }
  @keyframes press {
    0%,
    70%,
    100% {
      transform: translateY(0);
    }
    78% {
      transform: translateY(2px);
    }
  }
  .tip-text {
    font: 600 1rem/1.35 var(--read);
  }
  .skip {
    flex: none;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(251, 243, 228, 0.8);
    font: 600 0.82rem var(--read);
    cursor: pointer;
    pointer-events: auto;
  }
  .skip:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
  }
  :global(:root[data-motion="reduce"]) kbd,
  :global(:root[data-motion="reduce"]) .chapter {
    animation: none;
  }
  @media (max-width: 640px) {
    .goal {
      top: calc(max(12px, env(safe-area-inset-top)) + 58px);
      left: 12px;
      width: calc(100vw - 24px);
      padding: 11px 14px 12px;
    }
    .goal h2 {
      font-size: 1.1rem;
    }
    .detail {
      font-size: 0.85rem;
    }
    .tip {
      left: 12px;
      right: 12px;
      translate: none;
      border-radius: 20px;
      gap: 10px;
    }
    .tip-text {
      font-size: 0.9rem;
    }
    .chapter {
      top: 30%;
    }
  }
</style>
