<script lang="ts">
  import { CHAPTERS, bonusOpen } from "../../content/chapters";
  import { FINALE_TITLE, finaleOpen } from "../../content/finale";
  import { PROLOGUE } from "../../content/goals";
  import type { GameState } from "../../game/core/state";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /**
   * Chapter select: every chapter with where it stands. A world opens once
   * the prologue is stamped (or Explore freely is on); the bonus world once
   * Chapter 3 is stamped; the Finale once every main chapter is stamped.
   * "Go" takes you there through the Looking Lamp.
   */
  interface Props {
    game: Readonly<GameState>;
    onclose: () => void;
    onhome: () => void;
    ongo: (world: string) => void;
  }
  let { game, onclose, onhome, ongo }: Props = $props();

  interface Row {
    id: string;
    tag: string;
    name: string;
    open: boolean;
    done: boolean;
    go: () => void;
  }

  const opened = $derived(game.stamps.includes("prologue") || game.flags.includes("explore-freely"));
  const rows = $derived<Row[]>([
    { id: "prologue", tag: t("chapters.home"), name: PROLOGUE.chapter, open: true, done: game.stamps.includes("prologue"), go: onhome },
    ...CHAPTERS.map((c) => ({
      id: c.id,
      tag: c.bonus ? "Bonus" : c.world === "meridiani" || c.world === "valinor" ? "Mars" : "Moon",
      name: c.title,
      open: opened && (!c.bonus || bonusOpen(game) || game.flags.includes("explore-freely")),
      done: game.stamps.includes(c.id),
      go: () => ongo(c.world),
    })),
    { id: "finale", tag: t("chapters.home"), name: FINALE_TITLE, open: finaleOpen(game), done: game.stamps.includes("finale"), go: onhome },
  ]);
</script>

<Panel title={t("chapters.title")} lede={t("chapters.lede")} icon="book" {onclose}>
  <ol class="chapters">
    {#each rows as row (row.id)}
      <li class:soon={!row.open}>
        <span class="tag">{row.tag}</span>
        <span class="name">{row.name}{#if row.done}<span class="stamped">Stamped</span>{/if}</span>
        {#if row.open}
          <button type="button" class="btn amber" onclick={row.go}>{t("chapters.go")}</button>
        {:else}
          <span class="later"><Icon name="lock" size={16} /> Not yet</span>
        {/if}
      </li>
    {/each}
  </ol>
</Panel>

<style>
  .chapters {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  li {
    display: grid;
    grid-template-columns: 6.5em 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 10px 8px 16px;
    border-radius: 4px;
    background: #fffdf6;
    border: 1.5px solid rgba(43, 38, 34, 0.18);
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.1);
  }
  li.soon {
    background: transparent;
  }
  .tag {
    justify-self: start;
  }
  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    font: 700 1.2rem/1.2 var(--hand);
  }
  .stamped {
    padding: 2px 8px;
    border: 1.5px solid #b8433a;
    border-radius: 3px;
    color: #b8433a;
    font: 700 0.7rem/1.2 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-3deg);
  }
  .soon .name {
    color: var(--ink-soft);
  }
  .later {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding-right: 8px;
    color: var(--pencil);
    font-size: 0.88rem;
    font-weight: 600;
  }
  .later :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  @media (max-width: 520px) {
    li {
      grid-template-columns: 1fr auto;
    }
    .tag {
      display: none;
    }
  }
</style>
