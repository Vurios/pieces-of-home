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
  type Media = (typeof credits.media)[number];
  /** "Impact Sounds" from a Kenney page, "Concert Harp" from a sample library folder. */
  const packName = (page: string): string => {
    const parts = decodeURIComponent(new URL(page).pathname).split("/").filter((p) => p && p !== "Sustains" && p !== "Sus");
    const last = parts[parts.length - 1] ?? "";
    return last.includes("-") ? last.split("-").map((w) => (w === "rpg" ? "RPG" : w[0]!.toUpperCase() + w.slice(1))).join(" ") : last;
  };
  const isAudio = (m: Media): boolean => m.file.startsWith("audio/");
  const pictures = credits.media.filter((m) => !isAudio(m));
  // NASA recordings are listed one by one; sound packs as one line each, with how many sounds came from them.
  const recordings = credits.media.filter((m) => m.file.startsWith("audio/nasa/"));
  const packs = Object.values(
    credits.media
      .filter((m) => isAudio(m) && !m.file.startsWith("audio/nasa/"))
      .reduce<Record<string, { key: string; name: string; credit: string; license: string; page: string; count: number }>>((all, m) => {
        const key = `${m.credit}|${m.page}`;
        all[key] ??= { key, name: packName(m.page), credit: m.credit, license: m.license, page: m.page, count: 0 };
        all[key].count += 1;
        return all;
      }, {}),
  );
</script>

<Panel title={t("credits.title")} lede={t("credits.lede")} icon="star" size="lg" {onclose}>
  <p class="note">
    <span>{t("credits.note")}</span>
    <a href="/about/">{t("menu.about")}</a>
  </p>

  <section aria-labelledby="cr-pics">
    <h3 id="cr-pics" class="eyebrow">{t("credits.images")}</h3>
    <ul class="grid">
      {#each pictures as m (m.id)}
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

  <section aria-labelledby="cr-sounds">
    <h3 id="cr-sounds" class="eyebrow">Sounds and recordings</h3>
    <ul class="grid">
      {#each recordings as m (m.id)}
        <li>
          <span class="what">{m.title}</span>
          <span class="who">{m.credit}</span>
          <span class="meta">
            <span class="license">{m.license.split(" (")[0]}</span>
            <a href={m.page} target="_blank" rel="noopener noreferrer">{host(m.page)} <Icon name="external" size={13} /></a>
          </span>
        </li>
      {/each}
      {#each packs as p (p.key)}
        <li>
          <span class="what">{p.name} ({p.count} {p.count === 1 ? "sound" : "sounds"})</span>
          <span class="who">{p.credit}</span>
          <span class="meta">
            <span class="license">{p.license.split(" (")[0]}</span>
            <a href={p.page} target="_blank" rel="noopener noreferrer">{host(p.page)} <Icon name="external" size={13} /></a>
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

  <section aria-labelledby="cr-data">
    <h3 id="cr-data" class="eyebrow">{t("credits.data")}</h3>
    <ul class="grid">
      {#each credits.data as d (d.name)}
        <li>
          <span class="what">{d.name}</span>
          <span class="who">{d.by}. {d.use}</span>
          <span class="meta">
            <span class="license">{d.license}</span>
            <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">{host(d.sourceUrl)} <Icon name="external" size={13} /></a>
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
  /* A yellow sticky note with the one thing every grown-up should know. */
  .note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin: 4px 0 8px;
    padding: 14px 18px;
    background: #fbe7a4;
    background-image: var(--grain);
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.12), 0 10px 18px -12px rgba(43, 38, 34, 0.5);
    transform: rotate(-0.6deg);
    font-weight: 700;
    line-height: 1.4;
  }
  .note a {
    color: var(--clay-deep);
    font: 700 1.05rem var(--hand);
    text-decoration: underline 2px wavy;
    text-underline-offset: 5px;
  }
  section {
    margin-top: 24px;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 14px;
  }
  /* Each credit is an index card: a red rule, blue lines, a little tilt. */
  .grid li {
    display: grid;
    gap: 4px;
    align-content: start;
    padding: 14px 16px 12px;
    background-color: #fffdf6;
    background-image:
      linear-gradient(90deg, rgba(196, 80, 60, 0.4), rgba(196, 80, 60, 0.4)),
      repeating-linear-gradient(180deg, transparent 0 25px, rgba(64, 108, 170, 0.09) 25px 26px);
    background-size: 100% 4px, 100% 100%;
    background-position: 0 0, 0 13px;
    background-repeat: no-repeat, repeat;
    border: 1.5px solid rgba(43, 38, 34, 0.18);
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.1);
  }
  .grid li:nth-child(3n + 1) {
    transform: rotate(-0.5deg);
  }
  .grid li:nth-child(3n + 2) {
    transform: rotate(0.4deg);
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
    margin-top: 8px;
    font-size: 0.82rem;
  }
  /* The licence, inked on like a little stamp. */
  .license {
    padding: 4px 8px 3px;
    border: 2px solid var(--sage-deep);
    border-radius: 4px;
    color: var(--sage-deep);
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transform: rotate(-2deg);
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
