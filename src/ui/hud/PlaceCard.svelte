<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { audio } from "../../audio/audio";
  import { PLACE_COPY, PLACE_IDS, placeFlag } from "../../content/places";
  import type { Engine } from "../../game/engine";
  import { settings } from "../settings.svelte";

  /**
   * Names a place when the player walks into it, the way a map label appears.
   * The first visit gets the full card: "New place found", the name, one line
   * about it and a row of dots for every place on the planet. Later visits
   * show just the name, smaller and shorter.
   */
  interface Props {
    engine: Engine;
    hidden: boolean;
  }
  let { engine, hidden }: Props = $props();

  interface Shown {
    id: string;
    name: string;
    line: string;
    first: boolean;
    found: Set<string>;
    key: number;
  }
  let shown = $state<Shown | null>(null);
  const shot = new URLSearchParams(location.search).has("shot");
  let timer = 0;
  let count = 0;

  $effect(() => {
    const off = engine.bus.on("player:zone", ({ zone }) => {
      if (!zone) return;
      const copy = PLACE_COPY[zone];
      if (!copy) return;
      const flag = placeFlag(zone);
      const first = !engine.store.value.flags.includes(flag);
      if (first) {
        engine.store.update((s) => {
          if (!s.flags.includes(flag)) s.flags.push(flag);
        });
        // A new place: a small bright phrase in the music, on the next beat.
        if (!shot) audio.sting();
      }
      if (hidden || shot) return;
      const flags = engine.store.value.flags;
      count += 1;
      shown = { id: zone, ...copy, first, found: new Set(PLACE_IDS.filter((id) => flags.includes(placeFlag(id)))), key: count };
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (shown = null), first ? 4600 : 2200);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  });

  $effect(() => {
    if (hidden) shown = null;
  });
</script>

{#if shown && !hidden}
  {#key shown.key}
    <div
      class="place"
      class:first={shown.first}
      role="status"
      aria-live="polite"
      in:fly={{ y: -10, duration: settings.reducedMotion ? 0 : 420 }}
      out:fade={{ duration: settings.reducedMotion ? 0 : 400 }}
    >
      <span class="string" aria-hidden="true"></span>
      {#if shown.first}
        <span class="kick">New place found</span>
      {/if}
      <span class="name">{shown.name}</span>
      {#if shown.first}
        <span class="line">{shown.line}</span>
        <span class="tally">
          <span class="dots" aria-hidden="true">
            {#each PLACE_IDS as id (id)}<b class:on={shown.found.has(id)} class:new={id === shown.id}></b>{/each}
          </span>
          <span class="sum">{shown.found.size} of {PLACE_IDS.length} places</span>
        </span>
      {/if}
    </div>
  {/key}
{/if}

<style>
  /* A paper tag that swings down on a string, the way Dad labels his models. */
  .place {
    position: fixed;
    left: 50%;
    top: max(26px, env(safe-area-inset-top));
    translate: -50% 0;
    z-index: 3;
    display: grid;
    justify-items: center;
    gap: 4px;
    width: max-content;
    max-width: min(520px, calc(100vw - 40px));
    box-sizing: border-box;
    padding: 14px 30px 14px;
    background-color: #fbf4e4;
    background-image: var(--grain);
    border: var(--outline);
    border-radius: 10px 10px 14px 14px;
    box-shadow: var(--lift), 0 26px 40px -20px rgba(10, 6, 20, 0.75);
    color: var(--ink);
    text-align: center;
    pointer-events: none;
    transform-origin: 50% -26px;
    animation: swing 1.4s var(--ease-out) both;
  }
  /* The string and the punched hole it hangs from. */
  .string {
    position: absolute;
    top: -30px;
    left: 50%;
    width: 2px;
    height: 36px;
    margin-left: -1px;
    background: #8c6a3a;
  }
  .string::after {
    content: "";
    position: absolute;
    left: -6px;
    bottom: -8px;
    width: 10px;
    height: 10px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: #6e5a44;
  }
  @keyframes swing {
    0% {
      opacity: 0;
      transform: translateY(-40px) rotate(-8deg);
    }
    30% {
      opacity: 1;
      transform: translateY(0) rotate(5deg);
    }
    55% {
      transform: rotate(-2.5deg);
    }
    78% {
      transform: rotate(1deg);
    }
    100% {
      transform: rotate(-0.5deg);
    }
  }
  .kick {
    margin-top: 4px;
    padding: 4px 10px 3px;
    border: 2.5px solid var(--clay);
    border-radius: 4px;
    color: var(--clay);
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    rotate: -2deg;
  }
  .name {
    font: 700 1.6rem/1.1 var(--hand);
  }
  .first .name {
    font-size: clamp(2rem, 4.4vw, 2.6rem);
  }
  :global(:root[data-font="dyslexic"]) .name {
    font-family: var(--read);
  }
  .line {
    max-width: 34ch;
    font: 400 1rem/1.4 var(--read);
    color: var(--ink-soft);
  }
  .tally {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dots b {
    width: 10px;
    height: 10px;
    box-sizing: border-box;
    border: 2px solid rgba(43, 38, 34, 0.35);
    border-radius: 50%;
  }
  .dots b.on {
    border-color: var(--ink);
    background: var(--amber);
  }
  .dots b.new {
    animation: found 0.9s 0.5s var(--ease-out) both;
  }
  @keyframes found {
    from {
      transform: scale(0.2);
      background: #fffaf0;
    }
    55% {
      transform: scale(1.7);
    }
  }
  .sum {
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  :global(:root[data-motion="reduce"]) .place,
  :global(:root[data-motion="reduce"]) .dots b.new {
    animation: none;
  }
  @media (max-width: 640px) {
    .place {
      top: calc(max(12px, env(safe-area-inset-top)) + 196px);
      padding: 10px 18px 12px;
    }
    .first .name {
      font-size: 1.8rem;
    }
    .line {
      font-size: 0.92rem;
    }
    .dots {
      gap: 3px;
    }
    .dots b {
      width: 8px;
      height: 8px;
    }
  }
</style>
