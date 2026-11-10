import {
  BufferAttribute,
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  type Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * The model kit. Dad's worlds are built like model kits: many small painted
 * pieces. We paint each piece with a vertex color and merge every still piece
 * that shares a material into one mesh, so a whole world draws in a handful of
 * calls.
 */
export type Layer = "solid" | "glow";

interface Piece {
  geometry: BufferGeometry;
  layer: Layer;
}

const tmpColor = new Color();
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpPos = new Vector3();

/** Keeps only position, normal and color, with an index, so any pieces can merge. */
function normalize(geometry: BufferGeometry, color: Color): BufferGeometry {
  const g = geometry.index ? geometry.clone() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  }
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  if (!g.index) {
    const count = g.getAttribute("position").count;
    const index = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i += 1) index[i] = i;
    g.setIndex(new BufferAttribute(index, 1));
  }
  const count = g.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  g.morphAttributes = {};
  return g;
}

export class Batcher {
  private pieces: Piece[] = [];

  /**
   * Adds a painted piece. `matrix` places it in the batch's space.
   * The source geometry is not changed and can be shared.
   */
  add(geometry: BufferGeometry, matrix: Matrix4, color: ColorRepresentation, layer: Layer = "solid"): void {
    tmpColor.set(color);
    const g = normalize(geometry, tmpColor);
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
  ): void {
    const helper = placeHelper;
    helper.position.set(position[0], position[1], position[2]);
    helper.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (typeof scale === "number") helper.scale.setScalar(scale);
    else helper.scale.set(scale[0], scale[1], scale[2]);
    helper.updateMatrix();
    tmpMatrix.copy(helper.matrix);
    if (parent) tmpMatrix.premultiply(parent);
    this.add(geometry, tmpMatrix, color, layer);
  }

  get size(): number {
    return this.pieces.length;
  }

  /** Merges the pieces of each layer into one mesh. */
  build(materials: Record<Layer, Material>, options: { castShadow?: boolean; receiveShadow?: boolean } = {}): Mesh[] {
    const meshes: Mesh[] = [];
    for (const layer of ["solid", "glow"] as const) {
      const list = this.pieces.filter((piece) => piece.layer === layer).map((piece) => piece.geometry);
      if (list.length === 0) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, materials[layer]);
      mesh.name = `batch-${layer}`;
      mesh.matrixAutoUpdate = false;
      if (layer === "solid") {
        mesh.castShadow = options.castShadow ?? true;
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
