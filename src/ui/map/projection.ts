import { Vector3 } from "three";

/**
 * The math behind Dad's map. Two views of a little round world:
 *
 * - The globe: the whole planet as a ball seen from outside (an orthographic
 *   view), facing `center` with `north` up on the page. It spins when dragged.
 * - The corner map: the ground round Remi, seen from straight above, with the
 *   way the camera looks pointing up the page. Distances are true along the
 *   ground (an azimuthal equidistant view), so "9 steps away" looks 9 steps away.
 *
 * Every position is a unit direction from the planet's center.
 */
export interface GlobeView {
  /** The point of the planet nearest the viewer. */
  center: Vector3;
  /** Up on the page. */
  north: Vector3;
  /** Right on the page. */
  east: Vector3;
}

/** A globe view facing `center`, turned so `up` (any vector) points up the page. */
export function globeView(center: Vector3, up: Vector3): GlobeView {
  const c = center.clone().normalize();
  const n = up.clone().addScaledVector(c, -up.dot(c));
  if (n.lengthSq() < 1e-10) {
    // Looking straight down a pole: any up will do.
    n.set(0, 0, 1).addScaledVector(c, -c.z);
    if (n.lengthSq() < 1e-10) n.set(1, 0, 0).addScaledVector(c, -c.x);
  }
  n.normalize();
  // The viewer looks along -c, so right on the page is up x toward-viewer.
  const e = new Vector3().crossVectors(n, c).normalize();
  return { center: c, north: n, east: e };
}

/** Where a point lands on the globe: x right, y up (-1 to 1), and depth (above 0 is the near side). */
export function onGlobe(view: GlobeView, p: Vector3): { x: number; y: number; z: number } {
  return { x: p.dot(view.east), y: p.dot(view.north), z: p.dot(view.center) };
}

/**
 * Spins the globe as if dragged: `right` and `up` in radians. Dragging right
 * carries the near side to the right; dragging up carries it up.
 */
export function spinGlobe(view: GlobeView, right: number, up: number): GlobeView {
  const c = view.center.clone();
  const e = view.east.clone();
  const n = view.north.clone();
  // Turn about north: the center slides toward -east.
  const c1 = c.clone().multiplyScalar(Math.cos(right)).addScaledVector(e, -Math.sin(right));
  const e1 = e.clone().multiplyScalar(Math.cos(right)).addScaledVector(c, Math.sin(right));
  // Turn about east: the center slides toward -north.
  const c2 = c1.clone().multiplyScalar(Math.cos(up)).addScaledVector(n, -Math.sin(up));
  const n2 = n.clone().multiplyScalar(Math.cos(up)).addScaledVector(c1, Math.sin(up));
  return { center: c2.normalize(), north: n2.normalize(), east: e1.normalize() };
}

/** Eases one globe view toward another, keeping north up the page as it goes. */
export function easeGlobe(from: GlobeView, to: GlobeView, t: number): GlobeView {
  const c = from.center.clone().lerp(to.center, t);
  if (c.lengthSq() < 1e-6) c.copy(to.center);
  return globeView(c, from.north.clone().lerp(to.north, t));
}

/** True north on the planet (toward +Y), used to keep the globe upright. */
export const WORLD_UP = new Vector3(0, 1, 0);

/** The corner map's frame: Remi's up, and the way the camera looks along the ground. */
export interface LocalView {
  up: Vector3;
  forward: Vector3;
  right: Vector3;
  /** Planet radius, so the map can count in meters. */
  radius: number;
}

export function localView(up: Vector3, facing: Vector3, radius: number): LocalView {
  const u = up.clone().normalize();
  const f = facing.clone().addScaledVector(u, -facing.dot(u));
  if (f.lengthSq() < 1e-10) f.set(0, 1, 0).addScaledVector(u, -u.y);
  if (f.lengthSq() < 1e-10) f.set(1, 0, 0);
  f.normalize();
  return { up: u, forward: f, right: new Vector3().crossVectors(f, u).normalize(), radius };
}

const scratch = new Vector3();

/** Where a point lands on the corner map, in meters: x right, y ahead. */
export function onGround(view: LocalView, p: Vector3): { x: number; y: number; distance: number } {
  const cos = Math.max(-1, Math.min(1, p.dot(view.up)));
  const distance = Math.acos(cos) * view.radius;
  scratch.copy(p).addScaledVector(view.up, -cos);
  const length = scratch.length();
  if (length < 1e-9) return { x: 0, y: 0, distance };
  return { x: (scratch.dot(view.right) / length) * distance, y: (scratch.dot(view.forward) / length) * distance, distance };
}
