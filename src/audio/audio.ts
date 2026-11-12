/**
 * The Audio Director: the one place the game asks for sound.
 *
 * Everything is synthesized at runtime with the Web Audio API; there are no
 * recordings except Dad's optional voice lines. Nothing plays until the
 * player's first gesture ("Turn on the light") unlocks the AudioContext.
 *
 * - Mixer (mixer.ts): buses, compressor and limiter, room, ducking, muffle.
 * - Cues (cues.ts, sfx.ts): named effects with anti-spam and random pitch.
 * - Emitters: positional sounds on world objects, through PannerNodes
 *   (HRTF on High, equal power on Medium, plain distance on Low).
 * - Ambience (ambience.ts): layered beds crossfaded by where the player is.
 * - Score (music.ts): the generative, adaptive music.
 * - Voices (voices.ts): gibberish babble, Dad's hum or recordings, Milo's bleeps.
 */
import type { PerspectiveCamera } from "three";
import type { GameBus, QualityTier } from "../game/core/events";
import type { SoundSpot, World } from "../game/worlds/types";
import { Ambience, prepareBeds } from "./ambience";
import { crackle } from "./buffers";
import { CUES, stepCue } from "./cues";
import { BUSES, type Bus, DEFAULT_VOLUMES, Mixer } from "./mixer";
import { Score, type Scene, type StormStage } from "./music";
import { LOOPS, type LoopHandle, RECIPES } from "./sfx";
import { cueAllowed } from "./theory";
import { SampleBank } from "./samples";
import { type Speaking, speak } from "./voices";

export { BUSES, type Bus } from "./mixer";

/** A looping cue that can also move, when it was placed at a point. */
type MovingLoop = LoopHandle & { move(p: Point): void };
export { VOICES } from "./voices";

type Point = { x: number; y: number; z: number };

export interface PlayOptions {
  /** A world position: the sound comes from there. */
  at?: Point | null;
  level?: number;
  rate?: number;
  param?: number;
  delay?: number;
}

/** What the engine tells the director each frame. */
export interface SoundFrame {
  camera: PerspectiveCamera;
  player: Point;
  world: World;
  mode: "title" | "play";
}

const MUSIC_FOR: Record<string, Scene> = { home: "home", moon: "moon", mars: "mars", finale: "finale", tranquility: "moon", hadley: "moon", meridiani: "mars", valinor: "mars" };
/** Which soundscape each world uses (see src/audio/ambience.ts). */
const SCAPE_FOR: Record<string, string> = { tranquility: "moon", hadley: "moon", meridiani: "mars", valinor: "mars" };

/** One recorded take, retuned and optionally muffled, into `out`. */
function playTake(mx: Mixer, out: AudioNode, buffer: AudioBuffer, at: number, level: number, rate: number, tone?: number): void {
  const source = mx.ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const g = mx.ctx.createGain();
  g.gain.value = level;
  let node: AudioNode = source;
  if (tone) {
    const lp = mx.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = tone;
    node = node.connect(lp);
  }
  node.connect(g).connect(out);
  source.start(at);
  source.onended = () => g.disconnect();
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private bank: SampleBank | null = null;
  private mx: Mixer | null = null;
  private score: Score | null = null;
  private ambience: Ambience | null = null;
  private volumes: Record<Bus, number> = { ...DEFAULT_VOLUMES };
  private tier: QualityTier = "high";
  private muffled = false;
  private hum: LoopHandle | null = null;
  private humLevel = 0;
  private wantScene: Scene = "silent";
  private wantFriends = 0;
  private cueState = new Map<string, { last: number; ends: number[] }>();
  private emitters: { loop: MovingLoop | null; spot: SoundSpot; next: number; value: number }[] = [];
  /** Looping recordings a world asks for through its ambience levels (the real Mars wind). */
  private beds = new Map<string, { set(level: number): void; stop(): void; level: number }>();
  private emitterWorld: World | null = null;
  private voices = new Map<string, Speaking>();
  private recordings = new Map<string, AudioBuffer | null>();
  private crackleBed: AudioBuffer | null = null;
  private retrying = false;
  private wasRunning = false;

  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  /** The mixer, for the audio lab. Null until unlocked. */
  get mixer(): Mixer | null {
    return this.mx;
  }

  get music(): Score | null {
    return this.score;
  }

  get ambient(): Ambience | null {
    return this.ambience;
  }

  /**
   * Makes the looping beds ahead of time. It needs no gesture, so it runs
   * while the page loads and counts toward the loader's progress.
   */
  async prepare(world = "home"): Promise<void> {
    if (typeof AudioBuffer === "undefined") return;
    this.crackleBed ??= crackle(5);
    await prepareBeds(world);
  }

  /** Call from inside a user gesture. Safe to call again. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: "interactive" });
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

  private build(ctx: AudioContext): void {
    const mx = new Mixer(ctx, this.tier);
    this.mx = mx;
    // Recorded sounds load after the first click: foley first, then the instruments and the NASA clips.
    const bank = new SampleBank(ctx);
    this.bank = bank;
    mx.samples = bank;
    void bank
      .load("sfx")
      .then(() => bank.load("inst"))
      .then(() => Promise.all(["eagle-landed", "mars-wind", "ingenuity-hum", "voyager-plasma"].map((id) => bank.load(id))));
    for (const bus of BUSES) mx.setVolume(bus, this.volumes[bus]);
    mx.muffle(this.muffled);
    this.score = new Score(mx, this.crackleBed ?? undefined);
    this.ambience = new Ambience(mx);
    if (this.humLevel > 0) this.setHum(this.humLevel);
    if (this.wantScene !== "silent") this.score.setScene(this.wantScene);
    this.score.setFriends(this.wantFriends);
    if (this.emitterWorld) this.placeEmitters(this.emitterWorld);
    // Pause with the tab, carry on when it comes back.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.wasRunning = ctx.state === "running";
        if (this.wasRunning) void ctx.suspend();
      } else if (this.wasRunning) void ctx.resume();
    });
  }

  setVolume(bus: Bus, value: number): void {
    this.volumes[bus] = Math.max(0, Math.min(1, value));
    this.mx?.setVolume(bus, this.volumes[bus]);
  }

  /** Low drops the room, the panning and some layers. */
  setTier(tier: QualityTier): void {
    this.tier = tier;
    this.mx?.setTier(tier);
  }

  /** Muffles the world while the notebook is open. */
  muffle(on: boolean): void {
    this.muffled = on;
    this.mx?.muffle(on);
  }

  // ---- Cues ----

  /** Plays a named cue. Returns false when it was skipped (locked, unknown, or too soon). */
  play(name: string, options: PlayOptions = {}): boolean {
    const mx = this.mx;
    const spec = CUES[name];
    if (!mx || !spec || mx.ctx.state !== "running") return false;
    const recipe = RECIPES[spec.recipe];
    if (!recipe) return false;
    const now = mx.now;
    let state = this.cueState.get(name);
    if (!state) {
      state = { last: -Infinity, ends: [] };
      this.cueState.set(name, state);
    }
    state.ends = state.ends.filter((end) => end > now);
    if (!cueAllowed(now, state.last, spec.minGap ?? 0.03, state.ends.length, spec.maxVoices ?? 6)) return false;
    const length = spec.length ?? 1.2;
    state.last = now;
    state.ends.push(now + length);
    const rate = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (spec.pitch ?? 0));
    const level = spec.volume * (options.level ?? 1) * (1 - Math.random() * (spec.vary ?? 0));
    let out: AudioNode = mx.input(spec.bus);
    if (options.at) {
      const node = this.place(options.at, out);
      out = node;
      window.setTimeout(() => node.disconnect(), (length + (options.delay ?? 0) + 2) * 1000);
    }
    const at = now + 0.005 + (options.delay ?? 0);
    // A recorded take when it has loaded; the code-made recipe until then, or both for a layered cue.
    const take = spec.sample ? this.bank?.take(spec.sample) : null;
    if (take) {
      playTake(mx, out, take, at, level * (spec.sampleGain ?? 0.15), rate * (spec.sampleRate ?? 1), spec.sampleTone);
      if (!spec.layer) return true;
    }
    recipe({ mx, out, at, level: take ? level * 0.6 : level, rate, param: options.param ?? 0 });
    return true;
  }

  /**
   * A real recording (NASA mission sounds), played once through the voices
   * bus. Resolves when it ends, or at once if it is not loaded or sound is
   * off, with its length in seconds (0 when it did not play).
   */
  clip(id: string, level = 1): Promise<number> {
    const mx = this.mx;
    const rec = this.bank?.recording(id);
    if (!mx || !rec || mx.ctx.state !== "running") return Promise.resolve(0);
    const source = mx.ctx.createBufferSource();
    source.buffer = rec.buffer;
    const g = mx.ctx.createGain();
    g.gain.value = level * 0.9;
    source.connect(g).connect(mx.input("voices"));
    source.start(mx.now + 0.05);
    return new Promise((resolve) => (source.onended = () => resolve(rec.buffer.duration)));
  }

  /** A looping recording (Mars wind) on the ambience bus, kept at `level`. */
  recordingLoop(id: string, level: number): { set(level: number): void; stop(): void } | null {
    const mx = this.mx;
    const rec = this.bank?.recording(id);
    if (!mx || !rec) return null;
    const source = mx.ctx.createBufferSource();
    source.buffer = rec.buffer;
    source.loop = true;
    const g = mx.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(level, mx.now, 0.8);
    source.connect(g).connect(mx.input("ambience"));
    source.start();
    return {
      set: (value) => g.gain.setTargetAtTime(value, mx.now, 0.6),
      stop: () => {
        g.gain.setTargetAtTime(0, mx.now, 0.6);
        source.stop(mx.now + 3);
      },
    };
  }

  /** Starts a looping cue (a motor, the rotor, the radio). Null while locked. */
  loop(name: string, value = 1, at?: Point | null): MovingLoop | null {
    const mx = this.mx;
    const spec = CUES[name];
    const make = spec ? LOOPS[spec.recipe] : undefined;
    if (!mx || !spec || !make) return null;
    const out = at ? this.place(at, mx.input(spec.bus)) : mx.input(spec.bus);
    const level = gainNode(mx, spec.volume);
    level.connect(out);
    const handle = make(mx, level, value);
    return {
      set: handle.set,
      move: (p: Point) => {
        if (!(out instanceof PannerNode)) return;
        if (out.positionX) {
          out.positionX.setTargetAtTime(p.x, mx.now, 0.05);
          out.positionY.setTargetAtTime(p.y, mx.now, 0.05);
          out.positionZ.setTargetAtTime(p.z, mx.now, 0.05);
        } else out.setPosition(p.x, p.y, p.z);
      },
      stop: () => {
        handle.stop();
        window.setTimeout(() => {
          level.disconnect();
          if (at) out.disconnect();
        }, 3000);
      },
    };
  }

  /** A node that places sound at a world point, by the tier's rules. */
  private place(at: Point, destination: AudioNode): AudioNode {
    const mx = this.mx!;
    const ctx = mx.ctx;
    if (this.tier === "low") {
      // Mono on Low: loudness by distance only, set when the sound starts.
      const g = ctx.createGain();
      g.gain.value = Math.min(1, 2.5 / Math.max(2.5, this.distanceTo(at)));
      g.connect(destination);
      return g;
    }
    const p = ctx.createPanner();
    p.panningModel = this.tier === "high" ? "HRTF" : "equalpower";
    p.distanceModel = "inverse";
    p.refDistance = 2.5;
    p.maxDistance = 60;
    p.rolloffFactor = 1.1;
    if (p.positionX) {
      p.positionX.value = at.x;
      p.positionY.value = at.y;
      p.positionZ.value = at.z;
    } else p.setPosition(at.x, at.y, at.z);
    p.connect(destination);
    return p;
  }

  private listenerAt: Point = { x: 0, y: 0, z: 0 };
  private distanceTo(at: Point): number {
    const l = this.listenerAt;
    return Math.hypot(at.x - l.x, at.y - l.y, at.z - l.z);
  }

  // ---- Old names the UI already uses ----

  lampClick(): void {
    this.play("lamp-click");
  }

  /** The lamp's warm hum, heard on the loader and title, faded to `level` (0 stops it). */
  setHum(level: number): void {
    this.humLevel = level;
    if (!this.mx) return;
    if (!this.hum && level > 0) this.hum = this.loop("lamp-hum", level);
    else this.hum?.set(level);
  }

  /** A title-letter note: the motif, one note per letter. */
  note(index: number): void {
    this.score?.note(index);
  }

  ui(kind: "stamp" | "page" | "pop" | "tick" | "pencil" | "tape" | "toast"): void {
    this.play(kind === "page" ? "page-flip" : kind);
  }

  startMusic(): void {
    this.setMusic("title");
  }

  stopMusic(): void {
    this.setMusic("silent");
  }

  // ---- Music ----

  setMusic(scene: Scene): void {
    this.wantScene = scene;
    this.score?.setScene(scene);
  }

  setFocus(on: boolean): void {
    this.score?.setFocus(on);
  }

  setFriends(count: number): void {
    this.wantFriends = count;
    this.score?.setFriends(count);
  }

  sting(): void {
    this.score?.sting();
  }

  storm(stage: StormStage): void {
    this.score?.storm(stage);
  }

  statement(): void {
    this.score?.statement();
  }

  // ---- Voices ----

  /**
   * Speaks a line in a character's gibberish voice, under its caption. Dad's
   * lines play a real recording from `/audio/vo/<line>.ogg` when a teammate has
   * added one, and otherwise his warm hum.
   */
  speak(speaker: string, text: string, line?: string): Speaking | null {
    const mx = this.mx;
    if (!mx || mx.ctx.state !== "running") return null;
    this.voices.get(speaker)?.stop();
    if (speaker === "dad" && line) {
      let stopped = false;
      let inner: Speaking | null = null;
      const handle: Speaking = {
        duration: text.length / 42,
        stop: () => {
          stopped = true;
          inner?.stop();
        },
      };
      void Promise.race([this.recording(line), new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), 350))]).then((buffer) => {
        if (stopped) return;
        inner = buffer ? this.playRecording(buffer) : speak(mx, mx.input("voices"), speaker, text);
      });
      this.voices.set(speaker, handle);
      return handle;
    }
    const voice = speak(mx, mx.input("voices"), speaker, text);
    this.voices.set(speaker, voice);
    return voice;
  }

  private async recording(line: string): Promise<AudioBuffer | null> {
    if (this.recordings.has(line)) return this.recordings.get(line)!;
    let buffer: AudioBuffer | null = null;
    try {
      const response = await fetch(`/audio/vo/${encodeURIComponent(line)}.ogg`);
      const type = response.headers.get("content-type") ?? "";
      // A missing file falls back to the game's own page, so check that this really is audio.
      if (response.ok && type.startsWith("audio/") && this.mx) buffer = await this.mx.ctx.decodeAudioData(await response.arrayBuffer());
    } catch {
      buffer = null;
    }
    this.recordings.set(line, buffer);
    return buffer;
  }

  private playRecording(buffer: AudioBuffer): Speaking {
    const mx = this.mx!;
    const source = mx.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(mx.input("voices"));
    source.start();
    mx.duck(buffer.duration + 0.3);
    return { duration: buffer.duration, stop: () => source.stop() };
  }

  // ---- The game ----

  /** Listens to the game: feet, letters, Milo, photos, worlds, quality. */
  attach(bus: GameBus, tier: QualityTier): void {
    this.setTier(tier);
    bus.on("quality:change", ({ tier: next }) => this.setTier(next));
    bus.on("player:step", ({ surface, running }) => this.play(stepCue(surface), { level: running ? 1 : 0.72 }));
    bus.on("player:jump", () => this.play("jump"));
    bus.on("player:land", ({ speed }) => {
      if (speed > 1.5) this.play("land", { param: speed });
    });
    bus.on("letter:taken", () => this.play("envelope-pickup"));
    bus.on("letter:delivered", () => {
      this.play("delivery-chime");
      this.sting();
    });
    bus.on("milo:stage", () => {
      this.play("part-clunk");
      this.play("milo-boot", { delay: 0.6 });
      this.play("milo-happy", { delay: 2.1 });
    });
    // One-shot sounds from game code: mirrors, lasers, servos.
    bus.on("sfx", ({ name, at, param, delay, level }) =>
      this.play(name, { at: at ? { x: at[0], y: at[1], z: at[2] } : null, ...(param === undefined ? {} : { param }), ...(delay === undefined ? {} : { delay }), ...(level === undefined ? {} : { level }) }),
    );
    // The Long Storm: the music thins, falls silent while no answer comes, then returns.
    bus.on("story:cue", ({ id }) => {
      if (id === "storm") this.storm("thin");
      else if (id === "silence") this.storm("silence");
      else if (id === "clear") this.storm("return");
    });
    bus.on("story:card", ({ kind }) => {
      if (kind === "note") this.play("pencil", { delay: 0.15, level: 0.6 });
    });
    bus.on("emote", () => this.play("emote-pop"));
    bus.on("toast", () => this.play("toast"));
    bus.on("title:done", () => {
      // The lamp's hum moves from the speakers into the world.
      this.setHum(0);
    });
  }

  /** Called by the engine each frame, after the camera moves. */
  frame(f: SoundFrame): void {
    const mx = this.mx;
    if (!mx || mx.ctx.state !== "running") {
      if (this.emitterWorld !== f.world) this.emitterWorld = f.world;
      return;
    }
    // The ears are the camera.
    const e = f.camera.matrixWorld.elements;
    const l = mx.ctx.listener;
    this.listenerAt = { x: e[12]!, y: e[13]!, z: e[14]! };
    if (l.positionX) {
      const t = mx.now;
      l.positionX.setValueAtTime(e[12]!, t);
      l.positionY.setValueAtTime(e[13]!, t);
      l.positionZ.setValueAtTime(e[14]!, t);
      l.forwardX.setValueAtTime(-e[8]!, t);
      l.forwardY.setValueAtTime(-e[9]!, t);
      l.forwardZ.setValueAtTime(-e[10]!, t);
      l.upX.setValueAtTime(e[4]!, t);
      l.upY.setValueAtTime(e[5]!, t);
      l.upZ.setValueAtTime(e[6]!, t);
    } else {
      l.setPosition(e[12]!, e[13]!, e[14]!);
      l.setOrientation(-e[8]!, -e[9]!, -e[10]!, e[4]!, e[5]!, e[6]!);
    }

    if (this.emitterWorld !== f.world) this.placeEmitters(f.world);
    const scape = SCAPE_FOR[f.world.id] ?? f.world.id;
    if (this.ambience && this.ambience.current !== scape) {
      this.ambience.setWorld(scape);
    }
    // The title flies high over the planet: only a little of the dusk comes through.
    const levels = f.mode === "title" ? { dusk: 0.35 } : (f.world.ambience?.(f.player) ?? {});
    this.ambience?.setLevels(levels);
    this.recordingBeds(levels);
    if (f.mode === "play" && this.wantScene === "title") this.setMusic(MUSIC_FOR[f.world.id] ?? "home");
    else if (f.mode === "play" && this.wantScene !== "silent" && this.wantScene !== MUSIC_FOR[f.world.id]) this.setMusic(MUSIC_FOR[f.world.id] ?? "home");

    const now = mx.now;
    for (const emitter of this.emitters) {
      const { spot } = emitter;
      // Sounds that travel (a dust devil): follow the spot and its loudness.
      if (spot.live && emitter.loop) {
        emitter.loop.move(spot.position);
        const value = spot.value ?? 1;
        if (Math.abs(value - emitter.value) > 0.02) {
          emitter.loop.set(value);
          emitter.value = value;
        }
      }
      if (!spot.cue || !spot.every) continue;
      const near = Math.hypot(spot.position.x - f.player.x, spot.position.y - f.player.y, spot.position.z - f.player.z) < (spot.radius ?? 6);
      if (near && now >= emitter.next) {
        this.play(spot.cue, { at: spot.position });
        emitter.next = now + spot.every[0] + Math.random() * (spot.every[1] - spot.every[0]);
      } else if (!near && emitter.next < now) emitter.next = now + spot.every[0] * 0.5;
    }
  }

  /** Builds the world's positional sounds: machine hums and voices that live in a place. */
  private placeEmitters(world: World): void {
    for (const e of this.emitters) e.loop?.stop();
    this.emitters = [];
    this.emitterWorld = world;
    if (!this.mx) return;
    for (const spot of world.sounds ?? []) {
      const loop = spot.loop ? this.loop(spot.loop, spot.value ?? 1, spot.position) : null;
      this.emitters.push({ loop, spot, next: this.mx.now + (spot.every?.[0] ?? 0) * 0.5, value: spot.value ?? 1 });
    }
  }

  /**
   * A level named after a loaded recording (for example "mars-wind") plays that
   * recording as a looping bed under the made ambience, and stops when the
   * world stops asking for it.
   */
  private recordingBeds(levels: Record<string, number>): void {
    for (const [id, bed] of this.beds) {
      if (id in levels) continue;
      bed.stop();
      this.beds.delete(id);
    }
    for (const [id, level] of Object.entries(levels)) {
      if (!this.bank?.recording(id)) continue;
      const bed = this.beds.get(id);
      if (!bed) {
        const made = this.recordingLoop(id, level);
        if (made) this.beds.set(id, { ...made, level });
      } else if (Math.abs(bed.level - level) > 0.02) {
        bed.set(level);
        bed.level = level;
      }
    }
  }
}

function gainNode(mx: Mixer, value: number): GainNode {
  const g = mx.ctx.createGain();
  g.gain.value = value;
  return g;
}

export const audio = new AudioEngine();
