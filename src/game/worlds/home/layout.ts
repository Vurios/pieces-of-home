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

/** `scale` enlarges a whole building, including its colliders and local points. */
export function site(lat: number, lon: number, heading: number, lift = 0, scale = 1): Site {
  const dir = latLonToDir(lat, lon);
  const forward = headingToTangent(dir, heading);
  const origin = dir.clone().multiplyScalar(HOME_RADIUS + lift);
  const matrix = surfaceMatrix(origin, dir, forward);
  if (scale !== 1) matrix.multiply(new Matrix4().makeScale(scale, scale, scale));
  return { dir, forward, origin, matrix };
}

/** A point in a site's frame, as a world position. */
export function local(s: Site, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(s.matrix);
}

/** The unit direction under a point in a site's frame. */
export function localDir(s: Site, x: number, z: number): Vector3 {
  return local(s, x, 0, z).normalize();
}

/**
 * A flat pad is a tangent plane, so on its own it rises above the round ground
 * toward its edge and the planet looks like it has tabletops on it. Sinking
 * the plane by half that rise splits the difference: the pad dips a little at
 * the middle and lifts a little at the rim, and the planet stays round.
 */
export function padLift(radius: number): number {
  return -0.5 * (HOME_RADIUS / Math.cos(radius / HOME_RADIUS) - HOME_RADIUS);
}

export const PAD = { house: 4.1, shed: 4.0, garden: 3.0, dish: 1.8 };

export const SITES = {
  spawn: { lat: -5, lon: 2, heading: 2 },
  // The house is drawn at 1.2 times its model size so it never looks smaller than the shed.
  house: site(10, -18, 146, padLift(PAD.house), 1.2),
  shed: site(9, 19, 214, padLift(PAD.shed)),
  garden: site(-15, -12, 28, padLift(PAD.garden)),
  dish: site(-1, 34, 290, padLift(PAD.dish)),
};

export const MAILBOX = { lat: -1.2, lon: -6.5 };
// A gentle rounded hill, not a mesa: it should read as part of the planet's curve.
export const HILL = { lat: 31, lon: 4, radius: 8.5, height: 1.7, plateau: 0.1 };
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
    { center: SITES.house.dir, radius: PAD.house, blend: 2.2, lift: padLift(PAD.house) },
    { center: SITES.shed.dir, radius: PAD.shed, blend: 2.2, lift: padLift(PAD.shed) },
    { center: SITES.garden.dir, radius: PAD.garden, blend: 1.8, lift: padLift(PAD.garden) },
    { center: SITES.dish.dir, radius: PAD.dish, blend: 1.4, lift: padLift(PAD.dish) },
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
