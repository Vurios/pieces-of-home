<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";

  /**
   * Chapter 2: Dad's wheel test (story game "wheels").
   *
   * A long tray of soft grey dust and three of Dad's test wheels: a smooth
   * one, a plain wire mesh one, and a mesh one with chevrons. Push each one
   * across. The smooth wheel spins and digs in, the plain mesh rolls but
   * slips, and the chevrons grip and roll right across. It is Dad's model
   * test (the real wheels are in fact lrv-wheels), so it makes no claim
   * about any other kind of real wheel.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  type Kind = "smooth" | "mesh" | "chevrons";
  const WHEELS: { id: Kind; name: string; result: string; reach: number; slip: number; sink: number }[] = [
    { id: "smooth", name: "Smooth wheel", result: "It just spins and digs itself in.", reach: 0.17, slip: 3.2, sink: 11 },
    { id: "mesh", name: "Mesh wheel", result: "It rolls, but it slips in the soft dust.", reach: 0.6, slip: 1.7, sink: 4 },
    { id: "chevrons", name: "Mesh with chevrons", result: "It grips and rolls right across!", reach: 0.94, slip: 1, sink: 0 },
  ];

  // The tray, in the picture's own units.
  const W = 600;
  const H = 230;
  const LEFT = 70;
  const RIGHT = 540;
  const TOP = 150;
  const R = 32;

  let open = $state<{ key: number } | null>(null);
  let chosen = $state<Kind>("smooth");
  let tested = $state<Kind[]>([]);
  let running = $state(false);
  let x = $state(0);
  let turn = $state(0);
  let sink = $state(0);
  let ruts = $state<{ kind: Kind; from: number; to: number; sink: number }[]>([]);
  let puffs = $state<{ id: number; x: number; y: number; r: number; o: number }[]>([]);
  let last = $state<string | null>(null);
  let doneButton = $state<HTMLButtonElement | null>(null);
  let pushButton = $state<HTMLButtonElement | null>(null);

  const wheel = $derived(WHEELS.find((w) => w.id === chosen)!);
  const allTested = $derived(WHEELS.every((w) => tested.includes(w.id)));
  const ask = $derived(
    running ? "Pushing..." : last ?? (tested.length === 0 ? "Push each wheel across the dust. Which one grips?" : "Try the next wheel."),
  );
  const realWheels = fact("lrv-wheels");
  const sx = (t: number): number => LEFT + R + t * (RIGHT - LEFT - R * 2);

  $effect(() =>
    engine.bus.on("story:game", (p) => {
      if (p.id !== "wheels") return;
      chosen = "smooth";
      tested = [];
      ruts = [];
      puffs = [];
      last = null;
      x = 0;
      turn = 0;
      sink = 0;
      running = false;
      open = { key: p.key };
      audio.ui("page");
      window.setTimeout(() => pushButton?.focus({ preventScroll: true }), 80);
    }),
  );

  function finish(): void {
    if (!open || !allTested) return;
    const key = open.key;
    open = null;
    audio.ui("tick");
    engine.bus.emit("story:game-done", { key });
  }

  const sfx = (name: string, level?: number): void => engine.bus.emit("sfx", { name, ...(level === undefined ? {} : { level }) });

  function choose(kind: Kind): void {
    if (running) return;
    chosen = kind;
    x = 0;
    turn = 0;
    sink = 0;
    last = null;
    audio.ui("pop");
  }

  let puffId = 0;
  function push(): void {
    if (running || !open) return;
    running = true;
    last = null;
    x = 0;
    sink = 0;
    const w = wheel;
    const start = performance.now();
    const length = settings.reducedMotion ? 600 : 2600;
    let crunch = 0;
    sfx("wheel-crunch", 0.7);
    const run = (now: number): void => {
      const t = Math.min(1, (now - start) / length);
      // It rolls out fast, then the dust decides how far it gets.
      const travel = w.reach * (1 - (1 - Math.min(1, t * 1.25)) ** 2);
      const before = x;
      x = travel;
      // A slipping wheel turns more than it moves.
      const roll = ((x - before) * (RIGHT - LEFT)) / R;
      turn += roll * w.slip + (w.slip > 1 && t > 0.35 ? 0.18 * w.slip * (1 - t) : 0);
      sink = w.sink * Math.min(1, t * 1.4);
      if (!settings.reducedMotion && Math.random() < (w.slip > 1 ? 0.7 : 0.25)) {
        puffs = [...puffs.slice(-24), { id: (puffId += 1), x: sx(x) - R * 0.6, y: TOP - 2 + sink * 0.4, r: 3 + Math.random() * 5, o: 0.7 }];
      }
      puffs = puffs.map((p) => ({ ...p, x: p.x - 1.4 * w.slip, y: p.y - 0.9, r: p.r + 0.25, o: p.o - 0.025 })).filter((p) => p.o > 0);
      crunch -= 1;
      if (crunch <= 0) {
        sfx("wheel-crunch", 0.35);
        crunch = 18;
      }
      if (t < 1) requestAnimationFrame(run);
      else {
        running = false;
        ruts = [...ruts.filter((r) => r.kind !== w.id), { kind: w.id, from: 0, to: x, sink: w.sink }];
        if (!tested.includes(w.id)) tested = [...tested, w.id];
        last = w.result;
        if (w.id === "chevrons") sfx("corner-sparkle", 0.6);
        // Then the next wheel waits, or the button to finish.
        const next = WHEELS.find((v) => !tested.includes(v.id));
        if (next) window.setTimeout(() => !running && choose(next.id), 1600);
        else window.setTimeout(() => doneButton?.focus({ preventScroll: true }), 80);
      }
    };
    requestAnimationFrame(run);
  }

  // Keys and the gamepad while the test is up. Remi stays put.
  $effect(() => {
    if (!open) return;
    engine.holdStill += 1;
    untrack(() => (banners.screens += 1));
    const onDown = (e: KeyboardEvent): void => {
      const keys = ["Digit1", "Digit2", "Digit3", "ArrowLeft", "ArrowRight", "KeyA", "KeyD", "KeyE", "Enter", "Space"];
      if (!keys.includes(e.code)) return;
      if ((e.code === "Enter" || e.code === "Space") && (e.target as Element | null)?.closest?.("button")) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      const i = WHEELS.findIndex((w) => w.id === chosen);
      if (e.code.startsWith("Digit")) choose(WHEELS[Number(e.code.slice(5)) - 1]!.id);
      else if (e.code === "ArrowLeft" || e.code === "KeyA") choose(WHEELS[(i + 2) % 3]!.id);
      else if (e.code === "ArrowRight" || e.code === "KeyD") choose(WHEELS[(i + 1) % 3]!.id);
      else if (allTested && !running) finish();
      else push();
    };
    window.addEventListener("keydown", onDown, true);
    let frame = 0;
    let padA = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      const a = Boolean(pad?.buttons[0]?.pressed);
      if (a && !padA) {
        if (allTested && !running) finish();
        else push();
      }
      padA = a;
    };
    frame = requestAnimationFrame(poll);
    return () => {
      engine.holdStill = Math.max(0, engine.holdStill - 1);
      banners.screens = Math.max(0, banners.screens - 1);
      window.removeEventListener("keydown", onDown, true);
      cancelAnimationFrame(frame);
    };
  });

  /** The tray's dust: a soft wavy top. */
  const DUST = (() => {
    let d = `M${LEFT} ${TOP + 30} L${LEFT} ${TOP}`;
    for (let i = 0; i <= 24; i += 1) {
      const px = LEFT + ((RIGHT - LEFT) * i) / 24;
      d += ` L${px.toFixed(1)} ${(TOP + Math.sin(i * 1.7) * 1.6 + Math.sin(i * 0.6) * 1.2).toFixed(1)}`;
    }
    return `${d} L${RIGHT} ${TOP + 30} Z`;
  })();
  const CHEVRONS = Array.from({ length: 12 }, (_, i) => (i / 12) * 360);
</script>

{#snippet wheelArt(kind: Kind, r: number)}
  <circle {r} fill={kind === "smooth" ? "#A29E97" : "#8C9296"} stroke="#2B2622" stroke-width="2.5" />
  {#if kind !== "smooth"}
    <circle r={r * 0.84} fill="url(#weave)" stroke="#5E6468" stroke-width="1.5" />
  {/if}
  {#if kind === "chevrons"}
    {#each CHEVRONS as a (a)}
      <path d="M -4 {-r - 1} L 0 {-r + 4} L 4 {-r - 1}" transform="rotate({a})" fill="none" stroke="#F4F2EC" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    {/each}
  {/if}
  {#if kind === "smooth"}
    <path d="M {-r * 0.55} {-r * 0.5} A {r * 0.75} {r * 0.75} 0 0 1 {r * 0.2} {-r * 0.72}" fill="none" stroke="#fff" stroke-width="2" opacity="0.5" stroke-linecap="round" />
  {/if}
  <circle r={r * 0.3} fill="#4A4440" stroke="#2B2622" stroke-width="2" />
  <circle r={r * 0.12} fill="#C4C1BA" />
  <line x1="0" y1={-r * 0.3} x2="0" y2={-r * 0.82} stroke="#2B2622" stroke-width="2" opacity="0.5" />
{/snippet}

{#if open}
  <div class="game wheels" role="dialog" aria-live="polite" aria-label="Dad's wheel test">
    <p class="from"><span class="pin" aria-hidden="true"></span>Dad's wheel test</p>
    <p class="ask">{ask}</p>
    <svg class="tray" viewBox="0 0 {W} {H}" aria-hidden="true">
      <defs>
        <pattern id="weave" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="#7C8286" />
          <path d="M0 0 L0 7 M0 0 L7 0" stroke="#5E6468" stroke-width="2" />
        </pattern>
      </defs>
      <!-- The wooden tray on its trestles. -->
      <path d="M{LEFT - 22} {TOP + 30} L{RIGHT + 22} {TOP + 30} L{RIGHT + 16} {TOP + 52} L{LEFT - 16} {TOP + 52} Z" fill="#8A5A3A" stroke="#2B2622" stroke-width="3" stroke-linejoin="round" />
      <path d="M{LEFT - 10} {TOP + 41} L{RIGHT + 10} {TOP + 41}" stroke="#5E3B26" stroke-width="1.5" opacity="0.6" />
      <path d="M{LEFT - 22} {TOP - 8} L{LEFT - 22} {TOP + 30} M{RIGHT + 22} {TOP - 8} L{RIGHT + 22} {TOP + 30}" stroke="#2B2622" stroke-width="3" />
      <path d={DUST} fill="#B4AFA7" stroke="#2B2622" stroke-width="2.4" stroke-linejoin="round" />
      <!-- Ruts and tracks from the wheels tried so far. -->
      {#each ruts as r (r.kind)}
        {#if r.kind === "chevrons"}
          {#each Array.from({ length: Math.floor((sx(r.to) - sx(r.from)) / 14) }, (_, i) => i) as i (i)}
            <path d="M{sx(r.from) + i * 14 - 4} {TOP + 9} L{sx(r.from) + i * 14} {TOP + 5} L{sx(r.from) + i * 14 + 4} {TOP + 9}" fill="none" stroke="#8C877F" stroke-width="2" stroke-linecap="round" />
          {/each}
        {:else}
          <path d="M{sx(r.from)} {TOP + 3} L{sx(r.to) - R * 0.6} {TOP + 3 + r.sink * 0.3} Q {sx(r.to)} {TOP + 5 + r.sink} {sx(r.to) + R * 0.6} {TOP + 3}" fill="none" stroke="#8C877F" stroke-width={r.kind === "smooth" ? 5 : 3} stroke-linecap="round" />
        {/if}
      {/each}
      <!-- The finish line Dad chalked at the far end. -->
      <path d="M{RIGHT - 18} {TOP - 2} L{RIGHT - 18} {TOP + 26}" stroke="#F4ECDD" stroke-width="3" stroke-dasharray="4 4" />
      <text x={RIGHT - 18} y={TOP - 14} class="chalk" text-anchor="middle">far end</text>
      {#each puffs as p (p.id)}<circle cx={p.x} cy={p.y} r={p.r} fill="#D8D3CA" opacity={p.o} />{/each}
      <g transform="translate({sx(x)} {TOP - R + 6 + sink})">
        <g transform="rotate({(turn * 180) / Math.PI})">{@render wheelArt(chosen, R)}</g>
      </g>
      <!-- Dad's paper arrow: push this way. -->
      {#if !running && x === 0}
        <path d="M{LEFT + 90} {TOP - 62} L{LEFT + 150} {TOP - 62} M{LEFT + 138} {TOP - 72} L{LEFT + 152} {TOP - 62} L{LEFT + 138} {TOP - 52}" fill="none" stroke="#C8553D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      {/if}
    </svg>
    <div class="choices" role="radiogroup" aria-label="Pick a wheel">
      {#each WHEELS as w, i (w.id)}
        <button type="button" role="radio" aria-checked={chosen === w.id} class="choice" class:on={chosen === w.id} disabled={running} onclick={() => choose(w.id)}>
          <svg viewBox="-24 -24 48 48" aria-hidden="true">{@render wheelArt(w.id, 18)}</svg>
          <span>{w.name}</span>
          {#if tested.includes(w.id)}<span class="tick" aria-label="tested">✓</span>{/if}
          <kbd>{i + 1}</kbd>
        </button>
      {/each}
    </div>
    {#if allTested}
      <p class="real">{realWheels.kid}</p>
      <div class="row">
        <button type="button" class="btn amber got" bind:this={doneButton} onclick={finish}>The chevrons win! <kbd>E</kbd></button>
      </div>
    {:else}
      <div class="row">
        <button type="button" class="btn amber push" bind:this={pushButton} disabled={running} onclick={push}>Push it <kbd>E</kbd></button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .game {
    position: fixed;
    left: 50%;
    top: 50%;
    width: min(660px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    box-sizing: border-box;
    padding: 22px 28px 18px;
    transform: translate(-50%, -50%) rotate(-0.5deg);
    color: var(--ink);
    background: var(--grain), var(--card);
    border-top: 6px solid var(--clay);
    box-shadow: var(--shadow-card);
    animation: drop 0.5s var(--ease-spring);
    z-index: 30;
  }
  .game::before {
    content: "";
    position: absolute;
    top: -14px;
    left: 50%;
    width: 120px;
    height: 26px;
    margin-left: -60px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    transform: rotate(2deg);
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
  .pin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--clay);
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25);
  }
  .ask {
    margin: 0 0 8px;
    font: 400 1.2rem/1.4 var(--read);
    min-height: 1.6em;
  }
  .tray {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 0 10px;
    background: linear-gradient(#efe6d4, #e6dbc6);
    border: 2px solid var(--ink);
    border-radius: 4px;
  }
  .chalk {
    fill: #8a8378;
    font: 700 15px/1 var(--hand);
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }
  .choice {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 8px 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 8px 10px 9px 7px;
    background: #fbf6ec;
    color: var(--ink);
    font: 700 0.95rem/1.15 var(--read);
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      background 0.15s;
  }
  .choice svg {
    width: 48px;
    height: 48px;
  }
  .choice:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .choice.on {
    background: #f7dfa8;
    box-shadow: 0 3px 0 var(--ink);
  }
  .choice:disabled {
    cursor: default;
    opacity: 0.75;
  }
  .choice kbd {
    position: absolute;
    top: 6px;
    left: 8px;
    font: 700 0.7rem/1 var(--label);
    opacity: 0.6;
  }
  .tick {
    position: absolute;
    top: 4px;
    right: 8px;
    color: #4f7a3a;
    font: 700 1.1rem/1 var(--read);
  }
  .real {
    margin: 0 0 10px;
    padding: 8px 12px;
    background: #fff;
    border-left: 4px solid var(--amber);
    font: 400 1rem/1.4 var(--read);
  }
  .row {
    display: flex;
    justify-content: flex-end;
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) rotate(-2deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .game {
      animation: none;
    }
  }
</style>
