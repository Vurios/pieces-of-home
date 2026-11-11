<script lang="ts">
  import { type PanelId, flow } from "../flow.svelte";
  import Icon, { type IconName } from "../Icon.svelte";
  import { t } from "../settings.svelte";

  /**
   * The main menu: one warm amber button to begin, and a short list of
   * everything else on a pane of dusk glass beside the planet.
   * Arrow keys move between items; Enter opens one.
   */
  interface Props {
    hasSave: boolean;
    chapters: boolean;
    onstart: (fresh: boolean) => void;
  }
  let { hasSave, chapters, onstart }: Props = $props();
  let confirming = $state(false);

  type Item = { id: string; label: string; icon: IconName; act: () => void; href?: string };
  const primary = $derived.by((): Item[] => {
    const list: Item[] = [];
    if (hasSave) list.push({ id: "continue", label: t("menu.continue"), icon: "right", act: () => onstart(false) });
    list.push({ id: "new", label: t("menu.new"), icon: hasSave ? "pencil" : "right", act: () => (hasSave ? (confirming = true) : onstart(true)) });
    return list;
  });
  const rest = $derived.by((): Item[] => {
    const list: Item[] = [{ id: "together", label: t("menu.together"), icon: "people", act: () => open("together") }];
    if (chapters) list.push({ id: "chapters", label: t("menu.chapters"), icon: "book", act: () => open("chapters") });
    list.push({ id: "guide", label: t("menu.guide"), icon: "look", act: () => undefined, href: "/field-guide/" });
    list.push({ id: "settings", label: t("menu.settings"), icon: "gear", act: () => open("settings") });
    list.push({ id: "credits", label: t("menu.credits"), icon: "heart", act: () => open("credits") });
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
  <ul class="main">
    {#each primary as item, i (item.id)}
      <li style:--i={i}>
        <button type="button" class="tab start" class:second={i > 0} onclick={item.act}>
          <span>{item.label}</span>
          <span class="go" aria-hidden="true"><Icon name={item.icon} size={22} /></span>
        </button>
      </li>
    {/each}
  </ul>
  <ul class="list">
    {#each rest as item, i (item.id)}
      <li style:--i={i + primary.length}>
        {#if item.href}
          <a class="tab row" href={item.href}><Icon name={item.icon} size={22} /><span>{item.label}</span></a>
        {:else}
          <button type="button" class="tab row" onclick={item.act}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

{#if confirming}
  <div class="scrim" aria-hidden="true"></div>
  <div class="confirm card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
    <p id="confirm-text">{t("menu.newConfirm")}</p>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (confirming = false)}>{t("menu.newNo")}</button>
      <button type="button" class="btn amber" onclick={() => onstart(true)}>{t("menu.newYes")}</button>
    </div>
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    right: clamp(20px, 5vw, 88px);
    top: 50%;
    width: min(320px, calc(100vw - 40px));
    transform: translateY(-46%);
    display: grid;
    gap: 12px;
    pointer-events: auto;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  li {
    animation: item-in 0.55s var(--ease-out) both;
    animation-delay: calc(var(--i) * 60ms + 150ms);
  }
  .main {
    gap: 10px;
  }
  .start {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 64px;
    padding: 0 10px 0 26px;
    border: 1px solid rgba(140, 70, 10, 0.5);
    border-radius: 999px;
    background: linear-gradient(180deg, #f8bb62, #ee9b33);
    box-shadow:
      inset 0 1px 0 rgba(255, 240, 210, 0.7),
      0 3px 0 #b8661c,
      0 18px 34px -14px rgba(242, 165, 65, 0.8);
    color: #2b1a08;
    font: 600 1.45rem/1 var(--serif);
    letter-spacing: -0.005em;
    cursor: pointer;
    transition:
      transform 0.18s var(--ease-spring),
      box-shadow 0.18s;
  }
  .start .go {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(43, 26, 8, 0.12);
    transition: transform 0.25s var(--ease-spring);
  }
  .start:hover {
    transform: translateY(-2px);
    box-shadow:
      inset 0 1px 0 rgba(255, 240, 210, 0.7),
      0 4px 0 #b8661c,
      0 24px 40px -14px rgba(242, 165, 65, 0.9);
  }
  .start:hover .go {
    transform: translateX(3px);
  }
  .start:active {
    transform: translateY(2px);
    box-shadow:
      inset 0 1px 0 rgba(255, 240, 210, 0.7),
      0 1px 0 #b8661c,
      0 8px 16px -10px rgba(242, 165, 65, 0.8);
  }
  /* When there is a save, "New story" steps back so Continue leads. */
  .start.second {
    min-height: 54px;
    background: rgba(251, 243, 228, 0.92);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.25);
    font-size: 1.2rem;
  }
  .list {
    padding: 8px;
    border-radius: 24px;
    background: rgba(24, 22, 48, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 24px 50px -22px rgba(0, 0, 0, 0.7);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
    backdrop-filter: blur(14px) saturate(1.1);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border: 0;
    border-radius: 16px;
    background: transparent;
    color: #fbf3e4;
    font: 600 1.08rem/1 var(--read);
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .row :global(.icon) {
    color: rgba(251, 243, 228, 0.7);
    transition:
      color 0.15s,
      transform 0.25s var(--ease-spring);
  }
  .row::after {
    content: "";
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-top: 2px solid currentColor;
    border-right: 2px solid currentColor;
    transform: rotate(45deg) translateX(-6px);
    opacity: 0;
    transition:
      opacity 0.15s,
      transform 0.25s var(--ease-spring);
  }
  .row:hover,
  .row:focus-visible {
    background: rgba(255, 255, 255, 0.09);
    color: #ffd79a;
  }
  .row:hover :global(.icon),
  .row:focus-visible :global(.icon) {
    color: #ffd79a;
    transform: scale(1.08);
  }
  .row:hover::after,
  .row:focus-visible::after {
    opacity: 1;
    transform: rotate(45deg) translateX(0);
  }
  .menu :global(.tab:focus-visible) {
    outline: 3px solid #ffd79a;
    outline-offset: 3px;
  }
  @keyframes item-in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    pointer-events: auto;
  }
  .confirm {
    position: fixed;
    left: 50%;
    top: 50%;
    width: min(440px, calc(100vw - 32px));
    transform: translate(-50%, -50%);
    padding: 26px 26px 22px;
    pointer-events: auto;
    animation: rise 0.35s var(--ease-out) both;
  }
  .confirm p {
    margin: 0 0 20px;
    font: 600 1.3rem/1.3 var(--serif);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 14px));
    }
  }
  :global(:root[data-motion="reduce"]) li,
  :global(:root[data-motion="reduce"]) .confirm {
    animation: none;
  }
  @media (max-width: 640px) {
    .menu {
      left: 16px;
      right: 16px;
      top: auto;
      bottom: max(16px, env(safe-area-inset-bottom));
      width: auto;
      transform: none;
      gap: 10px;
    }
    .start {
      min-height: 58px;
      font-size: 1.3rem;
    }
    .list {
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      padding: 6px;
      border-radius: 20px;
    }
    .row {
      gap: 10px;
      min-height: 48px;
      padding: 0 12px;
      font-size: 0.98rem;
    }
    .row::after {
      display: none;
    }
  }
</style>
