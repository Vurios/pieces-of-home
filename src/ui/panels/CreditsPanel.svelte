<script lang="ts">
  import credits from "../../data/credits.json";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /** Every picture, font and library, with its maker, license and a link to the source. */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  const host = (url: string): string => new URL(url).hostname.replace(/^www\./, "");
</script>

<Panel title={t("credits.title")} lede={t("credits.lede")} icon="star" size="lg" {onclose}>
  <p class="note">
    <span>{t("credits.note")}</span>
    <a href="/about/">{t("menu.about")}</a>
  </p>

  <section aria-labelledby="cr-pics">
    <h3 id="cr-pics" class="eyebrow">{t("credits.images")}</h3>
    <ul class="grid">
      {#each credits.media as m (m.id)}
        <li>
          <span class="what">{m.title}</span>
          <span class="who">{m.credit}</span>
          <span class="meta">
            <span class="license">{m.license.split(" (")[0]}</span>
            <a href={m.page} target="_blank" rel="noopener noreferrer">{host(m.page)} <Icon name="external" size={13} /></a>
          </span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="cr-fonts">
    <h3 id="cr-fonts" class="eyebrow">{t("credits.fonts")}</h3>
    <ul class="grid">
      {#each credits.fonts as f (f.name)}
        <li>
          <span class="what">{f.name}</span>
          <span class="who">{f.by}</span>
          <span class="meta">
            <span class="license">{f.license}</span>
            <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{host(f.sourceUrl)} <Icon name="external" size={13} /></a>
          </span>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="cr-code">
    <h3 id="cr-code" class="eyebrow">{t("credits.code")}</h3>
    <ul class="grid">
      {#each credits.libraries as l (l.name)}
        <li>
          <span class="what">{l.name}</span>
          <span class="who">{l.use}</span>
          <span class="meta">
            <span class="license">{l.license}</span>
            <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">{host(l.sourceUrl)} <Icon name="external" size={13} /></a>
          </span>
        </li>
      {/each}
    </ul>
  </section>
</Panel>

<style>
  .note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin: 0 0 8px;
    padding: 14px 18px;
    border-radius: var(--radius-sm);
    background: var(--amber-wash);
    font-weight: 600;
    line-height: 1.4;
  }
  .note a {
    color: var(--amber-deep);
    font-weight: 700;
  }
  section {
    margin-top: 22px;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 10px;
  }
  .grid li {
    display: grid;
    gap: 4px;
    align-content: start;
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    background: #fff;
    border: 1px solid var(--line);
  }
  .what {
    font-weight: 700;
    line-height: 1.3;
  }
  .who {
    color: var(--ink-soft);
    font-size: 0.92rem;
    line-height: 1.4;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
    margin-top: 6px;
    font-size: 0.82rem;
  }
  .license {
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--card-sunk);
    color: var(--ink-soft);
    font-weight: 600;
  }
  .meta a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    color: var(--ink);
    font-weight: 700;
    text-decoration-color: var(--amber);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  .meta a :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
</style>
