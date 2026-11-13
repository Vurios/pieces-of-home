<script lang="ts">
  import { KID_PALETTES, type KidId } from "../../game/actors/character";

  /**
   * A small ink-and-wash portrait of one of the four kids, for co-op
   * character select and name tags. Drawn from each kid's 3D palette:
   * Remi's round dark hair, Nori's cap, Lumi's beret and Theo's curls and goggles.
   */
  interface Props {
    kid: KidId;
    size?: number;
  }
  let { kid, size = 64 }: Props = $props();
  const p = $derived(KID_PALETTES[kid]);
  const INK = "#2b2622";
</script>

<svg class="face" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <!-- Shoulders and shirt. -->
  <path d="M12 64 C 13 52, 22 47, 32 47 C 42 47, 51 52, 52 64 Z" fill={p.top} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
  <path d="M26 48.5 L 32 54 L 38 48.5" fill="none" stroke={p.topDark} stroke-width="2.2" stroke-linecap="round" />
  {#if kid === "lumi"}
    <!-- Long hair behind the head. -->
    <path d="M14 30 C 12 42, 14 50, 18 54 L 46 54 C 50 50, 52 42, 50 30 Z" fill={p.hair} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
  {/if}
  <!-- Head. -->
  <path d="M32 12.5 C 44 12.2, 50.6 20.6, 50.2 30.4 C 49.8 40.6, 42.6 46.8, 32 46.6 C 21.4 46.8, 14.2 40.4, 13.8 30.2 C 13.6 20.4, 20.4 12.6, 32 12.5 Z" fill={p.skin} stroke={INK} stroke-width="2.2" />
  {#if kid === "remi"}
    <path d="M14.2 28 C 12.4 16, 21 8.6, 32 8.8 C 43.4 8.6, 51.6 16.6, 49.8 28 C 46 22.4, 40 20.6, 32.4 21.4 C 25 20.4, 18.4 22.4, 14.2 28 Z" fill={p.hair} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
  {:else if kid === "nori"}
    <path d="M13.6 25 C 13.6 14, 22 8.6, 32 8.6 C 42 8.6, 50.4 14, 50.4 25 Z" fill={p.accent} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
    <path d="M30 24.6 C 38 22.6, 50 22.4, 57 26.6 C 50 29.4, 40 29.2, 30 27.4 Z" fill={p.accentDark} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
    <circle cx="32" cy="9.6" r="2.2" fill={p.accentDark} stroke={INK} stroke-width="1.6" />
    <path d="M14.4 27 C 15 31, 16 33, 17.4 34.4" fill="none" stroke={p.hair} stroke-width="3" stroke-linecap="round" />
  {:else if kid === "lumi"}
    <path d="M14.4 24 C 15 17, 22 12.6, 32 12.6 C 42 12.6, 49 17, 49.6 24 C 44 21.6, 38 21.4, 32 22.6 C 26 21.4, 20 21.6, 14.4 24 Z" fill={p.hair} stroke={INK} stroke-width="2" stroke-linejoin="round" />
    <path d="M11 19.6 C 12 9, 26 4.6, 38 6.4 C 48 8, 55 13.4, 53 19.2 C 44 22.4, 22 23, 11 19.6 Z" fill={p.accent} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
    <path d="M33 6.4 L 34.4 2.6" stroke={INK} stroke-width="2.2" stroke-linecap="round" />
  {:else}
    {#each [[16, 18], [22, 12], [29, 9], [36, 9], [43, 12], [48, 18], [19, 24], [45, 24]] as [cx, cy] (`${cx}-${cy}`)}
      <circle {cx} {cy} r="6.4" fill={p.hair} stroke={INK} stroke-width="2" />
    {/each}
    <path d="M17 21.6 C 26 18.6, 38 18.6, 47 21.6" fill="none" stroke={INK} stroke-width="3.2" stroke-linecap="round" />
    <circle cx="25" cy="20.4" r="4.2" fill="#BFD8DF" stroke={INK} stroke-width="2" />
    <circle cx="39" cy="20.4" r="4.2" fill="#BFD8DF" stroke={INK} stroke-width="2" />
  {/if}
  <!-- Eyes, cheeks and a small smile. -->
  <ellipse cx="25.6" cy="32.4" rx="2.3" ry="3" fill={INK} />
  <ellipse cx="38.4" cy="32.4" rx="2.3" ry="3" fill={INK} />
  <circle cx="26.4" cy="31.2" r="0.8" fill="#fff" />
  <circle cx="39.2" cy="31.2" r="0.8" fill="#fff" />
  <ellipse cx="21" cy="38" rx="3" ry="1.8" fill="#E2856A" opacity="0.55" />
  <ellipse cx="43" cy="38" rx="3" ry="1.8" fill="#E2856A" opacity="0.55" />
  <path d="M28.6 39.4 C 30.6 41.4, 33.4 41.4, 35.4 39.4" fill="none" stroke={INK} stroke-width="2" stroke-linecap="round" />
</svg>

<style>
  .face {
    display: block;
    overflow: visible;
  }
</style>
