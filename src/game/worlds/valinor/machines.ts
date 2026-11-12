import { Group, type Mesh, Vector3 } from "three";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import type { Site } from "../kit/little-world";
import { strut } from "../tranquility/machines";

/**
 * Dad's models for the Valinor Hills diorama in Jezero Crater: Ingenuity
 * where it stays after its last flight (one blade broken), Wright Brothers
 * Field with the little helicopter's shadow painted on it, Dad's rotor
 * bench, his toy helicopter for the scout flight, and the rover's tracks.
 * Squeezed to kid size (model, not to scale).
 *
 * Frame: +Y up, +Z forward.
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

export const VC = {
  body: "#D9D3C6",
  bodyShade: "#B8B1A3",
  foil: "#C9A24E",
  leg: "#4E4A48",
  blade: "#3A3A40",
  bladeEdge: "#5A5A62",
  mast: "#8E8B86",
  panel: "#27335E",
  panelLine: "#5A6B9C",
  fabric: "#D8C7A0",
  wood: "#B07A4E",
  woodDark: "#7A5136",
  paper: "#F4ECDD",
  glass: "#DCEBF2",
  pebble: "#EDE4D2",
  shadow: "#5E3626",
  track: "#A9693F",
  trackDark: "#86502F",
};

/** Ingenuity's parts, in metres of Dad's model: the body sits on four legs, the rotors on a mast. */
const BODY = { y: 0.52, size: 0.3 };
const ROTOR = { low: 0.92, high: 1.04, radius: 0.72 };

/** The four legs, splayed out from the body's corners. */
function legs(b: Batcher, m: import("three").Matrix4): void {
  // Each leg runs from under a corner of the body, out and down to a little round foot.
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const top = new Vector3(Math.sin(a) * 0.13, BODY.y - BODY.size * 0.38, Math.cos(a) * 0.13);
    const foot = new Vector3(Math.sin(a) * 0.48, 0.04, Math.cos(a) * 0.48);
    strut(b, m, top, foot, 0.018, VC.leg);
    b.place(sphere("low"), VC.leg, v(foot.x, 0.03, foot.z), [0, 0, 0], [0.05, 0.025, 0.05], m);
  }
}

/** The body: a box wrapped in pale film, with a foil seam and the little camera below. */
function body(b: Batcher, m: import("three").Matrix4): void {
  const s = BODY.size;
  b.place(box(0.04), VC.body, v(0, BODY.y, 0), [0, 0, 0], [s, s * 0.85, s * 1.05], m);
  b.place(box(0.01), VC.bodyShade, v(0, BODY.y - s * 0.43, 0), [0, 0, 0], [s * 0.94, 0.02, s * 0.98], m);
  b.place(box(0.01), VC.foil, v(0, BODY.y + s * 0.2, s * 0.53), [0, 0, 0], [s * 0.8, 0.03, 0.01], m);
  // The cameras look down from under the body.
  b.place(cylinder(10), VC.leg, v(0.06, BODY.y - s * 0.5, 0.06), [0, 0, 0], [0.03, 0.04, 0.03], m);
  b.place(box(0.01), "#2A2A30", v(0.11, BODY.y + 0.02, s * 0.53), [0, 0, 0], [0.04, 0.04, 0.01], m);
}

/** The mast, the two rotors' hubs, and the solar panel on top. With the Wright Flyer fabric under the panel. */
function mast(b: Batcher, m: import("three").Matrix4, fabric: boolean): void {
  b.place(cylinder(10), VC.mast, v(0, (BODY.y + ROTOR.high) / 2 + 0.06, 0), [0, 0, 0], [0.028, ROTOR.high - BODY.y + 0.1, 0.028], m);
  for (const y of [ROTOR.low, ROTOR.high]) b.place(cylinder(12), VC.leg, v(0, y, 0), [0, 0, 0], [0.06, 0.05, 0.06], m);
  const top = ROTOR.high + 0.1;
  b.place(box(0.01), VC.panel, v(0, top, 0), [0, 0, 0], [0.42, 0.02, 0.22], m);
  for (let i = -2; i <= 2; i += 1) b.place(box(0.002), VC.panelLine, v(i * 0.08, top + 0.012, 0), [0, 0, 0], [0.006, 0.004, 0.21], m);
  b.place(box(0.002), VC.panelLine, v(0, top + 0.012, 0), [0, 0, 0], [0.41, 0.004, 0.006], m);
  // A tiny patch of cloth from the first airplane, taped round a cable under the panel (fact ing-wright).
  if (fabric) b.place(cylinder(8), VC.fabric, v(0.05, top - 0.05, 0.02), [0, 0, Math.PI / 2], [0.022, 0.05, 0.022], m);
}

/** One rotor: two long thin blades across the hub. `broken` cuts one blade short. */
function rotor(b: Batcher, m: import("three").Matrix4, y: number, turn: number, broken = false, layer: "solid" = "solid"): void {
  for (const side of [-1, 1]) {
    const short = broken && side === 1;
    const length = short ? ROTOR.radius * 0.55 : ROTOR.radius;
    const x = side * (length / 2 + 0.04);
    b.place(box(0.004), VC.blade, v(Math.cos(turn) * x, y, -Math.sin(turn) * x), [0, turn, side * 0.05], [length, 0.02, 0.1], m, layer);
    if (short) b.place(box(0.002), VC.bladeEdge, v(Math.cos(turn) * (length + 0.04), y, -Math.sin(turn) * (length + 0.04)), [0, turn + 0.5, 0], [0.04, 0.012, 0.07], m, layer);
  }
}

/** Ingenuity at Valinor Hills: it can't fly anymore (one blade broken), but it stays and keeps notes. */
export function buildIngenuity(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  legs(b, m);
  body(b, m);
  mast(b, m, true);
  rotor(b, m, ROTOR.low, 0.4);
  rotor(b, m, ROTOR.high, 1.7, true);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.42, height: 1.2 }];
}

export interface ModelHelicopter {
  /** Lifts and turns as a whole, in the site's frame. */
  root: Group;
  /** The two rotors, which spin the opposite ways. */
  rotors: [Group, Group];
  shapes: Shape[];
}

/**
 * Dad's toy Ingenuity for the scout flight: the same shape, a little smaller,
 * with whole blades. Built as its own group so it can hover and its rotors spin.
 */
export function buildModelHelicopter(toon: ToonLibrary): ModelHelicopter {
  const root = new Group();
  root.name = "model-helicopter";
  const material = toon.toon({ vertexColors: true, paint: 0.1, objectSpace: true });
  const add = (batch: Batcher, parent: Group): void => {
    for (const mesh of batch.build({ solid: material }, { castShadow: true, receiveShadow: false }) as Mesh[]) parent.add(mesh);
  };
  const frame = new Batcher();
  legs(frame, root.matrix);
  body(frame, root.matrix);
  mast(frame, root.matrix, false);
  add(frame, root);
  const rotors: [Group, Group] = [new Group(), new Group()];
  [ROTOR.low, ROTOR.high].forEach((y, i) => {
    const r = new Batcher();
    rotor(r, root.matrix, 0, 0);
    add(r, rotors[i]!);
    rotors[i]!.position.y = y;
    root.add(rotors[i]!);
  });
  root.scale.setScalar(0.72);
  return { root, rotors, shapes: [{ kind: "circle", x: 0, z: 0, radius: 0.3, height: 0.8 }] };
}

/**
 * Wright Brothers Field: Dad's square of pale pebbles round the spot of the
 * first flight, the little helicopter's shadow painted in the middle (like
 * its own first picture from the air), and a paper sign on a stick.
 */
export function buildAirfield(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  const half = 1.5;
  for (let i = 0; i < 4; i += 1) {
    for (let k = 0; k < 9; k += 1) {
      const t = -half + (k / 8) * half * 2;
      const [x, z] = i === 0 ? [t, -half] : i === 1 ? [half, t] : i === 2 ? [-t, half] : [-half, -t];
      b.place(sphere("low"), VC.pebble, v(x, 0.03, z), [k, i, 0], [0.07, 0.04, 0.06], m);
    }
  }
  // The shadow: a body, four legs and two crossed rotors, flat on the ground.
  const y = 0.012;
  b.place(box(0.002), VC.shadow, v(0, y, 0), [0, 0.3, 0], [0.32, 0.004, 0.3], m);
  for (const turn of [0.3, 1.45]) b.place(box(0.002), VC.shadow, v(0, y, 0), [0, turn, 0], [1.5, 0.004, 0.09], m);
  for (let i = 0; i < 4; i += 1) {
    const a = 0.3 + Math.PI / 4 + (i * Math.PI) / 2;
    b.place(box(0.002), VC.shadow, v(Math.sin(a) * 0.32, y, Math.cos(a) * 0.32), [0, a, 0], [0.025, 0.004, 0.36], m);
  }
  // Dad's sign.
  b.place(cylinder(6), VC.woodDark, v(half + 0.35, 0.35, -half + 0.2), [0, 0, 0.03], [0.025, 0.7, 0.025], m);
  b.place(box(0.01), VC.paper, v(half + 0.35, 0.62, -half + 0.2), [0, -0.3, 0], [0.34, 0.2, 0.012], m);
  b.place(box(0.002), "#8A5A3C", v(half + 0.35, 0.65, -half + 0.21), [0, -0.3, 0], [0.24, 0.018, 0.012], m);
  b.place(box(0.002), "#8A5A3C", v(half + 0.35, 0.6, -half + 0.21), [0, -0.3, 0], [0.18, 0.018, 0.012], m);
  return [{ kind: "circle", x: half + 0.35, z: -half + 0.2, radius: 0.12, height: 0.8 }];
}

/** Dad's rotor bench: a work table with a test rotor on a stand, a glass jar for "Mars air", and his notes. */
export function buildRotorBench(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(box(0.02), VC.wood, v(0, 0.56, 0), [0, 0, 0], [1.6, 0.07, 0.7], m);
  for (const x of [-0.7, 0.7]) for (const z of [-0.27, 0.27]) b.place(box(0.01), VC.woodDark, v(x, 0.27, z), [0, 0, 0], [0.06, 0.54, 0.06], m);
  b.place(box(0.01), VC.woodDark, v(0, 0.16, 0), [0, 0, 0], [1.44, 0.04, 0.5], m);
  // The test stand and its rotor, on the left.
  b.place(cylinder(12), VC.leg, v(-0.4, 0.62, 0), [0, 0, 0], [0.12, 0.04, 0.12], m);
  b.place(cylinder(8), VC.mast, v(-0.4, 0.78, 0), [0, 0, 0], [0.02, 0.3, 0.02], m);
  b.place(cylinder(10), VC.leg, v(-0.4, 0.94, 0), [0, 0, 0], [0.04, 0.04, 0.04], m);
  for (const side of [-1, 1]) b.place(box(0.004), VC.blade, v(-0.4 + side * 0.2, 0.95, 0), [0, 0, side * 0.04], [0.36, 0.01, 0.06], m);
  // The glass jar where Dad thins the air, on the right, with its pump.
  b.place(cylinder(12), VC.woodDark, v(0.42, 0.61, 0), [0, 0, 0], [0.22, 0.03, 0.22], m);
  b.place(cylinder(16, 1, true), VC.glass, v(0.42, 0.8, 0), [0, 0, 0], [0.19, 0.36, 0.19], m);
  b.place(sphere("mid"), VC.glass, v(0.42, 0.98, 0), [0, 0, 0], [0.19, 0.1, 0.19], m);
  b.place(box(0.01), VC.mast, v(0.72, 0.66, 0.12), [0, 0, 0], [0.12, 0.12, 0.1], m);
  b.place(torus(0.15), VC.leg, v(0.6, 0.66, 0.12), [0, Math.PI / 2, 0], 0.08, m);
  // Dad's pages, pinned under a pebble.
  b.place(box(0.004), VC.paper, v(0.05, 0.6, 0.12), [0, 0.2, 0], [0.32, 0.01, 0.24], m);
  b.place(box(0.004), VC.paper, v(0.08, 0.605, 0.1), [0, -0.1, 0], [0.3, 0.01, 0.22], m);
  b.place(sphere("low"), "#8E5A40", v(0.15, 0.63, 0.18), [0, 0, 0], [0.05, 0.035, 0.045], m);
  return [{ kind: "box", x: 0, z: 0, halfWidth: 0.82, halfDepth: 0.38, height: 1.0 }];
}

/** Dad's little launch pad for the toy helicopter: a round board with a painted ring. */
export function buildLaunchPad(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(24), VC.woodDark, v(0, 0.04, 0), [0, 0, 0], [0.62, 0.08, 0.62], m);
  b.place(cylinder(24), VC.wood, v(0, 0.085, 0), [0, 0, 0], [0.58, 0.01, 0.58], m);
  b.place(torus(0.06), VC.paper, v(0, 0.092, 0), [Math.PI / 2, 0, 0], [0.42, 0.42, 0.2], m);
  return [];
}

/**
 * One print of the rover's six wheels pressed in the sand: two tread lines
 * with little cleats, a rover's width apart. Called along a route.
 */
export function buildRoverTracks(b: Batcher, place: (t: number) => Site | null, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const spot = place(i / Math.max(1, count - 1));
    if (!spot) continue;
    for (const x of [-0.72, 0.72]) {
      b.place(box(0.002), VC.track, v(x, 0.004, 0), [0, 0, 0], [0.17, 0.004, 0.34], spot.matrix);
      for (const z of [-0.1, 0, 0.1]) b.place(box(0.002), VC.trackDark, v(x, 0.008, z), [0, 0, 0], [0.15, 0.004, 0.018], spot.matrix);
    }
  }
}

/** A tall Jezero rock with flat layers, for the crater's old delta. */
export function buildLayeredRock(b: Batcher, s: Site, size: number): Shape[] {
  const m = s.matrix;
  for (let i = 0; i < 4; i += 1) {
    const w = size * (1 - i * 0.16);
    b.place(box(0.04), i % 2 ? "#A86A46" : "#94593A", v(Math.sin(i * 2.1) * 0.05 * size, size * (0.12 + i * 0.22), Math.cos(i * 1.7) * 0.04 * size), [0, i * 0.2, 0], [w, size * 0.22, w * 0.8], m);
  }
  b.place(cone(5), "#8A5236", v(0, size * 1.0, 0), [0, 0.4, 0], [size * 0.32, size * 0.25, size * 0.28], m);
  return [{ kind: "circle", x: 0, z: 0, radius: size * 0.5, height: size }];
}
