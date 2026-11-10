<script lang="ts">
  import type { Engine } from "../../game/engine";

  /** Small paper notes pinned at the top of the screen: "Saved", "Photo kept", "Nori joined". */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();
  let notes = $state<{ key: number; text: string; image?: string }[]>([]);
  let counter = 0;

  $effect(() =>
    engine.bus.on("toast", ({ text }) => {
      const key = counter++;
      notes = [...notes.slice(-2), { key, text }];
      setTimeout(() => (notes = notes.filter((n) => n.key !== key)), 2800);
    }),
  );
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each notes as note, i (note.key)}
    <p class="note" style:--tilt={`${i % 2 ? 1.5 : -1.2}deg`}>{note.text}</p>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    top: max(18px, env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    gap: 8px;
    pointer-events: none;
  }
  .note {
    margin: 0;
    padding: 8px 18px 6px;
    font: 700 1.1rem/1.2 var(--hand);
    color: var(--ink);
    background: #fff4c9;
    box-shadow: 2px 4px 8px -2px rgba(30, 20, 10, 0.45);
    transform: rotate(var(--tilt));
    animation: pin 0.4s var(--ease-spring);
    position: relative;
  }
  .note::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    border-radius: 50%;
    background: var(--clay);
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25);
  }
  @keyframes pin {
    from {
      transform: translateY(-24px) rotate(8deg);
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .note {
    animation: none;
  }
</style>
