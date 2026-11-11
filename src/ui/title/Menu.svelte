<script lang="ts">
  import { type PanelId, flow } from "../flow.svelte";
  import { t } from "../settings.svelte";

  /**
   * The main menu is Dad's notebook, peeking in from the edge of the screen.
   * Each choice is a paper index tab sticking out of its pages, with a little
   * doodle in his hand. The first tab is the big one: where the story starts.
   * Arrow keys move between tabs; Enter opens one.
   */
  interface Props {
    hasSave: boolean;
    chapters: boolean;
    onstart: (fresh: boolean) => void;
  }
  let { hasSave, chapters, onstart }: Props = $props();
  let confirming = $state(false);

  type Doodle = "letter" | "book" | "kids" | "pages" | "leaf" | "wrench" | "heart";
  type Item = { id: string; label: string; sub?: string; doodle: Doodle; paper: string; act: () => void; href?: string };

  const items = $derived.by((): Item[] => {
    const list: Item[] = [];
    if (hasSave) list.push({ id: "continue", label: t("menu.continue"), sub: t("menu.continueSub"), doodle: "book", paper: "#f4b04e", act: () => onstart(false) });
    list.push({
      id: "new",
      label: t("menu.new"),
      sub: hasSave ? undefined : t("menu.newSub"),
      doodle: "letter",
      paper: hasSave ? "#f1e2c2" : "#f4b04e",
      act: () => (hasSave ? (confirming = true) : onstart(true)),
    });
    list.push({ id: "together", label: t("menu.together"), doodle: "kids", paper: "#bcd3a6", act: () => open("together") });
    if (chapters) list.push({ id: "chapters", label: t("menu.chapters"), doodle: "pages", paper: "#e8c9a8", act: () => open("chapters") });
    list.push({ id: "guide", label: t("menu.guide"), doodle: "leaf", paper: "#b9d0dc", act: () => undefined, href: "/field-guide/" });
    list.push({ id: "settings", label: t("menu.settings"), doodle: "wrench", paper: "#e6dcc6", act: () => open("settings") });
    list.push({ id: "credits", label: t("menu.credits"), doodle: "heart", paper: "#efbfb1", act: () => open("credits") });
    return list;
  });

  /** Small hand-cut differences, so the tabs never line up like a template. */
  const TILT = [-0.7, 0.5, -0.3, 0.7, -0.5, 0.3, -0.6];
  const REACH = [0, 10, 4, 14, 6, 12, 2];

  const ring = (x: number, y: number, r: number): string => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

  /**
   * Each doodle: a paper-white wash printed a little off the line (like a
   * cheap two-colour print), the ink lines, and a spot of colour.
   */
  const DOODLES: Record<Doodle, { wash: string; ink: string[]; spot?: [string, string][] }> = {
    letter: {
      wash: "M8.5 11.2 L 39.6 10.4 L 40.2 30.8 L 9 31.4 Z",
      ink: ["M8.5 11.2 L 39.6 10.4 L 40.2 30.8 L 9 31.4 Z", "M9 11.8 C 15 17, 19 20.5, 24.2 23 C 29 20.2, 34 16.6, 39.4 11.2", "M9.4 30.6 L 19.6 21.4", "M39.6 30.2 L 29.2 21.2"],
      spot: [[ring(24.2, 23, 3.4), "#c0573e"]],
    },
    book: {
      wash: "M6 11 C 12 9, 18.5 9.4, 24 12.4 C 29.5 9.4, 36 9, 42 11 L 41.6 32 C 36 30.2, 29.5 30.6, 24 33.4 C 18.5 30.6, 12 30.2, 6.4 32 Z",
      ink: [
        "M6 11 C 12 9, 18.5 9.4, 24 12.4 C 29.5 9.4, 36 9, 42 11 L 41.6 32 C 36 30.2, 29.5 30.6, 24 33.4 C 18.5 30.6, 12 30.2, 6.4 32 Z",
        "M24 12.4 L 24 33.2",
        "M10.5 16 C 13.5 15.2, 16.5 15.4, 19.5 16.6",
        "M10.5 20.5 C 13.5 19.7, 16.5 19.9, 19.5 21.1",
        "M10.5 25 C 13 24.4, 15 24.5, 17 25.2",
      ],
      spot: [["M30.6 10.6 L 30.8 22.4 L 33 20.2 L 35.2 22.4 L 35.2 9.8 Z", "#c0573e"]],
    },
    kids: {
      wash: `${ring(15, 10.5, 4.4)} ${ring(33, 10.5, 4.4)}`,
      ink: [
        ring(15, 10.5, 4.2),
        ring(33, 10.5, 4.2),
        "M15 14.8 L 15.4 25",
        "M33 14.8 L 32.6 25",
        "M15.4 25 L 11.6 33.6 M15.4 25 L 19 33.4",
        "M32.6 25 L 29 33.4 M32.6 25 L 36.6 33.6",
        "M15.2 18.4 L 9.2 22.6",
        "M15.2 18.4 C 19.5 22, 28.5 22, 32.8 18.4",
        "M32.8 18.4 L 38.8 22.4",
        "M30.6 6.8 C 31.6 5, 34 5.2, 34.6 6.9",
      ],
      spot: [["M18.2 7.6 L 21.6 5.4 L 21.8 9.8 Z M18.2 7.6 L 15.2 4.6 L 14.8 9 Z", "#c0573e"]],
    },
    pages: {
      wash: "M13 8.5 L 36 8 L 36.4 31 L 13.4 31.4 Z",
      ink: ["M13 8.5 L 36 8 L 36.4 31 L 13.4 31.4 Z", "M9.6 12 L 9.6 34.6 L 32.8 34.4", "M18 14.5 L 31 14.2", "M18 19 L 31 18.8", "M18 23.5 L 27 23.4"],
    },
    leaf: {
      wash: ring(19.6, 17.4, 10),
      ink: [ring(19.6, 17.4, 10), "M26.8 24.8 L 28.8 22.8 L 39.6 33.2 C 40.4 34, 39.2 35.6, 38.2 34.8 Z", "M14.6 21.4 L 21.6 15.4"],
      spot: [["M14.6 21.4 C 14.4 15.6, 18.6 12.4, 24.4 12.6 C 24.6 18.4, 20.6 21.8, 14.6 21.4 Z", "#7fa37a"]],
    },
    wrench: {
      wash: "M31.2 6.8 C 26.6 6.4, 23 10.8, 24.4 15.2 L 9.6 30 C 8.4 31.2, 10.4 33.4, 11.8 32.2 L 26.6 17.4 C 31 18.8, 35.4 15.2, 34.8 10.6 L 31 14 L 27.8 13.2 L 27 10 Z",
      ink: [
        "M31.2 6.8 C 26.6 6.4, 23 10.8, 24.4 15.2 L 9.6 30 C 8.4 31.2, 10.4 33.4, 11.8 32.2 L 26.6 17.4 C 31 18.8, 35.4 15.2, 34.8 10.6 L 31 14 L 27.8 13.2 L 27 10 Z",
        "M38.4 24.4 L 42 26.4 L 42 30.6 L 38.4 32.6 L 34.8 30.6 L 34.8 26.4 Z",
      ],
      spot: [[ring(38.4, 28.5, 1.6), "#2b2622"]],
    },
    heart: {
      wash: "M24 34 C 16 28.4, 9 23, 9.2 16 C 9.4 11.4, 13 8.4, 17 8.6 C 20 8.8, 22.6 10.6, 24 13.4 C 25.4 10.6, 28 8.8, 31 8.6 C 35.2 8.4, 38.8 11.6, 38.8 16 C 38.8 23, 32 28.4, 24 34 Z",
      ink: [
        "M24 34 C 16 28.4, 9 23, 9.2 16 C 9.4 11.4, 13 8.4, 17 8.6 C 20 8.8, 22.6 10.6, 24 13.4 C 25.4 10.6, 28 8.8, 31 8.6 C 35.2 8.4, 38.8 11.6, 38.8 16 C 38.8 23, 32 28.4, 24 34 Z",
        "M41.6 4.6 L 41.8 10 M39 7.4 L 44.4 7.2",
      ],
      spot: [["M14.6 14.4 C 15.4 12.6, 17 11.8, 18.6 12", "#c0573e"]],
    },
  };

  function open(panel: PanelId): void {
    flow.open(panel);
  }

  let nav: HTMLElement | null = $state(null);
  let keep: HTMLButtonElement | null = $state(null);

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

  function onconfirmkey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      confirming = false;
    }
  }

  $effect(() => {
    queueMicrotask(() => nav?.querySelector<HTMLElement>(".tab")?.focus({ preventScroll: true }));
  });

  $effect(() => {
    if (confirming) queueMicrotask(() => keep?.focus({ preventScroll: true }));
  });
</script>

{#snippet doodle(name: Doodle)}
  {@const d = DOODLES[name]}
  <svg class="doodle" viewBox="0 0 48 40" aria-hidden="true">
    <path class="wash" d={d.wash} />
    {#each d.spot ?? [] as [path, colour] (path)}
      <path class="spot" d={path} fill={colour} />
    {/each}
    {#each d.ink as path (path)}
      <path class="ink" d={path} />
    {/each}
  </svg>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav class="menu" aria-label={t("menu.label")} bind:this={nav} onkeydown={onkey}>
  <ul>
    {#each items as item, i (item.id)}
      <li style:--i={i} style:--tilt={`${TILT[i % TILT.length]}deg`} style:--reach={`${REACH[i % REACH.length]}px`}>
        {#if item.href}
          <a class="tab" href={item.href} style:--paper={item.paper}>
            {@render doodle(item.doodle)}
            <span class="words"><span class="label">{item.label}</span></span>
          </a>
        {:else}
          <button type="button" class="tab" class:lead={i === 0} style:--paper={item.paper} onclick={item.act}>
            {@render doodle(item.doodle)}
            <span class="words">
              <span class="label">{item.label}</span>
              {#if item.sub}<span class="sub">{item.sub}</span>{/if}
            </span>
          </button>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="edge" aria-hidden="true">
    <span class="pages"></span>
    <span class="cover"></span>
    <span class="band"></span>
    <span class="ribbon"></span>
  </div>
</nav>

{#if confirming}
  <div class="scrim" aria-hidden="true"></div>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text" tabindex="-1" onkeydown={onconfirmkey}>
    <span class="tape" aria-hidden="true"></span>
    <p id="confirm-text">{t("menu.newConfirm")}</p>
    <div class="actions">
      <button type="button" class="keep" bind:this={keep} onclick={() => (confirming = false)}>{t("menu.newNo")}</button>
      <button type="button" class="stamp" onclick={() => onstart(true)}>{t("menu.newYes")}</button>
    </div>
  </div>
{/if}

<style>
  /* ---------- The notebook at the edge of the screen ---------- */
  .menu {
    --edge: 60px;
    --noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.26 0 0 0 0 0.16 0 0 0 0.16 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    position: fixed;
    right: 0;
    top: 50%;
    width: min(calc(17.5rem + var(--edge)), calc(100vw - 20px));
    transform: translateY(-48%);
    pointer-events: auto;
  }
  ul {
    position: relative;
    z-index: 1;
    list-style: none;
    margin: 0;
    padding: 0 calc(var(--edge) - 6px) 0 0;
    display: grid;
    gap: 7px;
  }
  li {
    padding-left: var(--reach);
    animation: tab-in 0.6s var(--ease-spring) both;
    animation-delay: calc(var(--i) * 70ms + 260ms);
  }

  /* ---------- One paper tab ---------- */
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
    width: calc(100% + 26px);
    min-height: 3.35rem;
    padding: 5px 34px 5px 12px;
    border: 2.4px solid var(--ink);
    border-right: 0;
    border-radius: 20px 0 0 18px / 18px 0 0 22px;
    background-color: var(--paper);
    background-image:
      linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent 38%, transparent 76%, rgba(80, 50, 20, 0.12)),
      var(--noise);
    box-shadow:
      inset 0 -3px 0 rgba(60, 36, 14, 0.12),
      0 3px 0 rgba(30, 18, 26, 0.38),
      0 14px 22px -14px rgba(14, 8, 24, 0.75);
    color: var(--ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transform: translateX(var(--out, 0px)) rotate(var(--tilt));
    transform-origin: right center;
    transition:
      transform 0.32s var(--ease-spring),
      box-shadow 0.2s;
  }
  .tab:hover,
  .tab:focus-visible {
    --out: -16px;
    box-shadow:
      inset 0 -3px 0 rgba(60, 36, 14, 0.12),
      0 4px 0 rgba(30, 18, 26, 0.38),
      0 20px 26px -14px rgba(14, 8, 24, 0.8);
  }
  .tab:active {
    --out: -10px;
    box-shadow:
      inset 0 -2px 0 rgba(60, 36, 14, 0.12),
      0 1px 0 rgba(30, 18, 26, 0.38),
      0 6px 12px -8px rgba(14, 8, 24, 0.7);
  }
  :global(#ui) .menu .tab:focus-visible {
    outline: 3px solid #fbf6ec;
    outline-offset: 3px;
  }
  /* Dad's pencil arrow points at the tab you are on. */
  .tab::before {
    content: "";
    position: absolute;
    right: 100%;
    top: 50%;
    width: 42px;
    height: 26px;
    margin: -13px 8px 0 0;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 28'%3E%3Cpath d='M3 15.5 C 12 12.5, 24 13, 36 14.2 M28.5 6 C 31 9, 34 12, 38.5 14.2 C 34 16.4, 31 19.2, 28.4 23' fill='none' stroke='%23fbf6ec' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    filter: drop-shadow(0 2px 0 rgba(30, 18, 40, 0.6));
    opacity: 0;
    transform: translateX(-10px);
    transition:
      opacity 0.15s,
      transform 0.3s var(--ease-spring);
    pointer-events: none;
  }
  .tab:hover::before,
  .tab:focus-visible::before {
    opacity: 1;
    transform: none;
    animation: point 1.2s 0.3s ease-in-out infinite;
  }
  @keyframes point {
    50% {
      transform: translateX(-5px);
    }
  }

  .doodle {
    flex: none;
    width: 46px;
    height: 38px;
    overflow: visible;
    transition: transform 0.3s var(--ease-spring);
  }
  .tab:hover .doodle,
  .tab:focus-visible .doodle {
    transform: rotate(-6deg) scale(1.06);
  }
  .doodle .wash {
    fill: #fff7e4;
    transform: translate(2px, 2.4px);
  }
  .doodle .spot {
    stroke: var(--ink);
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
  .doodle .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .words {
    display: grid;
    min-width: 0;
  }
  .label {
    font: 700 1.28rem/1.05 var(--hand);
    letter-spacing: 0.005em;
  }
  .sub {
    margin-top: 2px;
    font: 400 0.92rem/1.15 var(--hand);
    color: rgba(43, 38, 34, 0.78);
  }
  :global(:root[data-font="dyslexic"]) .label,
  :global(:root[data-font="dyslexic"]) .sub {
    font-family: var(--read);
    font-size: 1.05rem;
  }

  /* The big tab: where the story starts. */
  .tab.lead {
    min-height: 4.7rem;
    padding-left: 14px;
    border-radius: 24px 0 0 22px / 22px 0 0 26px;
  }
  .tab.lead .doodle {
    width: 56px;
    height: 46px;
  }
  .tab.lead .label {
    font-size: 1.7rem;
  }
  .tab.lead::before {
    width: 52px;
    height: 32px;
    margin-top: -16px;
  }

  /* ---------- The book's edge: pages, the leather cover, the elastic, a ribbon ---------- */
  .edge {
    position: absolute;
    z-index: 2;
    right: 0;
    top: -30px;
    bottom: -30px;
    width: var(--edge);
    pointer-events: none;
    animation: edge-in 0.5s var(--ease-out) both;
  }
  .pages {
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 24px;
    border-radius: 6px 0 0 6px;
    background:
      linear-gradient(90deg, rgba(60, 36, 14, 0.25), transparent 30%),
      repeating-linear-gradient(90deg, #f6ecd8 0 2px, #d6c5a4 2px 3px);
    box-shadow:
      inset 1.5px 0 0 rgba(43, 38, 34, 0.5),
      -4px 0 10px -4px rgba(14, 8, 24, 0.5);
  }
  .cover {
    position: absolute;
    right: 0;
    left: 20px;
    top: 0;
    bottom: 0;
    border-radius: 12px 0 0 12px;
    background:
      radial-gradient(ellipse 120% 40% at 30% 10%, rgba(255, 200, 150, 0.16), transparent 60%),
      linear-gradient(90deg, #4c251c, #6a3527 40%, #57291f);
    box-shadow:
      inset 2px 0 0 rgba(255, 220, 180, 0.14),
      -6px 0 16px -6px rgba(10, 5, 14, 0.7);
  }
  .cover::after {
    content: "";
    position: absolute;
    inset: 7px 0 7px 7px;
    border: 1.6px dashed rgba(240, 200, 150, 0.42);
    border-right: 0;
    border-radius: 8px 0 0 8px;
  }
  /* The elastic that keeps the notebook shut, slipped off and hanging loose. */
  .band {
    position: absolute;
    right: 9px;
    top: -6px;
    bottom: -6px;
    width: 7px;
    border-radius: 4px;
    background: linear-gradient(90deg, #1f1a17, #3a322c 50%, #1f1a17);
    box-shadow: -2px 0 4px rgba(0, 0, 0, 0.35);
  }
  .ribbon {
    position: absolute;
    left: 6px;
    bottom: -40px;
    width: 11px;
    height: 70px;
    background: linear-gradient(90deg, #7e2a20, #a33d2c 45%, #7e2a20);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 9px), 0 100%);
    transform: rotate(5deg);
    transform-origin: top;
  }

  @keyframes edge-in {
    from {
      translate: 100% 0;
    }
  }
  @keyframes tab-in {
    from {
      opacity: 0;
      translate: 70% 0;
    }
  }

  /* ---------- Starting again: a note taped over the page ---------- */
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
    width: min(420px, calc(100vw - 40px));
    box-sizing: border-box;
    padding: 34px 28px 24px 34px;
    transform: translate(-50%, -50%) rotate(-1.6deg);
    background-color: #fbf4e4;
    background-image:
      linear-gradient(90deg, transparent 20px, rgba(196, 80, 60, 0.38) 20px 21.5px, transparent 21.5px),
      repeating-linear-gradient(180deg, transparent 0 29px, rgba(64, 108, 170, 0.17) 29px 30px);
    background-position: 0 0, 0 14px;
    border-radius: 3px;
    box-shadow:
      0 2px 0 #e2d4b8,
      0 30px 50px -20px rgba(10, 6, 20, 0.75);
    pointer-events: auto;
    outline: none;
    animation: note-in 0.4s var(--ease-spring) both;
  }
  .tape {
    position: absolute;
    left: 50%;
    top: -14px;
    width: 120px;
    height: 30px;
    transform: translateX(-50%) rotate(3deg);
    background: rgba(236, 222, 176, 0.72);
    clip-path: polygon(3% 0, 97% 4%, 100% 30%, 96% 60%, 99% 100%, 2% 96%, 0 70%, 3% 40%);
    box-shadow: inset 0 0 0 1px rgba(160, 140, 90, 0.25);
  }
  .confirm p {
    margin: 0 0 22px;
    font: 700 1.35rem/1.35 var(--hand);
    color: var(--ink);
  }
  :global(:root[data-font="dyslexic"]) .confirm p {
    font-family: var(--read);
    font-size: 1.15rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
  }
  .keep,
  .stamp {
    min-height: 48px;
    padding: 0 18px;
    cursor: pointer;
    transition: transform 0.18s var(--ease-spring);
  }
  .keep {
    border: 2.4px solid var(--ink);
    border-radius: 16px 14px 18px 12px;
    background: #fff9ec;
    color: var(--ink);
    font: 700 1.1rem/1 var(--hand);
    box-shadow: 0 3px 0 rgba(43, 38, 34, 0.3);
  }
  .stamp {
    border: 3px solid var(--clay);
    border-radius: 6px;
    background: rgba(192, 87, 62, 0.08);
    color: var(--clay);
    font: 700 1.02rem/1 var(--label);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    transform: rotate(-2deg);
  }
  .keep:hover {
    transform: translateY(-2px);
  }
  .stamp:hover {
    transform: rotate(-2deg) scale(1.04);
  }
  .stamp:active {
    transform: rotate(-3deg) scale(0.96);
    background: rgba(192, 87, 62, 0.18);
  }
  @keyframes note-in {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 30px)) rotate(4deg);
    }
  }

  :global(:root[data-motion="reduce"]) li,
  :global(:root[data-motion="reduce"]) .edge,
  :global(:root[data-motion="reduce"]) .confirm,
  :global(:root[data-motion="reduce"]) .tab::before {
    animation: none;
  }
  :global(:root[data-motion="reduce"]) .tab {
    transition: none;
  }

  /* Short screens: slimmer tabs. */
  @media (max-height: 640px) {
    ul {
      gap: 4px;
    }
    .tab {
      min-height: 2.8rem;
    }
    .tab.lead {
      min-height: 3.8rem;
    }
    .tab.lead .label {
      font-size: 1.45rem;
    }
  }

  /* Phones: the notebook peeks in at the bottom right, under the planet. */
  @media (max-width: 640px) {
    .menu {
      --edge: 46px;
      top: auto;
      bottom: max(30px, calc(env(safe-area-inset-bottom) + 16px));
      width: min(calc(15rem + var(--edge)), calc(100vw - 56px));
      transform: none;
    }
    ul {
      gap: 5px;
    }
    .tab {
      min-height: 2.95rem;
      gap: 8px;
      padding-left: 10px;
    }
    .doodle {
      width: 38px;
      height: 32px;
    }
    .label {
      font-size: 1.12rem;
    }
    .tab.lead {
      min-height: 4rem;
    }
    .tab.lead .doodle {
      width: 46px;
      height: 38px;
    }
    .tab.lead .label {
      font-size: 1.45rem;
    }
    .cover {
      left: 16px;
    }
    .pages {
      width: 20px;
    }
    .band {
      right: 7px;
      width: 6px;
    }
    .edge {
      top: -22px;
      bottom: -22px;
    }
    .ribbon {
      display: none;
    }
  }
</style>
