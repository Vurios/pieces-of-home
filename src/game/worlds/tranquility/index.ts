import { Color, DirectionalLight, Group, HemisphereLight, Mesh, Vector3 } from "three";
import { cylinder, torus } from "../../actors/parts";
import { Batcher } from "../../render/kit";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { createRandom, fbm3 } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import { type Crater, Terrain, type TerrainSpec, buildPlanetGeometry } from "../../world/terrain";
import { TRANQUILITY } from "../../../content/chapters/tranquility";
import { SendALight } from "../../puzzles/send-a-light";
import { distanceToArc } from "../shapes";
import type { Bookmark, FrameInfo, World, WorldContext } from "../types";
import { PaintedEarth } from "../kit/earth";
import { LampBeam, type Site, arcPoints, at, buildTag, chapterRuntime, headingToward, siteOn } from "../kit/little-world";
import { buildCamera, buildDescentStage, buildFlag, buildFootprints, buildMirrorArray, buildSeismometer, rock } from "./machines";

/**
 * Chapter 1: Tranquility Base, Dad's model of the Apollo 11 landing site.
 *
 * The arrangement follows the real site maps (Apollo Lunar Surface Journal,
 * LROC), squeezed onto a little world: the lander in the middle, the flag and
 * the TV camera to the north and west, the moonquake listener and the little
 * mirrors to the south, Little West crater off to the east, and boot prints
 * between them. Dad added his own practice corner and an Earth console for
 * the laser activity, a little apart from the real things.
 */
export const MOON_RADIUS = 13;

const d = (lat: number, lon: number): Vector3 => latLonToDir(lat, lon);
const SPOTS = {
  lander: d(0, 0),
  flag: d(13, -15),
  camera: d(25, -6),
  listener: d(-18, 5),
  mirrors: d(-19, -10),
  rig: d(-36, -27),
  console: d(-25, -39),
  holderA: d(-44, -15),
  holderB: d(-48, -35),
  landing: d(12, 25),
  tag: d(7, 31),
  parcel: d(9.5, 33.5),
  littleWest: d(3, 51),
};

function terrainSpec(): TerrainSpec {
  const random = createRandom(31);
  const craters: Crater[] = [{ center: SPOTS.littleWest, radius: 2.7, depth: 0.75, rim: 0.28 }];
  const keepClear = Object.values(SPOTS);
  let tries = 0;
  while (craters.length < 26 && tries < 400) {
    tries += 1;
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    const big = craters.length < 7;
    const radius = big ? 2.2 + random() * 1.8 : 0.45 + random() * 1.1;
    // Near the base the ground stays calm; big bowls go round the far side.
    const near = Math.min(...keepClear.map((k) => angleBetween(dir, k) * MOON_RADIUS));
    if (near < radius + (big ? 6 : 1.6)) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * MOON_RADIUS < c.radius + radius + 0.6)) continue;
    craters.push({ center: dir, radius, depth: radius * (big ? 0.24 : 0.2), rim: radius * 0.1 });
  }
  return {
    radius: MOON_RADIUS,
    seed: 17,
    noiseAmplitude: 0.16,
    noiseFrequency: 2.6,
    pads: [
      { center: SPOTS.lander, radius: 2.1, blend: 1.4 },
      { center: SPOTS.rig, radius: 1.2, blend: 1 },
      { center: SPOTS.console, radius: 0.9, blend: 0.8 },
      { center: SPOTS.mirrors, radius: 0.8, blend: 0.8 },
      { center: SPOTS.listener, radius: 1.0, blend: 0.8 },
      { center: SPOTS.landing, radius: 1.4, blend: 1 },
    ],
    craters,
  };
}

const DUST_A = new Color("#A39F98");
const DUST_B = new Color("#86837D");
const DUST_LIGHT = new Color("#BDB9B1");
const DUST_DARK = new Color("#6E6B66");
const TRACK = new Color("#77746F");

export function createTranquility(ctx: WorldContext): World {
  const { toon, quality, store, bus } = ctx;
  const root = new Group();
  root.name = "world-tranquility";
  const spec = terrainSpec();
  const terrain = new Terrain(spec);
  const site = (dir: Vector3, heading: number): Site => {
    const ll = { lat: (Math.asin(dir.y) * 180) / Math.PI, lon: (Math.atan2(dir.x, dir.z) * 180) / Math.PI };
    return siteOn(terrain, ll.lat, ll.lon, heading);
  };
  const face = (from: Vector3, to: Vector3): number => headingToward(from, to);

  // ---- Earth, fixed in the black sky beyond Dad's practice corner ----
  const rigSite = site(SPOTS.rig, face(SPOTS.rig, SPOTS.console));
  const toward = headingToTangent(SPOTS.rig, face(SPOTS.rig, SPOTS.console) + 180);
  // Low in the sky, so it stays in view behind the practice corner.
  const elevation = (12 * Math.PI) / 180;
  const earthDir = SPOTS.rig.clone().multiplyScalar(Math.sin(elevation)).addScaledVector(toward, Math.cos(elevation)).normalize();
  const EARTH_RADIUS = 6;
  const earth = new PaintedEarth(toon, at(rigSite, 0, 0.8, 0).addScaledVector(earthDir, 92), EARTH_RADIUS);
  root.add(earth.root);

  // ---- Footprint tracks, painted into the dust and pressed in as prints ----
  const trails: [Vector3, Vector3][] = [
    [SPOTS.lander, SPOTS.flag],
    [SPOTS.lander, SPOTS.camera],
    [SPOTS.lander, SPOTS.listener],
    [SPOTS.listener, SPOTS.mirrors],
    [SPOTS.lander, d(3, 47.5)],
  ];
  const trackDistance = (dir: Vector3): number => Math.min(...trails.map(([a, b]) => distanceToArc(dir, a, b) * MOON_RADIUS));

  // ---- The ground ----
  const geometry = buildPlanetGeometry(terrain, Math.round(quality.terrainDetail * 0.85), (dir, r, normal, out) => {
    const n = fbm3(dir.x * 4, dir.y * 4, dir.z * 4, 3, 8);
    const fine = fbm3(dir.x * 23, dir.y * 23, dir.z * 23, 3, 4);
    const grit = fbm3(dir.x * 61, dir.y * 61, dir.z * 61, 2, 11);
    // Soft maria-like patches, then fine speckle so the dust never reads as smooth clay.
    out.copy(DUST_A).lerp(DUST_B, Math.max(0, Math.min(1, 0.5 + n * 1.2)));
    if (fine > 0.18) out.lerp(DUST_LIGHT, Math.min(0.45, (fine - 0.18) * 2.2));
    else if (fine < -0.22) out.lerp(DUST_DARK, Math.min(0.3, (-0.22 - fine) * 1.8));
    out.multiplyScalar(1 + grit * 0.12);
    // Bright ejecta round each crater, darker dust in the bowl.
    for (const c of spec.craters ?? []) {
      const t = (angleBetween(dir, c.center) * MOON_RADIUS) / c.radius;
      if (t < 1) out.lerp(DUST_DARK, 0.35 * (1 - t));
      else if (t < 2.2) out.lerp(DUST_LIGHT, 0.45 * (1 - (t - 1) / 1.2));
    }
    // The engine blew the dust smooth and a little brighter round the lander.
    const lander = angleBetween(dir, SPOTS.lander) * MOON_RADIUS;
    if (lander < 4.5) out.lerp(DUST_LIGHT, 0.3 * Math.min(1, (4.5 - lander) / 2));
    // Walked ground is darker, the way it looks from orbit.
    const track = trackDistance(dir);
    if (track < 0.45) out.lerp(TRACK, 0.6 * (1 - track / 0.45));
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.3, slope * 2.6));
    void r;
  });
  // A grainier paint than Home's lawn, so the dust has tooth up close.
  const planet = new Mesh(geometry, toon.toon({ vertexColors: true, paint: 0.16, rim: 0.12, nearFade: false }));
  planet.name = "planet";
  planet.receiveShadow = true;
  root.add(planet);

  // ---- The machines ----
  const b = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];
  const add = (s: Site, shapes: ReturnType<typeof buildFlag>, camera = false): void => {
    const g = createColliderGroup(s.matrix, shapes);
    colliders.push(g);
    if (camera) cameraColliders.push(g);
  };
  const landerSite = site(SPOTS.lander, 200);
  add(landerSite, buildDescentStage(b, landerSite), true);
  const flagSite = site(SPOTS.flag, face(SPOTS.flag, SPOTS.landing) + 100);
  add(flagSite, buildFlag(b, flagSite));
  const cameraSite = site(SPOTS.camera, face(SPOTS.camera, SPOTS.lander));
  add(cameraSite, buildCamera(b, cameraSite));
  const listenerSite = site(SPOTS.listener, face(SPOTS.listener, SPOTS.lander));
  add(listenerSite, buildSeismometer(b, listenerSite));
  // The little mirrors face Earth, tipped up to look at it.
  const earthPos = earth.root.position;
  const mirrorsSite = site(SPOTS.mirrors, face(SPOTS.mirrors, earthPos.clone().normalize()));
  const upAtMirrors = SPOTS.mirrors;
  const toEarth = earthPos.clone().sub(mirrorsSite.origin).normalize();
  const tilt = Math.acos(Math.max(-1, Math.min(1, toEarth.dot(upAtMirrors))));
  const array = buildMirrorArray(b, mirrorsSite, toon, tilt);
  add(mirrorsSite, array.shapes);
  root.add(array.glints);

  // Dad's tag and the Looking Lamp's landing circle.
  const tagSite = site(SPOTS.tag, face(SPOTS.tag, SPOTS.landing));
  add(tagSite, buildTag(b, tagSite));
  const landingSite = site(SPOTS.landing, face(SPOTS.landing, SPOTS.lander));
  const lamp = new LampBeam(landingSite, toon, b);
  root.add(lamp.root);

  // Footprints along every walked track.
  const random = createRandom(5);
  for (const [a, c] of trails) {
    const length = angleBetween(a, c) * MOON_RADIUS;
    const heading = face(a, c);
    buildFootprints(
      b,
      (t) => {
        if (t < 0.12 || t > 0.9) return null;
        const dir = a.clone().lerp(c, t).normalize();
        const s = siteOn(terrain, (Math.asin(dir.y) * 180) / Math.PI, (Math.atan2(dir.x, dir.z) * 180) / Math.PI, heading + (random() - 0.5) * 16, 0.0);
        return s;
      },
      Math.round(length / 0.42),
    );
  }

  // Rocks everywhere but the paths and the machines.
  const clear = Object.values(SPOTS);
  for (let i = 0; i < Math.round(70 * Math.max(0.5, quality.particles)); i += 1) {
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * MOON_RADIUS < 2.2) || trackDistance(dir) < 0.8) continue;
    const size = 0.08 + random() ** 3 * 0.55;
    const s = siteOn(terrain, (Math.asin(dir.y) * 180) / Math.PI, (Math.atan2(dir.x, dir.z) * 180) / Math.PI, random() * 360, size * 0.15);
    rock(b, s.matrix, size, random() * 6);
    if (size > 0.3) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }

  // Little craters everywhere: a raised rim of bright dust round a darker bowl, inked like a drawing.
  const craterRandom = createRandom(77);
  for (let i = 0; i < 160; i += 1) {
    const dir = d(craterRandom() * 176 - 88, craterRandom() * 360 - 180);
    const r = 0.16 + craterRandom() ** 2 * 0.6;
    if (clear.some((k) => angleBetween(dir, k) * MOON_RADIUS < 1.3 + r) || trackDistance(dir) < 0.4 + r) continue;
    const s = siteOn(terrain, (Math.asin(dir.y) * 180) / Math.PI, (Math.atan2(dir.x, dir.z) * 180) / Math.PI, craterRandom() * 360, 0);
    // The ground curves away under a flat piece, so lift it by that sag.
    const lift = (r * r) / (2 * MOON_RADIUS) + 0.012;
    b.place(torus(0.24), craterRandom() < 0.5 ? "#B7B2AA" : "#ABA69E", [0, lift + 0.008, 0], [Math.PI / 2, 0, 0], [r, r, 0.32 * r + 0.035], s.matrix);
    b.place(cylinder(18), "#7E7A75", [0, lift, 0], [0, 0, 0], [r * 0.9, 0.012, r * 0.9], s.matrix);
    b.place(cylinder(14), "#6F6B66", [r * 0.14, lift + 0.004, -r * 0.12], [0, 0, 0], [r * 0.5, 0.012, r * 0.5], s.matrix);
  }

  // ---- Dad's practice corner, the Earth console and the spare mirrors ----
  const consoleSite = site(SPOTS.console, face(SPOTS.console, SPOTS.rig) + 180);
  const holderA = site(SPOTS.holderA, face(SPOTS.holderA, SPOTS.rig) + 180);
  const holderB = site(SPOTS.holderB, face(SPOTS.holderB, SPOTS.rig) + 180);
  const activity = new SendALight({
    ctx,
    b,
    root,
    terrain,
    rig: rigSite,
    console: consoleSite,
    holders: [holderA, holderB],
    earth,
    earthRadius: EARTH_RADIUS,
    glints: array.glints,
    views: {
      // From behind the console: the corner, the beam and Earth in one frame.
      pulse: { position: at(consoleSite, 1.6, 2.4, 5.2), target: at(rigSite, 0, 1.2, 0).lerp(earth.root.position, 0.08) },
      // Low in front of the little mirrors, looking at their hundred cubes.
      glint: { position: at(mirrorsSite, 0.5, 1.5, 2.3), target: at(mirrorsSite, 0, 0.35, 0) },
    },
  });
  add(rigSite, activity.shapes.rig, true);
  add(consoleSite, activity.shapes.console);
  add(holderA, activity.shapes.holder);
  add(holderB, activity.shapes.holder);

  const materials = { solid: toon.toon({ vertexColors: true, paint: 0.12 }), glow: toon.glow("#ffffff", true) };
  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true })) root.add(mesh);

  // ---- The chapter: letters, Dad's tag, the parcel for Milo and the way home ----
  const stand = (s: Site, x: number, z: number): Vector3 => at(s, x, 0, z);
  const runtime = chapterRuntime(ctx, TRANQUILITY, {
    targets: {
      descent: stand(landerSite, 0, 0).addScaledVector(landerSite.dir, 0).lerp(stand(landingSite, 0, 0), 0.3),
      seismometer: stand(listenerSite, 0, 0.8),
      lrrr: stand(mirrorsSite, 0, 0.9),
    },
    home: stand(landingSite, 0, 0),
    tag: stand(tagSite, 0, 0.5),
    parcel: site(SPOTS.parcel, face(SPOTS.parcel, SPOTS.landing)),
  });
  for (const o of runtime.objects) root.add(o);

  // ---- Light: a hard, low sun and a little blue fill, like early morning on the Moon ----
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
    camera: { position: latLonToDir(lat, lon).multiplyScalar(MOON_RADIUS * distance), target: new Vector3(), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    arrive: { player: { dir: spawnDir, forward: spawnForward }, camera: null },
    "play-lander": standAt(at(landerSite, 0, 0, 0).lerp(at(landingSite, 0, 0, 0), 0.62), SPOTS.lander),
    "play-mirrors": standAt(at(mirrorsSite, 0.3, 0, 2.6), SPOTS.mirrors),
    "play-listener": standAt(at(listenerSite, -0.6, 0, 2.6), SPOTS.listener),
    "play-rig": standAt(at(consoleSite, 0, 0, 1.4), SPOTS.rig),
    "play-flag": standAt(SPOTS.flag.clone().lerp(SPOTS.landing, 0.25), SPOTS.flag),
    wide: orbit(-8, -6, 3.1),
    "orbit-earth": {
      player: { dir: spawnDir, forward: spawnForward },
      camera: { position: at(consoleSite, 1.6, 2.4, 5.2), target: at(rigSite, 0, 1.2, 0).lerp(earthPos, 0.08), up: SPOTS.console.clone() },
    },
  };

  let pixelHeight = 900;
  const world: World = {
    id: "tranquility",
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
    sunHeight: 0.2,
    sunToward: new Vector3(1, 0.15, 0.3),
    dustColor: "#B9B4AC",
    fog: null,
    spawn: { dir: spawnDir, forward: spawnForward },
    entries: { lamp: { dir: spawnDir, forward: spawnForward } },
    intro: null,
    setPower() {},
    anchor(id: string) {
      switch (id) {
        case "descent":
          return at(landerSite, 0, 1.8, 0);
        case "seismometer":
          return at(listenerSite, 0, 1.1, 0);
        case "lrrr":
          return at(mirrorsSite, 0, 0.9, 0);
        case "tag":
          return at(tagSite, 0, 1.2, 0);
        case "earth":
          return earthPos.clone();
        case "console":
          return at(consoleSite, 0, 1.0, 0);
        case "rig":
          return at(rigSite, 0, 1.8, 0);
        default:
          return null;
      }
    },
    bookmarks,
    surfaceAt(_dir, onPlatform) {
      return onPlatform ? "metal" : "regolith";
    },
    cameraHint() {
      return null;
    },
    objective() {
      return runtime.objective(() => activity.objective());
    },
    map: {
      title: "Tranquility Base",
      radius: MOON_RADIUS,
      center: SPOTS.lander,
      colors: { land: "#BDB8B0", shade: "#8E8A84", ink: "#24222A", path: "#A29E97" },
      marks: [
        { id: "lamp", label: "Looking Lamp", at: SPOTS.landing, icon: "lamp" },
        { id: "tag", label: "Dad's tag", at: SPOTS.tag, icon: "tag" },
        { id: "lander", label: "The lander", at: SPOTS.lander, icon: "lander", letters: ["a11-letter-descent"] },
        { id: "flag", label: "The flag", at: SPOTS.flag, icon: "flag" },
        { id: "camera", label: "TV camera", at: SPOTS.camera, icon: "camera" },
        { id: "listener", label: "Moonquake listener", at: SPOTS.listener, icon: "listener", letters: ["a11-letter-seismometer"] },
        { id: "mirrors", label: "Little mirrors", at: SPOTS.mirrors, icon: "mirrors", letters: ["a11-letter-mirrors"] },
        { id: "rig", label: "Dad's mirror corner", at: SPOTS.rig, icon: "corner" },
        { id: "console", label: "Earth console", at: SPOTS.console, icon: "console" },
        { id: "little-west", label: "Little West crater", at: SPOTS.littleWest, icon: "crater" },
      ],
      craters: (spec.craters ?? []).map((c) => ({ at: c.center, radius: c.radius })),
      paths: trails.map(([a, b]) => arcPoints(a, b, 12)),
    },
    sounds: [],
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
      activity.resize(pixelHeight);
    },
    debug: {
      ...runtime.debug,
      solve: () => {
        activity.solve();
        return true;
      },
      fire: () => activity.fire(),
      beam: () => activity.debugBeam(),
      arrive: () => {
        store.update((s) => {
          if (!s.flags.includes("chapter-1:arrived")) s.flags.push("chapter-1:arrived");
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
        if (o instanceof Mesh && o.name.startsWith("batch")) o.geometry.dispose();
      });
      ctx.interactions.clear();
      void bus;
    },
  };
  void surfaceMatrix;
  return world;
}
