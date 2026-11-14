import { Color, DirectionalLight, Group, HemisphereLight, Mesh, Vector3 } from "three";
import { cylinder, sphere, torus } from "../../actors/parts";
import { Batcher, SECTORS, planetMeshes } from "../../render/kit";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { createRandom, fbm3 } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir } from "../../world/sphere";
import { type Channel, type Crater, Terrain, type TerrainSpec, buildPlanetGeometry } from "../../world/terrain";
import { HADLEY } from "../../../content/chapters/hadley";
import { SteerFromTheBack } from "../../puzzles/steer-from-the-back";
import { distanceToArc } from "../shapes";
import type { Bookmark, FrameInfo, SoundSpot, World, WorldContext } from "../types";
import { PaintedEarth } from "../kit/earth";
import { LampBeam, type Site, arcPoints, at, buildTag, chapterRuntime, headingToward, siteOn } from "../kit/little-world";
import { moonOrbiters } from "../kit/orbiters";
import { addSurroundings } from "../kit/surroundings";
import { buildDescentStage, buildFlag, buildFootprints, rock } from "../tranquility/machines";
import { buildBuggy, buildOverlookFlag, buildParkingMarks, buildScienceStation, buildTrackMarks, buildWheelTray } from "./machines";

/**
 * Chapter 2: Hadley-Apennine, Dad's model of the Apollo 15 site.
 *
 * The bottom half of the lander Falcon sits on a plain under tall rounded
 * mountains (Mount Hadley to the north, Hadley Delta to the east). The Moon
 * buggy is parked beside it in Dad's chalk marks. To the south a long winding
 * valley, Hadley Rille, cuts across the world. The buggy's tracks lead from
 * its parking spot to a little red flag at the rille's edge, the way they do
 * on Dad's taped photo from orbit.
 */
export const HADLEY_RADIUS = 14;

const d = (lat: number, lon: number): Vector3 => latLonToDir(lat, lon);
// Spread out, so every machine has room round it (Game Bible: never cramped).
const SPOTS = {
  lander: d(0, 0),
  flag: d(5, 12),
  station: d(15, -9),
  park: d(-7, -21),
  tray: d(11, -32),
  landing: d(17, 25),
  tag: d(11, 34),
  parcel: d(15, 38),
  waypoint: d(-21, -45),
  overlook: d(-28, -66),
  hadley: d(36, -74),
  shoulder: d(40, -48),
  delta: d(-17, 64),
};

/** Hadley Rille: a long winding valley across the south of the world. */
const RILLE: Vector3[] = [
  d(-56, -178),
  d(-63, -142),
  d(-56, -112),
  d(-46, -88),
  d(-40, -67),
  d(-42, -45),
  d(-50, -21),
  d(-57, 7),
  d(-63, 40),
  d(-65, 78),
  d(-59, 112),
  d(-56, 150),
];
const RILLE_WIDTH = 3.5;
const RILLE_DEPTH = 1.1;

function terrainSpec(): TerrainSpec {
  const random = createRandom(23);
  const channels: Channel[] = [{ path: RILLE, width: RILLE_WIDTH, depth: RILLE_DEPTH }];
  const nearRille = (dir: Vector3): number => Math.min(...RILLE.slice(1).map((p, i) => distanceToArc(dir, RILLE[i]!, p))) * HADLEY_RADIUS;
  const keep = Object.values(SPOTS).filter((s) => s !== SPOTS.hadley && s !== SPOTS.shoulder && s !== SPOTS.delta);
  const craters: Crater[] = [];
  let tries = 0;
  while (craters.length < 18 && tries < 400) {
    tries += 1;
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    const big = craters.length < 5;
    const radius = big ? 1.8 + random() * 1.4 : 0.45 + random() * 1.0;
    const near = Math.min(...keep.map((k) => angleBetween(dir, k) * HADLEY_RADIUS));
    if (near < radius + (big ? 5.5 : 2.2)) continue;
    if (nearRille(dir) < radius + RILLE_WIDTH) continue;
    if ([SPOTS.hadley, SPOTS.delta].some((m) => angleBetween(dir, m) * HADLEY_RADIUS < 7)) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * HADLEY_RADIUS < c.radius + radius + 0.6)) continue;
    craters.push({ center: dir, radius, depth: radius * 0.2, rim: radius * 0.09 });
  }
  return {
    radius: HADLEY_RADIUS,
    seed: 41,
    noiseAmplitude: 0.13,
    noiseFrequency: 2.4,
    pads: [
      { center: SPOTS.lander, radius: 2.0, blend: 1.3 },
      { center: SPOTS.station, radius: 1.6, blend: 1.0 },
      { center: SPOTS.park, radius: 1.7, blend: 1.4 },
      { center: SPOTS.tray, radius: 1.5, blend: 1.0 },
      { center: SPOTS.landing, radius: 1.4, blend: 1 },
      { center: SPOTS.overlook, radius: 0.9, blend: 0.6 },
    ],
    // Mount Hadley and its shoulder in the north, Hadley Delta in the east: smooth, rounded, and low
    // enough that the little world stays round.
    bumps: [
      { center: SPOTS.hadley, radius: 6.8, height: 1.75 },
      { center: SPOTS.shoulder, radius: 4.2, height: 0.95 },
      { center: SPOTS.delta, radius: 6.4, height: 1.45 },
    ],
    craters,
    channels,
  };
}

const DUST_A = new Color("#A39F98");
const DUST_B = new Color("#8A867F");
const DUST_LIGHT = new Color("#BDB9B1");
const DUST_DARK = new Color("#6E6B66");
const HIGHLAND = new Color("#B7B2A8");
const WALL = new Color("#6A665F");
const FLOOR = new Color("#7C7871");
const TRACK = new Color("#77746F");

export function createHadley(ctx: WorldContext): World {
  const { toon, quality, store } = ctx;
  const root = new Group();
  root.name = "world-hadley";
  const spec = terrainSpec();
  const terrain = new Terrain(spec);
  const site = (dir: Vector3, heading: number, sink = 0.03): Site => {
    const lat = (Math.asin(dir.y) * 180) / Math.PI;
    const lon = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
    return siteOn(terrain, lat, lon, heading, sink);
  };
  const face = (from: Vector3, to: Vector3): number => headingToward(from, to);

  // The buggy's tracks: out from its spot, round by the waypoint, to the overlook.
  const route: [Vector3, Vector3][] = [
    [SPOTS.park, SPOTS.waypoint],
    [SPOTS.waypoint, SPOTS.overlook],
  ];
  const routeDistance = (dir: Vector3): number => Math.min(...route.map(([a, b]) => distanceToArc(dir, a, b) * HADLEY_RADIUS));

  // ---- The ground: grey dust, bright highlands, a dark rille ----
  const geometry = buildPlanetGeometry(terrain, Math.round(quality.terrainDetail * 0.9), (dir, r, normal, out) => {
    const n = fbm3(dir.x * 4, dir.y * 4, dir.z * 4, 3, 19);
    const fine = fbm3(dir.x * 23, dir.y * 23, dir.z * 23, 3, 6);
    const grit = fbm3(dir.x * 61, dir.y * 61, dir.z * 61, 2, 13);
    out.copy(DUST_A).lerp(DUST_B, Math.max(0, Math.min(1, 0.5 + n * 1.2)));
    if (fine > 0.18) out.lerp(DUST_LIGHT, Math.min(0.45, (fine - 0.18) * 2.2));
    else if (fine < -0.22) out.lerp(DUST_DARK, Math.min(0.3, (-0.22 - fine) * 1.8));
    out.multiplyScalar(1 + grit * 0.12);
    // The mountains are brighter highland rock.
    const height = r - HADLEY_RADIUS;
    if (height > 0.3) out.lerp(HIGHLAND, Math.min(0.7, (height - 0.3) * 0.5));
    // The rille: darker walls going down to a dusty floor, with a bright lip of rocks at the rim.
    const { t } = terrain.channelAt(dir);
    if (t < 0.45) out.lerp(FLOOR, 0.55);
    else if (t < 1.0) out.lerp(WALL, 0.65);
    else if (t < 1.25) out.lerp(DUST_LIGHT, 0.4 * (1 - (t - 1) / 0.25));
    for (const c of spec.craters ?? []) {
      const k = (angleBetween(dir, c.center) * HADLEY_RADIUS) / c.radius;
      if (k < 1) out.lerp(DUST_DARK, 0.35 * (1 - k));
      else if (k < 2.2) out.lerp(DUST_LIGHT, 0.45 * (1 - (k - 1) / 1.2));
    }
    // A darker band where the wheels went (the prints themselves are pressed in on top).
    const track = routeDistance(dir);
    if (track < 0.9) out.lerp(TRACK, 0.25 * (1 - track / 0.9));
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.34, slope * 2.4));
  });
  for (const wedge of planetMeshes(geometry, toon.toon({ vertexColors: true, paint: 0.16, rim: 0.12, nearFade: false }))) root.add(wedge);

  // ---- Earth, high in the black sky ----
  const landerUp = SPOTS.lander;
  const south = headingToTangent(landerUp, 200);
  const elevation = (52 * Math.PI) / 180;
  const earthDir = landerUp.clone().multiplyScalar(Math.sin(elevation)).addScaledVector(south, Math.cos(elevation)).normalize();
  const earth = new PaintedEarth(toon, landerUp.clone().multiplyScalar(HADLEY_RADIUS).addScaledVector(earthDir, 96), 6);
  root.add(earth.root);

  // ---- The machines ----
  const b = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];
  const add = (s: Site, shapes: ReturnType<typeof buildTag>, camera = false): void => {
    const g = createColliderGroup(s.matrix, shapes);
    colliders.push(g);
    if (camera) cameraColliders.push(g);
  };
  const landerSite = site(SPOTS.lander, 160);
  add(landerSite, buildDescentStage(b, landerSite), true);
  const parkSite = site(SPOTS.park, face(SPOTS.park, SPOTS.waypoint), 0);
  buildParkingMarks(b, parkSite);
  const traySite = site(SPOTS.tray, face(SPOTS.tray, SPOTS.park) + 90);
  add(traySite, buildWheelTray(b, traySite));
  const overlookSite = site(SPOTS.overlook, face(SPOTS.overlook, SPOTS.park));
  add(overlookSite, buildOverlookFlag(b, overlookSite));
  const tagSite = site(SPOTS.tag, face(SPOTS.tag, SPOTS.landing));
  add(tagSite, buildTag(b, tagSite));
  // The flag by the lander, and the science station out on the plain, with boot prints between.
  const flagSite = site(SPOTS.flag, face(SPOTS.flag, SPOTS.landing) + 100);
  add(flagSite, buildFlag(b, flagSite));
  const stationSite = site(SPOTS.station, face(SPOTS.station, SPOTS.lander));
  add(stationSite, buildScienceStation(b, stationSite));
  const walks: [Vector3, Vector3][] = [
    [SPOTS.lander, SPOTS.flag],
    [SPOTS.lander, SPOTS.station],
  ];
  const printRandom = createRandom(3);
  for (const [a, c] of walks) {
    const heading = face(a, c);
    buildFootprints(
      b,
      (t) => (t < 0.18 || t > 0.86 ? null : site(a.clone().lerp(c, t).normalize(), heading + (printRandom() - 0.5) * 16, 0)),
      Math.round((angleBetween(a, c) * HADLEY_RADIUS) / 0.42),
    );
  }
  // The buggy's tracks: chevron prints all the way from its spot to the overlook.
  for (const [a, c] of route) {
    const heading = face(a, c);
    const length = angleBetween(a, c) * HADLEY_RADIUS;
    buildTrackMarks(b, (t) => (t < 0.08 && a === SPOTS.park ? null : site(a.clone().lerp(c, t).normalize(), heading, 0)), Math.round(length / 0.26));
  }
  const landingSite = site(SPOTS.landing, face(SPOTS.landing, SPOTS.lander));
  const lamp = new LampBeam(landingSite, toon, b);
  root.add(lamp.root);

  // The buggy: built apart, because it drives.
  const buggy = buildBuggy(toon, quality.shadowMap > 0);
  root.add(buggy.root);
  const buggyCollider = createColliderGroup(parkSite.matrix, buggy.shapes);
  colliders.push(buggyCollider);

  // Rocks: few on the plain, boulders tumbled down the rille's walls.
  const random = createRandom(12);
  const clear = [SPOTS.lander, SPOTS.park, SPOTS.tray, SPOTS.landing, SPOTS.tag, SPOTS.parcel, SPOTS.overlook, SPOTS.flag, SPOTS.station];
  for (let i = 0; i < Math.round(80 * Math.max(0.5, quality.particles)); i += 1) {
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * HADLEY_RADIUS < 2.4) || routeDistance(dir) < 1.4) continue;
    const { t } = terrain.channelAt(dir);
    const inRille = t < 1.3;
    const size = inRille ? 0.18 + random() ** 2 * 0.5 : 0.07 + random() ** 3 * 0.42;
    const s = site(dir, random() * 360, size * 0.15);
    rock(b, s.matrix, size, random() * 6, inRille ? "#7E7A74" : "#8A8680");
    if (size > 0.3 && !inRille) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }
  // Boulders along both rims, the way they line real rilles.
  for (let i = 0; i < RILLE.length - 1; i += 1) {
    for (let k = 0; k < 5; k += 1) {
      const p = RILLE[i]!.clone().lerp(RILLE[i + 1]!, (k + random()) / 5).normalize();
      const across = headingToTangent(p, headingToward(p, RILLE[i + 1]!) + 90);
      const side = random() < 0.5 ? -1 : 1;
      const dir = p.clone().multiplyScalar(HADLEY_RADIUS).addScaledVector(across, side * (RILLE_WIDTH * 0.5 + 0.1 + random() * 0.3)).normalize();
      if (clear.some((c) => angleBetween(dir, c) * HADLEY_RADIUS < 1.6) || routeDistance(dir) < 1.2) continue;
      const size = 0.12 + random() * 0.24;
      rock(b, site(dir, random() * 360, size * 0.12).matrix, size, random() * 6, "#959089");
    }
  }
  // Little craters with bright rims, as on the other Moon world.
  const craterRandom = createRandom(64);
  for (let i = 0; i < 140; i += 1) {
    const dir = d(craterRandom() * 176 - 88, craterRandom() * 360 - 180);
    const r = 0.16 + craterRandom() ** 2 * 0.55;
    if (clear.some((k) => angleBetween(dir, k) * HADLEY_RADIUS < 1.4 + r) || routeDistance(dir) < 0.9 + r) continue;
    if (terrain.channelAt(dir).t < 1.4 || terrain.radiusAt(dir) - HADLEY_RADIUS > 0.5) continue;
    const s = site(dir, craterRandom() * 360, 0);
    const lift = (r * r) / (2 * HADLEY_RADIUS) + 0.012;
    b.place(torus(0.24), craterRandom() < 0.5 ? "#B7B2AA" : "#ABA69E", [0, lift + 0.008, 0], [Math.PI / 2, 0, 0], [r, r, 0.32 * r + 0.035], s.matrix);
    b.place(cylinder(18), "#7E7A75", [0, lift, 0], [0, 0, 0], [r * 0.9, 0.012, r * 0.9], s.matrix);
  }
  // A few tiny pebbles along the tracks, kicked up by the wheels.
  for (let i = 0; i < 40; i += 1) {
    const [a, c] = route[i % 2]!;
    const p = a.clone().lerp(c, random()).normalize();
    const s = site(p, random() * 360, 0);
    b.place(sphere("tiny"), "#8E8A84", [(random() - 0.5) * 1.6, 0.02, 0], [0, 0, 0], 0.03 + random() * 0.03, s.matrix);
  }

  const materials = { solid: toon.toon({ vertexColors: true, paint: 0.12 }), glow: toon.glow("#ffffff", true) };
  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true, sectors: SECTORS })) root.add(mesh);

  // ---- The activity ----
  const motor: SoundSpot = { position: { x: 0, y: 0, z: 0 }, loop: "motor-whine", value: 0, live: true };
  const ground = { terrain, colliders, surfaceAt: () => "regolith" };
  const activity = new SteerFromTheBack({
    ctx,
    terrain,
    buggy,
    park: parkSite,
    tray: at(traySite, 0.75, 0, 0),
    overlook: at(overlookSite, 0, 0, 0),
    colliders,
    collider: buggyCollider,
    ground,
    sound: motor,
  });

  // ---- The chapter ----
  const tracksSpot = SPOTS.park.clone().lerp(SPOTS.waypoint, 0.55).normalize();
  const tracksSite = site(tracksSpot, face(tracksSpot, SPOTS.waypoint));
  const runtime = chapterRuntime(ctx, HADLEY, {
    targets: {
      wheels: at(parkSite, 1.25, 0, 0.8),
      seats: at(parkSite, -1.2, 0, -0.05),
      tracks: at(tracksSite, 0, 0, 0),
    },
    home: at(landingSite, 0, 0, 0),
    tag: at(tagSite, 0, 0, 0.5),
    parcel: site(SPOTS.parcel, face(SPOTS.parcel, SPOTS.landing)),
  });
  for (const o of runtime.objects) root.add(o);

  // ---- Light: a low sun from the east and a cool fill ----
  const sun = new DirectionalLight("#FFF4E2", 2.5);
  sun.castShadow = quality.shadowMap > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    const cam = sun.shadow.camera;
    cam.left = -11;
    cam.right = 11;
    cam.top = 11;
    cam.bottom = -11;
    cam.near = 1;
    cam.far = 70;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.06;
  }
  root.add(sun, sun.target);
  const fill = new HemisphereLight("#7E89B0", "#3A3A40", 1.15);
  root.add(fill);

  // ---- Views ----
  const spawnDir = at(landingSite, 0.2, 0, 1.6).normalize();
  const spawnForward = headingToTangent(spawnDir, face(spawnDir, SPOTS.lander));
  const standAt = (dir: Vector3, look: Vector3): Bookmark => ({ player: { dir: dir.clone().normalize(), forward: headingToTangent(dir.clone().normalize(), face(dir, look)) }, camera: null });
  const orbit = (lat: number, lon: number, distance = 3.2): Bookmark => ({
    player: { dir: spawnDir, forward: spawnForward },
    camera: { position: latLonToDir(lat, lon).multiplyScalar(HADLEY_RADIUS * distance), target: new Vector3(), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    arrive: { player: { dir: spawnDir, forward: spawnForward }, camera: null },
    "play-buggy": standAt(at(parkSite, 2.4, 0, 1.8), SPOTS.park),
    "play-tray": standAt(at(traySite, 1.6, 0, -0.6), SPOTS.tray),
    "play-overlook": standAt(at(overlookSite, 0.7, 0, 1.4), RILLE[4]!),
    "play-rille": {
      player: { dir: at(overlookSite, 0.7, 0, 1.4).normalize(), forward: spawnForward },
      camera: { position: at(overlookSite, 1.2, 2.6, 3.6), target: RILLE[4]!.clone().multiplyScalar(HADLEY_RADIUS - 0.6), up: SPOTS.overlook.clone() },
    },
    "play-station": standAt(at(stationSite, 0, 0, 2.6), SPOTS.station),
    "buggy-close": {
      player: { dir: at(parkSite, 2.4, 0, 1.8).normalize(), forward: spawnForward },
      camera: { position: at(parkSite, 2.6, 1.5, 2.4), target: at(parkSite, 0, 0.45, 0), up: SPOTS.park.clone() },
    },
    wide: orbit(-10, -20, 3.1),
  };

  let pixelHeight = 900;
  const world: World = {
    id: "hadley",
    suits: true,
    root,
    terrain,
    colliders,
    cameraColliders,
    sky: {
      zenith: "#05060D",
      horizon: "#161A2B",
      ground: "#0A0B12",
      glow: "#E8E2D4",
      glowDirection: new Vector3(1, 0.1, 0.3),
      glowStrength: 0.18,
      clouds: 0,
      cloudColor: "#000000",
      stars: 1,
    },
    look: {
      grade: { shadows: "#1E2444", highlights: "#F2E6CF", shadowAmount: 0.32, highlightAmount: 0.14, saturation: 0.95, contrast: 1.08, lift: 0.05 },
      ink: "#1E1C22",
      inkStrength: 0.9,
      inkWidth: 1.25,
      inkFade: [24, 56],
      grain: 0.05,
      vignette: 0.62,
      lamp: "#F2A541",
    },
    sun,
    fill,
    sunHeight: 0.24,
    sunToward: new Vector3(1, 0.2, -0.2),
    dustColor: "#B9B4AC",
    fog: null,
    spawn: { dir: spawnDir, forward: spawnForward },
    entries: { lamp: { dir: spawnDir, forward: spawnForward } },
    intro: null,
    setPower() {},
    ride(dt, input, player) {
      return activity.ride(dt, input, player);
    },
    anchor(id: string) {
      const above = (p: Vector3, h: number): Vector3 => p.clone().addScaledVector(p.clone().normalize(), h);
      switch (id) {
        case "wheels":
          return above(at(parkSite, 0.7, 0, 0.8), 0.9);
        case "seats":
          return above(at(parkSite, 0, 0, 0), 1.3);
        case "tracks":
          return above(at(tracksSite, 0, 0, 0), 1.0);
        case "rille":
          return above(at(overlookSite, 0, 0, 0), 1.2);
        case "lander":
          return at(landerSite, 0, 1.8, 0);
        case "tag":
          return at(tagSite, 0, 1.2, 0);
        default:
          return null;
      }
    },
    bookmarks,
    surfaceAt(_dir, onPlatform) {
      return onPlatform ? "metal" : "regolith";
    },
    cameraHint(player) {
      // In the buggy: a little higher and farther back, looking the way it drives.
      if (!activity.riding) return null;
      return { forward: player.forward, pitch: 0.42, distance: 8.6 };
    },
    objective() {
      return runtime.objective(() => activity.objective());
    },
    map: {
      title: "Hadley-Apennine",
      radius: HADLEY_RADIUS,
      center: SPOTS.lander,
      colors: { land: "#BDB8B0", shade: "#77736D", ink: "#24222A", path: "#A29E97" },
      marks: [
        { id: "lamp", label: "Looking Lamp", at: SPOTS.landing, icon: "lamp" },
        { id: "tag", label: "Dad's tag", at: SPOTS.tag, icon: "tag" },
        { id: "lander", label: "Falcon, the lander", at: SPOTS.lander, icon: "lander" },
        { id: "flag", label: "The flag", at: SPOTS.flag, icon: "flag" },
        { id: "station", label: "Science station", at: SPOTS.station, icon: "listener" },
        { id: "buggy", label: "Moon buggy", at: SPOTS.park, icon: "buggy", letters: ["a15-letter-wheels", "a15-letter-seats"] },
        { id: "tray", label: "Wheel test", at: SPOTS.tray, icon: "wheel" },
        { id: "tracks", label: "Buggy tracks", at: tracksSpot, icon: "bounce", letters: ["a15-letter-tracks"] },
        { id: "overlook", label: "Rille overlook", at: SPOTS.overlook, icon: "pennant" },
        { id: "hadley", label: "Mount Hadley", at: SPOTS.hadley, icon: "hill" },
        { id: "delta", label: "Hadley Delta", at: SPOTS.delta, icon: "hill" },
      ],
      craters: (spec.craters ?? []).map((c) => ({ at: c.center, radius: c.radius })),
      paths: route.map(([a, c]) => arcPoints(a, c, 12)),
      valleys: [{ path: RILLE.flatMap((p, i) => (i === 0 ? [p] : arcPoints(RILLE[i - 1]!, p, 6).slice(1))), width: RILLE_WIDTH }],
    },
    sounds: [motor],
    ambience() {
      return { room: 1 };
    },
    update(dt: number, frame: FrameInfo) {
      runtime.update(dt, frame.time);
      activity.update(dt, frame.reducedMotion);
      lamp.update(frame.time, frame.reducedMotion);
      earth.update(dt, frame.reducedMotion);
    },
    resize(height: number) {
      pixelHeight = height;
      void pixelHeight;
    },
    debug: {
      ...runtime.debug,
      solve: () => {
        activity.solve();
        return true;
      },
      state: () => activity.debugState(),
      "to-overlook": () => activity.debugPlace("overlook"),
      "to-park": () => activity.debugPlace("near-park"),
      arrive: () => {
        store.update((s) => {
          if (!s.flags.includes("chapter-2:arrived")) s.flags.push("chapter-2:arrived");
        });
        return true;
      },
    },
    dispose() {
      activity.dispose();
      lamp.dispose();
      earth.dispose();
      geometry.dispose();
      root.traverse((o) => {
        if (o instanceof Mesh && (o.name.startsWith("batch") || o.name === "planet")) o.geometry.dispose();
      });
      ctx.interactions.clear();
    },
  };
  // More to see round the planet: things in orbit, small stones off the paths.
  addSurroundings(world, {
    toon,
    particles: quality.particles,
    shadows: quality.shadowMap > 0,
    seed: 23,
    orbits: moonOrbiters(HADLEY_RADIUS, 3),
    stones: { count: 320, colors: ["#8E8A84", "#7C7873", "#A39E97"] },
  });
  return world;
}
