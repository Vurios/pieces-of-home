import { BufferGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2, Vector3 } from "three";

/**
 * Extra shapes for buildings and gadgets. Each is made once per size and
 * shared through the batcher.
 */
const cache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = make();
    cache.set(key, geometry);
  }
  return geometry;
}

/**
 * A gable: a triangle `width` wide and `height` tall, `depth` deep along Z,
 * with its base on y = 0 and centered on x and z.
 */
export function gable(width: number, height: number, depth: number): BufferGeometry {
  return cached(`gable-${width}-${height}-${depth}`, () => {
    const shape = new Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  });
}

/** A shallow dish, opening toward +Y. */
export function dish(radius: number, depth: number, thickness: number): BufferGeometry {
  return cached(`dish-${radius}-${depth}-${thickness}`, () => {
    const points: Vector2[] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i += 1) {
      const r = (i / steps) * radius;
      points.push(new Vector2(r, (r * r * depth) / (radius * radius)));
    }
    for (let i = steps; i >= 0; i -= 1) {
      const r = (i / steps) * radius;
      points.push(new Vector2(r, (r * r * depth) / (radius * radius) - thickness));
    }
    return new LatheGeometry(points, 28);
  });
}

/** A plank floor: a thin slab, used where we want visible boards. */
export function disposeShapes(): void {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
}

/**
 * Angular distance (radians) from unit direction `p` to the great-circle arc
 * from `a` to `b`.
 */
export function distanceToArc(p: Vector3, a: Vector3, b: Vector3): number {
  const n = scratchN.crossVectors(a, b);
  if (n.lengthSq() < 1e-12) return Math.acos(Math.max(-1, Math.min(1, p.dot(a))));
  n.normalize();
  const closest = scratchC.copy(p).addScaledVector(n, -p.dot(n));
  if (closest.lengthSq() > 1e-12) {
    closest.normalize();
    // Is the closest point between a and b?
    const ab = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
    const ac = Math.acos(Math.max(-1, Math.min(1, a.dot(closest))));
    const cb = Math.acos(Math.max(-1, Math.min(1, closest.dot(b))));
    if (Math.abs(ac + cb - ab) < 1e-4) {
      return Math.asin(Math.min(1, Math.abs(p.dot(n))));
    }
  }
  return Math.min(Math.acos(Math.max(-1, Math.min(1, p.dot(a)))), Math.acos(Math.max(-1, Math.min(1, p.dot(b)))));
}

const scratchN = new Vector3();
const scratchC = new Vector3();
