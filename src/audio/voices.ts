import { filter, gain, osc } from "./instruments";
import type { Mixer } from "./mixer";
import { PENTATONIC, midiToHz } from "./motif";
import { contour, endingOf, seeded } from "./theory";

/**
 * Gibberish voices, Messenger style. One line is one continuous voice: an
 * oscillator (the throat) through three bandpass filters (the mouth) whose
 * centres jump between vowel shapes, with the loudness dipping between
 * syllables and a little noise for consonants. The pitch follows the line's
 * punctuation (questions rise). Dad hums; Milo bleeps.
 */
export interface VoiceSpec {
  kind: "talk" | "hum" | "bleep";
  /** Base pitch in Hz. */
  hz: number;
  /** Mouth size: above 1 is smaller and brighter (kids), below 1 is bigger and darker. */
  formant: number;
  /** Seconds per syllable. */
  syllable: number;
  /** Random pitch movement between syllables, in semitones. */
  bounce: number;
  /** 0 is a clear voice, 1 is all whisper. */
  breath: number;
  /** Lifts every few syllables, for a cheerful lilt. */
  lilt: number;
  wave: OscillatorType;
  level: number;
}

/** Remi mid and steady, Nori higher and bouncy, Lumi soft and breathy, Theo lower and cheerful. */
export const VOICES: Record<string, VoiceSpec> = {
  remi: { kind: "talk", hz: 250, formant: 1.12, syllable: 0.105, bounce: 0.9, breath: 0.06, lilt: 0, wave: "sawtooth", level: 0.32 },
  nori: { kind: "talk", hz: 320, formant: 1.2, syllable: 0.085, bounce: 3.2, breath: 0.04, lilt: 1, wave: "sawtooth", level: 0.3 },
  lumi: { kind: "talk", hz: 290, formant: 1.18, syllable: 0.125, bounce: 0.8, breath: 0.42, lilt: 0, wave: "triangle", level: 0.42 },
  theo: { kind: "talk", hz: 205, formant: 1.08, syllable: 0.1, bounce: 1.6, breath: 0.05, lilt: 2.5, wave: "sawtooth", level: 0.32 },
  mom: { kind: "talk", hz: 215, formant: 1.03, syllable: 0.115, bounce: 1.2, breath: 0.1, lilt: 0, wave: "sawtooth", level: 0.28 },
  dad: { kind: "hum", hz: 118, formant: 0.92, syllable: 0.2, bounce: 1.4, breath: 0.08, lilt: 0, wave: "triangle", level: 1 },
  milo: { kind: "bleep", hz: 1000, formant: 1, syllable: 0.085, bounce: 0, breath: 0, lilt: 0, wave: "square", level: 0.12 },
};

/** Vowel shapes: the first three formants in Hz, for a medium-sized mouth. */
const VOWELS: [number, number, number][] = [
  [800, 1150, 2900], // a
  [500, 1900, 2600], // e
  [320, 2300, 3000], // i
  [500, 850, 2600], // o
  [350, 750, 2400], // u
];
/** A hummed "mm": low and closed. */
const HUM: [number, number, number] = [280, 1050, 2400];

export interface Speaking {
  /** Seconds the voice lasts. */
  duration: number;
  stop(): void;
}

/**
 * Plans the syllables for a line: start times, pitches (Hz) and vowels.
 * Pure, so it can be tested.
 */
export function planLine(spec: VoiceSpec, text: string, seed: number): { at: number; hz: number; vowel: number; consonant: boolean }[] {
  const random = seeded(seed);
  const ending = endingOf(text);
  // Match the typing speed of the speech bubble (about 42 letters a second).
  const typed = Math.max(0.3, text.length / 42);
  const count = Math.max(1, Math.min(48, Math.round(typed / spec.syllable)));
  const fast = ending === "exclaim" ? 0.9 : 1;
  const plan: { at: number; hz: number; vowel: number; consonant: boolean }[] = [];
  let t = 0;
  for (let i = 0; i < count; i += 1) {
    const semis = contour(i, count, ending) + (random() * 2 - 1) * spec.bounce + (spec.lilt && i % 3 === 1 ? spec.lilt : 0);
    plan.push({ at: t, hz: spec.hz * 2 ** (semis / 12), vowel: Math.floor(random() * VOWELS.length), consonant: random() < 0.55 });
    t += spec.syllable * fast * (0.85 + random() * 0.3);
  }
  return plan;
}

export function speak(mx: Mixer, out: AudioNode, speaker: string, text: string, at = mx.now): Speaking {
  const spec = VOICES[speaker] ?? VOICES["remi"]!;
  if (spec.kind === "bleep") return bleep(mx, out, spec, text, at);
  const ctx = mx.ctx;
  const plan = planLine(spec, text, Math.floor(Math.random() * 1e9));
  const last = plan[plan.length - 1]!;
  const duration = last.at + spec.syllable * 1.3;
  const end = at + duration;
  const loud = endingOf(text) === "exclaim" ? 1.2 : 1;

  // The throat.
  const throat = osc(ctx, spec.wave, plan[0]!.hz, at, end + 0.2);
  const vibrato = osc(ctx, "sine", 5.5, at, end + 0.2);
  const vd = gain(ctx, spec.hz * 0.012);
  vibrato.connect(vd).connect(throat.frequency);
  // Breath: noise through the same mouth.
  const breath = ctx.createBufferSource();
  breath.buffer = mx.noise("white");
  breath.loop = true;
  breath.start(at, Math.random());
  breath.stop(end + 0.2);
  const breathGain = gain(ctx, spec.breath * 1.4);
  const throatGain = gain(ctx, 1 - spec.breath * 0.6);

  // The mouth: three formant filters in parallel.
  const mouth = gain(ctx, 0);
  const formants = [0, 1, 2].map((k) => {
    const f = filter(ctx, "bandpass", (spec.kind === "hum" ? HUM[k]! : VOWELS[0]![k]!) * spec.formant, [6, 9, 11][k]!);
    const g = gain(ctx, [1, 0.6, 0.28][k]!);
    throat.connect(throatGain);
    throatGain.connect(f);
    breath.connect(breathGain).connect(f);
    f.connect(g).connect(mouth);
    return f;
  });
  const warm = filter(ctx, "lowpass", spec.kind === "hum" ? 1400 : 4200, 0.5);
  mouth.connect(warm).connect(out);

  // Consonants: little clicks and hisses at some syllable starts.
  const hiss = ctx.createBufferSource();
  hiss.buffer = mx.noise("white");
  hiss.loop = true;
  hiss.start(at, Math.random());
  hiss.stop(end + 0.2);
  const hissGain = gain(ctx, 0);
  hiss.connect(filter(ctx, "highpass", 3200, 0.7)).connect(hissGain).connect(out);

  const env = mouth.gain;
  env.setValueAtTime(0, at);
  const peak = spec.level * loud;
  const legato = spec.kind === "hum";
  for (const s of plan) {
    const t = at + s.at;
    throat.frequency.setTargetAtTime(s.hz, t, legato ? 0.04 : 0.012);
    const shape = legato ? (s.vowel % 2 === 0 ? HUM : VOWELS[3]!) : VOWELS[s.vowel]!;
    formants.forEach((f, k) => f.frequency.setTargetAtTime(shape[k]! * spec.formant, t, 0.02));
    // Open the mouth for the vowel, close it a little before the next.
    env.setTargetAtTime(peak, t + 0.01, legato ? 0.04 : 0.012);
    env.setTargetAtTime(peak * (legato ? 0.45 : 0.06), t + spec.syllable * 0.62, legato ? 0.06 : 0.02);
    if (s.consonant && !legato) {
      hissGain.gain.setTargetAtTime(peak * 0.16, t, 0.004);
      hissGain.gain.setTargetAtTime(0, t + 0.018, 0.008);
    }
  }
  env.setTargetAtTime(0, at + duration - 0.04, 0.03);
  mx.duck(duration + 0.25);

  return {
    duration,
    stop: () => {
      const now = mx.now;
      env.cancelScheduledValues(now);
      env.setTargetAtTime(0, now, 0.02);
      hissGain.gain.cancelScheduledValues(now);
      hissGain.gain.setTargetAtTime(0, now, 0.01);
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
