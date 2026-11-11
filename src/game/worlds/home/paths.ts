import { BufferAttribute, BufferGeometry, Color, Mesh, Vector3 } from "three";
import { cylinder, sphere } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import { createRandom, fbm3 } from "../../world/noise";
import type { Terrain } from "../../world/terrain";
import { C } from "./buildings";
import { HOME_RADIUS, TRAIL_SPECS, type TrailSpec, sampleTrail, trailLength } from "./layout";
import { groundMatrix } from "./nature";

/**
 * The footpaths, drawn as their own soft ribbons laid over the grass.
 *
 * Painting paths into the planet's vertex colors gives them the planet mesh's
 * stair-step edge. A ribbon follows the true curve instead: a pale, trodden
 * middle, a slightly darker rim that sinks into the grass, an edge that
 * wanders a little in width, and round ends where a trail meets a door, a
 * place or another trail. The porch walk is flat stepping stones.
 */
const CENTER = new Color("#D4BD96");
const MIDDLE = new Color("#D0B890");
const RIM = new Color("#C6AC84");
const DAMP = new Color("#C4AB85");
const tmp = new Color();
/** The track lies nearly flat: just enough lift to clear the grass, never a raised slab. */
const UP_LIFT = 0.014;

/** Across the track: offset as a share of the half width, height above the grass, color. */
const PROFILE: [number, number, Color][] = [
  [-1.0, 0.006, RIM],
  [-0.9, 0.012, MIDDLE],
  [-0.3, UP_LIFT, CENTER],
  [0.3, UP_LIFT, CENTER],
  [0.9, 0.012, MIDDLE],
  [1.0, 0.006, RIM],
];

interface Builder {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

function push(g: Builder, terrain: Terrain, dir: Vector3, lift: number, color: Color): number {
  const r = terrain.radiusAt(dir) + lift;
  g.positions.push(dir.x * r, dir.y * r, dir.z * r);
  // The ribbon is shaded like the ground under it.
  const n = terrain.normalAt(dir, scratchNormal);
  g.normals.push(n.x, n.y, n.z);
  g.colors.push(color.r, color.g, color.b);
  return g.positions.length / 3 - 1;
}
const scratchNormal = new Vector3();

/** Mottles a color a little with noise, so the track looks trodden and not printed. */
function mottle(base: Color, dir: Vector3, amount: number): Color {
  const n = fbm3(dir.x * 31, dir.y * 31, dir.z * 31, 2, 17);
  return tmp.copy(base).lerp(n > 0 ? CENTER : DAMP, Math.min(1, Math.abs(n) * amount));
}

function ribbon(g: Builder, terrain: Terrain, spec: TrailSpec): void {
  // Crossing trails lie at one height with one color, so a junction reads as one patch of ground.
  const points = sampleTrail(spec, 0.28);
  const rows: number[][] = [];
  const side = new Vector3();
  const along = new Vector3();
  const off = new Vector3();
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    along.subVectors(next, prev);
    along.addScaledVector(p, -along.dot(p)).normalize();
    side.crossVectors(p, along).normalize();
    // The edges wander a little, each side on its own, like a path worn by feet.
    const wobbleL = 1 + 0.1 * fbm3(p.x * 9, p.y * 9, p.z * 9, 2, 3);
    const wobbleR = 1 + 0.1 * fbm3(p.x * 9 + 5, p.y * 9, p.z * 9, 2, 3);
    const row: number[] = [];
    for (const [share, lift, color] of PROFILE) {
      const w = spec.halfWidth * share * (share < 0 ? wobbleL : wobbleR);
      off.copy(p).addScaledVector(side, w / HOME_RADIUS).normalize();
      const c = Math.abs(share) < 0.95 ? mottle(color, off, 0.35) : color;
      row.push(push(g, terrain, off, lift, c));
    }
    rows.push(row);
  }
  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    for (let k = 0; k < PROFILE.length - 1; k += 1) g.indices.push(a[k]!, a[k + 1]!, b[k]!, a[k + 1]!, b[k + 1]!, b[k]!);
  }
}

/** A round patch: a junction where trails meet, or the rounded end of a trail. */
function cap(g: Builder, terrain: Terrain, center: Vector3, radius: number, lift: number): void {
  const segments = 32;
  const east = new Vector3(0, 1, 0).cross(center);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = new Vector3().crossVectors(center, east).normalize();
  const middle = push(g, terrain, center, lift, mottle(CENTER, center, 0.6));
  const inner: number[] = [];
  const outer: number[] = [];
  const at = new Vector3();
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const wobble = 1 + 0.025 * Math.sin(a * 3 + center.x * 40);
    for (const [share, list, color, h] of [
      [0.9, inner, MIDDLE, 0.012],
      [1.0, outer, RIM, 0.006],
    ] as const) {
      const r = (radius * share * wobble) / HOME_RADIUS;
      at.copy(center).addScaledVector(east, Math.cos(a) * r).addScaledVector(north, Math.sin(a) * r).normalize();
      list.push(push(g, terrain, at, h, color));
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    g.indices.push(middle, inner[j]!, inner[i]!);
    g.indices.push(inner[i]!, inner[j]!, outer[i]!, inner[j]!, outer[j]!, outer[i]!);
  }
}

/** Flat stepping stones, set in pairs that sway from side to side. */
function steppingStones(b: Batcher, terrain: Terrain, spec: TrailSpec, random: () => number): void {
  const points = sampleTrail(spec, 0.5);
  const length = trailLength(spec);
  const count = Math.max(2, Math.round(length / 0.5));
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const p = points[Math.round(t * (points.length - 1))]!;
    const side = new Vector3().crossVectors(spec.a, spec.b).normalize();
    const dir = p.clone().addScaledVector(side, ((i % 2 ? 1 : -1) * 0.13) / HOME_RADIUS).normalize();
    const m = groundMatrix(terrain, dir, random() * 360, -0.01);
    const size = 0.2 + random() * 0.05;
    b.place(cylinder(7), random() < 0.5 ? C.stoneLight : "#BDB3A4", [0, 0.015, 0], [0, random() * 3, 0], [size, 0.05, size * 0.82], m);
  }
}

/** Pebbles scattered just off the edge of the dirt trails. */
function pebbles(b: Batcher, terrain: Terrain, spec: TrailSpec, random: () => number): void {
  const points = sampleTrail(spec, 0.7);
  for (let i = 1; i < points.length - 1; i += 1) {
    if (random() < 0.55) continue;
    const p = points[i]!;
    const along = points[i + 1]!.clone().sub(points[i - 1]!);
    const side = new Vector3().crossVectors(p, along).normalize();
    const dir = p.clone().addScaledVector(side, ((random() < 0.5 ? -1 : 1) * (spec.halfWidth + 0.08 + random() * 0.12)) / HOME_RADIUS).normalize();
    const m = groundMatrix(terrain, dir, random() * 360, 0.03);
    const s = 0.07 + random() * 0.06;
    b.place(sphere("low"), random() < 0.5 ? C.stoneLight : "#B8AE9E", [0, s * 0.3, 0], [0, random() * 3, 0], [s, s * 0.5, s * 0.8], m, "detail", 0);
  }
}

/** Where trail ends meet, keyed by position, so each junction gets one round patch. */
function junctions(specs: TrailSpec[]): { dir: Vector3; radius: number; count: number }[] {
  const ends: { dir: Vector3; radius: number; count: number }[] = [];
  for (const spec of specs) {
    if (spec.stones) continue;
    for (const end of [spec.a, spec.b]) {
      const found = ends.find((e) => e.dir.distanceTo(end) < 0.4 / HOME_RADIUS);
      if (found) {
        found.count += 1;
        found.radius = Math.max(found.radius, spec.halfWidth);
      } else ends.push({ dir: end.clone(), radius: spec.halfWidth, count: 1 });
    }
  }
  return ends;
}

export function buildPaths(b: Batcher, terrain: Terrain, toon: ToonLibrary): Mesh {
  const g: Builder = { positions: [], normals: [], colors: [], indices: [] };
  const random = createRandom(88);
  for (const spec of TRAIL_SPECS) {
    if (spec.stones) {
      steppingStones(b, terrain, spec, random);
      continue;
    }
    ribbon(g, terrain, spec);
    pebbles(b, terrain, spec, random);
  }
  // Junctions get a slightly wider round patch where the trails meet; a lone end gets a rounded tip.
  for (const end of junctions(TRAIL_SPECS)) cap(g, terrain, end.dir, end.radius * (end.count > 1 ? 1.2 : 1.0), UP_LIFT);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(g.positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(g.normals), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(g.colors), 3));
  geometry.setIndex(g.indices);
  fixWinding(geometry);
  geometry.computeBoundingSphere();
  const material = toon.toon({ vertexColors: true, paint: 0.12, rim: 0, nearFade: false });
  // Drawn just over the grass it sits on.
  material.polygonOffset = true;
  material.polygonOffsetFactor = -2;
  material.polygonOffsetUnits = -4;
  const mesh = new Mesh(geometry, material);
  mesh.name = "paths";
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** Turns every triangle to face away from the planet's center, whichever way it was built. */
function fixWinding(geometry: BufferGeometry): void {
  const index = geometry.getIndex()!;
  const pos = geometry.getAttribute("position");
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.dot(a) < 0) {
      const t = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, t);
    }
  }
  index.needsUpdate = true;
}
