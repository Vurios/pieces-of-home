import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { fbm3 } from "./noise";
import { smoothstep } from "./sphere";

/**
 * A little planet: a sphere with gentle noise, hills, craters and flat pads
 * for buildings. One function, `radiusAt`, is the single truth for both the
 * mesh and the ground under the player's feet.
 */

/** A flat building site. The ground becomes a true plane around `center`. */
export interface Pad {
  center: Vector3;
  /** Flat radius in world units. */
  radius: number;
  /** Width of the blend back into the round ground. */
  blend: number;
  /** Height of the pad above the base sphere. */
  lift?: number;
}

/** A smooth hill. `plateau` (0 to 1) keeps the top flat out to that share of the radius. */
export interface Bump {
  center: Vector3;
  radius: number;
  height: number;
  plateau?: number;
}

/** A bowl with a raised rim, stamped into the ground. */
export interface Crater {
  center: Vector3;
  radius: number;
  depth: number;
  rim?: number;
}

/**
 * A long winding valley cut into the ground, like Hadley Rille: a path of
 * unit directions, a width (rim to rim, world units) and a depth. The floor is
 * flat and the walls slope up to the rims.
 */
export interface Channel {
  path: Vector3[];
  width: number;
  depth: number;
}

export interface TerrainSpec {
  radius: number;
  seed: number;
  /** Height of the gentle rolling noise. */
  noiseAmplitude: number;
  /** How many noise waves fit around the planet. */
  noiseFrequency: number;
  pads?: Pad[];
  bumps?: Bump[];
  craters?: Crater[];
  channels?: Channel[];
}

/** One stretch of a channel, with a quick bounding cap so far points skip it. */
interface Stretch {
  a: Vector3;
  b: Vector3;
  n: Vector3;
  ab: number;
  mid: Vector3;
  /** Cosine of the cap round `mid` that holds the stretch and its walls. */
  reachCos: number;
  half: number;
  depth: number;
}

export class Terrain {
  readonly radius: number;
  private pads: Pad[];
  private bumps: Bump[];
  private craters: Crater[];
  private stretches: Stretch[] = [];

  constructor(readonly spec: TerrainSpec) {
    this.radius = spec.radius;
    this.pads = spec.pads ?? [];
    this.bumps = spec.bumps ?? [];
    this.craters = spec.craters ?? [];
    for (const channel of spec.channels ?? []) {
      for (let i = 0; i + 1 < channel.path.length; i += 1) {
        const a = channel.path[i]!.clone().normalize();
        const b = channel.path[i + 1]!.clone().normalize();
        const ab = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
        const half = channel.width / 2 / spec.radius;
        this.stretches.push({
          a,
          b,
          n: new Vector3().crossVectors(a, b).normalize(),
          ab,
          mid: a.clone().add(b).normalize(),
          reachCos: Math.cos(ab / 2 + half * 1.3),
          half,
          depth: channel.depth,
        });
      }
    }
  }

  /** How far `dir` is from the nearest channel, in channel half-widths (0 on the center line), and that channel's depth. */
  channelAt(dir: Vector3): { t: number; depth: number } {
    let best = Infinity;
    let depth = 0;
    for (const s of this.stretches) {
      if (dir.dot(s.mid) < s.reachCos) continue;
      // The closest point on the great circle through a and b, if it falls between them.
      const off = dir.dot(s.n);
      closest.copy(dir).addScaledVector(s.n, -off);
      let angle: number;
      if (closest.lengthSq() > 1e-12) {
        closest.normalize();
        const ac = Math.acos(Math.max(-1, Math.min(1, s.a.dot(closest))));
        const cb = Math.acos(Math.max(-1, Math.min(1, closest.dot(s.b))));
        angle = Math.abs(ac + cb - s.ab) < 1e-4 ? Math.asin(Math.min(1, Math.abs(off))) : Math.min(Math.acos(Math.min(1, dir.dot(s.a))), Math.acos(Math.min(1, dir.dot(s.b))));
      } else angle = Math.PI;
      const t = angle / s.half;
      if (t < best) {
        best = t;
        depth = s.depth;
      }
    }
    return { t: best, depth };
  }

  /** Distance from the planet center to the ground along the unit direction `dir`. */
  radiusAt(dir: Vector3): number {
    const { radius, seed, noiseAmplitude, noiseFrequency } = this.spec;
    let r =
      radius +
      fbm3(dir.x * noiseFrequency, dir.y * noiseFrequency, dir.z * noiseFrequency, 3, seed) * noiseAmplitude;

    for (const bump of this.bumps) {
      const distance = Math.acos(Math.max(-1, Math.min(1, dir.dot(bump.center)))) * radius;
      if (distance >= bump.radius) continue;
      const t = distance / bump.radius;
      r += bump.height * (1 - smoothstep(bump.plateau ?? 0, 1, t));
    }

    for (const crater of this.craters) {
      const distance = Math.acos(Math.max(-1, Math.min(1, dir.dot(crater.center)))) * radius;
      const reach = crater.radius * 1.5;
      if (distance >= reach) continue;
      const t = distance / crater.radius;
      if (t < 1) {
        // Bowl: deepest in the middle, climbing to the rim.
        r -= crater.depth * (1 - t * t);
      }
      const rim = crater.rim ?? crater.depth * 0.35;
      const rimShape = Math.exp(-((t - 1) * (t - 1)) / 0.045);
      r += rim * rimShape;
    }

    if (this.stretches.length) {
      const { t, depth } = this.channelAt(dir);
      // A flat floor, steep walls, and a soft lip at the rim.
      if (t < 1.25) r -= depth * (1 - smoothstep(0.38, 1.0, t)) - depth * 0.05 * Math.exp(-((t - 1.08) * (t - 1.08)) / 0.01);
    }

    for (const pad of this.pads) {
      const cos = dir.dot(pad.center);
      if (cos <= 0.2) continue;
      const distance = Math.acos(Math.min(1, cos)) * radius;
      const reach = pad.radius + pad.blend;
      if (distance >= reach) continue;
      // The tangent plane at the pad center, seen along `dir`.
      const planeRadius = (radius + (pad.lift ?? 0)) / cos;
      const weight = 1 - smoothstep(pad.radius, reach, distance);
      r = r + (planeRadius - r) * weight;
    }
    return r;
  }

  /** Ground normal from nearby samples. Good enough for shading and placing props. */
  normalAt(dir: Vector3, out = new Vector3()): Vector3 {
    const step = 0.012;
    const east = scratchEast.crossVectors(AXIS_Y, dir);
    if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
    east.normalize();
    const north = scratchNorth.crossVectors(dir, east).normalize();

    const pe = sampleA.copy(dir).addScaledVector(east, step).normalize();
    const pw = sampleB.copy(dir).addScaledVector(east, -step).normalize();
    const pn = sampleC.copy(dir).addScaledVector(north, step).normalize();
    const ps = sampleD.copy(dir).addScaledVector(north, -step).normalize();
    pe.multiplyScalar(this.radiusAt(pe));
    pw.multiplyScalar(this.radiusAt(pw));
    pn.multiplyScalar(this.radiusAt(pn));
    ps.multiplyScalar(this.radiusAt(ps));

    out.crossVectors(pn.sub(ps), pe.sub(pw));
    if (out.dot(dir) < 0) out.negate();
    return out.normalize();
  }

  /** The ground point along `dir`. */
  pointAt(dir: Vector3, out = new Vector3()): Vector3 {
    return out.copy(dir).multiplyScalar(this.radiusAt(dir));
  }
}

const AXIS_Y = new Vector3(0, 1, 0);
const closest = new Vector3();
const scratchEast = new Vector3();
const scratchNorth = new Vector3();
const sampleA = new Vector3();
const sampleB = new Vector3();
const sampleC = new Vector3();
const sampleD = new Vector3();

export type TerrainColor = (dir: Vector3, radius: number, normal: Vector3, out: Color) => void;

/**
 * Builds the planet mesh as a cube pushed out into a sphere. Compared with an
 * icosphere this gives an indexed mesh with even faces and far fewer vertices.
 * `detail` is the number of quads along each cube edge.
 */
export function buildPlanetGeometry(terrain: Terrain, detail: number, colorAt: TerrainColor): BufferGeometry {
  const n = Math.max(4, Math.floor(detail));
  const perFace = (n + 1) * (n + 1);
  const positions = new Float32Array(perFace * 6 * 3);
  const normals = new Float32Array(perFace * 6 * 3);
  const colors = new Float32Array(perFace * 6 * 3);
  const indices: number[] = [];

  const dir = new Vector3();
  const normal = new Vector3();
  const color = new Color();
  // Each face: a fixed axis and two axes that sweep the face.
  const faces: [Vector3, Vector3, Vector3][] = [
    [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, -1)],
    [new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)],
    [new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0)],
    [new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0)],
    [new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(1, 0, 0)],
    [new Vector3(0, 0, -1), new Vector3(0, 1, 0), new Vector3(-1, 0, 0)],
  ];

  let vertex = 0;
  faces.forEach(([axis, up, right], faceIndex) => {
    for (let j = 0; j <= n; j += 1) {
      for (let i = 0; i <= n; i += 1) {
        // The tangent warp evens out quad sizes across the face.
        const a = Math.tan(((i / n) * 2 - 1) * (Math.PI / 4));
        const b = Math.tan(((j / n) * 2 - 1) * (Math.PI / 4));
        dir.copy(axis).addScaledVector(right, a).addScaledVector(up, b).normalize();
        const r = terrain.radiusAt(dir);
        terrain.normalAt(dir, normal);
        colorAt(dir, r, normal, color);
        const o = vertex * 3;
        positions[o] = dir.x * r;
        positions[o + 1] = dir.y * r;
        positions[o + 2] = dir.z * r;
        normals[o] = normal.x;
        normals[o + 1] = normal.y;
        normals[o + 2] = normal.z;
        colors[o] = color.r;
        colors[o + 1] = color.g;
        colors[o + 2] = color.b;
        vertex += 1;
      }
    }
    const base = faceIndex * perFace;
    // Wind every triangle so it faces away from the planet center.
    const outward = new Vector3().crossVectors(right, up).dot(axis) > 0;
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const a = base + j * (n + 1) + i;
        const b = a + 1;
        const c = a + (n + 1);
        const d = c + 1;
        if (outward) indices.push(a, b, d, a, d, c);
        else indices.push(a, d, b, a, c, d);
      }
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
