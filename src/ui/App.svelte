<script lang="ts">
  import type { Engine } from "../game/engine";
  import type { NetClient, NetState } from "../net/client";
  import DebugOverlay from "./DebugOverlay.svelte";
  import Hud from "./Hud.svelte";

  interface Props {
    net: NetClient;
    engine: Engine;
    version: string;
    debug: boolean;
  }

  let { net, engine, version, debug }: Props = $props();
  // `subscribe` reports the current state right away, so this default never shows.
  let state: NetState = $state({ status: "solo", room: null, players: 1 });

  $effect(() => net.subscribe((next) => (state = next)));

  const label = $derived.by(() => {
    switch (state.status) {
      case "connecting":
        return "Finding your room";
      case "connected":
        return state.players === 1 ? "Room open. Just you so far." : `Room open. ${state.players} friends here.`;
      case "offline":
        return "Friends can't join right now. You can still play.";
      case "full":
        return "That room is full. You can still play on your own.";
      default:
        return "";
    }
  });
</script>

<Hud {engine} />
{#if debug}<DebugOverlay {engine} {version} />{/if}
{#if label}
  <aside class="net" aria-live="polite">{label}</aside>
{/if}

<style>
  .net {
    position: fixed;
    left: 50%;
    top: 16px;
    transform: translateX(-50%) rotate(-0.8deg);
    max-width: calc(100vw - 32px);
    padding: 8px 14px;
    background: #f4ecdd;
    color: #2b2622;
    border: 2px solid #2b2622;
    border-radius: 4px 10px 4px 9px;
    box-shadow: 3px 4px 0 rgba(43, 38, 34, 0.3);
    font: 15px/1.35 "Segoe Print", "Bradley Hand", "Comic Sans MS", ui-rounded, system-ui, sans-serif;
  }
</style>
