import { Color, DirectionalLight, Group, HemisphereLight, Matrix4, Mesh, Vector3 } from "three";
import { createPartsBag } from "../../actors/props";
import { cylinder, torus } from "../../actors/parts";
import { Batcher, SECTORS, planetMeshes } from "../../render/kit";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { createRandom, fbm3 } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import { type Bump, type Crater, Terrain, type TerrainSpec, buildPlanetGeometry } from "../../world/terrain";
import { STORMS } from "../../../content/chapters/storms";
import { Pinpoint } from "../../puzzles/pinpoint";
import { distanceToArc } from "../shapes";
import type { Bookmark, FrameInfo, World, WorldContext } from "../types";
import { PaintedEarth } from "../kit/earth";
import { LampBeam, type Site, arcPoints, at, buildTag, chapterRuntime, headingToward, siteOn } from "../kit/little-world";
import { buildDescentStage, buildFlag, buildFootprints, rock } from "../tranquility/machines";
import { buildLandingTable, buildPadMarks, buildSampleBox, buildSurveyor, buildTrench, createToyLander } from "./machines";

/**
 * Bonus chapter: the Ocean of Storms, Dad's model of the Apollo 12 site.
 *
 * Surveyor 3 stands on the inner slope of its crater (the Snowman's body),
 * with its four scoop trenches in front of it and the dents where it bounced
 * on landing just up the slope. Intrepid's bottom half sits up on the rim,
 * where the crew landed close enough to walk down and visit. A smaller crater
 * makes the Snowman's head. Dad added his landing table near the Looking Lamp
 * and a sample box by Intrepid's ladder for the activity.
 */
export const STORMS_RADIUS = 13;

const d = (lat: number, lon: number): Vector3 => latLonToDir(lat, lon);
const SPOTS = {
  crater: d(0, 0),
  surveyor: d(-1.5, 7.6),
  head: d(24, 12),
  intrepid: d(18, -19),
  flag: d(27, -25),
  landing: d(6, -42),
  tag: d(-1.5, -37),
  parcel: d(-4, -39.5),
  table: d(-13, -27),
  bounceA: d(-2.6, 11.4),
  bounceB: d(-3.6, 15.2),
};
const CRATER = { radius: 3.7, depth: 1.12, rim: 0.32 };
const HEAD = { radius: 2.0, depth: 0.7, rim: 0.24 };

function terrainSpec(): TerrainSpec {
  const random = createRandom(41);
  const craters: Crater[] = [
    { center: SPOTS.crater, ...CRATER },
    { center: SPOTS.head, ...HEAD },
  ];
  const keepClear = Object.values(SPOTS);
  let tries = 0;
  while (craters.length < 24 && tries < 400) {
    tries += 1;
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    const big = craters.length < 8;
    const radius = big ? 2.0 + random() * 1.6 : 0.45 + random() * 1.0;
    const near = Math.min(...keepClear.map((k) => angleBetween(dir, k) * STORMS_RADIUS));
    if (near < radius + (big ? 6.5 : 2)) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * STORMS_RADIUS < c.radius + radius + 0.6)) continue;
    craters.push({ center: dir, radius, depth: radius * (big ? 0.22 : 0.2), rim: radius * 0.1 });
  }
  const bumps: Bump[] = [];
  tries = 0;
  while (bumps.length < 7 && tries < 300) {
    tries += 1;
    const dir = d(random() * 150 - 75, random() * 360 - 180);
    const radius = 3 + random() * 1.8;
    if (Math.min(...keepClear.map((k) => angleBetween(dir, k) * STORMS_RADIUS)) < radius + 5.5) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * STORMS_RADIUS < c.radius + radius)) continue;
    if (bumps.some((m) => angleBetween(dir, m.center) * STORMS_RADIUS < m.radius + radius)) continue;
    bumps.push({ center: dir, radius, height: 0.35 + random() * 0.35 });
  }
  return {
    radius: STORMS_RADIUS,
    bumps,
    seed: 23,
    noiseAmplitude: 0.14,
    noiseFrequency: 2.4,
    pads: [
      { center: SPOTS.intrepid, radius: 2.1, blend: 1.4 },
      { center: SPOTS.landing, radius: 1.4, blend: 1 },
      { center: SPOTS.table, radius: 1.1, blend: 0.9 },
    ],
    craters,
  };
}

const DUST_A = new Color("#A6A29A");
const DUST_B = new Color("#8A8780");
const DUST_LIGHT = new Color("#C2BDB4");
const DUST_DARK = new Color("#6E6B66");
const TRACK = new Color("#78756F");

export function createStorms(ctx: WorldContext): World {
  const { toon, quality, store, bus } = ctx;
  const root = new Group();
  root.name = "world-storms";
  const spec = terrainSpec();
  const terrain = new Terrain(spec);
  const ll = (dir: Vector3): [number, number] => [(Math.asin(dir.y) * 180) / Math.PI, (Math.atan2(dir.x, dir.z) * 180) / Math.PI];
  const site = (dir: Vector3, heading: number, sink = 0.03): Site => siteOn(terrain, ...ll(dir), heading, sink);
  const face = (from: Vector3, to: Vector3): number => headingToward(from, to);
  /** A site leaning with the ground under it, for things standing on a slope. */
  const slopeSite = (dir: Vector3, heading: number, sink = 0.03): Site => {
    const flat = site(dir, heading, sink);
    const east = new Vector3().crossVectors(flat.forward, flat.dir).normalize();
    const sample = (v: Vector3): Vector3 => {
      const n = v.clone().normalize();
      return n.multiplyScalar(terrain.radiusAt(n));
    };
    const reach = 0.5 / STORMS_RADIUS;
    const a = sample(dir.clone().addScaledVector(flat.forward, reach));
    const b = sample(dir.clone().addScaledVector(flat.forward, -reach));
    const c = sample(dir.clone().addScaledVector(east, reach));
    const e = sample(dir.clone().addScaledVector(east, -reach));
    const up = new Vector3().crossVectors(c.sub(e), a.sub(b)).normalize();
    if (up.dot(flat.dir) < 0) up.negate();
    // Lean only part way, the way a lander's legs take up some of a slope.
    up.lerp(flat.dir, 0.25).normalize();
    const forward = flat.forward.clone().addScaledVector(up, -flat.forward.dot(up)).normalize();
    return { dir: up, forward, origin: flat.origin, matrix: surfaceMatrix(flat.origin, up, forward) };
  };

  // ---- Earth, low over the crater, beyond Surveyor when you look down from Intrepid ----
  const toward = headingToTangent(SPOTS.crater, face(SPOTS.intrepid, SPOTS.surveyor));
  const elevation = (14 * Math.PI) / 180;
  const earthDir = SPOTS.crater.clone().multiplyScalar(Math.sin(elevation)).addScaledVector(toward, Math.cos(elevation)).normalize();
  const EARTH_RADIUS = 6;
  const earth = new PaintedEarth(toon, SPOTS.crater.clone().multiplyScalar(STORMS_RADIUS).addScaledVector(earthDir, 94), EARTH_RADIUS);
  root.add(earth.root);

  // ---- The astronauts' footpaths: from Intrepid down to Surveyor, round the Snowman's head, and to the lamp ----
  const trails: [Vector3, Vector3][] = [
    [SPOTS.intrepid, SPOTS.surveyor],
    [SPOTS.intrepid, SPOTS.head],
    [SPOTS.intrepid, SPOTS.flag],
    [SPOTS.intrepid, SPOTS.landing],
    [SPOTS.landing, SPOTS.table],
  ];
  const trackDistance = (dir: Vector3): number => Math.min(...trails.map(([a, b]) => distanceToArc(dir, a, b) * STORMS_RADIUS));

  // ---- The ground ----
  const geometry = buildPlanetGeometry(terrain, Math.round(quality.terrainDetail * 0.85), (dir, _r, normal, out) => {
    const n = fbm3(dir.x * 4, dir.y * 4, dir.z * 4, 3, 9);
    const fine = fbm3(dir.x * 23, dir.y * 23, dir.z * 23, 3, 5);
    const grit = fbm3(dir.x * 61, dir.y * 61, dir.z * 61, 2, 12);
    out.copy(DUST_A).lerp(DUST_B, Math.max(0, Math.min(1, 0.5 + n * 1.2)));
    if (fine > 0.18) out.lerp(DUST_LIGHT, Math.min(0.45, (fine - 0.18) * 2.2));
    else if (fine < -0.22) out.lerp(DUST_DARK, Math.min(0.3, (-0.22 - fine) * 1.8));
    out.multiplyScalar(1 + grit * 0.12);
    for (const c of spec.craters ?? []) {
      const t = (angleBetween(dir, c.center) * STORMS_RADIUS) / c.radius;
      if (t < 1) out.lerp(DUST_DARK, 0.3 * (1 - t));
      else if (t < 2.2) out.lerp(DUST_LIGHT, 0.4 * (1 - (t - 1) / 1.2));
    }
    // Intrepid's engine blew the dust smooth and bright round it.
    const lander = angleBetween(dir, SPOTS.intrepid) * STORMS_RADIUS;
    if (lander < 4.2) out.lerp(DUST_LIGHT, 0.3 * Math.min(1, (4.2 - lander) / 2));
    const track = trackDistance(dir);
    if (track < 0.45) out.lerp(TRACK, 0.6 * (1 - track / 0.45));
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.3, slope * 2.6));
  });
  for (const wedge of planetMeshes(geometry, toon.toon({ vertexColors: true, paint: 0.16, rim: 0.12, nearFade: false }))) root.add(wedge);

  // ---- The machines ----
  const b = new Batcher();
  const removable = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];
  const add = (s: Site, shapes: ReturnType<typeof buildFlag>, camera = false): void => {
    const g = createColliderGroup(s.matrix, shapes);
    colliders.push(g);
    if (camera) cameraColliders.push(g);
  };

  // Intrepid's bottom half up on the rim, its ladder toward Surveyor's crater.
  const intrepidSite = site(SPOTS.intrepid, face(SPOTS.intrepid, SPOTS.surveyor) - 45);
  add(intrepidSite, buildDescentStage(b, intrepidSite), true);
  const flagSite = site(SPOTS.flag, face(SPOTS.flag, SPOTS.landing) + 100);
  add(flagSite, buildFlag(b, flagSite));

  // Surveyor 3 on the slope, facing up the hill toward Intrepid.
  const surveyorSite = slopeSite(SPOTS.surveyor, face(SPOTS.surveyor, SPOTS.intrepid), 0.05);
  const surveyor = buildSurveyor(b, removable, surveyorSite);
  add(surveyorSite, surveyor.shapes, true);
  // Its four trenches, side by side under the reach of the scoop.
  const trenchAt = (x: number, z: number, length: number, seed: number): Site => {
    const p = at(surveyorSite, x, 0, z).normalize();
    const s = slopeSite(p, face(SPOTS.surveyor, SPOTS.intrepid) + (seed - 1.5) * 6, 0.0);
    buildTrench(b, s, length, seed);
    return s;
  };
  const trenches = [trenchAt(-0.42, 1.7, 0.62, 0), trenchAt(-0.14, 1.85, 0.8, 1), trenchAt(0.16, 1.8, 0.7, 2), trenchAt(0.44, 1.66, 0.5, 3)];
  // Where it bounced before it settled: two sets of footpad dents up the slope.
  for (const spot of [SPOTS.bounceA, SPOTS.bounceB]) buildPadMarks(b, slopeSite(spot, face(SPOTS.surveyor, SPOTS.intrepid) + 20, 0));

  // Dad's tag and the Looking Lamp's landing circle.
  const tagSite = site(SPOTS.tag, face(SPOTS.tag, SPOTS.landing));
  add(tagSite, buildTag(b, tagSite));
  const landingSite = site(SPOTS.landing, face(SPOTS.landing, SPOTS.intrepid));
  const lamp = new LampBeam(landingSite, toon, b);
  root.add(lamp.root);

  // Dad's landing table, with its toy lander on a string.
  const tableSite = site(SPOTS.table, face(SPOTS.table, SPOTS.landing) + 180);
  add(tableSite, buildLandingTable(b, tableSite));
  const toyLander = createToyLander(toon);
  toyLander.scale.setScalar(1.3);
  toyLander.quaternion.setFromRotationMatrix(new Matrix4().extractRotation(tableSite.matrix));
  root.add(toyLander);

  // The sample box beside Intrepid's ladder.
  const ladder = new Vector3(Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4));
  const ladderSide = new Vector3(-ladder.z, 0, ladder.x);
  const boxLocal = ladder.clone().multiplyScalar(1.85).addScaledVector(ladderSide, 0.75);
  const boxDir = at(intrepidSite, boxLocal.x, 0, boxLocal.z).normalize();
  const boxSite = site(boxDir, face(boxDir, SPOTS.surveyor), 0.02);
  const sample = buildSampleBox(b, boxSite, toon);
  add(boxSite, sample.shapes);
  root.add(sample.lid);
  const packed = createPartsBag(toon);
  packed.scale.setScalar(0.9);
  packed.position.copy(at(boxSite, 0, 0.2, 0));
  packed.quaternion.setFromRotationMatrix(new Matrix4().extractRotation(boxSite.matrix));
  root.add(packed);

  // The parts bag waits at Surveyor's feet after the snip.
  const bagDir = at(surveyorSite, 0.75, 0, 0.75).normalize();
  const bagSite = site(bagDir, face(bagDir, SPOTS.intrepid), 0.0);
  const bag = createPartsBag(toon);
  bag.scale.setScalar(1.25);
  bag.position.copy(bagSite.origin);
  bag.quaternion.setFromRotationMatrix(new Matrix4().extractRotation(bagSite.matrix));
  root.add(bag);

  // Boot prints along every footpath.
  const random = createRandom(9);
  for (const [a, c] of trails) {
    const length = angleBetween(a, c) * STORMS_RADIUS;
    const heading = face(a, c);
    buildFootprints(
      b,
      (t) => {
        if (t < 0.14 || t > 0.86) return null;
        const dir = a.clone().lerp(c, t).normalize();
        return siteOn(terrain, ...ll(dir), heading + (random() - 0.5) * 16, 0.0);
      },
      Math.round(length / 0.42),
    );
  }

  // Rocks, keeping the paths, the crater floor and the machines clear.
  const clear = Object.values(SPOTS);
  const inBowl = (dir: Vector3): boolean => angleBetween(dir, SPOTS.crater) * STORMS_RADIUS < CRATER.radius + 0.3;
  for (let i = 0; i < Math.round(80 * Math.max(0.5, quality.particles)); i += 1) {
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * STORMS_RADIUS < 2.2) || trackDistance(dir) < 0.8 || inBowl(dir)) continue;
    const size = 0.08 + random() ** 3 * 0.55;
    const s = siteOn(terrain, ...ll(dir), random() * 360, size * 0.15);
    rock(b, s.matrix, size, random() * 6);
    if (size > 0.3) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }
  // A few bigger blocks round the rim of the Snowman's head, as if thrown out when it formed.
  const blockRandom = createRandom(61);
  for (let i = 0; i < 9; i += 1) {
    const heading = (i / 9) * 360 + blockRandom() * 20;
    const reach = (HEAD.radius + 0.5 + blockRandom() * 1.2) / STORMS_RADIUS;
    const dir = SPOTS.head.clone().addScaledVector(headingToTangent(SPOTS.head, heading), reach).normalize();
    if (trackDistance(dir) < 0.9 || clear.some((k) => k !== SPOTS.head && angleBetween(dir, k) * STORMS_RADIUS < 2.2)) continue;
    const size = 0.22 + blockRandom() * 0.3;
    const s = siteOn(terrain, ...ll(dir), blockRandom() * 360, size * 0.12);
    rock(b, s.matrix, size, blockRandom() * 6, blockRandom() < 0.5 ? "#8A8680" : "#9A958D");
    if (size > 0.3) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }

  // Little inked craters everywhere, like Tranquility.
  const craterRandom = createRandom(88);
  for (let i = 0; i < 150; i += 1) {
    const dir = d(craterRandom() * 176 - 88, craterRandom() * 360 - 180);
    const r = 0.16 + craterRandom() ** 2 * 0.6;
    if (clear.some((k) => angleBetween(dir, k) * STORMS_RADIUS < 1.3 + r) || trackDistance(dir) < 0.4 + r || inBowl(dir)) continue;
    const s = siteOn(terrain, ...ll(dir), craterRandom() * 360, 0);
    const lift = (r * r) / (2 * STORMS_RADIUS) + 0.012;
    b.place(torus(0.24), craterRandom() < 0.5 ? "#B7B2AA" : "#ABA69E", [0, lift + 0.008, 0], [Math.PI / 2, 0, 0], [r, r, 0.32 * r + 0.035], s.matrix);
    b.place(cylinder(18), "#7E7A75", [0, lift, 0], [0, 0, 0], [r * 0.9, 0.012, r * 0.9], s.matrix);
  }

  const materials = { solid: toon.toon({ vertexColors: true, paint: 0.12 }), glow: toon.glow("#ffffff", true) };
  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true, sectors: SECTORS })) root.add(mesh);
  const parts = removable.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true });
  for (const mesh of parts) root.add(mesh);

  // ---- The activity ----
  const tableUp = tableSite.dir;
  const views = {
    // From behind Intrepid, looking down into the crater at Surveyor with Earth beyond.
    crater: { position: at(intrepidSite, -1.6, 3.2, -2.6), target: at(surveyorSite, 0, 0.8, 0) },
    // Close on Surveyor's camera and its mirror hood.
    camera: { position: at(surveyorSite, -1.2, 1.7, 1.5), target: at(surveyorSite, surveyor.camera.x, surveyor.camera.y - 0.2, surveyor.camera.z) },
  };
  const activity = new Pinpoint({
    ctx,
    table: at(tableSite, 0, 0, 1.05),
    toyLander,
    toyRest: at(tableSite, 0.08, 1.44, -0.4),
    toyLand: at(tableSite, 0.16, 0.86, 0.1),
    toyUp: tableUp,
    surveyor: at(surveyorSite, 0, 0, 2.15),
    parts,
    bag,
    bagSite,
    packed,
    box: at(boxSite, 0, 0, 0.75),
    lid: sample.lid,
    views,
  });

  // ---- The chapter: letters, Dad's tag, the parcel for Milo and the way home ----
  const stand = (s: Site, x: number, z: number): Vector3 => at(s, x, 0, z);
  const runtime = chapterRuntime(ctx, STORMS, {
    targets: {
      trenches: stand(trenches[1]!, 0, 0.9),
      intrepid: stand(intrepidSite, 0, 0).lerp(stand(surveyorSite, 0, 0), 0.22),
      surveyor: stand(surveyorSite, -0.4, 2.0),
    },
    home: stand(landingSite, 0, 0),
    tag: stand(tagSite, 0, 0.5),
    parcel: site(SPOTS.parcel, face(SPOTS.parcel, SPOTS.landing)),
  });
  for (const o of runtime.objects) root.add(o);

  // ---- Light: a low morning sun, so every crater rim throws a long shadow ----
  const sun = new DirectionalLight("#FFF2DE", 2.5);
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
  const spawnForward = headingToTangent(spawnDir, face(spawnDir, SPOTS.intrepid));
  const standAt = (dir: Vector3, look: Vector3): Bookmark => ({ player: { dir: dir.clone().normalize(), forward: headingToTangent(dir.clone().normalize(), face(dir, look)) }, camera: null });
  const orbit = (lat: number, lon: number, distance = 3.2): Bookmark => ({
    player: { dir: spawnDir, forward: spawnForward },
    camera: { position: latLonToDir(lat, lon).multiplyScalar(STORMS_RADIUS * distance), target: new Vector3(), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    arrive: { player: { dir: spawnDir, forward: spawnForward }, camera: null },
    "play-surveyor": standAt(at(surveyorSite, -0.5, 0, 2.2), SPOTS.surveyor),
    "play-intrepid": standAt(stand(intrepidSite, 0, 0).lerp(stand(surveyorSite, 0, 0), 0.4), SPOTS.intrepid),
    "play-table": standAt(at(tableSite, 0, 0, 1.4), SPOTS.table),
    "play-box": standAt(at(boxSite, 0, 0, 1.2), boxDir),
    wide: orbit(8, -6, 3.0),
    "orbit-crater": { player: { dir: spawnDir, forward: spawnForward }, camera: { position: views.crater.position, target: views.crater.target, up: SPOTS.intrepid.clone() } },
  };

  let pixelHeight = 900;
  const world: World = {
    id: "storms",
    suits: true,
    root,
    terrain,
    colliders,
    cameraColliders,
    sky: {
      zenith: "#05060D",
      horizon: "#171B2C",
      ground: "#0A0B12",
      glow: "#E8E2D4",
      glowDirection: new Vector3(-0.6, 0.12, 0.5),
      glowStrength: 0.18,
      clouds: 0,
      cloudColor: "#000000",
      stars: 1,
    },
    look: {
      grade: { shadows: "#1E2444", highlights: "#F2E6CF", shadowAmount: 0.32, highlightAmount: 0.14, saturation: 0.96, contrast: 1.08, lift: 0.05 },
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
    sunToward: new Vector3(-0.6, 0.15, 0.5),
    dustColor: "#BAB5AC",
    fog: null,
    spawn: { dir: spawnDir, forward: spawnForward },
    entries: { lamp: { dir: spawnDir, forward: spawnForward } },
    intro: null,
    setPower() {},
    anchor(id: string) {
      switch (id) {
        case "trenches":
          return at(trenches[1]!, 0, 0.5, 0);
        case "intrepid":
          return at(intrepidSite, 0, 1.8, 0);
        case "surveyor":
          return at(surveyorSite, 0, 2.1, 0);
        case "tag":
          return at(tagSite, 0, 1.2, 0);
        case "earth":
          return earth.root.position.clone();
        case "table":
          return at(tableSite, 0, 1.3, 0);
        case "box":
          return at(boxSite, 0, 0.8, 0);
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
      title: "Ocean of Storms",
      radius: STORMS_RADIUS,
      center: SPOTS.crater.clone().lerp(SPOTS.intrepid, 0.35).normalize(),
      colors: { land: "#BDB8B0", shade: "#8E8A84", ink: "#24222A", path: "#A29E97" },
      marks: [
        { id: "lamp", label: "Looking Lamp", at: SPOTS.landing, icon: "lamp" },
        { id: "tag", label: "Dad's tag", at: SPOTS.tag, icon: "tag" },
        { id: "intrepid", label: "Intrepid", at: SPOTS.intrepid, icon: "lander", letters: ["a12-letter-intrepid"] },
        { id: "surveyor", label: "Surveyor 3", at: SPOTS.surveyor, icon: "lander", letters: ["sur3-letter-surveyor"] },
        { id: "trenches", label: "Scoop trenches", at: trenches[1]!.dir, icon: "crater", letters: ["sur3-letter-trenches"] },
        { id: "crater", label: "Surveyor crater", at: SPOTS.crater, icon: "crater" },
        { id: "head", label: "The Snowman's head", at: SPOTS.head, icon: "crater" },
        { id: "table", label: "Dad's landing table", at: SPOTS.table, icon: "console" },
        { id: "box", label: "Sample box", at: boxDir, icon: "console" },
        { id: "flag", label: "The flag", at: SPOTS.flag, icon: "flag" },
      ],
      craters: (spec.craters ?? []).map((c) => ({ at: c.center, radius: c.radius })),
      paths: trails.map(([a, c]) => arcPoints(a, c, 12)),
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
      void pixelHeight;
    },
    debug: {
      ...runtime.debug,
      solve: () => {
        activity.solve();
        return true;
      },
      activity: () => activity.debugState(),
      arrive: () => {
        store.update((s) => {
          if (!s.flags.includes(`${STORMS.id}:arrived`)) s.flags.push(`${STORMS.id}:arrived`);
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
      void bus;
    },
  };
  return world;
}
