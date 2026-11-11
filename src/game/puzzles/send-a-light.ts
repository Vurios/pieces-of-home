import { Color, Group, type InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { box, cylinder, sphere, torus } from "../actors/parts";
import { createMirrorPanel } from "../actors/props";
import type { Batcher } from "../render/kit";
import type { Shape } from "../world/colliders";
import type { Terrain } from "../world/terrain";
import { SEND_A_LIGHT, doneFlag, startedFlag, stepFlag } from "../../content/chapters/activities";
import { fact } from "../../content/facts";
import type { PaintedEarth } from "../worlds/kit/earth";
import { type Site, at } from "../worlds/kit/little-world";
import type { WorldContext } from "../worlds/types";
import { DottedBeam, Pulse } from "./beam";
import { type Mirror, angleOff, cornerAxes, cornerMirrors, trace } from "./optics";
import type { Activity } from "./types";

/**
 * Chapter 1's main activity, Send a Light, Get a Light (Game Bible 6).
 *
 * A dotted laser beam comes down from Earth onto Dad's practice frame. With
 * one flat mirror in it, the light bounces off into space. Carry the other two
 * mirrors over and the frame becomes the inside corner of a box: the light
 * goes straight back to Earth. Turn the frame and it still goes home. Then
 * send a blink from the Earth console: ping, and after the real round trip
 * time, pong. Last, all hundred cubes of the real array glint back at Earth.
 *
 * All of it is real ray math (src/game/puzzles/optics.ts). Solo: mirrors stay
 * where you put them. Nothing can fail.
 */
const ID = SEND_A_LIGHT.id;
/** Turning steps, in degrees. The corner works across all of them (tests/unit/optics.test.ts). */
export const YAWS = [0, 15, 30, 15, 0, -15, -30, -15];
/** Where the corner is aimed, in its own edge lengths: off the diagonal, so one mirror alone is hit first. */
export const AIM: [number, number, number] = [0.1, 0.22, 0.34];
/** How the corner is turned round its diagonal, chosen so one and two mirrors both miss Earth (tests/unit/optics.test.ts). */
export const TWIST = (285 * Math.PI) / 180;
export const CORNER_SIZE = 0.9;
const PANELS = ["a", "b"] as const;

/** The real round trip for light to the Moon and back, from facts.json. */
export function roundTripSeconds(): number {
  const match = /about ([\d.]+) seconds/.exec(fact("light-roundtrip").value);
  return match ? Number(match[1]) : 2.5;
}

export interface SendALightSpec {
  ctx: WorldContext;
  b: Batcher;
  root: Group;
  terrain: Terrain;
  rig: Site;
  console: Site;
  holders: [Site, Site];
  earth: PaintedEarth;
  earthRadius: number;
  /** The real array's hundred cubes, for the glint at the end. */
  glints: InstancedMesh;
}

export class SendALight implements Activity {
  readonly id = ID;
  readonly shapes: { rig: Shape[]; console: Shape[]; holder: Shape[] };
  private frame = new Group();
  private panels: Mesh[] = [];
  private held: Group[] = [];
  private beam = new DottedBeam(720, "#9CFFB6");
  private pulse = new Pulse("#E9FFD9");
  private yawIndex = 0;
  private yaw = 0;
  private turning = false;
  private flash = 0;
  private glint = -1;
  private time = 0;
  private path: Vector3[] = [];
  private home = false;
  private offs: (() => void)[] = [];
  private earthDirLocal: Vector3;
  private axes: [Vector3, Vector3, Vector3];
  private vertex: Vector3;
  private rigPoint: Vector3;
  private consolePoint: Vector3;
  private holderPoints: Vector3[];

  constructor(private spec: SendALightSpec) {
    const { ctx, b, rig, root } = spec;
    const m = rig.matrix;
    const earthPos = spec.earth.root.position;
    const inverse = m.clone().invert();
    this.earthDirLocal = earthPos.clone().applyMatrix4(inverse).normalize();
    this.axes = cornerAxes(this.earthDirLocal, new Vector3(0, 1, 0), TWIST);
    // Lift the corner so its lowest edge clears the turntable.
    let low = 0;
    for (const a of this.axes) for (const c of this.axes) if (a !== c) low = Math.min(low, (a.y + c.y) * CORNER_SIZE, a.y * CORNER_SIZE);
    this.vertex = new Vector3(0, 0.34 - low, 0);

    // ---- Dad's turntable, the corner frame and its mirrors ----
    b.place(cylinder(28), "#7A4E33", [0, 0.07, 0], [0, 0, 0], [0.78, 0.14, 0.78], m);
    b.place(cylinder(28), "#9A6A45", [0, 0.16, 0], [0, 0, 0], [0.7, 0.05, 0.7], m);
    b.place(torus(0.25), "#C9A04A", [0, 0.17, 0], [Math.PI / 2, 0, 0], [0.7, 0.7, 0.07], m);
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      b.place(box(0.002), i % 6 ? "#5E3B26" : "#F4ECDD", [Math.sin(a) * 0.62, 0.19, Math.cos(a) * 0.62], [0, a, 0], [0.012, 0.01, i % 6 ? 0.06 : 0.1], m);
    }
    this.frame.matrixAutoUpdate = true;
    const pivot = new Group();
    pivot.matrixAutoUpdate = false;
    pivot.matrix.copy(m);
    pivot.add(this.frame);
    root.add(pivot);
    const brass = ctx.toon.toon({ color: "#C9A04A", objectSpace: true, paint: 0.08 });
    const dark = ctx.toon.toon({ color: "#5E3B26", objectSpace: true, paint: 0.1 });
    const post = new Mesh(cylinder(10), dark);
    post.scale.set(0.06, this.vertex.y - 0.16, 0.06);
    post.position.set(0, 0.16 + (this.vertex.y - 0.16) / 2, 0);
    this.frame.add(post);
    const knuckle = new Mesh(sphere("low"), brass);
    knuckle.scale.setScalar(0.07);
    knuckle.position.copy(this.vertex);
    this.frame.add(knuckle);
    const rod = (a: Vector3, c: Vector3, r: number): void => {
      const mesh = new Mesh(cylinder(8), brass);
      const d = c.clone().sub(a);
      mesh.scale.set(r, d.length(), r);
      mesh.position.copy(a).lerp(c, 0.5);
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
      this.frame.add(mesh);
    };
    const [a0, a1, a2] = this.axes;
    const V = this.vertex;
    const tip = (axis: Vector3): Vector3 => V.clone().addScaledVector(axis, CORNER_SIZE);
    for (const axis of this.axes) rod(V, tip(axis), 0.022);
    for (const [p, q] of [[a0, a1], [a1, a2], [a2, a0]] as const) {
      const corner = V.clone().addScaledVector(p, CORNER_SIZE).addScaledVector(q, CORNER_SIZE);
      rod(tip(p), corner, 0.016);
      rod(tip(q), corner, 0.016);
    }
    // The mirrors: one is already in. Each sits just behind its face, shiny side in.
    const glass = ctx.toon.toon({ color: "#C6DDEA", objectSpace: true, paint: 0.02, emissive: "#A7CDE0", emissiveIntensity: 0.4 });
    const backing = ctx.toon.toon({ color: "#7A4E33", objectSpace: true, paint: 0.12 });
    const streak = ctx.toon.glow("#F4FBFF");
    for (let i = 0; i < 3; i += 1) {
      const n = this.axes[i]!;
      let u = this.axes[(i + 1) % 3]!;
      let w = this.axes[(i + 2) % 3]!;
      // Keep the basis right-handed so it is a true rotation.
      if (new Vector3().crossVectors(u, w).dot(n) < 0) [u, w] = [w, u];
      const panel = new Mesh(box(0.01), glass);
      panel.matrixAutoUpdate = false;
      const basis = new Matrix4().makeBasis(u, w, n);
      const center = V.clone().addScaledVector(u, CORNER_SIZE / 2).addScaledVector(w, CORNER_SIZE / 2).addScaledVector(n, -0.012);
      panel.matrix.compose(center, new Quaternion().setFromRotationMatrix(basis), new Vector3(CORNER_SIZE * 0.97, CORNER_SIZE * 0.97, 0.02));
      // A wooden backing board, so from behind it reads as a mirror tile on Dad's frame.
      const back = new Mesh(box(0.01), backing);
      back.position.z = -1.6;
      back.scale.set(1.04, 1.04, 1.4);
      panel.add(back);
      const shine = new Mesh(box(0.002), streak);
      shine.position.set(0.12, 0.05, 0.6);
      shine.rotation.z = 0.75;
      shine.scale.set(0.06, 0.7, 0.2);
      panel.add(shine);
      this.frame.add(panel);
      this.panels.push(panel);
    }

    // ---- The Earth console: a little desk with a telescope and one big button ----
    const cm = spec.console.matrix;
    b.place(box(0.04), "#7A4E33", [0, 0.38, 0], [0, 0, 0], [0.9, 0.06, 0.55], cm);
    for (const [x, z] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]] as const) b.place(cylinder(6), "#5E3B26", [x, 0.18, z], [0, 0, 0], [0.035, 0.36, 0.035], cm);
    b.place(box(0.03), "#3B4A6B", [0, 0.56, -0.12], [-0.35, 0, 0], [0.62, 0.3, 0.06], cm);
    b.place(box(0.01), "#9CFFB6", [0, 0.57, -0.1], [-0.35, 0, 0], [0.5, 0.2, 0.01], cm, "glow");
    b.place(cylinder(20), "#E0B34A", [0.18, 0.43, 0.12], [0, 0, 0], [0.09, 0.04, 0.09], cm);
    b.place(cylinder(20), "#D9583F", [0.18, 0.47, 0.12], [0, 0, 0], [0.065, 0.04, 0.065], cm);
    // A model of the telescope on Earth that fires the laser, aimed up at the sky.
    b.place(cylinder(12), "#EDEAE2", [-0.25, 0.62, 0.1], [-0.7, 0, 0.2], [0.07, 0.36, 0.07], cm);
    b.place(cylinder(12), "#2E2A2A", [-0.23, 0.76, 0.22], [-0.7, 0, 0.2], [0.075, 0.03, 0.075], cm);
    b.place(cylinder(6), "#8E8B86", [-0.25, 0.48, 0.05], [0, 0, 0], [0.03, 0.14, 0.03], cm);

    // ---- Two little easels, each holding a spare mirror ----
    spec.holders.forEach((h, i) => {
      const hm = h.matrix;
      b.place(cylinder(6), "#8A5A3A", [-0.22, 0.35, -0.05], [0.18, 0, 0.12], [0.03, 0.75, 0.03], hm);
      b.place(cylinder(6), "#8A5A3A", [0.22, 0.35, -0.05], [0.18, 0, -0.12], [0.03, 0.75, 0.03], hm);
      b.place(cylinder(6), "#8A5A3A", [0, 0.32, -0.28], [-0.35, 0, 0], [0.03, 0.7, 0.03], hm);
      b.place(box(0.01), "#8A5A3A", [0, 0.2, 0.04], [0, 0, 0], [0.56, 0.04, 0.1], hm);
      const held = createMirrorPanel(ctx.toon);
      held.scale.setScalar(1.25);
      held.position.copy(at(h, 0, 0.47, 0.0));
      held.quaternion.setFromRotationMatrix(hm).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.22));
      held.name = `held-${PANELS[i]}`;
      root.add(held);
      this.held.push(held);
    });

    this.shapes = {
      rig: [{ kind: "circle", x: 0, z: 0, radius: 0.82, height: 1.4 }],
      console: [{ kind: "box", x: 0, z: 0, halfWidth: 0.48, halfDepth: 0.32, height: 0.8 }],
      holder: [{ kind: "circle", x: 0, z: -0.08, radius: 0.32, height: 1 }],
    };

    root.add(this.beam.points, this.pulse.points);
    this.rigPoint = at(rig, 0, 0, 0);
    this.consolePoint = at(spec.console, 0, 0, 0.75);
    this.holderPoints = spec.holders.map((h) => at(h, 0, 0, 0.55));
    this.addInteractions();
    this.offs.push(ctx.bus.on("activity:start", ({ id }) => id === ID && this.start()));

    // A save from part way through: everything delivered but the activity never began.
    this.refresh();
    if (this.started) this.beam.show(true);
  }

  private get flags(): readonly string[] {
    return this.spec.ctx.store.value.flags;
  }

  private get started(): boolean {
    return this.flags.includes(startedFlag(ID));
  }

  private placed(panel: string): boolean {
    return this.flags.includes(`${ID}:mirror-${panel}`);
  }

  private get mirrorCount(): number {
    return 1 + PANELS.filter((p) => this.placed(p)).length;
  }

  private setFlag(flag: string): boolean {
    if (this.flags.includes(flag)) return false;
    this.spec.ctx.store.update((s) => void s.flags.push(flag));
    return true;
  }

  private sfx(name: string, point: Vector3, param?: number): void {
    this.spec.ctx.bus.emit("sfx", { name, at: [point.x, point.y, point.z], ...(param === undefined ? {} : { param }) });
  }

  private beat(name: string): void {
    this.spec.ctx.bus.emit("activity:beat", { id: ID, beat: name });
  }

  start(): void {
    this.setFlag(startedFlag(ID));
    this.beam.show(true);
    this.refresh();
    this.sfx("laser-ping", this.rigPoint);
  }

  private addInteractions(): void {
    const { interactions, store } = this.spec.ctx;
    PANELS.forEach((panel, i) => {
      interactions.add({
        id: `mirror-${panel}`,
        position: this.holderPoints[i]!,
        radius: 1.4,
        kind: "press",
        label: () => (this.started && !this.placed(panel) && store.value.carrying === null ? "Pick up the mirror" : null),
        onDone: () => {
          store.update((s) => void (s.carrying = `mirror:${panel}`));
          this.sfx("mirror-snap", this.holderPoints[i]!);
        },
      });
    });
    interactions.add({
      id: "frame-fit",
      position: this.rigPoint,
      radius: 1.9,
      kind: "press",
      label: () => (store.value.carrying?.startsWith("mirror:") ? "Fit the mirror into the corner" : null),
      onDone: () => {
        const panel = store.value.carrying?.slice(7) ?? "a";
        store.update((s) => {
          s.carrying = null;
          if (!s.flags.includes(`${ID}:mirror-${panel}`)) s.flags.push(`${ID}:mirror-${panel}`);
        });
        this.sfx("mirror-snap", this.rigPoint);
        this.refresh();
        if (this.mirrorCount === 3) {
          this.sfx("corner-sparkle", this.rigPoint);
          this.flash = 1;
          this.beat("home");
          if (this.setFlag(stepFlag(ID, "mirrors"))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: "mirrors" });
        } else this.beat(this.home ? "home" : "miss-two");
        this.checkDone();
      },
    });
    interactions.add({
      id: "frame-turn",
      position: this.rigPoint.clone().addScaledVector(this.spec.rig.forward, 0.01),
      radius: 1.9,
      kind: "press",
      label: () => (this.started && !store.value.carrying?.startsWith("mirror:") && !this.turning ? "Turn the frame" : null),
      onDone: () => {
        this.yawIndex = (this.yawIndex + 1) % YAWS.length;
        this.turning = true;
        this.sfx("servo", this.rigPoint);
      },
    });
    interactions.add({
      id: "earth-console",
      position: this.consolePoint,
      radius: 1.6,
      kind: "press",
      label: () => (this.started && !this.pulse.flying ? "Send a light from Earth" : null),
      onDone: () => this.fire(),
    });
  }

  /** Sends one blink from Earth along the beam. */
  fire(): void {
    if (this.pulse.flying) return;
    const seconds = roundTripSeconds();
    const returned = this.home;
    // The pulse keeps the real speed: Earth to Moon is half the round trip.
    const toMoon = this.path[0]!.distanceTo(this.path[1]!);
    let length = 0;
    for (let i = 1; i < this.path.length; i += 1) length += this.path[i]!.distanceTo(this.path[i - 1]!);
    const time = returned ? seconds : (seconds / 2) * (length / toMoon);
    this.sfx("laser-ping", this.consolePoint);
    this.spec.ctx.bus.emit("say", { speaker: "remi", name: "Remi", text: "Ping...", at: null });
    this.pulse.fire(this.path, time, () => {
      if (!returned) {
        this.beat("pulse-miss");
        return;
      }
      this.sfx("laser-pong", this.consolePoint);
      this.flash = 1;
      this.spec.ctx.bus.emit("say", { speaker: "remi", name: "Remi", text: "...pong!", at: null });
      if (this.mirrorCount === 3 && this.setFlag(stepFlag(ID, "pulse"))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: "pulse" });
      this.checkDone();
    });
  }

  private checkDone(): void {
    const all = SEND_A_LIGHT.steps.every((s) => this.flags.includes(stepFlag(ID, s.id)));
    if (!all || this.flags.includes(doneFlag(ID)) || this.glint >= 0) return;
    // The finale: every cube of the real array glints back at Earth, row by row.
    window.setTimeout(() => {
      this.glint = 0;
      this.sfx("corner-sparkle", this.spec.glints.position);
    }, 1400);
  }

  /** Rebuilds the mirrors and traces the beam again. */
  private refresh(): void {
    const count = this.mirrorCount;
    this.panels[0]!.visible = count >= 1;
    this.panels[1]!.visible = this.placed("a");
    this.panels[2]!.visible = this.placed("b");
    const carrying = this.spec.ctx.store.value.carrying;
    PANELS.forEach((p, i) => (this.held[i]!.visible = !this.placed(p) && carrying !== `mirror:${p}`));

    this.frame.rotation.y = (this.yaw * Math.PI) / 180;
    this.frame.updateMatrixWorld(true);
    const world = this.frame.matrixWorld;
    const axes = this.axes.map((a) => a.clone().transformDirection(world)) as [Vector3, Vector3, Vector3];
    const vertex = this.vertex.clone().applyMatrix4(world);
    // Which faces have glass: face 0 always, then a and b.
    const faces = cornerMirrors(vertex, axes, CORNER_SIZE, 3);
    const live: Mirror[] = [faces[0]!];
    if (this.placed("a")) live.push(faces[1]!);
    if (this.placed("b")) live.push(faces[2]!);
    const aim = vertex.clone().addScaledVector(axes[0], AIM[0] * CORNER_SIZE).addScaledVector(axes[1], AIM[1] * CORNER_SIZE).addScaledVector(axes[2], AIM[2] * CORNER_SIZE);
    const earth = this.spec.earth.root.position;
    const down = aim.clone().sub(earth).normalize();
    const start = earth.clone().addScaledVector(down, this.spec.earthRadius * 1.02);
    const result = trace(start, down, live, 90);
    const back = down.clone().negate();
    this.home = angleOff(result.out, back) < 0.01;
    const points = result.points;
    const last = points[points.length - 2]!;
    if (this.home) points[points.length - 1] = earth.clone().addScaledVector(down, this.spec.earthRadius * 1.02);
    else points[points.length - 1] = this.clip(last, result.out, 90);
    this.path = points;
    this.beam.setPath(points);
  }

  /** Cuts a ray where it meets the ground. */
  private clip(from: Vector3, dir: Vector3, length: number): Vector3 {
    const p = new Vector3();
    for (let d = 0.1; d < length; d += 0.15) {
      p.copy(from).addScaledVector(dir, d);
      const r = p.length();
      if (r < this.spec.terrain.radiusAt(p.clone().normalize())) return p;
      if (r > this.spec.terrain.radius + 6) return from.clone().addScaledVector(dir, length);
    }
    return from.clone().addScaledVector(dir, length);
  }

  objective(): Vector3 | null {
    if (!this.started || this.flags.includes(doneFlag(ID))) return null;
    const carrying = this.spec.ctx.store.value.carrying;
    if (carrying?.startsWith("mirror:")) return this.rigPoint;
    if (!this.flags.includes(stepFlag(ID, "mirrors"))) {
      const i = PANELS.findIndex((p) => !this.placed(p));
      return i >= 0 ? this.holderPoints[i]! : this.rigPoint;
    }
    if (!this.flags.includes(stepFlag(ID, "turn"))) return this.rigPoint;
    if (!this.flags.includes(stepFlag(ID, "pulse"))) return this.consolePoint;
    return null;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    // The frame turns smoothly to its next step, then the beam is traced again.
    const target = YAWS[this.yawIndex]!;
    if (this.turning) {
      const step = (reducedMotion ? 400 : 40) * dt;
      this.yaw += Math.max(-step, Math.min(step, target - this.yaw));
      this.refresh();
      if (Math.abs(target - this.yaw) < 0.01) {
        this.yaw = target;
        this.turning = false;
        this.refresh();
        if (this.mirrorCount === 3) {
          if (this.setFlag(stepFlag(ID, "turn"))) {
            this.beat("turned");
            this.spec.ctx.bus.emit("activity:step", { id: ID, step: "turn" });
          }
          this.flash = 1;
          this.checkDone();
        } else this.beat("turned-miss");
      }
    }
    // Held mirrors appear and vanish with the save.
    const carrying = this.spec.ctx.store.value.carrying;
    PANELS.forEach((p, i) => (this.held[i]!.visible = !this.placed(p) && carrying !== `mirror:${p}`));
    this.beam.update(dt, reducedMotion);
    this.pulse.update(dt);
    this.flash = Math.max(0, this.flash - dt * 0.8);
    this.spec.earth.flash = this.flash;

    // The glint: a wave across the hundred cubes, then a soft twinkle for good.
    const g = this.spec.glints;
    const done = this.flags.includes(doneFlag(ID));
    if (this.glint >= 0) {
      this.glint += dt;
      for (let i = 0; i < 100; i += 1) {
        const row = Math.floor(i / 10) + (i % 10);
        const t = this.glint * 9 - row;
        const k = t < 0 ? 0 : Math.max(0.35, Math.exp(-t * 0.5));
        g.setColorAt(i, color.setRGB(0.12 + 0.88 * k, 0.14 + 0.86 * k, 0.2 + 0.8 * k));
      }
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
      if (this.glint > 3.2) {
        this.glint = -1;
        this.setFlag(doneFlag(ID));
        this.spec.ctx.bus.emit("activity:done", { id: ID });
      }
    } else if (done && !reducedMotion) {
      const i = Math.floor(this.time * 7) % 100;
      for (let j = 0; j < 100; j += 1) g.setColorAt(j, color.setRGB(0.42, 0.45, 0.52));
      g.setColorAt(i, color.setRGB(1, 1, 1));
      g.setColorAt((i * 37) % 100, color.setRGB(0.8, 0.85, 0.9));
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
    }
  }

  solve(): void {
    for (const flag of [startedFlag(ID), `${ID}:mirror-a`, `${ID}:mirror-b`, ...SEND_A_LIGHT.steps.map((s) => stepFlag(ID, s.id))]) this.setFlag(flag);
    this.spec.ctx.store.update((s) => {
      if (s.carrying?.startsWith("mirror:")) s.carrying = null;
    });
    this.beam.show(true);
    this.refresh();
    this.glint = 0;
  }

  resize(pixelHeight: number): void {
    this.beam.setScale(pixelHeight);
    this.pulse.setScale(pixelHeight);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.beam.dispose();
    this.pulse.dispose();
  }
}

const color = new Color();
