import { Matrix4, Quaternion, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher, Layer } from "../../render/kit";
import { type ColliderGroup, type Shape, createColliderGroup } from "../../world/colliders";
import { createRandom } from "../../world/noise";
import type { Terrain } from "../../world/terrain";
import { C } from "./buildings";
import { type Site, SITES, local } from "./layout";
import { groundMatrix } from "./nature";

/**
 * The lived-in layer: the small things that say a family lives here and a
 * tinkerer worked here. Porch steps, a bike, firewood, washing on the line,
 * Dad's cable running out to his dish, a tin-can scarecrow he built for Mom's
 * garden. Each group is placed in the frame of the building it belongs to, so
 * it moves with that building.
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
const UP = new Vector3(0, 1, 0);
const tmpQ = new Quaternion();
const tmpM = new Matrix4();
const tmpDir = new Vector3();
const tmpMid = new Vector3();
const ONE = new Vector3(1, 1, 1);

/** A rod from `a` to `b` in the parent's frame. Good for legs, frames, ropes and cables. */
export function rod(b: Batcher, parent: Matrix4, a: Vector3, c: Vector3, radius: number, color: string, layer: Layer = "solid", segments = 6, sway = 1): void {
  tmpDir.subVectors(c, a);
  const length = tmpDir.length();
  if (length < 1e-5) return;
  tmpDir.divideScalar(length);
  tmpQ.setFromUnitVectors(UP, tmpDir);
  tmpMid.addVectors(a, c).multiplyScalar(0.5);
  tmpM.compose(tmpMid, tmpQ, new Vector3(radius, length, radius)).premultiply(parent);
  b.add(cylinder(segments), tmpM, color, layer, sway);
}

/** A rope that sags between two points, drawn as a few short rods. */
function rope(b: Batcher, parent: Matrix4, a: Vector3, c: Vector3, sag: number, radius: number, color: string, steps = 8, layer: Layer = "solid"): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const p = a.clone().lerp(c, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    points.push(p);
  }
  for (let i = 0; i < steps; i += 1) rod(b, parent, points[i]!, points[i + 1]!, radius, color, layer, 5);
  return points;
}

// ---------------------------------------------------------------- the house

function porchSteps(b: Batcher, m: Matrix4, shapes: Shape[]): void {
  // One wide, low wooden step down from the porch to the path, below the door.
  const x = -0.6;
  for (const [z, top, depth] of [[3.3, 0.13, 0.4]] as const) {
    b.place(box(0.02), C.woodLight, v(x, top - 0.3, z), [0, 0, 0], [1.3, 0.6, depth], m);
    b.place(box(0.004), C.wood, v(x, top + 0.002, z + depth / 2 - 0.02), [0, 0, 0], [1.3, 0.008, 0.03], m);
    shapes.push({ kind: "box", x, z, halfWidth: 0.65, halfDepth: depth / 2, height: top });
  }
  for (const side of [-1, 1]) b.place(box(0.01), C.trim, v(x + side * 0.68, -0.1, 3.3), [0, 0, 0], [0.06, 0.45, 0.42], m);
}

function porchSkirt(b: Batcher, m: Matrix4): void {
  // Criss-cross lattice under the porch deck, front face, either side of the steps.
  const z = 3.115;
  for (const [x0, x1] of [
    [-2.05, -1.3],
    [0.1, 2.05],
  ] as const) {
    const width = x1 - x0;
    const n = Math.round(width / 0.22);
    for (let i = 0; i < n; i += 1) {
      const x = x0 + (i + 0.5) * (width / n);
      for (const tilt of [-0.75, 0.75]) b.place(box(0.004), C.paper, v(x, 0.12, z), [0, 0, tilt], [0.025, 0.26, 0.02], m);
    }
    b.place(box(0.004), C.trim, v((x0 + x1) / 2, 0.23, z + 0.01), [0, 0, 0], [width, 0.05, 0.03], m);
  }
}

function bike(b: Batcher, m: Matrix4): void {
  // Remi's bike, leaning on the porch rail. Built in its own frame along +Z, tipped toward the rail.
  const frame = m.clone().multiply(new Matrix4().compose(new Vector3(-2.38, 0, 2.15), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -0.16), ONE));
  const red = "#C0573E";
  const wheel = (z: number): void => {
    b.place(torus(0.14), C.ink, v(0, 0.3, z), [0, Math.PI / 2, 0], 0.29, frame);
    b.place(torus(0.35), C.metal, v(0, 0.3, z), [0, Math.PI / 2, 0], 0.06, frame);
    for (let i = 0; i < 4; i += 1) b.place(box(0.004), C.metal, v(0, 0.3, z), [i * (Math.PI / 4), 0, 0], [0.01, 0.5, 0.01], frame);
  };
  wheel(-0.42);
  wheel(0.42);
  const P = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const seat = P(0, 0.62, -0.14);
  const crank = P(0, 0.32, -0.02);
  const head = P(0, 0.66, 0.3);
  rod(b, frame, P(0, 0.3, -0.42), crank, 0.022, red);
  rod(b, frame, P(0, 0.3, -0.42), seat, 0.022, red);
  rod(b, frame, crank, seat, 0.026, red);
  rod(b, frame, crank, head, 0.026, red);
  rod(b, frame, seat.clone().setY(0.6), head.clone().setY(0.6), 0.024, red);
  rod(b, frame, head, P(0, 0.3, 0.42), 0.02, C.metal);
  b.place(box(0.04), C.ink, v(0, 0.66, -0.16), [0, 0, 0], [0.11, 0.04, 0.2], frame);
  rod(b, frame, P(-0.22, 0.78, 0.28), P(0.22, 0.78, 0.28), 0.016, C.metalDark);
  rod(b, frame, head, P(0, 0.78, 0.28), 0.02, C.metal);
  for (const side of [-1, 1]) b.place(cylinder(8), C.ink, v(side * 0.22, 0.78, 0.28), [0, 0, Math.PI / 2], [0.025, 0.08, 0.025], frame);
  // A wicker basket with a rolled-up comic in it.
  b.place(box(0.04), C.woodLight, v(0, 0.78, 0.46), [0, 0, 0], [0.26, 0.16, 0.2], frame);
  b.place(cylinder(8), C.paper, v(0.05, 0.86, 0.46), [0.3, 0, 0.2], [0.035, 0.18, 0.035], frame);
  b.place(cylinder(12), C.metal, v(0.05, 0.32, -0.02), [0, 0, Math.PI / 2], [0.07, 0.03, 0.07], frame);
}

function woodpile(b: Batcher, m: Matrix4, shapes: Shape[]): void {
  // Split logs stacked against the side wall under a little lean-to roof.
  const x = 2.5;
  const random = createRandom(77);
  for (let row = 0; row < 4; row += 1) {
    const count = 6 - (row > 2 ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const z = -1.25 + i * 0.22 + (row % 2) * 0.11;
      const y = 0.1 + row * 0.18;
      b.place(cylinder(7), random() < 0.5 ? C.woodDark : "#8A5A38", v(x, y, z), [0, 0, Math.PI / 2], [0.09, 0.5, 0.09], m);
      b.place(cylinder(7), "#D8B88A", v(x + 0.252, y, z), [0, 0, Math.PI / 2], [0.075, 0.005, 0.075], m);
    }
  }
  b.place(box(0.02), C.shedRoof, v(x + 0.05, 0.95, -0.7), [0, 0, -0.25], [0.7, 0.05, 1.5], m);
  for (const z of [-1.4, 0.0]) rod(b, m, new Vector3(x + 0.33, 0, z), new Vector3(x + 0.33, 0.87, z), 0.03, C.woodDark);
  // An axe leaning on the pile.
  rod(b, m, new Vector3(x + 0.42, 0, 0.25), new Vector3(x + 0.3, 0.55, 0.2), 0.02, C.woodLight);
  b.place(box(0.01), C.metalDark, v(x + 0.3, 0.57, 0.2), [0, 0, -0.2], [0.04, 0.09, 0.12], m);
  shapes.push({ kind: "box", x: x + 0.05, z: -0.7, halfWidth: 0.32, halfDepth: 0.75, height: 1.0 });
}

function rainBarrel(b: Batcher, m: Matrix4, x: number, z: number, shapes: Shape[], spout = true): void {
  b.place(cylinder(14, 0.92), C.wood, v(x, 0.38, z), [0, 0, 0], [0.3, 0.76, 0.3], m);
  for (const y of [0.15, 0.62]) b.place(cylinder(14), C.metalDark, v(x, y, z), [0, 0, 0], [0.305 - (y > 0.5 ? 0.02 : 0), 0.04, 0.305 - (y > 0.5 ? 0.02 : 0)], m);
  b.place(cylinder(14), "#6E8FB0", v(x, 0.75, z), [0, 0, 0], [0.25, 0.02, 0.25], m);
  b.place(cylinder(6), C.metal, v(x + 0.29, 0.18, z), [0, 0, Math.PI / 2], [0.025, 0.08, 0.025], m);
  if (spout) rod(b, m, new Vector3(x, 0.82, z), new Vector3(x, 2.55, z), 0.04, C.metalDark);
  shapes.push({ kind: "circle", x, z, radius: 0.32, height: 0.8 });
}

function clothesline(b: Batcher, m: Matrix4, shapes: Shape[]): void {
  const a = new Vector3(0.9, 0, -2.9);
  const c = new Vector3(3.3, 0, -3.1);
  for (const p of [a, c]) {
    rod(b, m, p, p.clone().setY(1.75), 0.04, C.woodDark);
    rod(b, m, p.clone().setY(1.7).add(new Vector3(0, 0, -0.18)), p.clone().setY(1.7).add(new Vector3(0, 0, 0.18)), 0.03, C.woodDark);
    shapes.push({ kind: "circle", x: p.x, z: p.z, radius: 0.08, height: 1.8 });
  }
  const line = rope(b, m, a.clone().setY(1.68), c.clone().setY(1.68), 0.12, 0.008, C.paper, 10);
  // Washing hangs from the line and moves in the wind.
  const items: [number, string, "shirt" | "sock" | "towel"][] = [
    [0.15, "#D3A13A", "shirt"],
    [0.3, C.paper, "sock"],
    [0.38, "#C0573E", "sock"],
    [0.55, "#6E8FB0", "towel"],
    [0.78, "#B9A5D8", "shirt"],
  ];
  for (const [t, color, kind] of items) {
    const i = Math.round(t * 10);
    const p = line[i]!;
    const w = kind === "shirt" ? 0.34 : kind === "towel" ? 0.38 : 0.09;
    const h = kind === "shirt" ? 0.36 : kind === "towel" ? 0.46 : 0.2;
    b.place(box(0.02), color, v(p.x, p.y - h / 2, p.z), [0, -0.08, 0], [w, h, 0.02], m, "foliage", 0.5);
    if (kind === "shirt") for (const s of [-1, 1]) b.place(box(0.02), color, v(p.x + s * 0.2, p.y - 0.09, p.z), [0, -0.08, s * 0.7], [0.12, 0.16, 0.02], m, "foliage", 0.5);
    if (kind === "towel") b.place(box(0.01), C.paper, v(p.x, p.y - h + 0.06, p.z + 0.012), [0, -0.08, 0], [w, 0.04, 0.005], m, "foliage", 0.5);
    for (const s of kind === "sock" ? [0] : [-1, 1]) b.place(box(0.01), C.woodLight, v(p.x + s * w * 0.38, p.y + 0.01, p.z), [0, 0, 0], [0.025, 0.07, 0.035], m);
  }
  // A wicker basket waiting under the line.
  b.place(cylinder(12, 1.15), C.woodLight, v(2.4, 0.13, -2.6), [0, 0, 0], [0.26, 0.26, 0.2], m);
  b.place(sphere("low"), C.paper, v(2.4, 0.26, -2.6), [0, 0, 0], [0.22, 0.06, 0.16], m);
  shapes.push({ kind: "circle", x: 2.4, z: -2.6, radius: 0.28, height: 0.3 });
}

function sideBed(b: Batcher, m: Matrix4, shapes: Shape[]): void {
  // A planted bed along the right wall, with round hydrangeas at the front corner.
  b.place(box(0.02), C.woodDark, v(2.5, 0.08, 0.95), [0, 0, 0], [0.55, 0.16, 1.0], m);
  b.place(box(0.01), "#5E4636", v(2.5, 0.16, 0.95), [0, 0, 0], [0.48, 0.02, 0.92], m);
  for (let i = 0; i < 3; i += 1) {
    const z = 0.6 + i * 0.35;
    for (let k = 0; k < 4; k += 1) {
      const a = k * 1.7 + i;
      b.place(sphere("mid"), k === 0 ? "#B9A5D8" : k === 1 ? "#9C8BC6" : "#6E9470", v(2.5 + Math.cos(a) * 0.1, 0.32 + (k < 2 ? 0.08 : 0), z + Math.sin(a) * 0.08), [0, 0, 0], k < 2 ? 0.13 : 0.15, m, "foliage", 0.25);
    }
  }
  shapes.push({ kind: "box", x: 2.5, z: 0.95, halfWidth: 0.28, halfDepth: 0.5, height: 0.5 });
}

export function buildHouseYard(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];
  porchSteps(b, m, shapes);
  porchSkirt(b, m);
  bike(b, m);
  shapes.push({ kind: "box", x: -2.4, z: 2.15, halfWidth: 0.12, halfDepth: 0.55, height: 0.9 });
  woodpile(b, m, shapes);
  rainBarrel(b, m, 2.32, -1.95, shapes);
  clothesline(b, m, shapes);
  sideBed(b, m, shapes);
  // A welcome sign and a pair of muddy boots by the door.
  for (const sx of [-1.45, -1.33]) {
    b.place(box(0.02), "#4A5A3A", v(sx, 0.43, 1.85), [0, 0.2, 0], [0.09, 0.17, 0.14], m);
    b.place(box(0.02), "#4A5A3A", v(sx, 0.38, 1.91), [0, 0.2, 0], [0.09, 0.07, 0.2], m);
  }
  return shapes;
}

// ---------------------------------------------------------------- the workshop

function sawhorse(b: Batcher, m: Matrix4, x: number, z: number): void {
  for (const dz of [-0.35, 0.35]) {
    for (const dx of [-0.18, 0.18]) rod(b, m, new Vector3(x + dx, 0, z + dz), new Vector3(x, 0.58, z + dz), 0.025, C.woodLight);
  }
  b.place(box(0.01), C.woodLight, v(x, 0.6, z), [0, 0, 0], [0.09, 0.06, 0.85], m);
}

export function buildShedYard(b: Batcher, s: Site, terrain: Terrain): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];

  // Two sawhorses with a plank, a saw and a half-built birdhouse: Dad's last outdoor project.
  sawhorse(b, m, -3.85, -0.9);
  sawhorse(b, m, -3.85, -2.1);
  b.place(box(0.01), C.woodLight, v(-3.85, 0.66, -1.5), [0, 0, 0], [0.32, 0.05, 1.8], m);
  b.place(box(0.01), C.metal, v(-3.8, 0.7, -1.95), [0, 0.3, 0], [0.12, 0.01, 0.42], m);
  b.place(box(0.01), C.clay, v(-3.8, 0.7, -2.2), [0, 0.3, 0], [0.05, 0.05, 0.12], m);
  b.place(box(0.02), C.woodLight, v(-3.9, 0.82, -1.15), [0, 0.4, 0], [0.24, 0.26, 0.22], m);
  b.place(gableish(), C.clay, v(-3.9, 1.0, -1.15), [0, 0.4, 0], [0.3, 0.14, 0.3], m);
  b.place(cylinder(12), C.ink, v(-3.9, 0.85, -1.03), [Math.PI / 2, 0.4, 0], [0.04, 0.02, 0.04], m);
  shapes.push({ kind: "box", x: -3.85, z: -1.5, halfWidth: 0.25, halfDepth: 1.0, height: 0.75 });

  // A stack of boards under a tarp at the back.
  for (let i = 0; i < 5; i += 1) b.place(box(0.01), i % 2 ? C.woodLight : C.wood, v(-1.2, 0.06 + i * 0.07, -3.2), [0, 0.02 * i, 0], [1.9, 0.06, 0.28], m);
  b.place(box(0.04), "#5F7F8C", v(-1.65, 0.38, -3.2), [0, 0, -0.08], [1.1, 0.04, 0.36], m);
  shapes.push({ kind: "box", x: -1.2, z: -3.2, halfWidth: 0.95, halfDepth: 0.18, height: 0.45 });

  rainBarrel(b, m, 3.35, -2.1, shapes, false);

  // Dad's cable runs from the workshop wall out to the dish, on two little poles.
  const start = new Vector3(3.02, 1.9, -0.9);
  const dishBase = local(SITES.dish, 0, 1.35, 0).applyMatrix4(m.clone().invert());
  const mid = start.clone().lerp(dishBase, 0.5);
  const poleDir = mid.clone().applyMatrix4(m).normalize();
  const ground = poleDir.clone().multiplyScalar(terrain.radiusAt(poleDir)).applyMatrix4(m.clone().invert());
  const poleTop = ground.clone().add(new Vector3(0, 1.7, 0));
  rod(b, m, ground, poleTop, 0.035, C.woodDark);
  b.place(box(0.01), C.ink, [poleTop.x, poleTop.y + 0.02, poleTop.z], [0, 0, 0], [0.08, 0.04, 0.08], m);
  rope(b, m, start, poleTop, 0.12, 0.014, C.ink, 6);
  rope(b, m, poleTop, dishBase, 0.12, 0.014, C.ink, 6);
  b.place(box(0.01), C.metalDark, [start.x + 0.02, start.y, start.z], [0, 0, 0], [0.06, 0.1, 0.1], m);
  shapes.push({ kind: "circle", x: ground.x, z: ground.z, radius: 0.08, height: 1.8 });

  // An old wheel and a crate of jars by the door: things waiting to be fixed.
  b.place(torus(0.2), C.ink, v(-2.2, 0.32, 2.9), [0, 0.5, 0.15], 0.3, m);
  b.place(box(0.02), C.woodLight, v(2.2, 0.17, 2.95), [0, -0.3, 0], [0.5, 0.34, 0.36], m);
  for (let i = 0; i < 3; i += 1) b.place(cylinder(10), "#9CC1C9", v(2.06 + i * 0.13, 0.4, 2.98 - i * 0.04), [0, 0, 0], [0.05, 0.14, 0.05], m);
  shapes.push({ kind: "circle", x: 2.2, z: 2.95, radius: 0.3, height: 0.5 });
  return shapes;
}

/** A tiny roof for the birdhouse. */
function gableish() {
  return cone(4);
}

/** A little solar panel on a post beside the dish. */
export function buildSolarPanel(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const x = -1.4;
  const z = -0.7;
  rod(b, m, new Vector3(x, 0, z), new Vector3(x, 0.8, z), 0.04, C.metalDark);
  b.place(box(0.01), C.metal, v(x, 0.88, z), [-0.6, 0.4, 0], [0.9, 0.04, 0.6], m);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) {
    b.place(box(0.005), "#3F5A86", v(x + (i - 1) * 0.28 * Math.cos(0.4) + (j - 0.5) * 0.27 * Math.sin(0.4) * 0.8, 0.9 + (j - 0.5) * 0.15, z + (j - 0.5) * 0.2 - (i - 1) * 0.1), [-0.6, 0.4, 0], [0.26, 0.02, 0.26], m);
  }
  return [{ kind: "circle", x, z, radius: 0.1, height: 1.2 }];
}

// ---------------------------------------------------------------- the garden

export function buildGardenYard(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const shapes: Shape[] = [];

  // A rose arch over the gate.
  const z = 1.6;
  for (const x of [-0.62, 0.62]) {
    b.place(box(0.01), C.paper, v(x, 0.75, z), [0, 0, 0], [0.07, 1.5, 0.07], m);
    shapes.push({ kind: "circle", x, z, radius: 0.07, height: 1.6 });
  }
  b.place(torus(0.06, Math.PI), C.paper, v(0, 1.5, z), [0, 0, 0], 0.62, m);
  const random = createRandom(9);
  for (let i = 0; i < 44; i += 1) {
    const t = i / 43;
    const angle = t * Math.PI;
    const onArch = i % 3 !== 0;
    const px = onArch ? Math.cos(angle) * 0.62 : (i % 2 ? -0.62 : 0.62);
    const py = onArch ? 1.5 + Math.sin(angle) * 0.62 : 0.4 + random() * 1.0;
    b.place(sphere("low"), random() < 0.6 ? "#6E9470" : "#5E8466", v(px + (random() - 0.5) * 0.14, py + (random() - 0.5) * 0.08, z + (random() - 0.5) * 0.16), [random(), random(), 0], [0.13 + random() * 0.05, 0.1, 0.11], m, "foliage", 0.2);
    if (random() < 0.45) b.place(sphere("low"), random() < 0.5 ? "#E36F5A" : "#F4ECDD", v(px, py + 0.04, z + 0.08), [0, 0, 0], 0.05, m, "foliage", 0.2);
  }

  // Dad's tin-can scarecrow robot keeps the birds off Mom's beans.
  const bot = m.clone().multiply(new Matrix4().makeTranslation(-2.35, 0, 0.35));
  rod(b, bot, new Vector3(0, 0, 0), new Vector3(0, 1.35, 0), 0.04, C.woodDark);
  rod(b, bot, new Vector3(-0.42, 1.05, 0), new Vector3(0.42, 1.05, 0), 0.03, C.woodDark);
  b.place(box(0.04), "#6E8FB0", v(0, 0.95, 0), [0, 0, 0], [0.36, 0.42, 0.22], bot);
  b.place(box(0.01), C.clay, v(0, 0.85, 0.115), [0, 0, 0], [0.1, 0.1, 0.01], bot);
  for (const sx of [-1, 1]) {
    b.place(box(0.03), "#6E8FB0", v(sx * 0.3, 1.04, 0), [0, 0, 0], [0.2, 0.12, 0.13], bot);
    // Pie tins hang from the arms and flash in the light.
    rope(b, bot, new Vector3(sx * 0.4, 1.03, 0), new Vector3(sx * 0.4, 0.8, 0.01), 0.0, 0.005, C.paper, 1);
    b.place(cylinder(14), C.metal, v(sx * 0.4, 0.76, 0.01), [Math.PI / 2, 0, 0], [0.08, 0.01, 0.08], bot, "foliage", 0.8);
  }
  b.place(cylinder(14), C.metal, v(0, 1.4, 0), [0, 0, 0], [0.16, 0.26, 0.16], bot);
  b.place(cylinder(14), C.metalDark, v(0, 1.4, 0), [0, 0, 0], [0.163, 0.02, 0.163], bot);
  for (const sx of [-1, 1]) {
    b.place(cylinder(12), C.clay, v(sx * 0.065, 1.44, 0.155), [Math.PI / 2, 0, 0], [0.045, 0.02, 0.045], bot);
    b.place(sphere("low"), C.ink, v(sx * 0.065, 1.44, 0.168), [0, 0, 0], 0.018, bot);
  }
  b.place(box(0.005), C.ink, v(0, 1.34, 0.16), [0, 0, 0], [0.09, 0.012, 0.01], bot);
  rod(b, bot, new Vector3(0, 1.53, 0), new Vector3(0.04, 1.75, 0), 0.008, C.metalDark, "foliage", 5, 1);
  b.place(sphere("low"), C.amber, v(0.04, 1.77, 0), [0, 0, 0], 0.03, bot, "foliage", 1);
  // A straw hat, slightly askew.
  b.place(cylinder(16), "#E0B060", v(0.02, 1.56, 0), [0.1, 0, 0.12], [0.28, 0.02, 0.28], bot);
  b.place(cylinder(16, 0.8), "#E0B060", v(0.02, 1.63, 0), [0.1, 0, 0.12], [0.15, 0.13, 0.15], bot);
  b.place(cylinder(16), C.clay, v(0.02, 1.6, 0), [0.1, 0, 0.12], [0.152, 0.03, 0.152], bot);
  shapes.push({ kind: "circle", x: -2.35, z: 0.35, radius: 0.25, height: 1.8 });

  // Stacked clay pots and a wheelbarrow of soil.
  for (const [x, y, zz, r] of [
    [2.3, 0.12, 1.35, 0.15],
    [2.55, 0.12, 1.2, 0.15],
    [2.42, 0.35, 1.28, 0.13],
  ] as const) b.place(cylinder(12, 1.25), C.clay, v(x, y, zz), [0, 0, 0], [r, 0.24, r], m);
  shapes.push({ kind: "circle", x: 2.42, z: 1.28, radius: 0.3, height: 0.5 });
  const barrow = m.clone().multiply(new Matrix4().compose(new Vector3(-2.25, 0, 1.75), new Quaternion().setFromAxisAngle(UP, 0.6), ONE));
  b.place(box(0.04), "#4E7A86", v(0, 0.35, 0), [0, 0, 0], [0.42, 0.22, 0.6], barrow);
  b.place(sphere("low"), "#6B4A35", v(0, 0.46, 0), [0, 0, 0], [0.18, 0.06, 0.26], barrow);
  b.place(torus(0.35), C.ink, v(0, 0.13, 0.42), [0, Math.PI / 2, 0], 0.12, barrow);
  for (const sx of [-1, 1]) {
    rod(b, barrow, new Vector3(sx * 0.16, 0.3, 0.4), new Vector3(sx * 0.2, 0.42, -0.65), 0.018, C.woodDark);
    rod(b, barrow, new Vector3(sx * 0.15, 0.24, -0.2), new Vector3(sx * 0.15, 0, -0.25), 0.018, C.woodDark);
  }
  shapes.push({ kind: "circle", x: -2.25, z: 1.75, radius: 0.4, height: 0.6 });
  return shapes;
}

// ---------------------------------------------------------------- the hill

/** The telescope on the hill, rebuilt as a real little refractor on a tripod, with a bench beside it. */
export function buildHilltop(b: Batcher, terrain: Terrain, top: Vector3): ColliderGroup[] {
  const m = groundMatrix(terrain, top, 20, 0.02);
  const head = new Vector3(0, 1.02, 0);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const foot = new Vector3(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
    rod(b, m, foot, head.clone().add(new Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05)), 0.028, C.woodDark, "solid", 6);
    rod(b, m, foot.clone().multiplyScalar(0.45).setY(0.45), new Vector3(0, 0.47, 0), 0.012, C.metalDark);
    b.place(sphere("low"), C.ink, [foot.x, 0.02, foot.z], [0, 0, 0], 0.035, m);
  }
  b.place(cylinder(12), C.metalDark, v(0, 0.47, 0), [0, 0, 0], [0.12, 0.02, 0.12], m);
  b.place(cylinder(12), C.ink, v(0, 1.05, 0), [0, 0, 0], [0.07, 0.07, 0.07], m);
  b.place(box(0.01), C.metalDark, v(0, 1.13, 0), [0, 0, 0], [0.2, 0.06, 0.1], m);
  for (const sx of [-1, 1]) b.place(box(0.01), C.metalDark, v(sx * 0.09, 1.21, 0), [0, 0, 0], [0.025, 0.16, 0.05], m);
  // The tube points up at the sky, toward where the Moon would rise.
  const tilt = -0.75;
  const pivot = new Vector3(0, 1.25, 0);
  const axis = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(1, 0, 0), tilt);
  const along = (d: number): [number, number, number] => {
    const p = pivot.clone().addScaledVector(axis, d);
    return [p.x, p.y, p.z];
  };
  b.place(cylinder(16), C.brass, along(0.12), [tilt, 0, 0], [0.075, 0.9, 0.075], m);
  b.place(cylinder(16), C.ink, along(0.6), [tilt, 0, 0], [0.095, 0.12, 0.095], m);
  b.place(cylinder(16), "#3F5A86", along(0.665), [tilt, 0, 0], [0.08, 0.01, 0.08], m);
  b.place(cylinder(12), C.ink, along(-0.36), [tilt, 0, 0], [0.05, 0.08, 0.05], m);
  b.place(cylinder(10), C.metalDark, along(-0.43), [tilt, 0, 0], [0.025, 0.08, 0.025], m);
  // A finder scope riding on top.
  const finder = pivot.clone().addScaledVector(axis, 0.18).add(new Vector3(0, 0.07, 0.06));
  b.place(cylinder(10), C.ink, [finder.x, finder.y, finder.z], [tilt, 0, 0], [0.025, 0.26, 0.025], m);

  // A bench for looking up, with paper planes and a star chart.
  const bench = m.clone().multiply(new Matrix4().compose(new Vector3(-1.35, 0, -0.55), new Quaternion().setFromAxisAngle(UP, 0.9), ONE));
  b.place(box(0.02), C.woodLight, v(0, 0.45, 0), [0, 0, 0], [1.2, 0.07, 0.4], bench);
  for (let i = 0; i < 3; i += 1) b.place(box(0.004), C.wood, v(0, 0.488, -0.13 + i * 0.13), [0, 0, 0], [1.2, 0.006, 0.015], bench);
  b.place(box(0.02), C.woodLight, v(0, 0.78, -0.2), [-0.15, 0, 0], [1.2, 0.26, 0.05], bench);
  for (const sx of [-0.5, 0.5]) {
    b.place(box(0.01), C.woodDark, v(sx, 0.22, 0), [0, 0, 0], [0.07, 0.44, 0.36], bench);
    b.place(box(0.01), C.woodDark, v(sx, 0.62, -0.2), [-0.15, 0, 0], [0.06, 0.38, 0.05], bench);
  }
  b.place(box(0.005), C.paper, v(0.25, 0.495, 0.05), [0, 0.3, 0], [0.3, 0.008, 0.22], bench);
  b.place(box(0.004), C.indigo, v(0.25, 0.5, 0.05), [0, 0.3, 0], [0.26, 0.004, 0.18], bench);
  b.place(cone(3), C.paper, v(-0.3, 0.52, 0.02), [Math.PI / 2, 0, 0.8], [0.09, 0.24, 0.025], bench);
  for (const [x, zz, r] of [
    [0.4, 0.75, 0.3],
    [-0.9, 0.6, 2.1],
    [0.9, -0.5, 4.0],
  ] as const) b.place(cone(3), C.paper, v(x, 0.04, zz), [Math.PI / 2, 0, r], [0.09, 0.24, 0.025], bench);
  b.place(cylinder(10), C.amber, v(0.75, 0.08, 0.3), [0, 0, 0], [0.07, 0.16, 0.07], bench, "glow");
  b.place(cylinder(10), C.ink, v(0.75, 0.18, 0.3), [0, 0, 0], [0.08, 0.03, 0.08], bench);

  return [
    createColliderGroup(m, [{ kind: "circle", x: 0, z: 0, radius: 0.4, height: 1.6 }]),
    createColliderGroup(bench, [{ kind: "box", x: 0, z: -0.05, halfWidth: 0.6, halfDepth: 0.22, height: 0.9 }]),
  ];
}
