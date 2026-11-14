<script lang="ts">
  import credits from "../../data/credits.json";
  import { ABOUT } from "../../content/guide";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /**
   * Every picture, font and library, with its maker, license and a link to the
   * source; and, on its own tab, the About page: how to play, why it is safe to
   * play together, a note for grown-ups and where the facts come from.
   */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();
  let tab = $state<"credits" | "about">("credits");

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
  <p class="note">{t("credits.note")}</p>

  <div class="tabs" role="tablist" aria-label={t("credits.title")}>
    <button type="button" role="tab" id="cr-tab-credits" aria-controls="cr-credits" aria-selected={tab === "credits"} class:on={tab === "credits"} onclick={() => (tab = "credits")}>{t("credits.title")}</button>
    <button type="button" role="tab" id="cr-tab-about" aria-controls="cr-about" aria-selected={tab === "about"} class:on={tab === "about"} onclick={() => (tab = "about")}>{t("menu.about")}</button>
  </div>

  {#if tab === "about"}
  <div id="cr-about" role="tabpanel" aria-labelledby="cr-tab-about" class="about">
    <p class="about-lede">{ABOUT.lede}</p>
    <div class="about-grid">
      <section class="about-card" aria-labelledby="ab-play">
        <h3 id="ab-play">{ABOUT.playTitle}</h3>
        <ul>{#each ABOUT.play as line, i (i)}<li>{line}</li>{/each}</ul>
      </section>
      <section class="about-card sage" aria-labelledby="ab-safe">
        <h3 id="ab-safe">{ABOUT.safeTitle}</h3>
        <p>{ABOUT.safe}</p>
      </section>
      <section class="about-card wide warm" aria-labelledby="ab-grown">
        <h3 id="ab-grown">{ABOUT.grownTitle}</h3>
        {#each ABOUT.grown as line, i (i)}<p>{line}</p>{/each}
      </section>
      <section class="about-card" aria-labelledby="ab-facts">
        <h3 id="ab-facts">{ABOUT.factsTitle}</h3>
        <p>{ABOUT.facts}</p>
      </section>
      <section class="about-card" aria-labelledby="ab-made">
        <h3 id="ab-made">{ABOUT.madeTitle}</h3>
        <p>{ABOUT.made}</p>
      </section>
    </div>
  </div>
  {:else}
  <div id="cr-credits" role="tabpanel" aria-labelledby="cr-tab-credits">
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
  </div>
  {/if}
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
  /* Two paper tabs: the credits, and the About page. */
  .tabs {
    display: flex;
    gap: 10px;
    margin: 18px 0 0;
    border-bottom: 2px solid var(--ink);
    padding-left: 6px;
  }
  .tabs button {
    min-height: 44px;
    margin-bottom: -2px;
    padding: 6px 18px 4px;
    border: 2px solid var(--line-strong);
    border-bottom: 0;
    border-radius: 12px 14px 0 0;
    background: #efe6d4;
    color: var(--ink-soft);
    font: 700 1.15rem var(--hand);
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring), background 0.15s;
  }
  .tabs button:hover {
    transform: translateY(-2px);
  }
  .tabs button.on {
    background: #fffdf6;
    border-color: var(--ink);
    color: var(--ink);
    box-shadow: inset 0 4px 0 var(--amber);
  }
  .about-lede {
    margin: 20px 0 0;
    font: 400 1.25rem/1.45 var(--hand);
    max-width: 60ch;
  }
  .about-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 16px;
  }
  .about-card {
    margin: 0;
    padding: 14px 18px 8px;
    background: #fffdf6;
    border: 2px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.1);
  }
  .about-card.wide {
    grid-column: 1 / -1;
  }
  .about-card.sage {
    border-color: rgba(85, 115, 88, 0.55);
    background: #f3f6ee;
  }
  .about-card.warm {
    border-color: rgba(184, 102, 28, 0.45);
    background: #fdf3e2;
  }
  .about-card h3 {
    margin: 0 0 8px;
    font: 700 1.25rem var(--hand);
  }
  .about-card p,
  .about-card li {
    margin: 0 0 8px;
    line-height: 1.5;
  }
  .about-card ul {
    margin: 0;
    padding-left: 20px;
  }
  @media (max-width: 720px) {
    .about-grid {
      grid-template-columns: 1fr;
    }
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
