<script lang="ts">
  import { Vector3 } from "three";
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";
  import type { MapIcon, WorldMap } from "../../game/worlds/types";
  import { t } from "../settings.svelte";
  import MapGlyph from "./MapGlyph.svelte";
  import { type LocalView, localView, onGround } from "./projection";

  /**
   * The corner map: a round scrap of Dad's chart in a little compass, bottom
   * left, showing the ground round Remi from above. The way the camera looks
   * is always up the page. The next stop shows as a ring, or as an arrow on
   * the compass rim when it is farther away. Click it, or press M, for the
   * big globe.
   *
   * The ground is laid out once round an anchor point and then only slid and
   * turned each frame, so the map glides with Remi instead of stepping. It is
   * laid out again when Remi wanders a little way from the anchor, or when the
   * next stop or the save changes.
   */
  interface Props {
    engine: Engine;
    game: GameState;
    hidden: boolean;
    onopen: () => void;
  }
  let { engine, hidden, onopen }: Props = $props();

  /** How many meters from Remi to the rim. */
  const RANGE = 10;
  /** Radius of the ground, in map units (the compass rim sits outside it). */
  const LAND = 82;
  const SCALE = LAND / RANGE;
  /** Lay the ground out again once Remi is this many meters from the anchor. */
  const DRIFT = 1.5;
  const DEG = 180 / Math.PI;

  interface Drawn {
    id: string;
    icon: MapIcon | "unknown";
    x: number;
    y: number;
    letter: boolean;
  }
  // Raw: the world's own map object, compared by identity each frame.
  let map = $state.raw<WorldMap | null>(null);
  let marks = $state<Drawn[]>([]);
  let paths = $state<string[]>([]);
  let valleys = $state<{ d: string; w: number }[]>([]);
  let blobs = $state<{ x: number; y: number; r: number; kind: "crater" | "water" | "patch"; color: string }[]>([]);
  /** The next stop, in anchor units, or null. */
  let goalAt = $state<{ x: number; y: number } | null>(null);
  /** Where Remi stands in anchor units, and how far the view is turned (degrees). */
  let pose = $state({ x: 0, y: 0, turn: 0 });
  /** Remi's arrow and the north mark, in degrees on the page. */
  let heading = $state(0);
  let north = $state(0);
  let worldId = $state("");

  let anchor: LocalView | null = null;
  let stamp = "";
  const pole = new Vector3(0, 1, 0);
  const tmp = new Vector3();

  function layout(view: LocalView, m: WorldMap, objective: Vector3 | null): void {
    const flags = engine.store.value.flags;
    const delivered = engine.store.value.delivered;
    const reach = RANGE + DRIFT + 1.5;
    const drawn: Drawn[] = [];
    for (const mark of m.marks) {
      const g = onGround(view, mark.at);
      if (g.distance > reach) continue;
      drawn.push({ id: mark.id, icon: mark.found && !flags.includes(mark.found) ? "unknown" : mark.icon, x: g.x * SCALE, y: -g.y * SCALE, letter: Boolean(mark.letters?.some((l) => !delivered.includes(l))) });
    }
    marks = drawn;
    const lines: string[] = [];
    for (const line of m.paths ?? []) {
      let d = "";
      let pen = false;
      for (const p of line) {
        const g = onGround(view, p);
        if (g.distance > RANGE * 1.8) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${(g.x * SCALE).toFixed(1)} ${(-g.y * SCALE).toFixed(1)}`;
        pen = true;
      }
      if (d) lines.push(d);
    }
    paths = lines;
    const cuts: { d: string; w: number }[] = [];
    for (const v of m.valleys ?? []) {
      let d = "";
      let pen = false;
      for (const p of v.path) {
        const g = onGround(view, p);
        if (g.distance > RANGE * 2.2) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${(g.x * SCALE).toFixed(1)} ${(-g.y * SCALE).toFixed(1)}`;
        pen = true;
      }
      if (d) cuts.push({ d, w: v.width * SCALE });
    }
    valleys = cuts;
    const round: typeof blobs = [];
    const add = (list: { at: Vector3; radius: number; color?: string }[] | undefined, kind: "crater" | "water" | "patch", color: string): void => {
      for (const c of list ?? []) {
        const g = onGround(view, c.at);
        if (g.distance > reach + c.radius) continue;
        round.push({ x: g.x * SCALE, y: -g.y * SCALE, r: c.radius * SCALE, kind, color: c.color ?? color });
      }
    };
    add(m.patches, "patch", m.colors.shade);
    add(m.water, "water", m.colors.water ?? "#7FB3C8");
    add(m.craters, "crater", m.colors.shade);
    blobs = round;
    if (objective) {
      const g = onGround(view, tmp.copy(objective).normalize());
      goalAt = { x: g.x * SCALE, y: -g.y * SCALE };
    } else goalAt = null;
  }

  /** Angle of a direction on the anchor's page, in degrees clockwise from up. */
  function pageAngle(view: LocalView, d: Vector3): number {
    return Math.atan2(d.dot(view.right), d.dot(view.forward)) * DEG;
  }

  $effect(() => {
    if (hidden) return;
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const v = engine.mapView();
      if (map !== (v?.map ?? null)) {
        map = v?.map ?? null;
        anchor = null;
      }
      if (!v) return;
      worldId = v.worldId;
      const save = engine.store.value;
      const next = `${v.objective?.toArray().map((n) => n.toFixed(2)).join() ?? ""}|${save.delivered.length}|${save.flags.length}`;
      if (!anchor || anchor.up.dot(v.up) < Math.cos(DRIFT / v.map.radius) || next !== stamp) {
        anchor = localView(v.up, v.facing, v.map.radius);
        stamp = next;
        layout(anchor, v.map, v.objective);
      }
      const here = onGround(anchor, v.up);
      const x = here.x * SCALE;
      const y = -here.y * SCALE;
      const turn = pageAngle(anchor, v.facing);
      // Svelte only touches the page when something really moved.
      if (Math.abs(x - pose.x) > 0.04 || Math.abs(y - pose.y) > 0.04 || Math.abs(turn - pose.turn) > 0.08) pose = { x, y, turn };
      const h = pageAngle(anchor, v.heading) - turn;
      if (Math.abs(h - heading) > 0.1) heading = h;
      const n = tmp.copy(pole).addScaledVector(v.up, -v.up.y);
      const toNorth = n.lengthSq() < 1e-6 ? 0 : pageAngle(anchor, n) - turn;
      if (Math.abs(toNorth - north) > 0.1) north = toNorth;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  /** Turns an anchor point into a page point round Remi. */
  function spin(px: number, py: number): { x: number; y: number } {
    const a = -pose.turn / DEG;
    const dx = px - pose.x;
    const dy = py - pose.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  const goal = $derived.by(() => {
    if (!goalAt) return null;
    const p = spin(goalAt.x, goalAt.y);
    const inside = Math.hypot(p.x, p.y) < LAND - 8;
    return { ...p, inside, angle: Math.atan2(p.x, -p.y) * DEG };
  });
  const ground = $derived(`rotate(${(-pose.turn).toFixed(2)}) translate(${(-pose.x).toFixed(2)} ${(-pose.y).toFixed(2)})`);
  const placed = $derived(marks.map((m) => ({ ...m, ...spin(m.x, m.y) })).filter((m) => Math.hypot(m.x, m.y) < LAND + 8));
  const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);
  const clipId = `mini-${Math.random().toString(36).slice(2, 7)}`;
</script>

{#if !hidden && map}
  <button type="button" class="mini" onclick={onopen} aria-label={t("map.open")} aria-keyshortcuts="M" data-world={worldId}>
    <svg viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle r={LAND} /></clipPath>
        <radialGradient id="{clipId}-shade" r="0.5">
          <stop offset="0.72" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.2" />
        </radialGradient>
      </defs>
      <!-- The compass: a paper bezel with Dad's tick marks, turning with north. -->
      <circle r="97" fill="#FBF6EC" stroke="#2B2622" stroke-width="3.2" />
      <g transform="rotate({north.toFixed(2)})">
        {#each TICKS as a (a)}
          <line y1={-LAND - 3} y2={a % 90 === 0 ? -LAND - 9.5 : -LAND - 6} transform="rotate({a})" stroke="#2B2622" stroke-width={a % 90 === 0 ? 2 : 1.1} stroke-linecap="round" opacity={a % 90 === 0 ? 0.8 : 0.4} />
        {/each}
      </g>
      <circle r={LAND} fill={map.colors.land} />
      <g clip-path="url(#{clipId})">
        <g transform={ground}>
          {#each blobs as b, i (i)}
            {#if b.kind === "water"}
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} stroke={map.colors.ink} stroke-width="1.6" />
            {:else if b.kind === "crater"}
              <circle cx={b.x} cy={b.y} r={b.r} fill={map.colors.shade} stroke={map.colors.ink} stroke-width="1.2" opacity="0.75" />
              <circle cx={b.x + b.r * 0.12} cy={b.y + b.r * 0.12} r={b.r * 0.7} fill="#000" opacity="0.08" />
            {:else}
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.55" />
            {/if}
          {/each}
          {#each valleys as v, i (i)}
            <path d={v.d} fill="none" stroke={map.colors.ink} stroke-width={v.w + 2.4} stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
            <path d={v.d} fill="none" stroke={map.colors.shade} stroke-width={v.w} stroke-linecap="round" stroke-linejoin="round" />
          {/each}
          {#each paths as d, i (i)}
            <path {d} fill="none" stroke={map.colors.path ?? map.colors.shade} stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
            <path {d} fill="none" stroke={map.colors.ink} stroke-width="1" stroke-dasharray="3 5" stroke-linecap="round" opacity="0.45" />
          {/each}
        </g>
        <!-- Pencil range ring, half way to the rim. -->
        <circle r={LAND * 0.5} fill="none" stroke={map.colors.ink} stroke-width="0.8" stroke-dasharray="2 6" opacity="0.35" />
        {#each placed as m (m.id)}
          <MapGlyph icon={m.icon} x={m.x} y={m.y} size={24} ink={map.colors.ink} />
          {#if m.letter}
            <g transform="translate({m.x + 10} {m.y - 12})">
              <rect x="-6" y="-4.2" width="12" height="8.4" rx="1" fill="#FBF6EC" stroke={map.colors.ink} stroke-width="1.2" />
              <path d="M-6 -4 L0 1 L6 -4" fill="none" stroke={map.colors.ink} stroke-width="1.2" />
            </g>
          {/if}
        {/each}
        {#if goal?.inside}
          <g class="goal" transform="translate({goal.x.toFixed(1)} {goal.y.toFixed(1)})">
            <circle r="14" fill="none" stroke="#F2A541" stroke-width="3" />
          </g>
        {/if}
        <circle r={LAND} fill="url(#{clipId}-shade)" />
      </g>
      <circle r={LAND} fill="none" stroke="#2B2622" stroke-width="2" />
      <!-- North: a little red badge on the rim. -->
      <g transform="rotate({north.toFixed(2)}) translate(0 -90)">
        <g transform="rotate({(-north).toFixed(2)})">
          <circle r="7.5" fill="#C8553D" stroke="#2B2622" stroke-width="1.6" />
          <text y="3.6" class="north">N</text>
        </g>
      </g>
      {#if goal && !goal.inside}
        <g transform="rotate({goal.angle.toFixed(1)}) translate(0 -88)">
          <path d="M0 -9 L9 6 L0 2 L-9 6 Z" fill="#F2A541" stroke="#2B2622" stroke-width="1.8" stroke-linejoin="round" class="pulse" />
        </g>
      {/if}
      <!-- Remi: a little amber arrow, pointing the way Remi faces. -->
      <g transform="rotate({heading.toFixed(1)})">
        <path d="M0 -11 L8 8 L0 4 L-8 8 Z" fill="#F2A541" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
      </g>
    </svg>
    <span class="key" aria-hidden="true">M</span>
  </button>
{/if}

<style>
  .mini {
    position: fixed;
    left: max(18px, env(safe-area-inset-left));
    bottom: max(18px, env(safe-area-inset-bottom));
    width: 212px;
    height: 212px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    filter: drop-shadow(0 3px 0 rgba(43, 38, 34, 0.45)) drop-shadow(0 10px 16px rgba(10, 6, 20, 0.3));
    transform: rotate(-2deg);
    transition: transform 0.28s var(--ease-spring);
    z-index: 4;
    animation: arrive 0.5s var(--ease-spring) backwards;
  }
  .mini:hover,
  .mini:focus-visible {
    transform: rotate(0deg) scale(1.04);
  }
  .mini:active {
    transform: rotate(0deg) scale(0.98);
  }
  .mini:focus-visible {
    outline: 3px solid var(--amber);
    outline-offset: 4px;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .north {
    font: 700 10px/1 var(--label);
    text-anchor: middle;
    fill: #fbf6ec;
  }
  .goal circle {
    animation: ring 1.4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .pulse {
    animation: nudge 1.2s ease-in-out infinite;
  }
  .key {
    position: absolute;
    right: 6px;
    top: 6px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--paper-light);
    border: 2px solid var(--ink);
    font: 700 0.78rem/1 var(--label);
    color: var(--ink);
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: rotate(-8deg) scale(0.86);
    }
  }
  @keyframes ring {
    50% {
      transform: scale(1.25);
      opacity: 0.6;
    }
  }
  @keyframes nudge {
    50% {
      transform: translateY(-3px);
    }
  }
  :global(:root[data-motion="reduce"]) .mini,
  :global(:root[data-motion="reduce"]) .goal circle,
  :global(:root[data-motion="reduce"]) .pulse {
    animation: none;
  }
  @media (pointer: coarse) {
    .mini {
      width: 132px;
      height: 132px;
      top: max(14px, env(safe-area-inset-top));
      bottom: auto;
      left: auto;
      right: 96px;
    }
    .key {
      display: none;
    }
  }
</style>
