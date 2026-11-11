import { Color, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { box, cone, cylinder, sphere } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import type { Site } from "../kit/little-world";

/**
 * Dad's models of the things left at Tranquility Base, built from the same
 * small painted pieces as everything else. Sizes are squeezed to fit the
 * diorama (model, not to scale). Each builder works in its site's frame:
 * +Y up, +Z toward the site's front, and returns its colliders.
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

export const M = {
  gold: "#D2A445",
  goldDeep: "#A9772F",
  foil: "#E4C46A",
  black: "#2E2A2A",
  silver: "#C4C1BA",
  steel: "#8E8B86",
  white: "#EDEAE2",
  panel: "#2B3A63",
  panelLine: "#5B6E9E",
  red: "#B8433A",
  blue: "#2F4B86",
  cube: "#283049",
};

/**
 * The bottom half of the lunar module Eagle. The top half flew the crew back
 * up to orbit and this half stayed, so it is wide and flat on top.
 */
export function buildDescentStage(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const y0 = 0.62;
  // The eight-sided body wrapped in gold and black foil.
  b.place(cylinder(8), M.gold, v(0, y0 + 0.32, 0), [0, Math.PI / 8, 0], [0.98, 0.62, 0.98], m);
  b.place(cylinder(8), M.black, v(0, y0 + 0.06, 0), [0, Math.PI / 8, 0], [1.0, 0.12, 1.0], m);
  // Crinkled foil: thin panels on each face, a shade lighter or darker.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const r = 0.91;
    b.place(box(0.01), i % 2 ? M.foil : M.goldDeep, v(Math.sin(a) * r, y0 + 0.36, Math.cos(a) * r), [0, a, 0], [0.5, 0.42, 0.02], m);
    if (i % 2 === 0) b.place(box(0.004), M.black, v(Math.sin(a) * (r + 0.015), y0 + 0.18, Math.cos(a) * (r + 0.015)), [0, a, 0], [0.42, 0.06, 0.01], m);
  }
  // The flat top where the ascent stage sat, with its mounts.
  b.place(cylinder(8), M.steel, v(0, y0 + 0.65, 0), [0, Math.PI / 8, 0], [0.9, 0.05, 0.9], m);
  b.place(cylinder(8), "#6E6A66", v(0, y0 + 0.68, 0), [0, Math.PI / 8, 0], [0.55, 0.02, 0.55], m);
  for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]] as const) {
    b.place(cylinder(6), M.silver, v(x, y0 + 0.74, z), [0, 0, 0], [0.04, 0.14, 0.04], m);
  }
  // The descent engine bell underneath.
  b.place(cylinder(16, 0.55, true), "#4A4644", v(0, y0 - 0.12, 0), [Math.PI, 0, 0], [0.32, 0.3, 0.32], m);

  // Four legs: a main strut down to a round footpad, and two side braces.
  const shapes: Shape[] = [{ kind: "circle", x: 0, z: 0, radius: 1.05, height: 1.4 }];
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const out = new Vector3(Math.sin(a), 0, Math.cos(a));
    const hip = out.clone().multiplyScalar(0.92).setY(y0 + 0.5);
    const foot = out.clone().multiplyScalar(1.55).setY(0.06);
    strut(b, m, hip, foot, 0.045, M.silver);
    const side = new Vector3(-out.z, 0, out.x);
    for (const k of [-1, 1]) strut(b, m, out.clone().multiplyScalar(0.95).addScaledVector(side, k * 0.4).setY(y0 + 0.02), foot.clone().lerp(hip, 0.35), 0.025, M.steel);
    b.place(cylinder(16), M.silver, v(foot.x, 0.05, foot.z), [0, 0, 0], [0.22, 0.07, 0.22], m);
    b.place(cylinder(16), M.foil, v(foot.x, 0.1, foot.z), [0, 0, 0], [0.16, 0.04, 0.16], m);
    shapes.push({ kind: "circle", x: foot.x, z: foot.z, radius: 0.24, height: 0.14 });
  }
  // The ladder on the front leg, with its little porch at the top.
  const front = new Vector3(Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4));
  const side = new Vector3(-front.z, 0, front.x);
  for (const k of [-1, 1]) strut(b, m, front.clone().multiplyScalar(1.02).addScaledVector(side, k * 0.16).setY(y0 + 0.55), front.clone().multiplyScalar(1.42).addScaledVector(side, k * 0.16).setY(0.2), 0.02, M.silver);
  for (let i = 1; i < 6; i += 1) {
    const t = i / 6;
    const p = front.clone().multiplyScalar(1.02 + 0.4 * t).setY(y0 + 0.55 - (y0 + 0.35) * t);
    strut(b, m, p.clone().addScaledVector(side, -0.16), p.clone().addScaledVector(side, 0.16), 0.014, M.silver);
  }
  b.place(box(0.01), M.silver, v(front.x * 1.0, y0 + 0.58, front.z * 1.0), [0, Math.PI / 4, 0], [0.42, 0.03, 0.3], m);
  return shapes;
}

const strutUp = new Vector3(0, 1, 0);
const strutQ = new Quaternion();
const strutM = new Matrix4();

/** A thin rod from `a` to `b`, in the frame `m`. */
export function strut(b: Batcher, m: Matrix4, a: Vector3, c: Vector3, radius: number, color: string): void {
  const d = c.clone().sub(a);
  const length = d.length();
  strutQ.setFromUnitVectors(strutUp, d.normalize());
  strutM.compose(a.clone().lerp(c, 0.5), strutQ, new Vector3(radius, length, radius));
  b.add(cylinder(6), strutM.premultiply(m), color);
}

/** The flag on its pole, with the bar along the top that held it out. */
export function buildFlag(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(8), M.silver, v(0, 0.85, 0), [0, 0, 0], [0.025, 1.7, 0.025], m);
  b.place(cylinder(8), M.silver, v(0.38, 1.66, 0), [0, 0, Math.PI / 2], [0.018, 0.78, 0.018], m);
  const w = 0.76;
  const h = 0.5;
  for (let i = 0; i < 7; i += 1) {
    b.place(box(0.004), i % 2 ? M.white : M.red, v(0.4, 1.64 - (i + 0.5) * (h / 7), 0.004 + (i % 2) * 0.002), [0, 0, 0], [w, h / 7, 0.012], m);
  }
  b.place(box(0.004), M.blue, v(0.4 - w / 2 + 0.17, 1.64 - h * 0.27, 0.014), [0, 0, 0], [0.34, h * 0.54, 0.012], m);
  for (let i = 0; i < 6; i += 1) b.place(sphere("tiny"), M.white, v(0.4 - w / 2 + 0.06 + (i % 3) * 0.1, 1.64 - 0.07 - Math.floor(i / 3) * 0.12, 0.022), [0, 0, 0], 0.012, m);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.1, height: 1.7 }];
}

/** The TV camera on its tripod that showed the first steps to people at home. */
export function buildCamera(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    strut(b, m, new Vector3(0, 0.78, 0), new Vector3(Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32), 0.018, M.silver);
  }
  b.place(box(0.04), M.black, v(0, 0.88, 0), [0.1, 0, 0], [0.22, 0.16, 0.3], m);
  b.place(cylinder(12), M.steel, v(0, 0.9, 0.2), [Math.PI / 2 + 0.1, 0, 0], [0.06, 0.12, 0.06], m);
  b.place(box(0.01), M.silver, v(0, 0.97, -0.05), [0.1, 0, 0], [0.18, 0.02, 0.18], m);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.3, height: 1 }];
}

/** The moonquake listener: a gold box with two flat solar wings and a small antenna. */
export function buildSeismometer(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(box(0.02), M.goldDeep, v(0, 0.06, 0), [0, 0, 0], [0.62, 0.1, 0.5], m);
  b.place(box(0.04), M.gold, v(0, 0.3, 0), [0, 0, 0], [0.42, 0.4, 0.4], m);
  b.place(box(0.01), M.silver, v(0, 0.52, 0), [0, 0, 0], [0.46, 0.04, 0.44], m);
  b.place(cylinder(16), M.white, v(0, 0.6, 0.08), [0, 0, 0], [0.11, 0.12, 0.11], m);
  b.place(cylinder(16, 0.4), M.silver, v(0, 0.7, 0.08), [0, 0, 0], [0.11, 0.08, 0.11], m);
  // The two solar wings, with their cells in rows.
  for (const k of [-1, 1]) {
    b.place(box(0.004), M.silver, v(k * 0.68, 0.42, 0), [0, 0, k * 0.05], [0.84, 0.03, 0.56], m);
    b.place(box(0.004), M.panel, v(k * 0.68, 0.44, 0), [0, 0, k * 0.05], [0.8, 0.03, 0.52], m);
    for (let i = 1; i < 6; i += 1) b.place(box(0.002), M.panelLine, v(k * (0.28 + i * 0.134), 0.46 + i * k * 0.0, 0), [0, 0, k * 0.05], [0.008, 0.01, 0.52], m);
    strut(b, m, new Vector3(k * 0.21, 0.35, 0), new Vector3(k * 0.36, 0.42, 0), 0.015, M.silver);
  }
  // A short antenna mast with a little dish.
  b.place(cylinder(6), M.silver, v(-0.12, 0.72, -0.12), [0, 0, 0], [0.012, 0.36, 0.012], m);
  b.place(cone(12), M.white, v(-0.12, 0.92, -0.12), [Math.PI, 0, 0], [0.07, 0.04, 0.07], m);
  return [{ kind: "box", x: 0, z: 0, halfWidth: 1.12, halfDepth: 0.3, height: 0.5 }];
}

/** The little mirrors: a square tray of a hundred corner cubes on legs, tipped toward Earth. */
export interface MirrorArray {
  shapes: Shape[];
  /** The hundred cube faces, for the glint at the end of the chapter. */
  glints: InstancedMesh;
  /** World point of the tray's center. */
  center: Vector3;
}

export function buildMirrorArray(b: Batcher, s: Site, toon: ToonLibrary, tilt: number): MirrorArray {
  const m = s.matrix;
  // The pallet on the ground, and a back leg holding the tray up.
  b.place(box(0.02), M.goldDeep, v(0, 0.05, 0), [0, 0, 0], [0.9, 0.08, 0.8], m);
  b.place(box(0.02), M.silver, v(0, 0.12, -0.25), [0, 0, 0], [0.82, 0.06, 0.1], m);
  strut(b, m, new Vector3(-0.3, 0.12, -0.3), new Vector3(-0.3, 0.42, -0.12), 0.02, M.silver);
  strut(b, m, new Vector3(0.3, 0.12, -0.3), new Vector3(0.3, 0.42, -0.12), 0.02, M.silver);
  const tray = new Matrix4().compose(new Vector3(0, 0.36, 0.02), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tilt), new Vector3(1, 1, 1)).premultiply(m);
  b.place(box(0.02), M.silver, v(0, 0, 0), [0, 0, 0], [0.74, 0.08, 0.74], tray);
  b.place(box(0.01), M.gold, v(0, 0.045, 0), [0, 0, 0], [0.66, 0.02, 0.66], tray);
  // A hundred dark cube mouths in a ten by ten grid.
  const pitch = 0.062;
  const glints = new InstancedMesh(cylinder(10), toon.glow("#ffffff"), 100);
  glints.name = "lrrr-glints";
  const dummy = new Object3D();
  const black = new Color("#1E2333");
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      const x = (i - 4.5) * pitch;
      const z = (j - 4.5) * pitch;
      b.place(cylinder(10), M.cube, v(x, 0.058, z), [0, 0, 0], [0.024, 0.01, 0.024], tray);
      dummy.position.set(x, 0.066, z);
      dummy.scale.set(0.02, 0.004, 0.02);
      dummy.updateMatrix();
      glints.setMatrixAt(i * 10 + j, dummy.matrix.clone().premultiply(tray));
      glints.setColorAt(i * 10 + j, black);
    }
  }
  glints.instanceMatrix.needsUpdate = true;
  if (glints.instanceColor) glints.instanceColor.needsUpdate = true;
  glints.frustumCulled = false;
  return { shapes: [{ kind: "box", x: 0, z: 0, halfWidth: 0.46, halfDepth: 0.42, height: 0.6 }], glints, center: new Vector3(0, 0.4, 0).applyMatrix4(m) };
}

/** Boot prints: small dark ovals pressed into the dust in pairs. */
export function buildFootprints(b: Batcher, place: (t: number) => { matrix: Matrix4 } | null, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const spot = place(i / Math.max(1, count - 1));
    if (!spot) continue;
    const side = i % 2 ? 0.07 : -0.07;
    // A shallow boot print: a heel and a ribbed sole, a shade darker than the dust.
    b.place(box(0.004), "#807C76", v(side, 0.006, 0.02), [0, 0, 0], [0.075, 0.006, 0.12], spot.matrix);
    b.place(box(0.004), "#807C76", v(side, 0.006, -0.07), [0, 0, 0], [0.065, 0.006, 0.05], spot.matrix);
    for (let k = 0; k < 4; k += 1) b.place(box(0.002), "#6E6B66", v(side, 0.011, -0.02 + k * 0.03), [0, 0, 0], [0.068, 0.004, 0.009], spot.matrix);
  }
}

/** A moon rock: a lumpy grey stone, half buried. */
export function rock(b: Batcher, m: Matrix4, size: number, seed: number, color = "#8A8680"): void {
  b.place(sphere("low"), color, v(0, size * 0.25, 0), [seed, seed * 2.1, seed * 0.7], [size, size * 0.62, size * 0.85], m);
  if (size > 0.25) b.place(sphere("low"), "#77736E", v(size * 0.45, size * 0.12, size * 0.2), [seed * 3, 0, 0], [size * 0.45, size * 0.3, size * 0.4], m);
}

