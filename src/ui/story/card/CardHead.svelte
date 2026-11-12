<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The band across the top of a pop-up game card: a round badge with a small
   * drawing, a short label, a big handwritten title and an optional stamp
   * (for example "Model, not to scale"). Styles live in src/ui/game-card.css.
   */
  interface Props {
    kicker: string;
    title: string;
    stamp?: string;
    /** The badge drawing: a whole <svg> element. */
    badge: Snippet;
  }
  let { kicker, title, stamp, badge }: Props = $props();
</script>

<header class="gc-head">
  <span class="gc-badge" aria-hidden="true">{@render badge()}</span>
  <div class="gc-names">
    <p class="gc-kicker">{kicker}</p>
    <h2 class="gc-title">{title}</h2>
  </div>
  {#if stamp}<span class="gc-stamp">{stamp}</span>{/if}
</header>
