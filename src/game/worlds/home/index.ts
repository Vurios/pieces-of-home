import { Color, DirectionalLight, Group, HemisphereLight, Matrix4, Mesh, PointLight, Vector3 } from "three";
import { Character, type KidId } from "../../actors/character";
import { Milo } from "../../actors/milo";
import { Mom } from "../../actors/mom";
import { createEnvelope } from "../../actors/props";
import { Batcher } from "../../render/kit";
import { Floaters, Smoke } from "../../render/particles";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { fbm3 } from "../../world/noise";
import { angleBetween, damp, headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import { Terrain, buildPlanetGeometry } from "../../world/terrain";
import type { Bookmark, FrameInfo, MapIcon, World, WorldContext } from "../types";
import { PLACE_COPY, placeFlag } from "../../../content/places";
import { CHAPTERS, chapterForPart } from "../../../content/chapters";
import { STORY_COPY } from "../../../content/chapters/common";
import { torus } from "../../actors/parts";
import { C, buildDish, buildHouse, buildLampPost, buildMailbox } from "./buildings";
import { GROUND_PATCHES, type Site, HILL, HILL_TOP, HOME_RADIUS, MAILBOX, MEADOW, ORCHARD, PATH_HALF_WIDTH, PLACES, POND, POND_RADIUS, SITES, TERRAIN, TRAILS, TRAIL_LAMPS, local, site } from "./layout";
import { buildGarden, buildMeadow, groundMatrix, pathDistance, planTrees, scatterNature, treeShade } from "./nature";
import { buildPaths } from "./paths";
import { buildPlaces } from "./places";
import { SHED, buildWorkshop, workshopMaterials } from "./workshop";
import { buildGardenYard, buildHilltop, buildHouseYard, buildShedYard, buildSolarPanel } from "./yard";

export const LETTER_TO_THE_LAMP = "to-the-lamp";

const GRASS_A = new Color("#7FA37A");
const GRASS_B = new Color("#668C66");
const GRASS_WARM = new Color("#9DAF74");
// Grass worn thin beside the footpaths, so the drawn track settles into the lawn.
const WORN = new Color("#9AA27A");
const DIRT = new Color("#B3926C");
const MUD = new Color("#7E6B55");
const patches = GROUND_PATCHES.map((p) => ({ ...p, color: new Color(p.color) }));

/** The little picture for each place on Dad's map. */
const MAP_ICONS: Record<string, MapIcon> = {
  home: "house",
  workshop: "workshop",
  garden: "garden",
  dish: "dish",
  hill: "hill",
  meadow: "meadow",
  treehouse: "treehouse",
  playground: "playground",
  pond: "pond",
  camp: "tent",
  weather: "weather",
  rocket: "rocket",
  orchard: "orchard",
  windpump: "windpump",
  balloon: "balloon",
};

export function createHome(ctx: WorldContext): World {
  const { toon, quality } = ctx;
  const root = new Group();
  root.name = "world-home";
  const terrain = new Terrain(TERRAIN);
  const shedDir = SITES.shed.dir;

  // ---- The planet ----
  // Trees are planned first so the grass can darken under each one.
  const trees = planTrees(quality.particles);
  const shade = treeShade(trees);
  const planetGeometry = buildPlanetGeometry(terrain, Math.round((quality.terrainDetail * HOME_RADIUS) / 15), (dir, _r, normal, out) => {
    const n = fbm3(dir.x * 5, dir.y * 5, dir.z * 5, 2, 3);
    const fine = fbm3(dir.x * 19, dir.y * 19, dir.z * 19, 2, 5);
    out.copy(GRASS_A).lerp(GRASS_B, Math.max(0, Math.min(1, 0.5 + n * 1.4)));
    if (fine > 0.32) out.lerp(GRASS_WARM, Math.min(0.55, (fine - 0.32) * 2.5));

    const shed = angleBetween(dir, shedDir) * HOME_RADIUS;
    if (shed < 4.6) out.lerp(DIRT, Math.min(1, (4.6 - shed) / 1.2) * 0.85);

    const path = pathDistance(dir);
    if (path < PATH_HALF_WIDTH + 0.7) out.lerp(WORN, 0.55 * Math.min(1, (PATH_HALF_WIDTH + 0.7 - path) / 0.6));
    const pond = angleBetween(dir, POND) * HOME_RADIUS;
    if (pond < POND_RADIUS + 0.4) out.lerp(MUD, Math.min(1, (POND_RADIUS + 0.4 - pond) / 0.6));
    // Bare ground under the camp, the playground and the launch pad, soft at the edge.
    for (const patch of patches) {
      const d = angleBetween(dir, patch.dir) * HOME_RADIUS;
      if (d < patch.radius + 0.5) out.lerp(patch.color, patch.strength * Math.min(1, (patch.radius + 0.5 - d) / 0.9));
    }

    // Soft shade under trees, painted in so it shows even without shadow maps.
    for (const spot of shade) {
      const d = angleBetween(dir, spot.dir) * HOME_RADIUS;
      if (d < spot.radius) {
        const t = 1 - d / spot.radius;
        out.multiplyScalar(1 - spot.strength * t * t * (3 - 2 * t));
      }
    }

    // Slopes a touch darker, so hills read.
    const slope = 1 - Math.max(0, normal.dot(dir));
    out.multiplyScalar(1 - Math.min(0.25, slope * 2.2));
  });
  // Little rim light on the ground: a bright edge round the whole planet reads as an outline.
  const planet = new Mesh(planetGeometry, toon.toon({ vertexColors: true, paint: 0.09, rim: 0.2, nearFade: false }));
  planet.name = "planet";
  planet.receiveShadow = true;
  root.add(planet);

  // ---- Buildings and props ----
  const b = new Batcher();
  const colliders: ColliderGroup[] = [];
  const cameraColliders: ColliderGroup[] = [];

  const house = buildHouse(b, SITES.house);
  const houseGroup = createColliderGroup(SITES.house.matrix, house.shapes);
  colliders.push(houseGroup);
  cameraColliders.push(houseGroup);

  const textures = {
    moon: ctx.loadTexture("/textures/globes/moon.jpg"),
    mars: ctx.loadTexture("/textures/globes/mars.jpg"),
  };
  const shop = buildWorkshop(b, SITES.shed, toon, textures);
  const shedShell = createColliderGroup(SITES.shed.matrix, shop.shellShapes);
  const shedFront = createColliderGroup(SITES.shed.matrix, shop.frontShapes);
  colliders.push(shedShell, shedFront);
  cameraColliders.push(shedShell, shedFront);

  const mailboxSite = site(MAILBOX.lat, MAILBOX.lon, 120);
  colliders.push(createColliderGroup(groundMatrix(terrain, mailboxSite.dir, 120), buildMailbox(b, { ...mailboxSite, matrix: groundMatrix(terrain, mailboxSite.dir, 120) })));
  const mailboxMatrix = groundMatrix(terrain, mailboxSite.dir, 120);

  const dishShapes = buildDish(b, SITES.dish);
  const dishGroup = createColliderGroup(SITES.dish.matrix, dishShapes);
  colliders.push(dishGroup);
  cameraColliders.push(dishGroup);

  colliders.push(...buildHilltop(b, terrain, HILL_TOP));

  // The lived-in layer around each building.
  colliders.push(createColliderGroup(SITES.house.matrix, buildHouseYard(b, SITES.house)));
  colliders.push(createColliderGroup(SITES.shed.matrix, buildShedYard(b, SITES.shed, terrain)));
  colliders.push(createColliderGroup(SITES.garden.matrix, buildGardenYard(b, SITES.garden)));
  colliders.push(createColliderGroup(SITES.dish.matrix, buildSolarPanel(b, SITES.dish)));

  // Lamp posts along the paths. The one by the workshop is placed in the shed's own frame, outside its door.
  const lampDirs = [latLonToDir(-2.2, 1.6), latLonToDir(18, 3), local(SITES.shed, 2.6, 0, 5.4).normalize(), ...TRAIL_LAMPS];
  for (const dir of lampDirs) {
    const m = groundMatrix(terrain, dir, 0, 0.02);
    colliders.push(createColliderGroup(m, buildLampPost(b, { dir, forward: new Vector3(), origin: new Vector3(), matrix: m })));
  }

  colliders.push(createColliderGroup(SITES.garden.matrix, buildGarden(b, SITES.garden)));
  colliders.push(...buildMeadow(b, terrain, quality.particles));
  colliders.push(...scatterNature(b, terrain, quality.particles, trees));

  // The places to find round the far side: treehouse, pond, camp, weather station and more.
  const materials = workshopMaterials(toon);
  const places = buildPlaces(b, terrain, quality, materials);
  colliders.push(...places.colliders);
  for (const object of places.objects) root.add(object);

  // Footpaths: soft ribbons over the grass, with pebbles and the porch stepping stones.
  root.add(buildPaths(b, terrain, toon));

  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true })) root.add(mesh);

  // The shed's moving parts live in the shed's own frame.
  const shedFrame = new Group();
  shedFrame.matrixAutoUpdate = false;
  shedFrame.matrix.copy(SITES.shed.matrix);
  shedFrame.add(shop.frontWall, shop.roof);
  root.add(shedFrame);
  for (const object of [...shop.glass, ...shop.globes]) root.add(object);
  shop.frontWall.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = quality.shadowMap > 0;
      o.receiveShadow = true;
    }
  });
  shop.roof.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = quality.shadowMap > 0;
  });

  // ---- Lights ----
  const sun = new DirectionalLight("#FFD3AE", 1.7);
  sun.castShadow = quality.shadowMap > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
    const cam = sun.shadow.camera;
    cam.left = -13;
    cam.right = 13;
    cam.top = 13;
    cam.bottom = -13;
    cam.near = 1;
    cam.far = 70;
    // A low dusk sun grazes the ground, so it needs generous bias to avoid striped acne.
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.07;
  }
  root.add(sun, sun.target);
  const fill = new HemisphereLight("#A99CD2", "#5E554C", 1.8);
  root.add(fill);

  const lampLight = new PointLight("#FFC27A", 5.5, 9, 1.4);
  lampLight.position.copy(shop.lampBulb);
  root.add(lampLight);
  const porchLight = new PointLight("#FFC27A", 5, 6, 1.6);
  porchLight.position.copy(house.porchLight);
  root.add(porchLight);
  // Cool dusk light falls in through the workshop window, so the room is not one note of amber.
  let windowLight: PointLight | null = null;
  if (quality.tier !== "low") {
    windowLight = new PointLight("#8FA3D9", 2.4, 5.5, 1.5);
    windowLight.position.copy(local(SITES.shed, SHED.halfWidth - 0.6, 1.7, -0.2));
    root.add(windowLight);
  }

  // ---- Milo and the friends who wait in the workshop ----
  const milo = new Milo(toon);
  surfaceMatrix(shop.miloSpot.position, shedDir, shop.miloSpot.forward, milo.root.matrix);
  milo.root.matrix.decompose(milo.root.position, milo.root.quaternion, milo.root.scale);
  milo.setStage(ctx.store.value.miloStage);
  root.add(milo.root);

  const friendIds: KidId[] = ["nori", "lumi", "theo"];
  const friends = friendIds.map((id, i) => {
    const kid = new Character(id, toon);
    const spot = shop.friends[i]!;
    const up = spot.position.clone().normalize();
    surfaceMatrix(spot.position, up, spot.forward, kid.root.matrix);
    kid.root.matrix.decompose(kid.root.position, kid.root.quaternion, kid.root.scale);
    root.add(kid.root);
    colliders.push(createColliderGroup(kid.root.matrix, [{ kind: "circle", x: 0, z: 0, radius: 0.28, height: 1.3 }]));
    return kid;
  });

  // ---- Mom waits on the porch bench with a cup of tea ----
  const mom = new Mom(toon);
  mom.root.matrix.copy(SITES.house.matrix).multiply(new Matrix4().makeTranslation(1.0, 0.58, 2.02));
  mom.root.matrix.decompose(mom.root.position, mom.root.quaternion, mom.root.scale);
  root.add(mom.root);

  // ---- The first letter waits in the mailbox ----
  const waitingLetter = createEnvelope(toon);
  const letterSpot = new Vector3(0, 1.32, 0.3).applyMatrix4(mailboxMatrix);
  waitingLetter.position.copy(letterSpot);
  waitingLetter.quaternion.setFromRotationMatrix(mailboxMatrix);
  waitingLetter.rotateX(-0.5);
  root.add(waitingLetter);

  // ---- Particles ----
  const motes = new Floaters({ count: Math.round(46 * quality.particles), center: shop.dustCenter, radius: 1.3, color: "#FFE2A6", size: 0.035, glow: true, speed: 0.4, blink: false, seed: 4 });
  const gardenTop = SITES.garden.dir.clone().multiplyScalar(HOME_RADIUS + 1.0);
  const fireflies = new Floaters({ count: Math.round(26 * quality.particles), center: gardenTop, radius: 3, color: "#F6E27A", size: 0.07, glow: true, speed: 0.6, blink: true, seed: 8 });
  const hillFlies = new Floaters({
    count: Math.round(18 * quality.particles),
    center: latLonToDir(HILL.lat - 8, HILL.lon + 6).multiplyScalar(HOME_RADIUS + 1.6),
    radius: 3.5,
    color: "#F6E27A",
    size: 0.07,
    glow: true,
    speed: 0.55,
    blink: true,
    seed: 12,
  });
  for (const f of [motes, fireflies, hillFlies]) root.add(f.points);
  // A thread of smoke from the chimney: someone is home.
  const chimney = local(SITES.house, 1.05, 2.55 + 2.25, -0.7);
  const smoke = new Smoke(chimney, chimney.clone().normalize(), Math.round(7 + 5 * quality.particles), "#E9DCCB");
  root.add(smoke.points);

  // ---- Interactions (Phase 02 uses them to prove the systems; Phase 05 writes the story) ----
  const { store, interactions, bus } = ctx;
  interactions.add({
    id: "mailbox",
    position: new Vector3(0, 0, 0.55).applyMatrix4(mailboxMatrix),
    radius: 1.6,
    kind: "press",
    label: () => (store.value.carrying === null && !store.value.delivered.includes(LETTER_TO_THE_LAMP) ? "Take the letter" : null),
    onDone: () => {
      store.update((s) => {
        s.carrying = LETTER_TO_THE_LAMP;
      });
      bus.emit("letter:taken", { letter: LETTER_TO_THE_LAMP });
    },
  });
  interactions.add({
    id: "lamp",
    position: shop.lampSpot,
    radius: 1.9,
    kind: "press",
    label: () => (store.value.carrying === LETTER_TO_THE_LAMP ? "Give the letter to the lamp" : null),
    onDone: () => {
      store.update((s) => {
        s.carrying = null;
        if (!s.delivered.includes(LETTER_TO_THE_LAMP)) s.delivered.push(LETTER_TO_THE_LAMP);
      });
      bus.emit("letter:delivered", { letter: LETTER_TO_THE_LAMP, to: "lamp" });
    },
  });
  interactions.add({
    id: "dish",
    position: local(SITES.dish, 0, 0, 1.4),
    radius: 1.8,
    kind: "hold",
    holdTime: 1.2,
    label: () => "Point the dish",
    onDone: () => undefined,
  });

  // ---- Dad's domes: look into one and the Looking Lamp takes you inside ----
  const DOME_WORLDS = ["tranquility", "hadley", "meridiani", "valinor"];
  const domeGlows = shop.domes.map((dome) => {
    // A warm ring under the glass: soft for the next world to visit, bright once its stamp is earned.
    const ring = new Mesh(torus(0.12), toon.glow("#FFC877"));
    ring.position.copy(dome.top).addScaledVector(shedDir, -0.27);
    ring.quaternion.setFromRotationMatrix(SITES.shed.matrix);
    ring.rotateX(Math.PI / 2);
    ring.scale.setScalar(0.255);
    ring.visible = false;
    root.add(ring);
    return ring;
  });
  const opened = (): boolean => store.value.stamps.includes("prologue") || store.value.flags.includes("explore-freely");
  shop.domes.forEach((dome, i) => {
    const world = DOME_WORLDS[i]!;
    const chapter = CHAPTERS.find((c) => c.world === world);
    if (!chapter) return;
    interactions.add({
      id: `dome-${world}`,
      position: dome.stand,
      radius: 1.0,
      kind: "press",
      label: () => (opened() && !store.value.carrying?.startsWith("part:") ? STORY_COPY.visit(chapter.dome) : null),
      onDone: () => bus.emit("travel", { to: world, entry: "lamp" }),
    });
  });
  // Milo takes the part a player brings home.
  interactions.add({
    id: "milo",
    position: shop.benchFront.clone().lerp(shop.miloSpot.position, 0.25),
    radius: 1.5,
    kind: "press",
    label: () => chapterForPart(store.value.carrying)?.partPrompt ?? null,
    onDone: () => {
      const chapter = chapterForPart(store.value.carrying);
      if (!chapter) return;
      store.update((s) => {
        s.carrying = null;
        s.miloStage = Math.max(s.miloStage, chapter.milo);
      });
      bus.emit("milo:stage", { stage: chapter.milo });
    },
  });
  const offStage = bus.on("milo:stage", ({ stage }) => milo.setStage(stage));

  // ---- Bookmarks for screenshots and the title sequence ----
  const spawnDir = latLonToDir(SITES.spawn.lat, SITES.spawn.lon);
  const spawnForward = headingToTangent(spawnDir, SITES.spawn.heading);
  const spawnGround = terrain.pointAt(spawnDir);
  const inShed = (x: number, z: number): Vector3 => local(SITES.shed, x, 0, z).normalize();
  const shedForward = SITES.shed.forward.clone().negate();
  // Gameplay views: the normal follow camera, standing in a few places around the yard.
  const standAt = (dir: Vector3, heading: number): Bookmark => ({ player: { dir: dir.clone().normalize(), forward: headingToTangent(dir.clone().normalize(), heading) }, camera: null });
  const toward = (from: Vector3, to: Vector3): number => {
    const north = headingToTangent(from, 0);
    const east = headingToTangent(from, 90);
    const d = to.clone().sub(from);
    return (Math.atan2(d.dot(east), d.dot(north)) * 180) / Math.PI;
  };
  const yardSpot = latLonToDir(-3, -4);
  const gardenSpot = latLonToDir(-8, -8);
  const shedSpot = local(SITES.shed, 0.6, 0, 7.2).normalize();
  const hillSpot = latLonToDir(HILL.lat - 7, HILL.lon - 1);
  const meadowSpot = latLonToDir(-20, 6);
  /** Stands in front of a place, some meters out along its front, looking at it. */
  const visit = (s: Site, back: number, x = 0): Bookmark => {
    const at = local(s, x, 0, back).normalize();
    return standAt(at, toward(at, s.dir));
  };
  const near = (target: Vector3, from: Vector3, meters: number): Bookmark => {
    const at = target.clone().lerp(from, meters / (angleBetween(target, from) * HOME_RADIUS)).normalize();
    return standAt(at, toward(at, target));
  };
  /** A view from orbit, square onto the planet so it reads as a round ball. */
  const orbit = (lat: number, lon: number, distance = 3.4): Bookmark => ({
    player: { dir: spawnDir, forward: spawnForward },
    camera: { position: latLonToDir(lat, lon).multiplyScalar(HOME_RADIUS * distance), target: new Vector3(0, 0, 0), up: headingToTangent(latLonToDir(lat, lon), 0) },
  });
  const bookmarks: Record<string, Bookmark> = {
    "play-yard": standAt(yardSpot, toward(yardSpot, SITES.house.dir)),
    "play-garden": standAt(gardenSpot, toward(gardenSpot, SITES.garden.dir)),
    "play-shed": standAt(shedSpot, toward(shedSpot, SITES.shed.dir)),
    "play-hill": standAt(hillSpot, toward(hillSpot, HILL_TOP)),
    "play-meadow": standAt(meadowSpot, toward(meadowSpot, MEADOW.oak)),
    "play-treehouse": visit(SITES.treehouse, 6.2, 0.8),
    "play-pond": near(POND, SITES.camp.dir, POND_RADIUS + 3.6),
    "play-camp": visit(SITES.camp, 5.6, -0.6),
    "play-weather": visit(SITES.weather, 4.8),
    "play-playground": visit(SITES.playground, 6.4),
    "play-rocket": visit(SITES.rocket, 4.6, 0.5),
    "play-orchard": near(ORCHARD, SITES.rocket.dir, 5.5),
    "play-windpump": visit(SITES.windpump, 6.4, 0.6),
    "play-balloon": visit(SITES.balloon, 7.0),
    wide: orbit(-14, 6, 3.3),
    "orbit-back": orbit(-8, 186),
    "orbit-west": orbit(10, -100),
    "orbit-east": orbit(-6, 96),
    "orbit-north": orbit(70, 20),
    "orbit-south": orbit(-62, -10),
    mom: {
      player: { dir: local(SITES.house, -0.6, 0, 4.6).normalize(), forward: SITES.house.forward.clone().negate() },
      camera: { position: local(SITES.house, 0.2, 1.5, 4.4), target: local(SITES.house, 1.0, 1.05, 2.0) },
    },
    porch: {
      player: { dir: local(SITES.house, 0.3, 0, 4.4).normalize(), forward: SITES.house.forward.clone().negate() },
      camera: { position: local(SITES.house, 2.8, 2.6, 8.6), target: local(SITES.house, -0.4, 1.4, 1.6) },
    },
    workshop: { player: { dir: inShed(-0.3, 0.6), forward: shedForward }, camera: null },
    bench: {
      player: { dir: inShed(-0.9, -0.6), forward: shedForward },
      camera: { position: local(SITES.shed, 0.2, 2.25, 0.9), target: local(SITES.shed, 0.2, SHED.floor + 0.95, -1.95) },
    },
    character: {
      player: { dir: spawnDir, forward: spawnForward.clone().negate() },
      camera: {
        position: spawnGround.clone().addScaledVector(spawnForward, -2.6).addScaledVector(spawnDir, 1.15),
        target: spawnGround.clone().addScaledVector(spawnDir, 0.75).addScaledVector(spawnForward, 0.4),
      },
    },
    "character-back": {
      player: { dir: spawnDir, forward: spawnForward.clone().negate() },
      camera: {
        position: spawnGround.clone().addScaledVector(spawnForward, 2.3).addScaledVector(spawnDir, 1.35),
        target: spawnGround.clone().addScaledVector(spawnDir, 0.7).addScaledVector(spawnForward, -0.2),
      },
    },
    // Close-ups of each friend's face, for reviewing the characters.
    ...Object.fromEntries(
      friendIds.map((id, i): [string, Bookmark] => {
        const spot = shop.friends[i]!;
        const up = spot.position.clone().normalize();
        return [
          `friend-${id}`,
          {
            player: { dir: inShed(-0.9, -0.6), forward: shedForward },
            camera: { position: spot.position.clone().addScaledVector(spot.forward, 1.75).addScaledVector(up, 1.05), target: spot.position.clone().addScaledVector(up, 0.82), up },
          },
        ];
      }),
    ),
    "character-side": {
      player: { dir: spawnDir, forward: spawnForward.clone().negate() },
      camera: {
        position: spawnGround.clone().addScaledVector(spawnForward, -1.4).addScaledVector(spawnDir, 1.1).addScaledVector(new Vector3().crossVectors(spawnDir, spawnForward).normalize(), 2.0),
        target: spawnGround.clone().addScaledVector(spawnDir, 0.7),
      },
    },
  };

  // ---- Per-frame ----
  const earScratch = new Vector3();
  let inside = false;
  let open = 0;
  let zone: string | null = null;
  let pixelHeight = 900;
  const surfaceAt = (dir: Vector3, onPlatform: boolean): string => {
    if (onPlatform) return "wood";
    if (places.isWater(dir)) return "water";
    if (pathDistance(dir) < PATH_HALF_WIDTH) return "path";
    return "grass";
  };

  const world: World = {
    id: "home",
    root,
    terrain,
    colliders,
    cameraColliders,
    sky: {
      zenith: "#2E2A4F",
      horizon: "#E59C78",
      ground: "#3A3354",
      glow: "#F2A541",
      glowDirection: new Vector3(1, 0.2, -0.4),
      glowStrength: 0.9,
      clouds: 0.55,
      cloudColor: "#C98A93",
      stars: 0.55,
    },
    look: {
      grade: { shadows: "#3B3166", highlights: "#F6C27A", shadowAmount: 0.38, highlightAmount: 0.22, saturation: 1.06, contrast: 1.04, lift: 0.055 },
      ink: "#2B2622",
      inkStrength: 0.85,
      inkWidth: 1.25,
      inkFade: [26, 60],
      grain: 0.055,
      vignette: 0.55,
      lamp: "#F2A541",
    },
    sun,
    fill,
    sunHeight: 0.32,
    sunToward: new Vector3(1, 0.2, -0.4),
    dustColor: "#D8C3A0",
    // Dusk haze on the far curve. Starts past the play area so nearby color stays clean.
    fog: { color: "#C79390", near: -3, far: 22 },
    spawn: { dir: spawnDir, forward: spawnForward },
    // Back from a dome: standing at the workbench, facing it.
    entries: { bench: { dir: inShed(0.9, -0.55), forward: shedForward } },
    intro: {
      lamp: shop.lampBulb.clone(),
      // A dolly back from Dad's lamp along one straight line, out through the
      // open door with the lamp still centered, then up and over the planet.
      path: [
        local(SITES.shed, -1.14, 1.53, 0.0),
        local(SITES.shed, -0.66, 1.54, 1.07),
        local(SITES.shed, 0.01, 1.56, 2.63),
        local(SITES.shed, 0.76, 1.6, 4.37),
        local(SITES.shed, 1.6, 4.2, 8.0),
      ],
      final: {
        position: latLonToDir(-24, 8).multiplyScalar(HOME_RADIUS * 3.2),
        // Aimed above the planet so its top sits just under the middle of the screen, leaving the sky for the title.
        target: latLonToDir(25.6, 8).multiplyScalar(HOME_RADIUS * 1.03),
        up: latLonToDir(16, 10),
      },
      radius: HOME_RADIUS * 1.027,
    },
    anchor(id: string) {
      if (id === "mom") return mom.root.position.clone().addScaledVector(SITES.house.dir, 1.35);
      if (id === "lamp") return shop.lampBulb.clone();
      if (id === "dish") return local(SITES.dish, 0, 1.6, 0);
      if (id === "milo") return milo.root.position.clone();
      return null;
    },
    setPower(level: number) {
      // Windows and lamp glass glow brighter; the porch and window lights follow.
      const t = Math.max(0, Math.min(1, level));
      const glow = materials.glow as { color?: Color } | undefined;
      glow?.color?.setScalar(0.38 + 0.62 * t);
      porchLight.intensity = 5 * t;
      if (windowLight) windowLight.intensity = 2.4 * (0.4 + 0.6 * t);
    },
    bookmarks,
    surfaceAt,
    // Dad's lamp hums where it stands, and Milo chirps now and then when someone comes close.
    sounds: [
      { position: shop.lampBulb.clone(), loop: "lamp-hum", value: 1 },
      { position: milo.root.position.clone().addScaledVector(shedDir, 0.4), cue: "milo-curious", every: [16, 30], radius: 4 },
    ],
    ambience(player) {
      // Inside the shed: the clock and still air. Outside: crickets and the breeze, with a little
      // of the workshop near its door. The hill, the pond and the campfire add their own.
      const nearShop = Math.max(0, Math.min(1, 1 - (shop.lampBulb.distanceTo(earScratch.set(player.x, player.y, player.z)) - 3) / 5));
      return {
        workshop: inside ? 1 : nearShop * 0.35,
        dusk: inside ? 0.28 : 1,
        hill: zone === "hill" ? 0.85 : 0,
        pond: zone === "pond" ? 1 : 0,
        camp: zone === "camp" ? 1 : 0,
      };
    },
    cameraHint(player) {
      if (!inside) return null;
      return { forward: shedForward.clone(), pitch: 0.78, distance: 6.4 + (player.position.length() > 0 ? 0 : 0) };
    },
    zoneAt(dir: Vector3) {
      // A little give at the edge, so walking along a border never flickers the name.
      if (zone) {
        const current = PLACES.find((p) => p.id === zone);
        if (current && angleBetween(dir, current.dir) * HOME_RADIUS < current.radius + 0.8) return zone;
      }
      zone = null;
      for (const place of PLACES) {
        if (angleBetween(dir, place.dir) * HOME_RADIUS < place.radius) {
          zone = place.id;
          break;
        }
      }
      return zone;
    },
    map: {
      title: "Home",
      radius: HOME_RADIUS,
      center: latLonToDir(SITES.spawn.lat, SITES.spawn.lon),
      colors: { land: "#93B47E", shade: "#7E9F6C", ink: "#2B2622", path: "#D6C09A", water: "#86B8CC" },
      marks: [
        { id: "mailbox", label: "Mailbox", at: latLonToDir(MAILBOX.lat, MAILBOX.lon), icon: "mailbox" },
        ...PLACES.map((p) => ({
          id: p.id,
          label: PLACE_COPY[p.id]?.name ?? p.id,
          at: p.dir,
          icon: MAP_ICONS[p.id] ?? "house",
          // Home and the workshop are known from the start; the rest are found by walking.
          ...(p.id === "home" || p.id === "workshop" ? {} : { found: placeFlag(p.id) }),
          ...(p.id === "workshop" ? { letters: [LETTER_TO_THE_LAMP] } : {}),
        })),
      ],
      water: [{ at: POND, radius: POND_RADIUS }],
      patches: [
        { at: HILL_TOP, radius: HILL.radius * 0.7, color: "#A9C78C" },
        ...GROUND_PATCHES.map((g) => ({ at: g.dir, radius: g.radius, color: g.color })),
      ],
      paths: TRAILS,
    },
    objective() {
      const s = store.value;
      if (s.carrying === LETTER_TO_THE_LAMP) return shop.lampSpot;
      if (!s.delivered.includes(LETTER_TO_THE_LAMP)) return new Vector3(0, 0, 0.55).applyMatrix4(mailboxMatrix);
      if (chapterForPart(s.carrying)) return shop.miloSpot.position;
      if (!s.flags.includes("seen-notebook")) return null;
      const next = CHAPTERS.find((c) => !s.stamps.includes(c.id));
      if (next && opened()) {
        const i = DOME_WORLDS.indexOf(next.world);
        return i >= 0 ? shop.domes[i]!.stand : null;
      }
      return null;
    },
    update(dt: number, frame: FrameInfo) {
      const feet = frame.player.position;
      // Hysteresis, so standing in the doorway never flickers the walls.
      const wasInside = inside;
      if (!inside && shop.isInside(feet, -0.15)) inside = true;
      else if (inside && !shop.isInside(feet, 0.55)) inside = false;
      // The front swings down with a creak, and shuts with a soft knock.
      if (inside !== wasInside) {
        const door = local(SITES.shed, 0, 1.2, SHED.halfDepth ?? 2.5);
        bus.emit("sfx", { name: inside ? "shed-open" : "shed-close", at: [door.x, door.y, door.z] });
      }

      const target = inside ? 1 : 0;
      open += (target - open) * damp(frame.reducedMotion ? 30 : 5, dt);
      if (Math.abs(open - target) < 0.001) open = target;
      // The front swings out and down on its bottom hinge, with a little bounce.
      const swing = open < 0.999 ? open * open * (3 - 2 * open) : 1;
      shop.frontWall.rotation.x = swing * (Math.PI / 2) * 0.985;
      // Once down, the panel tucks into the ground so it never fills the bottom of a tall screen.
      shop.frontWall.position.y = SHED.floor - 0.02 - Math.max(0, swing - 0.7) * 2;
      shop.frontWall.visible = true;
      shop.roof.position.y = SHED.floor + SHED.wallHeight + swing * 3.5;
      shop.roof.scale.setScalar(Math.max(0.001, 1 - swing));
      shop.roof.visible = swing < 0.995;
      // Walls block the player only while they stand.
      const frontIndex = colliders.indexOf(shedFront);
      if (open > 0.2 && frontIndex >= 0) colliders.splice(frontIndex, 1);
      if (open <= 0.2 && frontIndex < 0) colliders.push(shedFront);
      const camFront = cameraColliders.indexOf(shedFront);
      const camShell = cameraColliders.indexOf(shedShell);
      if (inside) {
        if (camFront >= 0) cameraColliders.splice(camFront, 1);
        const shell = cameraColliders.indexOf(shedShell);
        if (shell >= 0) cameraColliders.splice(shell, 1);
      } else {
        if (camFront < 0) cameraColliders.push(shedFront);
        if (camShell < 0) cameraColliders.push(shedShell);
      }

      waitingLetter.visible = store.value.carrying === null && !store.value.delivered.includes(LETTER_TO_THE_LAMP);
      // Earned domes glow; the next one breathes softly to say "here".
      const nextChapter = opened() ? CHAPTERS.find((c) => !store.value.stamps.includes(c.id)) : undefined;
      domeGlows.forEach((ring, i) => {
        const chapter = CHAPTERS.find((c) => c.world === DOME_WORLDS[i]);
        const earned = chapter ? store.value.stamps.includes(chapter.id) : false;
        const next = chapter !== undefined && chapter === nextChapter;
        ring.visible = earned || next;
        const pulse = next && !frame.reducedMotion ? 0.55 + 0.45 * Math.sin(frame.time * 2.4) : 1;
        (ring.material as { color: Color }).color.setRGB(1 * pulse, 0.78 * pulse, 0.46 * pulse);
      });

      const toMilo = feet.distanceTo(milo.root.position);
      milo.update(dt, Math.max(0, 1 - toMilo / 3), frame.reducedMotion);
      const head = feet.clone().addScaledVector(frame.player.up, 1.0);
      mom.update(dt, head, frame.reducedMotion);
      for (const kid of friends) {
        kid.lookAt(inside && kid.root.position.distanceTo(feet) < 4.5 ? head : null);
        kid.update(dt, { pace: 0, running: false, grounded: true, verticalSpeed: 0, sinceLanding: 10, landingSpeed: 0, carrying: false }, frame.reducedMotion);
      }
      motes.update(dt, frame.reducedMotion);
      fireflies.update(dt, frame.reducedMotion);
      hillFlies.update(dt, frame.reducedMotion);
      smoke.update(dt, frame.reducedMotion);
      places.update(dt, frame.time, frame.reducedMotion);
      // The lamp breathes a little, like a real filament.
      lampLight.intensity = 5.5 + (frame.reducedMotion ? 0 : Math.sin(frame.time * 3.1) * 0.2);
    },
    resize(height: number) {
      pixelHeight = height;
      for (const f of [motes, fireflies, hillFlies]) f.setScale(pixelHeight);
      smoke.setScale(pixelHeight);
      places.resize(pixelHeight);
    },
    dispose() {
      offStage();
      for (const f of [motes, fireflies, hillFlies]) f.dispose();
      smoke.dispose();
      places.dispose();
      planetGeometry.dispose();
      root.traverse((o) => {
        if (o instanceof Mesh && (o.name.startsWith("batch") || o.name === "paths")) o.geometry.dispose();
      });
      textures.moon.dispose();
      textures.mars.dispose();
      interactions.clear();
    },
  };
  return world;
}
