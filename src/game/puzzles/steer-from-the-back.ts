import { Matrix4, Quaternion, Vector3 } from "three";
import type { InputFrame } from "../core/input";
import { type ColliderGroup, pointInsideColliders } from "../world/colliders";
import type { Ground, PlayerController } from "../world/controller";
import { damp, parallelTransport, projectOnTangent, surfaceMatrix } from "../world/sphere";
import type { Terrain } from "../world/terrain";
import { STEER_FROM_THE_BACK, doneFlag, startedFlag, stepFlag } from "../../content/chapters/activities";
import type { Site } from "../worlds/kit/little-world";
import { type Buggy, WHEEL, WHEELBASE } from "../worlds/hadley/machines";
import type { SoundSpot, WorldContext } from "../worlds/types";
import type { Activity } from "./types";

/**
 * Chapter 2's main activity, Steer from the Back (Game Bible 6).
 *
 * 1. Dad's wheel test: push three wheels across a tray of dust (a small game
 *    on screen). The mesh wheel with chevrons grips.
 * 2. The drive: Dad's model buggy is rideable. Its front steering is stuck,
 *    so it steers with the back wheels, the way the real crew did on the
 *    rover's first drive (fact lrv-rear-steer). The front axle keeps going
 *    straight ahead and the back swings out on a turn. Drive to the stake at
 *    the edge of Hadley Rille, using Dad's taped photo as the map.
 * 3. Park it back inside Dad's chalk marks.
 *
 * Nothing can fail. The rille's rim and steep slopes stop the buggy gently.
 */
const ID = STEER_FROM_THE_BACK.id;
/** Top speeds, world units per second, and how hard the wheels can turn (radians). */
export const MAX_FORWARD = 3.2;
export const MAX_REVERSE = 1.5;
export const MAX_STEER = 0.55;
const ACCEL = 2.4;
const BRAKE = 4.5;
/** How close to the overlook stake counts as there, and how close to the chalk marks counts as parked. */
const OVERLOOK_REACH = 2.1;
const PARK_REACH = 1.25;
const PARK_ANGLE = Math.cos((40 * Math.PI) / 180);
/** Seconds the buggy takes to roll into its marks once it is close and slow. */
const SETTLE = 0.9;

export interface SteerSpec {
  ctx: WorldContext;
  terrain: Terrain;
  buggy: Buggy;
  /** Where the buggy is parked: its center, facing its front. */
  park: Site;
  /** The wheel test tray, where a player stands to use it. */
  tray: Vector3;
  /** The stake at the rille overlook. */
  overlook: Vector3;
  /** The world's colliders (the buggy's own parked collider is skipped while driving). */
  colliders: ColliderGroup[];
  /** The buggy's own collider, moved with it when it parks. */
  collider: ColliderGroup;
  ground: Ground;
  /** The motor's sound, which follows the buggy. */
  sound: SoundSpot;
}

/**
 * The buggy's motion on a round world. Its pose is the front axle's middle
 * (`front`, a unit direction) and a heading along the ground. The front axle
 * rolls straight along the heading; the back wheels turn, so the heading
 * turns about the front axle and the back swings out.
 */
export class RearSteer {
  readonly front = new Vector3();
  readonly heading = new Vector3();
  speed = 0;
  /** -1 (full left) to 1 (full right). */
  steer = 0;

  constructor(private radius: number) {}

  place(center: Vector3, heading: Vector3): void {
    const up = center.clone().normalize();
    this.heading.copy(projectOnTangent(heading, up, new Vector3())).normalize();
    this.front.copy(up).multiplyScalar(this.radius).addScaledVector(this.heading, WHEELBASE / 2).normalize();
    parallelTransport(this.heading, up, this.front);
    this.heading.copy(projectOnTangent(this.heading, this.front, new Vector3())).normalize();
    this.speed = 0;
    this.steer = 0;
  }

  /** The middle of the buggy, as a unit direction. */
  center(out = new Vector3()): Vector3 {
    return out.copy(this.front).multiplyScalar(this.radius).addScaledVector(this.heading, -WHEELBASE / 2).normalize();
  }

  /** Speeds up toward `throttle` (-1 to 1) and turns the back wheels toward `turn` (-1 to 1). */
  drive(dt: number, throttle: number, turn: number): void {
    const want = throttle >= 0 ? throttle * MAX_FORWARD : throttle * MAX_REVERSE;
    const pushing = Math.abs(want) > 0.01 && Math.sign(want) === Math.sign(this.speed || want);
    const rate = pushing ? ACCEL : BRAKE;
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, want - this.speed));
    this.steer += (turn - this.steer) * damp(5, dt);
  }

  /** Moves along the ground by this frame's speed. */
  move(dt: number): void {
    const step = this.speed * dt;
    if (Math.abs(step) < 1e-7) return;
    const before = scratchA.copy(this.front);
    const moved = scratchB.copy(this.front).multiplyScalar(this.radius).addScaledVector(this.heading, step).normalize();
    parallelTransport(this.heading, before, moved);
    this.front.copy(moved);
    // Turning right (steer above 0, rolling forward) turns the heading clockwise seen from above.
    const yaw = (-step * Math.tan(this.steer * MAX_STEER)) / WHEELBASE;
    turnAbout.setFromAxisAngle(this.front, yaw);
    this.heading.applyQuaternion(turnAbout);
    projectOnTangent(this.heading, this.front, this.heading).normalize();
  }

  /** A copy, to try a move before making it. */
  copyFrom(other: RearSteer): this {
    this.front.copy(other.front);
    this.heading.copy(other.heading);
    this.speed = other.speed;
    this.steer = other.steer;
    return this;
  }
}

const scratchA = new Vector3();
const scratchB = new Vector3();
const turnAbout = new Quaternion();

export class SteerFromTheBack implements Activity {
  readonly id = ID;
  riding = false;
  private motion: RearSteer;
  private trial: RearSteer;
  private time = 0;
  private settle = -1;
  private settleFrom = { center: new Vector3(), heading: new Vector3() };
  /** Parked facing either way is fine: inside the lines is what counts. */
  private settleTo = new Vector3();
  private told = new Set<string>();
  private steering = false;
  private gameKey = 0;
  private offs: (() => void)[] = [];
  private readonly door = new Vector3();
  private readonly feet = new Vector3();
  private readonly up = new Vector3();
  private readonly forward = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly parkCenter: Vector3;
  private readonly parkHeading: Vector3;
  private lastProgress = -1;
  /** The buggy's middle this frame (its own vector: the scratch ones are shared by helpers). */
  private readonly here = new Vector3();

  constructor(private spec: SteerSpec) {
    const R = spec.terrain.radius;
    this.motion = new RearSteer(R);
    this.trial = new RearSteer(R);
    this.parkCenter = spec.park.dir.clone();
    this.parkHeading = spec.park.forward.clone();
    this.motion.place(this.parkCenter, this.parkHeading);
    this.pose();
    this.addInteractions();
    this.offs.push(spec.ctx.bus.on("activity:start", ({ id }) => id === ID && this.start()));
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

  private beat(name: string, once = true): void {
    if (once && this.told.has(name)) return;
    this.told.add(name);
    this.spec.ctx.bus.emit("activity:beat", { id: ID, beat: name });
  }

  private sfx(name: string, point: Vector3, param?: number): void {
    this.spec.ctx.bus.emit("sfx", { name, at: [point.x, point.y, point.z], ...(param === undefined ? {} : { param }) });
  }

  private step(name: string): void {
    if (this.setFlag(stepFlag(ID, name))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: name });
  }

  start(): void {
    this.setFlag(startedFlag(ID));
  }

  /** The buggy can be driven once the wheels are tested, until it is parked for good. */
  private get canDrive(): boolean {
    return this.started && this.has("wheels") && !this.done;
  }

  private addInteractions(): void {
    const { interactions, bus } = this.spec.ctx;
    interactions.add({
      id: "wheel-test",
      position: this.spec.tray,
      radius: 1.7,
      kind: "press",
      label: () => (this.started && !this.has("wheels") && this.gameKey === 0 ? "Test Dad's wheels" : null),
      onDone: () => {
        // The test is a small game on screen (src/ui/story/WheelGame.svelte).
        const key = 900_000 + Math.floor(Math.random() * 99_999);
        this.gameKey = key;
        const off = bus.on("story:game-done", (done) => {
          if (done.key !== key) return;
          off();
          this.gameKey = 0;
          this.step("wheels");
          this.beat("ready");
        });
        this.offs.push(off);
        bus.emit("story:game", { key, id: "wheels" });
      },
    });
    interactions.add({
      id: "buggy-seat",
      position: this.door,
      radius: 1.35,
      kind: "press",
      label: () => (this.canDrive && !this.riding ? "Get in and drive" : null),
      onDone: () => this.getIn(),
    });
    interactions.add({
      id: "buggy-out",
      position: this.feet,
      radius: 0.9,
      kind: "press",
      label: () => (this.riding && this.settle < 0 && Math.abs(this.motion.speed) < 0.35 ? "Get out" : null),
      onDone: () => this.getOut(),
    });
  }

  private getIn(): void {
    if (!this.canDrive || this.riding) return;
    this.riding = true;
    // Its own parked collider steps aside while someone drives it.
    const i = this.spec.colliders.indexOf(this.spec.collider);
    if (i >= 0) this.spec.colliders.splice(i, 1);
    this.sfx("servo", this.feet);
    this.beat("seat");
    this.report(true);
  }

  private getOut(): void {
    if (!this.riding) return;
    this.riding = false;
    this.motion.speed = 0;
    this.placeCollider();
    const player = this.lastPlayer;
    if (player) {
      const dir = this.door.clone().normalize();
      player.teleport(dir, this.forward, this.spec.ground);
    }
    this.report(true);
  }

  private lastPlayer: PlayerController | null = null;

  /** The buggy's parked collider follows it, so players walk round it wherever it stops. */
  private placeCollider(): void {
    const c = this.spec.collider;
    c.matrix.copy(this.matrix);
    c.inverse.copy(this.matrix).invert();
    if (!this.spec.colliders.includes(c)) this.spec.colliders.push(c);
  }

  /** Places the buggy model, its wheels and the seat from the motion. */
  private pose(): void {
    const { terrain, buggy } = this.spec;
    const center = this.motion.center(scratchC);
    terrain.normalAt(center, this.up).lerp(center, 0.45).normalize();
    projectOnTangent(this.motion.heading, this.up, this.forward).normalize();
    const origin = scratchD.copy(center).multiplyScalar(terrain.radiusAt(center));
    surfaceMatrix(origin, this.up, this.forward, this.matrix);
    buggy.root.matrix.copy(this.matrix);
    buggy.root.matrixWorldNeedsUpdate = true;
    // Each wheel finds its own ground: a little suspension travel.
    const inverse = scratchM.copy(this.matrix).invert();
    for (const w of buggy.wheels) {
      const local = scratchE.set(w.side * WHEEL.track, 0, w.front ? WHEEL.axle : -WHEEL.axle);
      const world = local.applyMatrix4(this.matrix).normalize();
      const ground = world.multiplyScalar(terrain.radiusAt(world)).applyMatrix4(inverse);
      w.knuckle.position.y = WHEEL.radius + Math.max(-0.09, Math.min(0.09, ground.y));
    }
    this.feet.copy(buggy.seat).applyMatrix4(this.matrix);
    this.door.copy(buggy.door).applyMatrix4(this.matrix);
  }

  /** Called by the world's ride hook: drives while a player sits in the buggy. */
  ride(dt: number, input: InputFrame, player: PlayerController): boolean {
    this.lastPlayer = player;
    if (!this.riding) return false;
    const { buggy } = this.spec;
    if (this.settle >= 0) this.rollIn(dt);
    else {
      const turn = Math.max(-1, Math.min(1, input.moveX));
      const throttle = Math.max(-1, Math.min(1, input.moveY));
      if (Math.abs(turn) > 0.3 && !this.steering) this.sfx("servo", this.feet);
      this.steering = Math.abs(turn) > 0.3;
      this.motion.drive(dt, throttle, turn);
      this.advance(dt);
    }
    this.pose();
    // Wheels: all four roll; only the back pair steers. The front pair is stuck straight.
    for (const w of buggy.wheels) {
      w.spin.rotation.x += (this.motion.speed * dt) / WHEEL.radius;
      w.knuckle.rotation.y = w.front ? 0 : this.motion.steer * MAX_STEER;
    }
    // The rider.
    player.position.copy(this.feet);
    player.up.copy(this.up);
    player.forward.copy(this.forward);
    player.velocity.copy(this.forward).multiplyScalar(this.motion.speed);
    player.verticalSpeed = 0;
    player.grounded = true;
    player.pace = 0;
    player.running = false;
    return true;
  }

  /** Tries this frame's move; the rille's rim, steep slopes and big things stop the buggy. */
  private advance(dt: number): void {
    const m = this.motion;
    if (Math.abs(m.speed) < 1e-4) return;
    this.trial.copyFrom(m);
    this.trial.move(dt);
    const { terrain, colliders, collider } = this.spec;
    const R = terrain.radius;
    // The bumper on the side we are rolling toward.
    const ahead = m.speed > 0;
    const c = this.trial.center(scratchC);
    const bumper = scratchD.copy(c).multiplyScalar(R).addScaledVector(this.trial.heading, ahead ? WHEELBASE / 2 + 0.45 : -(WHEELBASE / 2 + 0.45)).normalize();
    const rim = terrain.channelAt(bumper).t < 1.15;
    const steep = terrain.radiusAt(bumper) - terrain.radiusAt(c) > 0.32;
    const point = bumper.multiplyScalar(terrain.radiusAt(bumper) + 0.3);
    const bumped = pointInsideColliders(colliders, point, 0.3);
    void collider;
    if (rim || steep || bumped) {
      this.sfx("wheel-crunch", point);
      m.speed = -m.speed * 0.15;
      if (rim) this.beat("edge");
      return;
    }
    m.front.copy(this.trial.front);
    m.heading.copy(this.trial.heading);
    // A little dust behind the back wheels.
    if (Math.abs(m.speed) > 1.2 && Math.random() < dt * 8) {
      const back = scratchE.copy(c).multiplyScalar(terrain.radiusAt(c)).addScaledVector(this.forward, -WHEELBASE / 2);
      this.spec.ctx.bus.emit("dust:puff", { at: [back.x, back.y, back.z], count: 2, spread: 0.7 });
    }
    if (Math.abs(m.steer) > 0.6 && Math.abs(m.speed) > 1) this.beat("swing");
  }

  /** Rolls the last little way into the chalk marks. */
  private rollIn(dt: number): void {
    this.settle += dt;
    const t = Math.min(1, this.settle / SETTLE);
    const k = t * t * (3 - 2 * t);
    const center = scratchC.copy(this.settleFrom.center).lerp(this.parkCenter, k).normalize();
    const heading = scratchD.copy(this.settleFrom.heading).lerp(this.settleTo, k).normalize();
    this.motion.place(center, heading);
    this.motion.speed = (1 - k) * 0.8;
    if (t >= 1) this.parked();
  }

  private parked(): void {
    this.settle = -1;
    this.motion.place(this.parkCenter, this.settleTo);
    this.motion.speed = 0;
    this.pose();
    this.step("park");
    this.setFlag(doneFlag(ID));
    this.getOut();
    this.sfx("part-clunk", this.feet);
    this.spec.ctx.bus.emit("activity:done", { id: ID });
  }

  objective(): Vector3 | null {
    if (!this.started || this.done) return null;
    if (!this.has("wheels")) return this.spec.tray;
    if (!this.riding) return this.door;
    return this.has("drive") ? this.spec.park.origin : this.spec.overlook;
  }

  /** How far along Dad's route: 0 at the chalk marks, 1 at the overlook. */
  progress(): number {
    const total = this.parkCenter.distanceTo(this.spec.overlook.clone().normalize());
    const left = this.motion.center(scratchC).distanceTo(scratchD.copy(this.spec.overlook).normalize());
    return Math.max(0, Math.min(1, 1 - left / total));
  }

  /** Tells the screen about the ride (Dad's photo map), only when something changed. */
  private report(force = false): void {
    const progress = Math.round(this.progress() * 100) / 100;
    if (!force && progress === this.lastProgress) return;
    this.lastProgress = progress;
    this.spec.ctx.bus.emit("ride:state", { riding: this.riding, leg: this.has("drive") ? "back" : "out", progress });
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const m = this.motion;
    const sound = this.spec.sound;
    const center = m.center(this.here).multiplyScalar(this.spec.terrain.radius);
    sound.position.x = center.x;
    sound.position.y = center.y;
    sound.position.z = center.z;
    sound.value = this.riding ? Math.min(1, Math.abs(m.speed) / MAX_FORWARD) * 0.9 + 0.1 : 0;
    // The umbrella antenna leans to face the way the buggy goes, a slow wobble on bumps.
    this.spec.buggy.antenna.rotation.y = reducedMotion ? 0 : Math.sin(this.time * 0.4) * 0.15;
    if (!this.riding) return;
    this.report();
    if (this.settle >= 0) return;
    // At the overlook: the first leg is done.
    if (!this.has("drive") && center.distanceTo(this.spec.overlook) < OVERLOOK_REACH + 0.6) {
      this.step("drive");
      this.beat("overlook");
      this.report(true);
    }
    // Back home, slow and lined up: roll into the marks.
    if (this.has("drive") && center.normalize().distanceTo(this.parkCenter) * this.spec.terrain.radius < PARK_REACH && Math.abs(m.speed) < 1.6) {
      const lined = m.heading.dot(projectOnTangent(this.parkHeading, m.front, scratchE).normalize());
      if (Math.abs(lined) > PARK_ANGLE) {
        this.settle = 0;
        this.settleTo.copy(this.parkHeading).multiplyScalar(Math.sign(lined));
        this.settleFrom.center.copy(m.center(scratchC));
        this.settleFrom.heading.copy(m.heading);
        this.beat("park-near");
      }
    }
  }

  /** For tests: drives the buggy (with a rider) to a named spot. */
  debugPlace(where: "overlook" | "near-park"): boolean {
    if (!this.canDrive) return false;
    const R = this.spec.terrain.radius;
    if (where === "overlook") {
      const toward = this.spec.overlook.clone().normalize();
      const back = projectOnTangent(this.parkCenter.clone().sub(toward), toward, new Vector3()).normalize();
      const from = toward.clone().multiplyScalar(R).addScaledVector(back, 2.2).normalize();
      this.motion.place(from, projectOnTangent(toward.clone().sub(from), from, new Vector3()));
    } else {
      const back = this.parkCenter.clone().multiplyScalar(R).addScaledVector(this.parkHeading, -1.3).normalize();
      this.motion.place(back, this.parkHeading);
    }
    this.pose();
    return true;
  }

  debugState(): { riding: boolean; speed: number; center: number[]; steps: string[] } {
    const r = (v: Vector3): number[] => v.toArray().map((x) => Math.round(x * 100) / 100);
    return { riding: this.riding, speed: Math.round(this.motion.speed * 100) / 100, center: r(this.motion.center()), steps: STEER_FROM_THE_BACK.steps.filter((s) => this.has(s.id)).map((s) => s.id) };
  }

  solve(): void {
    for (const flag of [startedFlag(ID), ...STEER_FROM_THE_BACK.steps.map((s) => stepFlag(ID, s.id))]) this.setFlag(flag);
    this.motion.place(this.parkCenter, this.parkHeading);
    this.pose();
    if (this.riding) this.getOut();
    else this.placeCollider();
    if (this.setFlag(doneFlag(ID))) this.spec.ctx.bus.emit("activity:done", { id: ID });
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.spec.sound.value = 0;
  }
}

const scratchC = new Vector3();
const scratchD = new Vector3();
const scratchE = new Vector3();
const scratchM = new Matrix4();
