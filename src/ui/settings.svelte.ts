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
    for (const bus of BUSES) audio.setVolume(bus, bus === "master" && s.muted ? 0 : s.volume[bus]);
  }

  /** A volume the player picked: it unmutes and is remembered as their choice. */
  setVolume(bus: (typeof BUSES)[number], value: number): void {
    this.update((d) => {
      d.volume[bus] = value;
      d.volumeChosen = true;
      if (value > 0) d.muted = false;
    });
  }

  setMuted(muted: boolean): void {
    this.update((d) => {
      d.muted = muted;
      d.volumeChosen = true;
      if (!muted && d.volume.master < 0.05) d.volume.master = 0.4;
    });
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
