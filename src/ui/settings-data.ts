import { BUSES, type Bus } from "../audio/audio";

/**
 * Player settings, saved on this device only. Applied to the page through
 * data attributes on <html>, so CSS can follow them.
 */
export interface Settings {
  volume: Record<Bus, number>;
  /** All sound off, without losing the slider positions. */
  muted: boolean;
  /** The player has moved a volume slider themselves. */
  volumeChosen: boolean;
  subtitles: boolean;
  bubbles: boolean;
  textSize: "s" | "m" | "l" | "xl";
  readingFont: "standard" | "dyslexic";
  highContrast: boolean;
  motion: "system" | "reduce" | "full";
  exploreFreely: boolean;
  /** Show the little map in the corner. */
  miniMap: boolean;
  /** Show the paper arrow that points to the next stop. */
  guideArrow: boolean;
  /** The mission note is folded down to its title. */
  missionFolded: boolean;
  readAloud: boolean;
  /** Show the short how-to-play tips. */
  tips: boolean;
  /** Tips already learned, so they do not show again. */
  tipsDone: string[];
}

export const SETTINGS_KEY = "poh.settings.v1";

/**
 * Volumes the game started at before it got quieter. A player who never moved
 * a slider still has these saved, so they move to the new, softer defaults.
 */
const OLD_VOLUME: Record<Bus, number> = { master: 0.8, music: 0.6, ambience: 0.7, effects: 0.8, voices: 0.8, ui: 0.7 };

export function defaultSettings(): Settings {
  return {
    // Soft at first: a new player does not know yet where the sound settings are.
    volume: { master: 0.55, music: 0.5, ambience: 0.6, effects: 0.75, voices: 0.8, ui: 0.65 },
    muted: false,
    volumeChosen: false,
    subtitles: true,
    bubbles: true,
    textSize: "m",
    readingFont: "standard",
    highContrast: false,
    motion: "system",
    exploreFreely: false,
    miniMap: true,
    guideArrow: true,
    missionFolded: false,
    readAloud: false,
    tips: true,
    tipsDone: [],
  };
}

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;

/** Rebuilds safe settings from anything stored. */
export function reviveSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (typeof raw !== "object" || raw === null) return d;
  const v = raw as Record<string, unknown>;
  const volume = { ...d.volume };
  const rawVolume = v["volume"];
  if (typeof rawVolume === "object" && rawVolume !== null) {
    for (const bus of BUSES) {
      const n = (rawVolume as Record<string, unknown>)[bus];
      if (typeof n !== "number" || !Number.isFinite(n)) continue;
      if (v["volumeChosen"] !== true && n === OLD_VOLUME[bus]) continue;
      volume[bus] = Math.max(0, Math.min(1, n));
    }
  }
  const bool = (key: keyof Settings, fallback: boolean): boolean => (typeof v[key] === "boolean" ? (v[key] as boolean) : fallback);
  return {
    volume,
    muted: bool("muted", d.muted),
    volumeChosen: bool("volumeChosen", d.volumeChosen),
    subtitles: bool("subtitles", d.subtitles),
    bubbles: bool("bubbles", d.bubbles),
    textSize: pick(v["textSize"], ["s", "m", "l", "xl"] as const, d.textSize),
    readingFont: pick(v["readingFont"], ["standard", "dyslexic"] as const, d.readingFont),
    highContrast: bool("highContrast", d.highContrast),
    motion: pick(v["motion"], ["system", "reduce", "full"] as const, d.motion),
    exploreFreely: bool("exploreFreely", d.exploreFreely),
    miniMap: bool("miniMap", d.miniMap),
    guideArrow: bool("guideArrow", d.guideArrow),
    missionFolded: bool("missionFolded", d.missionFolded),
    readAloud: bool("readAloud", d.readAloud),
    tips: bool("tips", d.tips),
    tipsDone: Array.isArray(v["tipsDone"]) ? [...new Set((v["tipsDone"] as unknown[]).filter((x): x is string => typeof x === "string" && x.length < 24))].slice(0, 24) : [],
  };
}
