<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";
  import CardHead from "./card/CardHead.svelte";
  import GameAsk from "./card/GameAsk.svelte";
  import GameSteps from "./card/GameSteps.svelte";

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
  const WHEELS: { id: Kind; name: string; step: string; short: string; result: string; reach: number; slip: number; sink: number }[] = [
    { id: "smooth", name: "Smooth wheel", step: "Smooth", short: "Digs in", result: "It just spins and digs itself in.", reach: 0.17, slip: 3.2, sink: 11 },
    { id: "mesh", name: "Mesh wheel", step: "Mesh", short: "Slips", result: "It rolls, but it slips in the soft dust.", reach: 0.6, slip: 1.7, sink: 4 },
    { id: "chevrons", name: "Mesh with chevrons", step: "Chevrons", short: "Grips!", result: "It grips and rolls right across!", reach: 0.94, slip: 1, sink: 0 },
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
  /** The wheel pushed last, to tint Remi's line. */
  let lastKind = $state<Kind | null>(null);
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
      lastKind = null;
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
    lastKind = null;
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
        lastKind = w.id;
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
  /** Little grains on top of the dust, for texture only. */
  const GRAINS = Array.from({ length: 34 }, (_, i) => {
    const r = (n: number): number => {
      const v = Math.sin(i * 61.3 + n * 11.7) * 15731.743;
      return v - Math.floor(v);
    };
    return { x: LEFT + 6 + r(1) * (RIGHT - LEFT - 12), y: TOP + 8 + r(2) * 18, r: 0.8 + r(3) * 1.6 };
  });
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
  <div class="gc-scrim"></div>
  <div class="game wheels gc gc-moon" role="dialog" aria-label="Dad's wheel test">
    <CardHead kicker="Dad's wheel test" title="Which wheel grips the dust?" stamp="Model">
      {#snippet badge()}
        <svg viewBox="-24 -24 48 48">{@render wheelArt("chevrons", 17)}</svg>
      {/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={ask} tone={running || !lastKind ? null : lastKind === "chevrons" ? "good" : "oops"} />
      <div class="gc-stage tray-stage">
        <svg class="tray" viewBox="0 -40 {W} {H + 40}" aria-hidden="true">
          <defs>
            <pattern id="weave" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#7C8286" />
              <path d="M0 0 L0 7 M0 0 L7 0" stroke="#5E6468" stroke-width="2" />
            </pattern>
            <linearGradient id="wt-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#E9EEF4" />
              <stop offset="1" stop-color="#D3DAE4" />
            </linearGradient>
            <radialGradient id="wt-lamp" cx="0.5" cy="0" r="0.9">
              <stop offset="0" stop-color="#FFF6DE" stop-opacity="0.95" />
              <stop offset="1" stop-color="#FFF6DE" stop-opacity="0" />
            </radialGradient>
          </defs>
          <!-- Dad's workshop wall, cool and blue for the Moon chapter, with his drawings pinned up. -->
          <rect y="-40" width={W} height={TOP + 92} fill="url(#wt-wall)" />
          {#each [70, 150, 230, 370, 450, 530] as px (px)}<path d="M{px} -40 V{TOP + 52}" stroke="#C3CCD8" stroke-width="2" />{/each}
          <ellipse cx="300" cy="-40" rx="320" ry="190" fill="url(#wt-lamp)" />
          <g transform="translate(28 -26) rotate(-3)">
            <rect width="108" height="86" rx="2" fill="#FFFDF6" stroke="#2B2622" stroke-width="2" />
            <circle cx="54" cy="40" r="28" fill="#D9D6CF" stroke="#2B2622" stroke-width="2" />
            <circle cx="44" cy="32" r="6" fill="#BDB8AE" />
            <circle cx="64" cy="48" r="8" fill="#BDB8AE" />
            <circle cx="60" cy="26" r="3.5" fill="#BDB8AE" />
            <text x="54" y="80" class="pin-label" text-anchor="middle">moon dust</text>
            <circle cx="54" cy="3" r="4.5" fill="#C8553D" stroke="#2B2622" stroke-width="1.5" />
          </g>
          <g transform="translate(470 -24) rotate(4)">
            <rect width="104" height="80" rx="2" fill="#3F6C9C" stroke="#2B2622" stroke-width="2" />
            {#each [16, 32, 48, 64] as y (y)}<path d="M4 {y} H100" stroke="#fff" stroke-width="1" opacity="0.15" />{/each}
            <path d="M18 54 H86 M30 54 V40 H74 V54" fill="none" stroke="#fff" stroke-width="1.8" opacity="0.9" />
            <circle cx="30" cy="58" r="9" fill="none" stroke="#fff" stroke-width="1.8" />
            <circle cx="74" cy="58" r="9" fill="none" stroke="#fff" stroke-width="1.8" />
            <path d="M52 40 V22 M44 22 H60" stroke="#fff" stroke-width="1.8" opacity="0.9" />
            <circle cx="52" cy="3" r="4.5" fill="#C8553D" stroke="#2B2622" stroke-width="1.5" />
          </g>
          <!-- The bench under the tray. -->
          <path d="M0 {TOP + 52} H{W} V{H} H0 Z" fill="#A86E44" />
          <path d="M0 {TOP + 52} H{W}" stroke="#2B2622" stroke-width="2.5" />
          {#each [[40, TOP + 64], [260, TOP + 70], [430, TOP + 62]] as [px, py] (px)}<path d="M{px} {py} q 40 -4 80 0 t 80 0" fill="none" stroke="#8A5634" stroke-width="2" opacity="0.5" />{/each}
          <!-- The wooden tray on its trestles. -->
          <path d="M{LEFT - 22} {TOP + 30} L{RIGHT + 22} {TOP + 30} L{RIGHT + 16} {TOP + 52} L{LEFT - 16} {TOP + 52} Z" fill="#8A5A3A" stroke="#2B2622" stroke-width="3" stroke-linejoin="round" />
          <path d="M{LEFT - 10} {TOP + 41} L{RIGHT + 10} {TOP + 41}" stroke="#5E3B26" stroke-width="1.5" opacity="0.6" />
          <path d="M{LEFT - 22} {TOP - 8} L{LEFT - 22} {TOP + 30} M{RIGHT + 22} {TOP - 8} L{RIGHT + 22} {TOP + 30}" stroke="#2B2622" stroke-width="3" />
          <path d={DUST} fill="#B4AFA7" stroke="#2B2622" stroke-width="2.4" stroke-linejoin="round" />
          {#each GRAINS as g, i (i)}<circle cx={g.x} cy={g.y} r={g.r} fill="#9A958C" opacity="0.7" />{/each}
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
          <!-- The finish line Dad chalked at the far end, with a little flag. -->
          <path d="M{RIGHT - 18} {TOP - 2} L{RIGHT - 18} {TOP + 26}" stroke="#F4ECDD" stroke-width="3" stroke-dasharray="4 4" />
          <path d="M{RIGHT - 4} {TOP + 2} V{TOP - 40}" stroke="#2B2622" stroke-width="2.5" stroke-linecap="round" />
          <path d="M{RIGHT - 4} {TOP - 40} L{RIGHT + 14} {TOP - 34} L{RIGHT - 4} {TOP - 28} Z" fill="#C8553D" stroke="#2B2622" stroke-width="1.8" stroke-linejoin="round" />
          <text x={RIGHT - 30} y={TOP - 14} class="chalk" text-anchor="middle">far end</text>
          {#each puffs as p (p.id)}<circle cx={p.x} cy={p.y} r={p.r} fill="#D8D3CA" opacity={p.o} />{/each}
          <ellipse cx={sx(x)} cy={TOP + 4 + sink * 0.5} rx={R * 0.9} ry="4" fill="#2B2622" opacity="0.18" />
          <g transform="translate({sx(x)} {TOP - R + 6 + sink})">
            <g transform="rotate({(turn * 180) / Math.PI})">{@render wheelArt(chosen, R)}</g>
          </g>
          <!-- Dad's paper arrow: push this way. -->
          {#if !running && x === 0}
            <path class="nudge" d="M{LEFT + 90} {TOP - 62} L{LEFT + 150} {TOP - 62} M{LEFT + 138} {TOP - 72} L{LEFT + 152} {TOP - 62} L{LEFT + 138} {TOP - 52}" fill="none" stroke="#C8553D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          {/if}
        </svg>
      </div>
      <div class="gc-tiles three" role="radiogroup" aria-label="Pick a wheel">
        {#each WHEELS as w, i (w.id)}
          <button type="button" role="radio" aria-checked={chosen === w.id} class="gc-tile choice" disabled={running} onclick={() => choose(w.id)}>
            <svg viewBox="-24 -24 48 48" aria-hidden="true">{@render wheelArt(w.id, 20)}</svg>
            <span class="name">{w.name} <kbd>{i + 1}</kbd></span>
            {#if tested.includes(w.id)}<span class="verdict" class:win={w.id === "chevrons"}>{w.short}</span>{:else}<span class="verdict todo">Not tried yet</span>{/if}
          </button>
        {/each}
      </div>
      {#if allTested}<p class="gc-real"><span>True story</span>{realWheels.kid}</p>{/if}
      <div class="gc-foot">
        <GameSteps steps={WHEELS.map((w) => ({ label: w.step, done: tested.includes(w.id) }))} />
        <div class="gc-actions">
          {#if allTested}
            <button type="button" class="btn amber got" bind:this={doneButton} onclick={finish}>The chevrons win! <kbd>E</kbd></button>
          {:else}
            <button type="button" class="btn amber push" bind:this={pushButton} disabled={running} onclick={push}>Push it <kbd>E</kbd></button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .game.wheels {
    --gc-w: 800px;
  }
  .chalk {
    fill: #7a6a58;
    font: 700 15px/1 var(--hand);
  }
  .pin-label {
    fill: #2b2622;
    font: 700 13px/1 var(--hand);
  }
  .nudge {
    animation: nudge 1.1s ease-in-out infinite;
  }
  @keyframes nudge {
    50% {
      transform: translateX(8px);
    }
  }
  .gc-tiles.three {
    grid-template-columns: repeat(3, 1fr);
    margin-top: 12px;
  }
  .choice svg {
    width: 50px;
    height: 50px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .name kbd {
    padding: 1px 5px;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    font: 700 0.62rem/1.2 var(--label);
    opacity: 0.8;
  }
  .verdict {
    padding: 2px 8px;
    border-radius: 999px;
    background: #f6dccf;
    color: var(--clay-deep);
    font: 700 0.78rem/1.3 var(--read);
  }
  .verdict.win {
    background: #dcebd0;
    color: var(--sage-deep);
  }
  .verdict.todo {
    background: transparent;
    color: var(--ink-soft);
    font-weight: 400;
  }
  :global(:root[data-motion="reduce"]) .nudge {
    animation: none;
  }
</style>
