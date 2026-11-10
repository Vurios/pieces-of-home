<script lang="ts">
  import { SPREADS } from "../../content/notebook";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /** Chapter select. Only Home is built so far; the rest arrive in later phases. */
  interface Props {
    onclose: () => void;
    onhome: () => void;
  }
  let { onclose, onhome }: Props = $props();
</script>

<Panel title={t("chapters.title")} {onclose}>
  <ol class="chapters">
    {#each SPREADS as s (s.id)}
      <li>
        {#if s.world === "Home"}
          <button type="button" class="btn" onclick={onhome}>{s.chapter}</button>
        {:else}
          <span class="soon"><span>{s.chapter}</span> <span class="tag">{t("chapters.soon")}</span></span>
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
    gap: 12px;
  }
  .soon {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    font: 700 1.05rem var(--hand);
    color: var(--ink-soft);
  }
</style>
