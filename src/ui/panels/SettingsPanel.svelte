<script lang="ts">
  import { BUSES, type Bus } from "../../audio/audio";
  import type { StringKey } from "../../content/strings";
  import type { QualityTier } from "../../game/core/events";
  import { type Action, DEFAULT_BINDINGS } from "../../game/core/input";
  import type { Engine } from "../../game/engine";
  import { untrack } from "svelte";
  import Panel from "../Panel.svelte";
  import { type Settings, settings, t } from "../settings.svelte";

  interface Props {
    engine: Engine;
    onclose: () => void;
  }
  let { engine, onclose }: Props = $props();

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

  function setQuality(value: "auto" | QualityTier): void {
    quality = value;
    engine.setQuality(value === "auto" ? null : value);
  }

  function keyLabel(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Arrow")) return code.slice(5);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
    if (code === "Space") return "Space";
    return code;
  }

  function listen(action: Action): void {
    listening = action;
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

  const busKey = (bus: Bus): StringKey => `settings.${bus}` as StringKey;
</script>

<svelte:window onkeydowncapture={onkey} />

<Panel title={t("settings.title")} {onclose}>
  <section aria-labelledby="set-sound">
    <h3 id="set-sound">{t("settings.sound")}</h3>
    {#each BUSES as bus (bus)}
      <label class="slider">
        <span>{t(busKey(bus))}</span>
        <input type="range" min="0" max="1" step="0.05" value={s.volume[bus]} oninput={(e) => setVolume(bus, Number(e.currentTarget.value))} />
        <output>{Math.round(s.volume[bus] * 100)}</output>
      </label>
    {/each}
  </section>

  <section aria-labelledby="set-reading">
    <h3 id="set-reading">{t("settings.reading")}</h3>
    <label class="check"><input type="checkbox" checked={s.subtitles} onchange={(e) => set("subtitles", e.currentTarget.checked)} /><span>{t("settings.subtitles")}</span></label>
    <label class="check"><input type="checkbox" checked={s.bubbles} onchange={(e) => set("bubbles", e.currentTarget.checked)} /><span>{t("settings.bubbles")}</span></label>
    <label class="check"><input type="checkbox" checked={s.readAloud} onchange={(e) => set("readAloud", e.currentTarget.checked)} /><span>{t("settings.readAloud")}</span></label>
    <label class="check"><input type="checkbox" checked={s.highContrast} onchange={(e) => set("highContrast", e.currentTarget.checked)} /><span>{t("settings.contrast")}</span></label>
    <fieldset>
      <legend>{t("settings.textSize")}</legend>
      <div class="chips">
        {#each ["s", "m", "l", "xl"] as const as size (size)}
          <label class="chip"><input type="radio" name="text-size" checked={s.textSize === size} onchange={() => set("textSize", size)} /><span>{t(`settings.size.${size}`)}</span></label>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>{t("settings.font")}</legend>
      <div class="chips">
        {#each ["standard", "dyslexic"] as const as font (font)}
          <label class="chip" class:dys={font === "dyslexic"}><input type="radio" name="font" checked={s.readingFont === font} onchange={() => set("readingFont", font)} /><span>{t(`settings.font.${font}`)}</span></label>
        {/each}
      </div>
    </fieldset>
  </section>

  <section aria-labelledby="set-motion">
    <h3 id="set-motion">{t("settings.motion")}</h3>
    <div class="chips">
      {#each ["system", "reduce", "full"] as const as m (m)}
        <label class="chip"><input type="radio" name="motion" checked={s.motion === m} onchange={() => set("motion", m)} /><span>{t(`settings.motion.${m}`)}</span></label>
      {/each}
    </div>
  </section>

  <section aria-labelledby="set-controls">
    <h3 id="set-controls">{t("settings.controls")}</h3>
    <ul class="keys">
      {#each ACTIONS as action (action)}
        <li>
          <span>{t(`settings.action.${action}`)}</span>
          <button type="button" class="key" class:listening={listening === action} onclick={() => listen(action)} aria-label={`${t(`settings.action.${action}`)}: ${bindings[action].map(keyLabel).join(", ")}`}>
            {listening === action ? t("settings.press") : bindings[action].map(keyLabel).join(" / ")}
          </button>
        </li>
      {/each}
    </ul>
    <button type="button" class="btn quiet" onclick={resetKeys}>{t("settings.reset")}</button>
  </section>

  <section aria-labelledby="set-graphics">
    <h3 id="set-graphics">{t("settings.graphics")}</h3>
    <fieldset>
      <legend>{t("settings.quality")}</legend>
      <div class="chips">
        {#each ["auto", "low", "medium", "high"] as const as q (q)}
          <label class="chip"><input type="radio" name="quality" checked={quality === q} onchange={() => setQuality(q)} /><span>{t(`settings.quality.${q}`)}</span></label>
        {/each}
      </div>
    </fieldset>
  </section>

  <section aria-labelledby="set-story">
    <h3 id="set-story">{t("settings.story")}</h3>
    <label class="check"><input type="checkbox" checked={s.exploreFreely} onchange={(e) => set("exploreFreely", e.currentTarget.checked)} /><span>{t("settings.explore")}</span></label>
    <p class="help">{t("settings.exploreHelp")}</p>
    <label class="select">
      <span>{t("settings.language")}</span>
      <select value={s.language} onchange={(e) => set("language", e.currentTarget.value as Settings["language"])}>
        <option value="en">{t("settings.lang.en")}</option>
        <option value="fil">{t("settings.lang.fil")}</option>
      </select>
    </label>
  </section>
</Panel>

<style>
  section {
    padding: 14px 0 18px;
    border-bottom: 1.5px dashed rgba(43, 38, 34, 0.22);
  }
  h3 {
    margin: 0 0 10px;
    font: 700 1.25rem/1.2 var(--hand);
  }
  fieldset {
    border: 0;
    margin: 12px 0 0;
    padding: 0;
  }
  legend {
    font-weight: 700;
    margin-bottom: 6px;
  }
  .slider {
    display: grid;
    grid-template-columns: 8.5em 1fr 2.5em;
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  .slider output {
    font: 700 0.9rem var(--label);
    text-align: right;
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--clay);
    height: 32px;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    cursor: pointer;
  }
  .check input {
    appearance: none;
    flex: none;
    width: 26px;
    height: 26px;
    margin: 0;
    border: 2.5px solid var(--ink);
    border-radius: 5px 7px 6px 5px;
    background: var(--paper-light);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .check input::after {
    content: "";
    width: 12px;
    height: 7px;
    border-left: 3px solid var(--clay);
    border-bottom: 3px solid var(--clay);
    transform: translateY(-2px) rotate(-48deg) scale(0);
    transition: transform 0.18s var(--ease-spring);
  }
  .check input:checked::after {
    transform: translateY(-2px) rotate(-48deg) scale(1);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    position: relative;
    cursor: pointer;
  }
  .chip input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
  .chip span {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 14px;
    border: 2px solid var(--ink-soft);
    border-radius: 10px 14px 9px 13px;
    background: var(--paper-light);
    transition: background 0.15s, transform 0.15s var(--ease-spring);
  }
  .chip:hover span {
    transform: translateY(-1px);
  }
  .chip input:checked + span {
    background: var(--amber);
    border-color: var(--ink);
    font-weight: 700;
  }
  .chip input:focus-visible + span {
    outline: 3px dashed var(--clay);
    outline-offset: 3px;
  }
  .chip.dys span {
    font-family: "OpenDyslexic", var(--read);
  }
  .keys {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .keys li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .key {
    min-width: 7em;
    min-height: 44px;
    font: 700 0.95rem var(--label);
    background: var(--paper-light);
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 7px 9px 8px 7px;
    box-shadow: 0 3px 0 var(--ink);
    cursor: pointer;
  }
  .key.listening {
    background: var(--amber);
  }
  .help {
    margin: 0 0 12px 38px;
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  .select {
    display: grid;
    gap: 6px;
    font-weight: 700;
  }
  select {
    min-height: 44px;
    font: inherit;
    font-weight: 400;
    padding: 0 10px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--paper-light);
    color: var(--ink);
  }
</style>
