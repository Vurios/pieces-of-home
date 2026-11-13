import { motifEvents, midiToHz } from "./motif";
import { filter, gain, glassBell, holdEnvelope, Loop, musicBox, noise, osc, pluckEnvelope } from "./instruments";
import { crackle, radioHiss } from "./buffers";
import type { Mixer } from "./mixer";

/**
 * Sound effect recipes. Each is built on purpose from a few oscillators and
 * filtered noise; the comment above each says how. `rate` shifts pitch for a
 * little variety, `level` is the loudness, `param` is recipe-specific
 * (landing speed, round-trip seconds, and so on).
 */
export interface SfxCall {
  mx: Mixer;
  out: AudioNode;
  at: number;
  level: number;
  rate: number;
  param: number;
}
export type Recipe = (c: SfxCall) => void;

/** A sound that keeps going until stopped, with one control (speed, power, wind...). */
export interface LoopHandle {
  set(value: number): void;
  stop(): void;
}
export type LoopRecipe = (mx: Mixer, out: AudioNode, value: number) => LoopHandle;

/** Noise through a filter with a quick envelope. */
function burst(c: SfxCall, kind: "white" | "pink" | "brown", type: BiquadFilterType, hz: number, q: number, attack: number, peak: number, length: number, delay = 0): BiquadFilterNode {
  const at = c.at + delay;
  const f = filter(c.mx.ctx, type, hz * c.rate, q);
  const g = gain(c.mx.ctx);
  pluckEnvelope(g.gain, at, attack, peak * c.level, at + length);
  noise(c.mx, kind, at, length).connect(f).connect(g).connect(c.out);
  return f;
}

/** An oscillator that glides from one pitch to another with a quick envelope. */
function tone(c: SfxCall, type: OscillatorType, from: number, to: number, attack: number, peak: number, length: number, delay = 0, glide = length): OscillatorNode {
  const at = c.at + delay;
  const o = osc(c.mx.ctx, type, from * c.rate, at, at + length + 0.05);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to * c.rate), at + Math.min(glide, length));
  const g = gain(c.mx.ctx);
  pluckEnvelope(g.gain, at, attack, peak * c.level, at + length);
  o.connect(g).connect(c.out);
  return o;
}

/** A few bell notes from the motif, used by chimes. */
function chime(c: SfxCall, notes: number[], spacing: number, peak: number, delay = 0, glass = false): void {
  notes.forEach((note, i) => {
    const play = glass ? glassBell : musicBox;
    play(c.mx, c.out, midiToHz(note) * c.rate, c.at + delay + i * spacing, peak * c.level, glass ? 2.8 : 1.6);
  });
}

export const RECIPES: Record<string, Recipe> = {
  // ---- Home and paper ----

  /** Dad's lamp switch: a bright noise tick for the contact, a falling sine for the body of the switch. */
  "lamp-click": (c) => {
    burst(c, "white", "highpass", 1800, 0.7, 0.001, 0.5, 0.03);
    tone(c, "sine", 180, 60, 0.003, 0.5, 0.14, 0.004, 0.08);
  },
  /** A page turning: noise swept upward through a bandpass, then the soft flap of the page landing. */
  "page-flip": (c) => {
    const f = burst(c, "pink", "bandpass", 900, 0.9, 0.08, 0.32, 0.3);
    f.frequency.exponentialRampToValueAtTime(3400 * c.rate, c.at + 0.28);
    burst(c, "brown", "lowpass", 380, 0.7, 0.004, 0.35, 0.09, 0.26);
  },
  /** Pencil on paper: a handful of tiny, high, scratchy grains at uneven times. */
  pencil: (c) => {
    let t = 0;
    for (let i = 0; i < 9; i += 1) {
      burst(c, "white", "bandpass", 3200 + Math.random() * 1800, 2.5, 0.004, 0.18 + Math.random() * 0.1, 0.035 + Math.random() * 0.03, t);
      t += 0.035 + Math.random() * 0.05;
    }
  },
  /** Tape pulled off the roll: a rising rasp, noise chopped fast by a sawtooth. */
  tape: (c) => {
    const ctx = c.mx.ctx;
    const f = filter(ctx, "bandpass", 1300 * c.rate, 1.6);
    f.frequency.exponentialRampToValueAtTime(4200 * c.rate, c.at + 0.32);
    const chop = gain(ctx, 0);
    const lfo = osc(ctx, "sawtooth", 70, c.at, c.at + 0.4);
    const depth = gain(ctx, 0.5);
    lfo.connect(depth).connect(chop.gain);
    const g = gain(ctx);
    holdEnvelope(g.gain, c.at, 0.02, 0.4 * c.level, 0.22, 0.1);
    noise(c.mx, "white", c.at, 0.4).connect(f).connect(chop).connect(g).connect(c.out);
  },
  /** The ink stamp: a deep falling thunk, a wooden knock and a dull slap of rubber on paper. */
  stamp: (c) => {
    tone(c, "sine", 140, 55, 0.002, 0.75, 0.26, 0, 0.12);
    burst(c, "pink", "bandpass", 420, 4, 0.001, 0.45, 0.07);
    burst(c, "white", "lowpass", 1100, 0.7, 0.001, 0.35, 0.05);
  },
  /** A paper toast sliding in: a short soft swish and a tiny tap as it settles. */
  toast: (c) => {
    const f = burst(c, "pink", "bandpass", 1400, 0.8, 0.06, 0.18, 0.2);
    f.frequency.exponentialRampToValueAtTime(2400 * c.rate, c.at + 0.18);
    tone(c, "sine", 900, 700, 0.002, 0.08, 0.05, 0.2);
  },
  /** Menu tick: a very short high blip. */
  tick: (c) => {
    tone(c, "sine", 900, 420, 0.002, 0.12, 0.07);
  },
  /** Menu pop: a soft rising bubble. */
  pop: (c) => {
    tone(c, "sine", 520, 900, 0.003, 0.22, 0.09, 0, 0.05);
  },

  // ---- Feet ----

  /** Wood: a hollow knock, a low resonant band of noise plus a short sine body. */
  "step-wood": (c) => {
    burst(c, "pink", "bandpass", 300, 3.5, 0.002, 0.5, 0.07);
    tone(c, "sine", 170, 120, 0.002, 0.25, 0.05);
  },
  /** Grass: two quick, high rustles a few milliseconds apart. */
  "step-grass": (c) => {
    burst(c, "white", "highpass", 2600, 0.7, 0.006, 0.14, 0.07);
    burst(c, "white", "bandpass", 4200, 1, 0.004, 0.1, 0.05, 0.025);
  },
  /** Path: a gritty crunch, a few tiny bursts of mid noise. */
  "step-path": (c) => {
    for (let i = 0; i < 3; i += 1) burst(c, "white", "bandpass", 1100 + i * 500, 1.4, 0.002, 0.5, 0.03, i * 0.018);
  },
  /** Shallow water: a quick upward bubble and a splash of noise. */
  "step-water": (c) => {
    tone(c, "sine", 700, 1400, 0.002, 0.18, 0.06, 0, 0.05);
    const f = burst(c, "white", "bandpass", 700, 1.2, 0.004, 0.3, 0.12);
    f.frequency.exponentialRampToValueAtTime(2000, c.at + 0.1);
  },
  /** Moon regolith: a soft, muffled, powdery crunch (Dad's model has air, so we can hear it). */
  "step-regolith": (c) => {
    burst(c, "pink", "lowpass", 700, 0.8, 0.008, 0.7, 0.12);
    burst(c, "white", "bandpass", 1500, 1.2, 0.002, 0.16, 0.05, 0.01);
  },
  /** Mars dust: a sandy, smoother hush. */
  "step-dust": (c) => {
    burst(c, "pink", "bandpass", 1500, 0.7, 0.01, 0.55, 0.14);
  },
  /** Jump: a little cloth whoosh that rises. */
  jump: (c) => {
    const f = burst(c, "pink", "bandpass", 450, 1.2, 0.03, 0.26, 0.18);
    f.frequency.exponentialRampToValueAtTime(1500 * c.rate, c.at + 0.16);
  },
  /** Land: a soft thud; `param` is the landing speed, louder for bigger drops. */
  land: (c) => {
    const k = Math.min(1, Math.max(0.25, c.param / 8));
    tone(c, "sine", 95, 48, 0.002, 0.55 * k, 0.16);
    burst(c, "brown", "lowpass", 320, 0.7, 0.002, 0.45 * k, 0.12);
  },
  /** A small puff of moon dust: an airy swell that dies away. */
  "regolith-puff": (c) => {
    const g = gain(c.mx.ctx);
    holdEnvelope(g.gain, c.at, 0.05, 0.16 * c.level, 0.05, 0.35);
    noise(c.mx, "pink", c.at, 0.45).connect(filter(c.mx.ctx, "lowpass", 900 * c.rate)).connect(g).connect(c.out);
  },

  // ---- Letters ----

  /** Picking up a letter: a paper rustle and two bright music-box notes. */
  "envelope-pickup": (c) => {
    burst(c, "pink", "bandpass", 2200, 1, 0.01, 0.2, 0.12);
    chime(c, [83, 88], 0.09, 0.22, 0.05);
  },
  /** Delivering a letter: the motif's first three notes and the high G, rising, with a glassy shimmer on top. */
  "delivery-chime": (c) => {
    chime(c, [79, 83, 86, 91], 0.11, 0.24);
    chime(c, [98], 0, 0.06, 0.44, true);
  },

  // ---- Milo ----

  /** Milo boots up: three square bleeps climbing through a filter, a little servo whirr, then a happy chirp. */
  "milo-boot": (c) => {
    [600, 800, 1200].forEach((hz, i) => {
      const o = tone(c, "square", hz, hz, 0.004, 0.06, 0.09, i * 0.13);
      o.disconnect();
      const f = filter(c.mx.ctx, "lowpass", 2200);
      const g = gain(c.mx.ctx);
      pluckEnvelope(g.gain, c.at + i * 0.13, 0.004, 0.08 * c.level, c.at + i * 0.13 + 0.09);
      o.connect(f).connect(g).connect(c.out);
    });
    tone(c, "sawtooth", 140, 260, 0.05, 0.04, 0.3, 0.42);
    tone(c, "sine", 1100, 1700, 0.004, 0.16, 0.12, 0.78, 0.08);
    tone(c, "sine", 1500, 2200, 0.004, 0.14, 0.1, 0.9, 0.06);
  },
  /** Milo is happy: two quick sine bleeps that bend upward. */
  "milo-happy": (c) => {
    tone(c, "sine", 880, 1320, 0.003, 0.18, 0.09, 0, 0.06);
    tone(c, "sine", 1320, 1980, 0.003, 0.16, 0.12, 0.11, 0.08);
  },
  /** Milo is curious: one rising glide that tips up at the end, like a question. */
  "milo-curious": (c) => {
    const o = tone(c, "sine", 600, 900, 0.01, 0.18, 0.32, 0, 0.2);
    o.frequency.exponentialRampToValueAtTime(1250 * c.rate, c.at + 0.3);
  },
  /** Milo dozes in the shade: a slow falling glide with a wobble, and a soft breath. */
  "milo-sleepy": (c) => {
    const o = tone(c, "triangle", 700, 280, 0.05, 0.14, 0.9, 0, 0.85);
    const wob = osc(c.mx.ctx, "sine", 6, c.at, c.at + 0.95);
    const d = gain(c.mx.ctx, 18);
    wob.connect(d).connect(o.frequency);
    const g = gain(c.mx.ctx);
    holdEnvelope(g.gain, c.at + 0.6, 0.3, 0.05 * c.level, 0.2, 0.5);
    noise(c.mx, "pink", c.at + 0.6, 1.1).connect(filter(c.mx.ctx, "lowpass", 700)).connect(g).connect(c.out);
  },
  /** Milo hops: a springy "boing" (a sine that leaps and wobbles) and a small landing tap. */
  "milo-hop": (c) => {
    const o = tone(c, "sine", 220, 440, 0.003, 0.22, 0.32, 0, 0.08);
    o.frequency.exponentialRampToValueAtTime(320 * c.rate, c.at + 0.3);
    const wob = osc(c.mx.ctx, "sine", 16, c.at, c.at + 0.35);
    const d = gain(c.mx.ctx, 24);
    wob.connect(d).connect(o.frequency);
    burst(c, "brown", "lowpass", 300, 0.7, 0.002, 0.3, 0.08, 0.34);
  },
  /** A part clicking into place: a mechanical clunk (thump plus a short metallic ring), then a bright chime. */
  "part-clunk": (c) => {
    burst(c, "brown", "lowpass", 260, 0.7, 0.001, 0.7, 0.12);
    burst(c, "white", "highpass", 2500, 0.7, 0.001, 0.25, 0.02);
    const ctx = c.mx.ctx;
    const ring = osc(ctx, "sine", 520 * c.rate, c.at, c.at + 0.3);
    const mod = osc(ctx, "sine", 520 * 2.76 * c.rate, c.at, c.at + 0.3);
    const d = gain(ctx, 400);
    mod.connect(d).connect(ring.frequency);
    const g = gain(ctx);
    pluckEnvelope(g.gain, c.at, 0.001, 0.18 * c.level, c.at + 0.25);
    ring.connect(g).connect(c.out);
    chime(c, [88, 95], 0.08, 0.2, 0.16);
  },

  // ---- Chapter 1: Tranquility Base ----

  /**
   * Laser ping, then its return. `param` is the real round trip in seconds,
   * from facts.json (light-roundtrip). The pong is softer and a little lower:
   * only a sliver of the light comes home.
   */
  laser: (c) => {
    tone(c, "sine", 2400, 1800, 0.002, 0.2, 0.25, 0, 0.2);
    tone(c, "triangle", 4800, 3600, 0.002, 0.05, 0.12);
    const back = Math.max(0.5, c.param || 2.5);
    tone(c, "sine", 1800, 2000, 0.01, 0.13, 0.4, back, 0.3);
    chime(c, [93], 0, 0.06, back + 0.05, true);
  },
  /** The laser leaves: a bright, quick ping with a glassy overtone. */
  "laser-ping": (c) => {
    tone(c, "sine", 2400, 1800, 0.002, 0.2, 0.25, 0, 0.2);
    tone(c, "triangle", 4800, 3600, 0.002, 0.05, 0.12);
  },
  /** The light comes home: a softer, lower pong and one small bell. */
  "laser-pong": (c) => {
    tone(c, "sine", 1800, 2000, 0.01, 0.13, 0.4, 0, 0.3);
    chime(c, [93], 0, 0.06, 0.05, true);
  },
  /** A mirror panel snaps into its frame: a sharp click, a tiny metal ring, a low seat. */
  "mirror-snap": (c) => {
    burst(c, "white", "highpass", 3000, 0.7, 0.001, 0.35, 0.012);
    tone(c, "sine", 3300, 3200, 0.001, 0.08, 0.1, 0.004);
    tone(c, "sine", 160, 90, 0.002, 0.3, 0.08, 0.006);
  },
  /** The corner cube clicks home: a quick climb of glass bells and a high shimmer. */
  "corner-sparkle": (c) => {
    chime(c, [86, 88, 91, 95, 98], 0.06, 0.12, 0, true);
    const g = gain(c.mx.ctx);
    holdEnvelope(g.gain, c.at, 0.1, 0.05 * c.level, 0.2, 0.5);
    noise(c.mx, "white", c.at, 0.8).connect(filter(c.mx.ctx, "highpass", 6500)).connect(g).connect(c.out);
  },

  // ---- Chapter 2: Hadley ----

  /** The mesh wheel rolling over dust: crunchy grains in a steady pattern, like chevrons passing. */
  "wheel-crunch": (c) => {
    for (let i = 0; i < 8; i += 1) burst(c, "white", "bandpass", 900 + (i % 2) * 400, 1.3, 0.003, 0.18, 0.05, i * 0.075);
  },
  /** The steering servo: a buzzy square that rises and settles. */
  servo: (c) => {
    const o = tone(c, "square", 300, 420, 0.01, 0.05, 0.35, 0, 0.18);
    o.frequency.exponentialRampToValueAtTime(310 * c.rate, c.at + 0.34);
  },

  // ---- Chapter 3: Meridiani ----

  /** The microscope focusing: little ratchet ticks, then a rising glint as the image sharpens. */
  "microscope-focus": (c) => {
    for (let i = 0; i < 7; i += 1) burst(c, "white", "bandpass", 3600, 3, 0.001, 0.14, 0.012, i * 0.055);
    tone(c, "sine", 900, 1800, 0.02, 0.08, 0.3, 0.4, 0.25);
  },
  /** Solar power coming up: a sine rising through two octaves, its harmonics swelling, then a bright arpeggio. */
  "solar-rise": (c) => {
    tone(c, "sine", 220, 880, 0.3, 0.16, 1.7, 0, 1.6);
    tone(c, "triangle", 440, 1760, 0.4, 0.05, 1.7, 0, 1.6);
    chime(c, [79, 83, 86, 91], 0.07, 0.16, 1.5);
  },
  /** The call signal: a clean radio blip with a breath of static. */
  "call-blip": (c) => {
    tone(c, "sine", 1200, 1200, 0.003, 0.16, 0.09);
    burst(c, "white", "bandpass", 2000, 0.8, 0.002, 0.06, 0.08);
  },

  // ---- Chapter 4: Valinor Hills ----

  /** A hover hop: the rotor spins up in a rush, then a little springy lift. */
  "hover-hop": (c) => {
    const ctx = c.mx.ctx;
    const buzz = osc(ctx, "sawtooth", 40 * c.rate, c.at, c.at + 0.7);
    buzz.frequency.exponentialRampToValueAtTime(110 * c.rate, c.at + 0.4);
    const f = filter(ctx, "lowpass", 900);
    const g = gain(ctx);
    holdEnvelope(g.gain, c.at, 0.15, 0.12 * c.level, 0.3, 0.25);
    buzz.connect(f).connect(g).connect(c.out);
    tone(c, "sine", 330, 520, 0.004, 0.12, 0.2, 0.32, 0.15);
  },

  // ---- The trip between worlds ----

  /** Dad's toy rocket lifting off: a soft roar that swells and rumbles away, and a little whoosh on top. */
  "rocket-launch": (c) => {
    const roar = burst(c, "brown", "lowpass", 220, 0.7, 0.35, 0.5, 2.6);
    roar.frequency.exponentialRampToValueAtTime(520 * c.rate, c.at + 1.2);
    roar.frequency.exponentialRampToValueAtTime(160 * c.rate, c.at + 2.6);
    burst(c, "pink", "bandpass", 1400, 1.2, 0.5, 0.12, 1.6, 0.25);
    tone(c, "sine", 70, 46, 0.2, 0.18, 2.2);
  },

  /** The rocket rushing past the camera: a rising then falling swish of air, like a car going by, and a low hum under it. */
  "rocket-whoosh": (c) => {
    const swish = burst(c, "pink", "bandpass", 500, 1.4, 0.55, 0.42, 1.3);
    swish.frequency.exponentialRampToValueAtTime(1900 * c.rate, c.at + 0.55);
    swish.frequency.exponentialRampToValueAtTime(380 * c.rate, c.at + 1.3);
    tone(c, "triangle", 150, 92, 0.45, 0.07, 1.1, 0.05, 1.1);
  },

  /** The rocket settling down on its fins: a braking hiss and a soft bump. */
  "rocket-land": (c) => {
    burst(c, "pink", "bandpass", 900, 0.9, 0.2, 0.22, 1.1);
    burst(c, "brown", "lowpass", 260, 0.8, 0.005, 0.35, 0.3, 1.0);
    tone(c, "sine", 110, 60, 0.005, 0.25, 0.25, 1.0);
  },

  // ---- Finale ----

  /** The dish turning: a geared motor (a square through a bandpass, chopped like teeth on a gear) that ends with a clunk. */
  "dish-servo": (c) => {
    const ctx = c.mx.ctx;
    const m = osc(ctx, "square", 90 * c.rate, c.at, c.at + 1.3);
    m.frequency.linearRampToValueAtTime(120 * c.rate, c.at + 1.0);
    const f = filter(ctx, "bandpass", 600, 2);
    const chop = gain(ctx, 0.6);
    const teeth = osc(ctx, "square", 22, c.at, c.at + 1.3);
    const d = gain(ctx, 0.4);
    teeth.connect(d).connect(chop.gain);
    const g = gain(ctx);
    holdEnvelope(g.gain, c.at, 0.08, 0.1 * c.level, 1.0, 0.1);
    m.connect(f).connect(chop).connect(g).connect(c.out);
    burst(c, "brown", "lowpass", 300, 0.7, 0.002, 0.4, 0.1, 1.15);
  },
  /** The needle drops: a soft thump, a burst of crackle, then a low hum as the record turns. */
  "needle-drop": (c) => {
    burst(c, "brown", "lowpass", 200, 0.7, 0.002, 0.5, 0.1);
    burst(c, "white", "highpass", 3000, 0.7, 0.003, 0.12, 0.25, 0.04);
    tone(c, "sine", 60, 60, 0.2, 0.04, 1.2, 0.05);
  },

  // ---- Photos, emotes, friends ----

  /** Camera shutter: two clicks a moment apart (the mirror flips up and back) over a low thunk. */
  shutter: (c) => {
    burst(c, "white", "highpass", 2200, 0.7, 0.001, 0.4, 0.02);
    tone(c, "sine", 220, 110, 0.001, 0.2, 0.05);
    burst(c, "white", "highpass", 2600, 0.7, 0.001, 0.3, 0.02, 0.07);
  },
  /** The instant photo rolling out: a little motor whirr, then the print sliding free. */
  "polaroid-whirr": (c) => {
    const ctx = c.mx.ctx;
    const m = osc(ctx, "square", 118 * c.rate, c.at, c.at + 0.95);
    const f = filter(ctx, "bandpass", 900, 1.5);
    const g = gain(ctx);
    holdEnvelope(g.gain, c.at, 0.05, 0.05 * c.level, 0.7, 0.12);
    m.connect(f).connect(g).connect(c.out);
    const p = burst(c, "pink", "bandpass", 1600, 0.9, 0.03, 0.14, 0.2, 0.82);
    p.frequency.exponentialRampToValueAtTime(2600, c.at + 1.0);
  },
  /** An emote bubble pops up: a quick rising blip and a puff. */
  "emote-pop": (c) => {
    tone(c, "sine", 520, 980, 0.002, 0.2, 0.1, 0, 0.06);
    burst(c, "white", "bandpass", 3000, 1, 0.001, 0.05, 0.03);
  },
  /** A friend joins: the motif's first three notes, rising. */
  "join-chime": (c) => {
    chime(c, [79, 83, 86], 0.1, 0.2);
  },
  /** A friend leaves: two notes stepping down, gently. */
  "leave-chime": (c) => {
    chime(c, [86, 79], 0.14, 0.16);
  },
  /** A discovery: the whole motif played fast and bright on the music box, an octave up. */
  discovery: (c) => {
    for (const e of motifEvents(undefined, { octave: 1, stretch: 0.22 })) {
      musicBox(c.mx, c.out, midiToHz(e.note) * c.rate, c.at + e.beat, 0.16 * c.level, e.beats > 0.5 ? 1.8 : 1);
    }
  },
};

/** Sounds that keep going: machines, wind and hiss. Each has one control from 0 to 1. */
export const LOOPS: Record<string, LoopRecipe> = {
  /**
   * Dad's lamp: a 60 Hz mains hum with a soft second harmonic, through a
   * lowpass. `value` is the brightness.
   */
  "lamp-hum": (mx, out, value) => {
    const ctx = mx.ctx;
    const g = gain(ctx, 0);
    const f = filter(ctx, "lowpass", 400);
    const a = osc(ctx, "sine", 60, mx.now, Infinity);
    const b = osc(ctx, "triangle", 120.4, mx.now, Infinity);
    const bg = gain(ctx, 0.3);
    a.connect(f);
    b.connect(bg).connect(f);
    f.connect(g).connect(out);
    const set = (v: number): void => void g.gain.setTargetAtTime(v * 0.05, mx.now, 0.4);
    set(value);
    return {
      set,
      stop: () => {
        g.gain.setTargetAtTime(0, mx.now, 0.2);
        a.stop(mx.now + 1);
        b.stop(mx.now + 1);
      },
    };
  },
  /** The rover's electric motor: a sawtooth whine through a bandpass; `value` is speed. */
  "motor-whine": (mx, out, value) => machine(mx, out, value, "sawtooth", 160, 620, 1200, 0.05),
  /** The rock grinder: a low saw buzz with gritty noise chopped fast. `value` is pressure. */
  grinder: (mx, out, value) => {
    const handle = machine(mx, out, value, "sawtooth", 120, 170, 900, 0.05);
    const ctx = mx.ctx;
    const grit = new Loop(mx, mx.noise("white"), out, 0);
    const f = filter(ctx, "bandpass", 2200, 1.2);
    grit.out.disconnect();
    grit.out.connect(f).connect(out);
    const set = (v: number): void => {
      handle.set(v);
      grit.setLevel(v * 0.05, 0.2);
    };
    set(value);
    return {
      set,
      stop: () => {
        handle.stop();
        grit.stop(0.3);
      },
    };
  },
  /** The rotor: a buzz at the blade-pass rate with a breath of air; `value` is spin speed, pitch and loudness rise with it. */
  rotor: (mx, out, value) => {
    const handle = machine(mx, out, value, "sawtooth", 30, 140, 700, 0.07);
    const air = new Loop(mx, mx.noise("pink"), out, 0);
    const set = (v: number): void => {
      handle.set(v);
      air.setLevel(v * 0.04, 0.2);
    };
    set(value);
    return {
      set,
      stop: () => {
        handle.stop();
        air.stop(0.3);
      },
    };
  },
  /** A dust devil: wind through a bandpass that swirls up and down. `value` is strength. */
  "dust-devil": (mx, out, value) => {
    const ctx = mx.ctx;
    const src = new Loop(mx, mx.noise("pink"), out, 0);
    src.out.disconnect();
    const f = filter(ctx, "bandpass", 700, 1.8);
    const lfo = osc(ctx, "sine", 0.6, mx.now, Infinity);
    const d = gain(ctx, 450);
    lfo.connect(d).connect(f.frequency);
    const g = gain(ctx, 0);
    src.out.connect(f).connect(g).connect(out);
    src.setLevel(1, 0.01);
    const set = (v: number): void => void g.gain.setTargetAtTime(v * 0.3, mx.now, 0.3);
    set(value);
    return {
      set,
      stop: () => {
        g.gain.setTargetAtTime(0, mx.now, 0.3);
        src.stop(1.2);
        lfo.stop(mx.now + 1.5);
      },
    };
  },
  /** Radio hiss between stations. `value` is loudness. */
  "radio-hiss": (mx, out, value) => bed(mx, out, radioHiss(), value),
  /** A record turning: the crackle bed. `value` is loudness. */
  "record-crackle": (mx, out, value) => bed(mx, out, crackle(4), value),
};

function bed(mx: Mixer, out: AudioNode, buffer: AudioBuffer, value: number): LoopHandle {
  const loop = new Loop(mx, buffer, out, 0);
  loop.setLevel(value, 0.3);
  return { set: (v) => loop.setLevel(v, 0.3), stop: () => loop.stop(0.5) };
}

/** A motor: an oscillator whose pitch and loudness follow `value`, through a bandpass. */
function machine(mx: Mixer, out: AudioNode, value: number, type: OscillatorType, lowHz: number, highHz: number, band: number, level: number): LoopHandle {
  const ctx = mx.ctx;
  const o = osc(ctx, type, lowHz, mx.now, Infinity);
  const f = filter(ctx, "bandpass", band, 1.1);
  const g = gain(ctx, 0);
  o.connect(f).connect(g).connect(out);
  const set = (v: number): void => {
    const k = Math.max(0, Math.min(1, v));
    o.frequency.setTargetAtTime(lowHz + (highHz - lowHz) * k, mx.now, 0.15);
    g.gain.setTargetAtTime(k > 0.01 ? level * (0.3 + 0.7 * k) : 0, mx.now, 0.12);
  };
  set(value);
  return {
    set,
    stop: () => {
      g.gain.setTargetAtTime(0, mx.now, 0.15);
      o.stop(mx.now + 1);
    },
  };
}
