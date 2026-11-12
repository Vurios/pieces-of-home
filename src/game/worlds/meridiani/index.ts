import { BufferAttribute, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight, Mesh, Points, type ShaderMaterial, Vector3 } from "three";
import { box, cylinder, sphere, torus } from "../../actors/parts";
import { createMaterial } from "../../render/particles";
import type { LookSpec } from "../../render/post";
import type { SkySpec } from "../../render/sky";
import { Batcher, SECTORS, planetMeshes } from "../../render/kit";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { createRandom, fbm3 } from "../../world/noise";
import { angleBetween, headingToTangent, latLonToDir } from "../../world/sphere";
import { type Crater, Terrain, type TerrainSpec, buildPlanetGeometry } from "../../world/terrain";
import { MERIDIANI } from "../../../content/chapters/meridiani";
import { WaitForTheWind } from "../../puzzles/wait-for-wind";
import { distanceToArc } from "../shapes";
import type { Bookmark, FrameInfo, SoundSpot, World, WorldContext } from "../types";
import { LampBeam, type Site, arcPoints, at, buildTag, chapterRuntime, headingToward, siteOn } from "../kit/little-world";
import { rock } from "../tranquility/machines";
import { bounceMark, buildFlagRack, buildLander, buildOutcrop, buildRover } from "./machines";

/**
 * Chapter 3: Meridiani Planum, Dad's model of Opportunity's plains on Mars.
 *
 * Flat butterscotch plains with ripples of dark sand. The lander still sits in
 * little Eagle crater, where the airbags bounced and rolled it in (the trail
 * of round dents leads there). The rover's wheel tracks lead out of the
 * crater to where it sleeps beside a striped outcrop, its panels red with
 * dust. Dad's breeze flags lean on a rock nearby. Dust devils wander past.
 *
 * After the rover wakes, the long storm comes (a story cue): the sky goes
 * dark brown, the sun fades, the music thins and falls silent. Then it
 * clears, and the rover stays asleep.
 */
export const MARS_RADIUS = 14;

const d = (lat: number, lon: number): Vector3 => latLonToDir(lat, lon);
const SPOTS = {
  landing: d(10, 25),
  tag: d(5, 31),
  parcel: d(8, 34),
  rover: d(-4, 2),
  outcrop: d(-8, -12),
  rack: d(6, 8),
  crater: d(-20, 50),
};
/** The airbag bounces, biggest first, rolling into the crater. */
const BOUNCES: [number, number, number][] = [
  [8, 90, 0.8],
  [3, 80, 0.68],
  [-3, 71, 0.56],
  [-8, 64, 0.46],
  [-12, 60, 0.38],
];
const CRATER_RADIUS = 3.3;

function terrainSpec(): TerrainSpec {
  const random = createRandom(43);
  const craters: Crater[] = [{ center: SPOTS.crater, radius: CRATER_RADIUS, depth: 0.6, rim: 0.13 }];
  const keep = [...Object.values(SPOTS), ...BOUNCES.map(([a, b]) => d(a, b))];
  let tries = 0;
  while (craters.length < 12 && tries < 300) {
    tries += 1;
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    const radius = 0.9 + random() * 2.2;
    const near = Math.min(...keep.map((k) => angleBetween(dir, k) * MARS_RADIUS));
    if (near < radius + 5) continue;
    if (craters.some((c) => angleBetween(dir, c.center) * MARS_RADIUS < c.radius + radius + 1)) continue;
    // Meridiani's craters are old and soft: shallow bowls, low rims.
    craters.push({ center: dir, radius, depth: radius * 0.14, rim: radius * 0.06 });
  }
  return {
    radius: MARS_RADIUS,
    seed: 29,
    noiseAmplitude: 0.14,
    noiseFrequency: 2.1,
    pads: [
      { center: SPOTS.rover, radius: 1.6, blend: 1.2 },
      { center: SPOTS.outcrop, radius: 1.3, blend: 1 },
      { center: SPOTS.landing, radius: 1.4, blend: 1 },
      { center: SPOTS.rack, radius: 0.7, blend: 0.8 },
      // The lander rests on the crater floor.
      { center: SPOTS.crater, radius: 1.2, blend: 1.2, lift: -0.56 },
    ],
    craters,
  };
}

const SAND_A = new Color("#C9875A");
const SAND_B = new Color("#B26D45");
const SAND_LIGHT = new Color("#DDA676");
const SAND_DARK = new Color("#8E5236");
const RIPPLE = new Color("#7A4A3A");
const TRACK = new Color("#9A5A3A");

/** The plain sky and grade, and the same in the depth of the storm. Real Mars: butterscotch by day, a blue glow round the sun. */
const SKY: SkySpec = {
  zenith: "#C08A60",
  horizon: "#EEC79E",
  // Below the little world's horizon: a pale dusty haze, so the backdrop never goes muddy.
  ground: "#DDAA80",
  glow: "#B7CDE0",
  glowDirection: new Vector3(1, 0.3, 0.2),
  glowStrength: 0.32,
  clouds: 0.25,
  cloudColor: "#E2B088",
  stars: 0,
};
const STORM_SKY = { zenith: "#4A3024", horizon: "#7A5038", ground: "#5E3E2C", glow: "#8E6A4E", glowStrength: 0.06, clouds: 0.85, cloudColor: "#6E4A34" };
const LOOK: LookSpec = {
  grade: { shadows: "#5A3048", highlights: "#FFD9A8", shadowAmount: 0.3, highlightAmount: 0.18, saturation: 1.02, contrast: 1.05, lift: 0.05 },
  ink: "#2E1E1A",
  inkStrength: 0.85,
  inkWidth: 1.2,
  inkFade: [22, 52],
  grain: 0.06,
  vignette: 0.6,
  lamp: "#F2A541",
};
const STORM_LOOK = { shadows: "#3A2420", highlights: "#C99A70", saturation: 0.72, contrast: 0.94, lift: 0.08, vignette: 0.86, grain: 0.1 };
const FOG = { color: "#E0AE82", near: -2, far: 24 };
const STORM_FOG = { color: "#6E4A34", near: -9, far: 3 };

const mix = (a: string, b: string, t: number): string => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;

/** Storm dust: soft dots blowing past the player, only while the storm is up. */
class StormDust {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private offsets: Float32Array;
  private positions: Float32Array;
  private alphas: Float32Array;
  private time = 0;

  constructor(private count: number) {
    const random = createRandom(61);
    this.offsets = new Float32Array(count * 3);
    this.positions = new Float32Array(count * 3);
    this.alphas = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.offsets[i * 3] = random();
      this.offsets[i * 3 + 1] = random();
      this.offsets[i * 3 + 2] = random();
      sizes[i] = 0.12 + random() * 0.3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial("#A8714C", false, 0.4));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  update(dt: number, center: Vector3, up: Vector3, wind: Vector3, strength: number, reducedMotion: boolean): void {
    this.points.visible = strength > 0.01;
    if (!this.points.visible) return;
    this.time += reducedMotion ? dt * 0.1 : dt;
    const side = new Vector3().crossVectors(up, wind).normalize();
    const size = 16;
    for (let i = 0; i < this.count; i += 1) {
      // A box round the player; each dot blows along the wind and wraps round.
      const u = ((this.offsets[i * 3]! + this.time * (0.05 + this.offsets[i * 3 + 2]! * 0.04)) % 1) - 0.5;
      const v = this.offsets[i * 3 + 1]! - 0.5;
      const h = (this.offsets[i * 3 + 2]! * 4.5 + Math.sin(this.time * 1.3 + i) * 0.15) % 4.5;
      this.positions[i * 3] = center.x + wind.x * u * size + side.x * v * size + up.x * h;
      this.positions[i * 3 + 1] = center.y + wind.y * u * size + side.y * v * size + up.y * h;
      this.positions[i * 3 + 2] = center.z + wind.z * u * size + side.z * v * size + up.z * h;
      const edge = Math.min(1, (0.5 - Math.abs(u)) * 6);
      this.alphas[i] = strength * 0.55 * edge;
    }
    this.points.geometry.attributes["position"]!.needsUpdate = true;
    this.points.geometry.attributes["aAlpha"]!.needsUpdate = true;
  }

  resize(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

export function createMeridiani(ctx: WorldContext): World {
  const { toon, quality, store, bus } = ctx;
  const root = new Group();
  root.name = "world-meridiani";
  const spec = terrainSpec();
  const terrain = new Terrain(spec);
  const site = (dir: Vector3, heading: number, sink = 0.03): Site => {
    const lat = (Math.asin(dir.y) * 180) / Math.PI;
    const lon = (Math.atan2(dir.x, dir.z) * 180) / Math.PI;
    return siteOn(terrain, lat, lon, heading, sink);
  };
  const face = (from: Vector3, to: Vector3): number => headingToward(from, to);

  // The rover's wheel tracks, out of the crater and over to where it sleeps.
  const trackFrom = SPOTS.crater.clone().lerp(SPOTS.rover, 0.12).normalize();
  const trackTo = SPOTS.rover.clone().lerp(SPOTS.crater, 0.04).normalize();
  const trackDistance = (dir: Vector3): number => distanceToArc(dir, trackFrom, trackTo) * MARS_RADIUS;
  const bounceDirs = BOUNCES.map(([a, b]) => d(a, b));
  const ripples = d(30, 70);

  // ---- The ground: butterscotch sand, dark ripples, soft craters ----
  const geometry = buildPlanetGeometry(terrain, Math.round(quality.terrainDetail * 0.85), (dir, _r, normal, out) => {
    const n = fbm3(dir.x * 3.4, dir.y * 3.4, dir.z * 3.4, 3, 12);
    const fine = fbm3(dir.x * 21, dir.y * 21, dir.z * 21, 3, 5);
    const grit = fbm3(dir.x * 57, dir.y * 57, dir.z * 57, 2, 14);
    out.copy(SAND_A).lerp(SAND_B, Math.max(0, Math.min(1, 0.5 + n * 1.3)));
    if (fine > 0.2) out.lerp(SAND_LIGHT, Math.min(0.4, (fine - 0.2) * 2));
    // Ripples of dark sand, full of little "blueberries", in long soft rows.
    const wave = Math.sin(dir.dot(ripples) * 150 + n * 9);
    const patch = Math.max(0, n + 0.15);
    if (wave > 0.55) out.lerp(RIPPLE, Math.min(0.45, (wave - 0.55) * 1.6) * Math.min(1, patch * 3));
    out.multiplyScalar(1 + grit * 0.1);
    for (const c of spec.craters ?? []) {
      const t = (angleBetween(dir, c.center) * MARS_RADIUS) / c.radius;
      if (t < 1) out.lerp(SAND_DARK, 0.3 * (1 - t));
      else if (t < 1.8) out.lerp(SAND_LIGHT, 0.3 * (1 - (t - 1) / 0.8));
    }
    // The wheels pressed the sand darker.
    const track = trackDistance(dir);
    if (track > 0.48 && track < 0.78) out.lerp(TRACK, 0.55);
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.28, slope * 2.4));
  });
  // The ground is cut into wedges so the far side of the world is skipped when it is out of sight.
  for (const wedge of planetMeshes(geometry, toon.toon({ vertexColors: true, paint: 0.15, rim: 0.12, nearFade: false }))) root.add(wedge);

  // ---- The machines ----
  const b = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];
  const add = (s: Site, shapes: ReturnType<typeof buildTag>, camera = false): void => {
    const g = createColliderGroup(s.matrix, shapes);
    colliders.push(g);
    if (camera) cameraColliders.push(g);
  };
  const roverSite = site(SPOTS.rover, face(SPOTS.rover, SPOTS.outcrop) + 12, 0.0);
  const rover = buildRover(b, roverSite, toon);
  add(roverSite, rover.shapes, true);
  root.add(rover.root);
  const outcropSite = site(SPOTS.outcrop, face(SPOTS.outcrop, SPOTS.rover), 0.06);
  add(outcropSite, buildOutcrop(b, outcropSite, 2.4));
  const landerSite = site(SPOTS.crater, face(SPOTS.crater, SPOTS.rover), 0.0);
  add(landerSite, buildLander(b, landerSite));
  const rackSite = site(SPOTS.rack, face(SPOTS.rack, SPOTS.rover) + 160);
  add(rackSite, buildFlagRack(b, rackSite));

  // The bounce marks, each a dent smaller than the last, rolling down into the crater.
  bounceDirs.forEach((dir, i) => {
    const s = site(dir, face(dir, SPOTS.crater), 0);
    bounceMark(b, s.matrix, BOUNCES[i]![2]);
  });
  const bounceSite = site(bounceDirs[bounceDirs.length - 1]!, face(bounceDirs[bounceDirs.length - 1]!, SPOTS.crater), 0);

  // Wheel tracks: two dark lines with cleat marks, out of the crater to the rover.
  // The wheel tracks are painted into the sand (see the ground colors above).

  // Dad's tag and the Looking Lamp's landing circle.
  const tagSite = site(SPOTS.tag, face(SPOTS.tag, SPOTS.landing));
  add(tagSite, buildTag(b, tagSite));
  const landingSite = site(SPOTS.landing, face(SPOTS.landing, SPOTS.rover));
  const lamp = new LampBeam(landingSite, toon, b);
  root.add(lamp.root);

  // Rocks: few on Meridiani's flat plains. Tiny dark "blueberries" everywhere.
  const random = createRandom(9);
  const clear = [...Object.values(SPOTS), ...bounceDirs];
  for (let i = 0; i < Math.round(46 * Math.max(0.5, quality.particles)); i += 1) {
    const dir = d(random() * 170 - 85, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * MARS_RADIUS < 2.4) || trackDistance(dir) < 1.2) continue;
    const size = 0.07 + random() ** 3 * 0.45;
    const s = site(dir, random() * 360, size * 0.15);
    rock(b, s.matrix, size, random() * 6, random() < 0.5 ? "#8E5A40" : "#7A4A36");
    if (size > 0.3) colliders.push(createColliderGroup(s.matrix, [{ kind: "circle", x: 0, z: 0, radius: size * 0.8, height: size }]));
  }
  for (let i = 0; i < Math.round(420 * Math.max(0.4, quality.particles)); i += 1) {
    const dir = d(random() * 176 - 88, random() * 360 - 180);
    if (clear.some((k) => angleBetween(dir, k) * MARS_RADIUS < 1.1)) continue;
    const s = site(dir, 0, 0);
    b.place(sphere("tiny"), random() < 0.6 ? "#4A3A3E" : "#5A4440", [0, 0.015, 0], [0, 0, 0], 0.022 + random() * 0.018, s.matrix);
  }
  // Little soft craters, as drawn: a pale rim and a darker bowl.
  const craterRandom = createRandom(88);
  for (let i = 0; i < 70; i += 1) {
    const dir = d(craterRandom() * 176 - 88, craterRandom() * 360 - 180);
    const r = 0.18 + craterRandom() ** 2 * 0.55;
    if (clear.some((k) => angleBetween(dir, k) * MARS_RADIUS < 1.6 + r) || trackDistance(dir) < 0.9 + r) continue;
    const s = site(dir, craterRandom() * 360, 0);
    const lift = (r * r) / (2 * MARS_RADIUS) + 0.012;
    b.place(torus(0.22), craterRandom() < 0.5 ? "#D49C6E" : "#C98F62", [0, lift + 0.008, 0], [Math.PI / 2, 0, 0], [r, r, 0.3 * r + 0.03], s.matrix);
    b.place(cylinder(18), "#A2633F", [0, lift, 0], [0, 0, 0], [r * 0.9, 0.012, r * 0.9], s.matrix);
  }

  // ---- Wait for the Wind: the breeze flags and the dust devils' lane ----
  const north = headingToTangent(SPOTS.rover, 0);
  const east = headingToTangent(SPOTS.rover, 90);
  const lane = { along: east.clone().negate(), across: north.clone().negate() };
  const devilSounds: [SoundSpot, SoundSpot] = [
    { position: { x: 0, y: 0, z: 0 }, loop: "dust-devil", value: 0, live: true },
    { position: { x: 0, y: 0, z: 0 }, loop: "dust-devil", value: 0, live: true },
  ];
  const sweepView = {
    position: at(roverSite, 3.4, 2.6, 3.2),
    target: at(roverSite, 0, 0.7, 0),
  };
  const activity = new WaitForTheWind({ ctx, root, terrain, rover, roverSite, rack: rackSite, lane, sounds: devilSounds, view: sweepView });
  add(rackSite, activity.shapes.rack);

  const materials = { solid: toon.toon({ vertexColors: true, paint: 0.12 }), glow: toon.glow("#ffffff", true) };
  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true, sectors: SECTORS })) root.add(mesh);

  // ---- The chapter ----
  const runtime = chapterRuntime(ctx, MERIDIANI, {
    targets: {
      bounce: at(bounceSite, 0, 0, 0),
      grinder: rover.arm,
      panels: rover.panels,
    },
    home: at(landingSite, 0, 0, 0),
    tag: at(tagSite, 0, 0, 0.5),
    parcel: site(SPOTS.parcel, face(SPOTS.parcel, SPOTS.landing)),
  });
  for (const o of runtime.objects) root.add(o);

  // ---- Light: a warm, hazy sun and a dusty orange fill ----
  const SUN = 2.35;
  const FILL = 1.05;
  const sun = new DirectionalLight("#FFE6C8", SUN);
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
  const fill = new HemisphereLight("#E2A878", "#5A3324", FILL);
  root.add(fill);

  // ---- The long storm ----
  let storm = 0;
  let stormTarget = 0;
  let skyAt = -1;
  let lookAt = 0;
  const fog = { ...FOG };
  const dust = new StormDust(Math.round(260 * Math.max(0.4, quality.particles)));
  root.add(dust.points);
  const offs = [
    bus.on("story:cue", ({ id }) => {
      if (id === "storm") {
        stormTarget = 1;
        activity.storm(true);
      } else if (id === "clear") stormTarget = 0;
    }),
  ];

  // ---- Views ----
  const spawnDir = at(landingSite, 0.2, 0, 1.4).normalize();
  const spawnForward = headingToTangent(spawnDir, face(spawnDir, SPOTS.rover));
  const standAt = (dir: Vector3, look: Vector3): Bookmark => ({ player: { dir: dir.clone().normalize(), forward: headingToTangent(dir.clone().normalize(), face(dir, look)) }, camera: null });
  const orbit = (lat: number, lon: number, distance = 3.2): Bookmark => ({
    player: { dir: spawnDir, forward: spawnForward },
    camera: { position: latLonToDir(lat, lon).multiplyScalar(MARS_RADIUS * distance), target: new Vector3(), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    arrive: { player: { dir: spawnDir, forward: spawnForward }, camera: null },
    "play-rover": standAt(rover.panels.clone().lerp(at(rackSite, 0, 0, 0), 0.5), SPOTS.rover),
    "play-grinder": standAt(rover.arm.clone().lerp(at(roverSite, 0, 0, 0), -0.4), SPOTS.outcrop),
    "play-crater": standAt(at(bounceSite, 0, 0, -1.2), SPOTS.crater),
    "play-flags": standAt(at(rackSite, 0, 0, 1.6), SPOTS.rover),
    sweep: { player: { dir: rover.panels.clone().normalize(), forward: spawnForward }, camera: { position: sweepView.position, target: sweepView.target, up: SPOTS.rover.clone() } },
    wide: orbit(-2, 20, 3.0),
  };

  let pixelHeight = 900;
  const world: World = {
    id: "meridiani",
    root,
    terrain,
    colliders,
    cameraColliders,
    sky: SKY,
    look: LOOK,
    sun,
    fill,
    sunHeight: 0.38,
    sunToward: new Vector3(1, 0.3, 0.2),
    dustColor: "#C98A5C",
    fog,
    spawn: { dir: spawnDir, forward: spawnForward },
    entries: { lamp: { dir: spawnDir, forward: spawnForward } },
    intro: null,
    setPower() {},
    liveSky() {
      if (Math.abs(storm - skyAt) < 0.004) return null;
      skyAt = storm;
      const s = storm;
      return {
        ...SKY,
        zenith: mix(SKY.zenith as string, STORM_SKY.zenith, s),
        horizon: mix(SKY.horizon as string, STORM_SKY.horizon, s),
        ground: mix(SKY.ground as string, STORM_SKY.ground, s),
        glow: mix(SKY.glow as string, STORM_SKY.glow, s),
        glowStrength: SKY.glowStrength + (STORM_SKY.glowStrength - SKY.glowStrength) * s,
        clouds: SKY.clouds + (STORM_SKY.clouds - SKY.clouds) * s,
        cloudColor: mix(SKY.cloudColor as string, STORM_SKY.cloudColor, s),
      };
    },
    liveLook() {
      // A new grade costs a lookup table, so only when the storm has moved on enough.
      if (Math.abs(storm - lookAt) < 0.06 && !(storm === stormTarget && storm !== lookAt)) return null;
      lookAt = storm;
      const s = storm;
      const g = LOOK.grade;
      return {
        ...LOOK,
        grade: {
          ...g,
          shadows: mix(g.shadows as string, STORM_LOOK.shadows, s),
          highlights: mix(g.highlights as string, STORM_LOOK.highlights, s),
          saturation: g.saturation + (STORM_LOOK.saturation - g.saturation) * s,
          contrast: g.contrast + (STORM_LOOK.contrast - g.contrast) * s,
          lift: g.lift + (STORM_LOOK.lift - g.lift) * s,
        },
        vignette: LOOK.vignette + (STORM_LOOK.vignette - LOOK.vignette) * s,
        grain: LOOK.grain + (STORM_LOOK.grain - LOOK.grain) * s,
      };
    },
    anchor(id: string) {
      switch (id) {
        case "bounce":
          return at(bounceSite, 0, 1.0, 0);
        case "grinder":
          return rover.arm.clone().addScaledVector(roverSite.dir, 1.2);
        case "panels":
        case "rover":
          return rover.center.clone().addScaledVector(roverSite.dir, 0.9);
        case "tag":
          return at(tagSite, 0, 1.2, 0);
        case "crater":
          return at(landerSite, 0, 1.2, 0);
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
      title: "Meridiani Planum",
      radius: MARS_RADIUS,
      center: SPOTS.landing,
      colors: { land: "#D79A6C", shade: "#B4744C", ink: "#3A2418", path: "#BF7E54" },
      marks: [
        { id: "lamp", label: "Looking Lamp", at: SPOTS.landing, icon: "lamp" },
        { id: "tag", label: "Dad's tag", at: SPOTS.tag, icon: "tag" },
        { id: "rover", label: "The rover", at: SPOTS.rover, icon: "rover", letters: ["opp-letter-grinder", "opp-letter-panels"] },
        { id: "outcrop", label: "Striped rocks", at: SPOTS.outcrop, icon: "rocks" },
        { id: "flags", label: "Breeze flags", at: SPOTS.rack, icon: "pennant" },
        { id: "crater", label: "Eagle crater", at: SPOTS.crater, icon: "lander" },
        { id: "bounce", label: "Bounce marks", at: bounceDirs[bounceDirs.length - 1]!, icon: "bounce", letters: ["opp-letter-bounce"] },
      ],
      craters: (spec.craters ?? []).map((c) => ({ at: c.center, radius: c.radius })),
      paths: [arcPoints(trackFrom, trackTo, 24), bounceDirs],
    },
    sounds: devilSounds,
    ambience() {
      // Made wind and dust hiss, under the real wind Perseverance recorded on Mars.
      return { wind: 0.55 + storm * 0.45, dust: 0.3 + storm * 0.7, "mars-wind": 0.5 + storm * 0.5 };
    },
    update(dt: number, frame: FrameInfo) {
      activity.follow(frame.player.position);
      runtime.update(dt, frame.time);
      activity.update(dt, frame.reducedMotion);
      lamp.update(frame.time, frame.reducedMotion);
      // The storm rolls in slowly and clears a little faster.
      const rate = stormTarget > storm ? 0.16 : 0.22;
      storm += Math.sign(stormTarget - storm) * Math.min(Math.abs(stormTarget - storm), dt * rate);
      sun.intensity = SUN * (1 - 0.78 * storm);
      fill.intensity = FILL * (1 - 0.35 * storm);
      fog.color = mix(FOG.color, STORM_FOG.color, storm);
      fog.near = FOG.near + (STORM_FOG.near - FOG.near) * storm;
      fog.far = FOG.far + (STORM_FOG.far - FOG.far) * storm;
      const up = frame.player.up;
      const wind = headingToTangent(up, 250);
      dust.update(dt, frame.player.position, up, wind, storm, frame.reducedMotion);
    },
    resize(height: number) {
      pixelHeight = height;
      activity.resize(pixelHeight);
      dust.resize(pixelHeight);
    },
    debug: {
      ...runtime.debug,
      solve: () => {
        activity.solve();
        return true;
      },
      state: () => activity.debugState(),
      devil: () => {
        activity.devilNow();
        return true;
      },
      guide: () => activity.debugGuide(),
      storm: () => {
        stormTarget = 1;
        storm = 1;
        activity.storm(true);
        return true;
      },
      clear: () => {
        stormTarget = 0;
        storm = 0;
        return true;
      },
      arrive: () => {
        store.update((s) => {
          if (!s.flags.includes("chapter-3:arrived")) s.flags.push("chapter-3:arrived");
        });
        return true;
      },
    },
    dispose() {
      for (const off of offs) off();
      activity.dispose();
      lamp.dispose();
      dust.dispose();
      geometry.dispose();
      root.traverse((o) => {
        if (o instanceof Mesh && (o.name.startsWith("batch") || o.name === "planet")) o.geometry.dispose();
      });
      ctx.interactions.clear();
    },
  };
  return world;
}
