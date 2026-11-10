import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Math for living on a small sphere. The planet center is the origin, "up" is
 * the direction from the center, and headings are measured clockwise from
 * north in the local tangent plane.
 */
export const DEG = Math.PI / 180;
const WORLD_UP = new Vector3(0, 1, 0);
const scratchA = new Vector3();
const scratchB = new Vector3();
const scratchQ = new Quaternion();

/** Latitude and longitude in degrees to a unit direction. Longitude 0 faces +Z. */
export function latLonToDir(lat: number, lon: number, out = new Vector3()): Vector3 {
  const phi = lat * DEG;
  const theta = lon * DEG;
  const c = Math.cos(phi);
  return out.set(c * Math.sin(theta), Math.sin(phi), c * Math.cos(theta));
}

export function dirToLatLon(dir: Vector3): { lat: number; lon: number } {
  const lat = Math.asin(Math.max(-1, Math.min(1, dir.y))) / DEG;
  const lon = Math.atan2(dir.x, dir.z) / DEG;
  return { lat, lon };
}

/** East tangent at `up`. Stable near the poles. */
export function eastAt(up: Vector3, out = new Vector3()): Vector3 {
  out.crossVectors(WORLD_UP, up);
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  return out.normalize();
}

export function northAt(up: Vector3, out = new Vector3()): Vector3 {
  eastAt(up, scratchA);
  return out.crossVectors(up, scratchA).normalize();
}

/** Unit tangent pointing along `heading` degrees (0 = north, 90 = east). */
export function headingToTangent(up: Vector3, heading: number, out = new Vector3()): Vector3 {
  const east = eastAt(up, scratchA);
  const north = scratchB.crossVectors(up, east).normalize();
  const h = heading * DEG;
  return out.copy(north).multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h)).normalize();
}

/** Removes the part of `vector` along `up`, leaving a tangent vector. */
export function projectOnTangent(vector: Vector3, up: Vector3, out = new Vector3()): Vector3 {
  return out.copy(vector).addScaledVector(up, -vector.dot(up));
}

/**
 * Carries a tangent vector from one point on the sphere to another without
 * twisting it. This keeps the camera and the character from spinning as they
 * walk over the curve.
 */
export function parallelTransport(vector: Vector3, fromUp: Vector3, toUp: Vector3): Vector3 {
  scratchQ.setFromUnitVectors(fromUp, toUp);
  return vector.applyQuaternion(scratchQ);
}

/**
 * A transform that stands an object on the sphere: +Y along `up`, +Z along
 * `forward` (flattened onto the tangent plane), origin at `position`.
 */
export function surfaceMatrix(position: Vector3, up: Vector3, forward: Vector3, out = new Matrix4()): Matrix4 {
  const z = projectOnTangent(forward, up, scratchA);
  if (z.lengthSq() < 1e-10) northAt(up, z);
  z.normalize();
  const x = scratchB.crossVectors(up, z).normalize();
  return out.makeBasis(x, up, z).setPosition(position);
}

/** Great-circle distance between two unit directions, in radians. */
export function angleBetween(a: Vector3, b: Vector3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
}

/** Unit tangent at `from` that points along the shortest path to `to`. */
export function tangentToward(from: Vector3, to: Vector3, out = new Vector3()): Vector3 {
  projectOnTangent(to, from, out);
  if (out.lengthSq() < 1e-10) northAt(from, out);
  return out.normalize();
}

/** Smoothing factor that behaves the same at any frame rate. */
export function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
