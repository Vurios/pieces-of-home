import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  Euler,
  Group,
  type Material,
  type Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  SphereGeometry,
  type Texture,
  TorusGeometry,
  Vector3,
} from "three";
import { factCoords, fact } from "../../../content/facts";
import { box, cone, cylinder, sphere, torus } from "../../actors/parts";
import { Batcher, type Layer } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import { DEG } from "../../world/sphere";
import { gable } from "../shapes";
import { C } from "./buildings";
import { type Museum, buildMuseum } from "./museum";
import type { Site } from "./layout";

/**
 * Dad's workshop: a board-and-batten shed with a tin roof. Inside, the
 * workbench holds Milo, the notebook, the lamp that turns itself on, four
 * glass domes with his little worlds, and two globes.
 *
 * When a player steps inside, the front wall swings down like the front of a
 * dollhouse and the roof lifts away, so the camera can see in.
 */
export const SHED = { halfWidth: 3.0, halfDepth: 2.5, wallHeight: 2.6, floor: 0.16 };
const BENCH_Y = SHED.floor + 0.82;
const BENCH_Z = -1.95;

const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

/**
 * Unit direction on a desk globe for a latitude and east longitude, matching
 * the texture layout of Three's SphereGeometry (u = (lon + 180) / 360).
 */
export function globeDir(lat: number, lon: number, out = new Vector3()): Vector3 {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return out.set(Math.cos(phi) * Math.cos(lambda), Math.sin(phi), -Math.cos(phi) * Math.sin(lambda));
}

export interface WorkshopResult {
  shellShapes: Shape[];
  frontShapes: Shape[];
  /** Swings down when someone is inside. Rotate on X. */
  frontWall: Group;
  /** Lifts away when someone is inside. */
  roof: Group;
  /** Glass and other see-through pieces, drawn after everything else. */
  glass: Object3D[];
  globes: Group[];
  /** The lamp's glowing parts (shade, bulb, halo, pool), so the lamp can click on. */
  lampGlow: Object3D[];
  /** Each pin on the globes: its head and a soft halo, so they can light up after the prologue. */
  pins: { head: Mesh; halo: Mesh; color: string }[];
  /** Dad's archive board on the right wall: where to stand to read it, and the board's middle. */
  archive: { stand: Vector3; board: Vector3 };
  /** World positions. */
  lampBulb: Vector3;
  lampSpot: Vector3;
  miloSpot: { position: Vector3; forward: Vector3 };
  friends: { position: Vector3; forward: Vector3 }[];
  benchFront: Vector3;
  dustCenter: Vector3;
  /** Dad's four domes, left to right: the top of the glass, and where a player stands to look in. */
  domes: { top: Vector3; stand: Vector3 }[];
  /**
   * Dad's newest dome, the bonus world, on its own little stand by the
   * archive board. A cloth covers it until it opens.
   */
  bonusDome: { top: Vector3; stand: Vector3; cover: Object3D };
  /** Remi's museum shelf: a keepsake and a photo for each stamp. */
  museum: Museum;
  /** Is this world point inside? `margin` grows the box, for hysteresis. */
  isInside(point: Vector3, margin: number): boolean;
}

export function buildWorkshop(b: Batcher, s: Site, toon: ToonLibrary, globeTextures: { moon: Texture; mars: Texture }): WorkshopResult {
  const m = s.matrix;
  const { halfWidth: hw, halfDepth: hd, wallHeight: wh, floor: fy } = SHED;
  const wallMid = fy + wh / 2;
  const top = fy + wh;

  // Floor with planks, on a low stone footing.
  b.place(box(0.03), C.stone, v(0, -0.36, 0), [0, 0, 0], [hw * 2 + 0.6, 1.0, hd * 2 + 0.6], m);
  b.place(box(0.02), "#A47A54", v(0, fy - 0.04, 0), [0, 0, 0], [hw * 2 + 0.2, 0.1, hd * 2 + 0.2], m);
  for (let i = 0; i < 13; i += 1) b.place(box(0.003), "#83603F", v(-hw + 0.25 + i * 0.46, fy + 0.012, 0), [0, 0, 0], [0.02, 0.006, hd * 2], m);

  // Back and side walls, boards outside.
  b.place(box(0.02), C.shedWall, v(0, wallMid, -hd - 0.1), [0, 0, 0], [hw * 2 + 0.4, wh, 0.2], m);
  for (const x of [-1, 1]) b.place(box(0.02), C.shedWall, v(x * (hw + 0.1), wallMid, 0), [0, 0, 0], [0.2, wh, hd * 2 + 0.2], m);
  for (let i = 0; i < 14; i += 1) {
    const x = -hw + 0.1 + i * 0.45;
    b.place(box(0.004), C.shedBoard, v(x, wallMid, -hd - 0.21), [0, 0, 0], [0.06, wh, 0.025], m);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i += 1) {
      const z = -hd + 0.15 + i * 0.47;
      b.place(box(0.004), C.shedBoard, v(side * (hw + 0.21), wallMid, z), [0, 0, 0], [0.025, wh, 0.06], m);
    }
    // Corner posts.
    for (const z of [-1, 1]) b.place(box(0.01), C.woodDark, v(side * (hw + 0.12), wallMid, z * (hd + 0.12)), [0, 0, 0], [0.22, wh + 0.04, 0.22], m);
  }
  // Inner wall color: a warm pine.
  b.place(box(0.01), "#E3D1AF", v(0, wallMid, -hd + 0.005), [0, 0, 0], [hw * 2, wh, 0.01], m);
  for (const x of [-1, 1]) b.place(box(0.01), "#E3D1AF", v(x * (hw - 0.005), wallMid, 0), [0, 0, 0], [0.01, wh, hd * 2], m);

  // Windows: warm outside, dusk-blue inside.
  const sideWindow = (side: number, z: number): void => {
    b.place(box(0.01), C.windowWarm, v(side * (hw + 0.22), 1.65, z), [0, 0, 0], [0.03, 0.8, 1.0], m, "glow");
    b.place(box(0.01), C.windowDusk, v(side * (hw - 0.02), 1.65, z), [0, 0, 0], [0.02, 0.8, 1.0], m, "glow");
    for (const dx of [hw + 0.24, hw - 0.04]) {
      b.place(box(0.01), C.trim, v(side * dx, 1.65, z), [0, 0, 0], [0.04, 0.06, 1.0], m);
      b.place(box(0.01), C.trim, v(side * dx, 1.65, z), [0, 0, 0], [0.04, 0.8, 0.06], m);
      b.place(box(0.01), C.trim, v(side * dx, 2.09, z), [0, 0, 0], [0.06, 0.08, 1.12], m);
      b.place(box(0.01), C.trim, v(side * dx, 1.21, z), [0, 0, 0], [0.12, 0.08, 1.16], m);
    }
  };
  // Lantern on the left wall, near the door.
  b.place(box(0.02), C.ink, v(-hw - 0.27, 1.95, hd - 0.5), [0, 0, 0], [0.12, 0.26, 0.16], m);
  b.place(sphere("low"), "#FFE2A6", v(-hw - 0.34, 1.9, hd - 0.5), [0, 0, 0], 0.07, m, "glow");
  sideWindow(1, -0.2);
  sideWindow(-1, 0.6);

  // ---- Front wall (its own group, hinged at the bottom outer edge) ----
  const frontWall = new Group();
  frontWall.name = "shed-front";
  const hingeZ = hd + 0.2;
  frontWall.position.set(0, fy - 0.02, hingeZ);
  const fb = new Batcher();
  const doorHalf = 0.75;
  const sideWidth = hw + 0.2 - doorHalf;
  for (const side of [-1, 1]) {
    fb.place(box(0.02), C.shedWall, v(side * (doorHalf + sideWidth / 2), wh / 2, -0.1), [0, 0, 0], [sideWidth, wh, 0.2]);
    for (let i = 0; i < 5; i += 1) fb.place(box(0.004), C.shedBoard, v(side * (doorHalf + 0.2 + i * 0.47), wh / 2, 0.01), [0, 0, 0], [0.06, wh, 0.025]);
    fb.place(box(0.01), "#E3D1AF", v(side * (doorHalf + sideWidth / 2), wh / 2, -0.205), [0, 0, 0], [sideWidth, wh, 0.01]);
    // Door frame.
    fb.place(box(0.01), C.trim, v(side * doorHalf, wh * 0.4, 0.02), [0, 0, 0], [0.1, wh * 0.8, 0.06]);
  }
  fb.place(box(0.02), C.shedWall, v(0, wh * 0.9, -0.1), [0, 0, 0], [doorHalf * 2, wh * 0.2, 0.2]);
  fb.place(box(0.01), C.trim, v(0, wh * 0.8, 0.02), [0, 0, 0], [doorHalf * 2 + 0.1, 0.1, 0.06]);
  // A painted sign board above the door, left blank for Dad's lettering later.
  fb.place(box(0.02), C.paper, v(0, wh * 0.92, 0.04), [0, 0, 0], [1.3, 0.3, 0.04]);
  fb.place(box(0.01), C.woodDark, v(0, wh * 0.92, 0.02), [0, 0, 0], [1.4, 0.38, 0.02]);
  // The open door leaf, swung out to the right.
  fb.place(box(0.02), "#6B4A35", v(doorHalf + 0.45, wh * 0.4, 0.5), [0, -1.25, 0], [1.4, wh * 0.78, 0.07]);
  fb.place(sphere("low"), C.brass, v(doorHalf + 0.62, wh * 0.38, 1.05), [0, 0, 0], 0.05);
  for (const mesh of fb.build(materials(toon))) frontWall.add(mesh);

  // ---- Roof (its own group) ----
  const roof = new Group();
  roof.name = "shed-roof";
  roof.position.set(0, top, 0);
  const rb = new Batcher();
  const H = 1.25;
  const over = 0.4;
  const span = hd + 0.2 + over;
  const angle = Math.atan2(H, hd + 0.2);
  const length = span / Math.cos(angle);
  // Gable ends on the left and right.
  for (const x of [-1, 1]) rb.place(gable((hd + 0.2) * 2, H, 0.2), C.shedWall, v(x * (hw + 0.1), 0, 0), [0, Math.PI / 2, 0], 1);
  for (const side of [-1, 1]) {
    const cz = (side * span) / 2;
    const cy = H - (span / 2) * Math.tan(angle) + 0.08;
    rb.place(box(0.03), C.shedRoof, v(0, cy, cz), [side * angle, 0, 0], [hw * 2 + 0.9, 0.12, length + 0.04]);
    // Corrugations.
    for (let i = 0; i < 16; i += 1) {
      rb.place(box(0.004), C.shedRoofDark, v(-hw - 0.35 + i * 0.47, cy + 0.065, cz), [side * angle, 0, 0], [0.05, 0.03, length + 0.05]);
    }
  }
  rb.place(box(0.02), C.shedRoofDark, v(0, H + 0.14, 0), [0, 0, 0], [hw * 2 + 0.95, 0.12, 0.24]);
  // A stovepipe.
  rb.place(cylinder(12), C.metalDark, v(-1.6, H + 0.1, -0.9), [0, 0, 0], [0.11, 1.1, 0.11]);
  rb.place(cylinder(12), C.ink, v(-1.6, H + 0.68, -0.9), [0, 0, 0], [0.15, 0.08, 0.15]);
  for (const mesh of rb.build(materials(toon))) roof.add(mesh);

  // ---- Workbench along the back wall ----
  const benchHalf = 2.6;
  b.place(box(0.02), "#A98C6C", v(0, BENCH_Y - 0.05, BENCH_Z), [0, 0, 0], [benchHalf * 2, 0.1, 1.0], m);
  b.place(box(0.01), C.woodDark, v(0, BENCH_Y - 0.12, BENCH_Z + 0.48), [0, 0, 0], [benchHalf * 2, 0.06, 0.05], m);
  for (const x of [-benchHalf + 0.12, benchHalf - 0.12]) for (const z of [BENCH_Z - 0.4, BENCH_Z + 0.4]) {
    b.place(box(0.01), C.woodDark, v(x, (fy + BENCH_Y) / 2 - 0.05, z), [0, 0, 0], [0.1, BENCH_Y - fy - 0.1, 0.1], m);
  }
  b.place(box(0.01), C.wood, v(0, fy + 0.25, BENCH_Z), [0, 0, 0], [benchHalf * 2 - 0.2, 0.05, 0.85], m);
  // Things stored under the bench.
  b.place(box(0.04), "#8E4E35", v(-1.6, fy + 0.45, BENCH_Z), [0, 0.1, 0], [0.7, 0.36, 0.5], m);
  b.place(box(0.04), "#4A6A8A", v(0.9, fy + 0.42, BENCH_Z + 0.05), [0, -0.15, 0], [0.55, 0.3, 0.45], m);
  b.place(cylinder(12), C.metal, v(1.9, fy + 0.45, BENCH_Z), [0, 0, 0], [0.18, 0.38, 0.18], m);

  // Pegboard with tools, and Dad's sketches pinned to the wall.
  b.place(box(0.01), "#C9A878", v(1.2, 1.95, -hd + 0.03), [0, 0, 0], [2.4, 1.05, 0.04], m);
  for (let i = 0; i < 9; i += 1) for (let j = 0; j < 4; j += 1) {
    b.place(sphere("low"), "#9E8460", v(0.12 + i * 0.27, 1.6 + j * 0.24, -hd + 0.055), [0, 0, 0], 0.014, m);
  }
  // Hammer, wrench, saw, pliers: simple shapes, read as tools from far away.
  b.place(box(0.005), C.woodDark, v(0.4, 1.9, -hd + 0.07), [0, 0, 0.2], [0.05, 0.5, 0.03], m);
  b.place(box(0.01), C.metalDark, v(0.45, 2.15, -hd + 0.08), [0, 0, 0.2], [0.22, 0.08, 0.05], m);
  b.place(box(0.005), C.metal, v(0.9, 1.95, -hd + 0.07), [0, 0, -0.3], [0.06, 0.5, 0.02], m);
  b.place(torus(0.3), C.metal, v(0.83, 2.2, -hd + 0.07), [0, 0, 0], 0.05, m);
  b.place(box(0.005), C.metal, v(1.55, 1.85, -hd + 0.07), [0, 0, 0.1], [0.5, 0.2, 0.01], m);
  b.place(box(0.01), C.clay, v(1.25, 1.88, -hd + 0.08), [0, 0, 0.1], [0.14, 0.14, 0.04], m);
  b.place(box(0.005), C.clay, v(2.1, 1.95, -hd + 0.07), [0, 0, 0.35], [0.05, 0.35, 0.03], m);
  b.place(box(0.005), C.clay, v(2.2, 1.95, -hd + 0.07), [0, 0, -0.35], [0.05, 0.35, 0.03], m);
  const sketch = (x: number, y: number, rot: number, w: number, h: number, kind: "plane" | "rocket" | "robot"): void => {
    b.place(box(0.003), C.paper, v(x, y, -hd + 0.03), [0, 0, rot], [w, h, 0.01], m);
    b.place(sphere("low"), C.clay, v(x, y + h / 2 - 0.04, -hd + 0.045), [0, 0, 0], 0.025, m);
    const ink = (dx: number, dy: number, len: number, a: number): void => {
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      b.place(box(0.002), C.ink, v(x + dx * cr - dy * sr, y + dx * sr + dy * cr, -hd + 0.04), [0, 0, rot + a], [len, 0.012, 0.004], m);
    };
    if (kind === "plane") {
      ink(-0.05, 0.02, 0.3, 0.25);
      ink(-0.05, -0.04, 0.3, -0.1);
      ink(0.1, 0.0, 0.12, 1.1);
    } else if (kind === "rocket") {
      ink(0, 0, 0.26, Math.PI / 2);
      ink(0.04, 0, 0.26, Math.PI / 2);
      ink(0.02, 0.15, 0.08, 0.8);
      ink(-0.03, -0.12, 0.08, 0.6);
    } else {
      ink(0, 0.05, 0.12, 0);
      ink(0, -0.03, 0.12, 0);
      ink(-0.06, 0.01, 0.08, Math.PI / 2);
      ink(0.06, 0.01, 0.08, Math.PI / 2);
      ink(0, 0.11, 0.06, Math.PI / 2);
    }
  };
  sketch(-2.2, 2.05, 0.06, 0.46, 0.34, "plane");
  sketch(-1.55, 1.9, -0.05, 0.36, 0.46, "rocket");
  sketch(-0.85, 2.1, 0.04, 0.4, 0.34, "robot");
  sketch(-1.25, 1.45, -0.08, 0.34, 0.26, "plane");
  // A string of tiny paper flags across the wall.
  for (let i = 0; i < 9; i += 1) {
    const x = -2.6 + i * 0.32;
    const sag = Math.sin((i / 8) * Math.PI) * 0.12;
    b.place(cone(3), [C.clay, C.amber, C.sage, "#6E8FB0"][i % 4]!, v(x, 2.55 - sag, -hd + 0.06), [0, 0, Math.PI], [0.07, 0.14, 0.01], m);
  }

  // Shelf on the left wall with jars and boxes.
  b.place(box(0.01), C.wood, v(-hw + 0.2, 1.75, 0.2), [0, 0, 0], [0.34, 0.05, 1.6], m);
  for (let i = 0; i < 5; i += 1) {
    const z = -0.45 + i * 0.32;
    const color = [C.amber, "#6E8FB0", C.clay, C.sage, C.paper][i]!;
    if (i % 2) b.place(box(0.02), color, v(-hw + 0.2, 1.88, z), [0, 0.2 * i, 0], [0.22, 0.2, 0.2], m);
    else b.place(cylinder(10), color, v(-hw + 0.2, 1.89, z), [0, 0, 0], [0.09, 0.22, 0.09], m);
  }

  // ---- On the bench ----
  // Dad's lamp: the one that turns itself on every evening.
  // A hinged desk lamp: weighted base, twin lower arm, elbow, a green enamel
  // shade with a brass rim, and a bulb that peeks out of the mouth. The bulb
  // and the warm inside of the shade are their own meshes so they stay lit
  // while the rest of the planet's lights are still off on the title.
  const lampX = -2.25;
  const z0 = BENCH_Z - 0.1;
  const baseTop = new Vector3(lampX, BENCH_Y + 0.08, z0);
  const elbow = new Vector3(lampX - 0.05, BENCH_Y + 0.52, z0 - 0.06);
  const head = new Vector3(lampX + 0.24, BENCH_Y + 0.66, z0 + 0.12);
  const aim = new Vector3(0.5, -0.78, 0.38).normalize();
  b.place(cylinder(20), C.ink, v(lampX, BENCH_Y + 0.024, z0), [0, 0, 0], [0.15, 0.048, 0.15], m);
  b.place(cylinder(16), C.brass, v(lampX, BENCH_Y + 0.062, z0), [0, 0, 0], [0.05, 0.03, 0.05], m);
  for (const dx of [-0.022, 0.022]) rod(b, baseTop.clone().setX(baseTop.x + dx), elbow.clone().setX(elbow.x + dx), 0.011, LAMP_BRASS, m);
  b.place(sphere("low"), C.ink, [elbow.x, elbow.y, elbow.z], [0, 0, 0], 0.034, m);
  rod(b, elbow, head, 0.013, LAMP_BRASS, m);
  b.place(sphere("low"), C.ink, [head.x, head.y, head.z], [0, 0, 0], 0.03, m);
  const shadeCenter = head.clone().addScaledVector(aim, 0.07);
  b.place(cylinder(20, 0.42), "#2C5848", [shadeCenter.x, shadeCenter.y, shadeCenter.z], alignTo(UP, aim.clone().negate()), [0.13, 0.17, 0.13], m);
  const mouth = head.clone().addScaledVector(aim, 0.155);
  b.place(torus(0.16), LAMP_BRASS, [mouth.x, mouth.y, mouth.z], alignTo(FORWARD, aim), 0.13, m);
  const lampBulbLocal = mouth.clone().addScaledVector(aim, 0.012);
  // The pull switch: a little brass knuckle clipped onto the side of the rim,
  // and a beaded chain that hangs straight down from it with a bell pull.
  // The side direction is level and square to the shade's aim, so the chain
  // starts on the rim itself and falls clear of the opening.
  const side = new Vector3().crossVectors(UP, aim).normalize();
  const clip = mouth.clone().addScaledVector(side, 0.132);
  b.place(sphere("low"), LAMP_BRASS, [clip.x, clip.y, clip.z], [0, 0, 0], 0.016, m);
  const beads = 9;
  for (let i = 1; i <= beads; i += 1) {
    b.place(sphere("tiny"), "#8A6A35", [clip.x, clip.y - 0.006 - i * 0.017, clip.z], [0, 0, 0], 0.0062, m);
  }
  const pullY = clip.y - 0.006 - beads * 0.017 - 0.022;
  b.place(cylinder(10, 0.45), LAMP_BRASS, [clip.x, pullY, clip.z], [0, 0, 0], [0.013, 0.03, 0.013], m);
  b.place(sphere("low"), LAMP_BRASS, [clip.x, pullY - 0.017, clip.z], [0, 0, 0], 0.013, m);

  // The notebook, open, with a pencil.
  b.place(box(0.01), C.clay, v(-1.45, BENCH_Y + 0.015, BENCH_Z + 0.1), [0, 0.12, 0], [0.62, 0.03, 0.42], m);
  for (const side of [-1, 1]) {
    b.place(box(0.006), C.paper, v(-1.45 + side * 0.15, BENCH_Y + 0.04 + 0.01 * side * 0, BENCH_Z + 0.1), [0, 0.12, side * -0.06], [0.29, 0.025, 0.38], m);
    for (let i = 0; i < 4; i += 1) {
      b.place(box(0.002), "#8C8072", v(-1.45 + side * 0.15, BENCH_Y + 0.055, BENCH_Z + 0.0 + i * 0.065), [0, 0.12, side * -0.06], [0.22, 0.004, 0.008], m);
    }
  }
  b.place(cylinder(6), C.amber, v(-1.05, BENCH_Y + 0.02, BENCH_Z + 0.28), [0, 0.9, Math.PI / 2], [0.012, 0.26, 0.012], m);
  b.place(cone(6), C.woodLight, v(-0.93, BENCH_Y + 0.02, BENCH_Z + 0.37), [0, 0.9, -Math.PI / 2], [0.012, 0.04, 0.012], m);

  // Four glass domes, each with one of Dad's little worlds inside.
  const glass: Object3D[] = [];
  const glassMaterial = toon.glass("#FFF6E0");

  // The lamp's lit parts: the warm inside of the shade, the bulb, a soft halo
  // and a pool of light on the bench. Unlit, so they glow at any power level.
  const quaternion = new Quaternion().setFromRotationMatrix(m);
  const lit = (mesh: Mesh, local: Vector3, order: number): void => {
    mesh.position.copy(local.clone().applyMatrix4(m));
    mesh.quaternion.premultiply(quaternion);
    mesh.renderOrder = order;
    glass.push(mesh);
  };
  const inner = new Mesh(cylinder(20), new MeshBasicMaterial({ color: "#FFE2AE" }));
  inner.scale.set(0.118, 0.004, 0.118);
  inner.quaternion.setFromEuler(new Euler(...alignTo(UP, aim)));
  lit(inner, mouth.clone().addScaledVector(aim, -0.004), 0);
  const bulb = new Mesh(sphere("mid"), new MeshBasicMaterial({ color: "#FFF4D6" }));
  bulb.scale.setScalar(0.05);
  lit(bulb, lampBulbLocal, 0);
  const halo = new Mesh(sphere("mid"), new MeshBasicMaterial({ color: "#FFB65C", transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.13);
  lit(halo, lampBulbLocal, 9);
  const pool = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }));
  pool.scale.set(0.9, 0.7, 1);
  pool.quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  lit(pool, new Vector3(lampBulbLocal.x + 0.2, BENCH_Y + 0.004, lampBulbLocal.z + 0.12), 7);
  const lampGlow: Object3D[] = [inner, bulb, halo, pool];
  const domeGeometry = new SphereGeometry(0.24, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const worlds: { x: number; ground: string; detail: (x: number, y: number, z: number) => void }[] = [
    {
      x: 0.25,
      ground: "#B9B4AA",
      detail: (x, y, z) => {
        // Tranquility Base: a tiny gold lander and a mirror panel.
        b.place(box(0.004), C.brass, v(x, y + 0.13, z), [0, 0.4, 0], [0.05, 0.03, 0.05], m);
        for (const dx of [-1, 1]) b.place(cylinder(4), C.metal, v(x + dx * 0.025, y + 0.11, z), [0, 0, dx * 0.5], [0.004, 0.04, 0.004], m);
        b.place(box(0.002), "#59607A", v(x + 0.05, y + 0.11, z + 0.05), [0.6, 0, 0], [0.03, 0.002, 0.03], m);
      },
    },
    {
      x: 0.85,
      ground: "#A9A49A",
      detail: (x, y, z) => {
        // Hadley: a tiny rover by a groove.
        b.place(box(0.004), C.metal, v(x, y + 0.125, z + 0.02), [0.2, 0.3, 0], [0.05, 0.012, 0.03], m);
        b.place(box(0.002), "#59607A", v(x - 0.02, y + 0.1, z - 0.03), [0.5, 0.6, 0], [0.02, 0.004, 0.11], m);
      },
    },
    {
      x: 1.45,
      ground: "#B5643A",
      detail: (x, y, z) => {
        // Meridiani: a tiny rover with blue solar wings.
        b.place(box(0.004), "#4C5A7A", v(x, y + 0.128, z + 0.02), [0.25, -0.4, 0], [0.06, 0.004, 0.04], m);
        b.place(cylinder(4), C.metal, v(x, y + 0.145, z + 0.01), [0, 0, 0], [0.004, 0.03, 0.004], m);
      },
    },
    {
      x: 2.05,
      ground: "#8E3F2A",
      detail: (x, y, z) => {
        // Jezero: a tiny helicopter with crossed blades.
        b.place(box(0.004), C.metal, v(x, y + 0.13, z + 0.02), [0.3, 0, 0], [0.018, 0.018, 0.018], m);
        b.place(box(0.001), C.paper, v(x, y + 0.16, z + 0.025), [0.3, 0.5, 0], [0.07, 0.002, 0.008], m);
        b.place(box(0.001), C.paper, v(x, y + 0.165, z + 0.025), [0.3, -0.5, 0], [0.07, 0.002, 0.008], m);
      },
    },
  ];
  for (const world of worlds) {
    const z = BENCH_Z - 0.05;
    b.place(cylinder(24), C.woodDark, v(world.x, BENCH_Y + 0.03, z), [0, 0, 0], [0.27, 0.06, 0.27], m);
    b.place(cylinder(24), C.brass, v(world.x, BENCH_Y + 0.065, z), [0, 0, 0], [0.25, 0.012, 0.25], m);
    // The little planet, sunk into the base so it reads as a world under glass.
    b.place(sphere("mid"), world.ground, v(world.x, BENCH_Y + 0.0, z), [0, 0, 0], 0.17, m);
    world.detail(world.x, BENCH_Y - 0.0, z);
    // Dad's paper tag on a stake.
    b.place(cylinder(4), C.woodDark, v(world.x + 0.2, BENCH_Y + 0.12, z + 0.22), [0, 0, 0], [0.006, 0.18, 0.006], m);
    b.place(box(0.003), C.paper, v(world.x + 0.2, BENCH_Y + 0.2, z + 0.225), [0, -0.2, 0.08], [0.11, 0.065, 0.006], m);
    b.place(box(0.001), C.ink, v(world.x + 0.2, BENCH_Y + 0.205, z + 0.23), [0, -0.2, 0.08], [0.07, 0.006, 0.002], m);
    b.place(box(0.001), C.ink, v(world.x + 0.19, BENCH_Y + 0.188, z + 0.23), [0, -0.2, 0.08], [0.05, 0.006, 0.002], m);

    const dome = new Mesh(domeGeometry, glassMaterial);
    const p = new Vector3(world.x, BENCH_Y + 0.07, z).applyMatrix4(m);
    dome.position.copy(p);
    dome.quaternion.setFromRotationMatrix(m);
    dome.renderOrder = 8;
    glass.push(dome);
  }

  // Coffee mug and a jar of screws.
  b.place(cylinder(14), "#E8E0D0", v(2.35, BENCH_Y + 0.07, BENCH_Z + 0.25), [0, 0, 0], [0.06, 0.13, 0.06], m);
  b.place(torus(0.25), "#E8E0D0", v(2.42, BENCH_Y + 0.08, BENCH_Z + 0.25), [0, 0, Math.PI / 2], 0.04, m);
  b.place(cylinder(14), "#4A2C20", v(2.35, BENCH_Y + 0.13, BENCH_Z + 0.25), [0, 0, 0], [0.052, 0.005, 0.052], m);
  for (let i = 0; i < 14; i += 1) {
    const a = i * 2.4;
    b.place(box(0.002), i % 3 ? C.metal : C.brass, v(2.5 + Math.cos(a) * 0.035, BENCH_Y + 0.02 + (i % 5) * 0.022, BENCH_Z - 0.3 + Math.sin(a) * 0.035), [a, a * 0.5, 0], [0.012, 0.035, 0.012], m);
  }
  b.place(cylinder(12), C.clay, v(2.5, BENCH_Y + 0.155, BENCH_Z - 0.3), [0, 0, 0], [0.065, 0.02, 0.065], m);
  const jar = new Mesh(cylinderGlass(), glassMaterial);
  jar.position.copy(new Vector3(2.5, BENCH_Y + 0.075, BENCH_Z - 0.3).applyMatrix4(m));
  jar.quaternion.setFromRotationMatrix(m);
  jar.scale.set(0.075, 0.095, 0.075);
  jar.renderOrder = 8;
  glass.push(jar);

  // The small solar lamp on the right window sill.
  b.place(box(0.01), C.ink, v(hw - 0.12, 1.29, -0.2), [0, 0, 0], [0.12, 0.06, 0.12], m);
  b.place(box(0.01), "#2E3B5C", v(hw - 0.12, 1.33, -0.2), [0, 0, 0], [0.1, 0.02, 0.1], m);
  b.place(cylinder(10), "#FFE2A6", v(hw - 0.12, 1.21, -0.2), [0, 0, 0], [0.04, 0.08, 0.04], m, "glow");

  // ---- Side table with the two globes ----
  const tableX = 2.25;
  const tableZ = -0.35;
  const tableY = fy + 0.74;
  b.place(box(0.02), C.wood, v(tableX, tableY, tableZ), [0, 0, 0], [0.9, 0.06, 0.62], m);
  for (const dx of [-0.38, 0.38]) for (const dz of [-0.24, 0.24]) {
    b.place(box(0.01), C.woodDark, v(tableX + dx, (fy + tableY) / 2, tableZ + dz), [0, 0, 0], [0.06, tableY - fy, 0.06], m);
  }
  const globes: Group[] = [];
  const pins: { head: Mesh; halo: Mesh; color: string }[] = [];
  // Dad's worlds get amber pins; the machines on his archive cards get blue ones.
  const ARCHIVE_PIN = "#6E9BC8";
  const globeSpots = [
    { x: tableX - 0.2, texture: globeTextures.moon, pins: [fact("a11-site"), fact("a15-site")], archive: [fact("sur3-site"), fact("a14-lrrr-site")], face: fact("a11-site") },
    { x: tableX + 0.22, texture: globeTextures.mars, pins: [fact("opp-site"), fact("ing-site")], archive: [fact("soj-site"), fact("vik1-site"), fact("spi-site"), fact("ins-site")], face: fact("opp-site") },
  ];
  for (const spot of globeSpots) {
    const baseY = tableY + 0.03;
    b.place(cylinder(16), C.woodDark, v(spot.x, baseY + 0.02, tableZ), [0, 0, 0], [0.09, 0.04, 0.09], m);
    b.place(cylinder(6), C.brass, v(spot.x, baseY + 0.1, tableZ), [0, 0, 0], [0.012, 0.14, 0.012], m);
    // The meridian ring.
    b.place(torus(0.04, Math.PI * 1.25), C.brass, v(spot.x, baseY + 0.36, tableZ), [0, Math.PI / 2, -Math.PI * 0.62 - 0.2], 0.2, m);

    const globe = new Group();
    globe.name = "globe";
    spot.texture.colorSpace = SRGBColorSpace;
    const material = toon.track(new MeshToonMaterial({ map: spot.texture, gradientMap: toon.bands }));
    const ball = new Mesh(new SphereGeometry(0.17, 40, 24), material);
    ball.castShadow = true;
    globe.add(ball);
    for (const pin of [...spot.pins, ...spot.archive]) {
      const color = spot.archive.includes(pin) ? ARCHIVE_PIN : C.amber;
      const { lat, lon } = factCoords(pin);
      const dir = globeDir(lat, lon);
      const needle = new Mesh(cylinder(6), toon.toon({ color: C.metal, objectSpace: true }));
      needle.scale.set(0.004, 0.05, 0.004);
      needle.position.copy(dir).multiplyScalar(0.17 + 0.022);
      needle.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
      const head = new Mesh(sphere("low"), toon.glow(color));
      head.scale.setScalar(0.016);
      head.position.copy(dir).multiplyScalar(0.17 + 0.05);
      head.name = `pin-${pin.id}`;
      const halo = new Mesh(sphere("low"), new MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(0.034);
      halo.position.copy(head.position);
      halo.renderOrder = 9;
      globe.add(needle, head, halo);
      pins.push({ head, halo, color });
    }
    // Turn the globe so the first pin faces into the room, with a desk-globe tilt.
    const { lon } = factCoords(spot.face);
    const spin = new Group();
    spin.add(globe);
    globe.rotation.y = -(Math.PI / 2 + lon * DEG) + 0.35;
    spin.rotation.z = 0.2;
    const holder = new Group();
    holder.add(spin);
    holder.position.copy(new Vector3(spot.x, baseY + 0.36, tableZ).applyMatrix4(m));
    holder.quaternion.setFromRotationMatrix(m);
    globes.push(holder);
  }

  // ---- Dad's archive: a corkboard on the right wall with a card for each machine he never built a world for ----
  {
    const bx = hw - 0.04;
    const bz = 1.35;
    const by = 1.55;
    b.place(box(0.01), C.woodDark, v(bx, by, bz), [0, 0, 0], [0.05, 0.86, 1.42], m);
    b.place(box(0.006), "#C9995F", v(bx - 0.02, by, bz), [0, 0, 0], [0.03, 0.76, 1.32], m);
    // A header plank with a brass plate.
    b.place(box(0.01), C.wood, v(bx - 0.01, by + 0.5, bz), [0, 0, 0], [0.05, 0.1, 1.0], m);
    b.place(box(0.004), C.brass, v(bx - 0.04, by + 0.5, bz), [0, 0, 0], [0.01, 0.055, 0.42], m);
    const swatch = ["#B9B4AA", "#C9683F", "#C08560", "#A9572F", "#D49A6A", "#9E9A92"];
    for (let i = 0; i < 6; i += 1) {
      const z = bz + (i % 3 - 1) * 0.42;
      const y = by + (i < 3 ? 0.17 : -0.19);
      const tilt = ((i * 37) % 7 - 3) * 0.025;
      b.place(box(0.004), C.paper, v(bx - 0.045, y, z), [tilt, 0, 0], [0.01, 0.3, 0.34], m);
      b.place(box(0.003), swatch[i]!, v(bx - 0.052, y + 0.05, z), [tilt, 0, 0], [0.006, 0.14, 0.28], m);
      for (const dy of [-0.07, -0.105]) b.place(box(0.002), C.ink, v(bx - 0.052, y + dy, z - 0.03), [tilt, 0, 0], [0.004, 0.012, 0.22], m);
      b.place(sphere("low"), C.clay, v(bx - 0.06, y + 0.13, z), [0, 0, 0], 0.018, m);
    }
  }

  // ---- Dad's newest dome: the Ocean of Storms, on a round plant stand under the archive board ----
  const bonusX = hw - 0.42;
  const bonusZ = 0.98;
  const standTop = fy + 0.8;
  {
    b.place(cylinder(20), C.woodDark, v(bonusX, standTop, bonusZ), [0, 0, 0], [0.24, 0.05, 0.24], m);
    b.place(cylinder(20), C.wood, v(bonusX, standTop + 0.03, bonusZ), [0, 0, 0], [0.22, 0.012, 0.22], m);
    b.place(cylinder(10, 0.8), C.woodDark, v(bonusX, fy + 0.42, bonusZ), [0, 0, 0], [0.045, 0.74, 0.045], m);
    b.place(sphere("low"), C.wood, v(bonusX, fy + 0.6, bonusZ), [0, 0, 0], [0.07, 0.05, 0.07], m);
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      b.place(box(0.01), C.woodDark, v(bonusX + Math.cos(a) * 0.13, fy + 0.04, bonusZ + Math.sin(a) * 0.13), [0, -a, 0.35], [0.26, 0.05, 0.05], m);
    }
    b.place(cylinder(24), C.brass, v(bonusX, standTop + 0.045, bonusZ), [0, 0, 0], [0.2, 0.012, 0.2], m);
    // The little world: grey Moon dust, a crater with a tan tripod robot in it, and a gold lander on the rim.
    b.place(sphere("mid"), "#B2ADA4", v(bonusX, standTop - 0.04, bonusZ), [0, 0, 0], 0.14, m);
    b.place(cylinder(14), "#8E8A84", v(bonusX - 0.02, standTop + 0.097, bonusZ + 0.02), [0, 0, 0], [0.075, 0.006, 0.075], m);
    b.place(torus(0.2), "#CFCAC0", v(bonusX - 0.02, standTop + 0.1, bonusZ + 0.02), [Math.PI / 2, 0, 0], [0.078, 0.078, 0.04], m);
    // Surveyor: a tan tripod with its little flat panel on top.
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      b.place(cylinder(4), "#C9B48E", v(bonusX - 0.02 + Math.sin(a) * 0.016, standTop + 0.125, bonusZ + 0.02 + Math.cos(a) * 0.016), [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], [0.004, 0.055, 0.004], m);
    }
    b.place(box(0.002), "#2B3A63", v(bonusX - 0.02, standTop + 0.158, bonusZ + 0.02), [0.4, 0.4, 0], [0.04, 0.003, 0.03], m);
    // Intrepid on the rim: a gold box on four legs.
    b.place(cylinder(8), C.brass, v(bonusX + 0.07, standTop + 0.13, bonusZ - 0.06), [0, 0.4, 0], [0.032, 0.03, 0.032], m);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.place(cylinder(4), C.metal, v(bonusX + 0.07 + Math.sin(a) * 0.035, standTop + 0.11, bonusZ - 0.06 + Math.cos(a) * 0.035), [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], [0.003, 0.03, 0.003], m);
    }
    // Dad's tag on a stake, folded like the bench ones.
    b.place(cylinder(4), C.woodDark, v(bonusX - 0.2, standTop + 0.12, bonusZ + 0.12), [0, 0, 0], [0.006, 0.18, 0.006], m);
    b.place(box(0.003), C.paper, v(bonusX - 0.205, standTop + 0.2, bonusZ + 0.125), [0, 0.9, 0.08], [0.11, 0.065, 0.006], m);
    b.place(box(0.001), C.ink, v(bonusX - 0.21, standTop + 0.205, bonusZ + 0.13), [0, 0.9, 0.08], [0.07, 0.006, 0.002], m);
    const dome = new Mesh(domeGeometry, glassMaterial);
    dome.position.copy(new Vector3(bonusX, standTop + 0.05, bonusZ).applyMatrix4(m));
    dome.quaternion.setFromRotationMatrix(m);
    dome.scale.setScalar(0.85);
    dome.renderOrder = 8;
    glass.push(dome);
  }
  // A dust cloth over it, tied with string, until the dome opens.
  const bonusCover = new Group();
  {
    const cloth = toon.toon({ color: "#D9CDB4", paint: 0.2 });
    const drape = new Mesh(new SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth);
    drape.position.set(0, 0.035, 0);
    drape.scale.set(1, 1.08, 1);
    const hem = new Mesh(new CylinderGeometry(0.19, 0.214, 0.12, 18, 1, true), cloth);
    hem.position.set(0, 0.0, 0);
    // Soft folds where the cloth hangs down.
    const fold = toon.toon({ color: "#C2B596", paint: 0.2 });
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const crease = new Mesh(new CylinderGeometry(0.006, 0.014, 0.11, 5), fold);
      crease.position.set(Math.sin(a) * 0.203, -0.005, Math.cos(a) * 0.203);
      crease.rotation.set(Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12);
      bonusCover.add(crease);
    }
    const knot = new Mesh(sphere("low"), toon.toon({ color: C.clay }));
    knot.scale.setScalar(0.022);
    knot.position.set(0, 0.27, 0);
    const string = new Mesh(new TorusGeometry(0.19, 0.006, 4, 24), toon.toon({ color: C.clay }));
    string.rotation.x = Math.PI / 2;
    string.position.set(0, 0.07, 0);
    for (const part of [drape, hem, knot, string]) {
      part.castShadow = true;
      bonusCover.add(part);
    }
    bonusCover.position.copy(new Vector3(bonusX, standTop + 0.06, bonusZ).applyMatrix4(m));
    bonusCover.quaternion.setFromRotationMatrix(m);
  }

  // ---- Remi's museum shelf on the left wall: it fills up as the stamps come ----
  const museum = buildMuseum(b, toon, m, -hw + 0.01);

  // ---- Floor things ----
  b.place(cylinder(32), "#8E4E35", v(-0.2, fy + 0.012, 0.45), [0, 0, 0], [1.3, 0.02, 1.3], m);
  b.place(cylinder(32), C.amber, v(-0.2, fy + 0.016, 0.45), [0, 0, 0], [1.0, 0.02, 1.0], m);
  b.place(cylinder(32), "#8E4E35", v(-0.2, fy + 0.02, 0.45), [0, 0, 0], [0.75, 0.02, 0.75], m);
  b.place(cylinder(32), C.sage, v(-0.2, fy + 0.024, 0.45), [0, 0, 0], [0.45, 0.02, 0.45], m);
  // Stool by the bench.
  b.place(cylinder(16), C.woodLight, v(0.55, fy + 0.6, -0.95), [0, 0, 0], [0.22, 0.06, 0.22], m);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    b.place(cylinder(6), C.woodDark, v(0.55 + Math.cos(a) * 0.14, fy + 0.3, -0.95 + Math.sin(a) * 0.14), [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12], [0.022, 0.6, 0.022], m);
  }
  // Red toolbox and a stack of crates.
  b.place(box(0.03), C.clay, v(-2.45, fy + 0.15, 0.6), [0, 0.3, 0], [0.55, 0.3, 0.28], m);
  b.place(box(0.01), C.ink, v(-2.45, fy + 0.34, 0.6), [0, 0.3, 0], [0.3, 0.05, 0.05], m);
  for (const [x, y, z, r] of [[-2.45, 0.25, 1.75, 0.1], [-2.4, 0.75, 1.72, -0.15], [-1.85, 0.25, 1.95, 0.4]] as const) {
    b.place(box(0.02), C.woodLight, v(x, fy + y, z), [0, r, 0], [0.5, 0.5, 0.5], m);
    b.place(box(0.01), C.wood, v(x, fy + y, z), [0, r, 0], [0.52, 0.08, 0.52], m);
    // String tie and a paper label, so the crates look packed by hand.
    b.place(box(0.005), C.paper, v(x, fy + y, z), [0, r, 0], [0.04, 0.515, 0.515], m);
    b.place(box(0.004), C.paper, v(x, fy + y - 0.1, z), [0, r, 0], [0.18, 0.11, 0.53], m);
  }
  // A coiled cable and a watering can by the door.
  b.place(torus(0.15), C.ink, v(1.75, fy + 0.03, 2.1), [Math.PI / 2, 0, 0], 0.22, m);
  b.place(cylinder(12), C.sage, v(2.5, fy + 0.18, 2.05), [0, 0, 0], [0.13, 0.32, 0.13], m);
  b.place(cylinder(6, 0.5), C.sage, v(2.36, fy + 0.25, 2.18), [0.5, 0.7, 0], [0.03, 0.3, 0.03], m);

  const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(m);
  const inward = new Vector3(0, 0, -1).transformDirection(m);
  const shellShapes: Shape[] = [
    { kind: "box", x: 0, z: -hd - 0.1, halfWidth: hw + 0.3, halfDepth: 0.15, height: 4.2 },
    { kind: "box", x: -hw - 0.1, z: 0, halfWidth: 0.15, halfDepth: hd + 0.3, height: 4.2 },
    { kind: "box", x: hw + 0.1, z: 0, halfWidth: 0.15, halfDepth: hd + 0.3, height: 4.2 },
    // The floor is a low step.
    { kind: "box", x: 0, z: 0, halfWidth: hw + 0.3, halfDepth: hd + 0.3, height: fy + 0.02 },
    { kind: "box", x: 0, z: BENCH_Z, halfWidth: benchHalf, halfDepth: 0.5, height: BENCH_Y },
    { kind: "box", x: tableX, z: tableZ, halfWidth: 0.45, halfDepth: 0.31, height: tableY },
    { kind: "circle", x: 0.55, z: -0.95, radius: 0.24, height: fy + 0.63 },
    { kind: "box", x: -2.45, z: 0.6, halfWidth: 0.3, halfDepth: 0.2, height: fy + 0.36 },
    { kind: "box", x: -2.25, z: 1.8, halfWidth: 0.55, halfDepth: 0.4, height: fy + 1.0 },
    { kind: "circle", x: 2.5, z: 2.05, radius: 0.15, height: fy + 0.35 },
    { kind: "circle", x: bonusX, z: bonusZ, radius: 0.26, height: standTop + 0.3 },
  ];
  const frontShapes: Shape[] = [
    { kind: "box", x: -(doorHalf + sideWidth / 2), z: hd + 0.1, halfWidth: sideWidth / 2, halfDepth: 0.13, height: 4.2 },
    { kind: "box", x: doorHalf + sideWidth / 2, z: hd + 0.1, halfWidth: sideWidth / 2, halfDepth: 0.13, height: 4.2 },
    // The open door leaf.
    { kind: "box", x: doorHalf + 0.45, z: hd + 0.7, halfWidth: 0.7, halfDepth: 0.06, rotation: -1.25, height: 2.1 },
  ];

  const inverse = m.clone().invert();
  const scratch = new Vector3();
  return {
    shellShapes,
    frontShapes,
    frontWall,
    roof,
    glass,
    globes,
    lampGlow,
    pins,
    archive: { stand: at(hw - 0.85, fy, 1.7), board: at(hw - 0.06, 1.55, 1.35) },
    lampBulb: at(lampBulbLocal.x, lampBulbLocal.y, lampBulbLocal.z),
    lampSpot: at(lampX + 0.3, fy, BENCH_Z + 0.85),
    miloSpot: { position: at(-0.55, BENCH_Y, BENCH_Z - 0.05), forward: inward.clone().negate() },
    friends: [
      { position: at(-1.95, fy, 1.15), forward: new Vector3(1, 0, -0.6).normalize().transformDirection(m) },
      { position: at(1.55, fy, 0.55), forward: new Vector3(0.7, 0, -1).normalize().transformDirection(m) },
      { position: at(0.95, fy, -0.75), forward: new Vector3(-0.6, 0, -1).normalize().transformDirection(m) },
    ],
    benchFront: at(-0.55, fy, BENCH_Z + 1.0),
    domes: [0.25, 0.85, 1.45, 2.05].map((x) => ({ top: at(x, BENCH_Y + 0.34, BENCH_Z - 0.05), stand: at(x, fy, BENCH_Z + 0.85) })),
    bonusDome: { top: at(bonusX, standTop + 0.27, bonusZ), stand: at(bonusX - 0.75, fy, bonusZ - 0.12), cover: bonusCover },
    museum,
    dustCenter: at(-1.4, 1.5, -1.2),
    isInside(point: Vector3, margin: number): boolean {
      scratch.copy(point).applyMatrix4(inverse);
      return Math.abs(scratch.x) < hw + margin && scratch.z > -hd - margin && scratch.z < hd + margin && scratch.y < wh;
    },
  };
}

function materials(toon: ToonLibrary): Partial<Record<Layer, Material>> {
  return { solid: toon.toon({ vertexColors: true, paint: 0.14 }), glow: toon.glow("#ffffff", true), foliage: toon.toon({ vertexColors: true, paint: 0.14, sway: true }) };
}

/** The lamp sits right under its own bulb, so its brass is mixed darker to keep it from washing out. */
const LAMP_BRASS = "#A97A33";
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

/** Euler angles that turn `from` onto `to`. */
function alignTo(from: Vector3, to: Vector3): [number, number, number] {
  const e = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(from, to.clone().normalize()));
  return [e.x, e.y, e.z];
}

/** A round rod between two points. */
function rod(b: Batcher, from: Vector3, to: Vector3, radius: number, color: string, m: Matrix4): void {
  const dir = to.clone().sub(from);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  b.place(cylinder(8), color, [mid.x, mid.y, mid.z], alignTo(UP, dir), [radius, dir.length(), radius], m);
}

let poolMap: CanvasTexture | null = null;
/** A soft round falloff for the lamp's pool of light. */
function poolTexture(): CanvasTexture {
  if (poolMap) return poolMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,190,110,1)");
  g.addColorStop(0.5, "rgba(255,170,90,0.45)");
  g.addColorStop(1, "rgba(255,160,80,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  poolMap = new CanvasTexture(canvas);
  poolMap.colorSpace = SRGBColorSpace;
  return poolMap;
}

let jarGeometry: SphereGeometry | null = null;
function cylinderGlass(): SphereGeometry {
  // A squat rounded jar, from a stretched sphere.
  jarGeometry ??= new SphereGeometry(1, 16, 10);
  return jarGeometry;
}

export { materials as workshopMaterials };
