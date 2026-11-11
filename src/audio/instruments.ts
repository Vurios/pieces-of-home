import type { Mixer } from "./mixer";

/**
 * The instruments, all synthesized. Each one-shot schedules its own nodes at
 * time `at` and lets them stop themselves; envelopes always start and end at
 * silence, so nothing clicks.
 */

/** Attack to `peak`, then an exponential fall to silence by `end`. */
export function pluckEnvelope(param: AudioParam, at: number, attack: number, peak: number, end: number): void {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.exponentialRampToValueAtTime(0.0001, Math.max(at + attack + 0.01, end));
  param.setValueAtTime(0, end + 0.01);
}

/** Attack, hold, release: for notes with a length. */
export function holdEnvelope(param: AudioParam, at: number, attack: number, peak: number, hold: number, release: number): void {
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.setValueAtTime(peak, at + Math.max(attack, hold));
  param.linearRampToValueAtTime(0, at + Math.max(attack, hold) + release);
}

export function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, at: number, stop: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  o.start(at);
  // Infinity means "until stopped by hand".
  if (Number.isFinite(stop)) o.stop(stop);
  return o;
}

export function gain(ctx: BaseAudioContext, value = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

export function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** A slice of cached noise, starting at a random spot so repeats never line up. */
export function noise(mx: Mixer, kind: "white" | "pink" | "brown", at: number, length: number): AudioBufferSourceNode {
  const source = mx.ctx.createBufferSource();
  source.buffer = mx.noise(kind);
  source.loop = true;
  source.start(at, Math.random() * 1.5);
  source.stop(at + length + 0.05);
  return source;
}

/**
 * Music box: an FM bell. A sine carrier with a harmonic modulator whose depth
 * falls fast, so the note starts bright like a struck tine and settles into a
 * pure, soft tail.
 */
export function musicBox(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, length = 2.2): void {
  const ctx = mx.ctx;
  const end = at + length;
  const amp = gain(ctx);
  pluckEnvelope(amp.gain, at, 0.003, level, end);
  const carrier = osc(ctx, "sine", hz, at, end + 0.05);
  const mod = osc(ctx, "sine", hz * 4, at, end + 0.05);
  const depth = gain(ctx);
  depth.gain.setValueAtTime(hz * 1.3, at);
  depth.gain.exponentialRampToValueAtTime(hz * 0.04, at + 0.35);
  mod.connect(depth).connect(carrier.frequency);
  carrier.connect(amp);
  // The tine's second partial, gone in half a second.
  const second = osc(ctx, "sine", hz * 2, at, at + 0.6);
  const sg = gain(ctx);
  pluckEnvelope(sg.gain, at, 0.002, level * 0.16, at + 0.5);
  second.connect(sg).connect(out);
  amp.connect(out);
}

/**
 * Glass bell, for the Moon: FM with an inharmonic ratio (about 1.41), a slow
 * attack and a very long ring, like a wet finger round a glass rim.
 */
export function glassBell(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, length = 4.5): void {
  const ctx = mx.ctx;
  const end = at + length;
  const amp = gain(ctx);
  pluckEnvelope(amp.gain, at, 0.012, level, end);
  const carrier = osc(ctx, "sine", hz, at, end + 0.05);
  const mod = osc(ctx, "sine", hz * 1.414, at, end + 0.05);
  const depth = gain(ctx);
  depth.gain.setValueAtTime(hz * 0.8, at);
  depth.gain.exponentialRampToValueAtTime(hz * 0.05, at + 1.8);
  mod.connect(depth).connect(carrier.frequency);
  const shimmer = osc(ctx, "sine", hz * 2.76, at, at + 1.2);
  const sg = gain(ctx);
  pluckEnvelope(sg.gain, at, 0.004, level * 0.12, at + 1.1);
  shimmer.connect(sg).connect(out);
  carrier.connect(amp).connect(out);
}

/**
 * Felt piano: a triangle and a soft octave through a lowpass that closes
 * after the hammer, plus a tiny low thump of felt on string.
 */
export function feltPiano(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, length = 2.4): void {
  const ctx = mx.ctx;
  const end = at + length;
  const tone = filter(ctx, "lowpass", Math.min(hz * 6, 5200), 0.6);
  tone.frequency.setValueAtTime(Math.min(hz * 6, 5200), at);
  tone.frequency.exponentialRampToValueAtTime(Math.max(120, hz * 1.4), at + 0.7);
  const amp = gain(ctx);
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(level, at + 0.005);
  amp.gain.exponentialRampToValueAtTime(level * 0.3, at + 0.32);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  amp.gain.setValueAtTime(0, end + 0.01);
  const a = osc(ctx, "triangle", hz, at, end + 0.05);
  const b = osc(ctx, "sine", hz * 2.001, at, end + 0.05);
  const bg = gain(ctx, 0.18);
  a.connect(tone);
  b.connect(bg).connect(tone);
  tone.connect(amp).connect(out);
  // The felt: 40 ms of low noise.
  const thump = noise(mx, "brown", at, 0.06);
  const tf = filter(ctx, "lowpass", 280);
  const tg = gain(ctx);
  pluckEnvelope(tg.gain, at, 0.002, level * 0.35, at + 0.05);
  thump.connect(tf).connect(tg).connect(out);
}

/** Pluck: a sawtooth through a resonant lowpass that snaps shut, like a muted string. */
export function pluck(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, length = 0.7): void {
  const ctx = mx.ctx;
  const end = at + length;
  const f = filter(ctx, "lowpass", hz * 7, 2.2);
  f.frequency.setValueAtTime(Math.min(hz * 7, 9000), at);
  f.frequency.exponentialRampToValueAtTime(Math.max(100, hz * 1.2), at + 0.14);
  const amp = gain(ctx);
  pluckEnvelope(amp.gain, at, 0.002, level, end);
  osc(ctx, "sawtooth", hz, at, end + 0.05).connect(f).connect(amp).connect(out);
}

/** Flute-like counter-melody: a sine with a breath of noise and a vibrato that arrives late. */
export function flute(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, hold: number): void {
  const ctx = mx.ctx;
  const release = 0.35;
  const end = at + hold + release;
  const amp = gain(ctx);
  holdEnvelope(amp.gain, at, 0.12, level, hold, release);
  const body = osc(ctx, "sine", hz, at, end + 0.05);
  const edge = osc(ctx, "triangle", hz, at, end + 0.05);
  const eg = gain(ctx, 0.22);
  const vib = osc(ctx, "sine", 5.1, at, end + 0.05);
  const vd = gain(ctx);
  vd.gain.setValueAtTime(0, at);
  vd.gain.linearRampToValueAtTime(hz * 0.006, at + Math.min(hold, 0.6));
  vib.connect(vd);
  vd.connect(body.frequency);
  vd.connect(edge.frequency);
  body.connect(amp);
  edge.connect(eg).connect(amp);
  const breath = noise(mx, "white", at, hold + release);
  const bf = filter(ctx, "bandpass", hz * 2, 2.5);
  const bg = gain(ctx);
  holdEnvelope(bg.gain, at, 0.06, level * 0.06, hold * 0.5, release);
  breath.connect(bf).connect(bg).connect(out);
  amp.connect(out);
}

/** Soft sub bass: a sine that swells in and out. */
export function sub(mx: Mixer, out: AudioNode, hz: number, at: number, level: number, hold: number): void {
  const ctx = mx.ctx;
  const amp = gain(ctx);
  holdEnvelope(amp.gain, at, 0.25, level, hold, 0.7);
  osc(ctx, "sine", hz, at, at + hold + 0.8).connect(amp).connect(out);
}

/** A brush on a snare: bandpassed noise, a tap or a longer sweep. */
export function brush(mx: Mixer, out: AudioNode, at: number, level: number, sweep = false): void {
  const ctx = mx.ctx;
  const length = sweep ? 0.26 : 0.07;
  const f = filter(ctx, "bandpass", sweep ? 3800 : 5200, 0.8);
  const amp = gain(ctx);
  if (sweep) holdEnvelope(amp.gain, at, 0.08, level, 0.08, 0.16);
  else pluckEnvelope(amp.gain, at, 0.003, level, at + length);
  noise(mx, "white", at, length + 0.05).connect(f).connect(amp).connect(out);
}

/**
 * The warm pad: detuned sawtooth pairs (one per voice on Low) through a
 * lowpass that drifts slowly. It stays on and glides to each new chord.
 */
export class Pad {
  readonly out: GainNode;
  private voices: OscillatorNode[][] = [];
  private filterNode: BiquadFilterNode;
  private lfo: OscillatorNode;

  constructor(
    private mx: Mixer,
    destination: AudioNode,
    count: number,
    rich: boolean,
    cutoff = 900,
  ) {
    const ctx = mx.ctx;
    this.out = gain(ctx, 0);
    this.filterNode = filter(ctx, "lowpass", cutoff, 0.5);
    this.filterNode.connect(this.out).connect(destination);
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.07;
    const depth = gain(ctx, cutoff * 0.25);
    this.lfo.connect(depth).connect(this.filterNode.frequency);
    this.lfo.start();
    const each = gain(ctx, 0.5 / count);
    each.connect(this.filterNode);
    for (let v = 0; v < count; v += 1) {
      const pair: OscillatorNode[] = [];
      for (const cents of rich ? [-7, 7] : [0]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = 196;
        o.detune.value = cents + (v - count / 2) * 1.5;
        o.connect(each);
        o.start();
        pair.push(o);
      }
      this.voices.push(pair);
    }
  }

  setChord(notes: readonly number[], at: number, glide = 0.5): void {
    this.voices.forEach((pair, i) => {
      const note = notes[i % notes.length]! + (i >= notes.length ? 12 : 0);
      const hz = 440 * 2 ** ((note - 69) / 12);
      for (const o of pair) o.frequency.setTargetAtTime(hz, at, glide / 3);
    });
  }

  setLevel(level: number, seconds = 2): void {
    this.out.gain.setTargetAtTime(level, this.mx.now, Math.max(0.01, seconds / 3));
  }

  setCutoff(hz: number, seconds = 2): void {
    this.filterNode.frequency.setTargetAtTime(hz, this.mx.now, seconds / 3);
  }

  stop(): void {
    const at = this.mx.now;
    this.out.gain.setTargetAtTime(0, at, 0.2);
    for (const pair of this.voices) for (const o of pair) o.stop(at + 1.5);
    this.lfo.stop(at + 1.5);
  }
}

/** A looping buffer with its own level, for crackle, ambience and machine hums. */
export class Loop {
  readonly out: GainNode;
  private source: AudioBufferSourceNode;

  constructor(
    private mx: Mixer,
    buffer: AudioBuffer,
    destination: AudioNode,
    level = 0,
    rate = 1,
  ) {
    this.out = gain(mx.ctx, level);
    this.source = mx.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.playbackRate.value = rate;
    this.source.connect(this.out).connect(destination);
    this.source.start(mx.now, Math.random() * buffer.duration);
  }

  setLevel(level: number, seconds = 1): void {
    this.out.gain.setTargetAtTime(level, this.mx.now, Math.max(0.01, seconds / 3));
  }

  setRate(rate: number, seconds = 0.3): void {
    this.source.playbackRate.setTargetAtTime(rate, this.mx.now, Math.max(0.01, seconds / 3));
  }

  stop(seconds = 0.6): void {
    const at = this.mx.now;
    this.out.gain.setTargetAtTime(0, at, seconds / 3);
    this.source.stop(at + seconds * 2);
  }
}
