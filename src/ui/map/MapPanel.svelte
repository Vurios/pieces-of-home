<script lang="ts">
  import { untrack } from "svelte";
  import { Vector3 } from "three";
  import type { GameState } from "../../game/core/state";
  import type { Engine } from "../../game/engine";
  import type { MapIcon, WorldMap } from "../../game/worlds/types";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";
  import MapGlyph from "./MapGlyph.svelte";
  import { type GlobeView, WORLD_UP, easeGlobe, globeView, onGlobe, spinGlobe } from "./projection";

  /**
   * Dad's map, big: the whole little world as a paper globe. Drag it (or use
   * the arrow keys) to spin it. Every place is drawn with its name; letters
   * still to deliver carry an envelope. "Find Remi" and "Next stop" spin the
   * globe to them, and so does picking a place from the list.
   */
  interface Props {
    engine: Engine;
    game: GameState;
    onclose: () => void;
  }
  let { engine, game, onclose }: Props = $props();

  const R = 100;
  // The map is a snapshot from the moment it opens: the world waits while it is up.
  const start = untrack(() => engine.mapView());
  const map: WorldMap | null = start?.map ?? null;
  const me = start ? start.up.clone() : new Vector3(0, 0, 1);
  const meHeading = start?.heading.clone() ?? new Vector3(0, 1, 0);
  const next = start?.objective ? start.objective.clone().normalize() : null;

  /** The middle of Dad's places: the map opens looking at all of them, with Remi among them. */
  const middle = (() => {
    if (!map || map.marks.length === 0) return me.clone();
    const sum = new Vector3();
    for (const m of map.marks) sum.add(m.at);
    return sum.lengthSq() < 1e-6 ? me.clone() : sum.normalize();
  })();
  let view = $state<GlobeView>(globeView(middle, WORLD_UP));
  let target: GlobeView | null = null;
  let dragging = $state(false);

  // ---- Zoom: Dad's little worlds keep their places close together, so the map
  // starts zoomed in enough to spread them out, and + and - change it. ----
  const ZOOMS = [1, 1.5, 2.2, 3.2];
  function fitZoom(): number {
    if (!map) return 1;
    const v = globeView(middle, WORLD_UP);
    let spread = 0.2;
    for (const p of [...map.marks.map((m) => m.at), me]) {
      const g = onGlobe(v, p);
      if (g.z > 0.3) spread = Math.max(spread, Math.hypot(g.x, g.y));
    }
    // Fit the places, letting the farthest sit near the rim.
    const want = 0.95 / spread;
    return ZOOMS.reduce((best, z) => (z <= want && z > best ? z : best), 1);
  }
  /** The zoom step picked, and the zoom drawn (it eases to the step). */
  let zoomTo = $state(fitZoom());
  let zoom = $state(untrack(() => zoomTo));
  /** Page units per unit of the globe's radius. */
  const S = $derived(R * zoom);
  function zoomBy(step: number): void {
    const i = ZOOMS.indexOf(zoomTo);
    zoomTo = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + step))]!;
  }
  function wheel(e: WheelEvent): void {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1 : -1);
  }

  function goTo(p: Vector3): void {
    target = globeView(p, WORLD_UP);
  }

  $effect(() => {
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      if (zoom !== zoomTo) zoom = Math.abs(zoomTo - zoom) < 0.004 ? zoomTo : zoom + (zoomTo - zoom) * 0.2;
      if (!target || dragging) return;
      view = easeGlobe(view, target, 0.16);
      if (view.center.distanceTo(target.center) < 0.002) {
        view = target;
        target = null;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // ---- Spinning by hand ----
  let last: { x: number; y: number } | null = null;
  let svg = $state<SVGSVGElement | null>(null);
  function down(e: PointerEvent): void {
    dragging = true;
    target = null;
    last = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent): void {
    if (!dragging || !last || !svg) return;
    const scale = (2 * R + 40) / svg.getBoundingClientRect().width;
    const dx = (e.clientX - last.x) * scale;
    const dy = (e.clientY - last.y) * scale;
    last = { x: e.clientX, y: e.clientY };
    view = spinGlobe(view, dx / S, -dy / S);
  }
  function up(): void {
    dragging = false;
    last = null;
  }
  // M closes the map again, wherever focus is inside it.
  $effect(() => {
    const close = (e: KeyboardEvent): void => {
      if (e.code !== "KeyM" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      onclose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  });

  function onkey(e: KeyboardEvent): void {
    if (e.code === "Equal" || e.code === "NumpadAdd" || e.code === "Minus" || e.code === "NumpadSubtract") {
      e.preventDefault();
      zoomBy(e.code === "Equal" || e.code === "NumpadAdd" ? 1 : -1);
      return;
    }
    const step = 0.18 / zoom;
    const spin: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const s = spin[e.code];
    if (!s) return;
    e.preventDefault();
    target = null;
    view = spinGlobe(view, s[0], s[1]);
  }

  // ---- What to draw ----
  const flags = $derived(game.flags);
  const delivered = $derived(game.delivered);
  const known = (m: WorldMap["marks"][number]): boolean => !m.found || flags.includes(m.found);

  const graticule = $derived.by(() => {
    const lines: string[] = [];
    const draw = (points: Vector3[]): void => {
      let d = "";
      let pen = false;
      for (const p of points) {
        const g = onGlobe(view, p);
        if (g.z < 0) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${(g.x * S).toFixed(1)} ${(-g.y * S).toFixed(1)}`;
        pen = true;
      }
      if (d) lines.push(d);
    };
    const dir = (lat: number, lon: number): Vector3 => {
      const a = (lat * Math.PI) / 180;
      const b = (lon * Math.PI) / 180;
      return new Vector3(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b));
    };
    for (let lat = -60; lat <= 60; lat += 30) draw(Array.from({ length: 73 }, (_, i) => dir(lat, i * 5)));
    for (let lon = 0; lon < 360; lon += 30) draw(Array.from({ length: 37 }, (_, i) => dir(-90 + i * 5, lon)));
    return lines;
  });

  const routes = $derived.by(() => {
    if (!map) return [];
    return (map.paths ?? []).map((line) => {
      let d = "";
      let pen = false;
      for (const p of line) {
        const g = onGlobe(view, p);
        if (g.z < 0.02) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${(g.x * S).toFixed(1)} ${(-g.y * S).toFixed(1)}`;
        pen = true;
      }
      return d;
    });
  });

  /** A round thing on the ground, squashed toward the rim as the globe curves away. */
  const ellipse = (at: Vector3, radius: number): { x: number; y: number; rx: number; ry: number; angle: number } | null => {
    if (!map) return null;
    const g = onGlobe(view, at);
    if (g.z < 0.05) return null;
    const r = (radius / map.radius) * S;
    return { x: g.x * S, y: -g.y * S, rx: r * g.z, ry: r, angle: (Math.atan2(-g.y, g.x) * 180) / Math.PI };
  };

  const shapes = $derived.by(() => {
    if (!map) return [];
    const out: { kind: "patch" | "water" | "crater"; color: string; e: NonNullable<ReturnType<typeof ellipse>> }[] = [];
    for (const p of map.patches ?? []) {
      const e = ellipse(p.at, p.radius);
      if (e) out.push({ kind: "patch", color: p.color, e });
    }
    for (const w of map.water ?? []) {
      const e = ellipse(w.at, w.radius);
      if (e) out.push({ kind: "water", color: map.colors.water ?? "#7FB3C8", e });
    }
    for (const c of map.craters ?? []) {
      const e = ellipse(c.at, c.radius);
      if (e) out.push({ kind: "crater", color: map.colors.shade, e });
    }
    return out;
  });

  interface Pin {
    id: string;
    label: string;
    icon: MapIcon | "unknown";
    x: number;
    y: number;
    z: number;
    size: number;
    letter: boolean;
    /** Where its name is written, or null when there is no room. */
    tag: { x: number; y: number } | null;
  }
  const pins = $derived.by(() => {
    if (!map) return [];
    const out: Pin[] = [];
    for (const m of map.marks) {
      const g = onGlobe(view, m.at);
      if (g.z < 0.04) continue;
      const x = g.x * S;
      const y = -g.y * S;
      if (Math.hypot(x, y) > R - 5) continue;
      out.push({ id: m.id, label: known(m) ? m.label : "?", icon: known(m) ? m.icon : "unknown", x, y, z: g.z, size: 15 + 7 * g.z, letter: Boolean(m.letters?.some((l) => !delivered.includes(l))), tag: null });
    }
    // Labels never pile up: nearest places choose first (below, above, right, left), and
    // a label with no room left stays off (the place list still names it).
    type Box = { x0: number; y0: number; x1: number; y1: number };
    const boxes: Box[] = out.map((p) => ({ x0: p.x - p.size / 2, y0: p.y - p.size / 2, x1: p.x + p.size / 2, y1: p.y + p.size / 2 }));
    const me2 = remi;
    boxes.push({ x0: me2.x - 8, y0: me2.y - 8, x1: me2.x + 8, y1: me2.y + 8 });
    const hits = (b: Box): boolean => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    for (const p of [...out].sort((a, b) => b.z - a.z)) {
      if (p.z < 0.3 || p.label === "?") continue;
      const w = p.label.length * 4 + 4;
      const h = 9;
      const half = p.size / 2;
      const tries: [number, number][] = [
        [p.x, p.y + half + 7],
        [p.x, p.y - half - 3],
        [p.x + half + 3 + w / 2, p.y + 3],
        [p.x - half - 3 - w / 2, p.y + 3],
      ];
      for (const [x, y] of tries) {
        const b = { x0: x - w / 2, y0: y - h + 2, x1: x + w / 2, y1: y + 2 };
        const inside = [b.x0, b.x1].every((cx) => [b.y0, b.y1].every((cy) => Math.hypot(cx, cy) < R - 3));
        if (!inside || hits(b)) continue;
        boxes.push(b);
        p.tag = { x, y };
        break;
      }
    }
    // Far ones first, so near ones sit on top.
    return out.sort((a, b) => a.z - b.z);
  });

  const remi = $derived.by(() => {
    const g = onGlobe(view, me);
    const ahead = me.clone().addScaledVector(meHeading, 0.05).normalize();
    const h = onGlobe(view, ahead);
    return { x: g.x * S, y: -g.y * S, z: g.z, angle: (Math.atan2(h.x - g.x, h.y - g.y) * 180) / Math.PI };
  });

  const goal = $derived.by(() => {
    if (!next) return null;
    const g = onGlobe(view, next);
    const x = g.x * S;
    const y = -g.y * S;
    if (g.z > 0.04 && Math.hypot(x, y) < R - 4) return { x, y, z: g.z, behind: false, angle: 0 };
    // On the far side, or out of the window: an arrow on the rim, pointing the way.
    const angle = Math.atan2(g.x, g.y);
    return { x: Math.sin(angle) * (R + 8), y: -Math.cos(angle) * (R + 8), z: 0, behind: true, angle: (angle * 180) / Math.PI };
  });

  /** Which way north lies on the page, in degrees clockwise from up. */
  const north = $derived.by(() => {
    const pole = onGlobe(view, WORLD_UP);
    const angle = Math.atan2(pole.x, pole.y);
    // Seen from right over a pole, north is everywhere: keep the needle up.
    return Math.hypot(pole.x, pole.y) < 0.02 ? 0 : (angle * 180) / Math.PI;
  });
  /** The place the list is pointing at, drawn with a ring on the globe. */
  let hover = $state<string | null>(null);

  const list = $derived(map ? map.marks.filter(known) : []);
  const hidden = $derived(map ? map.marks.length - list.length : 0);
</script>

<Panel title={map?.title ?? t("map.title")} lede={t("map.lede")} icon="pin" size="lg" {onclose}>
  {#if map}
    <div class="layout">
      <!-- A custom widget: drag or arrow keys spin it, and the place list does the same with plain buttons. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div class="frame">
      <svg
        class="globe"
        class:dragging
        viewBox="{-R - 20} {-R - 20} {2 * R + 40} {2 * R + 40}"
        bind:this={svg}
        role="application"
        aria-roledescription="globe"
        aria-label={t("map.globe")}
        tabindex="0"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        onkeydown={onkey}
        onwheel={wheel}
      >
        <defs>
          <radialGradient id="globe-light" cx="0.38" cy="0.34" r="0.75">
            <stop offset="0" stop-color="#fff" stop-opacity="0.32" />
            <stop offset="0.55" stop-color="#fff" stop-opacity="0" />
            <stop offset="1" stop-color="#000" stop-opacity="0.32" />
          </radialGradient>
          <clipPath id="globe-clip"><circle r={R} /></clipPath>
        </defs>
        <ellipse cy={R + 13} rx={R * 0.72} ry="5" fill="#2B2622" opacity="0.1" />
        <circle r={R + 6} fill="none" stroke={map.colors.ink} stroke-width="1" stroke-dasharray="1 5" opacity="0.4" />
        <g clip-path="url(#globe-clip)">
          <circle r={S} fill={map.colors.land} />
          {#each graticule as d, i (i)}<path {d} fill="none" stroke={map.colors.ink} stroke-width="0.5" opacity="0.18" />{/each}
          {#each shapes as s, i (i)}
            <ellipse
              cx={s.e.x}
              cy={s.e.y}
              rx={s.e.rx}
              ry={s.e.ry}
              transform="rotate({s.e.angle} {s.e.x} {s.e.y})"
              fill={s.kind === "patch" ? s.color : s.kind === "water" ? s.color : map.colors.shade}
              opacity={s.kind === "patch" ? 0.55 : 1}
              stroke={s.kind === "patch" ? "none" : map.colors.ink}
              stroke-width="0.9"
            />
          {/each}
          {#each routes as d, i (i)}
            {#if d}
              <path {d} fill="none" stroke={map.colors.path ?? map.colors.shade} stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <path {d} fill="none" stroke={map.colors.ink} stroke-width="0.7" stroke-dasharray="2 3" opacity="0.5" />
            {/if}
          {/each}
        </g>
        <circle r={R} fill="url(#globe-light)" pointer-events="none" />
        <circle r={R} fill="none" stroke={map.colors.ink} stroke-width="2.4" />
        {#each pins as p (p.id)}
          <g opacity={Math.min(1, p.z * 4)}>
            {#if hover === p.id}<circle cx={p.x} cy={p.y} r={p.size * 0.72} fill="#F2A541" opacity="0.35" stroke="#F2A541" stroke-width="1.6" />{/if}
            <MapGlyph icon={p.icon} x={p.x} y={p.y} size={p.size} ink={map.colors.ink} />
            {#if p.letter}
              <g transform="translate({p.x + 8} {p.y - 9}) scale(0.75)">
                <rect x="-6" y="-4.2" width="12" height="8.4" rx="1" fill="#FBF6EC" stroke={map.colors.ink} stroke-width="1.2" />
                <path d="M-6 -4 L0 1 L6 -4" fill="none" stroke={map.colors.ink} stroke-width="1.2" />
              </g>
            {/if}
            {#if p.tag}
              <text x={p.tag.x} y={p.tag.y} class="label" fill={map.colors.ink} stroke="#FBF6EC" stroke-width="2.6" paint-order="stroke">{p.label}</text>
            {/if}
          </g>
        {/each}
        {#if goal}
          {#if goal.behind}
            <g transform="rotate({goal.angle}) translate(0 {-R - 9})">
              <path d="M0 -8 L7 5 L0 1.5 L-7 5 Z" fill="#F2A541" stroke="#2B2622" stroke-width="1.4" stroke-linejoin="round" class="nudge" />
            </g>
          {:else}
            <circle cx={goal.x} cy={goal.y} r="9" fill="none" stroke="#F2A541" stroke-width="2.4" class="ring" />
          {/if}
        {/if}
        {#if remi.z > 0}
          <g transform="translate({remi.x} {remi.y}) rotate({remi.angle})">
            <circle r="7.5" fill="#FBF6EC" stroke="#2B2622" stroke-width="1.6" />
            <path d="M0 -5.5 L4 4 L0 2 L-4 4 Z" fill="#F2A541" stroke="#2B2622" stroke-width="1.2" stroke-linejoin="round" />
          </g>
        {/if}
      </svg>
        <svg class="compass" viewBox="-24 -24 48 48" aria-hidden="true">
          <circle r="21" fill="#FBF6EC" stroke="#2B2622" stroke-width="2" />
          <circle r="16" fill="none" stroke="#2B2622" stroke-width="0.8" stroke-dasharray="1.5 3" opacity="0.5" />
          <g transform="rotate({north.toFixed(1)})">
            <path d="M0 -15 L4.5 0 L-4.5 0 Z" fill="#C8553D" stroke="#2B2622" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M0 15 L4.5 0 L-4.5 0 Z" fill="#FBF6EC" stroke="#2B2622" stroke-width="1.2" stroke-linejoin="round" />
            <text y="-17.5" class="n">N</text>
          </g>
          <circle r="2" fill="#2B2622" />
        </svg>
        <div class="zoom">
          <button type="button" class="round" onclick={() => zoomBy(1)} disabled={zoomTo === ZOOMS[ZOOMS.length - 1]} aria-label={t("map.zoomIn")}>+</button>
          <button type="button" class="round" onclick={() => zoomBy(-1)} disabled={zoomTo === ZOOMS[0]} aria-label={t("map.zoomOut")}>&minus;</button>
        </div>
      </div>

      <div class="side">
        <div class="buttons">
          <button type="button" class="btn amber" onclick={() => goTo(me)}>{t("map.findMe")}</button>
          {#if next}<button type="button" class="btn" onclick={() => next && goTo(next)}>{t("map.next")}</button>{/if}
        </div>
        <p class="how">{t("map.how")}</p>
        <h3 class="head">{t("map.places")} <span>{t("map.count", { n: list.length, total: map.marks.length })}</span></h3>
        <ul class="places">
          {#each list as m (m.id)}
            <li>
              <button
                type="button"
                class="place"
                onclick={() => goTo(m.at)}
                onpointerenter={() => (hover = m.id)}
                onpointerleave={() => (hover = null)}
                onfocus={() => (hover = m.id)}
                onblur={() => (hover = null)}
              >
                <svg viewBox="-13 -13 26 26" aria-hidden="true"><MapGlyph icon={m.icon} size={22} ink={map.colors.ink} /></svg>
                <span>{m.label}</span>
                {#if m.letters?.some((l) => !delivered.includes(l))}<span class="badge">{t("map.letter")}</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
        {#if hidden > 0}<p class="how">{t("map.more")}</p>{/if}
        <p class="key"><span class="dot me"></span>{t("map.you")} <span class="dot next"></span>{t("map.nextKey")}</p>
      </div>
    </div>
  {:else}
    <p>{t("map.none")}</p>
  {/if}
</Panel>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }
  .frame {
    position: relative;
  }
  .compass {
    position: absolute;
    left: 2%;
    top: 2%;
    width: 52px;
    height: 52px;
    filter: drop-shadow(0 2px 0 rgba(43, 38, 34, 0.35));
    pointer-events: none;
  }
  .n {
    font: 700 7px/1 var(--label);
    text-anchor: middle;
    fill: #2b2622;
  }
  .globe {
    display: block;
    width: 100%;
    max-height: min(62vh, 520px);
    touch-action: none;
    cursor: grab;
    border-radius: 50%;
  }
  .globe.dragging {
    cursor: grabbing;
  }
  .globe:focus-visible {
    outline: 3px solid var(--amber);
    outline-offset: 2px;
  }
  .label {
    font: 700 7.5px/1 var(--hand);
    text-anchor: middle;
    pointer-events: none;
  }
  .ring {
    animation: ring 1.4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .nudge {
    animation: nudge 1.2s ease-in-out infinite;
  }
  .side {
    display: grid;
    gap: 12px;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .zoom {
    position: absolute;
    right: 2%;
    bottom: 3%;
    display: grid;
    gap: 6px;
  }
  .round {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0 0 2px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--paper-light);
    box-shadow: 0 3px 0 var(--ink);
    font: 700 1.45rem/1 var(--read);
    color: var(--ink);
    cursor: pointer;
    transition:
      transform 0.14s var(--ease-spring),
      box-shadow 0.14s ease,
      background 0.14s ease;
  }
  .round:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--amber-wash);
  }
  .round:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }
  .round:focus-visible {
    outline: 3px solid var(--amber);
    outline-offset: 2px;
  }
  .round:disabled {
    opacity: 0.38;
    cursor: default;
  }
  .head {
    margin: 4px 0 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1.5px dashed color-mix(in srgb, var(--ink) 30%, transparent);
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .head span {
    font: 400 0.85rem/1 var(--read);
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-soft);
  }
  .how {
    margin: 0;
    font: 400 0.95rem/1.4 var(--read);
    color: var(--ink-soft);
  }
  .places {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    max-height: 300px;
    overflow: auto;
  }
  .place {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 6px;
    border: 0;
    border-radius: var(--radius);
    background: none;
    text-align: left;
    font: 400 0.95rem/1.2 var(--read);
    color: var(--ink);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .place:hover,
  .place:focus-visible {
    background: var(--amber-wash);
  }
  .place svg {
    width: 26px;
    height: 26px;
    flex: none;
  }
  .badge {
    margin-left: auto;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--paper-deep);
    font: 700 0.68rem/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .key {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font: 400 0.9rem/1 var(--read);
    color: var(--ink-soft);
  }
  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--ink);
  }
  .dot.me {
    background: var(--amber);
  }
  .dot.next {
    margin-left: 10px;
    border-color: var(--amber);
    border-width: 3px;
  }
  @keyframes ring {
    50% {
      transform: scale(1.3);
      opacity: 0.55;
    }
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }
  :global(:root[data-motion="reduce"]) .ring,
  :global(:root[data-motion="reduce"]) .nudge {
    animation: none;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .places {
      max-height: 180px;
    }
  }
</style>
