/**
 * The mixer: one AudioContext, six buses, a gentle compressor and a limiter,
 * a room (convolution reverb on Medium and High, a soft echo on Low), voice
 * ducking and the notebook muffle.
 *
 *   music ──► duck ──────────────┐
 *   ambience ─► world muffle ────┤
 *   effects ──► world muffle ────┼──► master ─► compressor ─► limiter ─► speakers
 *   voices ──────────────────────┤
 *   ui ──────────────────────────┘
 *   (music, effects and voices also send a little to the room)
 */
export type Bus = "master" | "music" | "ambience" | "effects" | "voices" | "ui";
export const BUSES: Bus[] = ["master", "music", "ambience", "effects", "voices", "ui"];
export type AudioTier = "low" | "medium" | "high";

export const DEFAULT_VOLUMES: Record<Bus, number> = { master: 0.55, music: 0.5, ambience: 0.6, effects: 0.75, voices: 0.8, ui: 0.65 };

/** How much of each bus goes to the room. */
const SENDS: Partial<Record<Bus, number>> = { music: 0.32, effects: 0.12, voices: 0.06, ambience: 0.05 };

import type { SampleBank } from "./samples";

export class Mixer {
  readonly ctx: AudioContext;
  tier: AudioTier = "high";
  /** Where cues and instruments connect, one per bus (master excluded). */
  private inputs = new Map<Bus, GainNode>();
  private faders = new Map<Bus, GainNode>();
  private volumes: Record<Bus, number> = { ...DEFAULT_VOLUMES };
  private duckGain: GainNode;
  private muffleFilter: BiquadFilterNode;
  private roomIn: GainNode;
  private roomOut: GainNode;
  private room: ConvolverNode | null = null;
  private echo: DelayNode | null = null;
  private echoNodes: AudioNode[] = [];
  private noises = new Map<string, AudioBuffer>();
  private spaceAmount = 1;
  /** Everything ends here before the speakers; the audio lab records from it. */
  readonly out: GainNode;
  /** Recorded notes and takes, once loaded (see samples.ts). Instruments use them when they can. */
  samples: SampleBank | null = null;

  constructor(ctx: AudioContext, tier: AudioTier = "high") {
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.out = ctx.createGain();
    compressor.connect(limiter).connect(this.out).connect(ctx.destination);

    const master = ctx.createGain();
    master.connect(compressor);
    this.faders.set("master", master);

    this.duckGain = ctx.createGain();
    this.duckGain.connect(master);
    this.muffleFilter = ctx.createBiquadFilter();
    this.muffleFilter.type = "lowpass";
    this.muffleFilter.frequency.value = 20000;
    this.muffleFilter.Q.value = 0.5;
    this.muffleFilter.connect(master);

    this.roomIn = ctx.createGain();
    this.roomOut = ctx.createGain();
    this.roomOut.connect(master);

    for (const bus of BUSES) {
      if (bus === "master") continue;
      const input = ctx.createGain();
      const fader = ctx.createGain();
      input.connect(fader);
      const target = bus === "music" ? this.duckGain : bus === "ambience" || bus === "effects" ? this.muffleFilter : master;
      fader.connect(target);
      const send = SENDS[bus];
      if (send) {
        const s = ctx.createGain();
        s.gain.value = send;
        fader.connect(s).connect(this.roomIn);
      }
      this.inputs.set(bus, input);
      this.faders.set(bus, fader);
    }
    this.setTier(tier);
    for (const bus of BUSES) this.apply(bus, true);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  input(bus: Exclude<Bus, "master">): GainNode {
    return this.inputs.get(bus)!;
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = Math.max(0, Math.min(1, value));
    this.apply(bus, false);
  }

  getVolume(bus: Bus): number {
    return this.volumes[bus];
  }

  private apply(bus: Bus, instant: boolean): void {
    const fader = this.faders.get(bus);
    if (!fader) return;
    // A squared curve feels even across the slider: half way sounds about half as loud.
    const v = this.volumes[bus] ** 2 * (bus === "master" ? 1.1 : 1);
    if (instant) fader.gain.value = v;
    else {
      // Holds wherever a fade-in has got to, then moves on from there.
      if (fader.gain.cancelAndHoldAtTime) fader.gain.cancelAndHoldAtTime(this.now);
      fader.gain.setTargetAtTime(v, this.now, 0.05);
    }
  }

  /** The first sound of a visit rises gently from silence instead of starting at full volume. */
  fadeIn(seconds: number): void {
    const g = this.faders.get("master")!.gain;
    const v = this.volumes.master ** 2 * 1.1;
    g.cancelScheduledValues(this.now);
    g.setValueAtTime(0.0001, this.now);
    g.linearRampToValueAtTime(v, this.now + seconds);
  }

  /**
   * Low: a soft echo instead of the room, and the emitters fall back to simple
   * panning (see the director). Medium and High: a synthesized room.
   */
  setTier(tier: AudioTier): void {
    this.tier = tier;
    this.roomIn.disconnect();
    for (const node of this.echoNodes) node.disconnect();
    this.echoNodes = [];
    if (tier === "low") {
      this.room = null;
      const echo = this.ctx.createDelay(1);
      echo.delayTime.value = 0.29;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.22;
      const tone = this.ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2200;
      this.roomIn.connect(echo);
      echo.connect(tone).connect(feedback).connect(echo);
      tone.connect(this.roomOut);
      this.echo = echo;
      this.echoNodes = [echo, feedback, tone];
      this.roomOut.gain.value = 0.5 * this.spaceAmount;
      return;
    }
    this.echo = null;
    if (!this.room) {
      this.room = this.ctx.createConvolver();
      this.room.buffer = this.impulse(2.6, 2.4);
    }
    this.roomIn.connect(this.room).connect(this.roomOut);
    this.roomOut.gain.value = 0.9 * this.spaceAmount;
  }

  /** How big the space sounds: 1 is a cosy room, 2 is the Moon's long air. */
  setSpace(amount: number, seconds = 2): void {
    this.spaceAmount = amount;
    const base = this.tier === "low" ? 0.5 : 0.9;
    this.roomOut.gain.setTargetAtTime(base * amount, this.now, seconds / 3);
  }

  /** A stereo room made from noise that fades away, darker at the tail. */
  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const length = Math.round(rate * seconds);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        // Simple one-pole lowpass that closes over time, so the tail is warm.
        const k = 0.75 - 0.6 * t;
        low += (Math.random() * 2 - 1 - low) * k;
        const early = i < rate * 0.012 ? 0 : 1;
        data[i] = low * (1 - t) ** decay * early * 0.6;
      }
    }
    return buffer;
  }

  /** Voices push the music down by about 5 dB, and let it back up after `hold` seconds of quiet. */
  duck(hold = 0.35): void {
    const g = this.duckGain.gain;
    const now = this.now;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(0.56, now, 0.04);
    g.setTargetAtTime(1, now + hold, 0.35);
  }

  /** The notebook is open: the world slowly goes soft behind the page. */
  muffle(on: boolean): void {
    this.muffleFilter.frequency.setTargetAtTime(on ? 620 : 20000, this.now, on ? 0.28 : 0.2);
    this.duckGain.gain.setTargetAtTime(on ? 0.8 : 1, this.now, 0.4);
  }

  /** Cached noise. "white", "pink" or "brown", two seconds, mono. */
  noise(kind: "white" | "pink" | "brown" = "white"): AudioBuffer {
    const cached = this.noises.get(kind);
    if (cached) return cached;
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * 2, rate);
    fillNoise(buffer.getChannelData(0), kind);
    this.noises.set(kind, buffer);
    return buffer;
  }
}

/** Fills an array with white, pink (Paul Kellet's filter) or brown noise, peaking near 1. */
export function fillNoise(data: Float32Array, kind: "white" | "pink" | "brown"): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") data[i] = white * 0.7;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
}
