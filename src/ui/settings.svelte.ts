import { BUSES, audio } from "../audio/audio";
import { type StringKey, translate } from "../content/strings";
import { readStorage, writeStorage } from "../game/core/state";
import { SETTINGS_KEY, type Settings, defaultSettings, reviveSettings } from "./settings-data";

export { SETTINGS_KEY, type Settings, defaultSettings, reviveSettings } from "./settings-data";

class SettingsStore {
  value = $state<Settings>(defaultSettings());

  constructor() {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(readStorage(SETTINGS_KEY) ?? "null");
    } catch {
      parsed = null;
    }
    this.value = reviveSettings(parsed);
    this.apply();
  }

  update(change: (draft: Settings) => void): void {
    change(this.value);
    writeStorage(SETTINGS_KEY, JSON.stringify($state.snapshot(this.value)));
    this.apply();
  }

  /** Pushes settings to the page and the audio mixer. */
  apply(): void {
    const s = this.value;
    const root = document.documentElement;
    root.dataset["text"] = s.textSize;
    root.dataset["font"] = s.readingFont;
    root.dataset["contrast"] = s.highContrast ? "high" : "normal";
    root.lang = "en";
    const reduce = s.motion === "reduce" || (s.motion === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    root.dataset["motion"] = reduce ? "reduce" : "full";
    for (const bus of BUSES) audio.setVolume(bus, s.volume[bus]);
  }

  /** True when motion should be reduced, from the setting or the device. */
  get reducedMotion(): boolean {
    return document.documentElement.dataset["motion"] === "reduce";
  }

  t(key: StringKey, values?: Record<string, string | number>): string {
    return translate(key, values);
  }
}

export const settings = new SettingsStore();
export const t = (key: StringKey, values?: Record<string, string | number>): string => settings.t(key, values);
