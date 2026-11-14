<script lang="ts">
  import Icon from "../Icon.svelte";
  import { settings, t } from "../settings.svelte";

  /**
   * The quick sound card: one big volume slider and a sound on/off switch,
   * on a scrap of notebook paper. It opens from the Sound stamp in play and
   * from the speaker in the corner of the title, so nobody has to hunt
   * through Settings to turn the game down.
   */
  interface Props {
    /** Where the card sits: beside the stamp column, or above the title's corner button. */
    place: "stamps" | "corner";
    onclose: () => void;
    onmore: () => void;
  }
  let { place, onclose, onmore }: Props = $props();

  const s = $derived(settings.value);
  const level = $derived(s.muted ? 0 : s.volume.master);
  let card = $state<HTMLElement | null>(null);

  $effect(() => {
    card?.querySelector<HTMLInputElement>("input")?.focus();
    const away = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (card && target && !card.contains(target) && !(target as HTMLElement).closest?.("[data-sound-toggle]")) onclose();
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  });

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onclose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_element_to_interactive_role -->
<div class="card {place}" bind:this={card} role="dialog" aria-label={t("sound.label")} tabindex="-1" onkeydown={onkey}>
  <h2>{t("sound.label")}</h2>
  <label class="row">
    <span class="sr">{t("sound.volume")}</span>
    <span class="quiet" aria-hidden="true"><Icon name="speaker" size={22} /></span>
    <input type="range" min="0" max="1" step="0.05" value={level} style:--v={level} oninput={(e) => settings.setVolume("master", Number(e.currentTarget.value))} />
    <output>{Math.round(level * 100)}</output>
  </label>
  <div class="actions">
    <button type="button" class="toggle" class:off={s.muted} aria-pressed={s.muted} onclick={() => settings.setMuted(!s.muted)}>
      {s.muted ? t("sound.on") : t("sound.off")}
    </button>
    <button type="button" class="more" onclick={onmore}>{t("sound.more")}</button>
  </div>
</div>

<style>
  .card {
    position: fixed;
    z-index: 40;
    width: 300px;
    box-sizing: border-box;
    padding: 14px 18px 16px;
    border-radius: 6px 10px 8px 12px;
    background-color: #fffaf0;
    background-image:
      linear-gradient(rgba(35, 63, 115, 0.07) 1px, transparent 1px),
      var(--grain, none);
    background-size: 100% 26px, auto;
    color: var(--ink);
    box-shadow:
      0 2px 0 rgba(43, 38, 34, 0.5),
      0 14px 28px rgba(10, 6, 20, 0.4);
    transform: rotate(-1deg);
    animation: pop-in 0.28s var(--ease-spring, cubic-bezier(0.3, 1.5, 0.5, 1)) both;
  }
  .card.stamps {
    top: max(18px, env(safe-area-inset-top));
    right: calc(max(18px, env(safe-area-inset-right)) + 96px);
    transform-origin: 100% 20%;
  }
  .card.corner {
    left: max(20px, env(safe-area-inset-left));
    bottom: calc(max(20px, env(safe-area-inset-bottom)) + 70px);
    transform-origin: 10% 100%;
  }
  h2 {
    margin: 0 0 8px;
    font: 700 1.5rem/1 var(--hand);
    color: var(--clay, #b13f2c);
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr 2.4em;
    align-items: center;
    gap: 10px;
  }
  .quiet {
    display: grid;
    color: var(--ink);
  }
  .quiet :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  input[type="range"] {
    width: 100%;
    height: 28px;
    margin: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }
  input[type="range"]::-webkit-slider-runnable-track {
    height: 10px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: linear-gradient(90deg, #f2a541 calc(var(--v) * 100%), #efe5d0 calc(var(--v) * 100%));
  }
  input[type="range"]::-moz-range-track {
    height: 10px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: linear-gradient(90deg, #f2a541 calc(var(--v) * 100%), #efe5d0 calc(var(--v) * 100%));
  }
  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -9px;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: #fffaf0;
  }
  input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: #fffaf0;
  }
  input[type="range"]:focus-visible {
    outline: 3px solid #f2a541;
    outline-offset: 3px;
    border-radius: 999px;
  }
  output {
    font: 700 1rem/1 var(--read);
    text-align: right;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    align-items: center;
    margin-top: 12px;
  }
  .toggle {
    padding: 7px 14px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #f6e7c8;
    color: var(--ink);
    font: 700 0.95rem/1 var(--read);
    cursor: pointer;
  }
  .toggle.off {
    background: #f2a541;
  }
  .more {
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: 400 1rem/1.2 var(--hand);
    text-decoration: underline wavy rgba(177, 63, 44, 0.6);
    text-underline-offset: 4px;
    cursor: pointer;
  }
  .toggle:focus-visible,
  .more:focus-visible {
    outline: 3px solid #f2a541;
    outline-offset: 3px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @keyframes pop-in {
    from {
      opacity: 0;
      scale: 0.85;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }
</style>
