import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  type Material,
  type Object3D,
  TorusGeometry,
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

  /** Builds every joint added since the last flush. */
  flush(castShadow = true): void {
    for (const [parent, batch] of this.pending) {
      for (const mesh of batch.build({ solid: this.material }, { castShadow, receiveShadow: false })) parent.add(mesh);
    }
    this.pending.clear();
  }
}
