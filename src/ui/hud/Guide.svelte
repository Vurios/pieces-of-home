<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { type Goal, PROLOGUE, SEEN_NOTEBOOK, TIP_ORDER, type TipId, goalFor, tipFor } from "../../content/goals";
  import type { InputDevice, PromptInfo } from "../../game/core/events";
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";
  import { settings, t } from "../settings.svelte";
  import { banners } from "./banners.svelte";
  import { chapterForWorld } from "../../content/chapters";

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

  // The chapter card: when play first shows, and on arriving in each chapter world.
  // It names the chapter of the world Remi is in ("Chapter 1 / Tranquility Base").
  let introduced = "";
  let banner = $state<{ label: string; name: string }>({ label: PROLOGUE.label, name: PROLOGUE.name });
  $effect(() => {
    const world = game.world;
    if (hidden || introduced === world) return;
    const first = introduced === "";
    introduced = world;
    const chapter = chapterForWorld(world);
    if (shot || (!chapter && !first)) return;
    if (chapter) {
      const [label, name] = chapter.title.split(": ");
      banner = { label: label ?? chapter.title, name: name ?? chapter.place };
    } else banner = { label: PROLOGUE.label, name: PROLOGUE.name };
    showChapter = true;
    banners.chapter = true;
    // The stage stays taken until the card has finished fading out.
    let gone = 0;
    const id = window.setTimeout(() => {
      showChapter = false;
      gone = window.setTimeout(() => (banners.chapter = false), 600);
    }, settings.reducedMotion ? 2000 : 2800);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(gone);
      showChapter = false;
      banners.chapter = false;
    };
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
      <span class="tape a"></span>
      <span class="tape b"></span>
      <span class="ch-label">{banner.label}</span>
      <span class="ch-name">{banner.name}</span>
      <svg class="ch-line" viewBox="0 0 200 10" preserveAspectRatio="none"><path d="M2 6.5 C 40 3, 80 7.5, 120 4.6 C 150 2.8, 175 5.8, 198 4" /></svg>
    </div>
  {/if}

  <section class="goal" class:done={celebrating !== null} aria-labelledby="goal-title" in:fly={{ x: -16, duration: settings.reducedMotion ? 0 : 400, delay: 300 }}>
    <span class="pin" aria-hidden="true"></span>
    <p class="eyebrow-row">
      <span class="chap"><span class="mission">{t("goal.mission")}</span>{card.chapter}</span>
      <span class="count" aria-label={`Step ${card.step} of ${card.steps}`}>
        {#each Array.from({ length: card.steps }, (_, i) => i) as i (i)}<i class:on={i < filled} class:now={i === filled && card.id !== "explore"}></i>{/each}
      </span>
    </p>
    {#key card.id + (celebrating ? "-done" : "")}
      <div class="goal-body" in:fly={{ y: 8, duration: settings.reducedMotion ? 0 : 320 }}>
        <h2 id="goal-title">{card.title}</h2>
        <p class="detail" role="status" aria-live="polite">{celebrating ? "Done!" : card.detail}</p>
        {#if celebrating}<span class="done-stamp" aria-hidden="true">Done</span>{/if}
      </div>
    {/key}
  </section>

  {#if tip}
    {#key tip.id}
      <div class="tip" class:touch={device === "touch"} role="status" aria-live="polite" in:fly={{ y: 24, duration: settings.reducedMotion ? 0 : 420 }} out:fade={{ duration: settings.reducedMotion ? 0 : 180 }}>
        <span class="tape" aria-hidden="true"></span>
        <span class="how" aria-hidden="true">How to play</span>
        <div class="tip-row">
          {#if tip.id === "move" && tip.keys.length === 4}
            <span class="cluster" aria-hidden="true">
              <kbd class="k-up">{tip.keys[0]}</kbd>
              <kbd class="k-left">{tip.keys[1]}</kbd>
              <kbd class="k-down">{tip.keys[2]}</kbd>
              <kbd class="k-right">{tip.keys[3]}</kbd>
            </span>
          {:else if tip.keys[0] === "Mouse"}
            <svg class="doodle mouse" viewBox="0 0 64 56" aria-hidden="true">
              <path class="body" d="M32 8 C 42 8, 46 15, 46 24 L 46 36 C 46 46, 40 51, 32 51 C 24 51, 18 46, 18 36 L 18 24 C 18 15, 22 8, 32 8 Z" />
              <path d="M18 25 L 46 25 M32 8 L 32 25" />
              <path class="hot" d="M19 24 L 19 23 C 19 15, 23 9, 31 8.6 L 31 24 Z" />
              <path class="arrow" d="M6 30 L 0.8 30 M3.6 27 L 0.8 30 L 3.6 33 M58 30 L 63.2 30 M60.4 27 L 63.2 30 L 60.4 33" />
            </svg>
          {:else if tip.keys[0] === "Left stick" || tip.keys[0] === "Right stick"}
            <span class="stick-doodle" aria-hidden="true"><i></i><b>{tip.keys[0] === "Left stick" ? "L" : "R"}</b></span>
          {:else if device === "touch" && tip.keys.length === 0}
            <svg class="doodle finger" viewBox="0 0 64 56" aria-hidden="true">
              <path class="body" d="M24 50 C 18 45, 14 39, 13 34 C 12 31, 15 29, 18 31 L 22 35 L 22 12 C 22 8, 28 8, 28 12 L 28 26 L 28 22 C 28 18, 34 18, 34 22 L 34 27 C 34 23, 40 23, 40 27 L 40 30 C 40 27, 46 27, 46 30 L 46 40 C 46 46, 42 50, 38 50 Z" />
              <path class="arrow" d="M8 12 C 3 16, 3 22, 6 26 M50 10 C 56 13, 58 19, 56 24" />
            </svg>
          {:else if tip.keys.length}
            <span class="caps" aria-hidden="true">
              {#each tip.keys as k, i (i)}<kbd class:wide={k.length > 2}>{k}</kbd>{/each}
            </span>
          {/if}
          <span class="tip-text">{#if tip.keys.length}<span class="sr-only">{tip.keys.join(" ")}. </span>{/if}{tip.text}</span>
        </div>
        <span class="tip-foot">
          <span class="dots" aria-hidden="true">
            {#each TIP_ORDER as id (id)}<i class:on={done.has(id) || id === tipId}></i>{/each}
          </span>
          <button type="button" class="skip" onclick={skipTips}>Hide tips</button>
        </span>
      </div>
    {/key}
  {/if}
{/if}

<style>
  /* ---------- Chapter card: a strip of paper taped across the middle ---------- */
  .chapter {
    position: fixed;
    left: 50%;
    top: 16%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 14px 40px 12px;
    background-color: #fbf4e4;
    background-image: var(--grain);
    box-shadow:
      0 2px 0 #e2d4b8,
      0 30px 50px -20px rgba(10, 6, 20, 0.7);
    pointer-events: none;
    color: var(--ink);
    text-align: center;
    rotate: -1.2deg;
    animation: chapter-in 0.9s var(--ease-spring) both;
  }
  .chapter .tape {
    position: absolute;
    top: 50%;
    width: 70px;
    height: 26px;
    margin-top: -13px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
  }
  .chapter .tape.a {
    left: -36px;
    rotate: -8deg;
  }
  .chapter .tape.b {
    right: -36px;
    rotate: 6deg;
  }
  .ch-label {
    padding: 5px 12px 4px;
    border: 2.5px solid var(--clay);
    border-radius: 4px;
    color: var(--clay);
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.24em;
    text-transform: uppercase;
    rotate: -2deg;
  }
  .ch-name {
    margin-top: 6px;
    font: 700 clamp(1.8rem, 3.6vw, 2.5rem) / 1.05 var(--hand);
  }
  .ch-line {
    width: 70%;
    height: 10px;
    overflow: visible;
  }
  .ch-line path {
    fill: none;
    stroke: var(--amber);
    stroke-width: 5;
    stroke-linecap: round;
  }
  @keyframes chapter-in {
    from {
      opacity: 0;
      transform: translateY(-30px) scale(0.92);
      rotate: 4deg;
    }
  }

  /* ---------- Goal card: a note pinned to the corner ---------- */
  .goal {
    position: fixed;
    top: max(18px, env(safe-area-inset-top));
    left: max(18px, env(safe-area-inset-left));
    width: min(340px, calc(100vw - 36px));
    box-sizing: border-box;
    padding: 16px 18px 16px 30px;
    background-color: #fbf4e4;
    background-image:
      linear-gradient(90deg, transparent 17px, rgba(196, 80, 60, 0.42) 17px 18.5px, transparent 18.5px),
      repeating-linear-gradient(180deg, transparent 0 25px, rgba(64, 108, 170, 0.15) 25px 26px),
      var(--grain);
    background-position: 0 0, 0 12px, 0 0;
    border-radius: 3px;
    box-shadow:
      0 2px 0 #e2d4b8,
      0 18px 30px -16px rgba(10, 6, 20, 0.7);
    color: var(--ink);
    pointer-events: none;
    rotate: -0.8deg;
  }
  /* A push pin holding it up. */
  .pin {
    position: absolute;
    top: -7px;
    left: 50%;
    width: 16px;
    height: 16px;
    margin-left: -8px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #f08a6e, var(--clay) 55%, #7d2f20);
    box-shadow: 0 3px 3px rgba(0, 0, 0, 0.35);
  }
  .eyebrow-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 4px;
  }
  .chap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    font: 700 0.7rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  /* "Your mission", typed on a little red label like a flight checklist tab. */
  .mission {
    padding: 3px 6px 2px;
    border-radius: 2px;
    background: var(--clay-deep);
    color: var(--paper-light);
    letter-spacing: 0.14em;
  }
  /* Steps as little drawn boxes: ticked, the one you're on, and to come. */
  .count {
    display: flex;
    gap: 5px;
  }
  .count i {
    position: relative;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    border: 2px solid rgba(43, 38, 34, 0.55);
    border-radius: 3px 2px 4px 2px;
  }
  .count i.on {
    border-color: var(--ink);
    background: #f9d79a;
  }
  .count i.on::after {
    content: "";
    position: absolute;
    left: 2px;
    top: -4px;
    width: 6px;
    height: 11px;
    border: solid var(--clay);
    border-width: 0 3px 3px 0;
    rotate: 40deg;
  }
  .count i.now {
    border-color: var(--ink);
    background: #f9d79a;
    animation: now-pulse 1.6s ease-in-out infinite;
  }
  @keyframes now-pulse {
    50% {
      transform: scale(1.25);
    }
  }
  .goal-body {
    position: relative;
  }
  .goal h2 {
    margin: 0;
    font: 700 1.5rem/1.15 var(--hand);
  }
  :global(:root[data-font="dyslexic"]) .goal h2 {
    font: 700 1.2rem/1.2 var(--read);
  }
  .detail {
    margin: 4px 0 0;
    font: 400 0.95rem/1.45 var(--read);
    color: var(--ink-soft);
  }
  .done .detail {
    color: var(--sage-deep);
    font-weight: 700;
  }
  .done-stamp {
    position: absolute;
    right: -4px;
    top: -6px;
    padding: 4px 10px 3px;
    border: 3px solid var(--sage-deep);
    border-radius: 5px;
    color: var(--sage-deep);
    font: 700 1rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    rotate: -10deg;
    animation: thump 0.4s var(--ease-spring) both;
  }
  @keyframes thump {
    from {
      opacity: 0;
      scale: 1.8;
    }
  }

  /* ---------- Tips: a big taped card with drawn keys ---------- */
  .tip {
    position: fixed;
    left: 50%;
    bottom: calc(max(28px, env(safe-area-inset-bottom)) + 74px);
    translate: -50% 0;
    display: grid;
    gap: 8px;
    max-width: min(520px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px 20px 12px;
    background-color: #fffaf0;
    background-image: var(--grain);
    border: var(--outline);
    border-radius: var(--wobbly);
    box-shadow: var(--lift), 0 24px 40px -18px rgba(10, 6, 20, 0.75);
    color: var(--ink);
    pointer-events: none;
    rotate: 0.6deg;
  }
  .tip .tape {
    position: absolute;
    top: -14px;
    left: 50%;
    width: 90px;
    height: 24px;
    margin-left: -45px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
    rotate: -3deg;
  }
  .tip.touch {
    bottom: calc(max(24px, env(safe-area-inset-bottom)) + 170px);
  }
  .how {
    justify-self: start;
    padding: 3px 9px 2px;
    border: 2px solid var(--clay);
    border-radius: 4px;
    color: var(--clay);
    font: 700 0.7rem/1 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    rotate: -2deg;
  }
  .tip-row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .tip-text {
    font: 700 1.3rem/1.25 var(--hand);
  }
  :global(:root[data-font="dyslexic"]) .tip-text {
    font: 700 1.05rem/1.35 var(--read);
  }
  kbd {
    display: grid;
    place-items: center;
    min-width: 40px;
    height: 40px;
    box-sizing: border-box;
    padding: 0 8px;
    border: 2.2px solid var(--ink);
    border-bottom-width: 5px;
    border-radius: 10px 9px 11px 8px;
    background: #fffaf0;
    color: var(--ink);
    font: 700 1rem/1 var(--read);
    animation: press 2.4s ease-in-out infinite;
  }
  .caps {
    display: flex;
    gap: 6px;
  }
  .caps kbd {
    background: #f4b04e;
  }
  kbd.wide {
    font-size: 0.85rem;
  }
  /* W A S D laid out like the real keys, pressed in turn. */
  .cluster {
    flex: none;
    display: grid;
    grid-template-columns: repeat(3, 40px);
    grid-template-rows: 40px 40px;
    gap: 4px;
  }
  .k-up {
    grid-column: 2;
    grid-row: 1;
  }
  .k-left {
    grid-column: 1;
    grid-row: 2;
    animation-delay: 0.6s;
  }
  .k-down {
    grid-column: 2;
    grid-row: 2;
    animation-delay: 1.2s;
  }
  .k-right {
    grid-column: 3;
    grid-row: 2;
    animation-delay: 1.8s;
  }
  @keyframes press {
    0%,
    18%,
    100% {
      transform: translateY(0);
      background-color: #fffaf0;
    }
    6%,
    12% {
      transform: translateY(2px);
      background-color: #f4b04e;
    }
  }
  .caps kbd {
    animation-name: press-amber;
  }
  @keyframes press-amber {
    0%,
    70%,
    100% {
      transform: translateY(0);
    }
    78% {
      transform: translateY(2px);
    }
  }
  .doodle {
    flex: none;
    width: 64px;
    height: 56px;
    overflow: visible;
  }
  .doodle path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .doodle .body {
    fill: #fffaf0;
  }
  .doodle .hot {
    fill: #f4b04e;
    stroke-width: 0;
  }
  .doodle .arrow {
    stroke: var(--clay);
  }
  .mouse {
    animation: drag 2.4s ease-in-out infinite;
  }
  .finger {
    animation: drag 2.4s ease-in-out infinite;
  }
  @keyframes drag {
    25% {
      transform: translateX(-8px);
    }
    75% {
      transform: translateX(8px);
    }
  }
  .stick-doodle {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    box-sizing: border-box;
    border: 2.4px solid var(--ink);
    border-radius: 50%;
    background: #e9dfcc;
  }
  .stick-doodle i {
    position: absolute;
    width: 30px;
    height: 30px;
    box-sizing: border-box;
    border: 2.4px solid var(--ink);
    border-radius: 50%;
    background: #f4b04e;
    animation: wiggle 2s ease-in-out infinite;
  }
  .stick-doodle b {
    position: relative;
    font: 700 0.85rem/1 var(--read);
    animation: wiggle 2s ease-in-out infinite;
  }
  @keyframes wiggle {
    25% {
      transform: translate(-6px, -3px);
    }
    75% {
      transform: translate(6px, 2px);
    }
  }
  .tip-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .dots {
    display: flex;
    gap: 5px;
  }
  .dots i {
    width: 9px;
    height: 9px;
    box-sizing: border-box;
    border: 2px solid rgba(43, 38, 34, 0.45);
    border-radius: 50%;
  }
  .dots i.on {
    border-color: var(--ink);
    background: var(--amber);
  }
  .skip {
    flex: none;
    min-height: 36px;
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--ink-soft);
    font: 700 0.95rem var(--hand);
    text-decoration: underline 2px wavy rgba(43, 38, 34, 0.3);
    text-underline-offset: 5px;
    cursor: pointer;
    pointer-events: auto;
  }
  .skip:hover {
    color: var(--ink);
    text-decoration-color: var(--amber-deep);
  }
  :global(:root[data-motion="reduce"]) kbd,
  :global(:root[data-motion="reduce"]) .chapter,
  :global(:root[data-motion="reduce"]) .mouse,
  :global(:root[data-motion="reduce"]) .finger,
  :global(:root[data-motion="reduce"]) .stick-doodle i,
  :global(:root[data-motion="reduce"]) .stick-doodle b,
  :global(:root[data-motion="reduce"]) .count i.now,
  :global(:root[data-motion="reduce"]) .done-stamp {
    animation: none;
  }
  @media (max-width: 640px) {
    .goal {
      top: calc(max(12px, env(safe-area-inset-top)) + 76px);
      left: 12px;
      width: calc(100vw - 24px);
      padding: 12px 14px 12px 28px;
      rotate: -0.4deg;
    }
    .goal h2 {
      font-size: 1.25rem;
    }
    .detail {
      font-size: 0.86rem;
    }
    .tip {
      left: 12px;
      right: 12px;
      translate: none;
      max-width: none;
      padding: 14px 14px 10px;
    }
    .tip-row {
      gap: 12px;
    }
    .tip-text {
      font-size: 1.08rem;
    }
    .cluster {
      grid-template-columns: repeat(3, 34px);
      grid-template-rows: 34px 34px;
    }
    kbd {
      min-width: 34px;
      height: 34px;
    }
    .chapter {
      top: 34%;
      padding: 12px 28px 10px;
    }
  }
</style>
