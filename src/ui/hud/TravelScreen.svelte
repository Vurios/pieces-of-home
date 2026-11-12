<script lang="ts">
  import { fade } from "svelte/transition";
  import { audio } from "../../audio/audio";
  import { chapterForWorld } from "../../content/chapters";
  import type { Engine } from "../../game/engine";
  import { settings, t } from "../settings.svelte";
  import { banners } from "./banners.svelte";

  /**
   * The words over a trip between little worlds. The trip itself is drawn in
   * 3D by the engine (src/game/render/trip.ts): the light closes, then opens on
   * the two little worlds in the night with the lamp's light flying between
   * them. This only names where Remi is going. While the light is shut the
   * words sit dark on the warm light; during the flight they turn pale on the
   * night. Purely a caption: it never takes a click.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  const WHERE: Record<string, string> = {
    home: t("travel.home"),
    tranquility: t("travel.moon"),
    hadley: t("travel.moon"),
    meridiani: t("travel.mars"),
    valinor: t("travel.mars"),
  };
  function named(id: string): { name: string; where: string } {
    if (id === "home") return { name: "Home", where: WHERE["home"]! };
    return { name: chapterForWorld(id)?.place ?? id, where: WHERE[id] ?? "" };
  }

  let trip = $state<{ name: string; where: string } | null>(null);
  let flying = $state(false);
  let slow = $state(false);
  let skipped = $state(false);

  /** E, Enter, Space, a click or the A button skips ahead to the landing. */
  function skip(): void {
    if (!flying || skipped) return;
    skipped = true;
    engine.bus.emit("travel:skip", {});
  }
  $effect(() => {
    if (!trip || !flying) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        skip();
      }
    };
    const onClick = (): void => skip();
    let frame = 0;
    let was = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const a = Boolean(navigator.getGamepads?.().find((g) => g)?.buttons[0]?.pressed);
      if (a && !was) skip();
      was = a;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onClick);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClick);
      cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    let slowTimer = 0;
    let launchTimer = 0;
    let landTimer = 0;
    const offs = [
      engine.bus.on("travel:start", ({ to }) => {
        trip = named(to);
        flying = false;
        slow = false;
        window.clearTimeout(slowTimer);
        slowTimer = window.setTimeout(() => (slow = true), 4200);
        banners.traveling = true;
        audio.play("lamp-click", { level: 0.5 });
      }),
      engine.bus.on("travel:flight", () => {
        window.clearTimeout(slowTimer);
        slow = false;
        flying = true;
        skipped = false;
        // The rocket's sounds follow its beats (see src/game/render/trip.ts): lift-off, then landing.
        launchTimer = window.setTimeout(() => audio.play("rocket-launch", { level: 0.6 }), 1500);
        landTimer = window.setTimeout(() => audio.play("rocket-land", { level: 0.55 }), 4950);
      }),
      engine.bus.on("travel:arrive", () => {
        window.clearTimeout(slowTimer);
        trip = null;
        audio.play("corner-sparkle", { level: 0.45 });
      }),
      engine.bus.on("travel:end", () => {
        // Normally the words are already gone; this also covers a trip that failed.
        window.clearTimeout(slowTimer);
        trip = null;
        banners.traveling = false;
      }),
    ];
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(launchTimer);
      window.clearTimeout(landTimer);
      offs.forEach((off) => off());
      banners.traveling = false;
    };
  });
</script>

{#if trip}
  <div class="trip-words" class:flying role="status" aria-live="polite" in:fade={{ duration: settings.reducedMotion ? 0 : 380, delay: settings.reducedMotion ? 0 : 260 }} out:fade={{ duration: settings.reducedMotion ? 0 : 320 }}>
    <p class="via">{t("travel.via")}</p>
    <h2 class="to">{trip.name}</h2>
    {#if trip.where}<p class="where">{trip.where}</p>{/if}
    <p class="slow" class:on={slow} aria-hidden={!slow}>{t("travel.almost")}</p>
  </div>
  {#if flying && !skipped}
    <p class="skip" in:fade={{ duration: 300, delay: 1200 }}>Skip <kbd>E</kbd></p>
  {/if}
{/if}

<style>
  .trip-words {
    position: fixed;
    left: clamp(20px, 4vw, 56px);
    top: clamp(20px, 5vh, 52px);
    z-index: 60;
    display: grid;
    justify-items: start;
    gap: 4px;
    width: min(460px, calc(100vw - 32px));
    color: #3a2a1c;
    text-align: left;
    pointer-events: none;
    transition: color 0.6s ease;
  }
  .trip-words.flying {
    color: #fff6e0;
  }
  .via {
    margin: 0;
    padding: 5px 14px 4px;
    border: 2px solid currentColor;
    border-radius: 4px;
    font: 700 0.75rem/1 var(--label);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    rotate: -1.5deg;
    opacity: 0.85;
  }
  .flying .via {
    color: #ffd98a;
  }
  .to {
    margin: 6px 0 0;
    font: 700 clamp(2rem, 4vw, 3rem) / 1 var(--hand);
    animation: rise 0.7s var(--ease-spring) 0.3s both;
  }
  .flying .to {
    text-shadow:
      0 3px 0 rgba(10, 8, 30, 0.45),
      0 0 26px rgba(10, 8, 30, 0.55);
  }
  .where {
    margin: 0;
    font: 400 1.15rem/1.3 var(--read);
    opacity: 0.85;
    animation: rise 0.7s var(--ease-spring) 0.45s both;
  }
  .flying .where {
    text-shadow: 0 0 18px rgba(10, 8, 30, 0.7);
  }
  .slow {
    margin: 10px 0 0;
    font: 400 0.95rem/1 var(--read);
    opacity: 0;
    transition: opacity 0.6s;
  }
  .slow.on {
    opacity: 0.7;
  }
  .skip {
    position: fixed;
    right: 22px;
    bottom: 20px;
    z-index: 60;
    margin: 0;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(10, 8, 30, 0.45);
    color: #fff6e0;
    font: 700 0.9rem/1 var(--read);
    pointer-events: none;
  }
  .skip kbd {
    margin-left: 4px;
    padding: 1px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    font: 700 0.75rem/1.2 var(--label);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  :global(:root[data-motion="reduce"]) .trip-words * {
    animation: none !important;
  }
</style>
