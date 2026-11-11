import { Vector3 } from "three";

/**
 * Light and mirrors, with the real math. Used by Chapter 1's laser activity
 * and tested in tests/unit/optics.test.ts.
 *
 * A mirror reflects a ray across its normal: r = d - 2 (d . n) n.
 * Three mirrors at right angles (the inside corner of a box) each flip one
 * part of the direction, so after all three the ray goes straight back:
 * r = -d, whatever the angle it came in at. That is a retroreflector.
 */
export interface Mirror {
  /** Center of the square panel. */
  center: Vector3;
  /** The shiny side faces this way. */
  normal: Vector3;
  /** Two directions across the panel, at right angles to the normal. */
  u: Vector3;
  v: Vector3;
  /** Half the panel's width. */
  half: number;
}

export interface TraceResult {
  /** Where the ray started, every bounce, and a point far along its last direction. */
  points: Vector3[];
  /** The direction the light leaves in. */
  out: Vector3;
  /** How many mirrors it touched. */
  bounces: number;
}

/** Reflects direction `d` across a mirror with unit normal `n`. */
export function reflect(d: Vector3, n: Vector3, out = new Vector3()): Vector3 {
  return out.copy(d).addScaledVector(n, -2 * d.dot(n));
}

const hit = new Vector3();
const offset = new Vector3();

/**
 * Follows a ray through a set of square mirrors. Only the shiny side
 * reflects; light that reaches the back of a panel stops there.
 */
export function trace(origin: Vector3, direction: Vector3, mirrors: readonly Mirror[], tail = 60, maxBounces = 8): TraceResult {
  const points = [origin.clone()];
  const at = origin.clone();
  const d = direction.clone().normalize();
  let bounces = 0;
  let last: Mirror | null = null;
  for (let step = 0; step < maxBounces; step += 1) {
    let best: Mirror | null = null;
    let bestT = Infinity;
    for (const m of mirrors) {
      if (m === last) continue;
      const denom = d.dot(m.normal);
      if (Math.abs(denom) < 1e-9) continue;
      const t = offset.copy(m.center).sub(at).dot(m.normal) / denom;
      if (t <= 1e-6 || t >= bestT) continue;
      hit.copy(at).addScaledVector(d, t).sub(m.center);
      if (Math.abs(hit.dot(m.u)) > m.half || Math.abs(hit.dot(m.v)) > m.half) continue;
      best = m;
      bestT = t;
    }
    if (!best) break;
    at.addScaledVector(d, bestT);
    points.push(at.clone());
    if (d.dot(best.normal) > 0) {
      // The back of the panel: the light stops.
      return { points, out: d, bounces };
    }
    reflect(d, best.normal, d).normalize();
    bounces += 1;
    last = best;
  }
  points.push(at.clone().addScaledVector(d, tail));
  return { points, out: d, bounces };
}

/** The angle between two directions, in radians. */
export function angleOff(a: Vector3, b: Vector3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.dot(b) / (a.length() * b.length()))));
}

/**
 * The three inside faces of a box corner. `corner` is where they meet, `axes`
 * are the three edge directions (at right angles) and `size` is the edge
 * length. Each face's shiny side looks into the box.
 */
export function cornerMirrors(corner: Vector3, axes: readonly [Vector3, Vector3, Vector3], size: number, count = 3): Mirror[] {
  const faces: Mirror[] = [];
  for (let i = 0; i < Math.min(3, count); i += 1) {
    const normal = axes[i]!.clone();
    const u = axes[(i + 1) % 3]!.clone();
    const v = axes[(i + 2) % 3]!.clone();
    const center = corner.clone().addScaledVector(u, size / 2).addScaledVector(v, size / 2);
    faces.push({ center, normal, u, v, half: size / 2 });
  }
  return faces;
}

/**
 * Three edge directions at right angles whose diagonal points along `axis`.
 * `twist` turns them round the diagonal; `reference` picks where twist 0 is.
 */
export function cornerAxes(axis: Vector3, reference: Vector3, twist = 0): [Vector3, Vector3, Vector3] {
  const w = axis.clone().normalize();
  const p = reference.clone().addScaledVector(w, -reference.dot(w));
  if (p.lengthSq() < 1e-8) p.set(1, 0, 0).addScaledVector(w, -w.x);
  p.normalize();
  const q = new Vector3().crossVectors(w, p).normalize();
  const along = 1 / Math.sqrt(3);
  const across = Math.sqrt(2 / 3);
  const axes = [0, 1, 2].map((i) => {
    const a = twist + (i * Math.PI * 2) / 3;
    return w.clone().multiplyScalar(along).addScaledVector(p, across * Math.cos(a)).addScaledVector(q, across * Math.sin(a));
  });
  return [axes[0]!, axes[1]!, axes[2]!];
}
