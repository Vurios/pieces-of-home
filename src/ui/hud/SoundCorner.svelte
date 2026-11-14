<script lang="ts">
  import Icon from "../Icon.svelte";
  import { settings, t } from "../settings.svelte";
  import SoundPopover from "./SoundPopover.svelte";

  /**
   * A speaker in the bottom-left corner of the title, the menu and the story,
   * so the sound can be turned down from the very first screen. On a first
   * visit (no volume picked yet) a little paper tag points at it for a few
   * seconds.
   */
  interface Props {
    onmore: () => void;
  }
  let { onmore }: Props = $props();

  let open = $state(false);
  let tip = $state(false);
  const s = $derived(settings.value);

  $effect(() => {
    if (settings.value.volumeChosen) return;
    const show = window.setTimeout(() => (tip = true), 2600);
    const hide = window.setTimeout(() => (tip = false), 10_600);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  });
</script>

<div class="corner">
  <button
    type="button"
    class="speaker"
    class:muted={s.muted}
    data-sound-toggle
    aria-expanded={open}
    aria-label={t("sound.label")}
    onclick={() => {
      open = !open;
      tip = false;
    }}
  >
    <Icon name="speaker" size={26} />
    {#if s.muted}<span class="slash" aria-hidden="true"></span>{/if}
    <span class="word">{t("hud.sound")}</span>
  </button>
  {#if tip && !open}
    <p class="tip" role="status">{t("sound.tip")}</p>
  {/if}
</div>
{#if open}
  <SoundPopover
    place="corner"
    onclose={() => (open = false)}
    onmore={() => {
      open = false;
      onmore();
    }}
  />
{/if}

<style>
  .corner {
    position: fixed;
    z-index: 30;
    left: max(20px, env(safe-area-inset-left));
    bottom: max(20px, env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .speaker {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px 8px 10px;
    border: var(--outline, 2px solid #2b2622);
    border-radius: var(--wobbly, 12px);
    background-color: #f6dc9a;
    background-image: var(--grain);
    color: var(--ink);
    font: 700 1.2rem/1 var(--hand);
    cursor: pointer;
    box-shadow: var(--lift, 0 2px 0 rgba(43, 38, 34, 0.55)), 0 10px 18px -8px rgba(10, 6, 20, 0.6);
    rotate: -2deg;
    transition: transform 0.2s var(--ease-spring);
  }
  .speaker:hover {
    transform: translateY(-2px) rotate(2deg);
  }
  .speaker:focus-visible {
    outline: 3px solid #f2a541;
    outline-offset: 3px;
  }
  .speaker :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .slash {
    position: absolute;
    left: 13px;
    top: 50%;
    width: 28px;
    height: 2.5px;
    border-radius: 2px;
    background: var(--clay);
    rotate: -40deg;
  }
  .tip {
    margin: 0;
    padding: 6px 14px 7px;
    border: var(--outline, 2px solid #2b2622);
    border-radius: var(--wobbly, 12px);
    background-color: #fffaf0;
    background-image: var(--grain);
    color: var(--ink);
    font: 700 1.1rem/1 var(--hand);
    white-space: nowrap;
    rotate: -2deg;
    animation: tip-in 0.35s var(--ease-spring) both;
  }
  .tip::before {
    /* An arrow and a space; the space after a CSS escape is eaten, so it is written as \00a0. */
    content: "\2190\00a0";
  }
  @keyframes tip-in {
    from {
      opacity: 0;
      translate: -10px 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tip {
      animation: none;
    }
  }
</style>
