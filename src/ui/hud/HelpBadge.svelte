<script lang="ts">
  import { KID_NAMES } from "../../content/story";
  import type { KidId } from "../../game/actors/character";
  import { presence } from "../../net/presence";
  import KidFace from "../panels/KidFace.svelte";

  /**
   * Co-op roles (Phase 06): while friends hold the local player's station
   * steady, a small taped note above the game card says who is helping.
   * The station's game is a little kinder while they do.
   */
  let helpers = $state<readonly string[]>([]);
  $effect(() => presence.subscribe(() => (helpers = presence.helpers)));

  const names = $derived(helpers.map((k) => KID_NAMES[k as KidId] ?? k));
  const line = $derived(names.length === 1 ? `${names[0]} is holding it steady.` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are holding it steady.`);
</script>

{#if helpers.length}
  <div class="help-badge" role="status" aria-live="polite">
    <span class="faces" aria-hidden="true">
      {#each helpers as kid (kid)}<KidFace kid={kid as KidId} size={34} />{/each}
    </span>
    <span>{line}</span>
  </div>
{/if}

<style>
  .help-badge {
    position: fixed;
    top: 18px;
    left: 50%;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px 6px 8px;
    transform: translateX(-50%) rotate(-1deg);
    border: 2px solid var(--ink, #2b2622);
    border-radius: 4px 6px 5px 4px;
    background: #fdf0cf;
    box-shadow: 0 3px 0 rgba(43, 38, 34, 0.4);
    font: 700 1.05rem/1.2 var(--hand);
    pointer-events: none;
  }
  .faces {
    display: flex;
  }
  .faces :global(.face + .face) {
    margin-left: -10px;
  }
</style>
