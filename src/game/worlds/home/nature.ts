import { Matrix4, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import { type ColliderGroup, type Shape, createColliderGroup } from "../../world/colliders";
import { createRandom } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import type { Terrain } from "../../world/terrain";
import { distanceToArc } from "../shapes";
import { C } from "./buildings";
import { HILL_TOP, HOME_RADIUS, MAILBOX, PATHS, PATH_HALF_WIDTH, POND, SITES, type Site } from "./layout";

const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

/** A placement matrix standing upright on the ground along `dir`. */
export function groundMatrix(terrain: Terrain, dir: Vector3, heading: number, sink = 0.04): Matrix4 {
  const up = dir.clone().normalize();
  const position = up.clone().multiplyScalar(terrain.radiusAt(up) - sink);
  return surfaceMatrix(position, up, headingToTangent(up, heading));
}

/** Angular distance to the nearest footpath, in world units on the surface. */
export function pathDistance(dir: Vector3): number {
  let best = Infinity;
  for (const [a, b] of PATHS) best = Math.min(best, distanceToArc(dir, a, b) * HOME_RADIUS);
  return best;
}

const KEEP_OUT: { dir: Vector3; radius: number }[] = [
  { dir: SITES.house.dir, radius: 7.0 },
  { dir: SITES.shed.dir, radius: 6.6 },
  { dir: SITES.garden.dir, radius: 4.8 },
  { dir: SITES.dish.dir, radius: 3.2 },
  { dir: latLonToDir(MAILBOX.lat, MAILBOX.lon), radius: 1.6 },
  { dir: latLonToDir(SITES.spawn.lat, SITES.spawn.lon), radius: 2.5 },
  { dir: HILL_TOP, radius: 2.6 },
  { dir: POND, radius: 3.4 },
  { dir: latLonToDir(-27, -4), radius: 2.4 },
  { dir: latLonToDir(-24, 13), radius: 1.6 },
  { dir: latLonToDir(-17, 26), radius: 1.0 },
  { dir: latLonToDir(4, 4), radius: 0.8 },
];

/** True if a prop of `size` can stand here without blocking a path or a building. */
export function isClear(dir: Vector3, size: number): boolean {
  for (const zone of KEEP_OUT) if (angleBetween(dir, zone.dir) * HOME_RADIUS < zone.radius + size) return false;
  return pathDistance(dir) > PATH_HALF_WIDTH + size + 0.2;
}

const LEAVES = ["#6E9470", "#7FA37A", "#5E8466", "#88A979"];
const AUTUMN = ["#D49A4A", "#C77A3F", "#E0B060"];
const BIRCH = ["#A9BF6E", "#BFCB7A", "#97B068"];
export const FLOWERS = ["#E58B6B", "#F2C14E", "#F4ECDD", "#B9A5D8", "#E36F5A"];

function randomDir(random: () => number): Vector3 {
  const z = random() * 2 - 1;
  const t = random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(t), z, r * Math.sin(t));
}

export type TreeKind = "oak" | "pine" | "birch" | "autumn" | "apple";

export interface TreePlan {
  dir: Vector3;
  kind: TreeKind;
  scale: number;
  heading: number;
  /** Hand-placed near the yard, so seen up close. Background trees use lighter shapes. */
  hero?: boolean;
}

/** A soft dark patch painted into the grass under trees and around buildings. */
export interface ShadeSpot {
  dir: Vector3;
  radius: number;
  strength: number;
}

/**
 * Hand-placed trees that frame the yard, plus a wilder ring of woods on the
 * far side of the planet. Decided before the ground is painted, so the grass
 * can darken under each tree.
 */
export function planTrees(density: number): TreePlan[] {
  const random = createRandom(2026);
  const plan: TreePlan[] = [
    // Hero trees that frame the house and the workshop.
    { dir: latLonToDir(18, -27), kind: "oak", scale: 1.45, heading: 20 },
    { dir: latLonToDir(-1, -26), kind: "autumn", scale: 1.15, heading: 80 },
    { dir: latLonToDir(20, 29), kind: "birch", scale: 1.2, heading: 0 },
    { dir: latLonToDir(16, 32.5), kind: "birch", scale: 1.0, heading: 40 },
    { dir: latLonToDir(21, 34), kind: "birch", scale: 0.9, heading: 90 },
    { dir: latLonToDir(-9, -22), kind: "apple", scale: 1.0, heading: 10 },
    { dir: latLonToDir(-5, 42), kind: "pine", scale: 1.25, heading: 0 },
    { dir: latLonToDir(36, -14), kind: "pine", scale: 1.1, heading: 0 },
    { dir: latLonToDir(39, 20), kind: "oak", scale: 1.1, heading: 0 },
  ];
  for (const tree of plan) tree.hero = true;
  const count = Math.round(40 * density + 18);
  for (let n = 0, tries = 0; n < count && tries < 3000; tries += 1) {
    const dir = randomDir(random);
    if (!isClear(dir, 0.9)) continue;
    // Keep the home lot open: few trees near the house side, more woods far away.
    const nearHome = angleBetween(dir, latLonToDir(5, 0));
    if (nearHome < 0.85 && random() < 0.75) continue;
    let crowded = false;
    for (const other of plan) if (angleBetween(dir, other.dir) * HOME_RADIUS < 1.5) crowded = true;
    if (crowded) continue;
    const r = random();
    const far = nearHome > 1.6;
    const kind: TreeKind = far ? (r < 0.55 ? "pine" : r < 0.75 ? "oak" : r < 0.9 ? "birch" : "autumn") : r < 0.3 ? "pine" : r < 0.6 ? "oak" : r < 0.8 ? "birch" : "autumn";
    plan.push({ dir, kind, scale: 0.8 + random() * 0.45, heading: random() * 360 });
    n += 1;
  }
  return plan;
}

export function treeShade(plan: TreePlan[]): ShadeSpot[] {
  return plan.map((tree) => ({ dir: tree.dir, radius: (tree.kind === "pine" ? 0.9 : 1.25) * tree.scale, strength: 0.22 }));
}

/**
 * A leafy crown: a dark heart, a ring of mid blobs and a few bright ones on
 * top where the light lands. Blob sizes vary so the outline is lumpy, the way
 * a painted tree looks.
 */
function canopy(b: Batcher, m: Matrix4, random: () => number, palette: string[], s: number, height: number, size: number, hero: boolean): void {
  const blob = sphere(hero ? "mid" : "low");
  b.place(blob, palette === AUTUMN ? "#A8643A" : "#4F7256", v(0, height * s, 0), [0, 0, 0], [size * 1.05 * s, size * 0.85 * s, size * 1.05 * s], m, "foliage", 0.3);
  const ring = 7;
  for (let i = 0; i < ring; i += 1) {
    const a = (i / ring) * Math.PI * 2 + random() * 0.5;
    const r = size * (0.7 + random() * 0.25) * s;
    const y = (height - 0.12 + random() * 0.3) * s;
    b.place(blob, palette[Math.floor(random() * palette.length)]!, v(Math.cos(a) * r, y, Math.sin(a) * r), [0, 0, 0], size * (0.5 + random() * 0.22) * s, m, "foliage", 0.35);
  }
  for (let i = 0; i < 3; i += 1) {
    const a = i * 2.2 + random();
    b.place(blob, palette === AUTUMN ? "#E8C072" : "#9DBB84", v(Math.cos(a) * size * 0.35 * s, (height + size * 0.55) * s, Math.sin(a) * size * 0.35 * s), [0, 0, 0], size * (0.42 + random() * 0.12) * s, m, "foliage", 0.4);
  }
}

/** Builds one tree. Canopies go in the foliage layer so they move in the wind. */
function buildTree(b: Batcher, m: Matrix4, tree: TreePlan, random: () => number): void {
  const s = tree.scale;
  switch (tree.kind) {
    case "pine": {
      b.place(cylinder(7), C.woodDark, v(0, 0.35 * s, 0), [0, 0, 0], [0.11 * s, 0.7 * s, 0.11 * s], m);
      for (let i = 0; i < 4; i += 1) {
        b.place(cone(10), i % 2 ? "#4F6F5A" : "#5C7D62", v(0, (0.75 + i * 0.42) * s, 0), [0, i * 0.7, 0], [(0.78 - i * 0.15) * s, 0.72 * s, (0.78 - i * 0.15) * s], m, "foliage", 0.25);
      }
      break;
    }
    case "birch": {
      b.place(cylinder(8, 0.75), "#EDE6D8", v(0, 0.85 * s, 0), [0, 0, 0.03], [0.085 * s, 1.7 * s, 0.085 * s], m);
      // The dark marks on birch bark.
      for (let i = 0; i < 5; i += 1) {
        b.place(box(0.01), "#3A3330", v(0.07 * s * (i % 2 ? 1 : -1), (0.3 + i * 0.27) * s, 0.03), [0, i, 0], [0.04 * s, 0.025 * s, 0.07 * s], m);
      }
      for (let i = 0; i < 3; i += 1) {
        const a = i * 2.1 + random();
        b.place(sphere("mid"), BIRCH[i % BIRCH.length]!, v(Math.cos(a) * 0.22 * s, (1.75 + i * 0.22) * s, Math.sin(a) * 0.22 * s), [0, 0, 0], [0.42 * s, 0.55 * s, 0.42 * s], m, "foliage", 0.4);
      }
      break;
    }
    default: {
      const palette = tree.kind === "autumn" ? AUTUMN : LEAVES;
      b.place(cylinder(8, 0.62), C.woodDark, v(0, 0.62 * s, 0), [0, 0, 0.05], [0.15 * s, 1.25 * s, 0.15 * s], m);
      b.place(cylinder(5, 0.5), C.woodDark, v(0.2 * s, 1.1 * s, 0), [0, 0, -0.75], [0.055 * s, 0.45 * s, 0.055 * s], m);
      b.place(cylinder(5, 0.5), C.woodDark, v(-0.16 * s, 1.18 * s, 0.05), [0.2, 0, 0.8], [0.05 * s, 0.4 * s, 0.05 * s], m);
      // Roots where the trunk meets the ground.
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        b.place(cone(5), C.woodDark, v(Math.cos(a) * 0.13 * s, 0.06, Math.sin(a) * 0.13 * s), [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], [0.06 * s, 0.25 * s, 0.06 * s], m);
      }
      canopy(b, m, random, palette, s, 1.75, 0.62, tree.hero ?? false);
      if (tree.kind === "apple") {
        for (let i = 0; i < 9; i += 1) {
          const a = i * 2.4;
          const r = 0.45 + (i % 3) * 0.12;
          b.place(sphere("low"), "#D24B3E", v(Math.cos(a) * r * s, (1.45 + (i % 4) * 0.14) * s, Math.sin(a) * r * s), [0, 0, 0], 0.06 * s, m, "foliage", 0.35);
        }
        // Two windfalls in the grass.
        b.place(sphere("low"), "#D24B3E", v(0.5, 0.05, 0.2), [0, 0, 0], 0.06, m);
        b.place(sphere("low"), "#C99A3E", v(-0.3, 0.05, 0.45), [0, 0, 0], 0.06, m);
      }
    }
  }
  // Mushrooms at the foot of some trees.
  if (tree.kind !== "pine" && random() < 0.45) {
    for (let i = 0; i < 3; i += 1) {
      const a = random() * Math.PI * 2;
      const r = 0.3 + random() * 0.15;
      const h = 0.06 + random() * 0.05;
      b.place(cylinder(6), C.paper, v(Math.cos(a) * r, h / 2, Math.sin(a) * r), [0, 0, 0], [0.018, h, 0.018], m, "detail", 0);
      b.place(sphere("low"), i === 0 ? C.clay : "#C9A77A", v(Math.cos(a) * r, h, Math.sin(a) * r), [0, 0, 0], [0.045, 0.03, 0.045], m, "detail", 0);
    }
  }
}

/** A clump of grass blades that lean out from a soft mound. Tips sway; roots stay put. */
const BLADES = ["#A3BD8C", "#8DAE7C", "#93B47E", "#B4C793"];
function grassClump(b: Batcher, m: Matrix4, random: () => number, blades: number, tall = 1): void {
  b.place(sphere("tiny"), "#7FA37A", v(0, 0.0, 0), [0, random() * 3, 0], [0.12, 0.05, 0.1], m, "detail", 0);
  for (let i = 0; i < blades; i += 1) {
    const a = (i / blades) * Math.PI * 2 + random() * 0.6;
    const r = 0.03 + random() * 0.07;
    const h = (0.13 + random() * 0.11) * tall;
    const lean = 0.25 + random() * 0.3;
    // Lean each blade away from the middle of the clump.
    b.place(cone(3), BLADES[i % BLADES.length]!, v(Math.cos(a) * r, h / 2 - 0.01, Math.sin(a) * r), [Math.sin(a) * lean, random() * 3, -Math.cos(a) * lean], [0.035, h, 0.02], m, "detail", 1);
  }
}

/** One flowering plant: a few stems from a leafy foot, each with a petal head and a bright eye. */
export function flowerPlant(b: Batcher, m: Matrix4, random: () => number, color: string, scale = 1): void {
  const eye = color === C.amber || color === "#F2C14E" ? "#8A4E2A" : C.amber;
  b.place(sphere("tiny"), "#5E8466", v(0, 0.015, 0), [0, random() * 3, 0], [0.085 * scale, 0.025, 0.05 * scale], m, "detail", 0.3);
  const stems = 2 + Math.floor(random() * 2);
  for (let k = 0; k < stems; k += 1) {
    const a = k * 2.4 + random();
    const h = (0.11 + random() * 0.09) * scale;
    const x = Math.cos(a) * 0.05;
    const z = Math.sin(a) * 0.05;
    b.place(cylinder(4, 1, true), "#5E8466", v(x * 0.5, h / 2, z * 0.5), [z * 2, 0, -x * 2], [0.01, h, 0.01], m, "detail", 0.9);
    // A five-sided petal disc reads as a flower at this size, for a fraction of the triangles.
    // Heads turn different ways, the way real flowers follow the light.
    const tip: [number, number, number] = [(random() - 0.5) * 0.9, a, (random() - 0.5) * 0.9];
    b.place(cylinder(5), color, v(x, h + 0.004, z), tip, [0.058 * scale, 0.008, 0.058 * scale], m, "detail", 0.9);
    // A second ring of petals, turned half a step, makes a ten-point star.
    b.place(cylinder(5), color, v(x, h + 0.006, z), [tip[0], tip[1] + Math.PI / 5, tip[2]], [0.045 * scale, 0.008, 0.045 * scale], m, "detail", 0.9);
    b.place(cylinder(5), eye, v(x, h + 0.012, z), tip, [0.017 * scale, 0.012, 0.017 * scale], m, "detail", 0.9);
  }
}

/** A drift of one flower color, the way wildflowers really grow: thick in the middle, sparse at the edge. */
export function flowerDrift(b: Batcher, terrain: Terrain, center: Vector3, random: () => number, color: string, count: number, spread: number): void {
  const east = headingToTangent(center, 90);
  const north = headingToTangent(center, 0);
  for (let i = 0; i < count; i += 1) {
    const a = random() * Math.PI * 2;
    const r = random() * random() * spread * 1.4;
    const dir = center.clone().addScaledVector(east, (Math.cos(a) * r) / HOME_RADIUS).addScaledVector(north, (Math.sin(a) * r) / HOME_RADIUS).normalize();
    if (pathDistance(dir) < PATH_HALF_WIDTH + 0.1) continue;
    flowerPlant(b, groundMatrix(terrain, dir, random() * 360, 0.02), random, color, 0.9 + random() * 0.3);
    if (i % 4 === 0) grassClump(b, groundMatrix(terrain, dir.clone().addScaledVector(east, 0.15 / HOME_RADIUS).normalize(), random() * 360, 0.02), random, 6);
  }
}

export function scatterNature(b: Batcher, terrain: Terrain, density: number, trees: TreePlan[]): ColliderGroup[] {
  const random = createRandom(2027);
  const colliders: ColliderGroup[] = [];

  for (const tree of trees) {
    const m = groundMatrix(terrain, tree.dir, tree.heading);
    buildTree(b, m, tree, random);
    const radius = tree.kind === "birch" ? 0.12 : 0.22;
    colliders.push(createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: radius * tree.scale + 0.05, height: 3 }]));
    // Grass gathers around the trunk.
    for (let i = 0; i < (tree.hero ? 3 : density > 0.6 ? 2 : 1); i += 1) {
      const a = random() * Math.PI * 2;
      const gm = groundMatrix(terrain, tree.dir.clone().addScaledVector(headingToTangent(tree.dir, (a * 180) / Math.PI), 0.45 / HOME_RADIUS).normalize(), random() * 360, 0.02);
      grassClump(b, gm, random, 8, 1.2);
    }
  }

  // Bushes and mossy rock clusters.
  for (let n = 0, tries = 0; n < 44 * density + 12 && tries < 3000; tries += 1) {
    const dir = randomDir(random);
    if (!isClear(dir, 0.45)) continue;
    const m = groundMatrix(terrain, dir, random() * 360);
    if (random() < 0.55) {
      const parts = 3 + Math.floor(random() * 2);
      for (let i = 0; i < parts; i += 1) {
        const a = (i / parts) * Math.PI * 2;
        b.place(sphere("mid"), LEAVES[Math.floor(random() * LEAVES.length)]!, v(Math.cos(a) * 0.2, 0.2 + (i === 0 ? 0.08 : 0), Math.sin(a) * 0.2), [0, 0, 0], 0.24 + random() * 0.1, m, "foliage", 0.2);
      }
      if (random() < 0.45) {
        const berry = random() < 0.5 ? C.clay : "#F4ECDD";
        for (let i = 0; i < 6; i += 1) b.place(sphere("low"), berry, v((random() - 0.5) * 0.55, 0.25 + random() * 0.18, (random() - 0.5) * 0.55), [0, 0, 0], 0.035, m, "foliage", 0.2);
      }
      colliders.push(createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: 0.35, height: 0.5 }]));
    } else {
      const rocks = 1 + Math.floor(random() * 3);
      for (let i = 0; i < rocks; i += 1) {
        const size = (i === 0 ? 0.38 : 0.2) + random() * 0.18;
        const x = i === 0 ? 0 : (random() - 0.5) * 0.8;
        const z = i === 0 ? 0 : (random() - 0.5) * 0.8;
        b.place(sphere("mid"), random() < 0.5 ? C.stone : C.stoneLight, v(x, size * 0.3, z), [random(), random(), random()], [size, size * 0.7, size * 0.9], m);
        // A cap of moss on the top.
        b.place(sphere("mid"), "#7D9A5E", v(x, size * 0.6, z), [0, random() * 3, 0], [size * 0.6, size * 0.16, size * 0.55], m);
      }
      grassClump(b, m, random, 7);
      colliders.push(createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: 0.42, height: 0.5 }]));
    }
    n += 1;
  }

  // Grass clumps, thicker near the edges of paths and buildings.
  for (let n = 0, tries = 0; n < 260 * density + 60 && tries < 6000; tries += 1) {
    const dir = randomDir(random);
    const path = pathDistance(dir);
    if (path < PATH_HALF_WIDTH + 0.12) continue;
    let blocked = false;
    for (const zone of KEEP_OUT.slice(0, 4)) if (angleBetween(dir, zone.dir) * HOME_RADIUS < zone.radius - 2.4) blocked = true;
    if (blocked) continue;
    // Prefer the soft border along a path.
    if (path > 1.6 && random() < 0.85) continue;
    grassClump(b, groundMatrix(terrain, dir, random() * 360, 0.02), random, 6 + Math.floor(random() * 4));
    n += 1;
  }

  // Wildflower drifts, each one color.
  const drifts = Math.round(16 * density + 6);
  for (let n = 0, tries = 0; n < drifts && tries < 2000; tries += 1) {
    const dir = randomDir(random);
    if (!isClear(dir, 0.8)) continue;
    flowerDrift(b, terrain, dir, random, FLOWERS[Math.floor(random() * FLOWERS.length)]!, 8 + Math.floor(random() * 8), 0.75);
    n += 1;
  }

  // Pebbles along the path edges.
  for (const [a, bDir] of PATHS) {
    const steps = Math.max(2, Math.round((angleBetween(a, bDir) * HOME_RADIUS) / 0.9));
    for (let i = 1; i < steps; i += 1) {
      if (random() < 0.4) continue;
      const t = i / steps;
      const mid = a.clone().lerp(bDir, t).normalize();
      const side = new Vector3().crossVectors(a, bDir).normalize().multiplyScalar(((random() < 0.5 ? -1 : 1) * (PATH_HALF_WIDTH + 0.1)) / HOME_RADIUS);
      const dir = mid.add(side).normalize();
      const m = groundMatrix(terrain, dir, random() * 360, 0.03);
      b.place(sphere("low"), random() < 0.5 ? C.stoneLight : "#B8AE9E", v(0, 0.03, 0), [0, random() * 3, 0], [0.12, 0.06, 0.09], m, "detail", 0);
    }
  }
  return colliders;
}

/** Mom's vegetable garden, fenced, with sunflowers along the back. */
export function buildGarden(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];
  for (let row = 0; row < 3; row += 1) {
    const z = -0.95 + row * 0.95;
    b.place(box(0.03), C.wood, v(0, 0.0, z), [0, 0, 0], [2.6, 0.6, 0.66], m);
    b.place(box(0.02), "#6B4A35", v(0, 0.29, z), [0, 0, 0], [2.45, 0.04, 0.52], m);
    for (let i = 0; i < 6; i += 1) {
      const x = -1.05 + i * 0.42;
      if (row === 0) {
        b.place(sphere("low"), "#7FA37A", v(x, 0.38, z), [0, i, 0], [0.15, 0.12, 0.15], m);
        b.place(sphere("low"), "#A9C48F", v(x, 0.42, z), [0, 0, 0], 0.08, m);
      } else if (row === 1) {
        for (let k = 0; k < 3; k += 1) b.place(cone(4), "#6E9470", v(x + (k - 1) * 0.05, 0.42, z), [(k - 1) * 0.4, 0, 0], [0.03, 0.22, 0.03], m);
        b.place(cone(6), "#E07A3A", v(x, 0.31, z + 0.0), [Math.PI, 0, 0], [0.035, 0.06, 0.035], m);
      } else if (i % 2 === 0) {
        b.place(sphere("mid"), "#E08A3A", v(x + 0.2, 0.42, z), [0, 0, 0], [0.18, 0.13, 0.18], m);
        b.place(cylinder(5), "#5E8466", v(x + 0.2, 0.56, z), [0, 0, 0.3], [0.015, 0.06, 0.015], m);
      } else {
        b.place(sphere("low"), "#6E9470", v(x, 0.36, z + 0.1), [0, 0, 0], [0.18, 0.06, 0.12], m);
      }
    }
    shapes.push({ kind: "box", x: 0, z, halfWidth: 1.3, halfDepth: 0.33, height: 0.32 });
  }
  // Picket fence with a gap at the front.
  const fx = 1.75;
  const fz = 1.55;
  const picket = (x: number, z: number, rot: number): void => {
    b.place(box(0.01), C.paper, v(x, 0.32, z), [0, rot, 0], [0.09, 0.64, 0.04], m);
    b.place(cone(4), C.paper, v(x, 0.7, z), [0, rot + Math.PI / 4, 0], [0.065, 0.12, 0.065], m);
  };
  for (let i = 0; i <= 14; i += 1) {
    const x = -fx + (i * 2 * fx) / 14;
    picket(x, -fz, 0);
    if (Math.abs(x) > 0.55) picket(x, fz, 0);
  }
  for (let i = 1; i < 12; i += 1) {
    const z = -fz + (i * 2 * fz) / 12;
    picket(-fx, z, Math.PI / 2);
    picket(fx, z, Math.PI / 2);
  }
  for (const y of [0.22, 0.48]) {
    b.place(box(0.005), C.paper, v(0, y, -fz - 0.03), [0, 0, 0], [fx * 2, 0.05, 0.03], m);
    for (const side of [-1, 1]) b.place(box(0.005), C.paper, v(side * fx + side * 0.03, y, 0), [0, 0, 0], [0.03, 0.05, fz * 2], m);
    for (const side of [-1, 1]) b.place(box(0.005), C.paper, v(side * (fx + 0.55) / 2, y, fz + 0.03), [0, 0, 0], [fx - 0.55, 0.05, 0.03], m);
  }
  shapes.push(
    { kind: "box", x: 0, z: -fz, halfWidth: fx, halfDepth: 0.06, height: 0.75 },
    { kind: "box", x: -fx, z: 0, halfWidth: 0.06, halfDepth: fz, height: 0.75 },
    { kind: "box", x: fx, z: 0, halfWidth: 0.06, halfDepth: fz, height: 0.75 },
    { kind: "box", x: -(fx + 0.55) / 2, z: fz, halfWidth: (fx - 0.55) / 2, halfDepth: 0.06, height: 0.75 },
    { kind: "box", x: (fx + 0.55) / 2, z: fz, halfWidth: (fx - 0.55) / 2, halfDepth: 0.06, height: 0.75 },
  );
  // Sunflowers along the back fence.
  for (let i = 0; i < 4; i += 1) {
    const x = -1.2 + i * 0.8;
    const h = 1.2 + (i % 2) * 0.25;
    b.place(cylinder(5), "#5E8466", v(x, h / 2, -fz + 0.25), [0, 0, 0], [0.025, h, 0.025], m);
    b.place(sphere("low"), "#6E9470", v(x + 0.08, h * 0.5, -fz + 0.25), [0, 0, 0], [0.1, 0.03, 0.06], m);
    b.place(cylinder(14), "#E8B53A", v(x, h, -fz + 0.3), [Math.PI / 2 - 0.3, 0, 0], [0.18, 0.03, 0.18], m);
    b.place(cylinder(14), "#6B3F2A", v(x, h + 0.01, -fz + 0.33), [Math.PI / 2 - 0.3, 0, 0], [0.09, 0.03, 0.09], m);
  }
  // A watering can and a little wheelbarrow.
  b.place(cylinder(10), "#6E8FB0", v(1.3, 0.14, 1.25), [0, 0, 0], [0.12, 0.26, 0.12], m);
  b.place(cylinder(5, 0.5), "#6E8FB0", v(1.16, 0.2, 1.33), [0.6, 0.9, 0], [0.025, 0.26, 0.025], m);
  return shapes;
}

/** The little pond on the far side of the planet. */
export function buildPond(b: Batcher, terrain: Terrain): void {
  const up = POND.clone();
  const position = up.clone().multiplyScalar(terrain.radiusAt(up) + 0.12);
  const m = surfaceMatrix(position, up, headingToTangent(up, 0));
  b.place(cylinder(28), "#6E8FB0", v(0, 0, 0), [0, 0, 0], [2.05, 0.04, 2.05], m);
  b.place(cylinder(28), "#86A7C4", v(0.3, 0.025, -0.2), [0, 0, 0], [1.2, 0.02, 0.9], m);
  const random = createRandom(31);
  for (let i = 0; i < 5; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 0.5 + random() * 1.1;
    b.place(cylinder(10), "#7FA37A", v(Math.cos(a) * r, 0.04, Math.sin(a) * r), [0, a, 0], [0.18, 0.015, 0.18], m);
    if (i % 2) b.place(sphere("low"), "#F4ECDD", v(Math.cos(a) * r, 0.08, Math.sin(a) * r), [0, 0, 0], 0.05, m);
  }
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + random() * 0.3;
    const r = 2.1 + random() * 0.3;
    b.place(cylinder(4), "#6E9470", v(Math.cos(a) * r, 0.25, Math.sin(a) * r), [random() * 0.2, 0, random() * 0.2], [0.02, 0.6 + random() * 0.3, 0.02], m, "foliage", 0.9);
    if (i % 3 === 0) b.place(capsuleLike(), "#7A4A2E", v(Math.cos(a) * r, 0.55, Math.sin(a) * r), [0, 0, 0], [0.035, 0.1, 0.035], m);
  }
}

function capsuleLike() {
  return sphere("low");
}

/**
 * The meadow on the south side: a big oak with a rope swing, a picnic
 * blanket, a bird bath and a signpost toward the hill. It gives the wide view
 * a second place to look at.
 */
export function buildMeadow(b: Batcher, terrain: Terrain, density = 1): ColliderGroup[] {
  const colliders: ColliderGroup[] = [];

  // The swing oak.
  const oak = groundMatrix(terrain, latLonToDir(-27, -4), 70);
  b.place(cylinder(9, 0.65), C.woodDark, v(0, 1.0, 0), [0, 0, 0.04], [0.26, 2.0, 0.26], oak);
  b.place(cylinder(7, 0.5), C.woodDark, v(0.55, 1.95, 0), [0, 0, -1.25], [0.11, 1.4, 0.11], oak);
  canopy(b, oak, createRandom(14), LEAVES, 1.55, 1.75, 0.66, true);
  // Rope swing hanging from the branch.
  for (const z of [-0.18, 0.18]) b.place(cylinder(4), C.paper, v(1.05, 1.35, z), [0, 0, 0], [0.012, 1.3, 0.012], oak);
  b.place(box(0.02), C.clay, v(1.05, 0.7, 0), [0, 0, 0], [0.22, 0.05, 0.46], oak);
  colliders.push(createColliderGroup(oak, [{ kind: "circle", x: 0, z: 0, radius: 0.32, height: 3 }]));

  // Picnic blanket with a basket and two cups.
  const picnic = groundMatrix(terrain, latLonToDir(-24, 13), 20, 0.0);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) {
    b.place(box(0.005), (i + j) % 2 ? C.paper : C.clay, v(-0.6 + i * 0.4, 0.03, -0.6 + j * 0.4), [0, 0, 0], [0.4, 0.02, 0.4], picnic);
  }
  b.place(box(0.04), C.woodLight, v(0.25, 0.2, -0.2), [0, 0.3, 0], [0.5, 0.32, 0.36], picnic);
  b.place(torus(0.15, Math.PI), C.woodDark, v(0.25, 0.38, -0.2), [0, 0.3, 0], [0.2, 0.2, 0.2], picnic);
  b.place(cylinder(10), C.paper, v(-0.35, 0.09, 0.3), [0, 0, 0], [0.06, 0.12, 0.06], picnic);
  b.place(cylinder(10), "#6E8FB0", v(-0.15, 0.09, 0.42), [0, 0, 0], [0.06, 0.12, 0.06], picnic);
  // A paper plane someone left on the blanket.
  b.place(cone(3), C.paper, v(-0.4, 0.07, -0.35), [Math.PI / 2, 0, 0.3], [0.12, 0.3, 0.03], picnic);

  // Bird bath.
  const bath = groundMatrix(terrain, latLonToDir(-17, 26), 0);
  b.place(cylinder(10), C.stoneLight, v(0, 0.06, 0), [0, 0, 0], [0.3, 0.12, 0.3], bath);
  b.place(cylinder(10, 0.7), C.stoneLight, v(0, 0.45, 0), [0, 0, 0], [0.12, 0.7, 0.12], bath);
  b.place(cylinder(16, 1.2), C.stoneLight, v(0, 0.86, 0), [0, 0, 0], [0.38, 0.12, 0.38], bath);
  b.place(cylinder(16), "#86A7C4", v(0, 0.93, 0), [0, 0, 0], [0.38, 0.02, 0.38], bath);
  b.place(sphere("low"), "#C0573E", v(0.3, 1.02, 0.1), [0, 0, 0], [0.07, 0.06, 0.09], bath);
  b.place(sphere("low"), "#C0573E", v(0.3, 1.09, 0.17), [0, 0, 0], 0.045, bath);
  b.place(cone(4), C.amber, v(0.3, 1.09, 0.23), [Math.PI / 2, 0, 0], [0.015, 0.04, 0.015], bath);
  colliders.push(createColliderGroup(bath, [{ kind: "circle", x: 0, z: 0, radius: 0.4, height: 1.0 }]));

  // Signpost: two blank arrow boards, one toward the hill and one toward the workshop.
  const sign = groundMatrix(terrain, latLonToDir(4, 4), 0);
  b.place(box(0.02), C.woodDark, v(0, 0.75, 0), [0, 0, 0], [0.1, 1.5, 0.1], sign);
  b.place(box(0.02), C.woodLight, v(0.25, 1.32, 0), [0, 0.15, 0], [0.6, 0.18, 0.05], sign);
  b.place(cone(3), C.woodLight, v(0.6, 1.32, -0.05), [0, 0.15, -Math.PI / 2], [0.13, 0.12, 0.05], sign);
  b.place(box(0.02), C.woodLight, v(-0.15, 1.05, 0), [0, -0.9, 0], [0.55, 0.16, 0.05], sign);
  colliders.push(createColliderGroup(sign, [{ kind: "circle", x: 0, z: 0, radius: 0.12, height: 1.6 }]));

  // Drifts of flowers across the meadow, each one color.
  const random = createRandom(5);
  const drifts: [number, number, string, number][] = [
    [-30, -12, "#F2C14E", 18],
    [-21, -2, "#F4ECDD", 14],
    [-31, 8, "#E58B6B", 16],
    [-15, 18, "#B9A5D8", 14],
    [-26, 22, "#F2C14E", 12],
    [-12, 6, "#E36F5A", 10],
  ];
  for (const [lat, lon, color, count] of drifts) flowerDrift(b, terrain, latLonToDir(lat, lon), random, color, Math.round(count * (0.45 + 0.55 * density)), 1.2);
  return colliders;
}
