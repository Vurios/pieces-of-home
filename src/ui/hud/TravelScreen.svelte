<script lang="ts">
  import { fade } from "svelte/transition";
  import { audio } from "../../audio/audio";
  import { chapterForWorld } from "../../content/chapters";
  import type { Engine } from "../../game/engine";
  import { settings, t } from "../settings.svelte";
  import { banners } from "./banners.svelte";

  /**
   * The trip screen. While the Looking Lamp carries Remi between little worlds,
   * a night sky shows where Remi is going: the world left behind, the world
   * ahead, and the lamp's light drawing a pencil route between them. The light
   * eases most of the way while the world loads, and finishes the trip once it
   * is ready. Purely a picture: it never takes a click.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  type Kind = "home" | "moon" | "mars" | "other";
  interface Look {
    kind: Kind;
    name: string;
    where: string;
    land: string;
    shade: string;
  }
  const LOOKS: Record<string, Omit<Look, "name"> & { name?: string }> = {
    home: { kind: "home", name: "Home", where: t("travel.home"), land: "#86A96E", shade: "#5E8452" },
    tranquility: { kind: "moon", where: t("travel.moon"), land: "#C4BFB4", shade: "#8F8A80" },
    meridiani: { kind: "mars", where: t("travel.mars"), land: "#DB8D58", shade: "#AE6238" },
  };
  function look(id: string | null): Look {
    const chapter = id ? chapterForWorld(id) : null;
    const base = (id && LOOKS[id]) || { kind: "other" as const, where: "", land: "#E6D7B8", shade: "#BCA780" };
    return { ...base, name: base.name ?? chapter?.place ?? id ?? "" };
  }

  let trip = $state<{ from: Look; to: Look } | null>(null);
  let progress = $state(0);
  let slow = $state(false);
  let route = $state<SVGPathElement | null>(null);
  const spark = $derived.by(() => {
    if (!route) return { x: 160, y: 150 };
    const length = route.getTotalLength();
    const p = route.getPointAtLength(length * progress);
    return { x: p.x, y: p.y };
  });

  $effect(() => {
    let frame = 0;
    let started = 0;
    let arrivedAt = 0;
    let arrivedFrom = 0;
    let finishing = 0;
    const ease = (k: number): number => k * k * (3 - 2 * k);
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      if (!trip) return;
      if (arrivedAt) {
        // The last stretch, quick and sure, once the world is ready.
        const k = Math.min(1, (now - arrivedAt) / 380);
        progress = arrivedFrom + (1 - arrivedFrom) * ease(k);
        if (k >= 1 && !finishing) finishing = window.setTimeout(() => (trip = null), 120);
        return;
      }
      const seconds = (now - started) / 1000;
      progress = settings.reducedMotion ? 0.92 : 0.92 * ease(Math.min(1, seconds / 2.3));
      slow = seconds > 4;
    };
    const offs = [
      engine.bus.on("travel:start", ({ from, to }) => {
        window.clearTimeout(finishing);
        finishing = 0;
        arrivedAt = 0;
        started = performance.now();
        progress = 0;
        slow = false;
        trip = { from: look(from), to: look(to) };
        banners.traveling = true;
        audio.play("lamp-click", { level: 0.5 });
      }),
      engine.bus.on("travel:arrive", () => {
        arrivedAt = performance.now();
        arrivedFrom = progress;
        audio.play("corner-sparkle", { level: 0.45 });
      }),
      engine.bus.on("travel:end", () => {
        // Normally the screen is already lifting; this also covers a trip that failed.
        if (!arrivedAt) trip = null;
        banners.traveling = false;
      }),
    ];
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(finishing);
      offs.forEach((off) => off());
      banners.traveling = false;
    };
  });

  // A fixed scatter of stars, the same every trip.
  const STARS = Array.from({ length: 54 }, (_, i) => {
    const r = (n: number): number => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2.4, d: r(4) * 4, o: 0.35 + r(5) * 0.6 };
  });
</script>

{#if trip}
  <div class="trip-screen" role="status" aria-live="polite" in:fade={{ duration: settings.reducedMotion ? 0 : 420, delay: settings.reducedMotion ? 0 : 220 }} out:fade={{ duration: settings.reducedMotion ? 0 : 460 }}>
    <div class="sky" aria-hidden="true">
      {#each STARS as s, i (i)}
        <i style:left="{s.x}%" style:top="{s.y}%" style:width="{s.s}px" style:height="{s.s}px" style:opacity={s.o} style:animation-delay="{-s.d}s"></i>
      {/each}
    </div>
    <p class="via">{t("travel.via")}</p>
    <svg class="route" viewBox="0 0 640 260" aria-hidden="true">
      <defs>
        <radialGradient id="travel-glow">
          <stop offset="0" stop-color="#FFF6E0" />
          <stop offset="0.35" stop-color="#FFD98A" stop-opacity="0.85" />
          <stop offset="1" stop-color="#FFB547" stop-opacity="0" />
        </radialGradient>
      </defs>
      {#snippet planet(p: Look, cx: number, cy: number, r: number, arriving: boolean)}
        <g class="planet" class:arriving>
          <ellipse {cx} cy={cy + r + 14} rx={r * 0.8} ry="5" fill="#000" opacity="0.25" />
          {#if arriving}<circle {cx} {cy} r={r + 10 + progress * 6} fill="none" stroke="#FFD98A" stroke-width="2" stroke-dasharray="2 7" opacity={0.25 + progress * 0.6} />{/if}
          <circle {cx} {cy} {r} fill={p.land} />
          {#if p.kind === "home"}
            <!-- Grass patches, then the house and a tree standing on the top of the little world. -->
            <ellipse cx={cx + r * 0.3} cy={cy + r * 0.35} rx={r * 0.42} ry={r * 0.26} fill={p.shade} opacity="0.55" />
            <ellipse cx={cx - r * 0.45} cy={cy + r * 0.05} rx={r * 0.26} ry={r * 0.18} fill={p.shade} opacity="0.4" />
            <g transform="rotate(-24 {cx} {cy})">
              <rect x={cx - r * 0.2} y={cy - r * 1.3} width={r * 0.4} height={r * 0.34} fill="#E8A066" stroke="#2B2622" stroke-width="2" />
              <path d="M{cx - r * 0.28} {cy - r * 1.29} L {cx} {cy - r * 1.6} L {cx + r * 0.28} {cy - r * 1.29} Z" fill="#B5523B" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
              <rect x={cx - r * 0.05} y={cy - r * 1.17} width={r * 0.12} height={r * 0.12} fill="#FFD98A" stroke="#2B2622" stroke-width="1.4" />
            </g>
            <g transform="rotate(30 {cx} {cy})">
              <line x1={cx} y1={cy - r * 0.98} x2={cx} y2={cy - r * 1.2} stroke="#2B2622" stroke-width="3" />
              <circle {cx} cy={cy - r * 1.32} r={r * 0.2} fill="#5E8452" stroke="#2B2622" stroke-width="2" />
            </g>
          {:else if p.kind === "moon"}
            <circle cx={cx - r * 0.35} cy={cy - r * 0.2} r={r * 0.2} fill={p.shade} stroke="#2B2622" stroke-width="1.6" />
            <circle cx={cx + r * 0.3} cy={cy + r * 0.32} r={r * 0.14} fill={p.shade} stroke="#2B2622" stroke-width="1.6" />
            <circle cx={cx + r * 0.38} cy={cy - r * 0.4} r={r * 0.08} fill={p.shade} stroke="#2B2622" stroke-width="1.4" />
          {:else if p.kind === "mars"}
            <path d="M{cx - r} {cy + r * 0.1} Q {cx} {cy - r * 0.2} {cx + r} {cy + r * 0.05}" fill="none" stroke={p.shade} stroke-width={r * 0.22} opacity="0.7" />
            <circle cx={cx - r * 0.3} cy={cy + r * 0.38} r={r * 0.16} fill={p.shade} stroke="#2B2622" stroke-width="1.6" />
            <circle cx={cx + r * 0.36} cy={cy - r * 0.42} r={r * 0.1} fill={p.shade} stroke="#2B2622" stroke-width="1.4" />
          {/if}
          <path d="M{cx - r * 0.62} {cy - r * 0.5} A {r * 0.8} {r * 0.8} 0 0 1 {cx - r * 0.05} {cy - r * 0.78}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.45" />
          <circle {cx} {cy} {r} fill="none" stroke="#2B2622" stroke-width="3" />
        </g>
      {/snippet}
      <!-- Dad's pencil guide, then the line the light has drawn so far. -->
      <path d="M160 150 C 250 40, 400 20, 468 82" fill="none" stroke="#FFF6E0" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.4" />
      <path bind:this={route} d="M160 150 C 250 40, 400 20, 468 82" pathLength="1" fill="none" stroke="#FFD98A" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset={1 - progress} />
      {@render planet(trip.from, 108, 172, 46, false)}
      {@render planet(trip.to, 528, 112, 58, true)}
      <g transform="translate({spark.x.toFixed(1)} {spark.y.toFixed(1)})">
        <circle r="26" fill="url(#travel-glow)" class="halo" />
        <g class="rays">
          {#each [0, 45, 90, 135] as a (a)}<path d="M0 -15 L0 -10 M0 10 L0 15" transform="rotate({a})" stroke="#FFF6E0" stroke-width="2" stroke-linecap="round" />{/each}
        </g>
        <circle r="5" fill="#FFF6E0" />
      </g>
    </svg>
    <h2 class="to">{trip.to.name}</h2>
    {#if trip.to.where}<p class="where">{trip.to.where}</p>{/if}
    <p class="slow" class:on={slow} aria-hidden={!slow}>{t("travel.almost")}</p>
  </div>
{/if}

<style>
  .trip-screen {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    padding: 24px;
    background-color: #0b1030;
    background-image:
      radial-gradient(ellipse at 50% 42%, rgba(255, 214, 140, 0.16), transparent 58%),
      radial-gradient(ellipse at 50% 120%, rgba(90, 70, 140, 0.45), transparent 60%),
      var(--grain);
    color: #fff6e0;
    text-align: center;
    pointer-events: none;
    overflow: hidden;
  }
  .sky {
    position: absolute;
    inset: 0;
  }
  .sky i {
    position: absolute;
    border-radius: 50%;
    background: #fff6e0;
    animation: twinkle 3.2s ease-in-out infinite;
  }
  .via {
    margin: 0;
    padding: 4px 12px 3px;
    border: 2px solid rgba(255, 217, 138, 0.7);
    border-radius: 4px;
    color: #ffd98a;
    font: 700 0.75rem/1 var(--label);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    rotate: -1.5deg;
    position: relative;
  }
  .route {
    position: relative;
    width: min(640px, 92vw);
    height: auto;
    overflow: visible;
  }
  .planet {
    animation: bob 3.4s ease-in-out infinite;
  }
  .planet.arriving {
    animation-delay: -1.7s;
  }
  .halo {
    animation: glow 1.2s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .rays {
    animation: spin 5s linear infinite;
  }
  .to {
    position: relative;
    margin: 4px 0 0;
    font: 700 clamp(2.2rem, 4.6vw, 3.4rem) / 1 var(--hand);
    color: #fff6e0;
    text-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
    animation: rise 0.7s var(--ease-spring) 0.35s both;
  }
  .where {
    position: relative;
    margin: 0;
    font: 400 1.1rem/1.3 var(--read);
    color: rgba(255, 246, 224, 0.78);
    animation: rise 0.7s var(--ease-spring) 0.5s both;
  }
  .slow {
    position: relative;
    margin: 10px 0 0;
    font: 400 0.95rem/1 var(--read);
    color: rgba(255, 246, 224, 0.6);
    opacity: 0;
    transition: opacity 0.6s;
  }
  .slow.on {
    opacity: 1;
  }
  @keyframes twinkle {
    50% {
      opacity: 0.15;
    }
  }
  @keyframes bob {
    50% {
      transform: translateY(-5px);
    }
  }
  @keyframes glow {
    50% {
      transform: scale(1.18);
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  :global(:root[data-motion="reduce"]) .trip-screen *,
  :global(:root[data-motion="reduce"]) .sky i {
    animation: none !important;
  }
</style>
