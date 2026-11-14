import { crackle, dustHiss, wind } from "./buffers";
import { brush, feltPiano, flute, gain, glassBell, kalimba, Loop, musicBox, osc, Pad, pluck, sub } from "./instruments";
import type { Mixer } from "./mixer";
import { ANSWER, MOTIF, PENTATONIC, midiToHz, motifEvents } from "./motif";
import { nearestChordTone, walkPhrase } from "./theory";

/**
 * The score: generative, adaptive music built on the motif.
 *
 * A look-ahead clock schedules notes a fraction of a second early on the
 * audio clock, so timing stays tight even when the page is busy. Changes of
 * world, tempo and harmony wait for the next bar line; layers fade with slow
 * curves, so nothing clicks or jumps.
 *
 * Layers: pad, bass, felt piano, lead (the motif and little phrases), a pulse
 * for focus, three friend layers (bells, then plucks, then a counter-melody),
 * vinyl crackle, Mars dust and Moon air, and the single held tone of the Long
 * Storm.
 */
export type Scene = "silent" | "title" | "home" | "moon" | "mars" | "finale";
export type StormStage = "thin" | "silence" | "return" | null;

interface Chord {
  root: number;
  pad: number[];
}

interface Arrangement {
  bpm: number;
  progression: Chord[];
  barsPerChord: number;
  pad: number;
  cutoff: number;
  bass: number;
  /** Chance of a felt-piano note on each beat. */
  piano: number;
  lead: "box" | "glass" | "piano" | "pluck";
  leadLevel: number;
  /** Bars between motif statements. */
  motifEvery: number;
  /** Bars between little improvised phrases (0 for none). */
  phraseEvery: number;
  /** Slower motif on spacious worlds. */
  stretch: number;
  crackle: number;
  dust: number;
  air: number;
  /** Room size (see Mixer.setSpace). */
  space: number;
  /** A little bouncing kalimba figure on chord tones, for a playful, cute lift (0 for none). */
  bounce: number;
}

const GMAJ7: Chord = { root: 43, pad: [55, 59, 62, 66] };
const EM7: Chord = { root: 40, pad: [55, 59, 62, 64] };
const CMAJ7: Chord = { root: 36, pad: [55, 59, 60, 64] };
const D9: Chord = { root: 38, pad: [54, 57, 60, 64] };

export const ARRANGEMENTS: Record<Exclude<Scene, "silent">, Arrangement> = {
  // Title: the pad breathes between two chords while the music box remembers the motif.
  title: { bpm: 72, progression: [GMAJ7, CMAJ7], barsPerChord: 2, pad: 0.4, cutoff: 1100, bass: 0, piano: 0.22, lead: "box", leadLevel: 0.17, motifEvery: 4, phraseEvery: 0, stretch: 1, crackle: 0.25, dust: 0, air: 0, space: 1.1, bounce: 0.045 },
  // Home: warm major sevenths, cosy, with a little kalimba bouncing along.
  home: { bpm: 80, progression: [GMAJ7, EM7, CMAJ7, D9], barsPerChord: 2, pad: 0.36, cutoff: 1300, bass: 0.13, piano: 0.4, lead: "box", leadLevel: 0.16, motifEvery: 8, phraseEvery: 4, stretch: 1, crackle: 0.18, dust: 0, air: 0, space: 1, bounce: 0.055 },
  // Moon: sparse glassy bells, long gaps, lots of air, no bass.
  moon: {
    bpm: 58,
    progression: [
      { root: 0, pad: [62, 67, 71, 76] },
      { root: 0, pad: [64, 67, 71, 74] },
      { root: 0, pad: [60, 67, 71, 76] },
      { root: 0, pad: [62, 66, 69, 76] },
    ],
    barsPerChord: 4,
    pad: 0.12,
    cutoff: 2400,
    bass: 0,
    piano: 0,
    lead: "glass",
    leadLevel: 0.14,
    motifEvery: 8,
    phraseEvery: 2,
    stretch: 2,
    crackle: 0.08,
    dust: 0,
    air: 0.45,
    space: 2,
    bounce: 0.03,
  },
  // Mars: low warm pads, pentatonic phrases, filtered dust.
  mars: {
    bpm: 74,
    progression: [
      { root: 40, pad: [52, 55, 59, 66] },
      { root: 36, pad: [52, 55, 59, 62] },
      { root: 43, pad: [50, 55, 59, 64] },
      { root: 38, pad: [50, 55, 57, 62] },
    ],
    barsPerChord: 2,
    pad: 0.42,
    cutoff: 880,
    bass: 0.15,
    piano: 0.2,
    lead: "pluck",
    leadLevel: 0.14,
    motifEvery: 8,
    phraseEvery: 2,
    stretch: 1,
    crackle: 0.12,
    dust: 0.42,
    air: 0,
    space: 1.2,
    bounce: 0.05,
  },
  // Finale: the whole theme, building as the dish turns.
  finale: { bpm: 78, progression: [GMAJ7, EM7, CMAJ7, D9], barsPerChord: 2, pad: 0.46, cutoff: 1300, bass: 0.18, piano: 0.5, lead: "box", leadLevel: 0.18, motifEvery: 4, phraseEvery: 0, stretch: 1, crackle: 0.18, dust: 0, air: 0, space: 1.3, bounce: 0.04 },
};

type Layer = "pad" | "bass" | "piano" | "lead" | "pulse" | "bells" | "plucks" | "counter" | "sting" | "held" | "bounce";

/**
 * The kalimba's little figure over one bar: which beat (in eighths) and which
 * chord tone, by index. A hop on one, a skip before three, a lift at the end.
 */
const BOUNCE: [number, number][] = [
  [0, 0],
  [3, 2],
  [4, 1],
  [6, 3],
  [7, 2],
];
const LOOKAHEAD = 0.18;

export class Score {
  scene: Scene = "silent";
  focus = false;
  friends = 0;
  stormStage: StormStage = null;
  /** 0 to 1: how far the Finale has built. */
  build = 0;

  private arr: Arrangement = ARRANGEMENTS.home;
  private pending: Scene | null = null;
  private pendingStorm: StormStage | undefined;
  private wantStatement = false;
  private stingAt = -1;
  private layers = new Map<Layer, GainNode>();
  private pad: Pad;
  private crackle: Loop;
  private dust: Loop | null = null;
  private air: Loop | null = null;
  private held: { stop(): void; out: GainNode } | null = null;
  private timer = 0;
  private nextBeat = 0;
  private beatIndex = 0;
  private chord: Chord = GMAJ7;
  private statements = 0;
  private counterNote = 71;
  private friendFade = [0, 0, 0];

  constructor(
    private mx: Mixer,
    crackleBed?: AudioBuffer,
  ) {
    const out = mx.input("music");
    for (const name of ["pad", "bass", "piano", "lead", "pulse", "bells", "plucks", "counter", "sting", "held", "bounce"] as Layer[]) {
      const g = gain(mx.ctx, name === "sting" || name === "held" ? 1 : 0);
      g.connect(out);
      this.layers.set(name, g);
    }
    const low = mx.tier === "low";
    this.pad = new Pad(mx, this.layer("pad"), low ? 3 : 4, !low);
    this.pad.setLevel(1, 0.01);
    this.crackle = new Loop(mx, crackleBed ?? crackle(5), out, 0);
  }

  /** Mars dust and Moon air are made the first time a world needs them. */
  private bed(name: "dust" | "air", level: number, seconds: number): void {
    let loop = this[name];
    if (!loop && level <= 0) return;
    if (!loop) {
      const buffer = name === "dust" ? wind(8, 250, 700, 0.07) : dustHiss(6, 0.02);
      loop = new Loop(this.mx, buffer, this.mx.input("music"), 0);
      this[name] = loop;
    }
    loop.setLevel(level, seconds);
  }

  private layer(name: Layer): GainNode {
    return this.layers.get(name)!;
  }

  private fade(name: Layer, level: number, seconds = 2): void {
    this.layer(name).gain.setTargetAtTime(level, this.mx.now, Math.max(0.01, seconds / 3));
  }

  /** Moves to a world's arrangement at the next bar line. "silent" fades everything out. */
  setScene(scene: Scene): void {
    if (scene === this.scene && this.pending === null) return;
    if (this.scene === "silent" && scene !== "silent") {
      this.scene = scene;
      this.arr = ARRANGEMENTS[scene];
      this.applyArrangement(4);
      this.startClock();
      return;
    }
    this.pending = scene;
  }

  setFocus(on: boolean): void {
    if (this.focus === on) return;
    this.focus = on;
    this.applyLevels(3);
  }

  /** One extra instrument per friend present: bells, then plucks, then a counter-melody. */
  setFriends(count: number): void {
    const next = Math.max(0, Math.min(3, Math.floor(count)));
    // A leaving friend's layer keeps playing while it fades out.
    for (let k = next; k < this.friends; k += 1) this.friendFade[k] = this.mx.now + 4;
    this.friends = next;
    this.applyLevels(2.5);
  }

  /** A short bright phrase on the next beat, for a discovery. */
  sting(): void {
    this.stingAt = this.nextBeat;
  }

  /** The Long Storm: "thin", then "silence", then "return" on Dad's note; null ends it. */
  storm(stage: StormStage): void {
    this.pendingStorm = stage;
    // Thinning starts at once; it is already slow.
    if (stage === "thin" || stage === "silence") this.applyStorm(stage);
  }

  /** The Finale's last statement of the theme, when Milo speaks, on the next bar. */
  statement(): void {
    this.wantStatement = true;
  }

  /** The title's letters: one motif note each, as they land. Not tied to the beat. */
  note(index: number): void {
    const base = MOTIF[index % MOTIF.length]!;
    const octave = Math.floor(index / MOTIF.length) % 2 === 1 ? -12 : 0;
    musicBox(this.mx, this.layer("sting"), midiToHz(base + octave), this.mx.now + 0.01, 0.2, 1.8);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.pad.stop();
    this.crackle.stop();
    this.dust?.stop();
    this.air?.stop();
    this.held?.stop();
  }

  private startClock(): void {
    this.nextBeat = this.mx.now + 0.1;
    this.beatIndex = 0;
    if (this.timer) return;
    this.timer = window.setInterval(this.tick, 25);
  }

  private tick = (): void => {
    const now = this.mx.now;
    // After a stall (a hidden tab, a slow frame) skip missed beats instead of playing them all at once.
    if (this.nextBeat < now - 0.2) this.nextBeat = now + 0.05;
    while (this.nextBeat < now + LOOKAHEAD) {
      this.beat(this.beatIndex, this.nextBeat);
      this.nextBeat += 60 / this.arr.bpm;
      this.beatIndex += 1;
    }
  };

  private get stormy(): boolean {
    return this.stormStage === "thin" || this.stormStage === "silence";
  }

  private applyArrangement(seconds: number): void {
    const a = this.arr;
    this.pad.setCutoff(a.cutoff, seconds);
    this.mx.setSpace(a.space, seconds);
    this.applyLevels(seconds);
  }

  private applyLevels(seconds: number): void {
    if (this.scene === "silent") {
      for (const name of ["pad", "bass", "piano", "lead", "pulse", "bells", "plucks", "counter", "bounce"] as Layer[]) this.fade(name, 0, seconds);
      this.crackle.setLevel(0, seconds);
      this.bed("dust", 0, seconds);
      this.bed("air", 0, seconds);
      return;
    }
    if (this.stormy) return;
    const a = this.arr;
    const thin = this.focus ? 0.62 : 1;
    const soft = this.stormStage === "return" ? 0.35 : 1;
    const lift = this.scene === "finale" ? 0.75 + 0.25 * this.build : 1;
    this.fade("pad", a.pad * thin * soft * lift, seconds);
    this.fade("bass", a.bass > 0 ? soft * lift : 0, seconds);
    this.fade("piano", soft * (this.focus ? 0.5 : 1), seconds);
    this.fade("lead", soft, seconds);
    this.fade("bounce", a.bounce > 0 && this.stormStage !== "return" ? (this.focus ? 0.55 : 1) : 0, seconds);
    this.fade("pulse", this.focus && !this.stormStage ? 1 : 0, seconds);
    this.fade("bells", this.friends >= 1 ? soft : 0, seconds * 1.6);
    this.fade("plucks", this.friends >= 2 ? soft : 0, seconds * 1.6);
    this.fade("counter", this.friends >= 3 || (this.scene === "finale" && this.build > 0.5) ? soft : 0, seconds * 1.6);
    this.crackle.setLevel(a.crackle * 0.5, seconds);
    this.bed("dust", a.dust, seconds);
    this.bed("air", this.mx.tier === "low" ? 0 : a.air, seconds);
  }

  private applyStorm(stage: StormStage): void {
    this.stormStage = stage;
    const now = this.mx.now;
    if (stage === "thin") {
      // Everything thins away over several seconds to one held tone and the crackle.
      for (const name of ["pad", "bass", "piano", "lead", "pulse", "bells", "plucks", "counter", "bounce"] as Layer[]) this.fade(name, 0, 6);
      this.bed("dust", 0, 6);
      this.bed("air", 0, 6);
      this.crackle.setLevel(0.3, 4);
      if (!this.held) {
        const out = gain(this.mx.ctx, 0);
        out.connect(this.layer("held"));
        const a = osc(this.mx.ctx, "sine", midiToHz(62), now, Infinity);
        const b = osc(this.mx.ctx, "triangle", midiToHz(74), now, Infinity);
        const bg = gain(this.mx.ctx, 0.08);
        const trem = osc(this.mx.ctx, "sine", 0.25, now, Infinity);
        const td = gain(this.mx.ctx, 0.015);
        trem.connect(td).connect(out.gain);
        a.connect(out);
        b.connect(bg).connect(out);
        out.gain.setTargetAtTime(0.07, now, 2);
        this.held = {
          out,
          stop: () => {
            out.gain.cancelScheduledValues(this.mx.now);
            out.gain.setTargetAtTime(0, this.mx.now, 0.8);
            for (const o of [a, b, trem]) o.stop(this.mx.now + 4);
          },
        };
      }
    } else if (stage === "silence") {
      // Then nothing at all, for the unanswered calls.
      this.held?.stop();
      this.held = null;
      this.crackle.setLevel(0, 3);
    } else {
      this.held?.stop();
      this.held = null;
      this.applyLevels(4);
    }
  }

  private beat(index: number, t: number): void {
    const a = this.arr;
    const beat = 60 / a.bpm;
    const inBar = index % 4;
    const bar = Math.floor(index / 4);
    if (inBar === 0) this.bar(bar, t);
    if (this.stingAt >= 0 && t >= this.stingAt - 0.001) {
      this.stingAt = -1;
      for (const e of motifEvents(undefined, { octave: 1, stretch: 0.25 })) {
        musicBox(this.mx, this.layer("sting"), midiToHz(e.note), t + e.beat * beat, 0.15, e.beats > 0.5 ? 2 : 1.1);
      }
    }
    if (this.scene === "silent" || this.stormy) return;
    const chord = this.chord;
    const low = this.mx.tier === "low";

    // Felt piano: a chord tone now and then, sometimes on the off-beat.
    if (a.piano > 0 && Math.random() < a.piano * (this.focus ? 0.4 : 1) * (low ? 0.7 : 1)) {
      const tone = chord.pad[Math.floor(Math.random() * chord.pad.length)]! + (Math.random() < 0.5 ? 12 : 0);
      const off = Math.random() < 0.3 ? beat * 0.5 : 0;
      const instrument = this.scene === "mars" ? pluck : feltPiano;
      instrument(this.mx, this.layer("piano"), midiToHz(tone), t + off, 0.09, this.scene === "mars" ? 0.9 : 2.2);
    }
    // The kalimba's bouncing figure, on chord tones up high. Every fourth bar rests, so it never nags.
    if (a.bounce > 0 && bar % 4 !== 3 && !(this.scene === "moon" && bar % 2 === 1)) {
      for (const [eighth, tone] of BOUNCE) {
        if (Math.floor(eighth / 2) !== inBar) continue;
        if (this.scene === "moon" && eighth % 2 === 1) continue;
        if (low && eighth % 2 === 1) continue;
        const note = chord.pad[tone % chord.pad.length]! + (this.scene === "moon" ? 24 : 12);
        kalimba(this.mx, this.layer("bounce"), midiToHz(note), t + (eighth % 2) * beat * 0.5, a.bounce * (eighth === 0 ? 1 : 0.78));
      }
    }
    // Focus: a soft pulse on the root and fifth, in eighths.
    if (this.focus) {
      const root = (chord.root || chord.pad[0]! - 12) + 24;
      feltPiano(this.mx, this.layer("pulse"), midiToHz(root), t, 0.05, 0.5);
      feltPiano(this.mx, this.layer("pulse"), midiToHz(root + 7), t + beat * 0.5, 0.035, 0.4);
    }
    // Friend one: bells on beats one and three.
    if (this.friendOn(0) && (inBar === 0 || inBar === 2)) {
      const tone = chord.pad[(bar + inBar) % chord.pad.length]! + 24;
      glassBell(this.mx, this.layer("bells"), midiToHz(tone), t, 0.06, 2.4);
    }
    // Friend two: plucked eighths on chord tones.
    if (this.friendOn(1)) {
      for (const half of [0, 0.5]) {
        if (Math.random() < 0.55) {
          const tone = chord.pad[Math.floor(Math.random() * chord.pad.length)]! + 12;
          pluck(this.mx, this.layer("plucks"), midiToHz(tone), t + half * beat, 0.05, 0.45);
        }
      }
    }
    // Friend three (and the Finale's second half): a slow counter-melody that moves by the smallest step to each new chord.
    if (this.friendOn(2) || (this.scene === "finale" && this.build > 0.5)) {
      if (inBar === 0 && bar % 2 === 0) {
        const third = chord.pad[1]! + 12;
        this.counterNote = nearestChordTone(this.counterNote + (Math.random() < 0.5 ? 2 : -2), [third, third + 4], 64, 81);
        flute(this.mx, this.layer("counter"), midiToHz(this.counterNote), t, 0.07, beat * 7);
      }
    }
    // The Finale gets brushes once it has built up.
    if (this.scene === "finale" && this.build > 0.3 && (inBar === 1 || inBar === 3)) {
      brush(this.mx, this.layer("piano"), t, 0.05 * this.build, inBar === 3);
    }
  }

  private friendOn(k: number): boolean {
    return this.friends > k || this.friendFade[k]! > this.mx.now;
  }

  private bar(bar: number, t: number): void {
    // World changes wait for the bar line.
    if (this.pending) {
      const next = this.pending;
      this.pending = null;
      this.scene = next;
      if (next !== "silent") {
        this.arr = ARRANGEMENTS[next];
        this.statements = 0;
        this.build = 0;
      }
      this.applyArrangement(3);
      if (next === "silent") return;
    }
    if (this.pendingStorm !== undefined) {
      const stage = this.pendingStorm;
      this.pendingStorm = undefined;
      if (stage === "return" || stage === null) {
        this.applyStorm(stage);
        if (stage === "return") this.playMotif(t, 0.09, 1.5, MOTIF, "box");
        return;
      }
    }
    if (this.scene === "silent" || this.stormy) return;
    const a = this.arr;
    const beat = 60 / a.bpm;
    if (this.scene === "finale" && bar > 0 && bar % 8 === 0 && this.build < 1) {
      this.build = Math.min(1, this.build + 0.25);
      this.applyLevels(4);
    }
    if (bar % a.barsPerChord === 0) {
      this.chord = a.progression[Math.floor(bar / a.barsPerChord) % a.progression.length]!;
      this.pad.setChord(this.chord.pad, t, 0.8);
      if (a.bass > 0 && this.chord.root > 0) sub(this.mx, this.layer("bass"), midiToHz(this.chord.root), t, a.bass, a.barsPerChord * 4 * beat - 0.6);
    }
    if (this.wantStatement) {
      this.wantStatement = false;
      this.playStatement(t);
      return;
    }
    if (bar % a.motifEvery === 0) {
      const n = this.statements++;
      const notes = n % 4 === 1 ? ANSWER : MOTIF;
      const level = this.focus ? a.leadLevel * 0.6 : a.leadLevel;
      this.playMotif(t, level, a.stretch, this.focus || n % 4 === 3 ? notes.slice(0, 3) : notes, a.lead, n % 4 === 2 ? 1 : 0);
    } else if (a.phraseEvery > 0 && bar % a.phraseEvery === 0 && bar % a.motifEvery > 1 && !this.focus) {
      if (Math.random() < (this.scene === "moon" ? 0.55 : 0.75)) this.playPhrase(t, beat);
    }
  }

  private playMotif(t: number, level: number, stretch: number, notes: readonly number[], lead: Arrangement["lead"], octave = 0): void {
    const beat = 60 / this.arr.bpm;
    const shift = lead === "glass" ? 1 : lead === "pluck" || lead === "piano" ? -1 : 0;
    for (const e of motifEvents(notes, { octave: octave + shift, stretch })) {
      this.leadNote(lead, midiToHz(e.note), t + e.beat * beat, level, Math.max(1.2, e.beats * beat * 1.4));
    }
  }

  private playPhrase(t: number, beat: number): void {
    const a = this.arr;
    const moon = this.scene === "moon";
    const length = moon ? 1 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
    const start = moon ? 76 : a.lead === "pluck" ? 64 : 71;
    const notes = walkPhrase(PENTATONIC, start, length, this.chord.pad, Math.random);
    let at = t + (Math.random() < 0.5 ? beat : 0);
    for (const note of notes) {
      this.leadNote(a.lead, midiToHz(note + (moon ? 12 : 0)), at, a.leadLevel * 0.8, moon ? 4 : 1.4);
      at += beat * (moon ? 1.5 + Math.random() * 1.5 : Math.random() < 0.6 ? 0.5 : 1);
    }
  }

  private leadNote(lead: Arrangement["lead"], hz: number, at: number, level: number, length: number): void {
    const out = this.layer("lead");
    if (lead === "glass") glassBell(this.mx, out, hz, at, level, Math.max(3, length));
    else if (lead === "piano") feltPiano(this.mx, out, hz, at, level, length);
    else if (lead === "pluck") pluck(this.mx, out, hz, at, level, Math.min(1.2, length));
    else musicBox(this.mx, out, hz, at, level, Math.max(1.4, length));
  }

  /** The full theme: the motif in octaves on box and piano with a flute, the pad opening wide. */
  private playStatement(t: number): void {
    const beat = 60 / this.arr.bpm;
    this.pad.setCutoff(1800, 4);
    this.fade("pad", this.arr.pad * 1.2, 3);
    for (const e of motifEvents(MOTIF, { stretch: 1.25 })) {
      const at = t + e.beat * beat;
      musicBox(this.mx, this.layer("sting"), midiToHz(e.note + 12), at, 0.14, 2.4);
      feltPiano(this.mx, this.layer("sting"), midiToHz(e.note), at, 0.1, 2.6);
      flute(this.mx, this.layer("sting"), midiToHz(e.note), at, 0.06, Math.max(0.3, e.beats * beat * 0.95));
    }
    sub(this.mx, this.layer("sting"), midiToHz(43), t, 0.16, beat * 10);
  }
}
