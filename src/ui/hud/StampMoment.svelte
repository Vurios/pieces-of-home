<script lang="ts">
  import { audio } from "../../audio/audio";
  import type { Engine } from "../../game/engine";
  import { t } from "../settings.svelte";

  /**
   * The stamp moment: a big ink stamp thunks onto the screen when a chapter
   * or beat is complete. Brief, and any key, click or tap skips it.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();
  let current = $state<{ key: number; lines: [string, string] } | null>(null);
  let timer = 0;
  let counter = 0;

  $effect(() =>
    engine.bus.on("stamp", ({ lines }) => {
      current = { key: counter++, lines };
      window.setTimeout(() => audio.ui("stamp"), 260);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (current = null), 3200);
    }),
  );

  function skip(): void {
    current = null;
    window.clearTimeout(timer);
  }

  function onkey(event: KeyboardEvent): void {
    if (current && event.key !== "Tab") skip();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if current}
  {#key current.key}
    <div class="moment" role="status" aria-live="assertive">
      <button type="button" class="hit" onclick={skip} aria-label={t("stamp.skip")}></button>
      <div class="stamp" aria-hidden="false">
        <span class="l1">{current.lines[0]}</span>
        <span class="l2">{current.lines[1]}</span>
      </div>
      <p class="skip">{t("stamp.skip")}</p>
    </div>
  {/key}
{/if}

<style>
  .moment {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: radial-gradient(circle, rgba(244, 236, 221, 0.25), rgba(24, 18, 30, 0.35));
  }
  .hit {
    position: absolute;
    inset: 0;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .stamp {
    position: relative;
    display: grid;
    gap: 6px;
    justify-items: center;
    padding: 22px 38px 18px;
    color: #a83a28;
    border: 7px solid #a83a28;
    outline: 3px solid #a83a28;
    outline-offset: 6px;
    border-radius: 10px;
    font: 700 clamp(2rem, 6vw, 4.4rem) / 0.95 var(--label);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: center;
    background: rgba(251, 246, 234, 0.08);
    pointer-events: none;
    /* Worn rubber: a little noise eats the ink. */
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 2.1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    animation: thunk 0.55s cubic-bezier(0.5, 0, 0.3, 1.4) both;
    transform: rotate(-7deg);
  }
  .l2 {
    font-size: 0.62em;
  }
  .skip {
    position: absolute;
    bottom: 40px;
    margin: 0;
    font: 700 1rem var(--hand);
    color: var(--paper-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    pointer-events: none;
  }
  @keyframes thunk {
    0% {
      transform: scale(2.6) rotate(-14deg);
      opacity: 0;
    }
    55% {
      transform: scale(0.94) rotate(-7deg);
      opacity: 1;
    }
    100% {
      transform: scale(1) rotate(-7deg);
    }
  }
  :global(:root[data-motion="reduce"]) .stamp {
    animation: none;
  }
</style>
