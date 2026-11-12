import { Group, type Matrix4, Mesh, type Material, Vector3 } from "three";
import { box, cylinder, sphere, torus } from "../../actors/parts";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import type { Site } from "../kit/little-world";
import { strut } from "../tranquility/machines";

/**
 * Dad's models for the Meridiani diorama: Opportunity, the lander it left in
 * Eagle crater, the airbag bounce marks and a striped outcrop with
 * "blueberries". Squeezed to kid size (model, not to scale).
 */
const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

export const MC = {
  white: "#E9E3D6",
  gold: "#D2A445",
  panel: "#2A3864",
  panelLine: "#5A6B9C",
  metal: "#B9B4AA",
  dark: "#4A4440",
  wheel: "#9C968C",
  dust: "#B8714A",
  rock: "#9A5B3A",
  rockLight: "#B97A52",
  berry: "#3E3438",
  airbag: "#D9CDB4",
};

export interface Rover {
  shapes: Shape[];
  /** Moving parts in the site's frame: the mast head lifts when it wakes. */
  root: Group;
  /** The dust lying on the panels: its opacity is how dusty they are. */
  dust: Material & { opacity: number };
  mastHead: Group;
  lights: Mesh[];
  /** Where to stand to give a letter to the arm, and to the panels. */
  arm: Vector3;
  panels: Vector3;
  center: Vector3;
}

/** Opportunity: six wheels, a box body, five solar panels like wings, a mast with two camera eyes. */
export function buildRover(b: Batcher, s: Site, toon: ToonLibrary): Rover {
  const m = s.matrix;
  // Six wheels on rocker-bogie legs.
  for (const side of [-1, 1]) {
    for (const z of [-0.55, 0, 0.55]) {
      b.place(cylinder(16), MC.wheel, v(side * 0.62, 0.17, z), [0, 0, Math.PI / 2], [0.17, 0.14, 0.17], m);
      b.place(cylinder(12), MC.dark, v(side * 0.7, 0.17, z), [0, 0, Math.PI / 2], [0.08, 0.02, 0.08], m);
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        b.place(box(0.004), MC.dark, v(side * 0.62, 0.17 + Math.cos(a) * 0.17, z + Math.sin(a) * 0.17), [a, 0, 0], [0.15, 0.012, 0.03], m);
      }
    }
    strut(b, m, new Vector3(side * 0.55, 0.42, -0.1), new Vector3(side * 0.6, 0.2, -0.55), 0.025, MC.metal);
    strut(b, m, new Vector3(side * 0.55, 0.42, -0.1), new Vector3(side * 0.6, 0.3, 0.28), 0.025, MC.metal);
    strut(b, m, new Vector3(side * 0.6, 0.3, 0.28), new Vector3(side * 0.6, 0.2, 0), 0.022, MC.metal);
    strut(b, m, new Vector3(side * 0.6, 0.3, 0.28), new Vector3(side * 0.6, 0.2, 0.55), 0.022, MC.metal);
  }
  // The warm box with the brains, and the deck on top.
  b.place(box(0.04), MC.white, v(0, 0.52, 0), [0, 0, 0], [0.86, 0.3, 1.0], m);
  b.place(box(0.02), MC.gold, v(0, 0.39, 0), [0, 0, 0], [0.82, 0.04, 0.96], m);
  // Five solar panels: the deck and four hinged wings, each with its cells in rows.
  const panels: [number, number, number, number][] = [
    [0, 0, 0.95, 1.05],
    [-0.78, 0.05, 0.66, 0.62],
    [0.78, 0.05, 0.66, 0.62],
    [-0.62, -0.62, 0.5, 0.36],
    [0.62, -0.62, 0.5, 0.36],
  ];
  // Toon materials are shared by their options, so this one gets options of its own: it fades.
  const dust = toon.toon({ color: MC.dust, objectSpace: true, paint: 0.34, rim: 0.55 }) as Material & { opacity: number };
  dust.transparent = true;
  dust.opacity = 0.85;
  const root = new Group();
  for (const [x, z, w, d] of panels) {
    b.place(box(0.01), MC.metal, v(x, 0.69, z), [0, 0, 0], [w + 0.04, 0.03, d + 0.04], m);
    b.place(box(0.004), MC.panel, v(x, 0.71, z), [0, 0, 0], [w, 0.02, d], m);
    for (let i = 1; i < 4; i += 1) b.place(box(0.002), MC.panelLine, v(x - w / 2 + (w * i) / 4, 0.722, z), [0, 0, 0], [0.008, 0.006, d * 0.96], m);
    const film = new Mesh(box(0.004), dust);
    film.position.set(x, 0.727, z);
    film.scale.set(w * 0.98, 0.006, d * 0.98);
    film.renderOrder = 2;
    root.add(film);
  }
  // The mast at the front, with the camera head on top.
  b.place(cylinder(10), MC.white, v(0.2, 1.0, 0.42), [0, 0, 0], [0.04, 0.6, 0.04], m);
  const mastHead = new Group();
  mastHead.position.set(0.2, 1.3, 0.42);
  const head = new Mesh(box(0.03), toon.toon({ color: MC.white, objectSpace: true, paint: 0.1 }));
  head.scale.set(0.34, 0.12, 0.12);
  mastHead.add(head);
  const lights: Mesh[] = [];
  for (const x of [-0.1, 0.1]) {
    const eye = new Mesh(cylinder(12), toon.glow("#3A3A46"));
    eye.rotation.x = Math.PI / 2;
    eye.position.set(x, 0, 0.065);
    eye.scale.set(0.035, 0.02, 0.035);
    mastHead.add(eye);
    lights.push(eye);
  }
  root.add(mastHead);
  // The high-gain dish and a whip antenna.
  b.place(cylinder(16, 0.2), MC.white, v(-0.25, 0.86, 0.25), [-0.5, 0, 0], [0.13, 0.05, 0.13], m);
  b.place(cylinder(6), MC.metal, v(-0.35, 1.0, -0.3), [0, 0, 0], [0.008, 0.6, 0.008], m);
  // The arm folded at the front, with the rock grinder at its end.
  strut(b, m, new Vector3(0.25, 0.45, 0.52), new Vector3(0.1, 0.38, 0.78), 0.028, MC.metal);
  strut(b, m, new Vector3(0.1, 0.38, 0.78), new Vector3(-0.2, 0.36, 0.72), 0.025, MC.metal);
  b.place(cylinder(12), MC.gold, v(-0.26, 0.33, 0.74), [Math.PI / 2, 0, 0], [0.07, 0.09, 0.07], m);
  b.place(cylinder(12), MC.dark, v(-0.26, 0.33, 0.8), [Math.PI / 2, 0, 0], [0.05, 0.03, 0.05], m);

  root.matrixAutoUpdate = false;
  root.matrix.copy(m);
  root.matrixWorldNeedsUpdate = true;
  const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(m);
  return {
    shapes: [{ kind: "box", x: 0, z: 0, halfWidth: 0.85, halfDepth: 0.75, height: 1.4 }],
    root,
    dust,
    mastHead,
    lights,
    arm: at(-0.3, 0, 1.55),
    panels: at(-1.55, 0, 0.1),
    center: at(0, 0.7, 0),
  };
}

/** The lander that carried Opportunity: a flat triangle of open petals, left in Eagle crater, with its airbags hanging limp. */
export function buildLander(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(3), MC.white, v(0, 0.12, 0), [0, 0, 0], [0.55, 0.16, 0.55], m);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const out = new Vector3(Math.sin(a), 0, Math.cos(a));
    b.place(cylinder(3), MC.white, v(out.x * 0.75, 0.06, out.z * 0.75), [0, -a + Math.PI, 0], [0.48, 0.05, 0.48], m);
    // Deflated airbags in soft folds round each petal.
    for (let k = 0; k < 3; k += 1) {
      const t = (k - 1) * 0.35;
      const p = out.clone().multiplyScalar(1.15).add(new Vector3(-out.z, 0, out.x).multiplyScalar(t));
      b.place(sphere("low"), MC.airbag, v(p.x, 0.08, p.z), [0.2 * k, a, 0], [0.26, 0.1, 0.2], m);
    }
  }
  // The ramp the rover rolled off.
  b.place(box(0.01), MC.metal, v(0, 0.08, 0.95), [0.15, 0, 0], [0.32, 0.02, 0.5], m);
  return [{ kind: "circle", x: 0, z: 0, radius: 1.15, height: 0.3 }];
}

/** One airbag bounce mark: a round dent ringed with lumps, as the balls of airbags hit the ground. */
export function bounceMark(b: Batcher, m: Matrix4, r: number): void {
  b.place(cylinder(20), "#8E4A2C", v(0, 0.012, 0), [0, 0, 0], [r, 0.012, r], m);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    b.place(sphere("low"), "#A65A36", v(Math.cos(a) * r * 0.62, 0.02, Math.sin(a) * r * 0.62), [0, a, 0], [r * 0.32, 0.03, r * 0.26], m);
  }
  b.place(torus(0.2), "#BF7448", v(0, 0.02, 0), [Math.PI / 2, 0, 0], [r, r, 0.12], m);
}

/**
 * A low outcrop of layered rock, the kind Opportunity studied: flat slabs
 * broken apart, each a stack of thin bands, with blueberries in the dust.
 */
export function buildOutcrop(b: Batcher, s: Site, length: number): Shape[] {
  const m = s.matrix;
  const slabs: [number, number, number, number][] = [
    // x, z, width, turn
    [-length * 0.32, 0.02, length * 0.4, 0.08],
    [length * 0.06, -0.06, length * 0.36, -0.05],
    [length * 0.38, 0.06, length * 0.26, 0.14],
  ];
  slabs.forEach(([x, z, w, turn], k) => {
    const layers = 4 - (k % 2);
    for (let i = 0; i < layers; i += 1) {
      const jitter = Math.sin(k * 3.1 + i * 1.7);
      const width = w * (1 - i * 0.1 + jitter * 0.06);
      const depth = 0.62 - i * 0.07 + Math.cos(k + i) * 0.04;
      const y = 0.04 + i * 0.075;
      b.place(box(0.03), i % 2 ? MC.rockLight : MC.rock, v(x + jitter * 0.04, y, z - i * 0.03), [0, turn + jitter * 0.03, 0.02 * jitter], [width, 0.07, depth], m);
      // A thin pale seam between the bands, like old layers of mud.
      b.place(box(0.002), "#D9A27A", v(x + jitter * 0.04, y + 0.037, z - i * 0.03 + depth * 0.5 - 0.01), [0, turn + jitter * 0.03, 0], [width * 0.96, 0.008, 0.012], m);
    }
  });
  // The grinder's round scrape on the face of the rock: darker, fresh rock.
  b.place(cylinder(16), "#6E3A26", v(-length * 0.3, 0.16, 0.33), [Math.PI / 2, 0, 0], [0.09, 0.01, 0.09], m);
  for (let i = 0; i < 30; i += 1) {
    const x = (Math.sin(i * 12.9) * 0.5 + 0.5) * length - length / 2;
    const z = 0.42 + (Math.sin(i * 7.3) * 0.5 + 0.5) * 0.55;
    b.place(sphere("tiny"), MC.berry, v(x, 0.02, z), [0, 0, 0], 0.025, m);
  }
  return [{ kind: "box", x: 0, z: 0, halfWidth: length / 2, halfDepth: 0.36, height: 0.32 }];
}

/** Dad's bundle of breeze flags, leaning on a rock. */
export function buildFlagRack(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(sphere("low"), MC.rock, v(0, 0.12, -0.1), [0.3, 0.8, 0], [0.32, 0.22, 0.26], m);
  return [{ kind: "circle", x: 0, z: -0.1, radius: 0.3, height: 0.35 }];
}
