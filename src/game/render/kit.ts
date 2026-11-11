import { BufferAttribute, type BufferGeometry, Color, type ColorRepresentation, type Material, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from "three";
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

  /** Merges the pieces of each layer into one mesh. A layer with no material is skipped. */
  build(materials: Partial<Record<Layer, Material>>, options: { castShadow?: boolean; receiveShadow?: boolean } = {}): Mesh[] {
    const meshes: Mesh[] = [];
    for (const layer of LAYERS) {
      const material = materials[layer] ?? (layer === "detail" ? materials.foliage : undefined) ?? (layer === "foliage" || layer === "detail" ? materials.solid : undefined);
      const list = this.pieces.filter((piece) => piece.layer === layer).map((piece) => piece.geometry);
      if (list.length === 0 || !material) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, material);
      mesh.name = `batch-${layer}`;
      mesh.matrixAutoUpdate = false;
      if (layer !== "glow") {
        mesh.castShadow = layer === "detail" ? false : (options.castShadow ?? true);
        mesh.receiveShadow = options.receiveShadow ?? true;
      }
      meshes.push(mesh);
    }
    this.pieces = [];
    return meshes;
  }
}

const placeHelper = new Object3D();

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
