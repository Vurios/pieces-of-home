import { Matrix4, Vector3 } from "three";
import type { TerrainSpec } from "../../world/terrain";
import { headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";

/**
 * Where everything sits on the Home planet. One place to move a building and
 * have its pad, path, colliders and props follow.
 *
 * The home lot (house, workshop, garden, dish, the hill and the meadow) faces
 * the title camera. Smaller places to find are spread over the rest of the
 * planet, each with room around it and a footpath that leads there, so a walk
 * all the way round always has something new over the curve.
 */
/**
 * 20 m: big enough that every place has room around it, small enough that the
 * curve still reads as a tiny planet.
 */
export const HOME_RADIUS = 20;

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

export const PAD = { house: 4.1, shed: 4.0, garden: 3.0, dish: 1.8, treehouse: 2.4, playground: 3.2, camp: 2.6, weather: 2.3, rocket: 2.4, windpump: 2.2, balloon: 2.0 };

export const SITES = {
  spawn: { lat: -5, lon: 2, heading: 2 },
  // The house is drawn at 1.2 times its model size so it never looks smaller than the shed.
  house: site(11, -25, 146, padLift(PAD.house), 1.2),
  shed: site(10, 25, 214, padLift(PAD.shed)),
  garden: site(-22, -22, 28, padLift(PAD.garden)),
  dish: site(-10, 54, 290, padLift(PAD.dish)),
  // Places to find, round the rest of the planet. Each faces the path that reaches it.
  treehouse: site(12, -80, 25, padLift(PAD.treehouse)),
  playground: site(36, -138, 120, padLift(PAD.playground)),
  camp: site(-44, 116, 0, padLift(PAD.camp)),
  // The weather station and the rocket are drawn a size up, so they read from across the planet.
  weather: site(62, 78, 230, padLift(PAD.weather), 1.35),
  rocket: site(-56, -44, 20, padLift(PAD.rocket), 1.35),
  windpump: site(8, 100, 250, padLift(PAD.windpump)),
  balloon: site(-80, 40, 0, padLift(PAD.balloon)),
};

// Beside the porch path, where the walk from the crossroads reaches the house.
export const MAILBOX = { lat: -2.4, lon: -11 };
// A low, wide, rounded hill, so it reads as part of the planet's curve and never as a lump on it.
export const HILL = { lat: 40, lon: 0, radius: 12, height: 1.15, plateau: 0.12 };
export const HILL_TOP = latLonToDir(HILL.lat, HILL.lon);

/** The meadow south of the house: a swing oak, a picnic and a bird bath. */
export const MEADOW = {
  oak: latLonToDir(-34, -3),
  picnic: latLonToDir(-30, 13),
  bath: latLonToDir(-19, 32),
  sign: latLonToDir(4, 4),
};

/** The pond on the far side, with a dock and a little rowboat. */
export const POND = latLonToDir(-15, 178);
export const POND_RADIUS = 3.1;
/** The orchard and its beehives, south-west, past the treehouse. */
export const ORCHARD = latLonToDir(-28, -112);

/** Door points, used by paths and by the objective arrow. */
export const PORCH = localDir(SITES.house, -0.6, 3.6);
export const SHED_DOOR = localDir(SITES.shed, 0, 3.9);
const spawnDir = latLonToDir(SITES.spawn.lat, SITES.spawn.lon);
const mailboxDir = latLonToDir(MAILBOX.lat, MAILBOX.lon + 1.4);
const crossroads = latLonToDir(1.5, 1);
const hillFoot = latLonToDir(HILL.lat - 7, HILL.lon - 1);
const westGate = latLonToDir(-7, -44);
const meadowGate = latLonToDir(-38, 4);
const dishFront = localDir(SITES.dish, 0, 2.4);

/** The point `meters` from `from` along the ground toward `to`. */
export function toward(from: Vector3, to: Vector3, meters: number): Vector3 {
  const tangent = to.clone().addScaledVector(from, -to.dot(from)).normalize();
  const angle = meters / HOME_RADIUS;
  return from.clone().multiplyScalar(Math.cos(angle)).addScaledVector(tangent, Math.sin(angle)).normalize();
}
const dishSide = toward(SITES.dish.dir, latLonToDir(-34, 48), 2.9);
const pondShore = toward(POND, SITES.camp.dir, POND_RADIUS + 1.0);
const pondBack = toward(POND, SITES.playground.dir, POND_RADIUS + 1.0);
const campFront = localDir(SITES.camp, 0, 4.2);
const playgroundFront = localDir(SITES.playground, 0, 4.4);
const treehouseFront = localDir(SITES.treehouse, 0, 3.4);
const weatherFront = localDir(SITES.weather, 0, 2.6);
const rocketFront = localDir(SITES.rocket, 0, 2.8);

const windpumpFront = localDir(SITES.windpump, 0, 3.0);
const balloonFront = localDir(SITES.balloon, 0, 3.4);

/**
 * A footpath from `a` to `b`. `bend` bows the middle that many meters to one
 * side and `wiggle` adds a soft S on top, so long trails curve the way trodden
 * paths do instead of running ruler straight. The curve is smooth: it can be
 * sampled as finely as needed (the drawn ribbon) or coarsely (distance checks).
 */
export interface TrailSpec {
  a: Vector3;
  b: Vector3;
  bend: number;
  wiggle: number;
  /** Half the width of the worn track, in meters. */
  halfWidth: number;
  /** Flat stepping stones instead of a dirt track. */
  stones?: boolean;
}

const HOME_WIDTH = 0.52;
const TRAIL_WIDTH = 0.44;

function trail(a: Vector3, b: Vector3, bend = 0, wiggle = 0, halfWidth = TRAIL_WIDTH, stones = false): TrailSpec {
  return { a, b, bend, wiggle, halfWidth, stones };
}

/** The point a share `t` (0 to 1) of the way along a trail. */
export function trailPoint(spec: TrailSpec, t: number, out = new Vector3()): Vector3 {
  const normal = scratchNormal.crossVectors(spec.a, spec.b).normalize();
  // Both terms are flat at the ends, so a trail leaves a junction or a door straight and then curves.
  const s = Math.sin(Math.PI * t);
  const side = spec.bend * s * s + spec.wiggle * s * Math.sin(Math.PI * 2 * t);
  return out.copy(spec.a).lerp(spec.b, t).normalize().addScaledVector(normal, side / HOME_RADIUS).normalize();
}
const scratchNormal = new Vector3();

/** Length of the straight arc under a trail, in meters. */
export function trailLength(spec: TrailSpec): number {
  return Math.acos(Math.max(-1, Math.min(1, spec.a.dot(spec.b)))) * HOME_RADIUS;
}

/** Points along a trail, about `step` meters apart. */
export function sampleTrail(spec: TrailSpec, step: number): Vector3[] {
  // Straight trails are sampled as finely as curved ones: the planet is round, and one
  // flat strip from end to end cut under the ground, so the grass covered the middle.
  const n = Math.max(2, Math.ceil(trailLength(spec) / step));
  return Array.from({ length: n + 1 }, (_, i) => trailPoint(spec, i / n));
}

/** Every footpath. */
export const TRAIL_SPECS: TrailSpec[] = [
  // The home lot: wider, well trodden. Flat stones lead up to the porch.
  trail(spawnDir, crossroads, 0, 0, HOME_WIDTH),
  trail(crossroads, mailboxDir, 0, 0, HOME_WIDTH),
  trail(mailboxDir, PORCH, 0, 0, HOME_WIDTH, true),
  trail(crossroads, SHED_DOOR, 0.3, 0, HOME_WIDTH),
  trail(SHED_DOOR, dishFront, -0.6, 0, HOME_WIDTH),
  trail(spawnDir, localDir(SITES.garden, 0, 2.0), 0.5, 0, HOME_WIDTH),
  trail(crossroads, hillFoot, -0.9, 0, HOME_WIDTH),
  trail(hillFoot, HILL_TOP, 0, 0, HOME_WIDTH),
  // The long way round: east past the dish to the camp and the pond,
  trail(dishFront, dishSide),
  trail(dishSide, campFront, 2.0, 0.4),
  trail(campFront, pondShore, -1.8, 0.4),
  // north from the pond to the playground, the treehouse and back to the mailbox,
  trail(pondBack, playgroundFront, 2.0, -0.4),
  trail(playgroundFront, treehouseFront, -2.0, 0.5),
  trail(treehouseFront, westGate, 1.0),
  trail(westGate, mailboxDir, -0.7),
  // over the hill to the weather station and down past the windpump to the camp,
  trail(HILL_TOP, weatherFront, -1.4, 0.3),
  trail(weatherFront, windpumpFront, 1.8, 0.4),
  trail(windpumpFront, campFront, -1.6, 0.3),
  // and south past the meadow to the rocket field, the balloon and the orchard.
  trail(spawnDir, meadowGate, 1.4, 0.3),
  trail(meadowGate, rocketFront, -1.2),
  trail(rocketFront, balloonFront, 1.2, 0.3),
  trail(rocketFront, ORCHARD, 1.6, -0.4),
  trail(ORCHARD, westGate, -1.4, 0.4),
];

/** Each trail as points about a meter apart. */
export const TRAILS: Vector3[][] = TRAIL_SPECS.map((spec) => sampleTrail(spec, 1.0));

/** The same paths as short arcs, which is what distance checks walk over. */
export const PATHS: [Vector3, Vector3][] = TRAILS.flatMap((nodes) => nodes.slice(1).map((node, i): [Vector3, Vector3] => [nodes[i]!, node]));

export const PATH_HALF_WIDTH = HOME_WIDTH;

/** A point `side` meters to one side of a trail, a share `t` of the way along it. */
function beside(nodes: Vector3[], t: number, side: number): Vector3 {
  const at = Math.min(nodes.length - 1.001, t * (nodes.length - 1));
  const i = Math.floor(at);
  const a = nodes[i]!;
  const b = nodes[i + 1]!;
  const normal = new Vector3().crossVectors(a, b).normalize();
  return a.clone().lerp(b, at - i).normalize().addScaledVector(normal, side / HOME_RADIUS).normalize();
}

/** Every trail, sampled finely, with its half width: for keeping props off the paths. */
const FINE_TRAILS = TRAIL_SPECS.map((spec) => ({ points: sampleTrail(spec, 0.25), halfWidth: spec.halfWidth }));

/**
 * Moves a spot off every path, so a prop never stands in the way: at least
 * `margin` meters from a path's edge. Spots already clear come back as they are.
 */
export function clearOfTrails(dir: Vector3, margin = 0.6): Vector3 {
  const out = dir.clone().normalize();
  for (let round = 0; round < 8; round += 1) {
    let worst = 0;
    let from: Vector3 | null = null;
    for (const t of FINE_TRAILS) {
      for (const p of t.points) {
        const gap = t.halfWidth + margin - Math.acos(Math.max(-1, Math.min(1, out.dot(p)))) * HOME_RADIUS;
        if (gap > worst) {
          worst = gap;
          from = p;
        }
      }
    }
    if (!from) return out;
    // Step straight away from the nearest bit of path.
    const away = out.clone().sub(from);
    away.addScaledVector(out, -away.dot(out));
    if (away.lengthSq() < 1e-10) away.copy(headingToTangent(out, 90));
    out.addScaledVector(away.normalize(), (worst + 0.05) / HOME_RADIUS).normalize();
  }
  return out;
}

/** Lamp posts along the long trails, so the way to every place glows at dusk. */
export const TRAIL_LAMPS: Vector3[] = [
  beside(TRAILS[9]!, 0.5, 0.95),
  beside(TRAILS[10]!, 0.5, -0.95),
  beside(TRAILS[11]!, 0.5, 0.95),
  beside(TRAILS[12]!, 0.5, -0.95),
  beside(TRAILS[13]!, 0.92, 0.95),
  beside(TRAILS[15]!, 0.55, 0.95),
  beside(TRAILS[16]!, 0.5, -0.95),
  beside(TRAILS[17]!, 0.5, 0.95),
  beside(TRAILS[18]!, 0.97, -0.95),
  beside(TRAILS[20]!, 0.5, 0.95),
  beside(TRAILS[21]!, 0.5, 0.95),
  beside(TRAILS[22]!, 0.5, -0.95),
];

/**
 * Places the player can find. Walking into one shows its name. Radii are in
 * meters on the ground. Names and lines live in `src/content/places.ts`.
 */
export const PLACES: { id: string; dir: Vector3; radius: number }[] = [
  { id: "home", dir: SITES.house.dir.clone().lerp(latLonToDir(MAILBOX.lat, MAILBOX.lon), 0.3).normalize(), radius: 7.0 },
  { id: "workshop", dir: SITES.shed.dir, radius: 6.0 },
  { id: "garden", dir: SITES.garden.dir, radius: 4.6 },
  { id: "dish", dir: SITES.dish.dir, radius: 3.6 },
  { id: "hill", dir: HILL_TOP, radius: 5.5 },
  { id: "meadow", dir: MEADOW.oak.clone().lerp(MEADOW.picnic, 0.45).normalize(), radius: 5.0 },
  { id: "treehouse", dir: SITES.treehouse.dir, radius: 4.6 },
  { id: "playground", dir: SITES.playground.dir, radius: 5.0 },
  { id: "pond", dir: POND, radius: 5.4 },
  { id: "camp", dir: SITES.camp.dir, radius: 4.8 },
  { id: "weather", dir: SITES.weather.dir, radius: 4.2 },
  { id: "rocket", dir: SITES.rocket.dir, radius: 4.2 },
  { id: "orchard", dir: ORCHARD, radius: 5.4 },
  { id: "windpump", dir: SITES.windpump.dir, radius: 4.4 },
  { id: "balloon", dir: SITES.balloon.dir, radius: 4.4 },
];

/** Bare ground painted under a place: camp dirt, playground bark, the launch gravel. */
export const GROUND_PATCHES: { dir: Vector3; radius: number; color: string; strength: number }[] = [
  { dir: SITES.camp.dir, radius: 2.4, color: "#A98A66", strength: 0.75 },
  { dir: SITES.playground.dir, radius: 3.0, color: "#B08A62", strength: 0.6 },
  { dir: SITES.rocket.dir, radius: 2.3, color: "#ADA294", strength: 0.85 },
  { dir: SITES.weather.dir, radius: 2.2, color: "#A6B07E", strength: 0.5 },
  { dir: SITES.windpump.dir, radius: 1.6, color: "#9C8F6E", strength: 0.45 },
];

export const TERRAIN: TerrainSpec = {
  radius: HOME_RADIUS,
  seed: 11,
  // Just enough roll that the ground is not a billiard ball. Any more and the
  // silhouette goes lumpy from far away.
  noiseAmplitude: 0.07,
  noiseFrequency: 1.6,
  pads: [
    { center: SITES.house.dir, radius: PAD.house, blend: 2.2, lift: padLift(PAD.house) },
    { center: SITES.shed.dir, radius: PAD.shed, blend: 2.2, lift: padLift(PAD.shed) },
    { center: SITES.garden.dir, radius: PAD.garden, blend: 1.8, lift: padLift(PAD.garden) },
    { center: SITES.dish.dir, radius: PAD.dish, blend: 1.4, lift: padLift(PAD.dish) },
    { center: SITES.treehouse.dir, radius: PAD.treehouse, blend: 1.6, lift: padLift(PAD.treehouse) },
    { center: SITES.playground.dir, radius: PAD.playground, blend: 1.8, lift: padLift(PAD.playground) },
    { center: SITES.camp.dir, radius: PAD.camp, blend: 1.6, lift: padLift(PAD.camp) },
    { center: SITES.weather.dir, radius: PAD.weather, blend: 1.4, lift: padLift(PAD.weather) },
    { center: SITES.rocket.dir, radius: PAD.rocket, blend: 1.4, lift: padLift(PAD.rocket) },
    { center: SITES.windpump.dir, radius: PAD.windpump, blend: 1.4, lift: padLift(PAD.windpump) },
    { center: SITES.balloon.dir, radius: PAD.balloon, blend: 1.4, lift: padLift(PAD.balloon) },
  ],
  bumps: [{ center: HILL_TOP, radius: HILL.radius, height: HILL.height, plateau: HILL.plateau }],
  craters: [
    // The pond: a shallow bowl, so a kid can wade in up to the ankles.
    { center: POND, radius: POND_RADIUS, depth: 0.3, rim: 0.06 },
  ],
};
