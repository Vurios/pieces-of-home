import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Points, SphereGeometry, Vector3 } from "three";
import { box, cylinder, sphere } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import { createMaterial } from "../../render/particles";
import { type ColliderGroup, type Shape, createColliderGroup } from "../../world/colliders";
import { createRandom } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir } from "../../world/sphere";
import type { Terrain } from "../../world/terrain";
import { distanceToArc } from "../shapes";
import type { Site } from "./little-world";

/**
 * Dressing for Dad's little Mars worlds, so the plains feel like a real place
 * and not a plain ball: layered buttes on the skyline, families of dark
 * faceted boulders with sand banked behind them, a balanced rock or two,
 * crescent dunes, broken slabs of layered rock and, on worlds that want
 * them, a couple of small dust devils wandering past. Everything is kept
 * well away from the machines and the paths between them (Game Bible: roomy
 * layouts, nothing on the paths).
 *
 * The shapes are a toy maker's models, not to scale.
 */

const BASALT = ["#5C3B33", "#6A4236", "#4E342F"];
const RUST = ["#8E5238", "#9C5C3D", "#7A4630"];
const LAYERS = ["#B87650", "#CC8D5F", "#9C5E3E", "#D8A06E"];
const SAND = ["#D7A070", "#CF9566", "#C48A5C"];
/** Real Mars dunes are often dark: sand ground from dark volcanic rock. */
const DUNES = ["#8A5437", "#94603F", "#7E4C34"];

/** Faceted rock shapes: a lumpy, flat-faced stone in four variants, sitting on a flat bottom. */
const rockShapes = new Map<number, BufferGeometry>();
export function facetRock(variant: number): BufferGeometry {
  const key = Math.abs(Math.round(variant)) % 4;
  const cached = rockShapes.get(key);
  if (cached) return cached;
  const g = new IcosahedronGeometry(1, 1);
  const p = g.getAttribute("position");
  // The same corner appears on several faces, so the push comes from the corner's place, not its index.
  const push = (x: number, y: number, z: number): number => {
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + key * 19.19) * 43758.5453;
    return 0.78 + (h - Math.floor(h)) * 0.4;
  };
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = push(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
    p.setXYZ(i, x * k, Math.max(-0.3, y * k), z * k);
  }
  g.computeVertexNormals();
  rockShapes.set(key, g);
  return g;
}

/** A crescent dune: a smooth back into the wind, a hollow on the sheltered side, and two horns trailing away. */
let duneShape: BufferGeometry | null = null;
export function duneGeometry(): BufferGeometry {
  if (duneShape) return duneShape;
  const g = new SphereGeometry(1, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.getAttribute("position");
  const step = (a: number, b: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // The hollow: a round bite out of the downwind side. What is left is the crescent.
    const bite = Math.hypot(x * 0.95, z + 0.62);
    const keep = step(0.4, 0.74, bite);
    // The crest sits forward of the middle, so the back is long and gentle.
    const crest = 1 - 0.25 * Math.max(0, z);
    p.setXYZ(i, x * 1.1, y * 0.55 * keep * crest, z * 0.95);
  }
  g.computeVertexNormals();
  duneShape = g;
  return g;
}

const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length]!;

/** A layered butte: stacked bands of old rock, a flat cap, and rubble round its foot. */
export function buildButte(b: Batcher, s: Site, size: number, random: () => number): Shape[] {
  const bands = 4 + Math.floor(random() * 2);
  const height = size * (0.95 + random() * 0.5);
  const squash = 0.82 + random() * 0.25;
  let y = 0;
  let r = size;
  const spin = random() * 6;
  for (let i = 0; i < bands; i += 1) {
    const h = (height / bands) * (0.8 + random() * 0.4);
    const top = r * (0.9 + random() * 0.06);
    b.place(cylinder(9, top / r), LAYERS[(i + Math.floor(spin)) % LAYERS.length]!, [0, y + h / 2, 0], [0, spin + i * 0.2, 0], [r, h, r * squash], s.matrix);
    // A thin darker seam between some bands.
    if (i > 0 && random() < 0.6) b.place(cylinder(9), "#7E4A34", [0, y, 0], [0, spin + i * 0.2, 0], [r * 1.01, 0.03, r * squash * 1.01], s.matrix);
    y += h;
    r = top;
  }
  b.place(cylinder(9, 0.94), "#E0AB7A", [0, y + 0.03, 0], [0, spin, 0], [r * 1.03, 0.07, r * squash * 1.03], s.matrix);
  // Rubble that has fallen off the sides.
  const rubble = 5 + Math.floor(random() * 4);
  for (let i = 0; i < rubble; i += 1) {
    const a = random() * Math.PI * 2;
    const reach = size * (1.02 + random() * 0.45);
    const rs = size * (0.08 + random() * 0.16);
    b.place(facetRock(i), pick(RUST, random()), [Math.cos(a) * reach, rs * 0.3, Math.sin(a) * reach * squash], [random() * 3, random() * 6, random() * 3], [rs, rs * 0.75, rs], s.matrix);
  }
  return [{ kind: "circle", x: 0, z: 0, radius: size * 0.98, height: y }];
}

/** A family of dark boulders, the biggest with sand banked up on its sheltered side, and pebbles round them. */
export function buildBoulders(b: Batcher, s: Site, size: number, random: () => number): Shape[] {
  const shapes: Shape[] = [];
  const main = pick(BASALT, random());
  b.place(facetRock(random() * 4), main, [0, size * 0.32, 0], [random() * 0.4, random() * 6, random() * 0.4], [size, size * 0.72, size * 0.86], s.matrix);
  shapes.push({ kind: "circle", x: 0, z: 0, radius: size * 0.85, height: size * 0.8 });
  // Sand piled in the boulder's lee.
  b.place(sphere("low"), pick(SAND, random()), [0, 0, -size * 0.95], [0, 0, 0], [size * 0.8, size * 0.24, size * 0.9], s.matrix);
  const others = 2 + Math.floor(random() * 3);
  for (let i = 0; i < others; i += 1) {
    const a = random() * Math.PI * 2;
    const reach = size * (1.1 + random() * 0.7);
    const rs = size * (0.28 + random() * 0.3);
    const x = Math.cos(a) * reach;
    const z = Math.sin(a) * reach;
    b.place(facetRock(i + 1), random() < 0.6 ? pick(BASALT, random()) : pick(RUST, random()), [x, rs * 0.3, z], [random() * 0.6, random() * 6, random() * 0.6], [rs, rs * 0.7, rs * 0.9], s.matrix);
    if (rs > 0.25) shapes.push({ kind: "circle", x, z, radius: rs * 0.8, height: rs * 0.7 });
  }
  const pebbles = 7 + Math.floor(random() * 6);
  for (let i = 0; i < pebbles; i += 1) {
    const a = random() * Math.PI * 2;
    const reach = size * (0.9 + random() * 1.8);
    const rs = 0.035 + random() * 0.05;
    b.place(sphere("tiny"), pick(BASALT, random()), [Math.cos(a) * reach, rs * 0.4, Math.sin(a) * reach], [0, random() * 6, 0], [rs, rs * 0.7, rs], s.matrix);
  }
  return shapes;
}

/** A balanced rock: a worn pillar with a big stone resting on top, which never falls. */
export function buildBalancedRock(b: Batcher, s: Site, size: number, random: () => number): Shape[] {
  const height = size * (1.3 + random() * 0.5);
  const lean = (random() - 0.5) * 0.14;
  b.place(cylinder(7, 0.55), pick(LAYERS, random()), [0, height * 0.32, 0], [lean, random() * 6, 0], [size * 0.42, height * 0.64, size * 0.38], s.matrix);
  b.place(cylinder(7, 0.75), pick(RUST, random()), [0, height * 0.78, 0], [lean, random() * 6, 0], [size * 0.24, height * 0.3, size * 0.22], s.matrix);
  b.place(facetRock(random() * 4), pick(BASALT, random()), [lean * height, height * 0.98, 0], [random() * 0.5, random() * 6, random() * 0.5], [size * 0.58, size * 0.42, size * 0.5], s.matrix);
  for (let i = 0; i < 5; i += 1) {
    const a = random() * Math.PI * 2;
    const rs = size * (0.08 + random() * 0.12);
    b.place(facetRock(i), pick(RUST, random()), [Math.cos(a) * size * 0.6, rs * 0.3, Math.sin(a) * size * 0.6], [0, random() * 6, 0], rs, s.matrix);
  }
  return [{ kind: "circle", x: 0, z: 0, radius: size * 0.45, height: height * 1.1 }];
}

/** Crescent dunes, a big one and a little one downwind. Faces the local -Z with its horns. */
export function buildDunes(b: Batcher, s: Site, size: number, random: () => number): Shape[] {
  const color = pick(DUNES, random());
  b.place(duneGeometry(), color, [0, -0.02, 0], [0, 0, 0], [size, size, size], s.matrix);
  const small = 0.45 + random() * 0.2;
  const x = (random() - 0.5) * size * 1.4;
  b.place(duneGeometry(), pick(DUNES, random()), [x, -0.02, -size * 1.6], [0, (random() - 0.5) * 0.4, 0], [size * small, size * small, size * small], s.matrix);
  return [
    { kind: "circle", x: 0, z: 0.35 * size, radius: size * 0.55, height: size * 0.4 },
    { kind: "circle", x, z: -size * 1.6 + 0.35 * size * small, radius: size * small * 0.55, height: size * small * 0.4 },
  ];
}

/** Broken slabs of layered rock, tipped up out of the sand. */
export function buildSlabs(b: Batcher, s: Site, size: number, random: () => number): Shape[] {
  const shapes: Shape[] = [];
  const count = 2 + Math.floor(random() * 2);
  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * size * 0.9 + (random() - 0.5) * 0.2;
    const z = (random() - 0.5) * size * 0.6;
    const w = size * (0.6 + random() * 0.4);
    const h = size * (0.18 + random() * 0.1);
    const tilt = 0.25 + random() * 0.35;
    const turn = random() * 0.8 - 0.4;
    b.place(box(0.04), pick(LAYERS, random()), [x, h * 0.6, z], [tilt, turn, (random() - 0.5) * 0.2], [w, h, w * 0.7], s.matrix);
    b.place(box(0.02), "#8C5538", [x, h * 0.6 + h * 0.18, z], [tilt, turn, (random() - 0.5) * 0.2], [w * 1.01, h * 0.12, w * 0.71], s.matrix);
    shapes.push({ kind: "circle", x, z, radius: w * 0.45, height: h * 1.3 });
  }
  return shapes;
}

export interface MarsDressing {
  /** Where each thing went, for keeping later things clear of them. */
  placed: { dir: Vector3; room: number }[];
}

export interface MarsDressingSpec {
  b: Batcher;
  radius: number;
  seed: number;
  site: (dir: Vector3, heading: number, sink?: number) => Site;
  colliders: ColliderGroup[];
  /** The machines and other spots that need room round them. */
  keep: readonly Vector3[];
  /** Paths players walk, as arcs between two spots. Nothing goes on them. */
  paths: readonly (readonly [Vector3, Vector3])[];
  /** Other things already standing: their place and how much room they take. */
  taken?: readonly { dir: Vector3; room: number }[];
  /** True where something else must not be covered (tracks, lanes). */
  avoid?: (dir: Vector3) => boolean;
  /** Ground too high or steep for a prop (a crater wall, say). */
  terrain: Terrain;
  counts: { buttes: number; boulders: number; balanced: number; dunes: number; slabs: number };
  /** How much bigger or smaller everything is. */
  scale?: number;
}

/** Places the dressing round a little Mars world, each piece with room round it. */
export function dressMars(spec: MarsDressingSpec): MarsDressing {
  const random = createRandom(spec.seed);
  const R = spec.radius;
  const scale = spec.scale ?? 1;
  const placed: { dir: Vector3; room: number }[] = [...(spec.taken ?? [])];
  const free = (dir: Vector3, room: number): boolean => {
    if (spec.keep.some((k) => angleBetween(dir, k) * R < room + 2.2)) return false;
    if (spec.paths.some(([a, c]) => distanceToArc(dir, a, c) * R < room + 0.9)) return false;
    if (placed.some((p) => angleBetween(dir, p.dir) * R < room + p.room + 0.8)) return false;
    if (spec.avoid?.(dir)) return false;
    // Not up on a crater rim or down in a bowl.
    if (Math.abs(spec.terrain.radiusAt(dir) - R) > 0.5) return false;
    return true;
  };
  const place = (count: number, room: () => number, build: (s: Site, size: number) => Shape[], sink = 0.04, latitude = 78): void => {
    let made = 0;
    for (let tries = 0; made < count && tries < 900; tries += 1) {
      const size = room();
      const dir = latLonToDir(random() * latitude * 2 - latitude, random() * 360 - 180);
      if (!free(dir, size * 1.6)) continue;
      const s = spec.site(dir, random() * 360, sink);
      const shapes = build(s, size);
      if (shapes.length > 0) spec.colliders.push(createColliderGroup(s.matrix, shapes));
      placed.push({ dir, room: size * 1.6 });
      made += 1;
    }
  };
  place(spec.counts.buttes, () => (1.1 + random() * 0.9) * scale, (s, size) => buildButte(spec.b, s, size, random), 0.08);
  place(spec.counts.balanced, () => (0.5 + random() * 0.25) * scale, (s, size) => buildBalancedRock(spec.b, s, size, random));
  place(spec.counts.dunes, () => (0.75 + random() * 0.45) * scale, (s, size) => buildDunes(spec.b, s, size, random), 0.02);
  place(spec.counts.boulders, () => (0.32 + random() * 0.3) * scale, (s, size) => buildBoulders(spec.b, s, size, random));
  place(spec.counts.slabs, () => (0.45 + random() * 0.3) * scale, (s, size) => buildSlabs(spec.b, s, size, random), 0.06);
  return { placed: placed.slice(spec.taken?.length ?? 0) };
}

/**
 * Small dust devils that wander across a world now and then: a twisting
 * funnel of soft dust dots, all in one draw call. Only for looks; they pass
 * through everything and never touch anything.
 */
export class DustDevils {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;
  private readonly devils: { dir: Vector3; heading: Vector3; age: number; life: number; phase: number }[] = [];
  private time = 0;
  private readonly random: () => number;
  private readonly p = new Vector3();
  private readonly side = new Vector3();
  private static readonly DOTS = 130;

  constructor(
    private readonly terrain: Terrain,
    private readonly radius: number,
    count: number,
    /** True where a devil should not start (near the machines). */
    private readonly blocked: (dir: Vector3) => boolean,
    seed = 5,
  ) {
    this.random = createRandom(seed);
    const total = DustDevils.DOTS * count;
    this.positions = new Float32Array(total * 3);
    this.alphas = new Float32Array(total);
    const sizes = new Float32Array(total);
    for (let i = 0; i < total; i += 1) sizes[i] = i % DustDevils.DOTS < DustDevils.DOTS - 18 ? 0.06 + this.random() * 0.1 : 0.24 + this.random() * 0.2;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial("#C48356", false, 0.38));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    for (let i = 0; i < count; i += 1) this.devils.push(this.spawn(this.random() * 8));
  }

  private spawn(age = 0): { dir: Vector3; heading: Vector3; age: number; life: number; phase: number } {
    let dir = latLonToDir(this.random() * 120 - 60, this.random() * 360 - 180);
    for (let tries = 0; tries < 40 && this.blocked(dir); tries += 1) dir = latLonToDir(this.random() * 120 - 60, this.random() * 360 - 180);
    return { dir, heading: headingToTangent(dir, this.random() * 360), age, life: 14 + this.random() * 8, phase: this.random() * 10 };
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const DOTS = DustDevils.DOTS;
    const wall = DOTS - 18;
    this.devils.forEach((devil, k) => {
      devil.age += dt;
      if (devil.age > devil.life) Object.assign(devil, this.spawn());
      // Drift slowly along the ground, turning a little.
      const step = (reducedMotion ? 0.2 : 0.55) * dt;
      devil.dir.addScaledVector(devil.heading, step / this.radius).normalize();
      devil.heading.addScaledVector(devil.dir, -devil.heading.dot(devil.dir)).normalize();
      this.side.crossVectors(devil.dir, devil.heading).normalize();
      devil.heading.addScaledVector(this.side, Math.sin(this.time * 0.4 + devil.phase) * 0.004).normalize();
      const fade = Math.min(1, devil.age / 2.5, (devil.life - devil.age) / 2.5);
      const ground = this.terrain.radiusAt(devil.dir) - 0.05;
      for (let i = 0; i < DOTS; i += 1) {
        const n = k * DOTS + i;
        let h: number;
        let r: number;
        let a: number;
        let alpha: number;
        if (i < wall) {
          const t = (i / wall + this.time * 0.2 + devil.phase) % 1;
          h = t * 2;
          r = 0.07 + Math.pow(t, 1.5) * 0.5;
          a = (i % 4) * (Math.PI / 2) + t * 13 + this.time * (7 - t * 4) + devil.phase;
          alpha = (0.75 - t * 0.45) * Math.min(1, t * 12) * Math.min(1, (1 - t) * 5);
        } else {
          const j = i - wall;
          h = 0.07 + (j % 3) * 0.08;
          r = 0.26 + (j % 5) * 0.06;
          a = j * 1.7 + this.time * 3.2 + devil.phase;
          alpha = 0.3;
        }
        const lean = -((h / 2) ** 2) * 0.4 + Math.sin(this.time * 1.7 + devil.phase) * 0.07 * (h / 2);
        this.p
          .copy(devil.dir)
          .multiplyScalar(ground + h)
          .addScaledVector(this.side, Math.cos(a) * r)
          .addScaledVector(devil.heading, Math.sin(a) * r + lean);
        this.positions[n * 3] = this.p.x;
        this.positions[n * 3 + 1] = this.p.y;
        this.positions[n * 3 + 2] = this.p.z;
        this.alphas[n] = alpha * Math.max(0, fade);
      }
    });
    this.points.geometry.getAttribute("position").needsUpdate = true;
    this.points.geometry.getAttribute("aAlpha").needsUpdate = true;
  }

  /** Dots keep their size on screen at any window height. */
  resize(pixelHeight: number): void {
    (this.points.material as unknown as { uniforms: Record<string, { value: number }> }).uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as { dispose(): void }).dispose();
  }
}
