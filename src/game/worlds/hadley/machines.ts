import { Group, Matrix4, type Mesh, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import type { Site } from "../kit/little-world";
import { dish } from "../shapes";
import { strut } from "../tranquility/machines";

/**
 * Dad's models for the Hadley-Apennine diorama: the Moon buggy (the Apollo 15
 * Lunar Roving Vehicle), his wheel test tray, the stake at the rille overlook
 * and the chalk marks where the buggy is parked. Squeezed to kid size (model,
 * not to scale).
 *
 * The buggy is the one machine in Dad's worlds that moves, so it is built as
 * its own little group of merged meshes: a body and four wheels. Each wheel
 * spins, and each sits in a steering knuckle that can turn.
 *
 * Frame: +Y up, +Z toward the front, +X toward the driver's side (the left
 * seat, where Dave Scott drove).
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

export const LC = {
  frame: "#C4C1BA",
  frameDark: "#8E8B86",
  white: "#EDEAE2",
  fender: "#B9B5AC",
  seat: "#8FA9C4",
  seatDark: "#6F89A6",
  console: "#34343A",
  dial: "#F2E6CF",
  mirror: "#A9C6D8",
  gold: "#D2A445",
  tire: "#8C9296",
  tireDark: "#5E6468",
  chevron: "#E2E4E2",
  hub: "#4A4440",
  bag: "#D9CDB4",
  chalk: "#E8E2D2",
  wood: "#8A5A3A",
  woodDark: "#5E3B26",
  paper: "#F4ECDD",
  ink: "#2B2622",
  dust: "#9C978F",
};

/** Wheel radius and width, and where the wheels sit. */
export const WHEEL = { radius: 0.27, width: 0.16, track: 0.62, axle: 0.78 };
/** Front axle to rear axle. */
export const WHEELBASE = WHEEL.axle * 2;

export interface BuggyWheel {
  /** Turns about Y to steer. */
  knuckle: Group;
  /** Turns about X to roll. */
  spin: Group;
  front: boolean;
  /** +1 driver's side, -1 the other. */
  side: number;
}

export interface Buggy {
  /** Placed by its matrix each frame (matrixAutoUpdate is off). */
  root: Group;
  wheels: BuggyWheel[];
  /** The little umbrella antenna, which turns to face Earth when parked. */
  antenna: Group;
  /** Where a rider sits, in the buggy's frame: the kid's feet origin on the driver's seat. */
  seat: Vector3;
  /** Where to step out, in the buggy's frame. */
  door: Vector3;
  /** Colliders in the buggy's frame, while it is parked. */
  shapes: Shape[];
  meshes: Mesh[];
}

function wheel(toon: ToonLibrary, castShadow: boolean): Group {
  const b = new Batcher();
  const R = WHEEL.radius;
  const W = WHEEL.width;
  const axis: [number, number, number] = [0, 0, Math.PI / 2];
  // The woven wire tread, its darker inside showing through, and a hub.
  b.place(cylinder(20), LC.tire, v(0, 0, 0), axis, [R, W, R]);
  b.place(cylinder(20), LC.tireDark, v(0, 0, 0), axis, [R * 0.84, W + 0.01, R * 0.84]);
  b.place(cylinder(10), LC.hub, v(0, 0, 0), axis, [0.1, W + 0.03, 0.1]);
  b.place(cylinder(10), LC.frame, v(0, 0, 0), axis, [0.055, W + 0.05, 0.055]);
  // The wire weave reads as a crisscross of thin rings on each shoulder.
  for (const x of [-W * 0.42, W * 0.42]) b.place(torus(0.05), LC.tireDark, v(x, 0, 0), [0, Math.PI / 2, 0], R * 1.0);
  // Titanium chevrons round the tread, each a little V, for grip.
  const N = 16;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    const y = Math.cos(a) * (R + 0.006);
    const z = Math.sin(a) * (R + 0.006);
    for (const k of [-1, 1]) b.place(box(0.004), LC.chevron, v(k * 0.035, y, z), [a, k * 0.5, 0], [0.075, 0.014, 0.028]);
  }
  const g = new Group();
  for (const mesh of b.build({ solid: toon.toon({ vertexColors: true, paint: 0.12 }) }, { castShadow, receiveShadow: true })) g.add(mesh);
  return g;
}

/** Dad's Moon buggy: an open aluminum frame, two seats, a console, wire-mesh wheels and an umbrella antenna. */
export function buildBuggy(toon: ToonLibrary, castShadow: boolean): Buggy {
  const b = new Batcher();
  const root = new Group();
  root.name = "buggy";
  root.matrixAutoUpdate = false;
  const F = 0.36;
  const { track, axle, radius } = WHEEL;

  // The chassis: a flat floor between two side rails, in three parts like the real one.
  b.place(box(0.02), LC.frame, v(0, F, 0), [0, 0, 0], [0.86, 0.04, 1.86]);
  for (const x of [-0.45, 0.45]) b.place(box(0.01), LC.frameDark, v(x, F + 0.01, 0), [0, 0, 0], [0.05, 0.07, 1.96]);
  for (const z of [-0.36, 0.36]) b.place(box(0.01), LC.frameDark, v(0, F - 0.03, z), [0, 0, 0], [0.92, 0.03, 0.04]);
  // Under-frame struts down to each wheel's suspension arm.
  for (const side of [-1, 1]) {
    for (const z of [-axle, axle]) {
      strut(b, new Matrix4(), new Vector3(side * 0.42, F - 0.02, z - 0.16), new Vector3(side * (track - 0.1), radius, z), 0.02, LC.frameDark);
      strut(b, new Matrix4(), new Vector3(side * 0.42, F - 0.02, z + 0.16), new Vector3(side * (track - 0.1), radius, z), 0.02, LC.frameDark);
    }
  }

  // The front: batteries and electronics under white dust covers, with little mirror radiators on top.
  b.place(box(0.03), LC.white, v(0, F + 0.08, 0.8), [0, 0, 0], [0.78, 0.14, 0.34]);
  for (const x of [-0.2, 0.2]) b.place(box(0.006), LC.mirror, v(x, F + 0.155, 0.8), [0, 0, 0], [0.24, 0.012, 0.2]);
  b.place(box(0.006), LC.gold, v(0, F + 0.05, 0.975), [0, 0, 0], [0.74, 0.07, 0.012]);

  // Two folding seats of blue webbing on aluminum tubes, side by side.
  for (const side of [-1, 1]) {
    const x = side * 0.22;
    b.place(box(0.01), LC.frame, v(x, F + 0.12, -0.02), [0, 0, 0], [0.32, 0.025, 0.32]);
    b.place(box(0.02), LC.seat, v(x, F + 0.14, -0.02), [0, 0, 0], [0.28, 0.02, 0.28]);
    b.place(box(0.02), LC.seat, v(x, F + 0.32, -0.19), [-0.22, 0, 0], [0.28, 0.32, 0.02]);
    for (let k = 0; k < 3; k += 1) b.place(box(0.004), LC.seatDark, v(x, F + 0.22 + k * 0.09, -0.177 - k * 0.02), [-0.22, 0, 0], [0.27, 0.012, 0.012]);
    for (const dx of [-0.15, 0.15]) {
      strut(b, new Matrix4(), new Vector3(x + dx, F, 0.1), new Vector3(x + dx, F + 0.12, 0.1), 0.012, LC.frame);
      strut(b, new Matrix4(), new Vector3(x + dx, F + 0.12, -0.17), new Vector3(x + dx, F + 0.5, -0.25), 0.014, LC.frame);
    }
    // An armrest hoop on the outside, and a footrest.
    strut(b, new Matrix4(), new Vector3(side * 0.42, F + 0.04, 0.12), new Vector3(side * 0.42, F + 0.24, 0.02), 0.012, LC.frame);
    strut(b, new Matrix4(), new Vector3(side * 0.42, F + 0.24, 0.02), new Vector3(side * 0.42, F + 0.24, -0.16), 0.012, LC.frame);
    b.place(box(0.006), LC.frameDark, v(x, F + 0.03, 0.42), [0.3, 0, 0], [0.24, 0.015, 0.12]);
  }
  // The T-handle hand controller between the seats.
  strut(b, new Matrix4(), new Vector3(0, F, 0.16), new Vector3(0, F + 0.22, 0.16), 0.016, LC.frameDark);
  b.place(cylinder(8), LC.console, v(0, F + 0.24, 0.16), [0, 0, Math.PI / 2], [0.016, 0.1, 0.016]);
  b.place(sphere("low"), LC.console, v(0, F + 0.26, 0.16), [0, 0, 0], 0.024);

  // The console on its post, tipped toward the driver, with round dials and a sun compass.
  strut(b, new Matrix4(), new Vector3(0, F, 0.4), new Vector3(0, F + 0.3, 0.42), 0.022, LC.frameDark);
  b.place(box(0.02), LC.console, v(0, F + 0.36, 0.44), [-0.55, 0, 0], [0.32, 0.22, 0.05]);
  for (const [x, y] of [[-0.08, 0.38], [0.08, 0.38], [0, 0.32]] as const) {
    b.place(cylinder(12), LC.dial, v(x, F + y, 0.415 + (y - 0.32) * 0.5), [Math.PI / 2 - 0.55, 0, 0], [0.032, 0.01, 0.032], undefined, "glow");
  }
  b.place(cylinder(12), LC.bag, v(0, F + 0.48, 0.48), [-0.55, 0, 0], [0.05, 0.012, 0.05]);
  b.place(cone(6), LC.ink, v(0, F + 0.505, 0.47), [-0.55, 0, 0], [0.008, 0.04, 0.008]);

  // The back: a tool pallet with a scoop, tongs and sample bags.
  b.place(box(0.02), LC.frame, v(0, F + 0.12, -0.78), [0, 0, 0], [0.74, 0.22, 0.3]);
  b.place(box(0.01), LC.frameDark, v(0, F + 0.24, -0.78), [0, 0, 0], [0.76, 0.02, 0.32]);
  for (const x of [-0.24, -0.08, 0.08]) b.place(box(0.02), LC.bag, v(x, F + 0.3, -0.84), [0.1, 0, 0], [0.12, 0.12, 0.08]);
  strut(b, new Matrix4(), new Vector3(0.24, F + 0.2, -0.7), new Vector3(0.28, F + 0.62, -0.74), 0.012, LC.frame);
  b.place(box(0.006), LC.frame, v(0.285, F + 0.65, -0.745), [0, 0, 0.1], [0.06, 0.04, 0.05]);
  strut(b, new Matrix4(), new Vector3(0.32, F + 0.2, -0.7), new Vector3(0.34, F + 0.56, -0.72), 0.01, LC.frameDark);

  // Fenders over each wheel: a top and two sloping ends.
  for (const side of [-1, 1]) {
    for (const z of [-axle, axle]) {
      const x = side * track;
      b.place(box(0.01), LC.fender, v(x, radius * 2 + 0.07, z), [0, 0, 0], [WHEEL.width + 0.06, 0.02, 0.34]);
      for (const k of [-1, 1]) b.place(box(0.01), LC.fender, v(x, radius * 2 - 0.0, z + k * 0.24), [k * 0.85, 0, 0], [WHEEL.width + 0.06, 0.02, 0.18]);
      strut(b, new Matrix4(), new Vector3(side * 0.45, F + 0.02, z), new Vector3(x, radius * 2 + 0.06, z), 0.014, LC.frameDark);
    }
  }

  // The TV camera on its mast at the front, and the low-gain antenna on the driver's side.
  strut(b, new Matrix4(), new Vector3(0, F + 0.15, 0.94), new Vector3(0, F + 0.42, 1.0), 0.016, LC.frame);
  b.place(box(0.02), LC.white, v(0, F + 0.47, 1.02), [0, 0, 0], [0.13, 0.11, 0.18]);
  b.place(cylinder(12), LC.console, v(0, F + 0.47, 1.12), [Math.PI / 2, 0, 0], [0.035, 0.05, 0.035]);
  b.place(box(0.006), LC.gold, v(0, F + 0.53, 1.02), [0, 0, 0], [0.14, 0.01, 0.19]);
  strut(b, new Matrix4(), new Vector3(0.3, F + 0.15, 0.72), new Vector3(0.3, F + 0.74, 0.72), 0.01, LC.frame);
  b.place(cylinder(8), LC.white, v(0.3, F + 0.8, 0.72), [0, 0, 0], [0.018, 0.14, 0.018]);
  b.place(cone(8), LC.white, v(0.3, F + 0.89, 0.72), [0, 0, 0], [0.018, 0.04, 0.018]);
  // A paper tag Dad tied to the console post: his own little label.
  b.place(box(0.004), LC.paper, v(0.06, F + 0.2, 0.43), [0, 0.3, 0.12], [0.08, 0.05, 0.004]);
  b.place(box(0.002), LC.ink, v(0.062, F + 0.205, 0.432), [0, 0.3, 0.12], [0.05, 0.008, 0.003]);

  const material = toon.toon({ vertexColors: true, paint: 0.12 });
  const glow = toon.glow("#ffffff", true);
  const meshes = b.build({ solid: material, glow }, { castShadow, receiveShadow: true });
  for (const mesh of meshes) root.add(mesh);

  // The umbrella antenna on its mast: a group, so it can turn toward Earth.
  const antenna = new Group();
  antenna.position.set(-0.26, F + 0.16, 0.7);
  const ab = new Batcher();
  ab.place(cylinder(8), LC.frame, v(0, 0.42, 0), [0, 0, 0], [0.016, 0.84, 0.016]);
  ab.place(dish(0.26, 0.09, 0.012), LC.white, v(0, 0.88, 0.02), [-0.9, 0, 0], 1);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    ab.place(box(0.002), LC.frameDark, v(Math.cos(a) * 0.12, 0.94 + Math.sin(a) * 0.05, 0.07 + Math.sin(a) * 0.08), [-0.9, -a, 0], [0.24, 0.006, 0.008]);
  }
  ab.place(cylinder(8), LC.frameDark, v(0, 0.96, 0.08), [-0.9, 0, 0], [0.012, 0.16, 0.012]);
  for (const mesh of ab.build({ solid: material }, { castShadow, receiveShadow: true })) antenna.add(mesh);
  root.add(antenna);

  const wheels: BuggyWheel[] = [];
  for (const side of [-1, 1]) {
    for (const front of [true, false]) {
      const knuckle = new Group();
      knuckle.position.set(side * track, radius, front ? axle : -axle);
      const spin = wheel(toon, castShadow);
      knuckle.add(spin);
      root.add(knuckle);
      wheels.push({ knuckle, spin, front, side });
    }
  }
  root.traverse((o) => {
    if ((o as Mesh).isMesh) o.matrixAutoUpdate = true;
  });

  return {
    root,
    wheels,
    antenna,
    seat: new Vector3(0.22, F + 0.15 - 0.31, -0.02),
    door: new Vector3(1.15, 0, 0.0),
    shapes: [{ kind: "box", x: 0, z: 0, halfWidth: track + WHEEL.width / 2 + 0.04, halfDepth: axle + radius + 0.06, height: 0.7 }],
    meshes,
  };
}

/** Dad's wheel test: a long wooden tray of grey dust, with three wheels lined up at one end. */
export function buildWheelTray(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  // The tray on two trestles.
  b.place(box(0.02), LC.wood, v(0, 0.38, 0), [0, 0, 0], [0.62, 0.08, 2.2], m);
  b.place(box(0.01), LC.dust, v(0, 0.425, 0), [0, 0, 0], [0.54, 0.02, 2.1], m);
  for (let i = 0; i < 9; i += 1) b.place(sphere("low"), "#A8A39B", v(((i * 37) % 9) / 9 * 0.4 - 0.2, 0.43, -0.9 + i * 0.22), [0, 0, 0], [0.06, 0.012, 0.05], m);
  for (const z of [-0.8, 0.8]) {
    for (const x of [-0.24, 0.24]) b.place(box(0.01), LC.woodDark, v(x, 0.17, z), [0, 0, x > 0 ? -0.15 : 0.15], [0.05, 0.36, 0.05], m);
    b.place(box(0.01), LC.woodDark, v(0, 0.3, z), [0, 0, 0], [0.5, 0.04, 0.05], m);
  }
  // Three test wheels on the rack at the near end: smooth, plain mesh, and mesh with chevrons.
  const axis: [number, number, number] = [0, 0, Math.PI / 2];
  const wheels: { x: number; color: string; chevrons: boolean; mesh: boolean }[] = [
    { x: -0.42, color: "#9A9690", chevrons: false, mesh: false },
    { x: 0, color: LC.tire, chevrons: false, mesh: true },
    { x: 0.42, color: LC.tire, chevrons: true, mesh: true },
  ];
  b.place(box(0.01), LC.woodDark, v(0, 0.08, 1.38), [0, 0, 0], [1.2, 0.04, 0.3], m);
  for (const w of wheels) {
    b.place(cylinder(16), w.color, v(w.x, 0.22, 1.38), axis, [0.14, 0.08, 0.14], m);
    if (w.mesh) b.place(cylinder(16), LC.tireDark, v(w.x, 0.22, 1.38), axis, [0.115, 0.085, 0.115], m);
    b.place(cylinder(8), LC.hub, v(w.x, 0.22, 1.38), axis, [0.04, 0.1, 0.04], m);
    if (w.chevrons) {
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        b.place(box(0.002), LC.chevron, v(w.x, 0.22 + Math.cos(a) * 0.143, 1.38 + Math.sin(a) * 0.143), [a, 0, 0], [0.06, 0.008, 0.018], m);
      }
    }
  }
  // Dad's paper label on a stake.
  b.place(cylinder(6), LC.woodDark, v(0.42, 0.3, -1.25), [0, 0, 0], [0.025, 0.6, 0.025], m);
  b.place(box(0.004), LC.paper, v(0.42, 0.56, -1.22), [0, 0.2, -0.05], [0.26, 0.15, 0.01], m);
  for (let k = 0; k < 2; k += 1) b.place(box(0.002), LC.ink, v(0.42, 0.58 - k * 0.045, -1.214), [0, 0.2, -0.05], [0.18 - k * 0.05, 0.01, 0.003], m);
  return [
    { kind: "box", x: 0, z: 0, halfWidth: 0.34, halfDepth: 1.12, height: 0.45 },
    { kind: "box", x: 0, z: 1.38, halfWidth: 0.62, halfDepth: 0.18, height: 0.36 },
  ];
}

/** Dad's chalk marks where the buggy is parked: four corners and an arrow for the front. */
export function buildParkingMarks(b: Batcher, s: Site): void {
  const m = s.matrix;
  const hw = WHEEL.track + 0.22;
  const hd = WHEEL.axle + 0.42;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      b.place(box(0.002), LC.chalk, v(x * hw, 0.012, z * (hd - 0.12)), [0, 0, 0], [0.04, 0.008, 0.28], m);
      b.place(box(0.002), LC.chalk, v(x * (hw - 0.12), 0.012, z * hd), [0, 0, 0], [0.28, 0.008, 0.04], m);
    }
  }
  for (const k of [-1, 1]) b.place(box(0.002), LC.chalk, v(k * 0.1, 0.012, hd + 0.18), [0, k * 0.7, 0], [0.04, 0.008, 0.3], m);
}

/** A little paper flag on a stake at the rille overlook. */
export function buildOverlookFlag(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(6), LC.woodDark, v(0, 0.45, 0), [0, 0, 0], [0.03, 0.9, 0.03], m);
  b.place(box(0.004), "#D9563F", v(0.15, 0.78, 0), [0, 0, 0], [0.28, 0.18, 0.01], m);
  b.place(sphere("low"), LC.woodDark, v(0, 0.92, 0), [0, 0, 0], 0.04, m);
  // A ring of small stones round its foot, the way Dad marks a viewpoint.
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    b.place(sphere("low"), i % 2 ? "#8A8680" : "#9C978F", v(Math.cos(a) * 0.22, 0.03, Math.sin(a) * 0.22), [a, 0, 0], [0.06, 0.04, 0.05], m);
  }
  return [{ kind: "circle", x: 0, z: 0, radius: 0.12, height: 0.9 }];
}

/**
 * The science station the crew set up away from the lander: a central box
 * under a sunshade, a finned power generator, and a few instruments joined to
 * it by flat ribbon cables.
 */
export function buildScienceStation(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  // The central box with gold foil sides and a white sunshade on four posts.
  b.place(box(0.02), LC.gold, v(0, 0.16, 0), [0, 0, 0], [0.5, 0.26, 0.4], m);
  b.place(box(0.01), LC.white, v(0, 0.31, 0), [0, 0, 0], [0.54, 0.03, 0.44], m);
  for (const [x, z] of [[-0.24, -0.19], [0.24, -0.19], [-0.24, 0.19], [0.24, 0.19]] as const) b.place(cylinder(6), LC.frame, v(x, 0.4, z), [0, 0, 0], [0.012, 0.18, 0.012], m);
  b.place(box(0.01), LC.white, v(0, 0.5, 0), [0.12, 0, 0], [0.62, 0.02, 0.5], m);
  b.place(cylinder(10), LC.white, v(0.18, 0.62, -0.12), [0, 0, 0], [0.012, 0.22, 0.012], m);
  b.place(cone(12), LC.white, v(0.18, 0.74, -0.12), [Math.PI, 0, 0], [0.08, 0.05, 0.08], m);
  // The power generator: a dark finned drum.
  const g = v(-0.95, 0, 0.35);
  b.place(cylinder(12), "#3E3B38", [g[0], 0.24, g[2]], [0, 0, 0], [0.12, 0.42, 0.12], m);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    b.place(box(0.002), "#55514C", [g[0] + Math.cos(a) * 0.13, 0.24, g[2] + Math.sin(a) * 0.13], [0, -a, 0], [0.08, 0.36, 0.012], m);
  }
  b.place(cylinder(10), LC.frame, [g[0], 0.03, g[2]], [0, 0, 0], [0.2, 0.05, 0.2], m);
  // Instruments out on the ground, each with a ribbon cable back to the box.
  const out: [number, number, string][] = [
    [1.2, 0.5, LC.gold],
    [0.5, -1.25, LC.white],
    [-0.7, -1.0, LC.gold],
  ];
  for (const [x, z, c] of out) {
    b.place(box(0.02), c, v(x, 0.1, z), [0, Math.atan2(x, z), 0], [0.22, 0.18, 0.22], m);
    b.place(cylinder(10), LC.white, v(x, 0.22, z), [0, 0, 0], [0.07, 0.06, 0.07], m);
    const len = Math.hypot(x, z) - 0.35;
    b.place(box(0.002), "#4A4643", v(x * 0.5, 0.008, z * 0.5), [0, Math.atan2(x, z), 0], [0.03, 0.006, len], m);
  }
  b.place(box(0.002), "#4A4643", v(-0.48, 0.008, 0.17), [0, Math.atan2(-0.95, 0.35), 0], [0.03, 0.006, 0.82], m);
  return [
    { kind: "box", x: 0, z: 0, halfWidth: 0.34, halfDepth: 0.28, height: 0.55 },
    { kind: "circle", x: -0.95, z: 0.35, radius: 0.2, height: 0.5 },
  ];
}

/** Wheel tracks pressed into the dust: two rows of chevron prints, one under each side's wheels. */
export function buildTrackMarks(b: Batcher, place: (t: number) => Site | null, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const spot = place(i / Math.max(1, count - 1));
    if (!spot) continue;
    for (const x of [-WHEEL.track, WHEEL.track]) {
      // A soft pressed strip, a wheel wide, with one chevron print on it.
      b.place(box(0.002), "#8C8882", v(x, 0.004, 0), [0, 0, 0], [0.13, 0.004, 0.29], spot.matrix);
      b.place(box(0.002), "#706C66", v(x - 0.03, 0.008, 0.0), [0, 0.6, 0], [0.06, 0.004, 0.014], spot.matrix);
      b.place(box(0.002), "#706C66", v(x + 0.03, 0.008, 0.0), [0, -0.6, 0], [0.06, 0.004, 0.014], spot.matrix);
    }
  }
}
