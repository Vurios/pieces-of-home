import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  type Material,
  type Mesh,
  type Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Batcher } from "../render/kit";

/**
 * Shared unit shapes for characters, Milo and props. Every shape is made once
 * and scaled by the meshes that use it, so four kids cost almost nothing more
 * than one.
 */
const cache = new Map<string, BufferGeometry>();

function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = make();
    cache.set(key, geometry);
  }
  return geometry;
}

/** Unit sphere (radius 1). "tiny" is for things a few pixels wide, such as petals and berries. */
export const sphere = (detail: "tiny" | "low" | "mid" | "high" = "mid"): BufferGeometry =>
  cached(`sphere-${detail}`, () =>
    detail === "tiny" ? new SphereGeometry(1, 6, 4) : detail === "low" ? new SphereGeometry(1, 9, 6) : detail === "mid" ? new SphereGeometry(1, 14, 10) : new SphereGeometry(1, 30, 22),
  );

/** Capsule with radius 1 and a straight middle of `length`. */
export const capsule = (length: number): BufferGeometry =>
  cached(`capsule-${length.toFixed(3)}`, () => new CapsuleGeometry(1, length, 5, 12));

const limbUp = new Vector3(0, 1, 0);
const limbDir = new Vector3();
const limbQuat = new Quaternion();
const limbEuler = new Euler();

/**
 * A rounded limb from `a` to `b` in a joint's space: a true capsule with an
 * even radius, so an arm reads as an arm. (Stretching a short capsule along
 * one axis makes a squashed ball, and a row of those looks like beads.)
 */
export function limb(assembly: Assembly, parent: Object3D, a: [number, number, number], b: [number, number, number], radius: number, color: string): void {
  limbDir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const length = limbDir.length();
  limbDir.divideScalar(length || 1);
  limbQuat.setFromUnitVectors(limbUp, limbDir);
  limbEuler.setFromQuaternion(limbQuat, "XYZ");
  // Round the straight part to 2 decimals in unit-radius space, so similar limbs share one geometry.
  const straight = Math.max(0.01, Math.round((length / radius) * 100) / 100);
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  assembly.add(parent, capsule(straight), color, mid, radius, [limbEuler.x, limbEuler.y, limbEuler.z]);
}

/**
 * A lock of hair: a rounded teardrop, thick at the root and tapering to a
 * soft tip at -y. Unit size; scale it to taste.
 */
export const lockShape = (): BufferGeometry =>
  cached("lock", () => {
    const geometry = new SphereGeometry(1, 16, 12);
    const pos = geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      if (y < 0) {
        const k = 1 + y * 0.6;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
    }
    geometry.computeVertexNormals();
    return geometry;
  });

const lockDown = new Vector3(0, -1, 0);

/**
 * Adds one lock of hair that grows from `root` toward `dir`, in a joint's
 * space. Hair built from overlapping locks reads as sculpted, finished hair
 * instead of a helmet.
 */
export function hairLock(
  assembly: Assembly,
  parent: Object3D,
  root: [number, number, number],
  dir: [number, number, number],
  length: number,
  width: number,
  color: string,
  flat = 0.72,
): void {
  limbDir.set(dir[0], dir[1], dir[2]).normalize();
  limbQuat.setFromUnitVectors(lockDown, limbDir);
  limbEuler.setFromQuaternion(limbQuat, "XYZ");
  // The thickest part sits a little way along the lock, so the root tucks into the hair under it.
  const center: [number, number, number] = [root[0] + limbDir.x * length * 0.32, root[1] + limbDir.y * length * 0.32, root[2] + limbDir.z * length * 0.32];
  assembly.add(parent, lockShape(), color, center, [width, length * 0.62, width * flat], [limbEuler.x, limbEuler.y, limbEuler.z]);
}

/**
 * A kid's top: a lathe with soft shoulders, a little belly and a hem, so the
 * body reads as a chubby figure in clothes rather than a pill. Height 1,
 * radius about 1 at the widest.
 */
export const torsoShape = (): BufferGeometry =>
  cached("torso", () => {
    const profile = [
      [0, 0],
      [0.9, 0],
      [1.0, 0.06],
      [1.04, 0.24],
      [1.02, 0.48],
      [0.97, 0.68],
      [0.86, 0.84],
      [0.62, 0.95],
      [0.34, 1.0],
      [0, 1.01],
    ].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(profile, 18);
  });

/** Cylinder of radius 1 and height 1, centered. */
export const cylinder = (segments = 16, topRatio = 1, open = false): BufferGeometry =>
  cached(`cyl-${segments}-${topRatio}-${open}`, () => new CylinderGeometry(topRatio, 1, 1, segments, 1, open));

/** Cone of radius 1 and height 1, centered. */
export const cone = (segments = 12): BufferGeometry => cached(`cone-${segments}`, () => new ConeGeometry(1, 1, segments));

/** A 1 x 1 x 1 box with rounded edges. `round` is the corner radius. */
export const box = (round = 0.12): BufferGeometry =>
  cached(`box-${round}`, () =>
    // Tiny bevels are invisible at game distance, so small rounding gets a plain box: 12 triangles instead of hundreds.
    round < 0.03 ? new BoxGeometry(1, 1, 1) : new RoundedBoxGeometry(1, 1, 1, 1, round),
  );

/** A ring of radius 1. `tube` is the thickness. `arc` is how much of the ring to draw. */
export const torus = (tube = 0.18, arc = Math.PI * 2): BufferGeometry =>
  cached(`torus-${tube}-${arc.toFixed(3)}`, () => new TorusGeometry(1, tube, 6, 18, arc));

export function disposeParts(): void {
  for (const geometry of cache.values()) geometry.dispose();
  cache.clear();
}

/**
 * Collects painted shapes per joint, then merges each joint's shapes into one
 * vertex-colored mesh. A kid made of seventy shapes draws in about a dozen calls.
 */
export class Assembly {
  private pending = new Map<Object3D, Batcher>();

  constructor(private material: Material) {}

  add(
    parent: Object3D,
    geometry: BufferGeometry,
    color: string,
    position: [number, number, number],
    scale: number | [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): void {
    let batch = this.pending.get(parent);
    if (!batch) {
      batch = new Batcher();
      this.pending.set(parent, batch);
    }
    batch.place(geometry, color, position, rotation, scale);
  }

  /** Builds every joint added since the last flush, and returns the meshes it made. */
  flush(castShadow = true): Mesh[] {
    const made: Mesh[] = [];
    for (const [parent, batch] of this.pending) {
      for (const mesh of batch.build({ solid: this.material }, { castShadow, receiveShadow: false })) {
        parent.add(mesh);
        made.push(mesh);
      }
    }
    this.pending.clear();
    return made;
  }
}
