<script lang="ts">
  import type { GameEvents } from "../game/core/events";
  import type { Engine } from "../game/engine";

  /** Dev-only numbers: fps, draw calls, triangles, memory and the quality tier. */
  interface Props {
    engine: Engine;
    version: string;
  }
  let { engine, version }: Props = $props();
  let stats: GameEvents["debug:stats"] | null = $state(null);

  $effect(() => engine.bus.on("debug:stats", (next) => (stats = next)));
</script>

{#if stats}
  <pre class="debug" aria-hidden="true">{`${stats.fps} fps  ${stats.tier}
${stats.calls} calls  ${(stats.triangles / 1000).toFixed(0)}k tris
${stats.geometries} geo  ${stats.textures} tex
v${version}`}</pre>
{/if}

<style>
  .debug {
    position: fixed;
    left: 8px;
    bottom: 8px;
    opacity: 0.85;
    margin: 0;
    padding: 6px 8px;
    background: rgba(43, 38, 34, 0.72);
    color: #f4ecdd;
    font: 11px/1.35 ui-monospace, monospace;
    border-radius: 4px;
    pointer-events: none;
  }
</style>
