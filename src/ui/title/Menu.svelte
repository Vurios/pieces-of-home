<script lang="ts">
  import { type PanelId, flow } from "../flow.svelte";
  import { t } from "../settings.svelte";

  /**
   * The main menu as notebook index tabs, sliding in from the right edge.
   * Arrow keys move between tabs; Enter opens one.
   */
  interface Props {
    hasSave: boolean;
    chapters: boolean;
    onstart: (fresh: boolean) => void;
  }
  let { hasSave, chapters, onstart }: Props = $props();
  let confirming = $state(false);

  type Item = { id: string; label: string; color: string; act: () => void; href?: string };
  const items = $derived.by((): Item[] => {
    const list: Item[] = [];
    if (hasSave) list.push({ id: "continue", label: t("menu.continue"), color: "#F2A541", act: () => onstart(false) });
    list.push({ id: "new", label: t("menu.new"), color: hasSave ? "#F4ECDD" : "#F2A541", act: () => (hasSave ? (confirming = true) : onstart(true)) });
    list.push({ id: "together", label: t("menu.together"), color: "#A9C49C", act: () => open("together") });
    if (chapters) list.push({ id: "chapters", label: t("menu.chapters"), color: "#E6B9A6", act: () => open("chapters") });
    list.push({ id: "guide", label: t("menu.guide"), color: "#C9D3DF", act: () => undefined, href: "/field-guide/" });
    list.push({ id: "settings", label: t("menu.settings"), color: "#EBD9A8", act: () => open("settings") });
    list.push({ id: "credits", label: t("menu.credits"), color: "#D9CDBD", act: () => open("credits") });
    return list;
  });

  function open(panel: PanelId): void {
    flow.open(panel);
  }

  let nav: HTMLElement | null = $state(null);

  function onkey(event: KeyboardEvent): void {
    if (!nav) return;
    const tabs = [...nav.querySelectorAll<HTMLElement>(".tab")];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = i < 0 ? 0 : (i + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
    }
  }

  $effect(() => {
    queueMicrotask(() => nav?.querySelector<HTMLElement>(".tab")?.focus({ preventScroll: true }));
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav class="menu" aria-label={t("menu.label")} bind:this={nav} onkeydown={onkey}>
  <ul>
    {#each items as item, i (item.id)}
      <li style:--i={i} style:--c={item.color} style:--tilt={`${((i * 37) % 5) - 2}deg`}>
        {#if item.href}
          <a class="tab" href={item.href}>{item.label}</a>
        {:else}
          <button type="button" class="tab" onclick={item.act}>{item.label}</button>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

{#if confirming}
  <div class="confirm paper" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
    <p id="confirm-text">{t("menu.newConfirm")}</p>
    <div class="row">
      <button type="button" class="btn" onclick={() => (confirming = false)}>{t("menu.newNo")}</button>
      <button type="button" class="btn amber" onclick={() => onstart(true)}>{t("menu.newYes")}</button>
    </div>
  </div>
{/if}


<style>
  .menu {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
    justify-items: end;
  }
  li {
    animation: tab-in 0.6s var(--ease-spring) both;
    animation-delay: calc(var(--i) * 70ms + 120ms);
  }
  .tab {
    display: flex;
    align-items: center;
    min-width: 13.5rem;
    min-height: 56px;
    padding: 6px 54px 4px 22px;
    margin-right: -30px;
    font: 700 1.35rem/1 var(--hand);
    color: var(--ink);
    text-decoration: none;
    background: var(--c);
    border: 2.5px solid var(--ink);
    border-right: 0;
    border-radius: 14px 0 0 14px / 16px 0 0 12px;
    box-shadow: -3px 4px 0 rgba(43, 38, 34, 0.45);
    transform: rotate(var(--tilt));
    cursor: pointer;
    transition:
      transform 0.18s var(--ease-spring),
      margin 0.18s var(--ease-spring),
      box-shadow 0.15s;
  }
  .tab:hover,
  .tab:focus-visible {
    margin-right: -6px;
    box-shadow: -5px 6px 0 rgba(43, 38, 34, 0.5);
  }
  .tab:active {
    transform: rotate(var(--tilt)) translateX(4px);
  }
  .menu :global(.tab:focus-visible) {
    outline: 3px dashed var(--ink);
    outline-offset: 3px;
  }
  @keyframes tab-in {
    from {
      transform: translateX(120%);
    }
    to {
      transform: translateX(0);
    }
  }
  .confirm {
    position: fixed;
    left: 50%;
    top: 50%;
    width: min(440px, calc(100vw - 32px));
    transform: translate(-50%, -50%) rotate(-0.6deg);
    padding: 22px 24px;
    font: 700 1.2rem/1.4 var(--hand);
    pointer-events: auto;
  }
  .confirm p {
    margin: 0 0 16px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-end;
  }
  :global(:root[data-motion="reduce"]) li {
    animation: none;
  }
  @media (max-width: 640px) {
    .menu {
      top: auto;
      bottom: 64px;
      transform: none;
    }
    .tab {
      min-width: 11rem;
      min-height: 48px;
      font-size: 1.15rem;
    }
  }
</style>
