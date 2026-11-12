import { BufferAttribute, BufferGeometry, Color, type ColorRepresentation, type Material, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * The model kit. Dad's worlds are built like model kits: many small painted
 * pieces. We paint each piece with a vertex color and merge every still piece
 * that shares a material into one mesh, so a whole world draws in a handful of
 * calls.
 *
 * Layers:
 * - solid: lit toon pieces
 * - glow: unlit pieces such as windows and bulbs
 * - foliage: lit toon pieces that sway in the wind. Each vertex gets a sway
 *   weight from its height inside its own shape, so roots and trunks stay put
 *   and tips move.
 * - detail: foliage too small to cast a useful shadow (grass, flowers). It
 *   skips the shadow pass, which saves draw time and keeps the lawn free of
 *   speckled shadow dots.
 */
export type Layer = "solid" | "glow" | "foliage" | "detail";
const LAYERS: Layer[] = ["solid", "glow", "foliage", "detail"];

interface Piece {
  geometry: BufferGeometry;
  layer: Layer;
}

const tmpColor = new Color();
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpPos = new Vector3();

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Keeps only position, normal, color and sway, with an index, so any pieces can merge. */
const lightPaint = new Color("#ffe8cc");
const paint = new Color();

function normalize(geometry: BufferGeometry, color: Color, sway: number): BufferGeometry {
  const g = geometry.clone();
  // Optional per-vertex paint: above 0 lightens toward warm light, below 0 darkens (hair sheen and undersides).
  const shade = g.getAttribute("aShade");
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const position = g.getAttribute("position");
  const count = position.count;
  if (!g.index) {
    const index = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i += 1) index[i] = i;
    g.setIndex(new BufferAttribute(index, 1));
  }
  const colors = new Float32Array(count * 3);
  const weights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const s = shade ? shade.getX(i) : 0;
    if (s > 0) paint.copy(color).lerp(lightPaint, s);
    else paint.copy(color).multiplyScalar(1 + s * 0.6);
    colors[i * 3] = paint.r;
    colors[i * 3 + 1] = paint.g;
    colors[i * 3 + 2] = paint.b;
    // Unit shapes run from about -0.5 (or -1) to 0.5 (or 1) in Y.
    weights[i] = sway > 0 ? sway * smooth(-0.5, 0.7, position.getY(i)) : 0;
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  g.setAttribute("aSway", new BufferAttribute(weights, 1));
  g.morphAttributes = {};
  return g;
}

export class Batcher {
  private pieces: Piece[] = [];

  /**
   * Adds a painted piece. `matrix` places it in the batch's space.
   * The source geometry is not changed and can be shared.
   * `sway` (foliage only) scales how far the tip moves in the wind.
   */
  add(geometry: BufferGeometry, matrix: Matrix4, color: ColorRepresentation, layer: Layer = "solid", sway = 1): void {
    tmpColor.set(color);
    const g = normalize(geometry, tmpColor, layer === "foliage" || layer === "detail" ? sway : 0);
    g.applyMatrix4(matrix);
    this.pieces.push({ geometry: g, layer });
  }

  /** Same as `add`, with position, rotation (Euler XYZ, radians) and scale. */
  place(
    geometry: BufferGeometry,
    color: ColorRepresentation,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] | number = 1,
    parent?: Matrix4,
    layer: Layer = "solid",
    sway = 1,
  ): void {
    const helper = placeHelper;
    helper.position.set(position[0], position[1], position[2]);
    helper.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (typeof scale === "number") helper.scale.setScalar(scale);
    else helper.scale.set(scale[0], scale[1], scale[2]);
    helper.updateMatrix();
    tmpMatrix.copy(helper.matrix);
    if (parent) tmpMatrix.premultiply(parent);
    this.add(geometry, tmpMatrix, color, layer, sway);
  }

  get size(): number {
    return this.pieces.length;
  }

  /**
   * Merges the pieces of each layer into one mesh. A layer with no material is skipped.
   *
   * With `sectors`, a whole planet's pieces (batch space centered on the planet) are
   * merged into that many wedges by direction instead, each marked `userData.horizon`,
   * so the engine can skip the wedges hidden behind the curve of the world. On a tiny
   * planet that is about half of everything, every frame, in every pass.
   */
  build(materials: Partial<Record<Layer, Material>>, options: { castShadow?: boolean; receiveShadow?: boolean; sectors?: number } = {}): Mesh[] {
    const meshes: Mesh[] = [];
    const sectors = options.sectors ? sectorDirections(options.sectors) : null;
    for (const layer of LAYERS) {
      const material = materials[layer] ?? (layer === "detail" ? materials.foliage : undefined) ?? (layer === "foliage" || layer === "detail" ? materials.solid : undefined);
      const list = this.pieces.filter((piece) => piece.layer === layer).map((piece) => piece.geometry);
      if (list.length === 0 || !material) continue;
      for (const [group, wedge] of sectors ? splitBySector(list, sectors) : [[list, false] as const]) {
        const merged = mergeGeometries(group, false);
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new Mesh(merged, material);
        mesh.name = `batch-${layer}`;
        mesh.matrixAutoUpdate = false;
        if (wedge) mesh.userData["horizon"] = true;
        if (layer !== "glow") {
          mesh.castShadow = layer === "detail" ? false : (options.castShadow ?? true);
          mesh.receiveShadow = options.receiveShadow ?? true;
        }
        meshes.push(mesh);
      }
      for (const g of list) g.dispose();
    }
    this.pieces = [];
    return meshes;
  }
}

const placeHelper = new Object3D();

/** How many wedges a whole world's props and ground are cut into for horizon culling. */
export const SECTORS = 16;

/**
 * Cuts a planet's ground into wedges (see `Batcher.build`), one mesh each,
 * named "planet" and marked for horizon culling. Edges are copied exactly, so
 * the wedges meet without a seam. The source geometry is left as it is.
 */
export function planetMeshes(geometry: BufferGeometry, material: Material, sectors = SECTORS): Mesh[] {
  const directions = sectorDirections(sectors);
  const index = geometry.index;
  const position = geometry.getAttribute("position");
  const triangles = index ? index.count / 3 : position.count / 3;
  const vertex = (i: number): number => (index ? index.getX(i) : i);
  const lists: number[][] = directions.map(() => []);
  const c = new Vector3();
  const p = new Vector3();
  for (let t = 0; t < triangles; t += 1) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k += 1) c.add(p.fromBufferAttribute(position, vertex(t * 3 + k)));
    let best = 0;
    let dot = -Infinity;
    for (let i = 0; i < directions.length; i += 1) {
      const d = directions[i]!.dot(c);
      if (d > dot) {
        dot = d;
        best = i;
      }
    }
    lists[best]!.push(t);
  }
  const meshes: Mesh[] = [];
  for (const list of lists) {
    if (list.length === 0) continue;
    const remap = new Map<number, number>();
    const order: number[] = [];
    const ids = new (list.length * 3 > 65535 ? Uint32Array : Uint16Array)(list.length * 3);
    list.forEach((t, n) => {
      for (let k = 0; k < 3; k += 1) {
        const old = vertex(t * 3 + k);
        let next = remap.get(old);
        if (next === undefined) {
          next = order.length;
          remap.set(old, next);
          order.push(old);
        }
        ids[n * 3 + k] = next;
      }
    });
    if (order.length > 65535 && ids instanceof Uint16Array) throw new Error("planet wedge too big");
    const part = new BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const size = attribute.itemSize;
      const array = new Float32Array(order.length * size);
      order.forEach((old, i) => {
        for (let k = 0; k < size; k += 1) array[i * size + k] = attribute.getComponent(old, k);
      });
      part.setAttribute(name, new BufferAttribute(array, size, attribute.normalized));
    }
    part.setIndex(new BufferAttribute(order.length > 65535 ? new Uint32Array(ids) : ids, 1));
    part.computeBoundingSphere();
    const mesh = new Mesh(part, material);
    mesh.name = "planet";
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.userData["horizon"] = true;
    meshes.push(mesh);
  }
  return meshes;
}

/** Evenly spread directions on a sphere (a Fibonacci spiral). */
function sectorDirections(count: number): Vector3[] {
  const out: Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push(new Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r));
  }
  return out;
}

/**
 * Sorts pieces into wedges by the direction of their middle. Pieces near the
 * planet's center (they could face anywhere) go into one group that is never skipped.
 */
function splitBySector(list: BufferGeometry[], directions: Vector3[]): [BufferGeometry[], boolean][] {
  const groups: BufferGeometry[][] = directions.map(() => []);
  const core: BufferGeometry[] = [];
  for (const g of list) {
    g.computeBoundingSphere();
    const c = g.boundingSphere!.center;
    if (c.length() < 1) {
      core.push(g);
      continue;
    }
    let best = 0;
    let dot = -2;
    for (let i = 0; i < directions.length; i += 1) {
      const d = directions[i]!.dot(c);
      if (d > dot) {
        dot = d;
        best = i;
      }
    }
    groups[best]!.push(g);
  }
  const out: [BufferGeometry[], boolean][] = groups.filter((g) => g.length > 0).map((g) => [g, true]);
  if (core.length) out.push([core, false]);
  return out;
}

/**
 * True when a sphere (world space) is wholly hidden behind a planet of radius
 * `occluder` centered on the origin, as seen from `eye`. Conservative: every
 * sight line to the sphere must pass inside the planet's disc, and the sphere
 * must start beyond the farthest point where such a line could still meet the
 * near side of the planet.
 */
export function behindPlanet(eye: Vector3, occluder: number, center: Vector3, radius: number): boolean {
  const d2 = eye.lengthSq();
  const r2 = occluder * occluder;
  if (d2 <= r2) return false;
  const tangent = Math.sqrt(d2 - r2);
  const toX = center.x - eye.x;
  const toY = center.y - eye.y;
  const toZ = center.z - eye.z;
  const dist = Math.sqrt(toX * toX + toY * toY + toZ * toZ);
  if (dist - radius < tangent || dist <= radius) return false;
  const d = Math.sqrt(d2);
  // Angle between the line to the planet's center and the line to the sphere.
  const cos = -(eye.x * toX + eye.y * toY + eye.z * toZ) / (d * dist);
  const phi = Math.acos(Math.max(-1, Math.min(1, cos)));
  return phi + Math.asin(Math.min(1, radius / dist)) < Math.asin(occluder / d);
}

/** Builds a placement matrix from position, Euler rotation and scale. */
export function transform(
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1,
): Matrix4 {
  placeHelper.position.set(position[0], position[1], position[2]);
  placeHelper.rotation.set(rotation[0], rotation[1], rotation[2]);
  if (typeof scale === "number") placeHelper.scale.setScalar(scale);
  else placeHelper.scale.set(scale[0], scale[1], scale[2]);
  placeHelper.updateMatrix();
  return placeHelper.matrix.clone();
}

/** Decomposes a matrix into an object's position, rotation and scale. */
export function applyMatrixTo(object: Object3D, matrix: Matrix4): void {
  matrix.decompose(tmpPos, tmpQuat, tmpScale);
  object.position.copy(tmpPos);
  object.quaternion.copy(tmpQuat);
  object.scale.copy(tmpScale);
}
