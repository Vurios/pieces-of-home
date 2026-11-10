import { Matrix4, Vector3 } from "three";

/**
 * Simple colliders for props and buildings. Each prop group sits on a flat pad
 * with its own local frame (Y up, origin on the ground). Shapes are circles
 * and boxes on that local floor, each with a height.
 *
 * - If the player's feet are at or above a shape's top (within a small step),
 *   the shape is a platform to stand on.
 * - Otherwise it is a wall and pushes the player out sideways.
 */
export type Shape =
  | { kind: "circle"; x: number; z: number; radius: number; height: number; base?: number }
  | { kind: "box"; x: number; z: number; halfWidth: number; halfDepth: number; rotation?: number; height: number; base?: number };

export interface ColliderGroup {
  /** Local frame of the group, in world space. */
  matrix: Matrix4;
  inverse: Matrix4;
  /** Quick reject: nothing in the group reaches farther than this from its origin. */
  reach: number;
  shapes: Shape[];
}

export function createColliderGroup(matrix: Matrix4, shapes: Shape[]): ColliderGroup {
  let reach = 0;
  for (const shape of shapes) {
    const extent =
      shape.kind === "circle" ? shape.radius : Math.hypot(shape.halfWidth, shape.halfDepth);
    reach = Math.max(reach, Math.hypot(shape.x, shape.z) + extent, shape.height);
  }
  return { matrix: matrix.clone(), inverse: matrix.clone().invert(), reach: reach + 1, shapes };
}

const local = new Vector3();
const origin = new Vector3();

export interface CollisionResult {
  /** Highest platform top under the player, as a world-space point. Null if none. */
  platform: Vector3 | null;
  /** True if a wall pushed the player this step. */
  pushed: boolean;
}

/**
 * Moves `position` (the player's feet, in world space) out of any wall, and
 * reports the highest platform under it.
 *
 * @param bodyRadius  how wide the player is
 * @param stepHeight  how high a ledge the player can walk up
 */
export function resolveColliders(
  groups: ColliderGroup[],
  position: Vector3,
  bodyRadius: number,
  stepHeight: number,
  platformOut: Vector3,
): CollisionResult {
  let pushed = false;
  let bestPlatform = -Infinity;
  let hasPlatform = false;

  for (const group of groups) {
    origin.setFromMatrixPosition(group.matrix);
    if (origin.distanceToSquared(position) > (group.reach + bodyRadius) ** 2) continue;

    local.copy(position).applyMatrix4(group.inverse);
    let moved = false;
    let groupPlatform = -Infinity;

    for (const shape of group.shapes) {
      const base = shape.base ?? -1;
      // Feet high enough to stand on top of this shape?
      const onTop = local.y >= shape.height - stepHeight;
      // Head (about one unit up) below a raised shape, such as a roof beam? Then ignore it.
      if (local.y + 1 < base) continue;

      if (shape.kind === "circle") {
        const dx = local.x - shape.x;
        const dz = local.z - shape.z;
        const distance = Math.hypot(dx, dz);
        if (onTop) {
          if (distance <= shape.radius) groupPlatform = Math.max(groupPlatform, shape.height);
          continue;
        }
        const minimum = shape.radius + bodyRadius;
        if (distance < minimum) {
          if (distance < 1e-5) {
            local.x = shape.x + minimum;
          } else {
            local.x = shape.x + (dx / distance) * minimum;
            local.z = shape.z + (dz / distance) * minimum;
          }
          moved = true;
        }
      } else {
        const cos = Math.cos(shape.rotation ?? 0);
        const sin = Math.sin(shape.rotation ?? 0);
        // Into the box's own axes.
        const rx = local.x - shape.x;
        const rz = local.z - shape.z;
        const bx = rx * cos - rz * sin;
        const bz = rx * sin + rz * cos;
        if (onTop) {
          if (Math.abs(bx) <= shape.halfWidth && Math.abs(bz) <= shape.halfDepth) {
            groupPlatform = Math.max(groupPlatform, shape.height);
          }
          continue;
        }
        const cx = Math.max(-shape.halfWidth, Math.min(shape.halfWidth, bx));
        const cz = Math.max(-shape.halfDepth, Math.min(shape.halfDepth, bz));
        let dx = bx - cx;
        let dz = bz - cz;
        let distance = Math.hypot(dx, dz);
        let nx: number;
        let nz: number;
        if (distance > 1e-6) {
          if (distance >= bodyRadius) continue;
          nx = cx + (dx / distance) * bodyRadius;
          nz = cz + (dz / distance) * bodyRadius;
        } else {
          // Center is inside the box. Leave through the nearest side.
          const toX = shape.halfWidth - Math.abs(bx);
          const toZ = shape.halfDepth - Math.abs(bz);
          if (toX < toZ) {
            nx = Math.sign(bx || 1) * (shape.halfWidth + bodyRadius);
            nz = bz;
          } else {
            nx = bx;
            nz = Math.sign(bz || 1) * (shape.halfDepth + bodyRadius);
          }
          dx = dz = distance = 0;
        }
        local.x = shape.x + nx * cos + nz * sin;
        local.z = shape.z - nx * sin + nz * cos;
        moved = true;
      }
    }

    if (moved) {
      pushed = true;
      position.copy(local).applyMatrix4(group.matrix);
    }
    if (groupPlatform > -Infinity) {
      // Compare platforms by their distance from the planet center.
      const top = platformScratch.set(local.x, groupPlatform, local.z).applyMatrix4(group.matrix);
      const height = top.length();
      if (height > bestPlatform) {
        bestPlatform = height;
        platformOut.copy(top);
        hasPlatform = true;
      }
    }
  }

  return { platform: hasPlatform ? platformOut : null, pushed };
}

const platformScratch = new Vector3();

/** True if `point` (world space) is inside any solid shape. Used to keep the camera out of props. */
export function pointInsideColliders(groups: ColliderGroup[], point: Vector3, padding = 0.25): boolean {
  for (const group of groups) {
    origin.setFromMatrixPosition(group.matrix);
    if (origin.distanceToSquared(point) > (group.reach + padding) ** 2) continue;
    local.copy(point).applyMatrix4(group.inverse);
    for (const shape of group.shapes) {
      if (local.y > shape.height + padding || local.y < (shape.base ?? -1) - padding) continue;
      if (shape.kind === "circle") {
        if (Math.hypot(local.x - shape.x, local.z - shape.z) < shape.radius + padding) return true;
      } else {
        const cos = Math.cos(shape.rotation ?? 0);
        const sin = Math.sin(shape.rotation ?? 0);
        const rx = local.x - shape.x;
        const rz = local.z - shape.z;
        const bx = rx * cos - rz * sin;
        const bz = rx * sin + rz * cos;
        if (Math.abs(bx) < shape.halfWidth + padding && Math.abs(bz) < shape.halfDepth + padding) return true;
      }
    }
  }
  return false;
}
