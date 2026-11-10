import { Matrix4, Vector3 } from "three";
import type { TerrainSpec } from "../../world/terrain";
import { headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";

/**
 * Where everything sits on the Home planet. One place to move a building and
 * have its pad, path, colliders and props follow.
 */
export const HOME_RADIUS = 15;

/** A flat building site with its own frame: +Y up, +Z toward the front door. */
export interface Site {
  dir: Vector3;
  forward: Vector3;
  origin: Vector3;
  matrix: Matrix4;
}

export function site(lat: number, lon: number, heading: number, lift = 0): Site {
  const dir = latLonToDir(lat, lon);
  const forward = headingToTangent(dir, heading);
  const origin = dir.clone().multiplyScalar(HOME_RADIUS + lift);
  return { dir, forward, origin, matrix: surfaceMatrix(origin, dir, forward) };
}

/** A point in a site's frame, as a world position. */
export function local(s: Site, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(s.matrix);
}

/** The unit direction under a point in a site's frame. */
export function localDir(s: Site, x: number, z: number): Vector3 {
  return local(s, x, 0, z).normalize();
}

export const SITES = {
  spawn: { lat: -5, lon: 2, heading: 2 },
  house: site(10, -18, 146),
  shed: site(9, 19, 214),
  garden: site(-15, -12, 28),
  dish: site(19, 37, 230),
};

export const MAILBOX = { lat: -1.2, lon: -6.5 };
export const HILL = { lat: 31, lon: 4, radius: 7, height: 2.5, plateau: 0.32 };
export const HILL_TOP = latLonToDir(HILL.lat, HILL.lon);

/** Door points, used by paths and by the objective arrow. */
export const PORCH = localDir(SITES.house, -0.6, 3.6);
export const SHED_DOOR = localDir(SITES.shed, 0, 3.9);
const spawnDir = latLonToDir(SITES.spawn.lat, SITES.spawn.lon);
const mailboxDir = latLonToDir(MAILBOX.lat, MAILBOX.lon + 1.4);
const crossroads = latLonToDir(1.5, 1);

/** Footpaths as great-circle arcs. */
export const PATHS: [Vector3, Vector3][] = [
  [spawnDir, crossroads],
  [crossroads, mailboxDir],
  [mailboxDir, PORCH],
  [crossroads, SHED_DOOR],
  [SHED_DOOR, localDir(SITES.dish, 0, 2.4)],
  [spawnDir, localDir(SITES.garden, 0, 3.2)],
  [crossroads, latLonToDir(HILL.lat - 6, HILL.lon - 1)],
  [latLonToDir(HILL.lat - 6, HILL.lon - 1), HILL_TOP],
];

export const PATH_HALF_WIDTH = 0.55;

export const TERRAIN: TerrainSpec = {
  radius: HOME_RADIUS,
  seed: 11,
  noiseAmplitude: 0.24,
  noiseFrequency: 1.8,
  pads: [
    { center: SITES.house.dir, radius: 3.4, blend: 1.8 },
    { center: SITES.shed.dir, radius: 4.0, blend: 1.8 },
    { center: SITES.garden.dir, radius: 3.0, blend: 1.5 },
    { center: SITES.dish.dir, radius: 1.8, blend: 1.2 },
  ],
  bumps: [
    { center: HILL_TOP, radius: HILL.radius, height: HILL.height, plateau: HILL.plateau },
    { center: latLonToDir(-30, 40), radius: 5, height: 0.9 },
    { center: latLonToDir(-35, -40), radius: 4.5, height: 0.7 },
    { center: latLonToDir(40, -45), radius: 5.5, height: 1.1 },
    { center: latLonToDir(-60, 120), radius: 6, height: 1.2 },
    { center: latLonToDir(20, 150), radius: 6, height: 1.0 },
  ],
  craters: [
    // A little pond hollow on the far side.
    { center: latLonToDir(-20, 175), radius: 2.2, depth: 0.35, rim: 0.12 },
  ],
};

export const POND = latLonToDir(-20, 175);
