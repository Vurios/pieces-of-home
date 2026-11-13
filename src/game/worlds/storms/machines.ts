import { Group, Matrix4, Mesh, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import type { Site } from "../kit/little-world";
import { strut } from "../tranquility/machines";

/**
 * Dad's models for the Ocean of Storms (bonus chapter): Surveyor 3 on its
 * crater slope, its scoop trenches and bounce marks, Dad's landing table and
 * the sample box by Intrepid. Sizes are squeezed for the diorama (model, not
 * to scale). Each builder works in its site's frame: +Y up, +Z toward the
 * site's front.
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
const p = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export const S = {
  /** Surveyor was white. Years in the sunlight turned much of it brown (a12-brown). */
  tan: "#C9B48C",
  tanDeep: "#A8936C",
  wiped: "#E6DDCB",
  tube: "#BCA77E",
  metal: "#8E8B86",
  dark: "#4A4644",
  panel: "#2B3A63",
  panelLine: "#5B6E9E",
  mirror: "#A9BCD0",
  gold: "#D2A445",
  white: "#EDEAE2",
  red: "#B8433A",
  wood: "#8A5A3A",
  woodDark: "#5E3B26",
  paper: "#F4ECDD",
  ink: "#2B2622",
};

/** The parts the astronauts took home, as points in Surveyor's frame. */
export interface SurveyorParts {
  /** Where the TV camera sits, for the camera's close look. */
  camera: Vector3;
  /** The scoop at the end of its arm. */
  scoop: Vector3;
  shapes: Shape[];
}

/**
 * Surveyor 3: a three-legged frame of thin tubes, round crushable footpads,
 * a mast with a flat antenna and a solar panel, two boxy compartments, the
 * TV camera with its mirror hood, and the scoop on its folding arm reaching
 * out to the trenches. The camera, the scoop and a piece of tube go into
 * `parts`, so they can be taken away.
 */
export function buildSurveyor(b: Batcher, parts: Batcher, s: Site): SurveyorParts {
  const m = s.matrix;
  const baseY = 0.62;
  const apex = p(0, 1.78, 0);
  const corners = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    return p(Math.sin(a) * 0.46, baseY, Math.cos(a) * 0.46);
  });
  // The frame: a triangle of tubes, and three tubes up to the top of the mast.
  for (let i = 0; i < 3; i += 1) {
    const a = corners[i]!;
    const c = corners[(i + 1) % 3]!;
    strut(b, m, a, c, 0.026, S.tube);
    strut(b, m, a, apex, 0.024, i === 1 ? S.tanDeep : S.tube);
    b.place(sphere("low"), S.tanDeep, v(a.x, a.y, a.z), [0, 0, 0], 0.045, m);
  }
  // A mid ring of thinner tubes, so the frame reads as a little tower.
  const mid = corners.map((c) => c.clone().lerp(apex, 0.42));
  for (let i = 0; i < 3; i += 1) strut(b, m, mid[i]!, mid[(i + 1) % 3]!, 0.016, S.tube);

  // Three legs: a hinged leg out to a round footpad, a shock strut from higher up, and a brace.
  const shapes: Shape[] = [{ kind: "circle", x: 0, z: 0, radius: 0.62, height: 1.9 }];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const out = p(Math.sin(a), 0, Math.cos(a));
    const hip = out.clone().multiplyScalar(0.36).setY(baseY - 0.04);
    const foot = out.clone().multiplyScalar(1.12).setY(0.1);
    strut(b, m, hip, foot, 0.03, S.tube);
    const shock = out.clone().multiplyScalar(0.28).setY(baseY + 0.42);
    strut(b, m, shock, foot.clone().lerp(hip, 0.4), 0.034, S.tanDeep);
    strut(b, m, shock.clone().lerp(foot.clone().lerp(hip, 0.4), 0.55), foot.clone().lerp(hip, 0.4), 0.044, S.metal);
    const side = p(-out.z, 0, out.x);
    for (const k of [-1, 1]) strut(b, m, hip.clone().addScaledVector(side, k * 0.18), foot.clone().lerp(hip, 0.25), 0.014, S.tube);
    // The crushable footpad: a shallow round dish, a little dusty.
    b.place(cylinder(16, 0.8), S.tan, v(foot.x, 0.05, foot.z), [0, 0, 0], [0.17, 0.08, 0.17], m);
    b.place(cylinder(16), S.wiped, v(foot.x, 0.095, foot.z), [0, 0, 0], [0.12, 0.014, 0.12], m);
    b.place(torus(0.2), S.tanDeep, v(foot.x, 0.02, foot.z), [Math.PI / 2, 0, 0], [0.17, 0.17, 0.06], m);
    shapes.push({ kind: "circle", x: foot.x, z: foot.z, radius: 0.2, height: 0.16 });
    // A small rocket nozzle under each corner, for the soft landing.
    const c = corners[i]!;
    b.place(cylinder(10, 0.5, true), S.dark, v(c.x * 0.82, baseY - 0.11, c.z * 0.82), [Math.PI, 0, 0], [0.05, 0.1, 0.05], m);
  }

  // Two boxy compartments wrapped in white paint and mirror tiles, now gone tan.
  const boxes: [number, string][] = [[Math.PI * 0.62, S.tan], [Math.PI * 1.38, S.tanDeep]];
  for (const [a, color] of boxes) {
    const x = Math.sin(a) * 0.36;
    const z = Math.cos(a) * 0.36;
    b.place(box(0.02), color, v(x, baseY + 0.16, z), [0, a, 0], [0.32, 0.24, 0.26], m);
    b.place(box(0.01), S.wiped, v(x * 1.02, baseY + 0.3, z * 1.02), [0, a, 0], [0.3, 0.03, 0.24], m);
    // A grid of little square tiles on the side facing out.
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const off = p((c - 1) * 0.09, baseY + 0.1 + r * 0.09, 0.132).applyAxisAngle(p(0, 1, 0), a);
        b.place(box(0.003), r === 0 && c === 1 ? S.wiped : S.mirror, v(x + off.x, off.y, z + off.z), [0, a, 0], [0.07, 0.07, 0.006], m);
      }
    }
  }

  // The mast: a flat square antenna one way and a solar panel the other.
  b.place(cylinder(8), S.metal, v(0, apex.y + 0.18, 0), [0, 0, 0], [0.028, 0.4, 0.028], m);
  b.place(sphere("low"), S.tanDeep, v(0, apex.y, 0), [0, 0, 0], 0.05, m);
  const top = apex.y + 0.36;
  // Planar antenna, tipped toward Earth.
  b.place(box(0.01), S.white, v(-0.2, top + 0.02, 0.02), [0, 0, 0.75], [0.5, 0.025, 0.46], m);
  b.place(box(0.004), S.tan, v(-0.205, top + 0.035, 0.02), [0, 0, 0.75], [0.44, 0.012, 0.4], m);
  for (let i = -1; i <= 1; i += 1) b.place(box(0.002), S.tanDeep, v(-0.2, top + 0.04, 0.02 + i * 0.12), [0, 0, 0.75], [0.46, 0.008, 0.012], m);
  // Solar panel, tipped toward the Sun, with its cells drawn in.
  b.place(box(0.01), S.panel, v(0.24, top - 0.02, -0.02), [0, 0, -0.6], [0.52, 0.025, 0.42], m);
  for (let i = -2; i <= 2; i += 1) b.place(box(0.002), S.panelLine, v(0.24, top - 0.004, -0.02 + i * 0.08), [0, 0, -0.6], [0.5, 0.006, 0.008], m);
  b.place(box(0.002), S.panelLine, v(0.24, top - 0.004, -0.02), [0, 0, -0.6], [0.008, 0.006, 0.4], m);
  // Two thin whip antennas on booms.
  for (const k of [-1, 1]) {
    const from = p(k * 0.12, apex.y - 0.25, -0.12);
    const to = p(k * 0.52, apex.y + 0.12, -0.36);
    strut(b, m, from, to, 0.01, S.metal);
    b.place(cone(6), S.white, v(to.x, to.y + 0.05, to.z), [0, 0, 0], [0.03, 0.1, 0.03], m);
  }

  // ---- The parts the astronauts took home ----
  // The TV camera: a tall can on the frame, with a mirror in a hood on top.
  const camAngle = Math.PI * 1.85;
  const cx = Math.sin(camAngle) * 0.5;
  const cz = Math.cos(camAngle) * 0.5;
  parts.place(cylinder(14), S.tan, v(cx, baseY + 0.3, cz), [0, 0, 0], [0.085, 0.44, 0.085], m);
  parts.place(cylinder(14), S.wiped, v(cx, baseY + 0.16, cz), [0, 0, 0], [0.088, 0.05, 0.088], m);
  parts.place(cylinder(14), S.tanDeep, v(cx, baseY + 0.54, cz), [0, 0, 0], [0.095, 0.04, 0.095], m);
  parts.place(box(0.01), S.tanDeep, v(cx, baseY + 0.63, cz), [0, camAngle, 0], [0.16, 0.12, 0.16], m);
  parts.place(box(0.004), S.mirror, v(cx + Math.sin(camAngle) * 0.06, baseY + 0.63, cz + Math.cos(camAngle) * 0.06), [0.75, camAngle, 0], [0.12, 0.012, 0.12], m);
  parts.place(cylinder(10), S.dark, v(cx, baseY + 0.71, cz), [0, 0, 0], [0.03, 0.03, 0.03], m);
  // A loop of TV cable and a short piece of aluminum tube, also cut free.
  parts.place(torus(0.12), S.dark, v(cx * 0.7, baseY + 0.12, cz * 0.7), [Math.PI / 2, 0, 0.4], [0.07, 0.07, 0.07], m);
  strut(parts, m, corners[2]!.clone().lerp(apex, 0.12), corners[2]!.clone().lerp(corners[1]!, 0.32), 0.02, S.wiped);

  // The scoop arm: a folding arm of crossed bars reaching out over the trenches,
  // with the scoop resting at its end. The arm stays; the scoop goes home.
  const shoulder = p(0, baseY + 0.12, 0.42);
  const reach = p(0, 0.24, 1.38);
  const zig = 4;
  for (let i = 0; i < zig; i += 1) {
    const t0 = i / zig;
    const t1 = (i + 1) / zig;
    const a = shoulder.clone().lerp(reach, t0);
    const c = shoulder.clone().lerp(reach, t1);
    strut(b, m, a.clone().setY(a.y + 0.05), c.clone().setY(c.y - 0.05), 0.012, S.metal);
    strut(b, m, a.clone().setY(a.y - 0.05), c.clone().setY(c.y + 0.05), 0.012, S.metal);
  }
  b.place(box(0.01), S.tanDeep, v(0, shoulder.y, shoulder.z - 0.02), [0, 0, 0], [0.12, 0.1, 0.08], m);
  const scoop = p(0, 0.11, 1.48);
  parts.place(box(0.01), S.tan, v(scoop.x, scoop.y, scoop.z), [0.25, 0, 0], [0.14, 0.11, 0.2], m);
  parts.place(box(0.004), S.metal, v(scoop.x, scoop.y + 0.07, scoop.z - 0.02), [0.05, 0, 0], [0.15, 0.015, 0.16], m);
  for (const x of [-0.045, 0, 0.045]) parts.place(cone(4), S.metal, v(x, scoop.y - 0.05, scoop.z + 0.1), [Math.PI / 2 + 0.25, 0, 0], [0.016, 0.04, 0.016], m);
  parts.place(cylinder(8), S.dark, v(0, scoop.y + 0.06, scoop.z - 0.12), [0, 0, Math.PI / 2], [0.025, 0.16, 0.025], m);

  return { camera: p(cx, baseY + 0.6, cz), scoop, shapes };
}

/**
 * The four little trenches Surveyor dug, side by side in front of it: dark
 * cuts in the dust with soft piles along their edges. One site per trench, so
 * each sits on the slope where it is.
 */
export function buildTrench(b: Batcher, s: Site, length: number, seed: number): void {
  const m = s.matrix;
  // A shallow groove: darker dust down in the cut, darkest where the scoop stopped, and a
  // faint pale lip where the dug dust was pushed out. Flat to the ground, so it reads as a dent.
  b.place(cylinder(10), "#9A958D", v(0, 0.006, 0), [0, 0, 0], [0.11, 0.006, length * 0.55], m);
  b.place(cylinder(10), "#66635E", v(0, 0.01, 0), [0, 0, 0], [0.065, 0.006, length * 0.5], m);
  b.place(cylinder(8), "#55524E", v(0, 0.013, length * 0.36), [0, 0, 0], [0.05, 0.006, 0.08 + (seed % 2) * 0.02], m);
}

/** Where Surveyor's footpads touched down as it bounced: three round dents, a shade darker. */
export function buildPadMarks(b: Batcher, s: Site): void {
  const m = s.matrix;
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const x = Math.sin(a) * 1.0;
    const z = Math.cos(a) * 1.0;
    b.place(cylinder(16), "#7B7873", v(x, 0.012, z), [0, 0, 0], [0.17, 0.01, 0.17], m);
    b.place(torus(0.24), "#B3AEA6", v(x, 0.02, z), [Math.PI / 2, 0, 0], [0.18, 0.18, 0.05], m);
  }
}

/**
 * Dad's landing table: a wooden table with the crater map painted on its top
 * and a toy lander hanging over it from a little crane. Returns its colliders
 * and where the toy lander hangs, so the activity can move it.
 */
export function buildLandingTable(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const h = 0.78;
  b.place(box(0.02), S.wood, v(0, h, 0), [0, 0, 0], [1.3, 0.07, 0.9], m);
  for (const x of [-0.58, 0.58]) for (const z of [-0.38, 0.38]) b.place(box(0.01), S.woodDark, v(x, h / 2, z), [0, 0, 0], [0.07, h, 0.07], m);
  b.place(box(0.01), S.woodDark, v(0, 0.2, 0), [0, 0, 0], [1.16, 0.04, 0.05], m);
  // The map board: grey dust with Dad's crater pattern painted on it.
  b.place(box(0.01), "#B5B0A7", v(0, h + 0.045, 0), [0, 0, 0], [1.18, 0.02, 0.8], m);
  const crater = (x: number, z: number, r: number, color = "#8D8983"): void => {
    b.place(cylinder(20), color, v(x, h + 0.057, z), [0, 0, 0], [r, 0.006, r], m);
    b.place(torus(0.18), "#D2CDC4", v(x, h + 0.06, z), [Math.PI / 2, 0, 0], [r, r, 0.02], m);
  };
  // The Snowman: a big round body with a smaller head, and two little craters for arms.
  crater(0.12, 0.08, 0.2);
  crater(0.12, -0.2, 0.12);
  crater(-0.14, 0.1, 0.05);
  crater(0.38, 0.06, 0.05);
  for (const [x, z, r] of [[-0.44, -0.24, 0.08], [-0.36, 0.28, 0.06], [0.44, -0.28, 0.07], [-0.12, -0.3, 0.04], [0.42, 0.3, 0.05]] as const) crater(x, z, r, "#9A968F");
  // A tiny tan robot pin in the big crater.
  b.place(cone(3), S.tan, v(0.18, h + 0.09, 0.12), [0, 0, 0], [0.025, 0.06, 0.025], m);
  // The crane: a post with an arm and a string down to where the toy lander hangs.
  b.place(cylinder(8), S.woodDark, v(-0.6, h + 0.5, -0.4), [0, 0, 0], [0.03, 1.0, 0.03], m);
  b.place(box(0.01), S.woodDark, v(-0.25, h + 0.98, -0.4), [0, 0, 0], [0.72, 0.04, 0.04], m);
  b.place(cylinder(4), S.ink, v(0.08, h + 0.82, -0.4), [0, 0, 0], [0.004, 0.3, 0.004], m);
  // A paper sign: "Landing practice".
  b.place(box(0.004), S.paper, v(0, h + 0.15, 0.46), [-0.25, 0, 0], [0.42, 0.14, 0.01], m);
  for (let i = 0; i < 2; i += 1) b.place(box(0.002), S.ink, v(0, h + 0.17 - i * 0.04, 0.468), [-0.25, 0, 0], [0.32 - i * 0.08, 0.014, 0.004], m);
  return [{ kind: "box", x: 0, z: 0, halfWidth: 0.66, halfDepth: 0.46, height: h + 0.1 }];
}

/** Dad's toy lander that hangs over the landing table: a gold box on four legs. */
export function createToyLander(toon: ToonLibrary): Group {
  const group = new Group();
  const gold = toon.toon({ color: S.gold, objectSpace: true, paint: 0.08 });
  const silver = toon.toon({ color: "#C4C1BA", objectSpace: true, paint: 0.06 });
  const body = new Mesh(cylinder(8), gold);
  body.scale.set(0.1, 0.07, 0.1);
  body.position.y = 0.09;
  const top = new Mesh(box(0.01), silver);
  top.scale.set(0.12, 0.06, 0.1);
  top.position.y = 0.15;
  group.add(body, top);
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const leg = new Mesh(cylinder(4), silver);
    leg.scale.set(0.006, 0.1, 0.006);
    leg.position.set(Math.sin(a) * 0.1, 0.04, Math.cos(a) * 0.1);
    leg.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    const pad = new Mesh(cylinder(8), silver);
    pad.scale.set(0.02, 0.006, 0.02);
    pad.position.set(Math.sin(a) * 0.13, 0.0, Math.cos(a) * 0.13);
    group.add(leg, pad);
  }
  group.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true;
  });
  return group;
}

export interface SampleBox {
  shapes: Shape[];
  /** The lid, which closes when the bag goes in. Hinged along its back edge. */
  lid: Group;
}

/**
 * The sample box by Intrepid's ladder: a metal case with ribs and latches,
 * its lid open and waiting.
 */
export function buildSampleBox(b: Batcher, s: Site, toon: ToonLibrary): SampleBox {
  const m = s.matrix;
  b.place(box(0.02), "#B9B6AF", v(0, 0.17, 0), [0, 0, 0], [0.52, 0.32, 0.36], m);
  for (const x of [-0.18, 0, 0.18]) b.place(box(0.004), "#9C9993", v(x, 0.17, 0.182), [0, 0, 0], [0.03, 0.3, 0.01], m);
  b.place(box(0.006), "#2E2A2A", v(0, 0.33, 0), [0, 0, 0], [0.5, 0.012, 0.34], m);
  for (const x of [-0.16, 0.16]) b.place(box(0.004), "#6E6A66", v(x, 0.3, 0.185), [0, 0, 0], [0.05, 0.05, 0.012], m);
  // A soft lining inside, for the parts.
  b.place(box(0.004), "#3D4A63", v(0, 0.3, 0), [0, 0, 0], [0.46, 0.02, 0.3], m);
  const lid = new Group();
  const metal = toon.toon({ color: "#C4C1BA", objectSpace: true, paint: 0.08 });
  const lidMesh = new Mesh(box(0.02), metal);
  lidMesh.scale.set(0.53, 0.05, 0.37);
  lidMesh.position.set(0, 0.025, 0.185);
  const handle = new Mesh(box(0.01), toon.toon({ color: "#6E6A66", objectSpace: true, paint: 0.05 }));
  handle.scale.set(0.16, 0.03, 0.03);
  handle.position.set(0, 0.06, 0.2);
  lid.add(lidMesh, handle);
  lid.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true;
  });
  // The hinge sits on the back edge, at the top of the box.
  const hinge = new Vector3(0, 0.34, -0.18).applyMatrix4(m);
  lid.position.copy(hinge);
  lid.quaternion.setFromRotationMatrix(new Matrix4().extractRotation(m));
  return { shapes: [{ kind: "box", x: 0, z: 0, halfWidth: 0.28, halfDepth: 0.2, height: 0.36 }], lid };
}
