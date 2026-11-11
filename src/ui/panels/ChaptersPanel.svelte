<script lang="ts">
  import { SPREADS } from "../../content/notebook";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /** Chapter select. Only Home is built so far; the rest arrive in later phases. */
  interface Props {
    onclose: () => void;
    onhome: () => void;
  }
  let { onclose, onhome }: Props = $props();
</script>

<Panel title={t("chapters.title")} lede={t("chapters.lede")} icon="book" {onclose}>
  <ol class="chapters">
    {#each SPREADS as s (s.id)}
      <li class:soon={s.world !== "Home"}>
        <span class="tag">{s.world}</span>
        <span class="name">{s.chapter}</span>
        {#if s.world === "Home"}
          <button type="button" class="btn amber" onclick={onhome}>{t("chapters.go")}</button>
        {:else}
          <span class="later"><Icon name="lock" size={16} /> {t("chapters.soon")}</span>
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
    font: 700 1.2rem/1.2 var(--hand);
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
      grid-column: 1 / -1;
    }
  }
</style>
