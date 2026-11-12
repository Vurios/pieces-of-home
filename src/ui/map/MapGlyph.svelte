<svelte:options namespace="svg" />

<script lang="ts" module>
  import type { MapIcon } from "../../game/worlds/types";

  /** A circle as a path, so every glyph is a list of paths. */
  const o = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0 Z`;

  type Stroke = { d: string; fill?: string };

  /**
   * Dad's little map pictures, drawn for this game on a 24 by 24 grid in
   * pencil-and-ink style: a few strokes each, flat colour inside.
   */
  export const GLYPHS: Record<MapIcon | "unknown", Stroke[]> = {
    lamp: [{ d: "M8.5 9 L15.5 9 L14 3.5 L10 3.5 Z", fill: "#F2A541" }, { d: "M12 9 L12 17.5" }, { d: "M8 18.5 L16 18.5" }, { d: "M7 12 L5 13.5 M17 12 L19 13.5 M12 12.5 L12 13" }],
    tag: [{ d: "M4.5 8 L13 7.6 L19.5 12 L13 16.4 L4.5 16 Z", fill: "#F4ECDD" }, { d: o(14.5, 12, 1.2) }, { d: "M7 11 L11 11 M7 13.5 L10 13.5" }],
    house: [{ d: "M5 12 L12 5 L19 12 L18.6 19.5 L5.4 19.5 Z", fill: "#E8C9A0" }, { d: "M3.8 12.8 L12 4.6 L20.2 12.8" }, { d: "M10.4 19.5 L10.4 14.6 L13.6 14.6 L13.6 19.5", fill: "#C0573E" }],
    workshop: [{ d: "M4 19.5 L4.2 10.5 L12 6 L19.8 10.5 L20 19.5 Z", fill: "#C98A5A" }, { d: "M8.5 12 L15.5 12 L15.5 15.5 L8.5 15.5 Z", fill: "#FFD08A" }, { d: "M12 12 L12 15.5" }],
    mailbox: [{ d: "M7 11.5 C7 7.4 17 7.4 17 11.5 L17 15 L7 15 Z", fill: "#5C7393" }, { d: "M12 15 L12 20.5" }, { d: "M17 8.5 L20.5 8.5 L20.5 11 L17 11", fill: "#C0573E" }],
    garden: [{ d: "M12 21 L12 11.5" }, { d: "M12 15.5 C 9.5 14, 8 14.6, 7.6 16.2 C 9.5 17, 11 16.8, 12 15.5 Z", fill: "#7FA37A" }, { d: o(12, 8, 3.6), fill: "#F2B23E" }, { d: o(12, 8, 1.4), fill: "#8A5A3A" }],
    dish: [{ d: "M4.5 8.5 C 7 17, 17 17, 19.5 8.5 Z", fill: "#E9E3D6" }, { d: "M12 14.2 L9.5 20.5 M12 14.2 L14.5 20.5 M8.5 20.5 L15.5 20.5" }, { d: "M12 13 L15.5 6.5" }],
    hill: [{ d: "M2.5 18.5 C 6 9, 18 9, 21.5 18.5 Z", fill: "#9BB979" }, { d: "M12 11 L12 7.5 L15 8.6 L12 9.6", fill: "#F2A541" }],
    meadow: [{ d: "M11 21 L11.4 12" }, { d: o(11, 9, 5.2), fill: "#7FA37A" }, { d: "M14.5 11.5 L14.5 17.5 M17.5 11.5 L17.5 17.5" }, { d: "M14 17.5 L18 17.5", fill: "#C0573E" }],
    treehouse: [{ d: "M12 21 L12 13" }, { d: o(12, 9, 6), fill: "#7FA37A" }, { d: "M8.6 9 L15.4 9 L15.4 13.5 L8.6 13.5 Z", fill: "#C0573E" }, { d: "M8 9 L12 6.2 L16 9" }],
    playground: [{ d: "M5 20 L5 8 L9 8 L9 20" }, { d: "M5 11 L9 11 M5 14 L9 14 M5 17 L9 17" }, { d: "M9 8 C 13 9, 15 16, 20 20", fill: "none" }, { d: "M9 9.6 C 12.6 10.6, 14.6 17, 19 20.2", fill: "none" }],
    pond: [{ d: "M3.5 13 C 3.5 8.5, 20.5 8.5, 20.5 13 C 20.5 17.5, 3.5 17.5, 3.5 13 Z", fill: "#7FB3C8" }, { d: "M7.5 13 C 9 12, 10.5 14, 12 13 M13.5 14.6 C 15 13.6, 16.5 15.6, 18 14.6" }],
    tent: [{ d: "M3.5 19.5 L12 5.5 L20.5 19.5 Z", fill: "#D9583F" }, { d: "M12 19.5 L12 12 L9 19.5", fill: "#8A3A2A" }, { d: "M10.5 3.5 L12 5.5 L13.5 3.5" }],
    weather: [{ d: "M12 21 L12 9.5" }, { d: "M5.5 9.5 L18.5 9.5" }, { d: o(5.5, 9.5, 1.8), fill: "#F2A541" }, { d: o(18.5, 9.5, 1.8), fill: "#F2A541" }, { d: o(12, 5, 1.8), fill: "#F2A541" }, { d: "M12 9.5 L12 6.8" }],
    rocket: [{ d: "M12 3 C 16 7, 16 14, 15 17.5 L 9 17.5 C 8 14, 8 7, 12 3 Z", fill: "#E9E3D6" }, { d: "M9 13.5 L6 18.5 L9.2 17.5 Z M15 13.5 L18 18.5 L14.8 17.5 Z", fill: "#C0573E" }, { d: o(12, 9.5, 1.7), fill: "#5C7393" }, { d: "M10.5 19.5 L12 21.5 L13.5 19.5" }],
    orchard: [{ d: "M12 21 L12 13.5" }, { d: o(12, 9.5, 5.8), fill: "#7FA37A" }, { d: o(9.5, 8.5, 1.1), fill: "#C0573E" }, { d: o(14.5, 10.5, 1.1), fill: "#C0573E" }, { d: o(12, 6, 1.1), fill: "#C0573E" }],
    windpump: [{ d: "M8 21 L11 9 M16 21 L13 9 M9 16 L15 16" }, { d: o(12, 7.5, 4.6), fill: "#E9E3D6" }, { d: "M12 3 L12 12 M7.4 7.5 L16.6 7.5 M8.8 4.3 L15.2 10.7 M15.2 4.3 L8.8 10.7" }],
    balloon: [{ d: "M12 3 C 17 3, 18.6 7.6, 17 11 C 15.8 13.5, 13.4 15, 12 15.6 C 10.6 15, 8.2 13.5, 7 11 C 5.4 7.6, 7 3, 12 3 Z", fill: "#F2B23E" }, { d: "M12 3 C 10 6, 10 12, 12 15.6 M12 3 C 14 6, 14 12, 12 15.6" }, { d: "M10 18 L14 18 L13.6 21 L10.4 21 Z", fill: "#8A5A3A" }, { d: "M10.4 15 L10.2 18 M13.6 15 L13.8 18" }],
    lander: [{ d: "M7 8 L17 8 L17 13.5 L7 13.5 Z", fill: "#D2A445" }, { d: "M7 13.5 L4 19.5 M17 13.5 L20 19.5 M9.5 13.5 L8.5 19.5 M14.5 13.5 L15.5 19.5" }, { d: "M2.6 19.5 L5.4 19.5 M18.6 19.5 L21.4 19.5" }, { d: "M9 8 L9 6.5 M15 8 L15 6.5" }],
    flag: [{ d: "M7 21 L7 3.5" }, { d: "M7 4 L18.5 4 L18.5 11 L7 11 Z", fill: "#F4ECDD" }, { d: "M7 4 L12 4 L12 7.6 L7 7.6 Z", fill: "#5C7393" }, { d: "M12.5 6 L18.5 6 M12.5 8.5 L18.5 8.5", fill: "none" }],
    camera: [{ d: "M12 13 L7.5 21 M12 13 L16.5 21 M12 13 L12 21" }, { d: "M8 7.5 L16 7.5 L16 13 L8 13 Z", fill: "#3A3636" }, { d: "M16 9 L19.5 8 L19.5 12.5 L16 11.5 Z", fill: "#8E8B86" }],
    listener: [{ d: "M9 10 L15 10 L15 17.5 L9 17.5 Z", fill: "#D2A445" }, { d: "M2.5 12 L9 12 L9 15.5 L2.5 15.5 Z M15 12 L21.5 12 L21.5 15.5 L15 15.5 Z", fill: "#3B4A7A" }, { d: "M12 10 L12 6.5" }, { d: o(12, 5.5, 1.3), fill: "#E9E3D6" }],
    mirrors: [{ d: "M5 9 L19 9 L19 19 L5 19 Z", fill: "#D2A445" }, { d: "M7 11 L17 11 L17 17 L7 17 Z", fill: "#283049" }, { d: "M9.5 11 L9.5 17 M12 11 L12 17 M14.5 11 L14.5 17 M7 14 L17 14" }, { d: "M15.5 4 L16.5 7 M19.5 5.5 L18 7.6" }],
    console: [{ d: "M4.5 13 L19.5 13 L19.5 15.5 L4.5 15.5 Z", fill: "#8A5A3A" }, { d: "M6 15.5 L6 21 M18 15.5 L18 21" }, { d: "M8 6 L16 6 L16 12 L8 12 Z", fill: "#3B4A6B" }, { d: "M9.5 7.5 L14.5 7.5 L14.5 10.5 L9.5 10.5 Z", fill: "#9CFFB6" }],
    crater: [{ d: "M3 12.5 C 3 7.5, 21 7.5, 21 12.5 C 21 17.5, 3 17.5, 3 12.5 Z", fill: "#D9C7A6" }, { d: "M6.5 12.8 C 6.5 10, 17.5 10, 17.5 12.8 C 17.5 15.6, 6.5 15.6, 6.5 12.8 Z", fill: "#9C8A70" }],
    rover: [{ d: "M4 9.5 L20 9.5 L20 11 L4 11 Z", fill: "#2A3864" }, { d: "M7 11 L17 11 L17 15 L7 15 Z", fill: "#E9E3D6" }, { d: o(7, 17.5, 2), fill: "#9C968C" }, { d: o(12, 17.5, 2), fill: "#9C968C" }, { d: o(17, 17.5, 2), fill: "#9C968C" }, { d: "M15 9.5 L15 4.5" }, { d: "M13 3.5 L17.5 3.5 L17.5 5.5 L13 5.5 Z", fill: "#E9E3D6" }],
    rocks: [{ d: "M3 19 L4 15.5 L20.5 15.5 L21 19 Z", fill: "#9A5B3A" }, { d: "M5 15.5 L6 12 L18 12 L19 15.5 Z", fill: "#B97A52" }, { d: "M8 12 L9 8.6 L15.5 8.6 L16.5 12 Z", fill: "#9A5B3A" }],
    bounce: [{ d: o(5.5, 16, 3.2), fill: "#B8714A" }, { d: o(12.5, 12.5, 2.6), fill: "#B8714A" }, { d: o(18.5, 9.5, 2), fill: "#B8714A" }, { d: "M2.5 20 C 4 13, 7 12, 9.5 14 C 11 9, 15 8.5, 16.5 9 C 18 6, 20 6, 21.5 7", fill: "none" }],
    wheel: [{ d: o(12, 12, 7.5), fill: "#9C968C" }, { d: o(12, 12, 5), fill: "#5E6468" }, { d: o(12, 12, 1.8), fill: "#E9E3D6" }, { d: "M12 4.5 L10.5 6.5 M12 4.5 L13.5 6.5 M19.5 12 L17.5 10.5 M19.5 12 L17.5 13.5 M12 19.5 L10.5 17.5 M12 19.5 L13.5 17.5 M4.5 12 L6.5 10.5 M4.5 12 L6.5 13.5" }],
    buggy: [{ d: "M4 12.5 L20 12.5 L20 14 L4 14 Z", fill: "#C4C1BA" }, { d: "M8 12.5 L8 8.5 L11 8.5 L11 12.5 Z M13 12.5 L13 8.5 L16 8.5 L16 12.5 Z", fill: "#8FA9C4" }, { d: o(6.5, 16.5, 2.6), fill: "#8C9296" }, { d: o(17.5, 16.5, 2.6), fill: "#8C9296" }, { d: "M18 12.5 L18 5" }, { d: "M15.5 5.5 C 16.5 3.5, 19.5 3.5, 20.5 5.5 Z", fill: "#EDEAE2" }],
    pennant: [{ d: "M8 21.5 L8 3.5" }, { d: "M8 4.5 L19.5 8 L8 11.5 Z", fill: "#F2B23E" }, { d: "M8 6 L11 7.2 L11 9 L8 10", fill: "#D9583F" }, { d: "M5.5 21.5 L10.5 21.5" }],
    helicopter: [{ d: "M3.5 5.5 L20.5 5.5" }, { d: "M9.5 3.6 L14.5 3.6 L14.5 4.6 L9.5 4.6 Z", fill: "#27335E" }, { d: "M12 5.5 L12 9.5" }, { d: "M8.5 9.5 L15.5 9.5 L15.5 15 L8.5 15 Z", fill: "#D9D3C6" }, { d: "M9 15 L6 20 M15 15 L18 20 M5 20 L7 20 M17 20 L19 20" }],
    corner: [{ d: "M12 13 L12 4 L19.5 8.5 L19.5 17 Z", fill: "#C6DDEA" }, { d: "M12 13 L4.5 8.5 L4.5 17 L12 21.5 Z", fill: "#A7CDE0" }, { d: "M12 13 L19.5 17 L12 21.5 L4.5 17 Z", fill: "#DCEBF2" }, { d: "M3 4 L10.5 11.5", fill: "none" }],
    unknown: [{ d: o(12, 12, 8.5), fill: "#F4ECDD" }, { d: "M9.2 9.6 C 9.4 7.2, 11 6.2, 12.4 6.2 C 14.4 6.2, 15.6 7.6, 15.5 9.2 C 15.4 11.2, 13 11.8, 12.4 13.6 L 12.3 14.6" }, { d: "M12.3 17.4 L12.35 17.6" }],
  };
</script>

<script lang="ts">
  interface Props {
    icon: MapIcon | "unknown";
    size?: number;
    ink?: string;
    x?: number;
    y?: number;
  }
  let { icon, size = 22, ink = "#2B2622", x = 0, y = 0 }: Props = $props();
  const strokes = $derived(GLYPHS[icon]);
  const k = $derived(size / 24);
</script>

<g transform="translate({x} {y}) scale({k}) translate(-12 -12)" class="glyph">
  {#each strokes as s, i (i)}
    <path d={s.d} fill={s.fill ?? "none"} stroke={ink} stroke-width={1.6 / Math.max(0.6, k)} stroke-linecap="round" stroke-linejoin="round" />
  {/each}
</g>
