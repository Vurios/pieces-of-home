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
const FLOWERS = ["#E58B6B", "#F2C14E", "#F4ECDD", "#B9A5D8", "#E36F5A"];

function randomDir(random: () => number): Vector3 {
  const z = random() * 2 - 1;
  const t = random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(t), z, r * Math.sin(t));
}

export function scatterNature(b: Batcher, terrain: Terrain, density: number): ColliderGroup[] {
  const random = createRandom(2026);
  const colliders: ColliderGroup[] = [];

  const tree = (m: Matrix4, kind: number): void => {
    const s = 0.85 + random() * 0.4;
    if (kind === 2) {
      // Pine.
      b.place(cylinder(7), C.woodDark, v(0, 0.35 * s, 0), [0, 0, 0], [0.1 * s, 0.7 * s, 0.1 * s], m);
      for (let i = 0; i < 3; i += 1) {
        b.place(cone(9), i % 2 ? "#4F6F5A" : "#5C7D62", v(0, (0.85 + i * 0.5) * s, 0), [0, i, 0], [(0.75 - i * 0.18) * s, 0.8 * s, (0.75 - i * 0.18) * s], m);
      }
    } else {
      const palette = kind === 1 ? AUTUMN : LEAVES;
      b.place(cylinder(7, 0.7), C.woodDark, v(0, 0.6 * s, 0), [0, 0, 0.05], [0.13 * s, 1.2 * s, 0.13 * s], m);
      b.place(cylinder(5, 0.5), C.woodDark, v(0.18 * s, 1.05 * s, 0), [0, 0, -0.7], [0.05 * s, 0.4 * s, 0.05 * s], m);
      const blobs = 3 + Math.floor(random() * 2);
      for (let i = 0; i < blobs; i += 1) {
        const a = (i / blobs) * Math.PI * 2 + random();
        const r = i === 0 ? 0 : 0.32 * s;
        b.place(sphere("mid"), palette[Math.floor(random() * palette.length)]!, v(Math.cos(a) * r, (1.55 + (i === 0 ? 0.25 : random() * 0.2)) * s, Math.sin(a) * r), [0, 0, 0], (i === 0 ? 0.62 : 0.45) * s, m);
      }
    }
  };

  // Trees.
  const treeCount = Math.round(36 * density + 16);
  for (let n = 0, tries = 0; n < treeCount && tries < 2000; tries += 1) {
    const dir = randomDir(random);
    if (!isClear(dir, 0.9)) continue;
    const kind = random() < 0.35 ? 2 : random() < 0.25 ? 1 : 0;
    const m = groundMatrix(terrain, dir, random() * 360);
    tree(m, kind);
    colliders.push(createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: 0.22, height: 3 }]));
    n += 1;
  }

  // Bushes and rocks, with colliders for the big ones.
  for (let n = 0, tries = 0; n < 40 * density + 10 && tries < 2000; tries += 1) {
    const dir = randomDir(random);
    if (!isClear(dir, 0.4)) continue;
    const m = groundMatrix(terrain, dir, random() * 360);
    if (random() < 0.6) {
      const parts = 2 + Math.floor(random() * 2);
      for (let i = 0; i < parts; i += 1) {
        b.place(sphere("low"), LEAVES[Math.floor(random() * LEAVES.length)]!, v((random() - 0.5) * 0.5, 0.18, (random() - 0.5) * 0.5), [0, 0, 0], 0.25 + random() * 0.15, m);
      }
      // A few berries.
      if (random() < 0.4) for (let i = 0; i < 4; i += 1) b.place(sphere("low"), C.clay, v((random() - 0.5) * 0.5, 0.3 + random() * 0.1, (random() - 0.5) * 0.5), [0, 0, 0], 0.035, m);
    } else {
      const big = random() < 0.3;
      const size = big ? 0.45 + random() * 0.3 : 0.15 + random() * 0.15;
      b.place(sphere("low"), random() < 0.5 ? C.stone : C.stoneLight, v(0, size * 0.35, 0), [random(), random(), random()], [size, size * 0.7, size * 0.9], m);
      if (big) colliders.push(createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: size * 0.85, height: size * 0.9 }]));
    }
    n += 1;
  }

  // Grass tufts and flower clusters: no colliders.
  for (let n = 0, tries = 0; n < 180 * density + 40 && tries < 4000; tries += 1) {
    const dir = randomDir(random);
    if (pathDistance(dir) < PATH_HALF_WIDTH + 0.15) continue;
    let blocked = false;
    for (const zone of KEEP_OUT.slice(0, 4)) if (angleBetween(dir, zone.dir) * HOME_RADIUS < zone.radius - 1.6) blocked = true;
    if (blocked) continue;
    const m = groundMatrix(terrain, dir, random() * 360, 0.02);
    if (random() < 0.7) {
      for (let i = 0; i < 3; i += 1) {
        b.place(cone(4), i === 1 ? "#A3BD8C" : "#8DAE7C", v((i - 1) * 0.06, 0.09, (random() - 0.5) * 0.06), [(i - 1) * 0.35, 0, (random() - 0.5) * 0.3], [0.05, 0.2 + random() * 0.1, 0.05], m);
      }
    } else {
      const color = FLOWERS[Math.floor(random() * FLOWERS.length)]!;
      for (let i = 0; i < 3; i += 1) {
        const x = (random() - 0.5) * 0.4;
        const z = (random() - 0.5) * 0.4;
        const h = 0.16 + random() * 0.12;
        b.place(cylinder(4), "#5E8466", v(x, h / 2, z), [0, 0, 0], [0.012, h, 0.012], m);
        b.place(sphere("low"), color, v(x, h, z), [0, 0, 0], 0.045, m);
        b.place(sphere("low"), C.amber, v(x, h + 0.02, z), [0, 0, 0], 0.016, m);
      }
    }
    n += 1;
  }

  // Stones along the path edges.
  for (const [a, bDir] of PATHS) {
    const steps = Math.max(2, Math.round((angleBetween(a, bDir) * HOME_RADIUS) / 1.4));
    for (let i = 1; i < steps; i += 1) {
      if (random() < 0.35) continue;
      const t = i / steps;
      const mid = a.clone().lerp(bDir, t).normalize();
      const side = new Vector3().crossVectors(a, bDir).normalize().multiplyScalar(((random() < 0.5 ? -1 : 1) * (PATH_HALF_WIDTH + 0.12)) / HOME_RADIUS);
      const dir = mid.add(side).normalize();
      const m = groundMatrix(terrain, dir, random() * 360, 0.03);
      b.place(sphere("low"), random() < 0.5 ? C.stoneLight : "#B8AE9E", v(0, 0.03, 0), [0, random() * 3, 0], [0.13, 0.06, 0.1], m);
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
    b.place(cylinder(4), "#6E9470", v(Math.cos(a) * r, 0.25, Math.sin(a) * r), [random() * 0.2, 0, random() * 0.2], [0.02, 0.6 + random() * 0.3, 0.02], m);
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
export function buildMeadow(b: Batcher, terrain: Terrain): ColliderGroup[] {
  const colliders: ColliderGroup[] = [];

  // The swing oak.
  const oak = groundMatrix(terrain, latLonToDir(-27, -4), 70);
  b.place(cylinder(9, 0.65), C.woodDark, v(0, 1.0, 0), [0, 0, 0.04], [0.26, 2.0, 0.26], oak);
  b.place(cylinder(7, 0.5), C.woodDark, v(0.55, 1.95, 0), [0, 0, -1.25], [0.11, 1.4, 0.11], oak);
  for (const [x, y, z, r, c] of [
    [0, 2.7, 0, 1.05, "#6E9470"],
    [0.85, 2.45, 0.3, 0.75, "#7FA37A"],
    [-0.7, 2.4, -0.2, 0.8, "#5E8466"],
    [0.2, 3.25, -0.3, 0.7, "#88A979"],
    [1.3, 2.2, -0.2, 0.55, "#6E9470"],
  ] as const) {
    b.place(sphere("mid"), c, v(x, y, z), [0, 0, 0], r, oak);
  }
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

  // A drift of flowers across the meadow.
  const random = createRandom(5);
  for (let n = 0; n < 70; n += 1) {
    const dir = latLonToDir(-32 + random() * 22, -14 + random() * 40);
    if (pathDistance(dir) < PATH_HALF_WIDTH + 0.2) continue;
    const m = groundMatrix(terrain, dir, random() * 360, 0.02);
    const color = FLOWERS[Math.floor(random() * FLOWERS.length)]!;
    const h = 0.14 + random() * 0.1;
    b.place(cylinder(4), "#5E8466", v(0, h / 2, 0), [0, 0, 0], [0.012, h, 0.012], m);
    b.place(sphere("low"), color, v(0, h, 0), [0, 0, 0], 0.05, m);
  }
  return colliders;
}
