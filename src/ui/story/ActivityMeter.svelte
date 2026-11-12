<script lang="ts">
  import type { Engine } from "../../game/engine";

  /**
   * A small paper gauge under the mission card while an activity runs, for
   * example the sleeping rover's power in Chapter 3. No numbers, only a bar
   * and a little sun.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  let meter = $state<{ id: string; label: string; value: number } | null>(null);

  $effect(() =>
    engine.bus.on("activity:meter", ({ id, label, value }) => {
      meter = value === null ? null : { id, label, value };
    }),
  );
  $effect(() => engine.bus.on("world:loading", () => (meter = null)));

  const word = $derived(!meter ? "" : meter.value < 0.25 ? "Asleep" : meter.value < 0.8 ? "Waking up" : "Awake!");
</script>

{#if meter}
  <div class="meter" role="meter" aria-label={meter.label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={meter.value} aria-valuetext={word}>
    <svg class="sun" viewBox="0 0 24 24" aria-hidden="true" style="opacity: {0.35 + meter.value * 0.65}">
      <circle cx="12" cy="12" r="5" />
      {#each Array.from({ length: 8 }, (_, i) => i) as i (i)}
        <line x1="12" y1="2.5" x2="12" y2="5.5" transform="rotate({i * 45} 12 12)" />
      {/each}
    </svg>
    <div class="body">
      <p class="label">{meter.label} <span>{word}</span></p>
      <div class="bar"><b style="width: {Math.max(4, meter.value * 100)}%"></b></div>
    </div>
  </div>
{/if}

<style>
  .meter {
    position: fixed;
    left: 22px;
    top: 222px;
    width: 300px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--grain), var(--paper-light);
    box-shadow: var(--shadow-card);
    transform: rotate(-0.6deg);
    animation: in 0.4s var(--ease-spring);
    z-index: 5;
  }
  .sun {
    width: 30px;
    height: 30px;
    flex: none;
    fill: var(--amber);
    stroke: var(--amber-deep);
    stroke-width: 2;
    stroke-linecap: round;
    transition: opacity 0.4s;
  }
  .body {
    flex: 1;
  }
  .label {
    margin: 0 0 6px;
    display: flex;
    justify-content: space-between;
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .label span {
    color: var(--clay-deep);
  }
  .bar {
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 7px;
    background: var(--card-sunk);
    overflow: hidden;
  }
  .bar b {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(-45deg, var(--amber) 0 7px, #f6be6a 7px 12px);
    transition: width 0.3s var(--ease-out);
  }
  @keyframes in {
    from {
      opacity: 0;
      translate: -20px 0;
    }
  }
</style>
