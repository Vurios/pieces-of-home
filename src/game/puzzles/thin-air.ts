import { Vector3 } from "three";
import { THIN_AIR, doneFlag, startedFlag, stepFlag } from "../../content/chapters/activities";
import type { Site } from "../worlds/kit/little-world";
import type { ModelHelicopter } from "../worlds/valinor/machines";
import type { SoundSpot, WorldContext } from "../worlds/types";
import type { Activity } from "./types";

/**
 * Chapter 4's main activity, Thin Air (Game Bible 6).
 *
 * 1. Dad's rotor bench (a small game on screen): the same rotor that hops in
 *    Earth air barely lifts in Mars air. Make it bigger and faster until it
 *    hops. Simple, honest model physics: more air and bigger, faster blades
 *    make more lift.
 * 2. The scout flight: Dad's toy helicopter lifts off its pad and hovers,
 *    and its camera looks down (a small game on screen) so Remi can find a
 *    safe way for the toy rover between the rocks.
 * 3. Leave a note for later: like Ingenuity keeping notes for future
 *    visitors, Remi leaves a note in its log with word chips.
 *
 * Then Remi looks closer at Ingenuity and finds the Wright Flyer's cloth.
 * Nothing can fail.
 */
const ID = THIN_AIR.id;
/** How high Dad's toy helicopter hovers, in metres of the model, and how quickly it climbs. */
const HOVER = 2.4;

export interface ThinAirSpec {
  ctx: WorldContext;
  /** Where a player stands to use the rotor bench. */
  bench: Vector3;
  /** Dad's launch pad and the toy helicopter on it. */
  pad: Site;
  helicopter: ModelHelicopter;
  /** Ingenuity itself, where the note is left. */
  ingenuity: Vector3;
  /** The toy helicopter's buzz, which follows it. */
  sound: SoundSpot;
}

export class ThinAir implements Activity {
  readonly id = ID;
  private time = 0;
  private gameKey = 0;
  private told = new Set<string>();
  private offs: (() => void)[] = [];
  /** 0 on the pad, 1 at full hover. */
  private lift = 0;
  private flying = false;
  private spin = 0;
  private readonly padStand: Vector3;
  /** Where the player is, for framing the lift-off. */
  private readonly player = new Vector3();

  constructor(private spec: ThinAirSpec) {
    this.padStand = spec.pad.origin.clone();
    this.addInteractions();
    this.offs.push(spec.ctx.bus.on("activity:start", ({ id }) => id === ID && this.start()));
    this.pose();
  }

  private get saved(): readonly string[] {
    return this.spec.ctx.store.value.flags;
  }

  private has(step: string): boolean {
    return this.saved.includes(stepFlag(ID, step));
  }

  private get started(): boolean {
    return this.saved.includes(startedFlag(ID));
  }

  private get done(): boolean {
    return this.saved.includes(doneFlag(ID));
  }

  private setFlag(flag: string): boolean {
    if (this.saved.includes(flag)) return false;
    this.spec.ctx.store.update((s) => void s.flags.push(flag));
    return true;
  }

  private beat(name: string): void {
    if (this.told.has(name)) return;
    this.told.add(name);
    this.spec.ctx.bus.emit("activity:beat", { id: ID, beat: name });
  }

  private sfx(name: string, point: Vector3): void {
    this.spec.ctx.bus.emit("sfx", { name, at: [point.x, point.y, point.z] });
  }

  private step(name: string): void {
    if (this.setFlag(stepFlag(ID, name))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: name });
  }

  start(): void {
    this.setFlag(startedFlag(ID));
  }

  /** Opens a small game on screen and runs `then` when it is done. */
  private play(id: string, then: () => void): void {
    const { bus } = this.spec.ctx;
    const key = 900_000 + Math.floor(Math.random() * 99_999);
    this.gameKey = key;
    const off = bus.on("story:game-done", (done) => {
      if (done.key !== key) return;
      off();
      this.gameKey = 0;
      then();
    });
    this.offs.push(off);
    bus.emit("story:game", { key, id });
  }

  private addInteractions(): void {
    const { interactions } = this.spec.ctx;
    interactions.add({
      id: "rotor-bench",
      position: this.spec.bench,
      radius: 1.6,
      kind: "press",
      label: () => (this.started && !this.has("bench") && this.gameKey === 0 ? "Try Dad's rotor bench" : null),
      onDone: () =>
        this.play("rotor", () => {
          this.step("bench");
          this.beat("bench");
        }),
    });
    interactions.add({
      id: "scout-pad",
      position: this.padStand,
      radius: 1.5,
      kind: "press",
      label: () => (this.started && this.has("bench") && !this.has("scout") && this.gameKey === 0 && !this.flying ? "Fly Dad's toy helicopter" : null),
      onDone: () => {
        this.flying = true;
        this.sfx("hover-hop", this.padStand);
        this.beat("takeoff");
        // A short look from the side as it lifts off, then its camera view opens.
        // The camera stands across the pad from Remi, so Remi and the helicopter are both in view.
        const { pad } = this.spec;
        const away = pad.origin.clone().sub(this.player);
        away.addScaledVector(pad.dir, -away.dot(pad.dir));
        if (away.lengthSq() < 1e-4) away.copy(pad.forward);
        away.normalize();
        const side = new Vector3().crossVectors(pad.dir, away).normalize();
        const eye = pad.origin.clone().addScaledVector(pad.dir, 1.1).addScaledVector(away, 6.2).addScaledVector(side, 2.2);
        const look = pad.origin.clone().addScaledVector(pad.dir, 1.9);
        this.spec.ctx.bus.emit("camera:cinematic", { position: eye.toArray() as [number, number, number], target: look.toArray() as [number, number, number], up: pad.dir.toArray() as [number, number, number], seconds: 3.4 });
        window.setTimeout(
          () =>
            this.play("scout", () => {
              this.flying = false;
              this.step("scout");
              this.beat("scout");
            }),
          2600,
        );
      },
    });
    interactions.add({
      id: "ingenuity-log",
      position: this.spec.ingenuity,
      radius: 1.6,
      kind: "press",
      label: () => (this.started && this.has("scout") && !this.has("note") && this.gameKey === 0 ? "Leave a note for later" : null),
      onDone: () =>
        this.play("note", () => {
          this.step("note");
          this.beat("note");
          this.finish();
        }),
    });
  }

  private finish(): void {
    if (this.setFlag(doneFlag(ID))) this.spec.ctx.bus.emit("activity:done", { id: ID });
  }

  objective(): Vector3 | null {
    if (!this.started || this.done) return null;
    if (!this.has("bench")) return this.spec.bench;
    if (!this.has("scout")) return this.padStand;
    return this.spec.ingenuity;
  }

  /** Places the toy helicopter: on its pad, or up in the air with a gentle sway. */
  private pose(): void {
    const { helicopter, pad } = this.spec;
    const k = this.lift * this.lift * (3 - 2 * this.lift);
    const sway = Math.sin(this.time * 1.3) * 0.08 * k;
    helicopter.root.matrixAutoUpdate = true;
    helicopter.root.position.copy(pad.origin).addScaledVector(pad.dir, 0.09 + k * HOVER).addScaledVector(pad.forward, sway);
    helicopter.root.up.copy(pad.dir);
    helicopter.root.lookAt(helicopter.root.position.clone().add(pad.forward));
  }

  /** The world tells the activity where the player stands each frame. */
  watch(player: Vector3): void {
    this.player.copy(player);
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const target = this.flying ? 1 : 0;
    this.lift += Math.sign(target - this.lift) * Math.min(Math.abs(target - this.lift), dt * (reducedMotion ? 4 : 1.1));
    // The rotors spin up before it lifts and slow down after it lands.
    const want = this.flying || this.lift > 0.01 ? 1 : 0;
    this.spin += (want - this.spin) * Math.min(1, dt * 2.5);
    const turn = this.spin * dt * 40;
    this.spec.helicopter.rotors[0].rotation.y += turn;
    this.spec.helicopter.rotors[1].rotation.y -= turn;
    this.spec.sound.value = this.spin * 0.8;
    const p = this.spec.helicopter.root.position;
    this.spec.sound.position.x = p.x;
    this.spec.sound.position.y = p.y;
    this.spec.sound.position.z = p.z;
    this.pose();
  }

  debugState(): { steps: string[]; flying: boolean } {
    return { steps: THIN_AIR.steps.filter((s) => this.has(s.id)).map((s) => s.id), flying: this.flying };
  }

  solve(): void {
    for (const flag of [startedFlag(ID), ...THIN_AIR.steps.map((s) => stepFlag(ID, s.id))]) this.setFlag(flag);
    this.flying = false;
    this.finish();
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.spec.sound.value = 0;
  }
}
