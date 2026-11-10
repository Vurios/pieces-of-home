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
import type { Bookmark, FrameInfo, World, WorldContext } from "../types";
import { C, buildDish, buildHouse, buildLampPost, buildMailbox } from "./buildings";
import { HILL, HILL_TOP, HOME_RADIUS, MAILBOX, PATH_HALF_WIDTH, POND, SITES, TERRAIN, local, site } from "./layout";
import { buildGarden, buildMeadow, buildPond, groundMatrix, pathDistance, planTrees, scatterNature, treeShade } from "./nature";
import { SHED, buildWorkshop, workshopMaterials } from "./workshop";
import { buildGardenYard, buildHilltop, buildHouseYard, buildShedYard, buildSolarPanel } from "./yard";

export const LETTER_TO_THE_LAMP = "to-the-lamp";

const GRASS_A = new Color("#7FA37A");
const GRASS_B = new Color("#668C66");
const GRASS_WARM = new Color("#9DAF74");
const PATH = new Color("#C9A97E");
const PATH_EDGE = new Color("#A88E68");
const DIRT = new Color("#B3926C");
const MUD = new Color("#7E6B55");
const scratch = new Color();

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
  const planetGeometry = buildPlanetGeometry(terrain, quality.terrainDetail, (dir, _r, normal, out) => {
    const n = fbm3(dir.x * 5, dir.y * 5, dir.z * 5, 2, 3);
    const fine = fbm3(dir.x * 19, dir.y * 19, dir.z * 19, 2, 5);
    out.copy(GRASS_A).lerp(GRASS_B, Math.max(0, Math.min(1, 0.5 + n * 1.4)));
    if (fine > 0.32) out.lerp(GRASS_WARM, Math.min(0.55, (fine - 0.32) * 2.5));

    const shed = angleBetween(dir, shedDir) * HOME_RADIUS;
    if (shed < 4.6) out.lerp(DIRT, Math.min(1, (4.6 - shed) / 1.2) * 0.85);

    const path = pathDistance(dir);
    if (path < PATH_HALF_WIDTH + 0.18) {
      const inner = path < PATH_HALF_WIDTH - 0.08;
      scratch.copy(inner ? PATH : PATH_EDGE);
      out.lerp(scratch, inner ? 1 : 0.8);
    }
    const pond = angleBetween(dir, POND) * HOME_RADIUS;
    if (pond < 2.9) out.lerp(MUD, Math.min(1, (2.9 - pond) / 0.6));

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
  const lampDirs = [latLonToDir(-2.2, 1.6), latLonToDir(18, 3), local(SITES.shed, 2.6, 0, 5.4).normalize()];
  for (const dir of lampDirs) {
    const m = groundMatrix(terrain, dir, 0, 0.02);
    colliders.push(createColliderGroup(m, buildLampPost(b, { dir, forward: new Vector3(), origin: new Vector3(), matrix: m })));
  }

  colliders.push(createColliderGroup(SITES.garden.matrix, buildGarden(b, SITES.garden)));
  buildPond(b, terrain);
  colliders.push(...buildMeadow(b, terrain, quality.particles));
  colliders.push(...scatterNature(b, terrain, quality.particles, trees));

  for (const mesh of b.build(workshopMaterials(toon), { castShadow: quality.shadowMap > 0, receiveShadow: true })) root.add(mesh);

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
  if (quality.tier !== "low") {
    const windowLight = new PointLight("#8FA3D9", 2.4, 5.5, 1.5);
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
  mom.root.matrix.copy(SITES.house.matrix).multiply(new Matrix4().makeTranslation(1.0, 0.66, 2.02));
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

  // ---- Bookmarks for screenshots and the title sequence ----
  const spawnDir = latLonToDir(SITES.spawn.lat, SITES.spawn.lon);
  const spawnForward = headingToTangent(spawnDir, SITES.spawn.heading);
  const wideTarget = latLonToDir(16, 10).multiplyScalar(HOME_RADIUS);
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
  const gardenSpot = latLonToDir(-8, -5);
  const shedSpot = local(SITES.shed, 0.6, 0, 7.2).normalize();
  const hillSpot = latLonToDir(HILL.lat - 7, HILL.lon - 1);
  const meadowSpot = latLonToDir(-17, 4);
  const bookmarks: Record<string, Bookmark> = {
    "play-yard": standAt(yardSpot, toward(yardSpot, SITES.house.dir)),
    "play-garden": standAt(gardenSpot, toward(gardenSpot, SITES.garden.dir)),
    "play-shed": standAt(shedSpot, toward(shedSpot, SITES.shed.dir)),
    "play-hill": standAt(hillSpot, toward(hillSpot, HILL_TOP)),
    "play-meadow": standAt(meadowSpot, toward(meadowSpot, latLonToDir(-27, -4))),
    wide: {
      player: { dir: spawnDir, forward: spawnForward },
      camera: { position: latLonToDir(-22, 12).multiplyScalar(HOME_RADIUS + 31), target: wideTarget.clone().multiplyScalar(0.5) },
    },
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
  };

  // ---- Per-frame ----
  let inside = false;
  let open = 0;
  let pixelHeight = 900;
  const surfaceAt = (dir: Vector3, onPlatform: boolean): string => {
    if (onPlatform) return "wood";
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
    bookmarks,
    surfaceAt,
    cameraHint(player) {
      if (!inside) return null;
      return { forward: shedForward.clone(), pitch: 0.78, distance: 6.4 + (player.position.length() > 0 ? 0 : 0) };
    },
    objective() {
      const s = store.value;
      if (s.carrying === LETTER_TO_THE_LAMP) return shop.lampSpot;
      if (!s.delivered.includes(LETTER_TO_THE_LAMP)) return new Vector3(0, 0, 0.55).applyMatrix4(mailboxMatrix);
      return null;
    },
    update(dt: number, frame: FrameInfo) {
      const feet = frame.player.position;
      // Hysteresis, so standing in the doorway never flickers the walls.
      if (!inside && shop.isInside(feet, -0.15)) inside = true;
      else if (inside && !shop.isInside(feet, 0.55)) inside = false;

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
      // The lamp breathes a little, like a real filament.
      lampLight.intensity = 5.5 + (frame.reducedMotion ? 0 : Math.sin(frame.time * 3.1) * 0.2);
    },
    resize(height: number) {
      pixelHeight = height;
      for (const f of [motes, fireflies, hillFlies]) f.setScale(pixelHeight);
      smoke.setScale(pixelHeight);
    },
    dispose() {
      for (const f of [motes, fireflies, hillFlies]) f.dispose();
      smoke.dispose();
      planetGeometry.dispose();
      root.traverse((o) => {
        if (o instanceof Mesh && o.name.startsWith("batch")) o.geometry.dispose();
      });
      textures.moon.dispose();
      textures.mars.dispose();
      interactions.clear();
    },
  };
  return world;
}
