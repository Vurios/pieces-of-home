<script lang="ts">
  import { untrack } from "svelte";
  import { BUSES, type Bus } from "../../audio/audio";
  import type { StringKey } from "../../content/strings";
  import type { QualityTier } from "../../game/core/events";
  import { type Action, DEFAULT_BINDINGS } from "../../game/core/input";
  import type { Engine } from "../../game/engine";
  import Icon, { type IconName } from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { type Settings, settings, t } from "../settings.svelte";

  /**
   * Settings as a small two-pane card: sections down the side (chips across
   * the top on a phone), one section shown at a time so nothing needs a long
   * scroll. Every control is a real input, so keys, switches and screen
   * readers all work.
   */
  interface Props {
    engine: Engine;
    onclose: () => void;
  }
  let { engine, onclose }: Props = $props();

  type Section = "sound" | "reading" | "motion" | "controls" | "graphics" | "story";
  const SECTIONS: { id: Section; icon: IconName; label: StringKey }[] = [
    { id: "sound", icon: "speaker", label: "settings.sound" },
    { id: "reading", icon: "type", label: "settings.reading" },
    { id: "motion", icon: "motion", label: "settings.motion" },
    { id: "controls", icon: "keys", label: "settings.controls" },
    { id: "graphics", icon: "picture", label: "settings.graphics" },
    { id: "story", icon: "book", label: "settings.story" },
  ];
  let current = $state<Section>("sound");

  const s = $derived(settings.value);
  let quality = $state<"auto" | QualityTier>(untrack(() => (engine.autoQuality ? "auto" : engine.quality.tier)));
  let bindings = $state(untrack(() => ({ ...engine.input.bindings })));
  let listening = $state<Action | null>(null);
  const ACTIONS: Action[] = ["forward", "back", "left", "right", "jump", "interact", "run"];

  function setVolume(bus: Bus, value: number): void {
    settings.update((d) => {
      d.volume[bus] = value;
    });
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    settings.update((d) => {
      d[key] = value;
    });
  }

  let tipsReset = $state(false);
  function showTipsAgain(): void {
    settings.update((d) => {
      d.tips = true;
      d.tipsDone = [];
    });
    tipsReset = true;
  }

  function setQuality(value: "auto" | QualityTier): void {
    quality = value;
    engine.setQuality(value === "auto" ? null : value);
  }

  function keyLabel(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Arrow")) return code.slice(5);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
    return code;
  }

  function onkey(event: KeyboardEvent): void {
    if (!listening) return;
    if (event.key === "Escape") {
      listening = null;
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // Keep the arrow keys as a second choice for walking.
    const keep = engine.input.bindings[listening].filter((c) => c.startsWith("Arrow"));
    engine.input.rebind(listening, [event.code, ...keep.filter((c) => c !== event.code)]);
    bindings = { ...engine.input.bindings };
    listening = null;
  }

  function resetKeys(): void {
    for (const action of ACTIONS) engine.input.rebind(action, [...DEFAULT_BINDINGS[action]]);
    bindings = { ...engine.input.bindings };
  }

  /** Arrow keys move between section tabs, as tab lists should. */
  function tabKey(event: KeyboardEvent, index: number): void {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = SECTIONS[(index + step + SECTIONS.length) % SECTIONS.length]!;
    current = next.id;
    document.getElementById(`set-tab-${next.id}`)?.focus();
  }

  const busKey = (bus: Bus): StringKey => `settings.${bus}` as StringKey;
</script>

<svelte:window onkeydowncapture={onkey} />

<Panel title={t("settings.title")} lede={t("settings.lede")} icon="gear" size="lg" {onclose} flush>
  <div class="layout">
    <div class="tabs" role="tablist" aria-label={t("settings.sections")} aria-orientation="vertical">
      {#each SECTIONS as sec, i (sec.id)}
        <button
          type="button"
          role="tab"
          id={`set-tab-${sec.id}`}
          aria-selected={current === sec.id}
          aria-controls={`set-pane-${sec.id}`}
          tabindex={current === sec.id ? 0 : -1}
          class:on={current === sec.id}
          onclick={() => (current = sec.id)}
          onkeydown={(e) => tabKey(e, i)}
        >
          <Icon name={sec.icon} size={22} />
          <span>{t(sec.label)}</span>
        </button>
      {/each}
    </div>

    <div class="pane" role="tabpanel" id={`set-pane-${current}`} aria-labelledby={`set-tab-${current}`} tabindex="0">
      {#if current === "sound"}
        <h3>{t("settings.sound")}</h3>
        <div class="sliders">
          {#each BUSES as bus (bus)}
            <label class="slider">
              <span class="name">{t(busKey(bus))}</span>
              <input class="range" type="range" min="0" max="1" step="0.05" value={s.volume[bus]} style:--v={s.volume[bus]} oninput={(e) => setVolume(bus, Number(e.currentTarget.value))} />
              <output>{Math.round(s.volume[bus] * 100)}</output>
            </label>
          {/each}
        </div>
      {:else if current === "reading"}
        <h3>{t("settings.reading")}</h3>
        <label class="switch-row">
          <span class="text">{t("settings.subtitles")}<span class="help">{t("settings.subtitlesHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.subtitles} onchange={(e) => set("subtitles", e.currentTarget.checked)} />
        </label>
        <label class="switch-row">
          <span class="text">{t("settings.bubbles")}<span class="help">{t("settings.bubblesHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.bubbles} onchange={(e) => set("bubbles", e.currentTarget.checked)} />
        </label>
        <label class="switch-row">
          <span class="text">{t("settings.readAloud")}<span class="help">{t("settings.readAloudHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.readAloud} onchange={(e) => set("readAloud", e.currentTarget.checked)} />
        </label>
        <label class="switch-row">
          <span class="text">{t("settings.contrast")}<span class="help">{t("settings.contrastHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.highContrast} onchange={(e) => set("highContrast", e.currentTarget.checked)} />
        </label>
        <fieldset>
          <legend class="eyebrow">{t("settings.textSize")}</legend>
          <div class="seg">
            {#each ["s", "m", "l", "xl"] as const as size (size)}
              <label><input type="radio" name="text-size" checked={s.textSize === size} onchange={() => set("textSize", size)} /><span>{t(`settings.size.${size}`)}</span></label>
            {/each}
          </div>
        </fieldset>
        <fieldset>
          <legend class="eyebrow">{t("settings.font")}</legend>
          <div class="seg">
            {#each ["standard", "dyslexic"] as const as font (font)}
              <label class:dys={font === "dyslexic"}><input type="radio" name="font" checked={s.readingFont === font} onchange={() => set("readingFont", font)} /><span>{t(`settings.font.${font}`)}</span></label>
            {/each}
          </div>
        </fieldset>
        <p class="preview" aria-hidden="true">{t("settings.preview")}</p>
      {:else if current === "motion"}
        <h3>{t("settings.motion")}</h3>
        <p class="help">{t("settings.motionHelp")}</p>
        <div class="seg">
          {#each ["system", "reduce", "full"] as const as m (m)}
            <label><input type="radio" name="motion" checked={s.motion === m} onchange={() => set("motion", m)} /><span>{t(`settings.motion.${m}`)}</span></label>
          {/each}
        </div>
      {:else if current === "controls"}
        <h3>{t("settings.controls")}</h3>
        <p class="help">{t("settings.controlsHelp")}</p>
        <ul class="keys">
          {#each ACTIONS as action (action)}
            <li>
              <span>{t(`settings.action.${action}`)}</span>
              <button
                type="button"
                class="key"
                class:listening={listening === action}
                onclick={() => (listening = action)}
                aria-label={`${t(`settings.action.${action}`)}: ${bindings[action].map(keyLabel).join(", ")}`}
              >
                {#if listening === action}
                  {t("settings.press")}
                {:else}
                  {#each bindings[action] as code, i (code)}{#if i > 0}<span class="or">/</span>{/if}<kbd class="keycap">{keyLabel(code)}</kbd>{/each}
                {/if}
              </button>
            </li>
          {/each}
        </ul>
        <button type="button" class="btn quiet" onclick={resetKeys}>{t("settings.reset")}</button>
      {:else if current === "graphics"}
        <h3>{t("settings.graphics")}</h3>
        <p class="help">{t("settings.qualityHelp")}</p>
        <fieldset>
          <legend class="eyebrow">{t("settings.quality")}</legend>
          <div class="seg">
            {#each ["auto", "low", "medium", "high"] as const as q (q)}
              <label><input type="radio" name="quality" checked={quality === q} onchange={() => setQuality(q)} /><span>{t(`settings.quality.${q}`)}</span></label>
            {/each}
          </div>
        </fieldset>
      {:else}
        <h3>{t("settings.story")}</h3>
        <label class="switch-row">
          <span class="text">{t("settings.tips")}<span class="help">{t("settings.tipsHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.tips} onchange={(e) => set("tips", e.currentTarget.checked)} />
        </label>
        <div class="again">
          <button type="button" class="btn" onclick={showTipsAgain}>{t("settings.tipsAgain")}</button>
          {#if tipsReset}<span class="help" role="status">{t("settings.tipsReset")}</span>{/if}
        </div>
        <label class="switch-row">
          <span class="text">{t("settings.explore")}<span class="help">{t("settings.exploreHelp")}</span></span>
          <input class="switch" type="checkbox" role="switch" checked={s.exploreFreely} onchange={(e) => set("exploreFreely", e.currentTarget.checked)} />
        </label>
        <label class="field">
          <span class="eyebrow">{t("settings.language")}</span>
          <select class="select" value={s.language} onchange={(e) => set("language", e.currentTarget.value as Settings["language"])}>
            <option value="en">{t("settings.lang.en")}</option>
            <option value="fil">{t("settings.lang.fil")}</option>
          </select>
          <span class="help">{t("settings.languageHelp")}</span>
        </label>
      {/if}
    </div>
  </div>
</Panel>

<style>
  /* A fixed height so the card does not jump when a tab is shorter or taller. */
  .layout {
    flex: none;
    min-height: 0;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    height: min(540px, calc(100dvh - 190px));
  }
  .tabs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px 12px;
    background: var(--card-sunk);
    border-right: 1px solid var(--line);
    overflow-y: auto;
  }
  .tabs button {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--ink-soft);
    font: 600 1rem var(--read);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tabs button :global(.icon) {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tabs button:hover {
    background: rgba(43, 38, 34, 0.05);
    color: var(--ink);
  }
  .tabs button.on {
    background: #fff;
    color: var(--ink);
    box-shadow: 0 1px 0 rgba(43, 38, 34, 0.08), 0 4px 12px -6px rgba(43, 38, 34, 0.3);
  }
  .tabs button.on :global(.icon) {
    stroke: var(--amber-deep);
  }
  .again {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 4px 0 16px;
    border-bottom: 1px solid var(--line);
  }
  .again .help {
    color: var(--ink-soft);
    font-size: 0.88rem;
  }
  .pane {
    min-height: 0;
    overflow-y: auto;
    padding: 22px 32px 40px;
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 30px), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 30px), transparent);
    scrollbar-width: thin;
    animation: show 0.25s var(--ease-out);
  }
  .pane:focus-visible {
    outline-offset: -4px;
  }
  h3 {
    margin: 0 0 14px;
    font: 600 1.3rem/1.2 var(--serif);
  }
  .help {
    margin: 0 0 16px;
    color: var(--ink-soft);
    font-size: 0.92rem;
    line-height: 1.45;
  }
  fieldset {
    border: 0;
    margin: 20px 0 0;
    padding: 0;
  }
  .sliders {
    display: grid;
    gap: 6px;
  }
  .slider {
    display: grid;
    grid-template-columns: 9em 1fr 2.6em;
    align-items: center;
    gap: 16px;
    min-height: 52px;
  }
  .slider .name {
    font-weight: 600;
  }
  .slider output {
    font: 700 0.95rem var(--read);
    color: var(--ink-soft);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .dys span {
    font-family: "OpenDyslexic", var(--read);
  }
  .preview {
    margin: 22px 0 0;
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    background: var(--card-sunk);
    color: var(--ink);
    line-height: 1.5;
  }
  .keys {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
  }
  .keys li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 54px;
    border-bottom: 1px solid var(--line);
    font-weight: 600;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    min-width: 7em;
    justify-content: flex-end;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--ink);
    font: 600 0.92rem var(--read);
    cursor: pointer;
  }
  .key:hover {
    border-color: var(--line-strong);
    background: #fff;
  }
  .key.listening {
    border-color: var(--amber);
    background: var(--amber-wash);
  }
  .or {
    color: var(--pencil);
  }
  .field {
    display: grid;
    gap: 8px;
    margin-top: 22px;
    max-width: 22rem;
  }
  .field .eyebrow {
    margin: 0;
  }
  @keyframes show {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  :global(:root[data-motion="reduce"]) .pane {
    animation: none;
  }
  @media (max-width: 720px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      height: min(600px, calc(100dvh - 150px));
    }
    .tabs {
      flex-direction: row;
      overflow-x: auto;
      padding: 10px 12px;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
    .tabs button {
      flex: none;
      min-height: 44px;
    }
    .pane {
      padding: 18px 18px 24px;
    }
    .slider {
      grid-template-columns: 1fr 2.6em;
      grid-template-areas: "name out" "range range";
      gap: 2px 12px;
    }
    .slider .name { grid-area: name; }
    .slider output { grid-area: out; }
    .slider :global(.range) { grid-area: range; }
  }
</style>
