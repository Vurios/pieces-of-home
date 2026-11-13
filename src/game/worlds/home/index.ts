import { Color, DirectionalLight, Group, HemisphereLight, Matrix4, Mesh, MeshBasicMaterial, PointLight, Vector3 } from "three";
import { Character, type KidId } from "../../actors/character";
import { Milo } from "../../actors/milo";
import { Mom } from "../../actors/mom";
import { createEnvelope, createParcel } from "../../actors/props";
import { Batcher, SECTORS, planetMeshes } from "../../render/kit";
import { Floaters, Smoke } from "../../render/particles";
import { type ColliderGroup, createColliderGroup } from "../../world/colliders";
import { fbm3 } from "../../world/noise";
import { angleBetween, damp, headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import { Terrain, buildPlanetGeometry } from "../../world/terrain";
import type { Bookmark, FrameInfo, MapIcon, World, WorldContext } from "../types";
import { PLACE_COPY, placeFlag } from "../../../content/places";
import { CHAPTERS, MAIN_CHAPTERS, bonusOpen, chapterForPart, fittedFlag, miloParts } from "../../../content/chapters";
import { STORY_COPY } from "../../../content/chapters/common";
import { FINALE_BEGUN, FINALE_COPY, MILO_VOICE, RECORD, V1_LETTER, finaleStep } from "../../../content/finale";
import { torus } from "../../actors/parts";
import { C, buildDish, buildHouse, buildLampPost, buildMailbox } from "./buildings";
import { GROUND_PATCHES, type Site, HILL, HILL_TOP, HOME_RADIUS, MAILBOX, MEADOW, ORCHARD, PATH_HALF_WIDTH, PLACES, POND, POND_RADIUS, SITES, TERRAIN, TRAILS, TRAIL_LAMPS, clearOfTrails, local, site } from "./layout";
import { buildGarden, buildMeadow, groundMatrix, pathDistance, planTrees, scatterNature, treeShade } from "./nature";
import { buildPaths } from "./paths";
import { presence } from "../../../net/presence";
import { buildPlaces } from "./places";
import { SHED, buildWorkshop, workshopMaterials } from "./workshop";
import { buildGardenYard, buildHilltop, buildHouseYard, buildShedYard, buildSolarPanel } from "./yard";

export const LETTER_TO_THE_LAMP = "to-the-lamp";
/** Mom hands Remi the key to Dad's workshop at the start of a new story. */
export const WORKSHOP_KEY = "workshop-key";
/** Dad's lamp has clicked on by itself (the prologue's first beat). */
export const LAMP_ON = "lamp-on";

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
  // The ground is cut into wedges so the far side of the world is skipped when it is out of sight.
  for (const wedge of planetMeshes(planetGeometry, toon.toon({ vertexColors: true, paint: 0.09, rim: 0.2, nearFade: false }))) root.add(wedge);

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
  for (const spot of lampDirs) {
    const dir = clearOfTrails(spot);
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

  for (const mesh of b.build(materials, { castShadow: quality.shadowMap > 0, receiveShadow: true, sectors: SECTORS })) root.add(mesh);

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
  // Dad's lamp turns itself on. In a new story it waits dark until Remi first steps into the
  // workshop, then clicks on by itself (Game Bible, Prologue). Older saves and the title see it lit.
  const lampWaits = (): boolean => {
    const s = store.value;
    return s.flags.includes(WORKSHOP_KEY) && !s.flags.includes(LAMP_ON) && !s.delivered.includes(LETTER_TO_THE_LAMP);
  };
  let lampPower = 1;
  let lampClick = -1;
  /** The lamp and the pins read the save on the first frame (the store is set up further down). */
  let firstFrame = true;
  // The globe pins wake up once the prologue is done.
  const pinsLit = (): boolean => store.value.stamps.includes("prologue") || store.value.flags.includes("explore-freely");
  let pinGlow = 1;
  let pinPop = -1;
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
  milo.setParts(miloParts(ctx.store.value));
  root.add(milo.root);

  const friendIds: KidId[] = ["nori", "lumi", "theo"];
  const friends = friendIds.map((id, i) => {
    const kid = new Character(id, toon);
    const spot = shop.friends[i]!;
    const up = spot.position.clone().normalize();
    surfaceMatrix(spot.position, up, spot.forward, kid.root.matrix);
    kid.root.matrix.decompose(kid.root.position, kid.root.quaternion, kid.root.scale);
    root.add(kid.root);
    // In a co-op room a real friend may play this kid: then this one steps out (see update).
    const body = { kind: "circle" as const, x: 0, z: 0, radius: 0.28, height: 1.3 };
    colliders.push(createColliderGroup(kid.root.matrix, [body]));
    kid.root.userData["body"] = body;
    // Playing alone, the friends help: ask one and they say the next hint (Game Bible: hints, three tiers).
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    const head = spot.position.clone().addScaledVector(up, 1.45);
    // The context's helpers by their full name: the short names are declared further down.
    ctx.interactions.add({
      id: `friend-${id}`,
      position: spot.position,
      radius: 0.8,
      kind: "press",
      label: () => (ctx.store.value.carrying?.startsWith("part:") || presence.kids.has(id) ? null : `Ask ${name} for a hint`),
      onDone: () => ctx.bus.emit("hint:ask", { who: id, name, at: [head.x, head.y, head.z] }),
    });
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
    label: () => {
      const s = store.value;
      if (s.carrying !== null) return null;
      if (!s.delivered.includes(LETTER_TO_THE_LAMP)) return "Take the letter";
      return finaleStep(s) === "mailbox" ? FINALE_COPY.takeLetter : null;
    },
    onDone: () => {
      // The first letter, or (in the Finale) Dad's last one.
      const letter = store.value.delivered.includes(LETTER_TO_THE_LAMP) ? V1_LETTER : LETTER_TO_THE_LAMP;
      store.update((s) => {
        s.carrying = letter;
      });
      bus.emit("letter:taken", { letter });
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
    kind: "press",
    // While Milo's record waits by the dish, the record has the prompt.
    label: () => (store.value.carrying === V1_LETTER ? FINALE_COPY.aim : finaleStep(store.value) === "record-take" ? null : "Point the dish"),
    onDone: () => {
      if (store.value.carrying === V1_LETTER) bus.emit("finale:aim", {});
    },
  });
  // Milo's record waits in the dish's little box once the last letter is sent.
  const record = createParcel(toon);
  const recordSpot = local(SITES.dish, 0.62, 0.08, 1.0);
  record.position.copy(recordSpot);
  record.quaternion.setFromRotationMatrix(SITES.dish.matrix);
  record.visible = false;
  root.add(record);
  interactions.add({
    id: "record",
    position: recordSpot,
    radius: 1.3,
    kind: "press",
    label: () => (finaleStep(store.value) === "record-take" && store.value.carrying === null ? FINALE_COPY.takeRecord : null),
    onDone: () => {
      store.update((s) => {
        s.carrying = RECORD;
      });
      bus.emit("letter:taken", { letter: RECORD });
    },
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

  // ---- Dad's archive board: a card for each machine he never built a world for ----
  interactions.add({
    id: "archive",
    position: shop.archive.stand,
    radius: 1.1,
    kind: "press",
    label: () => (opened() && store.value.carrying === null ? "Read Dad's archive cards" : null),
    onDone: () => bus.emit("archive:open", {}),
  });

  // ---- Dad's newest dome: the bonus world, under a dust cloth until Chapter 3 is stamped ----
  const BONUS = CHAPTERS.find((c) => c.bonus)!;
  const BONUS_SEEN = "bonus:seen";
  root.add(shop.bonusDome.cover);
  for (const item of shop.museum.items) root.add(item.object);
  const bonusRing = new Mesh(torus(0.12), toon.glow("#FFC877"));
  bonusRing.position.copy(shop.bonusDome.top).addScaledVector(shedDir, -0.27 * 0.85 + 0.03);
  bonusRing.quaternion.setFromRotationMatrix(SITES.shed.matrix);
  bonusRing.rotateX(Math.PI / 2);
  bonusRing.scale.setScalar(0.22);
  bonusRing.visible = false;
  root.add(bonusRing);
  /** Seconds since the cloth started to slide off, or -1. */
  let coverFall = -1;
  const coverHome = shop.bonusDome.cover.position.clone();
  interactions.add({
    id: `dome-${BONUS.world}`,
    position: shop.bonusDome.stand,
    radius: 1.0,
    kind: "press",
    label: () => (opened() && bonusOpen(store.value) && !store.value.carrying?.startsWith("part:") ? STORY_COPY.visit(BONUS.dome) : null),
    onDone: () => bus.emit("travel", { to: BONUS.world, entry: "lamp" }),
  });

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
    label: () => (store.value.carrying === RECORD ? FINALE_COPY.giveRecord : (chapterForPart(store.value.carrying)?.partPrompt ?? null)),
    onDone: () => {
      if (store.value.carrying === RECORD) {
        store.update((s) => {
          s.carrying = null;
          s.miloStage = Math.max(s.miloStage, MILO_VOICE);
        });
        bus.emit("milo:stage", { stage: MILO_VOICE });
        return;
      }
      const chapter = chapterForPart(store.value.carrying);
      if (!chapter) return;
      store.update((s) => {
        s.carrying = null;
        s.miloStage = Math.max(s.miloStage, chapter.milo);
        if (!s.flags.includes(fittedFlag(chapter))) s.flags.push(fittedFlag(chapter));
      });
      bus.emit("milo:stage", { stage: chapter.milo, chapter: chapter.id });
    },
  });
  const offStage = bus.on("milo:stage", () => milo.setParts(miloParts(store.value)));

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
    milo: {
      player: { dir: inShed(-0.9, -0.6), forward: shedForward },
      camera: { position: local(SITES.shed, 0.45, SHED.floor + 1.7, -0.45), target: local(SITES.shed, -0.5, SHED.floor + 1.1, -2.0) },
    },
    museum: {
      player: { dir: inShed(-1.2, -0.4), forward: shedForward },
      camera: { position: local(SITES.shed, -1.15, 1.85, 0.1), target: local(SITES.shed, -2.85, 1.42, -0.78) },
    },
    "bonus-dome": {
      player: { dir: inShed(0.9, 0.2), forward: shedForward },
      camera: { position: local(SITES.shed, 1.0, SHED.floor + 1.95, 2.1), target: local(SITES.shed, 2.55, SHED.floor + 1.0, 0.98) },
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

  // ---- Night, for the Finale ----
  const DUSK = {
    sky: { zenith: "#2E2A4F", horizon: "#E59C78", ground: "#3A3354", glow: "#F2A541", glowStrength: 0.9, clouds: 0.55, cloudColor: "#C98A93", stars: 0.55 },
    grade: { shadows: "#3B3166", highlights: "#F6C27A", shadowAmount: 0.38, highlightAmount: 0.22, saturation: 1.06, contrast: 1.04, lift: 0.055 },
    fog: "#C79390",
  };
  const NIGHT = {
    sky: { zenith: "#0B1030", horizon: "#3A3470", ground: "#1C1A3A", glow: "#E0B34A", glowStrength: 0.22, clouds: 0.22, cloudColor: "#3A3668", stars: 1 },
    grade: { shadows: "#1C1E52", highlights: "#FFD98A", shadowAmount: 0.5, highlightAmount: 0.24, saturation: 0.96, contrast: 1.06, lift: 0.045 },
    fog: "#2C2A5A",
  };
  const ca = new Color();
  const cb = new Color();
  const mix = (a: string, b: string, t: number): string => `#${ca.set(a).lerp(cb.set(b), t).getHexString()}`;
  const glowToward = new Vector3(1, 0.2, -0.4);
  let night = store.value.flags.includes(FINALE_BEGUN) ? 1 : 0;

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
    liveSky() {
      if (night <= 0) return null;
      const d = DUSK.sky;
      const n = NIGHT.sky;
      const lerp = (a: number, b: number): number => a + (b - a) * night;
      return {
        zenith: mix(d.zenith, n.zenith, night),
        horizon: mix(d.horizon, n.horizon, night),
        ground: mix(d.ground, n.ground, night),
        glow: mix(d.glow, n.glow, night),
        glowDirection: glowToward,
        glowStrength: lerp(d.glowStrength, n.glowStrength),
        clouds: lerp(d.clouds, n.clouds),
        cloudColor: mix(d.cloudColor, n.cloudColor, night),
        stars: lerp(d.stars, n.stars),
      };
    },
    liveLook() {
      if (night <= 0) return null;
      const d = DUSK.grade;
      const n = NIGHT.grade;
      const lerp = (a: number, b: number): number => a + (b - a) * night;
      if (world.fog) world.fog.color = mix(DUSK.fog, NIGHT.fog, night);
      return {
        grade: {
          shadows: mix(d.shadows, n.shadows, night),
          highlights: mix(d.highlights, n.highlights, night),
          shadowAmount: lerp(d.shadowAmount, n.shadowAmount),
          highlightAmount: lerp(d.highlightAmount, n.highlightAmount),
          saturation: lerp(d.saturation, n.saturation),
          contrast: lerp(d.contrast, n.contrast),
          lift: lerp(d.lift, n.lift),
        },
        ink: "#2B2622",
        inkStrength: 0.85,
        inkWidth: 1.25,
        inkFade: [26, 60],
        grain: 0.055,
        vignette: 0.55 + 0.1 * night,
        lamp: "#F2A541",
      };
    },
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
      switch (finaleStep(s)) {
        case "mailbox":
          return new Vector3(0, 0, 0.55).applyMatrix4(mailboxMatrix);
        case "dish":
          return local(SITES.dish, 0, 0, 1.4);
        case "record-take":
          return recordSpot;
        case "record-give":
          return shop.miloSpot.position;
        case "listen":
        case "page":
        case "ending":
          return null;
        default:
          break;
      }
      if (!s.delivered.includes(LETTER_TO_THE_LAMP)) return new Vector3(0, 0, 0.55).applyMatrix4(mailboxMatrix);
      if (chapterForPart(s.carrying)) return shop.miloSpot.position;
      if (!s.flags.includes("seen-notebook")) return null;
      const next = MAIN_CHAPTERS.find((c) => !s.stamps.includes(c.id));
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

      const step = finaleStep(store.value);
      waitingLetter.visible = store.value.carrying === null && (!store.value.delivered.includes(LETTER_TO_THE_LAMP) || step === "mailbox");
      record.visible = step === "record-take";
      // Night comes for the Finale, over a few seconds, and stays.
      const nightTarget = store.value.flags.includes(FINALE_BEGUN) ? 1 : 0;
      night += (nightTarget - night) * damp(frame.reducedMotion ? 20 : 0.45, dt);
      if (Math.abs(night - nightTarget) < 0.002) night = nightTarget;
      sun.intensity = 1.7 * (1 - 0.5 * night);
      fill.intensity = 1.8 * (1 - 0.35 * night);
      // Earned domes glow; the next one breathes softly to say "here".
      const nextChapter = opened() ? MAIN_CHAPTERS.find((c) => !store.value.stamps.includes(c.id)) : undefined;
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
        // A friend played by a real player in the room is not also waiting here.
        const away = presence.kids.has(kid.id);
        kid.root.visible = !away;
        (kid.root.userData["body"] as { radius: number }).radius = away ? 0.001 : 0.28;
        if (away) continue;
        kid.lookAt(inside && kid.root.position.distanceTo(feet) < 4.5 ? head : null);
        kid.update(dt, { pace: 0, running: false, grounded: true, verticalSpeed: 0, sinceLanding: 10, landingSpeed: 0, carrying: false }, frame.reducedMotion);
      }
      motes.update(dt, frame.reducedMotion);
      fireflies.update(dt, frame.reducedMotion);
      hillFlies.update(dt, frame.reducedMotion);
      smoke.update(dt, frame.reducedMotion);
      places.update(dt, frame.time, frame.reducedMotion);
      if (firstFrame) {
        firstFrame = false;
        lampPower = lampWaits() ? 0 : 1;
        pinGlow = pinsLit() ? 1 : 0;
      }
      // The lamp waits dark in a new story, then clicks on when Remi first walks in.
      if (lampWaits()) {
        if (lampClick < 0) lampPower = 0;
        if (inside && lampClick < 0) lampClick = 0;
      }
      if (lampClick >= 0) {
        lampClick += dt;
        if (lampClick > 0.7 && lampPower === 0) {
          bus.emit("sfx", { name: "lamp-click", at: [shop.lampBulb.x, shop.lampBulb.y, shop.lampBulb.z] });
          store.update((s) => {
            if (!s.flags.includes(LAMP_ON)) s.flags.push(LAMP_ON);
          });
          lampPower = 0.001;
        }
        if (lampPower > 0) lampPower = Math.min(1, lampPower + dt * (frame.reducedMotion ? 10 : 2.2));
        if (lampClick > 1.6 && lampClick - dt <= 1.6) bus.emit("say", { speaker: "remi", name: "Remi", text: "It turned on by itself!", at: null });
        if (lampClick > 4.4 && lampClick - dt <= 4.4) {
          const b = shop.lampBulb;
          bus.emit("say", { speaker: "dad", name: "Dad's note", text: "I made it turn on by itself. So you never come home to a dark workshop.", at: [b.x, b.y + 0.3, b.z] });
        }
        if (lampClick > 5) lampClick = -1;
      }
      for (const part of shop.lampGlow) part.visible = lampPower > 0;
      // Remi's museum shelf: a keepsake and a photo for every stamp so far.
      for (const item of shop.museum.items) item.object.visible = store.value.stamps.includes(item.stamp);
      // The bonus dome: the cloth slides off the first time Remi comes in after it opens.
      const bonusReady = bonusOpen(store.value);
      const cover = shop.bonusDome.cover;
      if (!bonusReady) {
        cover.visible = true;
        cover.position.copy(coverHome);
        cover.scale.setScalar(1);
      } else if (!store.value.flags.includes(BONUS_SEEN)) {
        if (coverFall < 0 && inside) coverFall = 0;
        if (coverFall >= 0) {
          coverFall += dt * (frame.reducedMotion ? 4 : 1);
          const t = Math.min(1, coverFall / 1.1);
          // It is whisked up and away, like a magician's cloth.
          cover.position.copy(coverHome).addScaledVector(shedDir, 0.35 * t);
          cover.scale.set(1 - 0.9 * t * t, 1 + 0.4 * t - 1.3 * t * t, 1 - 0.9 * t * t);
          cover.visible = t < 0.98;
          if (coverFall > 0.5 && coverFall - dt <= 0.5) bus.emit("sfx", { name: "envelope-pickup", at: [coverHome.x, coverHome.y, coverHome.z] });
          if (coverFall > 1.4) {
            store.update((s) => void (s.flags.includes(BONUS_SEEN) || s.flags.push(BONUS_SEEN)));
            const top = shop.bonusDome.top;
            bus.emit("say", { speaker: "remi", name: "Remi", text: "Dad's cloth fell off a dome. There's a new world under it!", at: [top.x, top.y + 0.3, top.z] });
            coverFall = -1;
          }
        }
      } else cover.visible = false;
      const bonusDone = store.value.stamps.includes(BONUS.id);
      bonusRing.visible = opened() && bonusReady && store.value.flags.includes(BONUS_SEEN);
      {
        const pulse = !bonusDone && !frame.reducedMotion ? 0.55 + 0.45 * Math.sin(frame.time * 2.4 + 1) : 1;
        (bonusRing.material as { color: Color }).color.setRGB(1 * pulse, 0.78 * pulse, 0.46 * pulse);
      }
      // The lamp breathes a little, like a real filament.
      lampLight.intensity = lampPower * (5.5 + (frame.reducedMotion ? 0 : Math.sin(frame.time * 3.1) * 0.2));
      // The pins on Dad's globes light up one by one when the prologue's stamp comes.
      if (pinsLit() && pinGlow === 0 && pinPop < 0) pinPop = 0;
      if (pinPop >= 0) {
        pinPop += dt;
        pinGlow = Math.min(1, pinPop / (0.5 + shop.pins.length * 0.35));
        if (pinPop > 0.6 + shop.pins.length * 0.35) pinPop = -1;
      }
      shop.pins.forEach((pin, i) => {
        const k = pinPop >= 0 ? Math.max(0, Math.min(1, (pinPop - 0.3 - i * 0.35) / 0.35)) : pinGlow;
        const pop = pinPop >= 0 && k > 0 && k < 1 ? 1 + Math.sin(k * Math.PI) * 0.6 : 1;
        (pin.head.material as MeshBasicMaterial).color.set(k > 0 ? pin.color : "#8C8173");
        pin.head.scale.setScalar(0.016 * pop);
        const breathe = frame.reducedMotion ? 0.5 : 0.5 + Math.sin(frame.time * 2.2 + i) * 0.2;
        (pin.halo.material as MeshBasicMaterial).opacity = k * 0.35 * breathe * 2;
      });
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
        if (o instanceof Mesh && (o.name.startsWith("batch") || o.name === "paths" || o.name === "planet")) o.geometry.dispose();
      });
      textures.moon.dispose();
      textures.mars.dispose();
      interactions.clear();
    },
  };
  return world;
}
