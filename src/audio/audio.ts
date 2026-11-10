/**
 * The audio controller, first version. Phase 03 needs a lamp click, a lamp
 * hum, the six title notes, voice blips and a quiet placeholder tune; Phase 04
 * grows this into the full mixer with ambience, footsteps and the real score.
 *
 * Everything is made in code with the Web Audio API. Nothing plays until the
 * player's first gesture unlocks the context ("Turn on the light").
 */
export type Bus = "master" | "music" | "ambience" | "effects" | "voices";
export const BUSES: Bus[] = ["master", "music", "ambience", "effects", "voices"];

/** Placeholder six-note motif (MIDI). Phase 04 writes the real one. */
export const MOTIF = [67, 71, 74, 76, 74, 79];

const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** Voices: base pitch and timbre per speaker, for gibberish blips. */
export const VOICES: Record<string, { pitch: number; wave: OscillatorType }> = {
  remi: { pitch: 72, wave: "triangle" },
  nori: { pitch: 76, wave: "square" },
  lumi: { pitch: 74, wave: "sine" },
  theo: { pitch: 69, wave: "triangle" },
  mom: { pitch: 64, wave: "sine" },
  dad: { pitch: 57, wave: "sine" },
  milo: { pitch: 84, wave: "square" },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses = new Map<Bus, GainNode>();
  private volumes: Record<Bus, number> = { master: 0.8, music: 0.6, ambience: 0.7, effects: 0.8, voices: 0.8 };
  private world: BiquadFilterNode | null = null;
  private echo: DelayNode | null = null;
  private hum: { gain: GainNode; stop(): void } | null = null;
  private click: AudioBuffer | null = null;
  private music: { stop(): void } | null = null;

  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  /**
   * Renders the lamp click ahead of time with an offline context. This needs
   * no gesture, so it runs while the page loads and counts toward progress.
   */
  async prepare(): Promise<void> {
    if (typeof OfflineAudioContext === "undefined") return;
    const rate = 44100;
    const offline = new OfflineAudioContext(1, Math.round(rate * 0.25), rate);
    // A switch click: a short noise tick and a low thunk.
    const noise = offline.createBuffer(1, Math.round(rate * 0.03), rate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    const tick = offline.createBufferSource();
    tick.buffer = noise;
    const tickFilter = offline.createBiquadFilter();
    tickFilter.type = "highpass";
    tickFilter.frequency.value = 1800;
    tick.connect(tickFilter).connect(offline.destination);
    tick.start(0);
    const thunk = offline.createOscillator();
    thunk.frequency.setValueAtTime(180, 0);
    thunk.frequency.exponentialRampToValueAtTime(60, 0.08);
    const thunkGain = offline.createGain();
    thunkGain.gain.setValueAtTime(0.5, 0);
    thunkGain.gain.exponentialRampToValueAtTime(0.001, 0.12);
    thunk.connect(thunkGain).connect(offline.destination);
    thunk.start(0.004);
    thunk.stop(0.2);
    this.click = await offline.startRendering();
  }

  /** Call from inside a user gesture. Safe to call again. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.build(this.ctx);
    }
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        // A browser may refuse; the game is fine without sound.
      }
    }
    // A gamepad press does not count as a gesture, so the browser may still say no.
    // Try again on the next click, tap or key.
    if (this.ctx.state !== "running" && !this.retrying) {
      this.retrying = true;
      const again = (): void => {
        window.removeEventListener("pointerdown", again);
        window.removeEventListener("keydown", again);
        this.retrying = false;
        void this.unlock();
      };
      window.addEventListener("pointerdown", again);
      window.addEventListener("keydown", again);
    }
  }
  private retrying = false;

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.connect(limiter);
    this.buses.set("master", master);
    // The world bus runs through a filter so the notebook can muffle it.
    this.world = ctx.createBiquadFilter();
    this.world.type = "lowpass";
    this.world.frequency.value = 20000;
    this.world.connect(master);
    for (const bus of ["music", "ambience", "effects", "voices"] as const) {
      const gain = ctx.createGain();
      gain.connect(bus === "ambience" || bus === "effects" ? this.world : master);
      this.buses.set(bus, gain);
    }
    // A soft echo for the music box.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(this.buses.get("music")!);
    for (const bus of BUSES) this.applyVolume(bus);
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = Math.max(0, Math.min(1, value));
    this.applyVolume(bus);
  }

  private applyVolume(bus: Bus): void {
    const node = this.buses.get(bus);
    if (node && this.ctx) node.gain.setTargetAtTime(this.volumes[bus], this.ctx.currentTime, 0.05);
  }

  /** Muffles the world (ambience and effects) while the notebook is open. */
  muffle(on: boolean): void {
    if (this.world && this.ctx) this.world.frequency.setTargetAtTime(on ? 700 : 20000, this.ctx.currentTime, 0.12);
  }

  lampClick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.click) return;
    const source = ctx.createBufferSource();
    source.buffer = this.click;
    source.playbackRate.value = 0.95 + Math.random() * 0.1;
    source.connect(this.buses.get("effects")!);
    source.start();
  }

  /** The lamp's warm hum, faded to `level` (0 stops it). */
  setHum(level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.hum && level > 0) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      const a = ctx.createOscillator();
      a.frequency.value = 60;
      const b = ctx.createOscillator();
      b.type = "triangle";
      b.frequency.value = 120.4;
      const bGain = ctx.createGain();
      bGain.gain.value = 0.3;
      a.connect(filter);
      b.connect(bGain).connect(filter);
      filter.connect(gain).connect(this.buses.get("ambience")!);
      a.start();
      b.start();
      this.hum = {
        gain,
        stop: () => {
          a.stop();
          b.stop();
        },
      };
    }
    this.hum?.gain.gain.setTargetAtTime(level * 0.05, ctx.currentTime, 0.4);
  }

  /** A music-box note. `index` walks the motif; higher indexes repeat it an octave down. */
  note(index: number, when = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const base = MOTIF[index % MOTIF.length]!;
    const octave = Math.floor(index / MOTIF.length) % 2 === 1 ? -12 : 0;
    this.tone(midiToHz(base + octave), ctx.currentTime + when, 1.6, 0.18, "music", true);
  }

  private tone(hz: number, at: number, length: number, level: number, bus: Bus, echo = false, wave: OscillatorType = "sine"): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, at);
    out.gain.linearRampToValueAtTime(level, at + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, at + length);
    out.connect(this.buses.get(bus)!);
    if (echo && this.echo) out.connect(this.echo);
    for (const [ratio, amp] of [
      [1, 1],
      [2, 0.25],
      [4.2, 0.08],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = hz * ratio;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  }

  /** One gibberish syllable for a speaker. */
  blip(voice: string): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const v = VOICES[voice] ?? VOICES["remi"]!;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    const hz = midiToHz(v.pitch + Math.floor(Math.random() * 5) - 2);
    osc.frequency.setValueAtTime(hz, at);
    osc.frequency.exponentialRampToValueAtTime(hz * (0.85 + Math.random() * 0.3), at + 0.07);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.08, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    osc.connect(filter).connect(g).connect(this.buses.get("voices")!);
    osc.start(at);
    osc.stop(at + 0.1);
  }

  /** A stamp thunk, a page rustle and a soft pop, for the UI. */
  ui(kind: "stamp" | "page" | "pop" | "tick"): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const at = ctx.currentTime;
    if (kind === "stamp" || kind === "pop" || kind === "tick") {
      const osc = ctx.createOscillator();
      const start = kind === "stamp" ? 140 : kind === "pop" ? 520 : 900;
      osc.frequency.setValueAtTime(start, at);
      osc.frequency.exponentialRampToValueAtTime(start * 0.45, at + 0.09);
      const g = ctx.createGain();
      const level = kind === "stamp" ? 0.5 : kind === "pop" ? 0.12 : 0.05;
      g.gain.setValueAtTime(level, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (kind === "stamp" ? 0.22 : 0.08));
      osc.connect(g).connect(this.buses.get("effects")!);
      osc.start(at);
      osc.stop(at + 0.25);
      return;
    }
    // Page: filtered noise swept upward.
    const length = 0.28;
    const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.exponentialRampToValueAtTime(3200, at + length);
    const g = ctx.createGain();
    g.gain.value = 0.12;
    source.connect(filter).connect(g).connect(this.buses.get("effects")!);
    source.start(at);
  }

  /**
   * A quiet placeholder tune: a warm pad and the motif on the music box now
   * and then. Phase 04 replaces it with the real adaptive score.
   */
  startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || this.music) return;
    const pad = ctx.createGain();
    pad.gain.value = 0;
    pad.gain.setTargetAtTime(0.05, ctx.currentTime, 2);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.connect(pad).connect(this.buses.get("music")!);
    const oscillators = [55, 59, 62, 66].map((note, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? "triangle" : "sine";
      osc.frequency.value = midiToHz(note);
      osc.detune.value = (i - 1.5) * 4;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    let bar = 0;
    const timer = window.setInterval(() => {
      bar += 1;
      if (bar % 4 === 1) MOTIF.forEach((_, i) => this.note(i, i * 0.42));
    }, 4000);
    this.music = {
      stop: () => {
        window.clearInterval(timer);
        pad.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        for (const osc of oscillators) osc.stop(ctx.currentTime + 2);
      },
    };
  }

  stopMusic(): void {
    this.music?.stop();
    this.music = null;
  }
}

export const audio = new AudioEngine();
