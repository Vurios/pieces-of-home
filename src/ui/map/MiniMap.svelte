<script lang="ts">
  import { Vector3 } from "three";
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";
  import type { MapIcon, WorldMap } from "../../game/worlds/types";
  import { t } from "../settings.svelte";
  import MapGlyph from "./MapGlyph.svelte";
  import { localView, onGround } from "./projection";

  /**
   * The corner map: a round scrap of Dad's chart in the bottom left corner,
   * showing the ground round Remi from above. The way the camera looks is
   * always up the page. The next stop shows as a star, or as an arrow on the
   * rim when it is farther away. Click it, or press M, for the big globe.
   */
  interface Props {
    engine: Engine;
    game: GameState;
    hidden: boolean;
    onopen: () => void;
  }
  let { engine, game, hidden, onopen }: Props = $props();

  /** How many meters from Remi to the rim. */
  const RANGE = 10;
  const RIM = 86;
  const SCALE = RIM / RANGE;

  interface Drawn {
    id: string;
    icon: MapIcon | "unknown";
    x: number;
    y: number;
    letter: boolean;
  }
  let map = $state<WorldMap | null>(null);
  let marks = $state<Drawn[]>([]);
  let paths = $state<string[]>([]);
  let blobs = $state<{ x: number; y: number; r: number; kind: "crater" | "water" | "patch"; color: string }[]>([]);
  let goal = $state<{ x: number; y: number; inside: boolean; angle: number } | null>(null);
  let heading = $state(0);
  let north = $state(0);
  let worldId = $state("");

  const up = new Vector3();
  let seen: { up: Vector3; facing: Vector3; heading: Vector3; stamp: string } | null = null;
  const pole = new Vector3(0, 1, 0);

  $effect(() => {
    if (hidden) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      // A dozen updates a second is plenty for a little paper map.
      if (now - last < 100) return;
      last = now;
      const v = engine.mapView();
      if (map !== (v?.map ?? null)) {
        map = v?.map ?? null;
        seen = null;
      }
      if (!v) return;
      worldId = v.worldId;
      // Redraw only when Remi has moved or turned, or the next stop or the save changed.
      const save = engine.store.value;
      const stamp = `${v.objective?.toArray().map((n) => n.toFixed(2)).join() ?? ""}|${save.delivered.length}|${save.flags.length}`;
      if (seen && seen.up.dot(v.up) > 0.999999 && seen.facing.dot(v.facing) > 0.9998 && seen.heading.dot(v.heading) > 0.9995 && seen.stamp === stamp) return;
      seen = { up: v.up, facing: v.facing, heading: v.heading, stamp };
      const view = localView(v.up, v.facing, v.map.radius);
      const flags = engine.store.value.flags;
      const delivered = engine.store.value.delivered;
      const drawn: Drawn[] = [];
      for (const m of v.map.marks) {
        const g = onGround(view, m.at);
        if (g.distance > RANGE + 1.2) continue;
        drawn.push({ id: m.id, icon: m.found && !flags.includes(m.found) ? "unknown" : m.icon, x: g.x * SCALE, y: -g.y * SCALE, letter: Boolean(m.letters?.some((l) => !delivered.includes(l))) });
      }
      marks = drawn;
      const lines: string[] = [];
      for (const line of v.map.paths ?? []) {
        let d = "";
        let pen = false;
        for (const p of line) {
          const g = onGround(view, p);
          if (g.distance > RANGE * 1.6) {
            pen = false;
            continue;
          }
          d += `${pen ? "L" : "M"}${(g.x * SCALE).toFixed(1)} ${(-g.y * SCALE).toFixed(1)}`;
          pen = true;
        }
        if (d) lines.push(d);
      }
      paths = lines;
      const round: typeof blobs = [];
      const add = (list: { at: Vector3; radius: number; color?: string }[] | undefined, kind: "crater" | "water" | "patch", color: string): void => {
        for (const c of list ?? []) {
          const g = onGround(view, c.at);
          if (g.distance > RANGE + c.radius + 1) continue;
          round.push({ x: g.x * SCALE, y: -g.y * SCALE, r: c.radius * SCALE, kind, color: c.color ?? color });
        }
      };
      add(v.map.patches, "patch", v.map.colors.shade);
      add(v.map.water, "water", v.map.colors.water ?? "#7FB3C8");
      add(v.map.craters, "crater", v.map.colors.shade);
      blobs = round;
      if (v.objective) {
        const g = onGround(view, up.copy(v.objective).normalize());
        const inside = g.distance < RANGE - 0.6;
        goal = { x: g.x * SCALE, y: -g.y * SCALE, inside, angle: (Math.atan2(g.x, g.y) * 180) / Math.PI };
      } else goal = null;
      heading = (Math.atan2(v.heading.dot(view.right), v.heading.dot(view.forward)) * 180) / Math.PI;
      const n = pole.clone().addScaledVector(view.up, -view.up.y);
      north = n.lengthSq() < 1e-6 ? 0 : (Math.atan2(n.dot(view.right), n.dot(view.forward)) * 180) / Math.PI;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  const clipId = `mini-${Math.random().toString(36).slice(2, 7)}`;
</script>

{#if !hidden && map}
  <button type="button" class="mini" onclick={onopen} aria-label={t("map.open")} aria-keyshortcuts="M" data-world={worldId}>
    <svg viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        <clipPath id={clipId}><circle r={RIM + 4} /></clipPath>
        <radialGradient id="{clipId}-shade" r="0.55">
          <stop offset="0.7" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.18" />
        </radialGradient>
      </defs>
      <circle r={RIM + 4} fill={map.colors.land} />
      <g clip-path="url(#{clipId})">
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
        {#each paths as d, i (i)}
          <path {d} fill="none" stroke={map.colors.path ?? map.colors.shade} stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
          <path {d} fill="none" stroke={map.colors.ink} stroke-width="1" stroke-dasharray="3 5" stroke-linecap="round" opacity="0.45" />
        {/each}
        {#each marks as m (m.id)}
          <MapGlyph icon={m.icon} x={m.x} y={m.y} size={24} ink={map.colors.ink} />
          {#if m.letter}
            <g transform="translate({m.x + 10} {m.y - 12})">
              <rect x="-6" y="-4.2" width="12" height="8.4" rx="1" fill="#FBF6EC" stroke={map.colors.ink} stroke-width="1.2" />
              <path d="M-6 -4 L0 1 L6 -4" fill="none" stroke={map.colors.ink} stroke-width="1.2" />
            </g>
          {/if}
        {/each}
        {#if goal?.inside}
          <g class="goal" transform="translate({goal.x} {goal.y})">
            <circle r="14" fill="none" stroke="#F2A541" stroke-width="3" />
          </g>
        {/if}
      </g>
      <circle r={RIM + 4} fill="url(#{clipId}-shade)" />
      <!-- Dad's pencil range ring and the compass tick for north. -->
      <circle r={RIM * 0.5} fill="none" stroke={map.colors.ink} stroke-width="0.8" stroke-dasharray="2 6" opacity="0.35" />
      <g transform="rotate({north})">
        <text y={-RIM + 9} class="north" fill={map.colors.ink}>N</text>
      </g>
      {#if goal && !goal.inside}
        <g transform="rotate({goal.angle}) translate(0 {-RIM + 2})">
          <path d="M0 -11 L10 6 L0 1 L-10 6 Z" fill="#F2A541" stroke="#2B2622" stroke-width="1.8" stroke-linejoin="round" class="pulse" />
        </g>
      {/if}
      <!-- Remi: a little amber arrow, pointing the way Remi faces. -->
      <g transform="rotate({heading})">
        <path d="M0 -11 L8 8 L0 4 L-8 8 Z" fill="#F2A541" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
      </g>
      <circle r={RIM + 4} fill="none" stroke="#2B2622" stroke-width="4" />
    </svg>
    <span class="key" aria-hidden="true">M</span>
  </button>
{/if}

<style>
  .mini {
    position: fixed;
    left: max(18px, env(safe-area-inset-left));
    bottom: max(18px, env(safe-area-inset-bottom));
    width: 176px;
    height: 176px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    filter: drop-shadow(0 2px 0 rgba(43, 38, 34, 0.5)) drop-shadow(0 10px 14px rgba(10, 6, 20, 0.35));
    transform: rotate(-2deg);
    transition: transform 0.22s var(--ease-spring);
    z-index: 4;
  }
  .mini:hover,
  .mini:focus-visible {
    transform: rotate(0deg) scale(1.04);
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
    font: 700 13px/1 var(--label);
    text-anchor: middle;
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
    right: 4px;
    top: 4px;
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
  :global(:root[data-motion="reduce"]) .goal circle,
  :global(:root[data-motion="reduce"]) .pulse {
    animation: none;
  }
  @media (pointer: coarse) {
    .mini {
      width: 128px;
      height: 128px;
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
