<script lang="ts">
  import { getStroke } from "perfect-freehand";

  /** A pen underline with real pressure: thick in the middle, thin at the ends. */
  interface Props {
    width?: number;
    seed?: number;
    color?: string;
  }
  let { width = 160, seed = 1, color = "var(--amber)" }: Props = $props();

  const d = $derived.by(() => {
    let s = seed;
    const r = (): number => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const points: [number, number, number][] = [];
    for (let i = 0; i <= 12; i += 1) {
      const x = 4 + (i / 12) * (width - 8);
      const y = 7 + Math.sin(i * 0.7 + seed) * 1.2 + (r() - 0.5) * 0.8 + (i / 12) * 1.5;
      points.push([x, y, 0.35 + Math.sin((i / 12) * Math.PI) * 0.6]);
    }
    const outline = getStroke(points, { size: 6, thinning: 0.7, smoothing: 0.6, streamline: 0.4, simulatePressure: false });
    if (outline.length === 0) return "";
    return `M${outline.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
  });
</script>

<svg class="underline" viewBox={`0 0 ${width} 14`} width={width} height="14" aria-hidden="true" focusable="false">
  <path {d} fill={color} />
</svg>

<style>
  .underline {
    display: block;
    max-width: 100%;
    height: auto;
    margin-top: -4px;
  }
</style>
