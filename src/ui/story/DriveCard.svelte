<script lang="ts">
  import { fly } from "svelte/transition";
  import images from "../../data/images.json";
  import { banners } from "../hud/banners.svelte";
  import type { Engine } from "../../game/engine";

  /**
   * Chapter 2: Dad's taped photo, the map for the Moon buggy drive.
   *
   * A real picture from orbit of the edge of Hadley Rille (LROC, PIA13058),
   * with the crew's stops labeled and faint tracks between them. Dad drew a
   * pencil route on it from one stop to the rille's edge, and a pencil dot
   * shows how far along the buggy is. Shown only while someone drives.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  const photo = images.images.find((i) => i.id === "apollo15-lroc")!;
  let riding = $state(false);
  let leg = $state<"out" | "back">("out");
  let progress = $state(0);

  $effect(() =>
    engine.bus.on("ride:state", (s) => {
      riding = s.riding;
      banners.riding = s.riding;
      leg = s.leg;
      progress = s.progress;
    }),
  );
  $effect(() =>
    engine.bus.on("world:loading", () => {
      riding = false;
      banners.riding = false;
    }),
  );

  // Dad's pencil route on the photo, from the stop labeled "st. 9" to the rille's edge at "st. 9A".
  const A = { x: 87, y: 54 };
  const C = { x: 62, y: 44 };
  const B = { x: 40, y: 55 };
  const along = (t: number): { x: number; y: number } => ({
    x: (1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * C.x + t * t * B.x,
    y: (1 - t) * (1 - t) * A.y + 2 * (1 - t) * t * C.y + t * t * B.y,
  });
  const dot = $derived(along(Math.max(0, Math.min(1, progress))));
</script>

{#if riding}
  <aside class="drive" aria-label="Dad's map for the drive" transition:fly={{ y: 30, duration: 260 }}>
    <figure class="photo">
      <img src={photo.file} alt={photo.alt} width="180" height="180" />
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M{A.x} {A.y} Q {C.x} {C.y} {B.x} {B.y}" fill="none" stroke="#FFD98A" stroke-width="1.6" stroke-dasharray="3 2.4" stroke-linecap="round" />
        <circle cx={B.x} cy={B.y} r="3.2" fill="none" stroke="#FF8A6A" stroke-width="1.4" />
        <circle cx={dot.x} cy={dot.y} r="2.6" fill="#FFD98A" stroke="#2B2622" stroke-width="0.9" />
      </svg>
      <figcaption>{photo.credit}</figcaption>
    </figure>
    <p class="note">{leg === "out" ? "Dad drew the way to the rille's edge." : "Now back to the chalk marks."}</p>
    <p class="keys"><kbd>W</kbd><kbd>S</kbd> drive <kbd>A</kbd><kbd>D</kbd> steer <kbd>E</kbd> get out</p>
    <p class="steer">Only the back wheels steer!</p>
  </aside>
{/if}

<style>
  .drive {
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 12;
    width: 212px;
    padding: 14px 14px 10px;
    background: var(--grain), var(--card);
    border: 2px solid var(--ink);
    border-radius: 6px 9px 7px 8px;
    box-shadow: 0 4px 0 var(--ink), 0 18px 30px -16px rgba(0, 0, 0, 0.6);
    rotate: -1.2deg;
    color: var(--ink);
    pointer-events: none;
  }
  .drive::before {
    content: "";
    position: absolute;
    top: -12px;
    left: 50%;
    width: 84px;
    height: 22px;
    margin-left: -42px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    rotate: 3deg;
  }
  .photo {
    position: relative;
    margin: 0;
  }
  .photo img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border: 1px solid var(--ink);
  }
  .photo svg {
    position: absolute;
    inset: 0;
    width: 100%;
    aspect-ratio: 1;
  }
  figcaption {
    margin-top: 4px;
    font: 400 0.68rem/1.2 var(--read);
    color: var(--ink-soft);
  }
  .note {
    margin: 6px 0 4px;
    font: 700 1.05rem/1.2 var(--hand);
  }
  .keys {
    margin: 0;
    font: 400 0.8rem/1.6 var(--read);
  }
  .keys kbd {
    display: inline-block;
    min-width: 1.3em;
    margin-right: 2px;
    padding: 0 4px;
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    background: #fff;
    font: 700 0.72rem/1.4 var(--label);
    text-align: center;
  }
  .steer {
    margin: 2px 0 0;
    font: 700 0.85rem/1.3 var(--read);
    color: #a2412f;
  }
</style>
