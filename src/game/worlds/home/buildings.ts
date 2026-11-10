import { Euler, Quaternion, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { Shape } from "../../world/colliders";
import { dish, gable } from "../shapes";
import type { Site } from "./layout";

/** The Home palette, from Game Bible section 9, plus a few in-between tones. */
export const C = {
  paper: "#F4ECDD",
  amber: "#F2A541",
  indigo: "#2E2A4F",
  clay: "#C0573E",
  clayDark: "#9C4433",
  sage: "#7FA37A",
  ink: "#2B2622",
  houseWall: "#E6CF9F",
  trim: "#F4ECDD",
  wood: "#A8744A",
  woodDark: "#7A4A2E",
  woodLight: "#C79C6C",
  stone: "#8C8478",
  stoneLight: "#A59C8E",
  windowWarm: "#FFC973",
  windowDusk: "#9C8BB6",
  shedWall: "#B27D51",
  shedBoard: "#946440",
  shedRoof: "#5F7F6C",
  shedRoofDark: "#4E6B5A",
  metal: "#B9B4AA",
  metalDark: "#6E6A66",
  cream: "#EDE4D3",
  mailbox: "#5C7393",
  brass: "#D9A441",
};

const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

/** Adds a window: a warm pane in a cream frame, with a sill. Faces local +Z unless rotated. */
function windowAt(b: Batcher, s: Site, x: number, y: number, z: number, rotY: number, w = 0.7, h = 0.75, flowers = false): void {
  const m = s.matrix;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const at = (dx: number, dy: number, dz: number): [number, number, number] => [x + dx * cos + dz * sin, y + dy, z - dx * sin + dz * cos];
  b.place(box(0.02), C.windowWarm, at(0, 0, 0.01), [0, rotY, 0], [w, h, 0.05], m, "glow");
  b.place(box(0.01), C.trim, at(0, 0, 0.04), [0, rotY, 0], [0.06, h, 0.04], m);
  b.place(box(0.01), C.trim, at(0, 0, 0.04), [0, rotY, 0], [w, 0.06, 0.04], m);
  b.place(box(0.02), C.trim, at(0, h / 2 + 0.04, 0.04), [0, rotY, 0], [w + 0.16, 0.08, 0.08], m);
  b.place(box(0.02), C.trim, at(0, -h / 2 - 0.04, 0.07), [0, rotY, 0], [w + 0.2, 0.08, 0.16], m);
  // Shutters.
  for (const side of [-1, 1]) b.place(box(0.02), C.clayDark, at(side * (w / 2 + 0.16), 0, 0.04), [0, rotY, 0], [0.24, h + 0.06, 0.05], m);
  if (flowers) {
    b.place(box(0.02), C.woodDark, at(0, -h / 2 - 0.2, 0.16), [0, rotY, 0], [w + 0.1, 0.2, 0.2], m);
    for (let i = 0; i < 5; i += 1) {
      const fx = -w / 2 + 0.08 + (i * (w - 0.16)) / 4;
      b.place(sphere("low"), i % 2 ? "#E58B6B" : "#F2C14E", at(fx, -h / 2 - 0.05, 0.17), [0, 0, 0], 0.07, m);
      b.place(sphere("low"), "#6E9470", at(fx + 0.05, -h / 2 - 0.1, 0.2), [0, 0, 0], 0.06, m);
    }
  }
}

export interface HouseResult {
  shapes: Shape[];
  porchLight: Vector3;
}

/** Mom's house, with a porch facing the path. */
export function buildHouse(b: Batcher, s: Site): HouseResult {
  const m = s.matrix;
  const W = 4.0;
  const D = 3.2;
  const wallTop = 0.35 + 2.2;

  b.place(box(0.05), C.stone, v(0, -0.23, 0), [0, 0, 0], [W + 0.4, 1.2, D + 0.4], m);
  b.place(box(0.04), C.houseWall, v(0, 0.35 + 1.1, 0), [0, 0, 0], [W, 2.2, D], m);
  // Corner boards.
  for (const x of [-1, 1]) for (const z of [-1, 1]) b.place(box(0.01), C.trim, v((x * W) / 2, 1.45, (z * D) / 2), [0, 0, 0], [0.14, 2.2, 0.14], m);

  // Gable roof, ridge running front to back, so the front shows a triangle.
  const H = 1.6;
  b.place(gable(W, H, D), C.houseWall, v(0, wallTop, 0), [0, 0, 0], 1, m);
  const over = 0.38;
  const span = W / 2 + over;
  const angle = Math.atan2(H, W / 2);
  const length = span / Math.cos(angle);
  for (const side of [-1, 1]) {
    const cx = (side * span) / 2;
    const cy = wallTop + H - (span / 2) * Math.tan(angle) + 0.1;
    b.place(box(0.04), C.clay, v(cx, cy, 0), [0, 0, -side * angle], [length + 0.05, 0.16, D + 0.7], m);
    // Shingle rows.
    for (let i = 1; i < 5; i += 1) {
      const t = i / 5;
      const px = side * span * t;
      const py = wallTop + H - span * t * Math.tan(angle) + 0.19;
      b.place(box(0.01), C.clayDark, v(px, py, 0), [0, 0, -side * angle], [0.04, 0.03, D + 0.72], m);
    }
  }
  b.place(box(0.03), C.clayDark, v(0, wallTop + H + 0.16, 0), [0, 0, 0], [0.2, 0.12, D + 0.74], m);
  // Chimney.
  b.place(box(0.04), C.stoneLight, v(1.05, wallTop + 1.3, -0.7), [0, 0, 0], [0.5, 1.6, 0.5], m);
  b.place(box(0.03), C.stone, v(1.05, wallTop + 2.12, -0.7), [0, 0, 0], [0.62, 0.14, 0.62], m);
  // Round attic window.
  b.place(cylinder(16), C.windowWarm, v(0, wallTop + 0.6, D / 2 + 0.02), [Math.PI / 2, 0, 0], [0.24, 0.06, 0.24], m, "glow");
  b.place(torus(0.2), C.trim, v(0, wallTop + 0.6, D / 2 + 0.05), [0, 0, 0], 0.26, m);

  // Front: door and a window. Sides and back: windows.
  const front = D / 2 + 0.01;
  b.place(box(0.03), "#6B3F2A", v(-0.6, 0.35 + 0.75, front), [0, 0, 0], [0.82, 1.5, 0.08], m);
  b.place(box(0.01), C.windowWarm, v(-0.6, 0.35 + 1.25, front + 0.04), [0, 0, 0], [0.4, 0.26, 0.02], m, "glow");
  b.place(sphere("low"), C.brass, v(-0.3, 0.35 + 0.7, front + 0.07), [0, 0, 0], 0.05, m);
  b.place(box(0.02), C.trim, v(-0.6, 0.35 + 1.55, front + 0.03), [0, 0, 0], [1.0, 0.1, 0.1], m);
  windowAt(b, s, 1.0, 1.55, front, 0, 0.8, 0.8, true);
  windowAt(b, s, W / 2 + 0.01, 1.55, -0.5, Math.PI / 2, 0.75, 0.75, true);
  windowAt(b, s, -W / 2 - 0.01, 1.55, 0.3, -Math.PI / 2, 0.75, 0.75, true);
  windowAt(b, s, 0.6, 1.55, -D / 2 - 0.01, Math.PI, 0.75, 0.75);

  // Porch.
  const pz = D / 2 + 0.75;
  b.place(box(0.03), C.woodLight, v(0, -0.16, pz), [0, 0, 0], [W + 0.2, 1.0, 1.5], m);
  for (let i = 0; i < 9; i += 1) b.place(box(0.004), C.wood, v(-W / 2 + 0.25 + i * 0.47, 0.342, pz), [0, 0, 0], [0.025, 0.006, 1.45], m);
  for (const x of [-1.95, 1.95]) {
    b.place(box(0.02), C.trim, v(x, 0.34 + 1.05, pz + 0.62), [0, 0, 0], [0.14, 2.1, 0.14], m);
  }
  b.place(box(0.03), C.clay, v(0, 2.5, pz + 0.05), [0.2, 0, 0], [W + 0.5, 0.12, 1.85], m);
  // Railing on the sides of the porch.
  for (const x of [-1, 1]) {
    b.place(box(0.01), C.trim, v(x * 2.02, 0.95, pz + 0.05), [0, 0, 0], [0.08, 0.06, 1.2], m);
    for (let i = 0; i < 4; i += 1) b.place(box(0.01), C.trim, v(x * 2.02, 0.65, pz - 0.45 + i * 0.3), [0, 0, 0], [0.05, 0.6, 0.05], m);
  }
  // Porch bench and doormat.
  b.place(box(0.02), C.wood, v(1.0, 0.62, pz - 0.35), [0, 0, 0], [1.1, 0.08, 0.38], m);
  b.place(box(0.02), C.wood, v(1.0, 0.85, pz - 0.53), [0, 0, 0], [1.1, 0.36, 0.06], m);
  for (const x of [0.55, 1.45]) b.place(box(0.01), C.woodDark, v(x, 0.48, pz - 0.35), [0, 0, 0], [0.06, 0.28, 0.32], m);
  b.place(box(0.02), C.clayDark, v(-0.6, 0.35, pz - 0.35), [0, 0, 0], [0.8, 0.02, 0.5], m);
  // Porch lamp by the door.
  b.place(box(0.02), C.ink, v(-1.25, 1.9, front + 0.06), [0, 0, 0], [0.16, 0.26, 0.12], m);
  b.place(sphere("low"), "#FFE2A6", v(-1.25, 1.86, front + 0.14), [0, 0, 0], 0.075, m, "glow");
  // Potted plants on the steps.
  for (const x of [-1.7, 1.7]) {
    b.place(cylinder(10, 1.2), C.clay, v(x, 0.5, pz + 0.55), [0, 0, 0], [0.16, 0.3, 0.16], m);
    b.place(sphere("low"), "#6E9470", v(x, 0.74, pz + 0.55), [0, 0, 0], 0.22, m);
  }

  return {
    shapes: [
      { kind: "box", x: 0, z: 0, halfWidth: W / 2 + 0.2, halfDepth: D / 2 + 0.2, height: 4.2 },
      { kind: "box", x: 0, z: pz, halfWidth: W / 2 + 0.1, halfDepth: 0.75, height: 0.34 },
      { kind: "circle", x: -1.95, z: pz + 0.62, radius: 0.1, height: 2.4 },
      { kind: "circle", x: 1.95, z: pz + 0.62, radius: 0.1, height: 2.4 },
      { kind: "box", x: -2.02, z: pz + 0.05, halfWidth: 0.06, halfDepth: 0.6, height: 1.0 },
      { kind: "box", x: 2.02, z: pz + 0.05, halfWidth: 0.06, halfDepth: 0.6, height: 1.0 },
      { kind: "box", x: 1.0, z: pz - 0.4, halfWidth: 0.55, halfDepth: 0.22, height: 1.0 },
      { kind: "circle", x: -1.7, z: pz + 0.55, radius: 0.2, height: 0.9 },
      { kind: "circle", x: 1.7, z: pz + 0.55, radius: 0.2, height: 0.9 },
    ],
    porchLight: new Vector3(-1.25, 1.86, front + 0.4).applyMatrix4(m),
  };
}

/** The mailbox at the end of the path, a nod to the delivery games we love. */
export function buildMailbox(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(box(0.02), C.woodDark, v(0, 0.55, 0), [0, 0, 0], [0.12, 1.1, 0.12], m);
  b.place(box(0.02), C.wood, v(0, 1.08, 0), [0, 0, 0], [0.3, 0.06, 0.5], m);
  b.place(box(0.06), C.mailbox, v(0, 1.24, 0), [0, 0, 0], [0.34, 0.28, 0.56], m);
  b.place(cylinder(14), C.mailbox, v(0, 1.38, 0), [Math.PI / 2, 0, 0], [0.17, 0.56, 0.17], m);
  b.place(cylinder(14), "#4B607C", v(0, 1.3, 0.285), [Math.PI / 2, 0, 0], [0.165, 0.02, 0.165], m);
  b.place(box(0.01), "#4B607C", v(0, 1.22, 0.288), [0, 0, 0], [0.33, 0.18, 0.02], m);
  // The little red flag, up: there is mail.
  b.place(box(0.005), C.metalDark, v(0.19, 1.45, -0.1), [0, 0, 0], [0.03, 0.4, 0.03], m);
  b.place(box(0.01), C.clay, v(0.2, 1.6, -0.0), [0, 0, 0], [0.02, 0.14, 0.2], m);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.3, height: 1.6 }];
}

/** Dad's backyard dish antenna, tipped toward the sky. */
export function buildDish(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(16), C.stone, v(0, 0.12, 0), [0, 0, 0], [0.8, 0.24, 0.8], m);
  b.place(cylinder(12), C.metalDark, v(0, 0.75, 0), [0, 0, 0], [0.09, 1.2, 0.09], m);
  b.place(box(0.03), C.metalDark, v(0, 1.4, 0), [0, 0, 0], [0.34, 0.24, 0.3], m);
  const tilt = -0.75;
  const center = new Vector3(0, 1.62, 0.12);
  b.place(dish(1.1, 0.32, 0.06), C.cream, [center.x, center.y, center.z], [tilt, 0, 0], 1, m);
  // Ribs on the back of the dish.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rib = new Vector3(Math.cos(a) * 0.55, -0.02, Math.sin(a) * 0.55).applyAxisAngle(new Vector3(1, 0, 0), tilt).add(center);
    b.place(box(0.005), "#CFC4AE", [rib.x, rib.y, rib.z], [tilt, -a, 0], [1.05, 0.03, 0.03], m);
  }
  // Feed horn on three struts.
  const axis = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(1, 0, 0), tilt);
  const horn = center.clone().addScaledVector(axis, 0.9);
  b.place(cylinder(10, 0.6), C.metalDark, [horn.x, horn.y, horn.z], [tilt, 0, 0], [0.09, 0.2, 0.09], m);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = new Vector3(Math.cos(a) * 0.85, 0.2, Math.sin(a) * 0.85).applyAxisAngle(new Vector3(1, 0, 0), tilt).add(center);
    const mid = foot.clone().add(horn).multiplyScalar(0.5);
    const dir = horn.clone().sub(foot);
    const len = dir.length();
    dir.normalize();
    // Orient a unit cylinder (along Y) to the strut.
    const q = new Vector3(0, 1, 0);
    const axisR = q.clone().cross(dir).normalize();
    const angle = Math.acos(q.dot(dir));
    const helperRot = rotationFromAxisAngle(axisR, angle);
    b.place(cylinder(6), C.metal, [mid.x, mid.y, mid.z], helperRot, [0.018, len, 0.018], m);
  }
  return [{ kind: "circle", x: 0, z: 0, radius: 0.85, height: 2.4 }];
}

/** Euler XYZ angles for a rotation of `angle` around `axis`. */
function rotationFromAxisAngle(axis: Vector3, angle: number): [number, number, number] {
  const e = new Euler().setFromQuaternion(new Quaternion().setFromAxisAngle(axis, angle), "XYZ");
  return [e.x, e.y, e.z];
}

/** The telescope on the hill, with a little stool beside it. */
export function buildTelescope(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    b.place(cylinder(6), C.woodDark, v(Math.cos(a) * 0.28, 0.5, Math.sin(a) * 0.28), [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], [0.025, 1.05, 0.025], m);
  }
  b.place(sphere("low"), C.metalDark, v(0, 1.02, 0), [0, 0, 0], 0.07, m);
  b.place(cylinder(16, 0.8), C.brass, v(0, 1.18, 0.05), [-0.9, 0, 0], [0.11, 0.95, 0.11], m);
  b.place(cylinder(16), C.ink, v(0, 1.52, 0.4), [-0.9, 0, 0], [0.12, 0.08, 0.12], m);
  b.place(cylinder(12), C.metalDark, v(0, 0.86, -0.32), [-0.9, 0, 0], [0.06, 0.12, 0.06], m);
  // Stool.
  b.place(cylinder(12), C.wood, v(0.75, 0.45, -0.25), [0, 0, 0], [0.2, 0.06, 0.2], m);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    b.place(cylinder(6), C.woodDark, v(0.75 + Math.cos(a) * 0.12, 0.21, -0.25 + Math.sin(a) * 0.12), [0, 0, 0], [0.02, 0.42, 0.02], m);
  }
  return [
    { kind: "circle", x: 0, z: 0, radius: 0.35, height: 1.6 },
    { kind: "circle", x: 0.75, z: -0.25, radius: 0.2, height: 0.48 },
  ];
}

/** A lamp post along the path. Warm glass, no real light, so it costs nothing. */
export function buildLampPost(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(8), C.ink, v(0, 0.06, 0), [0, 0, 0], [0.14, 0.12, 0.14], m);
  b.place(cylinder(8), C.ink, v(0, 0.85, 0), [0, 0, 0], [0.04, 1.6, 0.04], m);
  b.place(box(0.02), C.ink, v(0, 1.72, 0), [0, 0, 0], [0.24, 0.05, 0.24], m);
  b.place(box(0.02), "#FFE2A6", v(0, 1.86, 0), [0, 0, 0], [0.18, 0.24, 0.18], m, "glow");
  b.place(cone(4), C.ink, v(0, 2.06, 0), [0, Math.PI / 4, 0], [0.2, 0.16, 0.2], m);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.12, height: 2.1 }];
}
