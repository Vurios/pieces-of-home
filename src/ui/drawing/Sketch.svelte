<script lang="ts">
  import type { Prim, SketchOptions } from "./sketch";
  import { cachedBoil } from "./sketch";

  /**
   * A hand-drawn sketch that boils: three copies of the same lines, one shown
   * at a time. Pencil mode draws it lighter and thinner, before a page is inked.
   */
  interface Props {
    id: string;
    prims: () => Prim[];
    width?: number;
    height?: number;
    viewBox?: string;
    seed?: number;
    pencil?: boolean;
    options?: SketchOptions;
    color?: string;
    label?: string;
  }
  let { id, prims, viewBox = "0 0 320 220", seed = 7, pencil = false, options = {}, color, label }: Props = $props();
  const frames = $derived(cachedBoil(`${id}:${seed}:${JSON.stringify(options)}`, prims, seed, options));
</script>

<svg {viewBox} class="sketch" class:pencil role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"} style:--stroke={color}>
  {#each frames as frame, f (f)}
    <g class="frame f{f}">
      {#each frame as d, i (i)}<path {d} />{/each}
    </g>
  {/each}
</svg>

<style>
  .sketch {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  path {
    fill: none;
    stroke: var(--stroke, var(--ink));
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pencil path {
    stroke: var(--pencil);
    stroke-width: 1.3;
    opacity: 0.75;
  }
  .frame {
    animation: boil 0.36s steps(1, end) infinite;
  }
  .f1 {
    animation-delay: -0.12s;
  }
  .f2 {
    animation-delay: -0.24s;
  }
  @keyframes boil {
    0% {
      visibility: visible;
    }
    33.34% {
      visibility: hidden;
    }
  }
  :global(:root[data-motion="reduce"]) .frame {
    animation: none;
  }
  :global(:root[data-motion="reduce"]) .f1,
  :global(:root[data-motion="reduce"]) .f2 {
    display: none;
  }
</style>
