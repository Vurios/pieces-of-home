import rough from "roughjs";

/**
 * Hand-drawn shapes as SVG path data, from rough.js. No DOM needed, so the
 * Field Guide can draw the same sketches at build time.
 *
 * Every sketch comes in three copies with different seeds. Shown one after
 * another, they make the 3-frame "boiling line" from hand-drawn animation.
 */
export type Prim =
  | { k: "line"; a: [number, number]; b: [number, number] }
  | { k: "rect"; x: number; y: number; w: number; h: number }
  | { k: "circle"; x: number; y: number; d: number }
  | { k: "ellipse"; x: number; y: number; w: number; h: number }
  | { k: "poly"; pts: [number, number][] }
  | { k: "path"; d: string }
  | { k: "curve"; pts: [number, number][] };

const generator = rough.generator();

export interface SketchOptions {
  roughness?: number;
  bowing?: number;
  strokeWidth?: number;
}

/** One copy of a sketch: a list of path strings. */
export function sketch(prims: Prim[], seed: number, options: SketchOptions = {}): string[] {
  const o = { seed, roughness: options.roughness ?? 1.1, bowing: options.bowing ?? 0.8, strokeWidth: options.strokeWidth ?? 2, disableMultiStroke: false, preserveVertices: false };
  const out: string[] = [];
  for (const p of prims) {
    let drawable;
    switch (p.k) {
      case "line":
        drawable = generator.line(p.a[0], p.a[1], p.b[0], p.b[1], o);
        break;
      case "rect":
        drawable = generator.rectangle(p.x, p.y, p.w, p.h, o);
        break;
      case "circle":
        drawable = generator.circle(p.x, p.y, p.d, o);
        break;
      case "ellipse":
        drawable = generator.ellipse(p.x, p.y, p.w, p.h, o);
        break;
      case "poly":
        drawable = generator.polygon(p.pts, o);
        break;
      case "curve":
        drawable = generator.curve(p.pts, o);
        break;
      default:
        drawable = generator.path(p.d, o);
    }
    for (const path of generator.toPaths(drawable)) out.push(path.d);
  }
  return out;
}

/** Three boiling copies. */
export function boil(prims: Prim[], seed: number, options?: SketchOptions): string[][] {
  return [0, 1, 2].map((i) => sketch(prims, seed + i * 97, options));
}

const cache = new Map<string, string[][]>();

/** Cached boiling copies of a named sketch. */
export function cachedBoil(key: string, prims: () => Prim[], seed: number, options?: SketchOptions): string[][] {
  let hit = cache.get(key);
  if (!hit) {
    hit = boil(prims(), seed, options);
    cache.set(key, hit);
  }
  return hit;
}
