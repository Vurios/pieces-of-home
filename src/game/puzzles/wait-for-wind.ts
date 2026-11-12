import { BufferAttribute, BufferGeometry, Color, Group, Matrix4, type MeshBasicMaterial, type Object3D, Points, type ShaderMaterial, Vector3 } from "three";
import { createBreezeFlag } from "../actors/props";
import { createMaterial } from "../render/particles";
import type { Shape } from "../world/colliders";
import { createRandom } from "../world/noise";
import { surfaceMatrix } from "../world/sphere";
import type { Terrain } from "../world/terrain";
import { WAIT_FOR_THE_WIND, doneFlag, startedFlag, stepFlag } from "../../content/chapters/activities";
import type { Site } from "../worlds/kit/little-world";
import type { Rover } from "../worlds/meridiani/machines";
import type { SoundSpot, WorldContext } from "../worlds/types";
import type { Activity } from "./types";

/**
 * Chapter 3's main activity, Wait for the Wind (Game Bible 6).
 *
 * Opportunity sleeps under a coat of red dust. Nobody can wipe the panels on
 * Mars, so Remi helps the wind instead: dust devils wander past along the
 * same lane, and each breeze flag pulls a passing devil toward it. Plant
 * flags to bend a devil's path over the rover, and the dust blows off the
 * panels, the power comes up and the rover wakes.
 *
 * Nothing can fail. Another dust devil always comes. Real wind did clean
 * Opportunity's panels (fact opp-cleaning); the flags are Dad's toy version.
 */
const ID = WAIT_FOR_THE_WIND.id;
const FLAGS = 3;
/** How far a flag's pull reaches, in world units. */
export const PULL = 3.6;
/** How close a devil must come to the rover's middle to sweep the panels. */
export const SWEEP = 2.0;
/** How far the devils' lane misses the rover, and how fast they go. */
const MISS = 4.7;
const SPEED = 1.2;
const TRAVEL = 27;
const FIRST_DEVIL = 2.5;
const EVERY = 10.5;
/** Each devil: a funnel of soft dust dots. */
const DOTS = 170;
const MAX_DEVILS = 2;

interface Devil {
  dir: Vector3;
  heading: Vector3;
  traveled: number;
  visited: Set<number>;
  closest: number;
  told: boolean;
  phase: number;
  sound: SoundSpot;
}

interface PlantedFlag {
  model: Group;
  cloth: Object3D;
  /** Where it stands in the ground, or null while on the rack or carried. */
  dir: Vector3 | null;
  /** Where to stand to pull it up. */
  spot: Vector3;
  matrixInverse: Matrix4;
  sway: number;
}

export interface WaitForWindSpec {
  ctx: WorldContext;
  root: Group;
  terrain: Terrain;
  rover: Rover;
  roverSite: Site;
  rack: Site;
  /** Where along the rover's frame the devils come from: a unit tangent the lane runs along, and the side it passes on. */
  lane: { along: Vector3; across: Vector3 };
  /** Two live sound spots the devils carry (see World.sounds). */
  sounds: [SoundSpot, SoundSpot];
  /** The camera's view of the panels being swept clean. */
  view: { position: Vector3; target: Vector3 };
}

export class WaitForTheWind implements Activity {
  readonly id = ID;
  readonly shapes: { rack: Shape[] };
  private flags: PlantedFlag[] = [];
  private devils: Devil[] = [];
  private points: Points<BufferGeometry, ShaderMaterial>;
  private positions: Float32Array;
  private alphas: Float32Array;
  private sizes: Float32Array;
  private random = createRandom(23);
  private spawnIn = FIRST_DEVIL;
  private time = 0;
  private feet = new Vector3();
  private rackPoint: Vector3;
  private roverDir: Vector3;
  private plantSpot = new Vector3();
  private offs: (() => void)[] = [];
  private toldAll = false;
  private lastMissed = -99;
  /** 1 is a full coat of dust, 0 is clean blue panels. */
  private dust = 1;
  private dustTarget = 1;
  /** 0 asleep, 1 awake and looking round. */
  private awake = 0;
  private awakeTarget = 0;
  private waking = -1;
  private meter = 0.12;
  private eyeOff = new Color("#3A3A46");
  private eyeOn = new Color("#8FE3FF");
  private stormy = false;

  constructor(private spec: WaitForWindSpec) {
    const { ctx, root, rack } = spec;
    this.rackPoint = new Vector3(0, 0, 0.55).applyMatrix4(rack.matrix);
    this.roverDir = spec.roverSite.dir.clone();
    // Three flags lean against Dad's rock until they are carried off.
    for (let i = 0; i < FLAGS; i += 1) {
      const model = createBreezeFlag(ctx.toon);
      model.matrixAutoUpdate = false;
      root.add(model);
      const cloth = model.getObjectByName("cloth")!;
      this.flags.push({ model, cloth, dir: null, spot: new Vector3(), matrixInverse: new Matrix4(), sway: this.random() * 10 });
    }
    this.shapes = { rack: [{ kind: "circle", x: 0, z: -0.1, radius: 0.32, height: 0.4 }] };

    // The dust devils, all in one draw call.
    const count = DOTS * MAX_DEVILS;
    this.positions = new Float32Array(count * 3);
    this.alphas = new Float32Array(count);
    this.sizes = new Float32Array(count);
    // Most dots are small and make the twisting wall; a few big soft ones make the dusty skirt at the bottom.
    for (let i = 0; i < count; i += 1) this.sizes[i] = i % DOTS < DOTS - 24 ? 0.07 + this.random() * 0.12 : 0.28 + this.random() * 0.24;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial("#B8744C", false, 0.38));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    root.add(this.points);

    this.addInteractions();
    this.offs.push(ctx.bus.on("activity:start", ({ id }) => id === ID && this.start()));
    if (this.done) {
      // The chapter is over: the rover went back to sleep in the long storm.
      this.dust = this.dustTarget = 1;
    }
    this.layFlags();
  }

  private get saved(): readonly string[] {
    return this.spec.ctx.store.value.flags;
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

  private carried(): number | null {
    const c = this.spec.ctx.store.value.carrying;
    return c?.startsWith("flag:") ? Number(c.slice(5)) : null;
  }

  private sfx(name: string, point: Vector3, param?: number): void {
    this.spec.ctx.bus.emit("sfx", { name, at: [point.x, point.y, point.z], ...(param === undefined ? {} : { param }) });
  }

  private beat(name: string): void {
    this.spec.ctx.bus.emit("activity:beat", { id: ID, beat: name });
  }

  start(): void {
    this.setFlag(startedFlag(ID));
    this.spawnIn = FIRST_DEVIL;
  }

  private addInteractions(): void {
    const { interactions, store } = this.spec.ctx;
    interactions.add({
      id: "flag-take",
      position: this.rackPoint,
      radius: 1.5,
      kind: "press",
      label: () => (this.started && !this.done && store.value.carrying === null && this.waiting() !== null ? "Take a breeze flag" : null),
      onDone: () => {
        const i = this.waiting();
        if (i === null) return;
        store.update((s) => void (s.carrying = `flag:${i}`));
        this.sfx("envelope-pickup", this.rackPoint);
      },
    });
    // Planting happens right where Remi stands, so this prompt follows the feet.
    interactions.add({
      id: "flag-plant",
      position: this.plantSpot,
      radius: 0.6,
      kind: "press",
      label: () => (this.carried() !== null && this.canPlant() ? "Plant the flag here" : null),
      onDone: () => this.plant(),
    });
    this.flags.forEach((f, i) => {
      interactions.add({
        id: `flag-pull-${i}`,
        position: f.spot,
        radius: 1.1,
        kind: "press",
        label: () => (f.dir && store.value.carrying === null && !this.done ? "Pull up the flag" : null),
        onDone: () => {
          f.dir = null;
          store.update((s) => void (s.carrying = `flag:${i}`));
          this.sfx("regolith-puff", f.model.position);
          this.layFlags();
        },
      });
    });
  }

  /** The first flag still on the rack, or null. */
  private waiting(): number | null {
    const carrying = this.carried();
    for (let i = 0; i < FLAGS; i += 1) if (!this.flags[i]!.dir && carrying !== i) return i;
    return null;
  }

  /** Not on top of another flag, and not too close to the rack. */
  private canPlant(): boolean {
    for (const f of this.flags) if (f.dir && f.model.position.distanceTo(this.feet) < 0.6) return false;
    return this.feet.distanceTo(this.rackPoint) > 1.2;
  }

  private plant(): void {
    const i = this.carried();
    if (i === null) return;
    const f = this.flags[i]!;
    f.dir = this.feet.clone().normalize();
    this.spec.ctx.store.update((s) => void (s.carrying = null));
    this.sfx("regolith-puff", this.feet);
    this.layFlags();
    const planted = this.flags.filter((x) => x.dir).length;
    if (this.setFlag(stepFlag(ID, "flags"))) {
      this.beat("planted");
      this.spec.ctx.bus.emit("activity:step", { id: ID, step: "flags" });
    } else if (planted === FLAGS && !this.toldAll) {
      this.toldAll = true;
      this.beat("all-flags");
    }
  }

  /** Puts each flag where it belongs: planted in the ground, or leaning on the rack. */
  private layFlags(): void {
    const { terrain, rack } = this.spec;
    const carrying = this.carried();
    this.flags.forEach((f, i) => {
      f.model.visible = carrying !== i;
      if (f.dir) {
        const ground = f.dir.clone().multiplyScalar(terrain.radiusAt(f.dir) - 0.04);
        const forward = new Vector3(0, 1, 0).cross(f.dir);
        if (forward.lengthSq() < 1e-6) forward.set(1, 0, 0);
        f.model.matrix.copy(surfaceMatrix(ground, f.dir, forward.normalize()));
      } else {
        // Leaning on the rock, fanned out a little.
        const lean = new Matrix4().makeRotationZ(0.32 + i * 0.12).premultiply(new Matrix4().makeRotationY(-0.5 + i * 0.5));
        lean.setPosition((i - 1) * 0.16, 0.02, 0.12);
        f.model.matrix.copy(rack.matrix).multiply(lean);
      }
      f.model.matrix.decompose(f.model.position, f.model.quaternion, f.model.scale);
      f.matrixInverse.copy(f.model.matrix).invert();
      f.model.matrixWorldNeedsUpdate = true;
      f.spot.copy(f.model.position);
    });
  }

  /** The world tells the activity where Remi's feet are each frame. */
  follow(feet: Vector3): void {
    this.feet.copy(feet);
    this.plantSpot.copy(feet);
  }

  /** The long storm after the chapter: the dust comes back and the rover falls asleep for good. */
  storm(on: boolean): void {
    this.stormy = on;
    if (on) {
      this.dustTarget = 1;
      this.awakeTarget = 0;
    }
  }

  objective(): Vector3 | null {
    if (!this.started || this.done) return null;
    const carrying = this.carried();
    if (carrying !== null) {
      // Point at the rover: the spot between the lane and the panels.
      return this.spec.roverSite.origin.clone().addScaledVector(this.spec.lane.across, 1.6);
    }
    if (!this.saved.includes(stepFlag(ID, "flags"))) return this.rackPoint;
    return null;
  }

  /** Starts a dust devil at the head of the lane. */
  private spawn(): void {
    const R = this.spec.terrain.radius;
    const { along, across } = this.spec.lane;
    // The lane's closest point to the rover, a little to one side or the other each time.
    const miss = (MISS + (this.random() - 0.5) * 1.2) / R;
    const close = this.roverDir.clone().multiplyScalar(Math.cos(miss)).addScaledVector(across, Math.sin(miss));
    const way = along.clone().addScaledVector(close, -along.dot(close)).normalize();
    // Then back along the great circle to where the devil starts.
    const a = TRAVEL / 2 / R;
    const dir = close.clone().multiplyScalar(Math.cos(a)).addScaledVector(way, -Math.sin(a)).normalize();
    const heading = way.clone().multiplyScalar(Math.cos(a)).addScaledVector(close, Math.sin(a)).normalize();
    const sound = this.spec.sounds.find((s) => !this.devils.some((d) => d.sound === s)) ?? this.spec.sounds[0];
    this.devils.push({ dir, heading, traveled: 0, visited: new Set(), closest: Infinity, told: false, phase: this.random() * 10, sound });
  }

  /** For tests and screenshots: a dust devil now. */
  devilNow(): void {
    if (this.devils.length < MAX_DEVILS) this.spawn();
  }

  private arc(a: Vector3, b: Vector3): number {
    return Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * this.spec.terrain.radius;
  }

  private stepDevils(dt: number): void {
    const R = this.spec.terrain.radius;
    const toward = new Vector3();
    for (const devil of this.devils) {
      // Each planted flag it has not reached yet pulls it round, harder when close.
      let best = -1;
      let bestDistance = PULL;
      this.flags.forEach((f, i) => {
        if (!f.dir || devil.visited.has(i)) return;
        const d = this.arc(devil.dir, f.dir);
        if (d < 0.55) devil.visited.add(i);
        else if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      if (best >= 0) {
        const f = this.flags[best]!.dir!;
        toward.copy(f).addScaledVector(devil.dir, -f.dot(devil.dir)).normalize();
        const k = Math.min(1, (1.4 + 2.6 * (1 - bestDistance / PULL)) * dt);
        devil.heading.lerp(toward, k);
      }
      devil.heading.addScaledVector(devil.dir, -devil.heading.dot(devil.dir)).normalize();
      const step = SPEED * dt;
      devil.dir.addScaledVector(devil.heading, step / R).normalize();
      devil.heading.addScaledVector(devil.dir, -devil.heading.dot(devil.dir)).normalize();
      devil.traveled += step;

      const fromRover = this.arc(devil.dir, this.roverDir);
      if (!this.done && this.waking < 0 && fromRover < 3.4 && fromRover < devil.closest && devil.visited.size > 0 && !devil.told) {
        devil.told = true;
        this.beat("cleaning");
      }
      if (!this.done && this.waking < 0 && fromRover < SWEEP) this.sweep();
      if (fromRover < devil.closest) devil.closest = fromRover;
      else if (!this.done && this.waking < 0 && devil.visited.size > 0 && devil.closest < 5.2 && fromRover > devil.closest + 1.4 && this.time - this.lastMissed > 18) {
        this.lastMissed = this.time;
        devil.closest = -1;
        this.beat("missed");
      }
    }
    this.devils = this.devils.filter((d) => {
      if (d.traveled < TRAVEL) return true;
      d.sound.value = 0;
      return false;
    });
  }

  /** A dust devil went right over the panels. */
  private sweep(): void {
    this.waking = 0;
    this.dustTarget = 0.06;
    this.setFlag(stepFlag(ID, "clean"));
    this.spec.ctx.bus.emit("activity:step", { id: ID, step: "clean" });
    const v = this.spec.view;
    this.spec.ctx.bus.emit("camera:cinematic", { position: v.position.toArray(), target: v.target.toArray(), seconds: 5.5 });
    this.sfx("regolith-puff", this.spec.rover.center, 2);
  }

  private drawDevils(): void {
    const R = this.spec.terrain.radius;
    const side = new Vector3();
    const p = new Vector3();
    this.alphas.fill(0);
    this.devils.forEach((devil, k) => {
      side.crossVectors(devil.dir, devil.heading).normalize();
      const ground = this.spec.terrain.radiusAt(devil.dir) - 0.05;
      const life = Math.min(1, devil.traveled / 2.5, (TRAVEL - devil.traveled) / 2.5);
      const wall = DOTS - 24;
      for (let i = 0; i < DOTS; i += 1) {
        const n = k * DOTS + i;
        let h: number;
        let r: number;
        let a: number;
        let alpha: number;
        if (i < wall) {
          // The wall: dots climb a few tight spirals, wider toward the top, spinning faster near the ground.
          const t = ((i / wall) + this.time * 0.18 + devil.phase) % 1;
          h = t * 2.5;
          r = 0.09 + Math.pow(t, 1.5) * 0.62;
          a = (i % 4) * (Math.PI / 2) + t * 13 + this.time * (7 - t * 4) + devil.phase;
          alpha = (0.85 - t * 0.5) * Math.min(1, t * 12) * Math.min(1, (1 - t) * 5);
        } else {
          // The skirt: big soft puffs rolling round the foot.
          const j = i - wall;
          h = 0.08 + (j % 3) * 0.1;
          r = 0.32 + (j % 5) * 0.07;
          a = j * 1.7 + this.time * 3.2 + devil.phase;
          alpha = 0.32;
        }
        // The funnel leans with its travel, the top trailing behind, and wobbles a little.
        const lean = -((h / 2.5) ** 2) * 0.5 + Math.sin(this.time * 1.7 + devil.phase) * 0.08 * (h / 2.5);
        p.copy(devil.dir)
          .multiplyScalar(ground + h)
          .addScaledVector(side, Math.cos(a) * r)
          .addScaledVector(devil.heading, Math.sin(a) * r + lean);
        this.positions[n * 3] = p.x;
        this.positions[n * 3 + 1] = p.y;
        this.positions[n * 3 + 2] = p.z;
        this.alphas[n] = life * alpha;
      }
      // The sound rides along, louder while it is strong.
      const s = devil.sound;
      s.position.x = devil.dir.x * (R + 1);
      s.position.y = devil.dir.y * (R + 1);
      s.position.z = devil.dir.z * (R + 1);
      s.value = life;
    });
    const g = this.points.geometry;
    g.attributes["position"]!.needsUpdate = true;
    g.attributes["aAlpha"]!.needsUpdate = true;
  }

  private flutter(dt: number, reducedMotion: boolean): void {
    const local = new Vector3();
    for (const f of this.flags) {
      if (!f.dir || !f.model.visible) continue;
      // The pennant streams toward the nearest devil in reach, or idles in a light breeze.
      let near: Devil | null = null;
      let best = PULL + 1.5;
      for (const d of this.devils) {
        const distance = this.arc(d.dir, f.dir);
        if (distance < best) {
          best = distance;
          near = d;
        }
      }
      let target = 0.6 + Math.sin(this.time * 0.3 + f.sway) * 0.5;
      if (near) {
        local.copy(near.dir).multiplyScalar(this.spec.terrain.radius).applyMatrix4(f.matrixInverse);
        target = Math.atan2(-local.z, local.x);
      }
      let delta = target - f.cloth.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      f.cloth.rotation.y += delta * Math.min(1, (near ? 6 : 1.5) * dt);
      f.cloth.rotation.x = reducedMotion ? 0 : Math.sin(this.time * (near ? 18 : 5) + f.sway) * (near ? 0.35 : 0.12);
    }
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const live = this.started && !this.done && this.waking < 0;
    if (live) {
      this.spawnIn -= dt;
      if (this.spawnIn <= 0 && this.devils.length < MAX_DEVILS) {
        this.spawn();
        this.spawnIn = EVERY;
      }
    }
    this.stepDevils(dt);
    this.drawDevils();
    this.flutter(dt, reducedMotion);
    // Held flags show on Remi; flags on the rack hide while one is carried.
    const carrying = this.carried();
    this.flags.forEach((f, i) => (f.model.visible = carrying !== i));

    // The wake: dust blows off, the power climbs, the mast lifts and looks round.
    if (this.waking >= 0) {
      this.waking += dt;
      if (this.waking > 1.2 && this.awakeTarget === 0) {
        this.awakeTarget = 1;
        this.sfx("solar-rise", this.spec.rover.center);
      }
      if (this.waking > 4.2) {
        this.waking = -1;
        this.setFlag(doneFlag(ID));
        this.spec.ctx.bus.emit("activity:meter", { id: ID, label: "", value: null });
        this.spec.ctx.bus.emit("activity:done", { id: ID });
        this.sfx("milo-happy", this.spec.rover.center);
      }
    }
    const rate = this.stormy ? 0.12 : 0.6;
    this.dust += (this.dustTarget - this.dust) * Math.min(1, dt * rate * (this.dustTarget < this.dust ? 2 : 1));
    this.awake += (this.awakeTarget - this.awake) * Math.min(1, dt * (this.stormy ? 0.25 : 1.4));
    const rover = this.spec.rover;
    rover.dust.opacity = 0.08 + 0.82 * this.dust;
    rover.dust.visible = rover.dust.opacity > 0.1;
    const eye = this.eyeOff.clone().lerp(this.eyeOn, this.awake);
    for (const l of rover.lights) (l.material as MeshBasicMaterial).color.copy(eye);
    rover.mastHead.rotation.x = 0.55 * (1 - this.awake);
    rover.mastHead.rotation.y = reducedMotion ? 0 : Math.sin(this.time * 0.5) * 0.7 * this.awake;
    rover.mastHead.position.y = 1.22 + 0.08 * this.awake;

    // The power gauge on screen, while the activity is on.
    if (this.started && !this.done) {
      const want = 0.12 + 0.88 * (1 - this.dust) * (this.waking >= 0 ? 1 : 0.2);
      const before = this.meter;
      this.meter += (want - this.meter) * Math.min(1, dt * 2);
      if (Math.abs(this.meter - before) > 0.002 || this.time < dt * 2) this.spec.ctx.bus.emit("activity:meter", { id: ID, label: "Rover power", value: this.meter });
    }
  }

  solve(): void {
    for (const flag of [startedFlag(ID), ...WAIT_FOR_THE_WIND.steps.map((s) => stepFlag(ID, s.id))]) this.setFlag(flag);
    this.spec.ctx.store.update((s) => {
      if (s.carrying?.startsWith("flag:")) s.carrying = null;
    });
    this.layFlags();
    this.devils = [];
    this.waking = 0;
    this.dustTarget = 0.06;
  }

  /**
   * For tests and screenshots: plants all three flags in a good path, one
   * beside the rover and two toward the lane, the way a player might.
   */
  debugGuide(): boolean {
    const R = this.spec.terrain.radius;
    const { along, across } = this.spec.lane;
    const spot = (out: number, back: number): Vector3 =>
      this.roverDir.clone().multiplyScalar(R).addScaledVector(across, out).addScaledVector(along, -back).normalize();
    const spots = [spot(1.35, 0), spot(2.9, 0.4), spot(4.1, 1.6)];
    this.spec.ctx.store.update((s) => {
      if (s.carrying?.startsWith("flag:")) s.carrying = null;
    });
    this.flags.forEach((f, i) => (f.dir = spots[i]!));
    this.layFlags();
    if (this.setFlag(stepFlag(ID, "flags"))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: "flags" });
    return true;
  }

  /** For tests: where the devils and planted flags are. */
  debugState(): { devils: number[][]; flags: (number[] | null)[]; dust: number; rover: number[] } {
    const r = (v: Vector3): number[] => v.toArray().map((x) => Math.round(x * 100) / 100);
    return { devils: this.devils.map((d) => r(d.dir)), flags: this.flags.map((f) => (f.dir ? r(f.dir) : null)), dust: Math.round(this.dust * 100) / 100, rover: r(this.roverDir) };
  }

  resize(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.points.geometry.dispose();
    this.points.material.dispose();
    for (const s of this.spec.sounds) s.value = 0;
  }
}

