<script lang="ts">
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";

  /**
   * The moonquake listener's paper strip (Chapter 1, second letter). Near the
   * listener, each jump makes the pen jump too: a tiny "moonquake". Three good
   * jumps and Remi keeps the squiggle for the notebook. A toy, so no numbers.
   */
  interface Props {
    engine: Engine;
    game: GameState;
  }
  let { engine, game }: Props = $props();

  const LETTER = "a11-letter-seismometer";
  const FLAG = "a11-squiggle";
  const WIDTH = 360;
  let near = $state(false);
  let spikes = $state<{ x: number; a: number }[]>([]);
  let scroll = $state(0);

  const active = $derived(game.world === "tranquility" && game.delivered.includes(LETTER) && !game.flags.includes(FLAG));

  $effect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const at = engine.world?.anchor("seismometer");
      near = at ? at.distanceTo(engine.playerHead()) < 4.2 : false;
      if (near) scroll += dt * 40;
    };
    frame = requestAnimationFrame(tick);
    const off = engine.bus.on("player:land", ({ speed }) => {
      if (!near) return;
      spikes = [...spikes, { x: scroll, a: Math.min(1, 0.35 + speed / 8) }];
      if (spikes.length === 3) {
        window.setTimeout(() => {
          engine.store.update((s) => void (s.flags.includes(FLAG) || s.flags.push(FLAG)));
          const head = engine.playerHead();
          engine.bus.emit("say", { speaker: "remi", name: "Remi", text: "It felt us! A tiny moonquake. I'll keep this squiggle.", at: [head.x, head.y, head.z] });
        }, 700);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      off();
    };
  });

  /** The pen's line: a calm wobble, with each jump as a quick shake that fades. */
  const line = $derived.by(() => {
    const points: string[] = [];
    for (let i = 0; i <= WIDTH; i += 3) {
      const t = scroll - (WIDTH - i);
      let y = Math.sin(t * 0.7) * 1.2 + Math.sin(t * 2.3) * 0.6;
      for (const s of spikes) {
        const d = t - s.x;
        if (d >= 0 && d < 40) y += Math.sin(d * 1.9) * 26 * s.a * Math.exp(-d / 9);
      }
      points.push(`${i},${(40 + y).toFixed(1)}`);
    }
    return points.join(" ");
  });
</script>

{#if active && near}
  <div class="strip" aria-label="The moonquake listener's paper strip. Jump to make it wiggle.">
    <p class="label">Moonquake listener <span>{spikes.length < 3 ? "Jump!" : "Got it!"}</span></p>
    <svg viewBox="0 0 {WIDTH} 80" aria-hidden="true">
      {#each [16, 40, 64] as y (y)}<line x1="0" x2={WIDTH} y1={y} y2={y} class="rule" />{/each}
      <polyline points={line} class="pen" />
      <circle cx={WIDTH} cy="40" r="4" class="nib" />
    </svg>
    <p class="dots">{#each [0, 1, 2] as i (i)}<b class:on={spikes.length > i}></b>{/each}</p>
  </div>
{/if}

<style>
  .strip {
    position: fixed;
    right: 120px;
    bottom: 40px;
    width: 400px;
    padding: 12px 18px 10px;
    background: var(--grain), #fffaf0;
    box-shadow: var(--shadow-card);
    transform: rotate(-1deg);
    animation: in 0.4s var(--ease-spring);
  }
  .label {
    margin: 0 0 4px;
    display: flex;
    justify-content: space-between;
    font: 700 0.8rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .label span {
    color: var(--clay-deep);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .rule {
    stroke: rgba(92, 115, 147, 0.25);
    stroke-width: 1;
  }
  .pen {
    fill: none;
    stroke: var(--dad-ink);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .nib {
    fill: var(--clay);
  }
  .dots {
    margin: 4px 0 0;
    display: flex;
    gap: 6px;
  }
  .dots b {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--pencil);
  }
  .dots b.on {
    background: var(--clay);
    border-color: var(--clay-deep);
  }
  @keyframes in {
    from {
      opacity: 0;
      translate: 0 20px;
    }
  }
</style>
