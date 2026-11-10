<script lang="ts">
  import credits from "../../data/credits.json";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();
</script>

<Panel title={t("credits.title")} {onclose} wide>
  <p class="note">{t("credits.note")} <a href="/about/">{t("menu.about")}</a></p>
  <h3>{t("credits.images")}</h3>
  <ul class="list">
    {#each credits.media as m (m.id)}
      <li>
        <span class="what">{m.title}</span>
        <span class="who">{m.credit}. {m.license}.</span>
        <a href={m.page} target="_blank" rel="noopener noreferrer">{new URL(m.page).hostname}</a>
      </li>
    {/each}
  </ul>
  <h3>{t("credits.fonts")}</h3>
  <ul class="list">
    {#each credits.fonts as f (f.name)}
      <li>
        <span class="what">{f.name}</span>
        <span class="who">{f.by}. {f.license}.</span>
        <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(f.sourceUrl).hostname}</a>
      </li>
    {/each}
  </ul>
  <h3>{t("credits.code")}</h3>
  <ul class="list">
    {#each credits.libraries as l (l.name)}
      <li>
        <span class="what">{l.name}</span>
        <span class="who">{l.use}. {l.license}.</span>
        <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(l.sourceUrl).hostname}</a>
      </li>
    {/each}
  </ul>
</Panel>

<style>
  .note {
    font: 700 1.05rem/1.4 var(--hand);
    background: rgba(242, 165, 65, 0.2);
    padding: 10px 14px;
    border-left: 4px solid var(--amber);
  }
  h3 {
    margin: 20px 0 8px;
    font: 700 1.25rem var(--hand);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  .list li {
    display: grid;
    gap: 2px;
    padding-bottom: 10px;
    border-bottom: 1px dashed rgba(43, 38, 34, 0.2);
  }
  .what {
    font-weight: 700;
  }
  .who {
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  a {
    color: var(--ink);
    text-decoration-color: var(--amber);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    font-size: 0.92rem;
    width: max-content;
    padding: 6px 0;
  }
</style>
