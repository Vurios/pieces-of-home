<script lang="ts">
  import type { Snippet } from "svelte";
  import { trap } from "./focus";
  import Icon from "./Icon.svelte";
  import { t } from "./settings.svelte";

  /**
   * A notebook page that slides in from the right, taped at the top. Used for
   * settings, credits, play together and chapters. It is a real modal dialog:
   * focus stays inside, Escape closes it, and focus goes back afterwards.
   */
  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
    wide?: boolean;
  }
  let { title, onclose, children, wide = false }: Props = $props();
  const id = `panel-${Math.random().toString(36).slice(2, 8)}`;

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }
</script>

<div class="scrim" aria-hidden="true" onpointerdown={onclose}></div>
<div class="sheet paper" class:wide role="dialog" aria-modal="true" aria-labelledby={id} tabindex="-1" use:trap onkeydown={onkey}>
  <span class="tape" aria-hidden="true"></span>
  <header>
    <h2 {id}>{title}</h2>
    <button type="button" class="close" onclick={onclose} aria-label={t("panel.close")}><Icon name="close" size={26} /></button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: rgba(24, 18, 30, 0.18);
  }
  .sheet {
    position: fixed;
    top: max(24px, 5vh);
    right: max(16px, 4vw);
    bottom: max(24px, 5vh);
    width: min(560px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    border-radius: 3px 4px 5px 3px;
    transform: rotate(0.5deg);
    animation: slide 0.5s var(--ease-spring) both;
  }
  .sheet.wide {
    width: min(760px, calc(100vw - 32px));
  }
  .tape {
    position: absolute;
    top: -12px;
    left: 50%;
    width: 120px;
    height: 26px;
    margin-left: -60px;
    transform: rotate(-3deg);
    background: rgba(242, 165, 65, 0.55);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 26px 22px 6px 30px;
    border-bottom: 2px solid rgba(192, 87, 62, 0.35);
  }
  h2 {
    margin: 0;
    font: 700 1.7rem/1.1 var(--hand);
  }
  .close {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: none;
    color: var(--ink);
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring), border-color 0.15s;
  }
  .close:hover {
    border-color: var(--ink);
    transform: rotate(8deg);
  }
  .close:active {
    transform: scale(0.92);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 30px 30px;
    font-size: 1rem;
    line-height: 1.5;
  }
  @keyframes slide {
    from {
      transform: translateX(110%) rotate(4deg);
    }
    to {
      transform: translateX(0) rotate(0.5deg);
    }
  }
  :global(:root[data-motion="reduce"]) .sheet {
    animation: none;
  }
  @media (max-width: 640px) {
    .sheet {
      inset: 12px;
      width: auto;
      transform: none;
    }
  }
</style>
