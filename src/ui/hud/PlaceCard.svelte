<script lang="ts">
  import { fade, fly } from "svelte/transition";
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
      {#if shown.first}
        <span class="kick"><i aria-hidden="true"></i>New place found<i aria-hidden="true"></i></span>
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
  .place {
    position: fixed;
    left: 50%;
    top: max(22px, env(safe-area-inset-top));
    translate: -50% 0;
    z-index: 3;
    display: grid;
    justify-items: center;
    gap: 4px;
    width: max-content;
    max-width: min(560px, calc(100vw - 32px));
    padding: 14px 34px 16px;
    color: #fff7ea;
    text-align: center;
    text-shadow: 0 2px 14px rgba(20, 12, 30, 0.6);
    pointer-events: none;
  }
  /* A soft pool of dusk behind the words, so they read over any part of the world. */
  .place::before {
    content: "";
    position: absolute;
    inset: -18px -40px;
    z-index: -1;
    background: radial-gradient(closest-side, rgba(22, 18, 44, 0.55), rgba(22, 18, 44, 0.32) 55%, transparent);
  }
  .kick {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 700 0.74rem/1 var(--read);
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #f6c47c;
  }
  .kick i {
    width: 7px;
    height: 7px;
    background: #f6c47c;
    rotate: 45deg;
    border-radius: 1px;
  }
  .name {
    font: italic 400 1.7rem/1.1 var(--serif);
    letter-spacing: -0.005em;
  }
  .first .name {
    font-size: clamp(2rem, 4.4vw, 2.7rem);
  }
  .line {
    max-width: 34ch;
    font: 600 1rem/1.4 var(--read);
    color: rgba(255, 247, 234, 0.9);
  }
  .tally {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }
  .dots {
    display: flex;
    gap: 5px;
  }
  .dots b {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 247, 234, 0.45);
  }
  .dots b.on {
    border-color: #f2a541;
    background: #f2a541;
  }
  .dots b.new {
    animation: found 0.9s 0.35s var(--ease-out) both;
  }
  @keyframes found {
    from {
      transform: scale(0.2);
      background: #fff7ea;
    }
    55% {
      transform: scale(1.6);
    }
  }
  .sum {
    font: 700 0.78rem/1 var(--read);
    letter-spacing: 0.04em;
    color: rgba(255, 247, 234, 0.82);
  }
  :global(:root[data-motion="reduce"]) .dots b.new {
    animation: none;
  }
  @media (max-width: 640px) {
    .place {
      top: calc(max(12px, env(safe-area-inset-top)) + 186px);
      padding: 10px 18px 12px;
    }
    .first .name {
      font-size: 1.9rem;
    }
    .line {
      font-size: 0.94rem;
    }
    .dots {
      gap: 4px;
    }
    .dots b {
      width: 7px;
      height: 7px;
    }
  }
</style>
