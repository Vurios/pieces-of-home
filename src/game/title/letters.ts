import { type BufferGeometry, ExtrudeGeometry, Path, Shape, Vector2 } from "three";

/**
 * Our own chunky block alphabet for the title, drawn on a small grid and
 * turned into bevelled 3D letters, like painted wooden blocks. Only the
 * letters the title needs. `#` is a filled cell; rows run top to bottom.
 */
export const GLYPHS: Record<string, string[]> = {
  // Cells always join by an edge, never only by a corner, so each letter is one
  // solid piece. The soft look comes from rounding the outline's corners.
  P: ["####", "#..#", "####", "#...", "#..."],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  E: ["####", "#...", "###.", "#...", "####"],
  C: ["####", "#...", "#...", "#...", "####"],
  S: ["####", "#...", "####", "...#", "####"],
  O: ["####", "#..#", "#..#", "#..#", "####"],
  F: ["####", "#...", "###.", "#...", "#..."],
  H: ["#..#", "#..#", "####", "#..#", "#..#"],
  M: ["##.##", "#####", "#.#.#", "#...#", "#...#"],
};

/** Corner rounding, in cells: outer corners, inner (concave) corners, and holes. */
const ROUND_OUTER = 0.45;
const ROUND_INNER = 0.12;
const ROUND_HOLE = 0.16;

export const GLYPH_ROWS = 5;

export function glyphWidth(letter: string): number {
  const rows = GLYPHS[letter];
  if (!rows) throw new Error(`No glyph for "${letter}"`);
  return rows[0]!.length;
}

type Point = [number, number];

/**
 * Traces the outline of the filled cells into closed loops. Edges run with the
 * filled side on the left, so outer loops wind counter-clockwise and holes
 * clockwise. Where two cells touch only at a corner, the trace turns left, so
 * each piece keeps its own loop.
 */
export function traceGlyph(rows: string[]): Point[][] {
  const h = rows.length;
  const filled = (x: number, y: number): boolean => {
    // Grid y runs up, so row 0 is the top.
    const row = rows[h - 1 - y];
    return x >= 0 && y >= 0 && y < h && row !== undefined && row[x] === "#";
  };
  const w = rows[0]?.length ?? 0;
  // Directed edges keyed by their start point.
  const edges = new Map<string, Point[]>();
  const add = (a: Point, b: Point): void => {
    const key = `${a[0]},${a[1]}`;
    const list = edges.get(key) ?? [];
    list.push(b);
    edges.set(key, list);
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) add([x, y], [x + 1, y]);
      if (!filled(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
      if (!filled(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
      if (!filled(x - 1, y)) add([x, y + 1], [x, y]);
    }
  }
  const loops: Point[][] = [];
  const take = (from: Point, heading: Point | null): Point | null => {
    const key = `${from[0]},${from[1]}`;
    const list = edges.get(key);
    if (!list || list.length === 0) return null;
    let index = 0;
    if (list.length > 1 && heading) {
      // Prefer the left turn: cross product of heading and candidate is positive.
      index = list.findIndex((to) => heading[0] * (to[1] - from[1]) - heading[1] * (to[0] - from[0]) > 0);
      if (index < 0) index = 0;
    }
    const [to] = list.splice(index, 1);
    if (list.length === 0) edges.delete(key);
    return to ?? null;
  };
  while (edges.size > 0) {
    const startKey = edges.keys().next().value as string;
    const [sx, sy] = startKey.split(",").map(Number) as [number, number];
    const start: Point = [sx, sy];
    const loop: Point[] = [start];
    let current = start;
    let heading: Point | null = null;
    for (let guard = 0; guard < 400; guard += 1) {
      const next = take(current, heading);
      if (!next) break;
      heading = [next[0] - current[0], next[1] - current[1]];
      if (next[0] === start[0] && next[1] === start[1]) break;
      loop.push(next);
      current = next;
    }
    loops.push(simplify(loop));
  }
  return loops;
}

/** Drops points in the middle of straight runs. */
function simplify(loop: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[(i - 1 + loop.length) % loop.length]!;
    const b = loop[i]!;
    const c = loop[(i + 1) % loop.length]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross !== 0) out.push(b);
  }
  return out;
}

export function signedArea(loop: Point[]): number {
  let area = 0;
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function inside(point: Point, loop: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i, i += 1) {
    const a = loop[i]!;
    const b = loop[j]!;
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

/** Shapes for one letter, in cell units, with holes attached to the outline around them. */
export function glyphShapes(letter: string): Shape[] {
  const rows = GLYPHS[letter];
  if (!rows) throw new Error(`No glyph for "${letter}"`);
  const loops = traceGlyph(rows);
  const outers = loops.filter((loop) => signedArea(loop) > 0);
  const holes = loops.filter((loop) => signedArea(loop) < 0);
  const shapes = outers.map((loop) => rounded(loop, new Shape(), false));
  for (const hole of holes) {
    // The middle of a hole is empty, but it sits inside the outline that owns it.
    const probe: Point = [hole.reduce((s, p) => s + p[0], 0) / hole.length, hole.reduce((s, p) => s + p[1], 0) / hole.length];
    const owner = outers.findIndex((loop) => inside(probe, loop));
    if (owner >= 0) shapes[owner]!.holes.push(rounded(hole, new Path(), true));
  }
  return shapes;
}

/** Draws a loop into a path, with each corner rounded by a small curve. */
function rounded<T extends Path>(loop: Point[], path: T, hole: boolean): T {
  const n = loop.length;
  const corner = (i: number): { b: Vector2; pin: Vector2; pout: Vector2 } => {
    const a = loop[(i - 1 + n) % n]!;
    const b = loop[i]!;
    const c = loop[(i + 1) % n]!;
    const din = new Vector2(b[0] - a[0], b[1] - a[1]).normalize();
    const dout = new Vector2(c[0] - b[0], c[1] - b[1]).normalize();
    const convex = din.x * dout.y - din.y * dout.x > 0;
    const r = hole ? ROUND_HOLE : convex ? ROUND_OUTER : ROUND_INNER;
    const bv = new Vector2(b[0], b[1]);
    return { b: bv, pin: bv.clone().addScaledVector(din, -r), pout: bv.clone().addScaledVector(dout, r) };
  };
  const first = corner(0);
  path.moveTo(first.pout.x, first.pout.y);
  for (let i = 1; i <= n; i += 1) {
    const k = i === n ? first : corner(i);
    path.lineTo(k.pin.x, k.pin.y);
    path.quadraticCurveTo(k.b.x, k.b.y, k.pout.x, k.pout.y);
  }
  return path;
}

/**
 * A bevelled block letter. Cells are `cell` units wide; the letter is centered
 * on X, stands on Y = 0 and is `depth` thick, facing +Z.
 */
export function letterGeometry(letter: string, cell: number, depth: number): BufferGeometry {
  // A small inset keeps the bevel inside the cell, so neighbours still touch.
  const bevel = 0.16;
  const geometry = new ExtrudeGeometry(glyphShapes(letter), {
    depth: depth / cell - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelOffset: -bevel * 0.9,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(-glyphWidth(letter) / 2, 0, -(depth / cell) / 2 + bevel);
  geometry.scale(cell, cell, cell);
  geometry.computeVertexNormals();
  return geometry;
}
