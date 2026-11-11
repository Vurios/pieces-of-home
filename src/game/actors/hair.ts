import { BufferAttribute, BufferGeometry, Euler, Matrix4, Vector3 } from "three";

/**
 * Sculpted hair as one smooth shell, the way stylized game characters are
 * modelled: a surface a little bigger than the head that follows a hairline,
 * splits into locks with soft grooves between them, and ends in pointed or
 * rounded tips. A thin inner surface gives the edge real thickness, so the
 * hair never looks like a painted helmet, and there are no seams or bumps
 * where separate pieces would overlap.
 *
 * The surface is built on angles round the head: `theta` runs round the head
 * (0 is the face, plus or minus pi the back of the head) and `phi` runs down
 * from the crown (0) toward the neck.
 *
 * Each vertex carries `aShade`: above 0 it is painted lighter (the band where
 * light catches the crown), below 0 darker (the underside). See
 * `Batcher` in src/game/render/kit.ts.
 */
export interface HairStyle {
  /** Centre and radii of the shell, in the head joint's space. */
  center: [number, number, number];
  radius: [number, number, number];
  /** Number of locks round the head. */
  locks: number;
  /** How far down the hair reaches, in radians from the crown, by `theta` (-pi to pi, 0 is the face). */
  reach: (theta: number) => number;
  /** Extra length at the middle of each lock, in radians. */
  tipDepth: number;
  /** Tip length multiplier by `theta`, so bangs can be blunt while the back is pointed. */
  tipShape?: (theta: number) => number;
  /** 1 is a soft round tip; higher is pointier. */
  tipSharp: number;
  /** How deep the grooves between locks are, as a fraction of the radius. */
  groove: number;
  /** Twists the locks toward one side near their tips (radians), strongest at the front: a swept fringe. */
  sweep: number;
  /** Lock ends lift away from the head by this fraction. */
  flare: number;
  /** Thickness of the edge, as a fraction of the radius. */
  thickness: number;
  /** Random variety in lock length, 0 to 1. */
  messy: number;
  /** Curly hair: bumps all over, as a fraction of the radius. */
  curls?: number;
  /** Below the ears, hang straight down instead of wrapping under (long hair, bobs). */
  drape?: boolean;
  /** Tilts the crown (where the locks start), radians round X then Z. */
  tilt?: [number, number];
  /** Strength of the light band on the crown. */
  sheen?: number;
  seed: number;
  /** Detail: columns per lock and rows from crown to tip. */
  columnsPerLock?: number;
  rows?: number;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A tiny seeded random generator, so each kid's hair is the same every time. */
function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Wraps an angle to -pi..pi. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function hairShell(style: HairStyle): BufferGeometry {
  const locks = style.locks;
  const columns = locks * (style.columnsPerLock ?? 6);
  const rows = style.rows ?? 20;
  const innerRows = 6;
  const rand = random(style.seed);
  const lockLength = Array.from({ length: locks }, () => 1 + style.messy * (rand() * 2 - 1));
  const lockOffset = Array.from({ length: locks }, () => (rand() * 2 - 1) * 0.12 * style.messy);
  const [cx, cy, cz] = style.center;
  const [rx, ry, rz] = style.radius;
  const tilt = new Matrix4().makeRotationFromEuler(new Euler(style.tilt?.[0] ?? 0, 0, style.tilt?.[1] ?? 0, "XZY"));
  const center = new Vector3(cx, cy, cz);

  const positions: number[] = [];
  const shades: number[] = [];
  const p = new Vector3();

  /** One point of the shell. `inset` pulls it toward the head for the inner surface. */
  const point = (theta: number, phi: number, scale: number): Vector3 => {
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    if (style.drape && phi > Math.PI / 2) {
      // Fall straight down from the widest ring, like a curtain.
      p.set(rx * s * scale, -(phi - Math.PI / 2) * ry * 0.95, rz * c * scale);
    } else {
      p.set(rx * Math.sin(phi) * s * scale, ry * Math.cos(phi) * scale, rz * Math.sin(phi) * c * scale);
    }
    return p.applyMatrix4(tilt).add(center);
  };

  /** Everything about one column at one height: angle, how far down, how far out, and paint. */
  const sample = (i: number, t: number): { theta: number; phi: number; scale: number; shade: number; bump: number } => {
    const theta = (i / columns) * Math.PI * 2;
    const signed = wrap(theta);
    const front = Math.cos(signed / 2) ** 2;
    const twisted = theta + style.sweep * t * t * front;
    const u = (twisted / (Math.PI * 2)) * locks;
    const k = ((Math.floor(u) % locks) + locks) % locks;
    const f = u - Math.floor(u) + lockOffset[k]!;
    const bump = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, f)))) ** 0.8;
    const tipScale = style.tipShape ? style.tipShape(signed) : 1;
    const reach = style.reach(signed);
    const phiMax = reach + style.tipDepth * tipScale * bump ** style.tipSharp * lockLength[k]!;
    const phi = t * phiMax;
    let scale = 1 + style.groove * (bump - 0.65) * smooth(0.18, 0.7, t) + style.flare * smooth(0.6, 1, t) * (0.6 + 0.4 * bump);
    if (style.curls) {
      // Two lattices of soft bumps, turned against each other, read as curls.
      const sx = Math.sin(phi) * Math.sin(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.cos(theta);
      const a = Math.sin(15 * sx + 1.3) * Math.sin(15 * sy + 0.7) * Math.sin(15 * sz + 2.1);
      const b = Math.sin(11 * sy + 0.4) * Math.sin(11 * sz + 1.9) * Math.sin(11 * sx + 0.2);
      scale += style.curls * (Math.abs(a) * 0.6 + Math.abs(b) * 0.4) * smooth(0.05, 0.3, t);
    }
    // Paint: a band of light across the upper crown, brighter on lock crests and toward
    // the face; tips a touch darker.
    const band = Math.exp(-(((phi - 0.62) / 0.2) ** 2));
    const shade = (style.sheen ?? 0.16) * band * (0.35 + 0.65 * bump) * (0.55 + 0.45 * Math.cos(signed)) - 0.1 * smooth(0.82, 1, t);
    return { theta, phi, scale, shade, bump };
  };

  // Outer surface, rows from the crown to the tips.
  for (let j = 0; j <= rows; j += 1) {
    const t = j / rows;
    for (let i = 0; i < columns; i += 1) {
      const s = sample(i, t);
      point(s.theta, s.phi, s.scale);
      positions.push(p.x, p.y, p.z);
      shades.push(s.shade);
    }
  }
  // Inner surface, from the tips back up a little way: the underside you see under a fringe.
  const innerStart = positions.length / 3;
  for (let j = 0; j <= innerRows; j += 1) {
    const t = 1 - (j / innerRows) * 0.45;
    for (let i = 0; i < columns; i += 1) {
      const s = sample(i, t);
      point(s.theta, s.phi * (1 - 0.02 * (1 - j / innerRows)), s.scale * (1 - style.thickness));
      positions.push(p.x, p.y, p.z);
      shades.push(-0.45);
    }
  }

  const index: number[] = [];
  // The crown is one shared point, so its shading has no pinch.
  const at = (row: number, col: number, base = 0): number => (base === 0 && row === 0 ? 0 : base + row * columns + (((col % columns) + columns) % columns));
  const v = (n: number): Vector3 => new Vector3(positions[n * 3]!, positions[n * 3 + 1]!, positions[n * 3 + 2]!);
  const ab = new Vector3();
  const ac = new Vector3();
  /** Adds a triangle, turned so its front faces along `want`. */
  const tri = (a: number, b: number, c: number, want: (centroid: Vector3) => Vector3): void => {
    const pa = v(a);
    const pb = v(b);
    const pc = v(c);
    ab.subVectors(pb, pa);
    ac.subVectors(pc, pa);
    const n = ab.cross(ac);
    if (n.lengthSq() < 1e-14) return;
    const centroid = pa.add(pb).add(pc).multiplyScalar(1 / 3);
    if (n.dot(want(centroid)) >= 0) index.push(a, b, c);
    else index.push(a, c, b);
  };
  const outward = (centroid: Vector3): Vector3 => centroid.clone().sub(center);
  const inward = (centroid: Vector3): Vector3 => center.clone().sub(centroid);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      tri(at(j, i), at(j + 1, i), at(j + 1, i + 1), outward);
      tri(at(j, i), at(j + 1, i + 1), at(j, i + 1), outward);
    }
  }
  for (let j = 0; j < innerRows; j += 1) {
    for (let i = 0; i < columns; i += 1) {
      tri(at(j, i, innerStart), at(j + 1, i, innerStart), at(j + 1, i + 1, innerStart), inward);
      tri(at(j, i, innerStart), at(j + 1, i + 1, innerStart), at(j, i + 1, innerStart), inward);
    }
  }
  // The rim joins the tips of the outer surface to the inner one. Its face looks
  // the way the hair grows at that column.
  for (let i = 0; i < columns; i += 1) {
    const grow = v(at(rows, i)).sub(v(at(rows - 1, i)));
    const along = (): Vector3 => grow;
    tri(at(rows, i), at(0, i, innerStart), at(0, i + 1, innerStart), along);
    tri(at(rows, i), at(0, i + 1, innerStart), at(rows, i + 1), along);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aShade", new BufferAttribute(new Float32Array(shades), 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
