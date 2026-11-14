import { Color, DirectionalLight, Group, HemisphereLight, Mesh, Vector3 } from "three";
import { cylinder, sphere, torus } from "../../actors/parts";
import { Batcher, SECTORS, planetMeshes } from "../../render/kit";
import type { LookSpec } from "../../render/post";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { createRandom, fbm3 } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir } from "../../world/sphere";
import { type Bump, type Crater, Terrain, type TerrainSpec, buildPlanetGeometry } from "../../world/terrain";
import { VALINOR } from "../../../content/chapters/valinor";
import { ThinAir } from "../../puzzles/thin-air";
import { distanceToArc } from "../shapes";
import type { Bookmark, FrameInfo, SoundSpot, World, WorldContext } from "../types";
import { LampBeam, type Site, arcPoints, at, buildTag, chapterRuntime, headingToward, siteOn } from "../kit/little-world";
import { marsOrbiters } from "../kit/orbiters";
import { addSurroundings } from "../kit/surroundings";
import { DustDevils, dressMars, facetRock } from "../kit/mars";
import { buildAirfield, buildIngenuity, buildLaunchPad, buildLayeredRock, buildModelHelicopter, buildRotorBench, buildRoverTracks } from "./machines";

/**
 * Chapter 4: Valinor Hills, Dad's model of Ingenuity's last stop in Jezero
 * Crater on Mars.
 *
 * Ingenuity stands on a low rise among long waves of sand, one blade broken.
 * Off to the east, Dad's square of pebbles marks Wright Brothers Field, where
 * it first flew, with its shadow painted in the middle. The rover's tracks
 * run past and away over the hill (the rover drove on). Dad's rotor bench and
 * his toy helicopter's launch pad wait to the north, and the crater's far
 * rim and its old layered delta rise round the edge of the little world.
 */
export const VALINOR_RADIUS = 14;

const d = (lat: number, lon: number): Vector3 => latLonToDir(lat, lon);
// Spread out, so every machine has room round it.
const SPOTS = {
  ingenuity: d(0, 0),
  landing: d(18, 28),
  tag: d(11, 36),
  parcel: d(16, 41),
  airfield: d(-6, 50),
  bench: d(19, -17),
  pad: d(5, -36),
  rim: d(-8, 160),
  rimWest: d(38, -110),
  delta: d(-46, 112),
};
/** The rover's tracks: in from the far side, past Ingenuity, and away over the hill. */
const TRACK: Vector3[] = [d(-38, 70), d(-18, 18), d(-27, -28), d(-42, -76), d(-50, -130)];
/** The long sand waves run this way. */
const RIPPLE_AXIS = d(20, 75);

const SAND_A = new Color("#C98B5E");
const SAND_B = new Color("#B7744A");
const SAND_LIGHT = new Color("#E0AC7C");
const SAND_DARK = new Color("#9A5E3C");
const RIPPLE = new Color("#8E5236");
const RIM = new Color("#A9724E");
const TRACK_COLOR = new Color("#9E5F3E");
/** Patches of dark, basalt sand between the paler dust. */
const DARK_SAND = new Color("#7E4C38");

function terrainSpec(): TerrainSpec {
  const random = createRandom(47);
  const keep = [SPOTS.ingenuity, SPOTS.landing, SPOTS.tag, SPOTS.parcel, SPOTS.airfield, SPOTS.bench, SPOTS.pad];
  const craters: Crater[] = [];
  let tries = 0;
  while (craters.length < 10 && tries < 300) {
    tries += 1;
    const dir = d(random() * 160 - 80, random() * 360 - 180);
    const radius = 0.8 + random() * 1.8;
    if (Math.min(...keep.map((k) => angleBetween(dir, k) * VALINOR_RADIUS)) < radius + 5) continue;
    if ([SPOTS.rim, SPOTS.rimWest, SPOTS.delta].some((m) => angleBetween(dir, m) * VALINOR_RADIUS < 8)) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * VALINOR_RADIUS < c.radius + radius + 1)) continue;
    craters.push({ center: dir, radius, depth: radius * 0.16, rim: radius * 0.07 });
  }
  const bumps: Bump[] = [
    // The low rise Ingenuity stands on.
    { center: SPOTS.ingenuity, radius: 4.2, height: 0.45, plateau: 0.25 },
    // The crater's far rim and the old delta, round the edge of the little world.
    { center: SPOTS.rim, radius: 7, height: 1.5 },
    { center: SPOTS.rimWest, radius: 6, height: 1.2 },
    { center: SPOTS.delta, radius: 5.5, height: 0.9, plateau: 0.4 },
  ];
  return {
    radius: VALINOR_RADIUS,
    seed: 53,
    noiseAmplitude: 0.12,
    noiseFrequency: 2.2,
    pads: [
      { center: SPOTS.landing, radius: 1.4, blend: 1 },
      { center: SPOTS.airfield, radius: 2.2, blend: 1.2 },
      { center: SPOTS.bench, radius: 1.4, blend: 1 },
      { center: SPOTS.pad, radius: 1.1, blend: 0.8 },
    ],
    bumps,
    craters,
  };
}

const LOOK: LookSpec = {
  grade: { shadows: "#553052", highlights: "#FFD7A6", shadowAmount: 0.3, highlightAmount: 0.18, saturation: 1.03, contrast: 1.05, lift: 0.05 },
  ink: "#2E1E1A",
  inkStrength: 0.85,
  inkWidth: 1.2,
  inkFade: [22, 52],
  grain: 0.06,
  vignette: 0.6,
  lamp: "#F2A541",
};

export function createValinor(ctx: WorldContext): World {
  const { toon, quality, store } = ctx;
  const root = new Group();
  root.name = "world-valinor";
  const spec = terrainSpec();
  const terrain = new Terrain(spec);
  const site = (dir: Vector3, heading: number, sink = 0.03): Site => {
    const lat = (Math.asin(dir.y) * 180) / Math.PI;
    const lon = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
    return siteOn(terrain, lat, lon, heading, sink);
  };
  const face = (from: Vector3, to: Vector3): number => headingToward(from, to);
  const trackDistance = (dir: Vector3): number => Math.min(...TRACK.slice(1).map((p, i) => distanceToArc(dir, TRACK[i]!, p))) * VALINOR_RADIUS;

  // ---- The ground: butterscotch sand in long waves, a darker rim, the rover's tread band ----
  const geometry = buildPlanetGeometry(terrain, Math.round(quality.terrainDetail * 0.85), (dir, r, normal, out) => {
    const n = fbm3(dir.x * 3.6, dir.y * 3.6, dir.z * 3.6, 3, 21);
    const fine = fbm3(dir.x * 22, dir.y * 22, dir.z * 22, 3, 8);
    const grit = fbm3(dir.x * 59, dir.y * 59, dir.z * 59, 2, 17);
    out.copy(SAND_A).lerp(SAND_B, Math.max(0, Math.min(1, 0.5 + n * 1.3)));
    if (fine > 0.2) out.lerp(SAND_LIGHT, Math.min(0.4, (fine - 0.2) * 2));
    const dark = fbm3(dir.x * 1.7 + 5.3, dir.y * 1.7, dir.z * 1.7, 3, 33);
    if (dark > 0.14) out.lerp(DARK_SAND, Math.min(0.45, (dark - 0.14) * 2.2));
    // Long sand waves, like the ones round the real helicopter: clear rows, everywhere.
    const wave = Math.sin(dir.dot(RIPPLE_AXIS) * 120 + n * 6);
    if (wave > 0.45) out.lerp(RIPPLE, Math.min(0.5, (wave - 0.45) * 1.4));
    else if (wave < -0.7) out.lerp(SAND_LIGHT, 0.25);
    out.multiplyScalar(1 + grit * 0.1);
    // The crater rim and the delta are older, harder rock.
    const height = r - VALINOR_RADIUS;
    if (height > 0.4) out.lerp(RIM, Math.min(0.6, (height - 0.4) * 0.6));
    for (const c of spec.craters ?? []) {
      const t = (angleBetween(dir, c.center) * VALINOR_RADIUS) / c.radius;
      if (t < 1) out.lerp(SAND_DARK, 0.3 * (1 - t));
      else if (t < 1.8) out.lerp(SAND_LIGHT, 0.3 * (1 - (t - 1) / 0.8));
    }
    const track = trackDistance(dir);
    if (track < 1.1) out.lerp(TRACK_COLOR, 0.3 * (1 - track / 1.1));
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.28, slope * 2.4));
  });
  for (const wedge of planetMeshes(geometry, toon.toon({ vertexColors: true, paint: 0.15, rim: 0.12, nearFade: false }))) root.add(wedge);

  // ---- The machines ----
  const b = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];
  const add = (s: Site, shapes: ReturnType<typeof buildTag>, camera = false): void => {
    if (shapes.length === 0) return;
    const g = createColliderGroup(s.matrix, shapes);
    colliders.push(g);
    if (camera) cameraColliders.push(g);
  };
  const ingenuitySite = site(SPOTS.ingenuity, face(SPOTS.ingenuity, SPOTS.landing) + 20, 0.01);
  add(ingenuitySite, buildIngenuity(b, ingenuitySite));
  const fieldSite = site(SPOTS.airfield, face(SPOTS.airfield, SPOTS.ingenuity), 0);
  add(fieldSite, buildAirfield(b, fieldSite));
  const benchSite = site(SPOTS.bench, face(SPOTS.bench, SPOTS.ingenuity));
  add(benchSite, buildRotorBench(b, benchSite));
  const padSite = site(SPOTS.pad, face(SPOTS.pad, SPOTS.ingenuity), 0);
  buildLaunchPad(b, padSite);
  const tagSite = site(SPOTS.tag, face(SPOTS.tag, SPOTS.landing));
  add(tagSite, buildTag(b, tagSite));
  const landingSite = site(SPOTS.landing, face(SPOTS.landing, SPOTS.ingenuity));
  const lamp = new LampBeam(landingSite, toon, b);
  root.add(lamp.root);

  // The rover's tracks, all the way across.
  for (let i = 0; i + 1 < TRACK.length; i += 1) {
    const a = TRACK[i]!;
    const c = TRACK[i + 1]!;
    const heading = face(a, c);
    const length = angleBetween(a, c) * VALINOR_RADIUS;
    buildRoverTracks(b, (t) => site(a.clone().lerp(c, t).normalize(), heading, 0), Math.round(length / 0.32));
  }

  // Dad's toy helicopter: its own group, because it flies.
  const helicopter = buildModelHelicopter(toon);
  root.add(helicopter.root);

  // The old delta's layered rocks, and boulders here and there with room round them.
  const random = createRandom(19);
  const clear = [SPOTS.ingenuity, SPOTS.landing, SPOTS.tag, SPOTS.parcel, SPOTS.airfield, SPOTS.bench, SPOTS.pad];
  for (let i = 0; i < 7; i += 1) {
    const dir = headingToTangent(SPOTS.delta, i * 51 + random() * 20).multiplyScalar((1.5 + random() * 3.5) / VALINOR_RADIUS).add(SPOTS.delta).normalize();
    const s = site(dir, random() * 360, 0.05);
    add(s, buildLayeredRock(b, s, 0.5 + random() * 0.6));
  }
  for (let i = 0; i < Math.round(60 * Math.max(0.5, quality.particles)); i += 1) {
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * VALINOR_RADIUS < 3) || trackDistance(dir) < 1.5) continue;
    const size = 0.07 + random() ** 3 * 0.5;
    const s = site(dir, random() * 360, size * 0.15);
    b.place(facetRock(i), random() < 0.5 ? "#8E5A40" : "#6A4236", [0, size * 0.28, 0], [random() * 0.5, random() * 6, random() * 0.5], [size, size * 0.7, size * 0.88], s.matrix);
    if (size > 0.3) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }
  // Little soft craters, as drawn: a pale rim and a darker bowl.
  const craterRandom = createRandom(91);
  for (let i = 0; i < 60; i += 1) {
    const dir = d(craterRandom() * 176 - 88, craterRandom() * 360 - 180);
    const r = 0.18 + craterRandom() ** 2 * 0.5;
    if (clear.some((k) => angleBetween(dir, k) * VALINOR_RADIUS < 2 + r) || trackDistance(dir) < 1 + r) continue;
    if (terrain.radiusAt(dir) - VALINOR_RADIUS > 0.4) continue;
    const s = site(dir, craterRandom() * 360, 0);
    const lift = (r * r) / (2 * VALINOR_RADIUS) + 0.012;
    b.place(torus(0.22), craterRandom() < 0.5 ? "#D49C6E" : "#C98F62", [0, lift + 0.008, 0], [Math.PI / 2, 0, 0], [r, r, 0.3 * r + 0.03], s.matrix);
    b.place(cylinder(18), "#A2633F", [0, lift, 0], [0, 0, 0], [r * 0.9, 0.012, r * 0.9], s.matrix);
  }
  // Pebbles kicked up along the tracks.
  for (let i = 0; i < 50; i += 1) {
    const k = Math.floor(random() * (TRACK.length - 1));
    const p = TRACK[k]!.clone().lerp(TRACK[k + 1]!, random()).normalize();
    b.place(sphere("tiny"), "#7A4A36", [(random() - 0.5) * 2.4, 0.02, 0], [0, 0, 0], 0.03 + random() * 0.03, site(p, random() * 360, 0).matrix);
  }

  // More of Mars, with room round everything: buttes like the ones in the real crater, dark boulder
  // families with sand banked behind them, crescent dunes, a balanced rock or two and broken slabs.
  const tracksAt = TRACK[1]!.clone().lerp(TRACK[2]!, 0.12).normalize();
  dressMars({
    b,
    radius: VALINOR_RADIUS,
    seed: 7,
    site,
    colliders,
    terrain,
    keep: clear,
    paths: [
      [SPOTS.landing, SPOTS.ingenuity],
      [SPOTS.ingenuity, SPOTS.bench],
      [SPOTS.ingenuity, SPOTS.pad],
      [SPOTS.bench, SPOTS.pad],
      [SPOTS.ingenuity, SPOTS.airfield],
      [SPOTS.landing, SPOTS.airfield],
      [SPOTS.landing, SPOTS.bench],
      [SPOTS.landing, SPOTS.parcel],
      [SPOTS.ingenuity, tracksAt],
    ],
    taken: [{ dir: SPOTS.delta, room: 5.5 }],
    avoid: (dir) => trackDistance(dir) < 1.8,
    counts: { buttes: 6, boulders: 16, balanced: 3, dunes: 8, slabs: 6 },
  });

  const materials = { solid: toon.toon({ vertexColors: true, paint: 0.12 }), glow: toon.glow("#ffffff", true) };
  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true, sectors: SECTORS })) root.add(mesh);

  // ---- The activity ----
  const buzz: SoundSpot = { position: { x: 0, y: 0, z: 0 }, loop: "motor-whine", value: 0, live: true };
  const activity = new ThinAir({
    ctx,
    bench: at(benchSite, 0, 0, 0.9),
    pad: padSite,
    helicopter,
    ingenuity: at(ingenuitySite, 0, 0, 0.9),
    sound: buzz,
  });

  // Small dust devils wander across now and then, away from the machines.
  const devils = new DustDevils(terrain, VALINOR_RADIUS, quality.particles >= 0.6 ? 2 : 1, (dir) => clear.some((k) => angleBetween(dir, k) * VALINOR_RADIUS < 4), 13);
  root.add(devils.points);

  // ---- The chapter ----
  const tracksSpot = TRACK[1]!.clone().lerp(TRACK[2]!, 0.12).normalize();
  const tracksSite = site(tracksSpot, face(tracksSpot, TRACK[2]!));
  const runtime = chapterRuntime(ctx, VALINOR, {
    targets: {
      airfield: at(fieldSite, 0, 0, -1.9),
      tracks: at(tracksSite, 1.3, 0, 0),
      ingenuity: at(ingenuitySite, 0, 0, 0.95),
    },
    home: at(landingSite, 0, 0, 0),
    tag: at(tagSite, 0, 0, 0.5),
    parcel: site(SPOTS.parcel, face(SPOTS.parcel, SPOTS.landing)),
  });
  for (const o of runtime.objects) root.add(o);

  // ---- Light: a warm, low sun and a dusty fill ----
  const sun = new DirectionalLight("#FFE9CF", 2.3);
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
  const fill = new HemisphereLight("#E9C7A4", "#7A4A3A", 1.1);
  root.add(fill);

  // ---- Views ----
  const spawnDir = at(landingSite, 0.2, 0, 1.6).normalize();
  const spawnForward = headingToTangent(spawnDir, face(spawnDir, SPOTS.ingenuity));
  const standAt = (dir: Vector3, look: Vector3): Bookmark => ({ player: { dir: dir.clone().normalize(), forward: headingToTangent(dir.clone().normalize(), face(dir, look)) }, camera: null });
  const orbit = (lat: number, lon: number, distance = 3.2): Bookmark => ({
    player: { dir: spawnDir, forward: spawnForward },
    camera: { position: latLonToDir(lat, lon).multiplyScalar(VALINOR_RADIUS * distance), target: new Vector3(), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    arrive: { player: { dir: spawnDir, forward: spawnForward }, camera: null },
    "play-ingenuity": standAt(at(ingenuitySite, 0.6, 0, 2.4), SPOTS.ingenuity),
    "play-field": standAt(at(fieldSite, 0, 0, -2.6), SPOTS.airfield),
    "play-bench": standAt(at(benchSite, 0, 0, 1.8), SPOTS.bench),
    "play-pad": standAt(at(padSite, 0, 0, 1.8), SPOTS.pad),
    "play-tracks": standAt(at(tracksSite, 2.4, 0, 0), tracksSpot),
    "ingenuity-close": {
      player: { dir: at(ingenuitySite, 0.6, 0, 2.4).normalize(), forward: spawnForward },
      camera: { position: at(ingenuitySite, 1.4, 1.3, 2.2), target: at(ingenuitySite, 0, 0.75, 0), up: SPOTS.ingenuity.clone() },
    },
    wide: orbit(-6, 4, 3.1),
  };

  const world: World = {
    id: "valinor",
    suits: true,
    root,
    terrain,
    colliders,
    cameraColliders,
    sky: {
      zenith: "#C28C62",
      horizon: "#EEC9A0",
      ground: "#DDAA80",
      glow: "#B7CDE0",
      glowDirection: new Vector3(1, 0.3, 0.2),
      glowStrength: 0.3,
      clouds: 0.22,
      cloudColor: "#E2B088",
      stars: 0,
    },
    look: LOOK,
    sun,
    fill,
    sunHeight: 0.32,
    sunToward: new Vector3(0.8, 0.3, 0.4),
    dustColor: "#D29A6C",
    fog: { color: "#E0AE82", near: -2, far: 24 },
    spawn: { dir: spawnDir, forward: spawnForward },
    entries: { lamp: { dir: spawnDir, forward: spawnForward } },
    intro: null,
    setPower() {},
    anchor(id: string) {
      const above = (p: Vector3, h: number): Vector3 => p.clone().addScaledVector(p.clone().normalize(), h);
      switch (id) {
        case "airfield":
          return above(at(fieldSite, 0, 0, 0), 1.0);
        case "tracks":
          return above(at(tracksSite, 0, 0, 0), 1.0);
        case "ingenuity":
          return above(at(ingenuitySite, 0, 0, 0), 1.6);
        case "tag":
          return at(tagSite, 0, 1.2, 0);
        default:
          return null;
      }
    },
    bookmarks,
    surfaceAt(_dir, onPlatform) {
      return onPlatform ? "metal" : "dust";
    },
    cameraHint() {
      return null;
    },
    objective() {
      return runtime.objective(() => activity.objective());
    },
    map: {
      title: "Valinor Hills",
      radius: VALINOR_RADIUS,
      center: SPOTS.ingenuity,
      colors: { land: "#D9A273", shade: "#A8683F", ink: "#2E1E1A", path: "#9E5F3E" },
      marks: [
        { id: "lamp", label: "Looking Lamp", at: SPOTS.landing, icon: "lamp" },
        { id: "tag", label: "Dad's tag", at: SPOTS.tag, icon: "tag" },
        { id: "ingenuity", label: "Ingenuity", at: SPOTS.ingenuity, icon: "helicopter", letters: ["ing-letter-heli"] },
        { id: "airfield", label: "Wright Brothers Field", at: SPOTS.airfield, icon: "pennant", letters: ["ing-letter-field"] },
        { id: "tracks", label: "Rover tracks", at: tracksSpot, icon: "bounce", letters: ["ing-letter-tracks"] },
        { id: "bench", label: "Rotor bench", at: SPOTS.bench, icon: "console" },
        { id: "pad", label: "Toy helicopter", at: SPOTS.pad, icon: "helicopter" },
        { id: "rim", label: "Crater rim", at: SPOTS.rim, icon: "hill" },
        { id: "delta", label: "Old delta", at: SPOTS.delta, icon: "rocks" },
      ],
      craters: (spec.craters ?? []).map((c) => ({ at: c.center, radius: c.radius })),
      paths: TRACK.slice(1).map((p, i) => arcPoints(TRACK[i]!, p, 12)),
    },
    sounds: [buzz],
    ambience() {
      return { room: 1 };
    },
    update(dt: number, frame: FrameInfo) {
      runtime.update(dt, frame.time);
      activity.watch(frame.player.position);
      activity.update(dt, frame.reducedMotion);
      devils.update(dt, frame.reducedMotion);
      lamp.update(frame.time, frame.reducedMotion);
    },
    resize(height: number) {
      devils.resize(height);
    },
    debug: {
      ...runtime.debug,
      solve: () => {
        activity.solve();
        return true;
      },
      state: () => activity.debugState(),
      pad: () => ({ origin: padSite.origin.toArray(), dir: padSite.dir.toArray(), heli: helicopter.root.position.toArray() }),
      arrive: () => {
        store.update((s) => {
          if (!s.flags.includes("chapter-4:arrived")) s.flags.push("chapter-4:arrived");
        });
        return true;
      },
    },
    dispose() {
      activity.dispose();
      devils.dispose();
      lamp.dispose();
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
    seed: 53,
    orbits: marsOrbiters(VALINOR_RADIUS, 5),
    stones: { count: 320, colors: ["#6A4236", "#5C3B33", "#8E5238", "#4E342F"] },
  });
  return world;
}
