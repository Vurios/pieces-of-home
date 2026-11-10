<script lang="ts">
  import type { NetClient, NetState } from "../net/client";

  interface Props {
    net: NetClient;
    version: string;
  }

  let { net, version }: Props = $props();
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

<!-- Phase 01 placeholder. The notebook UI replaces this in Phase 03. -->
<aside class="tag" aria-live="polite">
  <span class="name">Pieces of Home</span>
  {#if label}<span class="net">{label}</span>{/if}
  <span class="build">Build {version}. Setup preview.</span>
</aside>

<style>
  .tag {
    position: fixed;
    left: 16px;
    bottom: 16px;
    max-width: min(320px, calc(100vw - 32px));
    display: grid;
    gap: 2px;
    padding: 10px 14px;
    background: #f4ecdd;
    color: #2b2622;
    border: 2px solid #2b2622;
    border-radius: 3px 10px 4px 8px;
    box-shadow: 3px 4px 0 rgba(43, 38, 34, 0.35);
    font: 15px/1.35 "Segoe Print", "Bradley Hand", "Comic Sans MS", ui-rounded, system-ui, sans-serif;
    transform: rotate(-1.2deg);
  }
  .name {
    font-weight: 700;
    font-size: 17px;
  }
  .build {
    opacity: 0.7;
    font-size: 13px;
  }
</style>
