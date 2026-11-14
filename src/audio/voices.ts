import { filter, gain, osc } from "./instruments";
import type { Mixer } from "./mixer";
import { PENTATONIC, midiToHz } from "./motif";
import { contour, endingOf, seeded } from "./theory";

/**
 * The murmur: gibberish voices that follow the real words, the way cozy games
 * talk: small, bubbly and a little sing-song.
 *
 * Kept cute on purpose (team feedback, 2026-11-14): the kids talk high and
 * quick through a small mouth, every syllable lands on a note of the game's
 * pentatonic scale, each one pops up into its note like a little "bwip", the
 * mouth bounces between syllables instead of droning, and the consonants are
 * soft taps rather than hisses.
 *
 * One line is one continuous voice. The throat is an oscillator with a soft,
 * voice-like spread of harmonics (falling off the way a real glottal pulse
 * does, not a raw buzz), shaking with a little vibrato and drift. The mouth is
 * four formant filters that glide from vowel to vowel. Each syllable of each
 * real word gets its own vowel, and its opening consonant is played by type:
 * p, t and k close the mouth and pop; s, f and sh hiss; m and n hum through a
 * closed mouth; l, r, w and y slide in. Inside a word the mouth stays open;
 * between words it closes; commas and full stops get a breath. The stressed
 * syllable of each word sits a little higher and longer, sentences drift down,
 * questions rise. Dad hums with his mouth closed; Milo bleeps.
 */
export interface VoiceSpec {
  kind: "talk" | "hum" | "bleep";
  /** Base pitch in Hz. */
  hz: number;
  /** Mouth size: above 1 is smaller and brighter (kids), below 1 is bigger and darker. */
  formant: number;
  /** Seconds per syllable. */
  syllable: number;
  /** How much the pitch moves: word accents and letter nudges, in semitones. */
  bounce: number;
  /** 0 is a clear voice, 1 is all whisper. */
  breath: number;
  /** Lifts every few syllables, for a cheerful lilt. */
  lilt: number;
  /** How soft the throat is: about 1 is bright, 2 is soft and round. */
  tilt: number;
  level: number;
}

/** Remi mid and steady, Nori higher and bouncy, Lumi soft and breathy, Theo lower and cheerful. */
export const VOICES: Record<string, VoiceSpec> = {
  remi: { kind: "talk", hz: 340, formant: 1.32, syllable: 0.082, bounce: 1.6, breath: 0.04, lilt: 1, tilt: 1.75, level: 0.38 },
  nori: { kind: "talk", hz: 420, formant: 1.42, syllable: 0.072, bounce: 2.8, breath: 0.03, lilt: 2, tilt: 1.65, level: 0.36 },
  lumi: { kind: "talk", hz: 385, formant: 1.38, syllable: 0.09, bounce: 1.3, breath: 0.22, lilt: 0, tilt: 1.95, level: 0.37 },
  theo: { kind: "talk", hz: 295, formant: 1.26, syllable: 0.078, bounce: 2, breath: 0.03, lilt: 2, tilt: 1.7, level: 0.37 },
  mom: { kind: "talk", hz: 262, formant: 1.16, syllable: 0.092, bounce: 1.4, breath: 0.08, lilt: 0, tilt: 1.8, level: 0.24 },
  dad: { kind: "hum", hz: 118, formant: 0.92, syllable: 0.19, bounce: 1.3, breath: 0.08, lilt: 0, tilt: 1.9, level: 0.48 },
  milo: { kind: "bleep", hz: 1000, formant: 1, syllable: 0.085, bounce: 0, breath: 0, lilt: 0, tilt: 1, level: 0.12 },
};

/** Vowel shapes: the first four formants in Hz for a medium mouth (a, e, i, o, u). */
const VOWELS: [number, number, number, number][] = [
  [850, 1220, 2810, 3800],
  [580, 1800, 2600, 3700],
  [340, 2250, 2950, 3900],
  [560, 920, 2600, 3600],
  [380, 900, 2400, 3500],
];
/** A hummed "mm": the mouth closed, the sound through the nose. */
const HUM: [number, number, number, number] = [280, 1050, 2400, 3300];
/** Where the mouth starts for the sliding consonants. */
const GLIDES: Record<string, [number, number, number, number]> = {
  l: [400, 1250, 2650, 3500],
  r: [420, 1300, 1650, 3200],
  w: [330, 760, 2300, 3400],
  y: [300, 2300, 3000, 3800],
};
/** How long each vowel likes to be, relative to the syllable. */
const VOWEL_LENGTH = [1.12, 0.95, 0.88, 1.08, 1.0];

/** How a syllable opens. */
export type Onset = "none" | "stop" | "hiss" | "nasal" | "glide" | "breath";

const VOWEL_INDEX: Record<string, number> = { a: 0, e: 1, i: 2, o: 3, u: 4, y: 2 };

/** Each letter's little pitch nudge, from -1 to 1, the same every time. */
export const LETTER_PITCH: Record<string, number> = Object.fromEntries(
  "abcdefghijklmnopqrstuvwxyz".split("").map((c, i) => [c, Math.sin(i * 2.399) * 0.9]),
);

/** The kind of sound a consonant cluster opens with. */
export function onsetOf(cluster: string): Onset {
  if (!cluster) return "none";
  const two = cluster.slice(0, 2);
  if (two === "th" || two === "sh" || two === "ch" || two === "ph") return "hiss";
  const c = cluster[0]!;
  if ("pbtdkgcq".includes(c)) return "stop";
  if ("szfvxj".includes(c)) return "hiss";
  if ("mn".includes(c)) return "nasal";
  if ("lrwy".includes(c)) return "glide";
  if (c === "h") return "breath";
  return "stop";
}

/** The syllables of a word or line: one per vowel group, with its vowel and how it opens. */
export function syllablesOf(text: string): { vowel: number; letter: string; consonant: boolean; onset: Onset; cluster: string }[] {
  const out: { vowel: number; letter: string; consonant: boolean; onset: Onset; cluster: string }[] = [];
  const lower = text.toLowerCase();
  let cluster = "";
  for (let i = 0; i < lower.length; i += 1) {
    const c = lower[i]!;
    if (c in VOWEL_INDEX && !(c === "y" && cluster === "" && (i === 0 || !/[a-z]/.test(lower[i - 1]!)))) {
      out.push({ vowel: VOWEL_INDEX[c]!, letter: cluster[0] ?? c, consonant: cluster.length > 0, onset: onsetOf(cluster), cluster });
      cluster = "";
      // Skip the rest of the vowel group ("ou", "ee").
      while (i + 1 < lower.length && lower[i + 1]! in VOWEL_INDEX) i += 1;
    } else if (c >= "a" && c <= "z") cluster += c;
    else cluster = "";
  }
  return out;
}

/** Major pentatonic steps above the voice's base note: 0, 2, 4, 7 and 9 semitones. */
const SCALE = [0, 2, 4, 7, 9];
/** The nearest note of the pentatonic scale to a pitch, in semitones from the base. */
export function toScale(semis: number): number {
  const octave = Math.floor(semis / 12);
  const within = semis - octave * 12;
  let best = 0;
  for (const step of [...SCALE, 12]) if (Math.abs(step - within) < Math.abs(best - within)) best = step;
  return octave * 12 + best;
}

/** Little words that never carry the stress of a sentence. */
const LIGHT = new Set(["a", "an", "the", "to", "of", "and", "or", "is", "it", "in", "on", "at", "i", "you", "we", "he", "she", "my", "your", "be", "for", "so", "but", "with", "was", "are", "can"]);

export interface Syllable {
  /** When the syllable starts (its consonant), in seconds from the start of the line. */
  at: number;
  /** How long it lasts, consonant and vowel. */
  dur: number;
  /** Pitch at the vowel, in Hz. */
  hz: number;
  /** How far the pitch slides over the vowel, in semitones. */
  glide: number;
  vowel: number;
  consonant: boolean;
  onset: Onset;
  cluster: string;
  /** 0 is a light syllable, 1 the stressed one of its word. */
  stress: number;
  /** The mouth closes after this syllable: the end of a word. */
  close: boolean;
}

/** Splits a line into sentences, each with its ending, and each sentence into words with the pause after them. */
function phrases(text: string): { ending: ReturnType<typeof endingOf>; words: { word: string; pause: "word" | "comma" | "stop" }[] }[] {
  const out: { ending: ReturnType<typeof endingOf>; words: { word: string; pause: "word" | "comma" | "stop" }[] }[] = [];
  const sentences = text.match(/[^.!?…]+(?:\.\.\.|…|[.!?]+)?["')\]]*/g) ?? [text];
  for (const sentence of sentences) {
    const tokens = sentence.match(/[A-Za-z0-9']+|[,;:—-]/g) ?? [];
    const words: { word: string; pause: "word" | "comma" | "stop" }[] = [];
    for (const token of tokens) {
      if (/^[,;:—-]$/.test(token)) {
        const last = words[words.length - 1];
        if (last) last.pause = "comma";
      } else words.push({ word: token, pause: "word" });
    }
    if (!words.length) continue;
    words[words.length - 1]!.pause = "stop";
    out.push({ ending: endingOf(sentence), words });
  }
  return out;
}

/**
 * Plans the syllables for a line: timing, pitch, vowels and consonants.
 * Pure, so it can be tested: the same line always plans the same way, and the
 * whole line lasts about as long as the speech bubble takes to type it.
 */
export function planLine(spec: VoiceSpec, text: string, seed: number): Syllable[] {
  const random = seeded(seed);
  const plan: Syllable[] = [];
  let t = 0;
  let index = 0;
  for (const phrase of phrases(text)) {
    const sylls: { s: ReturnType<typeof syllablesOf>[number]; stress: number; close: boolean; pause: "word" | "comma" | "stop" | null }[] = [];
    for (const w of phrase.words) {
      const lower = w.word.toLowerCase();
      // Digits read as one syllable each; a word with no vowels ("hmm", "shh") is one syllable.
      let parts = /^[0-9]+$/.test(lower) ? lower.split("").slice(0, 4).map(() => ({ vowel: 3, letter: "n", consonant: true, onset: "nasal" as Onset, cluster: "n" })) : syllablesOf(lower);
      if (!parts.length) parts = [{ vowel: 4, letter: lower[0] ?? "m", consonant: true, onset: onsetOf(lower), cluster: lower }];
      const light = LIGHT.has(lower);
      parts.forEach((s, k) => {
        const stress = light ? 0.15 : k === 0 && (parts.length > 1 || lower.length > 3) ? 1 : k === 0 ? 0.6 : 0.2;
        sylls.push({ s, stress, close: k === parts.length - 1, pause: k === parts.length - 1 ? w.pause : null });
      });
    }
    const count = sylls.length;
    sylls.forEach(({ s, stress, close, pause }, i) => {
      const fast = phrase.ending === "exclaim" ? 0.92 : 1;
      const dur = spec.syllable * VOWEL_LENGTH[s.vowel]! * (1 + 0.14 * stress) * (close ? 1.1 : 1) * fast * (0.93 + random() * 0.14);
      const nudge = (LETTER_PITCH[s.letter] ?? 0) * spec.bounce * 0.35;
      const accent = stress * spec.bounce * 0.9;
      const lilt = spec.lilt && index % 3 === 1 ? spec.lilt : 0;
      const raw = contour(i, count, phrase.ending) + accent + nudge + (random() * 2 - 1) * spec.bounce * 0.25 + lilt;
      // Talking voices land on the notes of the game's pentatonic scale, so the babble sounds sung.
      const semis = spec.kind === "talk" ? toScale(raw) : raw;
      const last = i === count - 1;
      const glide = last && phrase.ending === "question" ? 2.5 : last && phrase.ending === "statement" ? -1.2 : stress > 0.5 ? -0.6 : -0.25;
      plan.push({ at: t, dur, hz: spec.hz * 2 ** (semis / 12), glide, vowel: s.vowel, consonant: s.consonant, onset: s.onset, cluster: s.cluster, stress, close });
      t += dur;
      if (pause === "word") t += spec.syllable * 0.2;
      else if (pause === "comma") t += spec.syllable * 1.5;
      else if (pause === "stop") t += spec.syllable * (phrase.ending === "trail" ? 2.8 : 2);
      index += 1;
    });
    if (plan.length >= 90) break;
  }
  if (!plan.length) plan.push({ at: 0, dur: spec.syllable, hz: spec.hz, glide: 0, vowel: 3, consonant: false, onset: "none", cluster: "", stress: 0.5, close: true });
  // Fit the murmur to the typing of the bubble (about 42 letters a second), within reason.
  const last = plan[plan.length - 1]!;
  const natural = last.at + last.dur;
  const typed = Math.max(0.3, text.length / 42);
  const scale = Math.max(0.7, Math.min(1.5, typed / natural));
  for (const p of plan) {
    p.at *= scale;
    p.dur *= scale;
  }
  return plan;
}

/** A throat sound with harmonics falling off like a real voice: brighter at tilt 1, rounder at 2. Made once per tilt. */
const waves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
function throatWave(ctx: BaseAudioContext, tilt: number): PeriodicWave {
  let table = waves.get(ctx);
  if (!table) waves.set(ctx, (table = new Map()));
  const key = Math.round(tilt * 100);
  let wave = table.get(key);
  if (!wave) {
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k += 1) imag[k] = (1 / k ** tilt) * (k % 2 === 0 ? 0.82 : 1);
    wave = ctx.createPeriodicWave(real, imag);
    table.set(key, wave);
  }
  return wave;
}

export interface Speaking {
  /** Seconds the voice lasts. */
  duration: number;
  stop(): void;
}

const STOP_BURST: Record<string, number> = { p: 1500, b: 1300, t: 4200, d: 3600, k: 2500, g: 2200, c: 2500, q: 2500 };
const HISS_TONE = (cluster: string): [number, number] => {
  const two = cluster.slice(0, 2);
  if (two === "sh" || two === "ch" || cluster[0] === "j") return [3200, 2.2];
  if (two === "th" || two === "ph" || cluster[0] === "f" || cluster[0] === "v") return [3600, 0.9];
  return [6400, 3];
};

export function speak(mx: Mixer, out: AudioNode, speaker: string, text: string, at = mx.now): Speaking {
  const spec = VOICES[speaker] ?? VOICES["remi"]!;
  if (spec.kind === "bleep") return bleep(mx, out, spec, text, at);
  const ctx = mx.ctx;
  const hum = spec.kind === "hum";
  const plan = planLine(spec, text, Math.floor(Math.random() * 1e9));
  const last = plan[plan.length - 1]!;
  const duration = last.at + last.dur + 0.08;
  const end = at + duration;
  const loud = endingOf(text) === "exclaim" ? 1.15 : 1;
  const peak = spec.level * loud;

  // The throat: soft harmonics, a little vibrato and a slow wander so it never sounds machine-steady.
  const throat = osc(ctx, "sine", plan[0]!.hz, at, end + 0.3);
  throat.setPeriodicWave(throatWave(ctx, spec.tilt));
  const vibrato = osc(ctx, "sine", hum ? 5.3 : 6.4, at, end + 0.3);
  const wander = osc(ctx, "sine", 1.7, at, end + 0.3);
  vibrato.connect(gain(ctx, spec.hz * (hum ? 0.009 : 0.013))).connect(throat.frequency);
  wander.connect(gain(ctx, spec.hz * 0.006)).connect(throat.frequency);
  // Breath: noise through the same mouth.
  const breath = ctx.createBufferSource();
  breath.buffer = mx.noise("white");
  breath.loop = true;
  breath.start(at, Math.random());
  breath.stop(end + 0.3);
  const breathGain = gain(ctx, spec.breath * 0.9);
  const throatGain = gain(ctx, 1 - spec.breath * 0.5);
  throat.connect(throatGain);
  breath.connect(breathGain);

  // The mouth: four formants in parallel, plus a little warm chest sound underneath.
  const mouth = gain(ctx, 0);
  const shape0 = hum ? HUM : VOWELS[plan[0]!.vowel]!;
  const formants = [0, 1, 2, 3].map((k) => {
    // Each formant is at least as wide as the gap between harmonics, so a high voice never falls
    // between the peaks and goes thin on some vowels.
    const width = Math.max([90, 110, 160, 220][k]!, spec.hz * 0.85);
    const f = filter(ctx, "bandpass", shape0[k]! * spec.formant, Math.max(1.2, ([800, 1500, 2700, 3700][k]! * spec.formant) / width));
    throatGain.connect(f);
    breathGain.connect(f);
    f.connect(gain(ctx, [1, 0.55, 0.3, 0.14][k]!)).connect(mouth);
    return f;
  });
  throatGain.connect(filter(ctx, "lowpass", 520, 0.6)).connect(gain(ctx, 0.14)).connect(mouth);
  // A soft sine an octave up gives the small voices a bit of sparkle.
  if (!hum) {
    const sparkle = osc(ctx, "sine", plan[0]!.hz * 2, at, end + 0.3);
    vibrato.connect(gain(ctx, spec.hz * 0.026)).connect(sparkle.frequency);
    sparkle.connect(gain(ctx, 0.07)).connect(mouth);
    for (const s of plan) sparkle.frequency.setTargetAtTime(s.hz * 2, at + s.at, 0.012);
  }
  // A touch of presence, then a gentle top roll-off, so it sits forward but never buzzes.
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2700;
  presence.Q.value = 1;
  presence.gain.value = hum ? 0 : 2.5;
  const soft = filter(ctx, "lowpass", hum ? 1500 : spec.formant > 1.1 ? 5200 : 4400, 0.5);
  mouth.connect(presence).connect(soft).connect(out);

  // Consonants: one noise source through a filter that retunes for each pop or hiss.
  const noise = ctx.createBufferSource();
  noise.buffer = mx.noise("white");
  noise.loop = true;
  noise.start(at, Math.random());
  noise.stop(end + 0.3);
  const tone = filter(ctx, "bandpass", 4000, 1.5);
  const noiseGain = gain(ctx, 0);
  noise.connect(tone).connect(noiseGain).connect(out);

  const env = mouth.gain;
  env.setValueAtTime(0, at);
  const setShape = (shape: readonly number[], when: number, tau: number): void => formants.forEach((f, k) => f.frequency.setTargetAtTime(shape[k]! * spec.formant, when, tau));
  for (const s of plan) {
    const t = at + s.at;
    const kind: Onset = hum ? (s.consonant ? "nasal" : "none") : s.onset;
    // The consonant takes the front of the syllable.
    const lead = kind === "none" ? 0 : kind === "stop" ? Math.min(0.03, s.dur * 0.25) : Math.min(0.055, s.dur * 0.4);
    const v = t + lead;
    const shape = hum ? (s.vowel % 2 === 0 ? HUM : VOWELS[3]!) : VOWELS[s.vowel]!;
    const open = peak * (hum ? 0.7 + 0.3 * s.stress : 0.82 + 0.18 * s.stress);
    if (hum) throat.frequency.setTargetAtTime(s.hz, t, 0.05);
    else {
      // A little "bwip": start a few semitones under the note and pop up into it.
      throat.frequency.setTargetAtTime(s.hz * 0.84, t, 0.004);
      throat.frequency.setTargetAtTime(s.hz, t + 0.012, 0.014);
    }
    throat.frequency.setTargetAtTime(s.hz * 2 ** (s.glide / 12), v + (s.dur - lead) * 0.45, (s.dur - lead) * 0.35);
    switch (kind) {
      case "stop": {
        // Lips or tongue shut, then a little pop as they open.
        env.setTargetAtTime(peak * 0.02, t, 0.006);
        tone.frequency.setValueAtTime(STOP_BURST[s.cluster[0]!] ?? 2500, v - 0.002);
        tone.Q.setValueAtTime(1.2, v - 0.002);
        noiseGain.gain.setTargetAtTime(peak * 0.2, v, 0.002);
        noiseGain.gain.setTargetAtTime(0, v + 0.008, 0.007);
        break;
      }
      case "hiss": {
        const [hz, q] = HISS_TONE(s.cluster);
        env.setTargetAtTime(peak * 0.12, t, 0.01);
        tone.frequency.setValueAtTime(hz, t);
        tone.Q.setValueAtTime(q, t);
        noiseGain.gain.setTargetAtTime(peak * 0.07, t, 0.008);
        noiseGain.gain.setTargetAtTime(0, v - 0.008, 0.01);
        break;
      }
      case "nasal":
        // The mouth is shut and the voice hums through the nose for a moment.
        setShape(HUM, t, 0.012);
        env.setTargetAtTime(open * 0.42, t, 0.012);
        break;
      case "glide":
        setShape(GLIDES[s.cluster[0]!] ?? GLIDES["l"]!, t, 0.01);
        env.setTargetAtTime(open * 0.6, t, 0.015);
        break;
      case "breath":
        breathGain.gain.setTargetAtTime(spec.breath * 0.9 + 0.5, t, 0.01);
        breathGain.gain.setTargetAtTime(spec.breath * 0.9, v, 0.02);
        env.setTargetAtTime(open * 0.5, t, 0.015);
        break;
      default:
        break;
    }
    // The vowel: the mouth opens to its shape and holds.
    setShape(shape, v, kind === "glide" ? 0.035 : 0.022);
    env.setTargetAtTime(open, v, hum ? 0.04 : 0.014);
    // The end of a word closes the mouth; inside a word it only eases a little.
    if (s.close) env.setTargetAtTime(0, t + s.dur - 0.035, hum ? 0.05 : 0.018);
    else env.setTargetAtTime(open * (hum ? 0.6 : 0.22), t + s.dur * 0.78, hum ? 0.025 : 0.014);
  }
  env.setTargetAtTime(0, end - 0.06, 0.03);
  mx.duck(duration + 0.25);

  return {
    duration,
    stop: () => {
      const now = mx.now;
      env.cancelScheduledValues(now);
      env.setTargetAtTime(0, now, 0.02);
      noiseGain.gain.cancelScheduledValues(now);
      noiseGain.gain.setTargetAtTime(0, now, 0.01);
    },
  };
}

/** Milo's bleeps: a chip voice hopping between high pentatonic notes; questions end with an upward chirp. */
function bleep(mx: Mixer, out: AudioNode, spec: VoiceSpec, text: string, at: number): Speaking {
  const ctx = mx.ctx;
  const random = seeded(Math.floor(Math.random() * 1e9));
  const ending = endingOf(text);
  const count = Math.max(2, Math.min(14, Math.round(text.length / 6)));
  const duration = count * spec.syllable + 0.2;
  const o = osc(ctx, "square", 1000, at, at + duration + 0.1);
  const f = filter(ctx, "lowpass", 2600, 1);
  const g = gain(ctx, 0);
  o.connect(f).connect(g).connect(out);
  const high = PENTATONIC.filter((n) => n >= 79 && n <= 91);
  for (let i = 0; i < count; i += 1) {
    const t = at + i * spec.syllable;
    const note = high[Math.floor(random() * high.length)]!;
    o.frequency.setValueAtTime(midiToHz(note), t);
    if (i === count - 1 && ending === "question") o.frequency.exponentialRampToValueAtTime(midiToHz(note + 7), t + spec.syllable);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(spec.level, t + 0.006);
    g.gain.setValueAtTime(spec.level, t + spec.syllable * 0.6);
    g.gain.linearRampToValueAtTime(0, t + spec.syllable * 0.8);
  }
  mx.duck(duration);
  return {
    duration,
    stop: () => {
      g.gain.cancelScheduledValues(mx.now);
      g.gain.setTargetAtTime(0, mx.now, 0.01);
    },
  };
}
