import { Group, type Material, Matrix4, type Object3D, PointLight, Quaternion, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { QualitySettings } from "../../core/quality";
import { Batcher, type Layer } from "../../render/kit";
import { Floaters, Smoke } from "../../render/particles";
import { type ColliderGroup, type Shape, createColliderGroup } from "../../world/colliders";
import { createRandom } from "../../world/noise";
import { surfaceMatrix } from "../../world/sphere";
import type { Terrain } from "../../world/terrain";
import { C } from "./buildings";
import { MEADOW, ORCHARD, POND, POND_RADIUS, SITES, type Site, toward } from "./layout";
import { LEAVES, canopy, flowerDrift, grassClump, groundMatrix } from "./nature";
import { rod } from "./yard";

/**
 * The places to find round the far side of Home. Each one is a small scene
 * that tells a story without words: a treehouse with a red door, a pond with
 * a rowboat tied to the dock, a campfire with marshmallow sticks, Dad's
 * weather station with its spinning cups, a playground, his model rocket on
 * its pad, and an orchard with beehives. A kite flies over the meadow.
 *
 * Still pieces go into the shared batch. Pieces that move (the fire, the
 * cups, the swing, the kite) are batched on their own and turned each frame.
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const P = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** A child frame: `parent` moved to (x, y, z) and turned `yaw` radians about its up. */
function frame(parent: Matrix4, x: number, y: number, z: number, yaw = 0): Matrix4 {
  return parent.clone().multiply(new Matrix4().compose(P(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), ONE));
}

/** A rope that sags between two points. */
function sag(b: Batcher, m: Matrix4, a: Vector3, c: Vector3, drop: number, radius: number, color: string, steps = 8): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    points.push(a.clone().lerp(c, t).setY(a.y + (c.y - a.y) * t - Math.sin(t * Math.PI) * drop));
  }
  for (let i = 0; i < steps; i += 1) rod(b, m, points[i]!, points[i + 1]!, radius, color, "solid", 5);
  return points;
}

/**
 * A flat diamond: a square turned 45 degrees, then stretched. With its lower
 * half sunk inside a wall or the ground it makes a gable end or a tent end.
 */
function diamond(b: Batcher, m: Matrix4, at: Vector3, halfWidth: number, halfHeight: number, depth: number, color: string, tilt = 0, layer: Layer = "solid"): void {
  const shape = new Matrix4()
    .makeRotationZ(Math.PI / 4)
    .premultiply(new Matrix4().makeScale(halfWidth / Math.SQRT1_2, halfHeight / Math.SQRT1_2, depth))
    .premultiply(new Matrix4().makeRotationX(tilt))
    .premultiply(new Matrix4().makeTranslation(at.x, at.y, at.z))
    .premultiply(m);
  b.add(box(0.01), shape, color, layer);
}

/** A simple slatted bench, facing local +Z. */
function bench(b: Batcher, m: Matrix4, width = 1.1): Shape {
  b.place(box(0.02), C.woodLight, v(0, 0.42, 0), [0, 0, 0], [width, 0.06, 0.36], m);
  b.place(box(0.02), C.woodLight, v(0, 0.72, -0.17), [-0.15, 0, 0], [width, 0.22, 0.05], m);
  for (const sx of [-1, 1]) {
    b.place(box(0.01), C.woodDark, v(sx * (width / 2 - 0.08), 0.2, 0), [0, 0, 0], [0.07, 0.4, 0.32], m);
    b.place(box(0.01), C.woodDark, v(sx * (width / 2 - 0.08), 0.58, -0.17), [-0.15, 0, 0], [0.06, 0.34, 0.05], m);
  }
  return { kind: "box", x: 0, z: -0.04, halfWidth: width / 2, halfDepth: 0.2, height: 0.85 };
}

/** A part that moves: painted like the rest of the kit, but in its own group so it can turn. */
class Mover {
  readonly group = new Group();
  private readonly base: Matrix4;
  private readonly pose = new Matrix4();

  constructor(base: Matrix4, materials: Partial<Record<Layer, Material>>, shadow: boolean, build: (b: Batcher) => void) {
    this.base = base.clone();
    const b = new Batcher();
    build(b);
    for (const mesh of b.build(materials, { castShadow: shadow, receiveShadow: true })) this.group.add(mesh);
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(this.base);
  }

  /** Sets the moving part's own transform, in its base frame. */
  set(local: Matrix4): void {
    this.group.matrix.multiplyMatrices(this.base, local);
    this.group.matrixWorldNeedsUpdate = true;
  }

  turnY(angle: number): void {
    this.set(this.pose.makeRotationY(angle));
  }
}

/** Particles that live with a place. */
interface Drifting {
  points: Object3D;
  update(dt: number, reducedMotion: boolean): void;
  setScale(pixelHeight: number): void;
  dispose(): void;
}

export interface PlacesResult {
  colliders: ColliderGroup[];
  /** Moving parts, lights and particles to add to the world. */
  objects: Object3D[];
  /** Ground that is shallow water, for footsteps. */
  isWater(dir: Vector3): boolean;
  update(dt: number, time: number, reducedMotion: boolean): void;
  resize(pixelHeight: number): void;
  dispose(): void;
}

// ---------------------------------------------------------------- treehouse

function buildTreehouse(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const random = createRandom(41);
  // The big old oak it is built in.
  b.place(cylinder(10, 0.7), C.woodDark, v(0, 1.75, 0), [0, 0, 0], [0.42, 3.5, 0.42], m);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.place(cone(5), C.woodDark, v(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4), [Math.sin(a) * 0.95, 0, -Math.cos(a) * 0.95], [0.12, 0.5, 0.12], m);
  }
  rod(b, m, P(0, 3.0, 0), P(1.35, 4.3, -0.3), 0.11, C.woodDark, "solid", 7);
  rod(b, m, P(0, 3.2, 0), P(-1.3, 4.4, 0.35), 0.1, C.woodDark, "solid", 7);
  rod(b, m, P(0, 2.7, 0), P(1.95, 3.75, -0.9), 0.08, C.woodDark, "solid", 6);
  canopy(b, m, random, LEAVES, 2.3, 2.45, 0.78, true);

  // The deck, on four braces.
  const deck = 2.2;
  b.place(box(0.02), C.wood, v(0, deck, 0.15), [0, 0, 0], [2.7, 0.14, 2.7], m);
  for (let i = 0; i < 9; i += 1) b.place(box(0.004), "#8E6040", v(-1.2 + i * 0.3, deck + 0.072, 0.15), [0, 0, 0], [0.014, 0.006, 2.7], m);
  b.place(box(0.01), C.woodDark, v(0, deck - 0.1, 1.5), [0, 0, 0], [2.72, 0.12, 0.06], m);
  for (const [x, z] of [
    [-1.2, -1.1],
    [1.2, -1.1],
    [-1.2, 1.4],
    [1.2, 1.4],
  ] as const) rod(b, m, P(x * 0.2, 1.35, z * 0.2), P(x, deck - 0.08, z), 0.05, C.wood, "solid", 6);

  // The hut, built round the trunk. Sage walls, a slate roof, a red door.
  const wall = "#8FAE8B";
  const floor = deck + 0.07;
  b.place(box(0.03), wall, v(0, floor + 0.6, -0.25), [0, 0, 0], [1.6, 1.2, 1.6], m);
  for (const [x, z] of [
    [-0.8, -1.05],
    [0.8, -1.05],
    [-0.8, 0.55],
    [0.8, 0.55],
  ] as const) b.place(box(0.01), C.paper, v(x, floor + 0.6, z), [0, 0, 0], [0.07, 1.2, 0.07], m);
  diamond(b, m, P(0, floor + 1.2, -0.25), 0.8, 0.75, 1.58, wall);
  const slope = Math.atan2(0.94, 1.0);
  for (const side of [-1, 1]) {
    b.place(box(0.02), "#5C7393", v(side * 0.53, floor + 1.53, -0.25), [0, 0, -side * slope], [1.42, 0.07, 1.95], m);
  }
  b.place(cylinder(8), "#4A5E7A", v(0, floor + 2.0, -0.25), [Math.PI / 2, 0, 0], [0.055, 1.95, 0.055], m);
  // Door and knob.
  b.place(box(0.01), C.clay, v(0.28, floor + 0.45, 0.565), [0, 0, 0], [0.48, 0.88, 0.04], m);
  b.place(box(0.004), C.clayDark, v(0.28, floor + 0.45, 0.59), [0, 0, 0], [0.36, 0.02, 0.01], m);
  b.place(sphere("tiny"), C.brass, v(0.1, floor + 0.45, 0.6), [0, 0, 0], 0.03, m);
  // A round window with a warm light inside, and a square one on the side.
  b.place(cylinder(16), C.windowWarm, v(-0.4, floor + 0.78, 0.57), [Math.PI / 2, 0, 0], [0.17, 0.02, 0.17], m, "glow");
  b.place(torus(0.16), C.paper, v(-0.4, floor + 0.78, 0.58), [0, 0, 0], 0.19, m);
  b.place(box(0.004), C.paper, v(-0.4, floor + 0.78, 0.585), [0, 0, 0], [0.34, 0.025, 0.01], m);
  b.place(box(0.004), C.paper, v(-0.4, floor + 0.78, 0.585), [0, 0, 0], [0.025, 0.34, 0.01], m);
  b.place(box(0.01), C.windowWarm, v(0.81, floor + 0.75, -0.3), [0, 0, 0], [0.03, 0.34, 0.34], m, "glow");
  b.place(box(0.01), C.paper, v(0.82, floor + 0.75, -0.3), [0, 0, 0], [0.03, 0.42, 0.06], m);
  b.place(box(0.01), C.paper, v(0.82, floor + 0.55, -0.3), [0, 0, 0], [0.05, 0.04, 0.46], m);

  // Railing round the front porch, open where the rope ladder comes up.
  const rail = floor + 0.55;
  const post = (x: number, z: number): void => b.place(box(0.01), C.woodLight, v(x, floor + 0.3, z), [0, 0, 0], [0.07, 0.6, 0.07], m);
  for (const x of [1.3, 0.65, 0.0, -0.4, -1.0, -1.3]) post(x, 1.47);
  for (const z of [0.55, 1.0]) for (const x of [-1.3, 1.3]) post(x, z);
  b.place(box(0.01), C.woodLight, v(0.45, rail, 1.47), [0, 0, 0], [1.75, 0.06, 0.06], m);
  b.place(box(0.01), C.woodLight, v(-1.15, rail, 1.47), [0, 0, 0], [0.32, 0.06, 0.06], m);
  for (const x of [-1.3, 1.3]) b.place(box(0.01), C.woodLight, v(x, rail, 1.0), [0, 0, 0], [0.06, 0.06, 0.95], m);
  for (let i = 0; i < 7; i += 1) b.place(box(0.004), C.paper, v(-0.3 + i * 0.25, floor + 0.28, 1.47), [0, 0, 0], [0.03, 0.5, 0.03], m);

  // The rope ladder.
  const rope = "#D9C9A8";
  for (const x of [-0.88, -0.52]) rod(b, m, P(x, deck + 0.05, 1.48), P(x, 0.02, 1.9), 0.014, rope, "solid", 5);
  for (let i = 1; i < 8; i += 1) {
    const t = i / 8;
    b.place(box(0.01), C.wood, v(-0.7, deck * (1 - t), 1.48 + 0.42 * t), [0, 0, 0], [0.44, 0.04, 0.07], m);
  }

  // Pennants strung from the railing to the hut.
  const flags = sag(b, m, P(1.3, floor + 0.62, 1.47), P(-0.8, floor + 1.2, 0.58), 0.18, 0.008, C.paper, 8);
  const colors = [C.amber, C.clay, "#6E8FB0", C.paper];
  for (let i = 1; i < flags.length - 1; i += 1) {
    const p = flags[i]!;
    b.place(cone(3), colors[i % colors.length]!, v(p.x, p.y - 0.08, p.z), [Math.PI, 0.6, 0], [0.07, 0.14, 0.015], m);
  }

  // A tire swing on the low branch.
  rod(b, m, P(1.75, 3.6, -0.83), P(1.75, 0.82, -0.83), 0.012, rope, "solid", 5);
  b.place(torus(0.36), "#3A3533", v(1.75, 0.58, -0.83), [0, 0.5, 0], 0.27, m);

  // Grass round the roots.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    grassClump(b, frame(m, Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75, a), random, 7, 1.2);
  }

  return [
    { kind: "circle", x: 0, z: 0, radius: 0.48, height: 2.0 },
    { kind: "box", x: -0.7, z: 1.72, halfWidth: 0.26, halfDepth: 0.12, height: 1.6 },
    { kind: "circle", x: 1.75, z: -0.83, radius: 0.3, height: 0.9, base: 0.28 },
  ];
}

// ---------------------------------------------------------------- pond

function buildPond(b: Batcher, terrain: Terrain): ColliderGroup[] {
  // Water level sits just under the bank, so the water meets the grass.
  const bank = toward(POND, SITES.camp.dir, POND_RADIUS - 0.2);
  const level = terrain.radiusAt(bank) - 0.06;
  const m = surfaceMatrix(POND.clone().multiplyScalar(level), POND, SITES.camp.dir.clone().sub(POND));
  const random = createRandom(31);
  const R = POND_RADIUS;

  b.place(cylinder(32), "#6E8FB0", v(0, -0.03, 0), [0, 0, 0], [R - 0.05, 0.06, R - 0.05], m);
  b.place(cylinder(28), "#86A7C4", v(0.5, 0.004, -0.4), [0, 0.4, 0], [1.6, 0.01, 1.15], m);
  for (const [x, z, r] of [
    [-1.0, -0.7, 0.32],
    [-1.0, -0.7, 0.55],
    [1.2, 0.9, 0.3],
  ] as const) b.place(torus(0.05), "#A9C2D8", v(x, 0.008, z), [Math.PI / 2, 0, 0], [r, r, 0.4], m);

  // Lily pads, a few in flower, and one with a frog.
  for (let i = 0; i < 8; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 0.9 + random() * 1.4;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.45 && r > 1.1) continue;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    b.place(cylinder(10), "#7FA37A", v(x, 0.01, z), [0, a, 0], [0.22, 0.015, 0.22], m);
    if (i % 3 === 0) b.place(sphere("low"), i % 2 ? "#F4ECDD" : "#F2B6C6", v(x + 0.05, 0.05, z), [0, 0, 0], [0.06, 0.045, 0.06], m);
  }
  const frog = frame(m, -1.35, 0, 0.6, 0.8);
  b.place(cylinder(10), "#7FA37A", v(0, 0.01, 0), [0, 0, 0], [0.24, 0.015, 0.24], frog);
  b.place(sphere("low"), "#6E9A4A", v(0, 0.07, 0), [0, 0, 0], [0.09, 0.065, 0.11], frog);
  for (const sx of [-1, 1]) {
    b.place(sphere("tiny"), "#8DBA62", v(sx * 0.045, 0.12, 0.05), [0, 0, 0], 0.035, frog);
    b.place(sphere("tiny"), C.ink, v(sx * 0.05, 0.13, 0.075), [0, 0, 0], 0.016, frog);
  }

  // Reeds and cattails round the bank, kept clear of the dock.
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2 + random() * 0.2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.45) continue;
    const r = R + 0.05 + random() * 0.35;
    const h = 0.55 + random() * 0.4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    b.place(cylinder(4), "#6E9470", v(x, 0.06 + h / 2, z), [random() * 0.2 - 0.1, 0, random() * 0.2 - 0.1], [0.018, h, 0.018], m, "foliage", 0.9);
    if (i % 3 === 0) b.place(cylinder(6), "#7A4A2E", v(x, 0.06 + h * 0.86, z), [0, 0, 0], [0.032, 0.14, 0.032], m, "foliage", 0.9);
    if (i % 4 === 1) b.place(sphere("low"), random() < 0.5 ? C.stone : C.stoneLight, v(x * 0.97, 0.06, z * 0.97), [random(), random(), 0], [0.2, 0.1, 0.16], m);
  }

  // The dock, reaching out from the bank where the camp path arrives.
  const z0 = R + 0.75;
  const z1 = 1.2;
  for (let z = z1; z <= z0; z += 0.19) {
    b.place(box(0.01), Math.round(z * 10) % 2 ? C.woodLight : "#BC9062", v(0, 0.2, z), [0, (random() - 0.5) * 0.04, 0], [0.95, 0.05, 0.17], m);
  }
  for (const x of [-0.4, 0.4]) b.place(box(0.01), C.woodDark, v(x, 0.13, (z0 + z1) / 2), [0, 0, 0], [0.08, 0.1, z0 - z1], m);
  for (const z of [z1, 2.3, z0 - 0.1]) {
    for (const x of [-0.47, 0.47]) {
      b.place(cylinder(8), C.woodDark, v(x, -0.04, z), [0, 0, 0], [0.06, 0.72, 0.06], m);
      b.place(cylinder(8), C.wood, v(x, 0.33, z), [0, 0, 0], [0.065, 0.02, 0.065], m);
    }
  }
  // A bucket and a fishing rod with its line in the water.
  b.place(cylinder(10, 1.2), "#6E8FB0", v(-0.22, 0.31, 2.0), [0, 0, 0], [0.11, 0.18, 0.11], m);
  b.place(torus(0.08, Math.PI), C.metalDark, v(-0.22, 0.4, 2.0), [0, 0.4, 0], 0.11, m);
  rod(b, m, P(-0.32, 0.24, 1.5), P(-1.15, 1.25, 0.25), 0.012, C.woodDark, "solid", 5);
  b.place(cylinder(8), C.metalDark, v(-0.42, 0.37, 1.36), [0, 0, Math.PI / 2], [0.035, 0.04, 0.035], m);
  rod(b, m, P(-1.15, 1.25, 0.25), P(-1.55, 0.03, -0.35), 0.004, C.paper, "solid", 4);
  b.place(sphere("low"), C.clay, v(-1.55, 0.03, -0.35), [0, 0, 0], 0.045, m);
  b.place(sphere("low"), C.paper, v(-1.55, 0.07, -0.35), [0, 0, 0], 0.03, m);

  // The rowboat, tied to the end post.
  const boat = frame(new Matrix4(), 1.05, 0, 0.75, 0.32);
  const boatM = m.clone().multiply(boat);
  b.place(sphere("mid"), C.cream, v(0, 0.02, 0), [0, 0, 0], [0.43, 0.24, 0.95], boatM);
  b.place(sphere("mid"), "#8E6040", v(0, 0.08, 0), [0, 0, 0], [0.37, 0.2, 0.86], boatM);
  b.place(sphere("mid"), "#6E8FB0", v(0, 0.0, 0), [0, 0, 0], [0.44, 0.08, 0.96], boatM);
  for (const z of [-0.32, 0.3]) b.place(box(0.01), C.woodLight, v(0, 0.27, z), [0, 0, 0], [0.7, 0.04, 0.14], boatM);
  for (const side of [-1, 1]) {
    rod(b, boatM, P(side * 0.12, 0.3, -0.25), P(side * 0.32, 0.29, 0.55), 0.018, C.wood, "solid", 5);
    b.place(box(0.01), C.wood, v(side * 0.34, 0.29, 0.62), [0, side * 0.25, 0], [0.08, 0.015, 0.24], boatM);
  }
  const bow = P(0, 0.24, 0.9).applyMatrix4(boat);
  sag(b, m, bow, P(0.47, 0.32, z1), 0.12, 0.008, "#D9C9A8", 6);

  // A bench on the bank, looking out over the water.
  const seatAngle = 2.5;
  const seat = frame(m, Math.cos(seatAngle) * (R + 1.1), 0.05, Math.sin(seatAngle) * (R + 1.1), Math.atan2(-Math.cos(seatAngle), -Math.sin(seatAngle)));
  const benchShape = bench(b, seat);

  // Wildflowers on the far bank.
  const flowers = createRandom(77);
  for (const [a, color] of [
    [3.6, "#F2C14E"],
    [5.2, "#B9A5D8"],
    [0.4, "#F4ECDD"],
  ] as const) {
    const dir = P(Math.cos(a) * (R + 1.4), 0, Math.sin(a) * (R + 1.4)).applyMatrix4(m).normalize();
    flowerDrift(b, terrain, dir, flowers, color, 12, 0.8);
  }

  return [
    createColliderGroup(m, [
      { kind: "box", x: 0, z: (z0 + z1) / 2, halfWidth: 0.5, halfDepth: (z0 - z1) / 2, height: 0.225 },
      // Keep the hidden half of the boat out of reach.
      { kind: "circle", x: 1.05, z: 0.75, radius: 0.5, height: 0.6 },
    ]),
    createColliderGroup(seat, [benchShape]),
  ];
}

// ---------------------------------------------------------------- campsite

/** Lays a log on its side at `angle` round a center, as a seat. Returns its collider. */
function logSeat(b: Batcher, m: Matrix4, angle: number, distance: number, length: number): Shape {
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;
  const yaw = -angle - Math.PI / 2;
  b.place(cylinder(9), C.wood, v(x, 0.17, z), [0, yaw, Math.PI / 2], [0.17, length, 0.17], m);
  // Pale cut ends, so it reads as a log and not a pipe.
  const along = P(-Math.sin(angle), 0, Math.cos(angle));
  for (const end of [-1, 1]) {
    const p = P(x, 0.17, z).addScaledVector(along, end * (length / 2 + 0.005));
    b.place(cylinder(9), C.woodLight, v(p.x, p.y, p.z), [0, yaw, Math.PI / 2], [0.15, 0.015, 0.15], m);
  }
  return { kind: "box", x, z, halfWidth: 0.17, halfDepth: length / 2, rotation: -angle, height: 0.34 };
}

function buildCamp(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const random = createRandom(53);
  const shapes: Shape[] = [];
  // The fire ring.
  b.place(cylinder(14), "#4A4038", v(0, 0.01, 0), [0, 0, 0], [0.45, 0.02, 0.45], m);
  for (let i = 0; i < 11; i += 1) {
    const a = (i / 11) * Math.PI * 2 + random() * 0.2;
    b.place(sphere("low"), i % 2 ? C.stone : C.stoneLight, v(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55), [random(), a, 0], [0.16, 0.12, 0.13], m);
  }
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    rod(b, m, P(Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.36), P(Math.cos(a) * 0.05, 0.42, Math.sin(a) * 0.05), 0.045, C.woodDark, "solid", 6);
    b.place(sphere("tiny"), "#2E2622", v(Math.cos(a) * 0.08, 0.38, Math.sin(a) * 0.08), [0, 0, 0], 0.05, m);
  }
  b.place(sphere("low"), "#E8743A", v(0, 0.05, 0), [0, 0, 0], [0.22, 0.06, 0.22], m, "glow");
  shapes.push({ kind: "circle", x: 0, z: 0, radius: 0.62, height: 0.6 });

  // Log seats round the fire, open at the back where the tent is.
  for (const a of [0.15, Math.PI / 2, Math.PI - 0.15]) shapes.push(logSeat(b, m, a, 1.4, 1.1));
  // Two marshmallow sticks resting on the front log.
  for (const side of [-1, 1]) {
    const tip = P(side * 0.2, 0.5, 0.3);
    rod(b, m, P(side * 0.55, 0.36, 1.32), tip, 0.009, C.woodLight, "solid", 4);
    b.place(cylinder(8), C.paper, v(tip.x * 1.08, tip.y + 0.01, tip.z * 1.15), [0.5, 0, 0], [0.03, 0.05, 0.03], m);
  }
  // A mug on the right log.
  b.place(cylinder(10), "#6E8FB0", v(1.35, 0.4, 0.45), [0, 0, 0], [0.05, 0.1, 0.05], m);

  // The tent, door to the fire.
  const tent = frame(m, 0, 0, -2.05, 0);
  const canvas = "#E0A548";
  const half = 0.85;
  const height = 1.3;
  const pitch = Math.atan2(height, half);
  const sideLength = Math.hypot(half, height);
  b.place(box(0.01), "#5C7393", v(0, 0.01, 0.1), [0, 0, 0], [1.9, 0.02, 2.2], tent);
  for (const side of [-1, 1]) {
    b.place(box(0.02), canvas, v(side * (half / 2 + 0.02), height / 2 + 0.01, 0), [0, 0, -side * pitch], [sideLength, 0.04, 1.9], tent);
    // A darker seam down each slope.
    b.place(box(0.004), "#C98E3C", v(side * (half / 2 + 0.045), height / 2 + 0.03, 0), [0, 0, -side * pitch], [sideLength, 0.008, 0.05], tent);
  }
  diamond(b, tent, P(0, 0, -0.93), half, height, 0.03, "#D49A40");
  diamond(b, tent, P(0, 0, 0.93), half, height, 0.03, "#D49A40");
  diamond(b, tent, P(0, 0, 0.95), 0.48, 0.86, 0.02, "#4F3A34");
  // Door flaps tied back.
  for (const side of [-1, 1]) b.place(cylinder(8), "#C98E3C", v(side * 0.5, 0.38, 0.97), [0, 0, side * 0.52], [0.06, 0.74, 0.06], tent);
  for (const z of [-1, 1]) {
    rod(b, tent, P(0, height - 0.05, z * 0.94), P(0, height + 0.22, z * 1.0), 0.025, C.woodDark, "solid", 6);
    rod(b, tent, P(0, height + 0.15, z * 0.99), P(0, 0.02, z * 1.75), 0.007, C.paper, "solid", 4);
    b.place(box(0.004), C.woodDark, v(0, 0.06, z * 1.75), [0, 0, 0], [0.04, 0.14, 0.04], tent);
  }
  // A lantern by the door.
  b.place(cylinder(10), C.amber, v(0.72, 0.12, 1.25), [0, 0, 0], [0.065, 0.16, 0.065], tent, "glow");
  b.place(cylinder(10), C.ink, v(0.72, 0.22, 1.25), [0, 0, 0], [0.08, 0.04, 0.08], tent);
  b.place(cylinder(10), C.ink, v(0.72, 0.03, 1.25), [0, 0, 0], [0.08, 0.04, 0.08], tent);
  b.place(torus(0.12, Math.PI), C.ink, v(0.72, 0.25, 1.25), [0, 0, 0], 0.06, tent);
  const tentShape: Shape = { kind: "box", x: 0, z: -2.05, halfWidth: 0.95, halfDepth: 1.0, height: 1.35 };
  shapes.push(tentShape);

  // Firewood stacked by the tent, and a cooler.
  const wood = frame(m, 1.55, 0, -1.25, 0.3);
  for (const [x, y] of [
    [-0.16, 0.08],
    [0, 0.08],
    [0.16, 0.08],
    [-0.08, 0.22],
    [0.08, 0.22],
    [0, 0.36],
  ] as const) {
    b.place(cylinder(7), C.wood, v(x, y, 0), [Math.PI / 2, 0, 0], [0.075, 0.62, 0.075], wood);
    b.place(cylinder(7), C.woodLight, v(x, y, 0.315), [Math.PI / 2, 0, 0], [0.065, 0.01, 0.065], wood);
  }
  shapes.push({ kind: "box", x: 1.55, z: -1.25, halfWidth: 0.3, halfDepth: 0.35, height: 0.45, rotation: 0.3 });
  const cooler = frame(m, -1.55, 0, -1.1, -0.4);
  b.place(box(0.04), "#5C9EAD", v(0, 0.17, 0), [0, 0, 0], [0.52, 0.32, 0.34], cooler);
  b.place(box(0.04), C.paper, v(0, 0.35, 0), [0, 0, 0], [0.55, 0.06, 0.37], cooler);
  shapes.push({ kind: "box", x: -1.55, z: -1.1, halfWidth: 0.3, halfDepth: 0.2, height: 0.4, rotation: -0.4 });

  for (let i = 0; i < 5; i += 1) {
    const a = 0.6 + i * 1.1;
    grassClump(b, frame(m, Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4, a), random, 7, 1.1);
  }
  return shapes;
}

// ---------------------------------------------------------------- weather station

function buildWeather(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  // A slatted white box on legs, the kind that keeps a thermometer in the shade.
  const screen = frame(m, -0.6, 0, -0.25, 0.2);
  for (const [x, z] of [
    [-0.2, -0.15],
    [0.2, -0.15],
    [-0.2, 0.15],
    [0.2, 0.15],
  ] as const) b.place(box(0.01), C.paper, v(x, 0.5, z), [0, 0, 0], [0.05, 1.0, 0.05], screen);
  b.place(box(0.02), C.paper, v(0, 1.25, 0), [0, 0, 0], [0.56, 0.5, 0.44], screen);
  for (let i = 0; i < 6; i += 1) b.place(box(0.004), "#D9CFBF", v(0, 1.05 + i * 0.075, 0.225), [-0.5, 0, 0], [0.5, 0.02, 0.05], screen);
  b.place(box(0.02), "#DDD3C2", v(0, 1.53, 0), [0, 0, 0], [0.68, 0.05, 0.56], screen);
  b.place(box(0.02), C.paper, v(0, 1.6, 0), [0, 0, 0], [0.62, 0.05, 0.5], screen);

  // The mast. Its spinning cups and vane are movers.
  const mast = P(0.45, 0, -0.1);
  b.place(cylinder(8), C.metal, v(mast.x, 1.3, mast.z), [0, 0, 0], [0.035, 2.6, 0.035], m);
  b.place(cylinder(10), C.metalDark, v(mast.x, 0.03, mast.z), [0, 0, 0], [0.16, 0.06, 0.16], m);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = P(mast.x + Math.cos(a) * 1.0, 0.0, mast.z + Math.sin(a) * 1.0);
    rod(b, m, P(mast.x, 2.0, mast.z), foot, 0.006, C.metalDark, "solid", 4);
    b.place(box(0.004), C.woodDark, v(foot.x, 0.05, foot.z), [0, 0, 0], [0.04, 0.1, 0.04], m);
  }
  // A compass cross under the vane.
  for (const yaw of [0, Math.PI / 2]) b.place(cylinder(5), C.ink, v(mast.x, 2.08, mast.z), [0, yaw, Math.PI / 2], [0.01, 0.42, 0.01], m);

  // A windsock on its own pole, and a rain gauge.
  b.place(cylinder(8), C.metal, v(-0.25, 0.95, 0.85), [0, 0, 0], [0.025, 1.9, 0.025], m);
  b.place(box(0.01), C.woodLight, v(0.75, 0.4, 0.7), [0, 0, 0], [0.07, 0.8, 0.07], m);
  b.place(cylinder(10), C.metal, v(0.75, 0.92, 0.7), [0, 0, 0], [0.075, 0.24, 0.075], m);
  b.place(cylinder(10, 1.6), C.metalDark, v(0.75, 1.07, 0.7), [0, 0, 0], [0.07, 0.06, 0.07], m);

  // Dad's little table with the weather log and a mug.
  const table = frame(m, -0.35, 0, 0.75, -0.3);
  b.place(box(0.02), C.woodLight, v(0, 0.58, 0), [0, 0, 0], [0.6, 0.04, 0.42], table);
  for (const [x, z] of [
    [-0.25, -0.17],
    [0.25, -0.17],
    [-0.25, 0.17],
    [0.25, 0.17],
  ] as const) b.place(box(0.004), C.woodDark, v(x, 0.28, z), [0, 0, 0], [0.04, 0.56, 0.04], table);
  b.place(box(0.004), C.clay, v(-0.08, 0.61, 0.0), [0, 0.2, 0], [0.22, 0.02, 0.28], table);
  b.place(box(0.004), C.paper, v(-0.08, 0.622, 0.0), [0, 0.2, 0], [0.2, 0.006, 0.26], table);
  for (let i = 0; i < 4; i += 1) b.place(box(0.004), "#B8AE9E", v(-0.08, 0.627, -0.08 + i * 0.05), [0, 0.2, 0], [0.15, 0.002, 0.01], table);
  b.place(cylinder(10), C.cream, v(0.18, 0.65, 0.05), [0, 0, 0], [0.045, 0.09, 0.045], table);

  return [
    { kind: "box", x: -0.6, z: -0.25, halfWidth: 0.32, halfDepth: 0.26, height: 1.65, rotation: 0.2 },
    { kind: "circle", x: mast.x, z: mast.z, radius: 0.14, height: 2.7 },
    { kind: "circle", x: -0.25, z: 0.85, radius: 0.08, height: 1.9 },
    { kind: "circle", x: 0.75, z: 0.7, radius: 0.1, height: 1.1 },
    { kind: "box", x: -0.35, z: 0.75, halfWidth: 0.32, halfDepth: 0.23, height: 0.62, rotation: -0.3 },
  ];
}

// ---------------------------------------------------------------- playground

function buildPlayground(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];
  // Slide tower with a little red roof.
  const tower = frame(m, -1.35, 0, -0.75, 0);
  const deck = 1.05;
  for (const [x, z] of [
    [-0.4, -0.4],
    [0.4, -0.4],
    [-0.4, 0.4],
    [0.4, 0.4],
  ] as const) b.place(box(0.01), C.woodLight, v(x, 0.95, z), [0, 0, 0], [0.09, 1.9, 0.09], tower);
  b.place(box(0.02), C.wood, v(0, deck, 0), [0, 0, 0], [0.9, 0.08, 0.9], tower);
  b.place(cone(4), C.clay, v(0, 2.1, 0), [0, Math.PI / 4, 0], [0.72, 0.42, 0.72], tower);
  for (const z of [-0.4, 0.4]) {
    b.place(box(0.004), C.paper, v(0, deck + 0.5, z), [0, 0, 0], [0.8, 0.05, 0.04], tower);
    for (let i = 0; i < 4; i += 1) b.place(box(0.004), C.paper, v(-0.3 + i * 0.2, deck + 0.25, z), [0, 0, 0], [0.03, 0.45, 0.03], tower);
  }
  // Ladder up the back.
  for (const z of [-0.2, 0.2]) rod(b, tower, P(-0.8, 0, z), P(-0.42, deck + 0.05, z), 0.03, C.woodLight, "solid", 6);
  for (let i = 1; i < 5; i += 1) {
    const t = i / 5;
    b.place(box(0.004), C.wood, v(-0.8 + 0.38 * t, deck * t, 0), [0, 0, 0], [0.05, 0.04, 0.42], tower);
  }
  // The slide.
  const top = P(0.43, deck, 0);
  const foot = P(2.25, 0.14, 0);
  const run = foot.clone().sub(top);
  const tilt = Math.atan2(run.y, run.x);
  const mid = top.clone().add(foot).multiplyScalar(0.5);
  b.place(box(0.02), "#E8B53A", v(mid.x, mid.y + 0.02, mid.z), [0, 0, tilt], [run.length(), 0.04, 0.48], tower);
  for (const z of [-0.25, 0.25]) b.place(box(0.02), "#D9A030", v(mid.x, mid.y + 0.08, z), [0, 0, tilt], [run.length(), 0.14, 0.035], tower);
  b.place(box(0.02), "#E8B53A", v(foot.x + 0.2, 0.15, 0), [0, 0, 0], [0.42, 0.04, 0.48], tower);
  b.place(box(0.01), C.woodDark, v(foot.x + 0.2, 0.07, 0), [0, 0, 0], [0.08, 0.14, 0.4], tower);
  shapes.push({ kind: "box", x: -1.35, z: -0.75, halfWidth: 0.5, halfDepth: 0.5, height: 2.2 });
  shapes.push({ kind: "box", x: -1.35 + mid.x, z: -0.75, halfWidth: run.length() / 2, halfDepth: 0.27, height: 0.5, base: 0 });

  // Swing set. The swings themselves are movers.
  const blue = "#5C7393";
  for (const x of [0.2, 2.4]) {
    for (const z of [-0.55, 0.55]) rod(b, m, P(x, 1.92, 1.2), P(x + (x < 1 ? -0.12 : 0.12), 0, 1.2 + z), 0.045, blue, "solid", 7);
    for (const z of [-0.55, 0.55]) shapes.push({ kind: "circle", x: x + (x < 1 ? -0.12 : 0.12), z: 1.2 + z, radius: 0.08, height: 1.9 });
  }
  rod(b, m, P(0.05, 1.92, 1.2), P(2.55, 1.92, 1.2), 0.05, blue, "solid", 8);

  // Seesaw.
  const saw = frame(m, -1.4, 0, 1.45, 0.15);
  b.place(box(0.02), C.woodDark, v(0, 0.16, 0), [0, 0, 0], [0.2, 0.32, 0.3], saw);
  b.place(cylinder(8), C.metalDark, v(0, 0.33, 0), [Math.PI / 2, 0, 0], [0.05, 0.34, 0.05], saw);
  b.place(box(0.02), "#7FA37A", v(0, 0.38, 0), [0, 0, 0.17], [2.2, 0.06, 0.26], saw);
  for (const end of [-1, 1]) {
    const y = 0.38 + Math.sin(0.17) * end * 0.9;
    rod(b, saw, P(end * 0.85, y, -0.09), P(end * 0.85, y + 0.22, -0.09), 0.015, C.ink, "solid", 5);
    rod(b, saw, P(end * 0.85, y, 0.09), P(end * 0.85, y + 0.22, 0.09), 0.015, C.ink, "solid", 5);
    rod(b, saw, P(end * 0.85, y + 0.22, -0.11), P(end * 0.85, y + 0.22, 0.11), 0.015, C.ink, "solid", 5);
    b.place(box(0.02), C.clay, v(end * 1.0, y + 0.04, 0), [0, 0, 0.17], [0.28, 0.04, 0.28], saw);
  }
  shapes.push({ kind: "box", x: -1.4, z: 1.45, halfWidth: 1.1, halfDepth: 0.15, height: 0.55, rotation: 0.15 });

  // Sandbox with a castle, a bucket and a spade.
  const sand = frame(m, 1.45, 0, -1.95, -0.2);
  for (const [x, z, w, d] of [
    [0, -0.55, 1.34, 0.1],
    [0, 0.55, 1.34, 0.1],
    [-0.62, 0, 0.1, 1.1],
    [0.62, 0, 0.1, 1.1],
  ] as const) b.place(box(0.01), C.woodLight, v(x, 0.1, z), [0, 0, 0], [w, 0.2, d], sand);
  b.place(box(0.01), "#E8D2A0", v(0, 0.07, 0), [0, 0, 0], [1.16, 0.14, 1.0], sand);
  b.place(cylinder(10), "#D9BE86", v(-0.15, 0.23, 0.05), [0, 0, 0], [0.2, 0.2, 0.2], sand);
  for (const [x, z] of [
    [-0.32, -0.12],
    [0.02, -0.12],
    [-0.32, 0.22],
    [0.02, 0.22],
  ] as const) {
    b.place(cylinder(8), "#D9BE86", v(x, 0.3, z), [0, 0, 0], [0.06, 0.3, 0.06], sand);
    b.place(cone(8), "#CDB07A", v(x, 0.5, z), [0, 0, 0], [0.065, 0.1, 0.065], sand);
  }
  b.place(cone(3), C.clay, v(-0.15, 0.56, 0.05), [0, 0, 0], [0.04, 0.12, 0.01], sand);
  b.place(cylinder(10, 1.3), C.clay, v(0.35, 0.21, 0.25), [0, 0, 0], [0.08, 0.14, 0.08], sand);
  rod(b, sand, P(0.3, 0.16, -0.25), P(0.55, 0.24, -0.15), 0.012, C.woodDark, "solid", 4);
  b.place(box(0.004), "#6E8FB0", v(0.25, 0.15, -0.28), [0, 0.4, 0.1], [0.1, 0.01, 0.12], sand);
  for (const [x, z, w, d] of [
    [0, -0.55, 0.67, 0.05],
    [0, 0.55, 0.67, 0.05],
    [-0.62, 0, 0.05, 0.55],
    [0.62, 0, 0.05, 0.55],
  ] as const) {
    const p = P(x, 0, z).applyMatrix4(new Matrix4().makeRotationY(-0.2));
    shapes.push({ kind: "box", x: 1.45 + p.x, z: -1.95 + p.z, halfWidth: w, halfDepth: d, height: 0.2, rotation: -0.2 });
  }
  return shapes;
}

// ---------------------------------------------------------------- rocket field

function buildRocket(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  // Dad's model rocket on its launch pad: card tube, painted fins, a nose cone.
  const pad = frame(m, 0, 0, -0.3, 0.4);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    rod(b, pad, P(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), P(0, 0.42, 0), 0.025, C.metalDark, "solid", 6);
  }
  b.place(cylinder(16), C.metal, v(0, 0.43, 0), [0, 0, 0], [0.32, 0.03, 0.32], pad);
  b.place(cylinder(6), C.metal, v(0.17, 1.45, 0), [0, 0, 0], [0.012, 2.0, 0.012], pad);
  b.place(cylinder(16), C.paper, v(0, 1.1, 0), [0, 0, 0], [0.12, 1.2, 0.12], pad);
  b.place(cylinder(16), C.clay, v(0, 1.45, 0), [0, 0, 0], [0.123, 0.1, 0.123], pad);
  b.place(cylinder(16), "#5C7393", v(0, 0.78, 0), [0, 0, 0], [0.123, 0.05, 0.123], pad);
  b.place(cone(16), C.clay, v(0, 1.88, 0), [0, 0, 0], [0.12, 0.36, 0.12], pad);
  b.place(cylinder(10), C.ink, v(0, 0.48, 0), [0, 0, 0], [0.065, 0.06, 0.065], pad);
  b.place(cylinder(6), C.metal, v(0.135, 1.0, 0), [0, 0, 0], [0.02, 0.1, 0.02], pad);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    b.place(box(0.01), "#5C7393", v(Math.cos(a) * 0.2, 0.68, Math.sin(a) * 0.2), [0, Math.PI / 2 - a, 0], [0.018, 0.32, 0.18], pad);
  }
  // A round window, toward the path.
  const porthole = P(0, 1.25, 0.122).applyMatrix4(new Matrix4().makeRotationY(-0.4));
  b.place(cylinder(14), "#3F5A86", v(porthole.x, porthole.y, porthole.z), [0, Math.PI / 2 - 0.4, Math.PI / 2], [0.045, 0.01, 0.045], pad);
  b.place(torus(0.2), C.metal, v(porthole.x * 1.02, porthole.y, porthole.z * 1.02), [0, -0.4, 0], 0.05, pad);

  // The launch button, at the end of a long cable.
  const button = P(1.05, 0, 0.95);
  b.place(box(0.02), "#E8B53A", v(button.x, 0.05, button.z), [0, 0.3, 0], [0.24, 0.1, 0.17], m);
  b.place(cylinder(10), C.clay, v(button.x + 0.04, 0.11, button.z), [0, 0, 0], [0.04, 0.03, 0.04], m);
  b.place(box(0.004), C.ink, v(button.x - 0.06, 0.105, button.z + 0.02), [0, 0, 0], [0.04, 0.02, 0.02], m);
  const cable: Vector3[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    cable.push(P(0.2 + (button.x - 0.25) * t + Math.sin(t * 9) * 0.08, 0.03, -0.15 + (button.z + 0.15) * t));
  }
  for (let i = 0; i < 8; i += 1) rod(b, m, cable[i]!, cable[i + 1]!, 0.012, C.ink, "solid", 4);

  // A rope ring with a way in at the front.
  const ring: Vector3[] = [];
  for (let i = 0; i < 7; i += 1) {
    const a = Math.PI / 2 + 0.5 + (i / 6) * (Math.PI * 2 - 1.0);
    const p = P(Math.cos(a) * 1.25, 0, -0.3 + Math.sin(a) * 1.25);
    ring.push(p);
    b.place(box(0.004), C.woodLight, v(p.x, 0.22, p.z), [0, 0, 0], [0.05, 0.44, 0.05], m);
  }
  for (let i = 0; i < ring.length - 1; i += 1) sag(b, m, ring[i]!.clone().setY(0.38), ring[i + 1]!.clone().setY(0.38), 0.06, 0.008, C.clay, 4);

  // Traffic cones and a crate of spare parts.
  for (const [x, z] of [
    [-0.75, 1.15],
    [0.55, 1.2],
  ] as const) {
    b.place(box(0.004), "#E9823A", v(x, 0.015, z), [0, 0, 0], [0.22, 0.03, 0.22], m);
    b.place(cone(10), "#E9823A", v(x, 0.17, z), [0, 0, 0], [0.1, 0.3, 0.1], m);
    b.place(cylinder(10, 0.8), C.paper, v(x, 0.18, z), [0, 0, 0], [0.068, 0.06, 0.068], m);
  }
  const crate = frame(m, -1.65, 0, -0.6, 0.5);
  b.place(box(0.01), C.woodLight, v(0, 0.18, 0), [0, 0, 0], [0.52, 0.36, 0.4], crate);
  for (const y of [0.1, 0.26]) b.place(box(0.004), C.wood, v(0, y, 0.205), [0, 0, 0], [0.5, 0.05, 0.01], crate);
  for (const [x, tilt] of [
    [-0.12, 0.3],
    [0.1, -0.2],
  ] as const) b.place(cone(12), x < 0 ? C.paper : C.clay, v(x, 0.43, 0), [tilt, 0, tilt], [0.06, 0.2, 0.06], crate);
  b.place(sphere("low"), C.clay, v(0.15, 0.4, 0.08), [0, 0, 0], [0.1, 0.06, 0.09], crate);

  return [
    { kind: "circle", x: 0, z: -0.3, radius: 0.5, height: 2.2 },
    { kind: "box", x: -1.65, z: -0.6, halfWidth: 0.28, halfDepth: 0.22, height: 0.45, rotation: 0.5 },
  ];
}

// ---------------------------------------------------------------- orchard

function buildOrchard(b: Batcher, terrain: Terrain): ColliderGroup[] {
  // +X here is west, away from the paths that come in from the east.
  const m = groundMatrix(terrain, ORCHARD, 0, 0.02);
  const groups: ColliderGroup[] = [];
  const hive = (x: number, z: number, yaw: number, colors: [string, string]): void => {
    const h = frame(m, x, 0, z, yaw);
    b.place(box(0.01), C.woodDark, v(0, 0.08, 0), [0, 0, 0], [0.52, 0.16, 0.46], h);
    b.place(box(0.02), colors[0], v(0, 0.28, 0), [0, 0, 0], [0.44, 0.22, 0.38], h);
    b.place(box(0.02), colors[1], v(0, 0.5, 0), [0, 0, 0], [0.44, 0.22, 0.38], h);
    b.place(box(0.02), C.metal, v(0, 0.64, 0), [0, 0, 0], [0.52, 0.06, 0.46], h);
    b.place(box(0.004), C.ink, v(0, 0.19, 0.195), [0, 0, 0], [0.22, 0.035, 0.02], h);
    b.place(box(0.004), C.woodLight, v(0, 0.165, 0.24), [0, 0, 0], [0.3, 0.02, 0.1], h);
    groups.push(createColliderGroup(h, [{ kind: "box", x: 0, z: 0, halfWidth: 0.28, halfDepth: 0.25, height: 0.7 }]));
  };
  hive(1.7, 0.7, -1.2, ["#F2C14E", C.paper]);
  hive(2.0, -0.4, -1.6, ["#9BC0D9", C.paper]);

  // Crates of picked apples.
  const crates = frame(m, 1.0, 0, -1.6, 0.4);
  const random = createRandom(61);
  for (const [x, y, z] of [
    [0, 0.16, 0],
    [0.52, 0.16, 0.05],
    [0.25, 0.48, 0.02],
  ] as const) {
    b.place(box(0.01), C.woodLight, v(x, y, z), [0, 0, 0], [0.48, 0.32, 0.36], crates);
    b.place(box(0.004), C.wood, v(x, y + 0.04, z + 0.185), [0, 0, 0], [0.46, 0.05, 0.01], crates);
    for (let i = 0; i < 6; i += 1) {
      b.place(sphere("low"), random() < 0.75 ? "#D24B3E" : "#C99A3E", v(x - 0.15 + (i % 3) * 0.15, y + 0.17, z - 0.07 + Math.floor(i / 3) * 0.14), [0, 0, 0], 0.065, crates);
    }
  }
  groups.push(createColliderGroup(crates, [{ kind: "box", x: 0.26, z: 0, halfWidth: 0.55, halfDepth: 0.22, height: 0.7 }]));

  // A honey stand: a little table with jars.
  const stand = frame(m, 0.6, 0, 2.0, Math.PI - 0.3);
  b.place(box(0.02), C.woodLight, v(0, 0.62, 0), [0, 0, 0], [0.8, 0.05, 0.4], stand);
  for (const x of [-0.34, 0.34]) for (const z of [-0.15, 0.15]) b.place(box(0.004), C.woodDark, v(x, 0.3, z), [0, 0, 0], [0.04, 0.6, 0.04], stand);
  for (let i = 0; i < 5; i += 1) {
    const x = -0.28 + i * 0.14;
    b.place(cylinder(10), "#E8A33A", v(x, 0.71, 0.02), [0, 0, 0], [0.05, 0.13, 0.05], stand);
    b.place(cylinder(10), i % 2 ? C.clay : C.paper, v(x, 0.79, 0.02), [0, 0, 0], [0.055, 0.03, 0.055], stand);
  }
  b.place(box(0.004), C.paper, v(0, 0.92, -0.18), [0, 0, 0], [0.5, 0.2, 0.02], stand);
  rod(b, stand, P(-0.3, 0.62, -0.18), P(-0.3, 1.02, -0.18), 0.012, C.woodDark, "solid", 4);
  rod(b, stand, P(0.3, 0.62, -0.18), P(0.3, 1.02, -0.18), 0.012, C.woodDark, "solid", 4);
  groups.push(createColliderGroup(stand, [{ kind: "box", x: 0, z: 0, halfWidth: 0.42, halfDepth: 0.22, height: 0.8 }]));

  const flowers = createRandom(19);
  flowerDrift(b, terrain, P(2.6, 0, 1.8).applyMatrix4(m).normalize(), flowers, "#F2C14E", 14, 1.0);
  flowerDrift(b, terrain, P(-1.0, 0, -2.6).applyMatrix4(m).normalize(), flowers, "#F4ECDD", 12, 0.9);
  return groups;
}

// ---------------------------------------------------------------- windpump

const STEEL = "#A9A49A";

function buildWindpump(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];
  // A lattice tower: four legs leaning in, braced at each level.
  const height = 4.1;
  const leg = (sx: number, sz: number, y: number): Vector3 => {
    const t = y / height;
    const half = 0.78 * (1 - t) + 0.2 * t;
    return P(sx * half, y, sz * half);
  };
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;
  for (const [sx, sz] of corners) {
    rod(b, m, leg(sx, sz, 0), leg(sx, sz, height), 0.04, STEEL, "solid", 6);
    b.place(box(0.01), C.stone, v(sx * 0.78, 0.06, sz * 0.78), [0, 0, 0], [0.26, 0.12, 0.26], m);
    shapes.push({ kind: "circle", x: sx * 0.78, z: sz * 0.78, radius: 0.16, height: 4 });
  }
  for (const y of [1.1, 2.2, 3.2]) {
    for (let i = 0; i < 4; i += 1) {
      const [ax, az] = corners[i]!;
      const [bx, bz] = corners[(i + 1) % 4]!;
      rod(b, m, leg(ax, az, y), leg(bx, bz, y), 0.022, STEEL, "solid", 5);
    }
  }
  // X braces on each face between the levels.
  for (const [y0, y1] of [
    [0.0, 1.1],
    [1.1, 2.2],
    [2.2, 3.2],
  ] as const) {
    for (let i = 0; i < 4; i += 1) {
      const [ax, az] = corners[i]!;
      const [bx, bz] = corners[(i + 1) % 4]!;
      rod(b, m, leg(ax, az, y0), leg(bx, bz, y1), 0.012, STEEL, "solid", 4);
      rod(b, m, leg(bx, bz, y0), leg(ax, az, y1), 0.012, STEEL, "solid", 4);
    }
  }
  // Platform, gearbox, the pump rod down the middle and the tail vane.
  b.place(box(0.01), C.wood, v(0, height, 0), [0, 0, 0], [0.62, 0.05, 0.62], m);
  b.place(box(0.02), C.metalDark, v(0, height + 0.2, 0), [0, 0, 0], [0.24, 0.24, 0.42], m);
  b.place(cone(8), C.metalDark, v(0, height + 0.38, 0), [0, 0, 0], [0.12, 0.14, 0.12], m);
  rod(b, m, P(0, 0.45, 0), P(0, height, 0), 0.016, C.metalDark, "solid", 4);
  rod(b, m, P(0, height + 0.2, -0.15), P(0, height + 0.26, -1.25), 0.025, STEEL, "solid", 5);
  b.place(box(0.01), C.clay, v(0, height + 0.32, -1.45), [0, 0, 0], [0.025, 0.52, 0.72], m);
  b.place(box(0.004), C.paper, v(0, height + 0.32, -1.45), [0, 0, 0], [0.03, 0.12, 0.6], m);

  // The water: a spout to a wooden trough, and a barrel tank on the side.
  b.place(cylinder(8), C.metalDark, v(0, 0.3, 0), [0, 0, 0], [0.09, 0.6, 0.09], m);
  rod(b, m, P(0, 0.55, 0.05), P(0, 0.55, 0.85), 0.03, C.metalDark, "solid", 6);
  b.place(cylinder(8), C.metalDark, v(0, 0.5, 0.86), [0, 0, 0], [0.035, 0.1, 0.035], m);
  b.place(box(0.02), C.wood, v(0, 0.19, 1.15), [0, 0, 0], [1.3, 0.38, 0.5], m);
  b.place(box(0.004), "#6E8FB0", v(0, 0.36, 1.15), [0, 0, 0], [1.18, 0.02, 0.38], m);
  b.place(sphere("low"), "#C0573E", v(0.5, 0.45, 1.36), [0, 0, 0], [0.07, 0.06, 0.09], m);
  b.place(sphere("low"), "#C0573E", v(0.5, 0.52, 1.43), [0, 0, 0], 0.045, m);
  b.place(cone(4), C.amber, v(0.5, 0.52, 1.49), [Math.PI / 2, 0, 0], [0.015, 0.04, 0.015], m);
  shapes.push({ kind: "box", x: 0, z: 1.15, halfWidth: 0.65, halfDepth: 0.25, height: 0.5 });
  const tank = frame(m, 1.65, 0, -0.5, 0);
  b.place(cylinder(16), C.wood, v(0, 0.55, 0), [0, 0, 0], [0.62, 1.1, 0.62], tank);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    b.place(box(0.004), C.woodDark, v(Math.cos(a) * 0.622, 0.55, Math.sin(a) * 0.622), [0, -a, 0], [0.012, 1.08, 0.02], tank);
  }
  for (const y of [0.18, 0.92]) b.place(torus(0.04), C.metalDark, v(0, y, 0), [Math.PI / 2, 0, 0], 0.635, tank);
  b.place(cylinder(16), "#6E8FB0", v(0, 1.09, 0), [0, 0, 0], [0.56, 0.02, 0.56], tank);
  rod(b, m, P(0.1, 0.4, -0.1), P(1.1, 0.95, -0.45), 0.025, C.metalDark, "solid", 5);
  shapes.push({ kind: "circle", x: 1.65, z: -0.5, radius: 0.66, height: 1.2 });
  return shapes;
}

// ---------------------------------------------------------------- balloon

function buildBalloonGround(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  // Three stakes with sandbags, and a step box to climb from.
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * 1.5;
    const z = Math.sin(a) * 1.5;
    b.place(box(0.004), C.woodDark, v(x, 0.12, z), [0, 0, 0], [0.07, 0.24, 0.07], m);
    for (let k = 0; k < 3; k += 1) b.place(sphere("low"), "#C9B48A", v(x + Math.cos(a + k * 2.1) * 0.2, 0.08, z + Math.sin(a + k * 2.1) * 0.2), [0, a + k, 0], [0.16, 0.09, 0.11], m);
  }
  b.place(box(0.02), C.woodLight, v(0.0, 0.2, 0.9), [0, 0.2, 0], [0.5, 0.4, 0.4], m);
  return [{ kind: "box", x: 0, z: 0.9, halfWidth: 0.27, halfDepth: 0.22, height: 0.4, rotation: 0.2 }];
}

function balloon(f: Batcher): void {
  const I = new Matrix4();
  // High enough that from across the planet it reads as floating, not as a dome on the ground.
  const basket = 3.4;
  // Ropes down to the stakes.
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    rod(f, I, P(Math.cos(a) * 1.5, 0.22, Math.sin(a) * 1.5), P(Math.cos(a) * 0.48, basket, Math.sin(a) * 0.48), 0.01, "#D9C9A8", "solid", 4);
  }
  // A woven basket.
  f.place(cylinder(12), "#B98A55", v(0, basket + 0.3, 0), [0, 0, 0], [0.55, 0.6, 0.55]);
  for (const y of [0.1, 0.3, 0.5]) f.place(torus(0.05), "#9C6E40", v(0, basket + y, 0), [Math.PI / 2, 0, 0], 0.56);
  f.place(torus(0.09), "#7A4A2E", v(0, basket + 0.6, 0), [Math.PI / 2, 0, 0], 0.56);
  // Burner frame with a small blue-gold flame.
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(f, I, P(Math.cos(a) * 0.5, basket + 0.6, Math.sin(a) * 0.5), P(Math.cos(a) * 0.2, basket + 1.15, Math.sin(a) * 0.2), 0.015, C.metalDark, "solid", 4);
    rod(f, I, P(Math.cos(a) * 0.2, basket + 1.15, Math.sin(a) * 0.2), P(Math.cos(a) * 0.5, basket + 1.45, Math.sin(a) * 0.5), 0.008, "#D9C9A8", "solid", 4);
  }
  f.place(cylinder(10), C.metal, v(0, basket + 1.15, 0), [0, 0, 0], [0.16, 0.12, 0.16]);
  f.place(cone(8), "#FFD27A", v(0, basket + 1.32, 0), [0, 0, 0], [0.07, 0.22, 0.07], undefined, "glow");
  // The envelope: clay red with cream seams and a gold band.
  const mid = basket + 3.3;
  f.place(cylinder(14, 2.0), C.amber, v(0, basket + 1.62, 0), [0, 0, 0], [0.45, 0.5, 0.45]);
  f.place(sphere("mid"), C.clay, v(0, mid, 0), [0, 0, 0], [1.7, 1.9, 1.7]);
  for (let k = 0; k < 4; k += 1) f.place(torus(0.022), C.paper, v(0, mid, 0), [0, (k * Math.PI) / 4, 0], [1.705, 1.905, 1.705]);
  f.place(torus(0.06), C.amber, v(0, mid - 0.35, 0), [Math.PI / 2, 0, 0], [1.67, 1.67, 1.0]);
  f.place(torus(0.035), C.paper, v(0, mid + 0.55, 0), [Math.PI / 2, 0, 0], [1.6, 1.6, 1.0]);
  f.place(cylinder(12), C.paper, v(0, mid + 1.86, 0), [0, 0, 0], [0.35, 0.06, 0.35]);
}

// ---------------------------------------------------------------- all together

export function buildPlaces(b: Batcher, terrain: Terrain, quality: QualitySettings, materials: Partial<Record<Layer, Material>>): PlacesResult {
  const colliders: ColliderGroup[] = [];
  const objects: Object3D[] = [];
  const drifting: Drifting[] = [];
  const shadow = quality.shadowMap > 0;

  colliders.push(createColliderGroup(SITES.treehouse.matrix, buildTreehouse(b, SITES.treehouse)));
  colliders.push(...buildPond(b, terrain));
  colliders.push(createColliderGroup(SITES.camp.matrix, buildCamp(b, SITES.camp)));
  colliders.push(createColliderGroup(SITES.weather.matrix, buildWeather(b, SITES.weather)));
  colliders.push(createColliderGroup(SITES.playground.matrix, buildPlayground(b, SITES.playground)));
  colliders.push(createColliderGroup(SITES.rocket.matrix, buildRocket(b, SITES.rocket)));
  colliders.push(...buildOrchard(b, terrain));
  colliders.push(createColliderGroup(SITES.windpump.matrix, buildWindpump(b, SITES.windpump)));
  colliders.push(createColliderGroup(SITES.balloon.matrix, buildBalloonGround(b, SITES.balloon)));

  // ---- Movers ----
  // The campfire: three flames that lick and lean.
  const flames = new Mover(frame(SITES.camp.matrix, 0, 0.05, 0), materials, false, (f) => {
    f.place(cone(8), "#F08A3C", v(0, 0.3, 0), [0, 0, 0], [0.22, 0.58, 0.22], undefined, "glow");
    f.place(cone(7), "#F6B04A", v(0.03, 0.26, 0.02), [0, 0.5, 0.06], [0.15, 0.46, 0.15], undefined, "glow");
    f.place(cone(6), "#FFE08A", v(-0.02, 0.2, -0.01), [0, 1.0, -0.05], [0.08, 0.3, 0.08], undefined, "glow");
  });
  objects.push(flames.group);
  const firePoint = new Vector3(0, 0.75, 0).applyMatrix4(SITES.camp.matrix);
  let fireLight: PointLight | null = null;
  if (quality.tier !== "low") {
    fireLight = new PointLight("#FF9A55", 4.2, 7.5, 1.4);
    fireLight.position.copy(firePoint);
    objects.push(fireLight);
  }
  const embers = new Floaters({ count: Math.round(10 * quality.particles) + 4, center: new Vector3(0, 1.2, 0).applyMatrix4(SITES.camp.matrix), radius: 0.7, color: "#FFB36B", size: 0.04, glow: true, speed: 0.9, blink: true, seed: 21 });
  const smoke = new Smoke(new Vector3(0, 0.9, 0).applyMatrix4(SITES.camp.matrix), SITES.camp.dir.clone(), Math.round(5 + 4 * quality.particles), "#D9CFC4");
  drifting.push(embers, smoke);

  // The weather station: cups that spin, a vane that hunts the wind, a sock that fills.
  const weather = SITES.weather.matrix;
  const cups = new Mover(frame(weather, 0.45, 2.62, -0.1), materials, shadow, (f) => {
    f.place(cylinder(8), C.metalDark, v(0, 0, 0), [0, 0, 0], [0.035, 0.12, 0.035]);
    f.place(cone(8), C.metalDark, v(0, 0.09, 0), [0, 0, 0], [0.035, 0.06, 0.035]);
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      rod(f, new Matrix4(), P(0, 0.02, 0), P(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3), 0.01, C.metal, "solid", 4);
      f.place(sphere("low"), C.clay, v(Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3), [0, 0, 0], 0.07);
      const t = P(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.05);
      f.place(cylinder(10), C.ink, v(Math.cos(a) * 0.3 + t.x, 0.02, Math.sin(a) * 0.3 + t.z), [0, Math.PI / 2 - a, Math.PI / 2], [0.055, 0.025, 0.055]);
    }
  });
  const vane = new Mover(frame(weather, 0.45, 2.25, -0.1), materials, shadow, (f) => {
    rod(f, new Matrix4(), P(-0.32, 0, 0), P(0.3, 0, 0), 0.012, C.ink, "solid", 5);
    f.place(cone(8), C.ink, v(0.34, 0, 0), [0, 0, -Math.PI / 2], [0.035, 0.09, 0.035]);
    f.place(box(0.004), C.clay, v(-0.3, 0.02, 0), [0, 0, 0], [0.16, 0.13, 0.012]);
  });
  const sock = new Mover(frame(weather, -0.25, 1.86, 0.85), materials, shadow, (f) => {
    f.place(torus(0.15), C.metal, v(0.02, 0, 0), [0, Math.PI / 2, 0], 0.11);
    const radii = [0.11, 0.095, 0.08, 0.065, 0.05];
    for (let i = 0; i < 4; i += 1) {
      f.place(cylinder(10, radii[i + 1]! / radii[i]!), i % 2 ? C.paper : "#E9823A", v(0.15 + i * 0.24, 0, 0), [0, 0, -Math.PI / 2], [radii[i]!, 0.24, radii[i]!]);
    }
  });
  objects.push(cups.group, vane.group, sock.group);

  // The playground swings, one still moving as if someone just jumped off.
  const swings = [0.85, 1.75].map((x, i) =>
    new Mover(frame(SITES.playground.matrix, x, 1.88, 1.2), materials, shadow, (f) => {
      for (const sx of [-0.2, 0.2]) rod(f, new Matrix4(), P(sx, 0, 0), P(sx, -1.42, 0), 0.01, C.paper, "solid", 4);
      f.place(box(0.02), i === 0 ? C.clay : "#6E8FB0", v(0, -1.44, 0), [0, 0, 0], [0.48, 0.05, 0.2]);
    }),
  );
  for (const s of swings) objects.push(s.group);

  // A kite over the meadow, tied to the picnic basket.
  const picnic = groundMatrix(terrain, MEADOW.picnic, 20, 0.0);
  const kite = new Mover(frame(picnic, 0.25, 0.4, -0.2), materials, false, (f) => {
    const at = P(0, 5.4, -3.6);
    rod(f, new Matrix4(), P(0, 0, 0), at, 0.006, C.paper, "solid", 4);
    // The kite leans back into the wind. Everything on it is drawn in its tilted plane.
    const tilt = new Matrix4().makeRotationX(-0.5).premultiply(new Matrix4().makeTranslation(at.x, at.y, at.z));
    diamond(f, tilt, P(0, 0, 0), 0.42, 0.58, 0.02, C.clay);
    diamond(f, tilt, P(0, 0.12, 0.015), 0.22, 0.3, 0.02, C.amber);
    rod(f, tilt, P(0, -0.56, 0.025), P(0, 0.56, 0.025), 0.012, C.woodDark, "solid", 4);
    rod(f, tilt, P(-0.4, 0.06, 0.025), P(0.4, 0.06, 0.025), 0.012, C.woodDark, "solid", 4);
    let prev = P(0, -0.58, 0).applyMatrix4(tilt);
    for (let i = 1; i <= 6; i += 1) {
      const next = P(Math.sin(i * 0.9) * 0.12, -0.58 - i * 0.28, 0.06 * i).applyMatrix4(tilt);
      rod(f, new Matrix4(), prev, next, 0.006, C.paper, "solid", 4);
      f.place(cone(3), i % 2 ? C.amber : "#6E8FB0", v(next.x, next.y, next.z), [0, 0, Math.PI / 2], [0.05, 0.12, 0.015]);
      f.place(cone(3), i % 2 ? C.amber : "#6E8FB0", v(next.x, next.y, next.z), [0, 0, -Math.PI / 2], [0.05, 0.12, 0.015]);
      prev = next;
    }
  });
  objects.push(kite.group);

  // The windpump wheel: sixteen sails, cream and red, turning with the gusts.
  const wheel = new Mover(frame(SITES.windpump.matrix, 0, 4.3, 0.34), materials, shadow, (f) => {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      const sail = new Matrix4()
        .makeRotationY(0.4)
        .premultiply(new Matrix4().makeRotationZ(a - Math.PI / 2))
        .premultiply(new Matrix4().makeTranslation(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0));
      f.add(box(0.004), sail.multiply(new Matrix4().makeScale(0.1, 0.6, 0.012)), i % 2 ? C.clay : C.cream);
    }
    for (const r of [0.3, 0.92]) f.place(torus(0.04), STEEL, v(0, 0, 0), [0, 0, 0], r);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      rod(f, new Matrix4(), P(0, 0, 0.0), P(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0), 0.012, STEEL, "solid", 4);
    }
    f.place(cylinder(10), C.clay, v(0, 0, 0.04), [Math.PI / 2, 0, 0], [0.12, 0.12, 0.12]);
  });
  objects.push(wheel.group);

  // The balloon, tethered, bobbing a little on its ropes.
  const tethered = new Mover(SITES.balloon.matrix, materials, false, balloon);
  objects.push(tethered.group);

  // Bees round the hives.
  const hives = groundMatrix(terrain, ORCHARD, 0, 0.02);
  const bees = new Floaters({ count: Math.round(8 * quality.particles) + 4, center: new Vector3(1.85, 0.9, 0.15).applyMatrix4(hives), radius: 0.7, color: "#3A2E1E", size: 0.03, glow: false, speed: 1.6, blink: false, seed: 33 });
  drifting.push(bees);
  for (const d of drifting) objects.push(d.points);

  const pose = new Matrix4();
  const lean = new Matrix4();
  let vaneAngle = 0.6;
  let spin = 0;
  let wheelTurn = 0;
  const pondR = POND_RADIUS - 0.25;
  return {
    colliders,
    objects,
    isWater(dir: Vector3): boolean {
      return Math.acos(Math.max(-1, Math.min(1, dir.dot(POND)))) * terrain.radius < pondR;
    },
    update(dt: number, time: number, reducedMotion: boolean): void {
      for (const d of drifting) d.update(dt, reducedMotion);
      const calm = reducedMotion ? 0.25 : 1;
      // Gusts: a slow swell with a quicker flutter on top.
      const gust = 0.55 + 0.3 * Math.sin(time * 0.31) + 0.15 * Math.sin(time * 1.13 + 1);
      spin += dt * (2.5 + gust * 6) * calm;
      cups.turnY(spin);
      vaneAngle += (0.6 + Math.sin(time * 0.17) * 0.5 - vaneAngle) * Math.min(1, dt * 1.5);
      vane.turnY(vaneAngle + (reducedMotion ? 0 : Math.sin(time * 2.3) * 0.05));
      sock.set(pose.makeRotationY(vaneAngle + 0.1).multiply(lean.makeRotationZ(-(0.75 - gust * 0.55))));

      const flicker = reducedMotion ? 0 : 1;
      flames.set(pose.makeScale(1 + 0.06 * Math.sin(time * 11) * flicker, 1 + 0.16 * Math.sin(time * 7.3) * Math.sin(time * 3.1) * flicker, 1 + 0.06 * Math.cos(time * 9) * flicker).premultiply(lean.makeRotationY(time * 0.8 * flicker)));
      if (fireLight) fireLight.intensity = 4.2 + flicker * (Math.sin(time * 13) * 0.35 + Math.sin(time * 5.7) * 0.4);

      swings[0]!.set(pose.makeRotationX(0.2 * Math.sin(time * 2.1) * calm));
      swings[1]!.set(pose.makeRotationX(0.04 * Math.sin(time * 2.0 + 1.3) * calm));
      kite.set(pose.makeRotationZ(0.06 * Math.sin(time * 0.7) * calm).multiply(lean.makeRotationX(0.04 * Math.sin(time * 0.9) * calm)));
      wheelTurn += dt * (0.8 + gust * 2.6) * calm;
      wheel.set(pose.makeRotationZ(wheelTurn));
      tethered.set(pose.makeRotationZ(0.015 * Math.sin(time * 0.6) * calm).multiply(lean.makeRotationX(0.012 * Math.sin(time * 0.45 + 1) * calm)));
    },
    resize(pixelHeight: number): void {
      for (const d of drifting) d.setScale(pixelHeight);
    },
    dispose(): void {
      for (const d of drifting) d.dispose();
    },
  };
}
