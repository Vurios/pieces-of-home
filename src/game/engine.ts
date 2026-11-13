import {
  Fog,
  type Mesh,
  Matrix4,
  Quaternion,
  type LoadingManager,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Sphere,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { Character, type KidId } from "./actors/character";
import { Crew } from "./actors/crew";
import { PaperArrow, createEnvelope, createMirrorPanel, createParcel, createPartsBag, createBreezeFlag } from "./actors/props";
import { EventBus, type GameEvents, type QualityTier } from "./core/events";
import { Input } from "./core/input";
import { FrameWatchdog, QUALITY, ResolutionGovernor, type QualitySettings, detectTier, lowerTier, readDeviceHints, readTierOverride, writeTierOverride } from "./core/quality";
import { SAVE_KEY, StateStore, readStorage, writeStorage } from "./core/state";
import { Puffs } from "./render/particles";
import { PostPipeline } from "./render/post";
import { Sky } from "./render/sky";
import { behindPlanet } from "./render/kit";
import { ToonLibrary } from "./render/toon";
import { TRIP_LOOK, TripScene } from "./render/trip";
import { FollowCamera } from "./world/camera";
import { PlayerController } from "./world/controller";
import { InteractionSystem } from "./world/interaction";
import { headingToTangent, latLonToDir, projectOnTangent } from "./world/sphere";
import { TitleSequence } from "./title/title";
import { WORLDS } from "./worlds/registry";
import type { Bookmark, World, WorldContext, WorldMap } from "./worlds/types";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** Show fps and draw calls. */
  debug: boolean;
  /** Fixed camera view for screenshots, from the world's bookmarks. */
  shot: string | null;
  /** Tracks texture loading for the loader's progress. */
  loading?: LoadingManager;
}

export type EngineMode = "title" | "play";

/**
 * The game engine: renderer, frame loop, the current world, the player, the
 * camera and every system that runs each frame. UI talks to it through the
 * event bus and a few public methods.
 */
export class Engine {
  readonly bus: EventBus<GameEvents> = new EventBus();
  readonly store = new StateStore();
  readonly input: Input;
  readonly interactions: InteractionSystem;
  quality: QualitySettings;
  autoQuality: boolean;
  world: World | null = null;
  /** "title" while the opening plays; the player cannot move. */
  mode: EngineMode = "play";
  /** True while the notebook, settings or a menu is open: the world keeps living, the player stands still. */
  paused = false;
  /** Called each frame after the camera moves, so sound can follow the lens (see src/audio/audio.ts). */
  onFrame: ((frame: { camera: PerspectiveCamera; player: Vector3; world: World; mode: EngineMode }) => void) | null = null;
  private title: TitleSequence | null = null;
  private motionPreference: boolean | null = null;
  private systemReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(40, 1, 0.5, 160);
  /** The named place the player stands in, or null. */
  private zone: string | null = null;
  private toon = new ToonLibrary();
  private post: PostPipeline;
  private sky: Sky | null = null;
  private player: PlayerController;
  private kid: Character;
  /** Friends in a co-op room (Phase 06). Empty when playing solo. */
  readonly crew: Crew;
  private riding = false;
  private envelope;
  /** What a player carries, by the start of the carried id: letters, Milo's parts, mirror panels. */
  private carried: { prefix: string; model: import("three").Object3D }[];
  private follow: FollowCamera;
  private arrow = new PaperArrow();
  private puffs: Puffs;
  private timer = new Timer();
  private watchdog = new FrameWatchdog();
  private governor = new ResolutionGovernor();
  /**
   * Resolution and tier changes wait for the start of the next drawn frame.
   * Resizing the canvas clears it, so a change made after drawing would show
   * one black frame: the flicker players saw.
   */
  private pendingScale = false;
  private pendingTier: QualityTier | null = null;
  private textureLoader: TextureLoader;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private bookmark: Bookmark | null = null;
  private statsTime = 0;
  private frames = 0;
  /** How long the last world render took on the main thread, in ms, and when it ran. */
  /**
   * True while the paper loader covers the canvas. The world is drawn a few
   * times to warm up shaders and textures, then not at all until the loader
   * lifts, so the loader and its controls stay smooth on a slow device.
   */
  veiled = false;
  private warmFrames = 4;
  private renderCost = 0;
  private lastRender = 0;
  private saveTimer = 0;
  private running = false;
  private elapsed = 0;
  private readonly sunDir = new Vector3();
  /** A short cinematic view and when it started, blended over the follow camera. */
  private cine: { position: Vector3; target: Vector3; up: Vector3; seconds: number; age: number } | null = null;
  private readonly cineQuat = new Quaternion();
  private readonly cineMatrix = new Matrix4();
  /**
   * The closing shot: the camera lifts away from Remi until the whole little
   * world shows against the stars, then turns slowly around it. `weight`
   * eases it in over the follow camera and back out when it ends.
   */
  private farewell: { on: boolean; age: number; weight: number; back: Vector3 } | null = null;
  private readonly farewellPos = new Vector3();
  private readonly farewellTarget = new Vector3();
  /** The 3D trip between worlds (render/trip.ts), built once on first use. */
  private trip: TripScene | null = null;
  /** True while the trip is on screen instead of a world. */
  private tripping = false;
  /** While the light closes at the end of a trip, it closes on the world ahead. */
  private irisOnTrip = false;
  private readonly scratch = new Vector3();

  static create(options: EngineOptions): Engine | null {
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: options.canvas, antialias: false, powerPreference: "high-performance", stencil: false });
    } catch {
      return null;
    }
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose();
      return null;
    }
    // Asking the driver whether each shader compiled stalls until it has. Only worth it while building.
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    return new Engine(renderer, options);
  }

  private constructor(
    renderer: WebGLRenderer,
    private options: EngineOptions,
  ) {
    this.renderer = renderer;
    this.textureLoader = new TextureLoader(options.loading);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.info.autoReset = false;

    const override = readTierOverride();
    this.autoQuality = override === null;
    const tier: QualityTier = override ?? detectTier(readDeviceHints(renderer.getContext()));
    this.quality = QUALITY[tier];
    this.governor.reset();
    this.applyRendererQuality();
    this.post = new PostPipeline(renderer, this.quality);
    this.post.setReducedMotion(this.reducedMotion);

    this.store.load(readStorage(SAVE_KEY));
    this.store.subscribe(() => {
      this.saveTimer = 0.4;
    });

    this.input = new Input(options.canvas, this.bus);
    this.interactions = new InteractionSystem(this.bus);
    this.player = new PlayerController(this.bus);
    this.kid = new Character("remi", this.toon);
    this.envelope = createEnvelope(this.toon);
    this.envelope.visible = false;
    this.kid.carrySocket.add(this.envelope);
    this.carried = [
      { prefix: "part:", model: createParcel(this.toon) },
      { prefix: "mirror:", model: createMirrorPanel(this.toon) },
      { prefix: "flag:", model: carriedFlag(createBreezeFlag(this.toon)) },
      { prefix: "bag:", model: createPartsBag(this.toon) },
    ];
    for (const { model } of this.carried) {
      model.visible = false;
      this.kid.carrySocket.add(model);
    }
    this.follow = new FollowCamera(this.camera);
    this.puffs = new Puffs(Math.round(90 * this.quality.particles) + 10, "#D8C3A0");
    this.crew = new Crew(this.toon);
    this.scene.add(this.kid.root, this.arrow.root, this.puffs.points, this.crew.root);

    this.bus.on("player:step", ({ running }) => {
      this.scratch.copy(this.player.position).addScaledVector(this.player.forward, -0.1);
      this.puffs.emit(this.scratch, this.player.up, running ? 3 : 2, running ? 0.9 : 0.6);
    });
    this.bus.on("player:land", ({ speed }) => {
      if (speed > 3) this.puffs.emit(this.player.position, this.player.up, Math.min(10, Math.round(speed)), Math.min(2, speed * 0.2));
    });
    this.bus.on("dust:puff", ({ at, count, spread }) => {
      this.scratch.set(at[0], at[1], at[2]);
      this.puffs.emit(this.scratch, this.scratch.clone().normalize(), count, spread);
    });
    this.bus.on("interact:done", () => this.kid.play("interact"));
    this.bus.on("camera:cinematic", ({ position, target, up, seconds }) => {
      this.cine = { position: new Vector3(...position), target: new Vector3(...target), up: up ? new Vector3(...up) : new Vector3(...position).normalize(), seconds, age: 0 };
    });
    this.bus.on("letter:delivered", () => this.kid.play("celebrate"));
    this.bus.on("travel:skip", () => {
      if (this.tripping) this.trip?.skip();
    });
    this.bus.on("camera:farewell", ({ on }) => {
      if (on) {
        // "Back" is away from where the camera looks, flat on the ground, so the lift starts behind Remi.
        const back = projectOnTangent(this.camera.position.clone().sub(this.player.position), this.player.up, new Vector3());
        if (back.lengthSq() < 1e-6) back.set(0, 0, 1);
        this.farewell = { on: true, age: 0, weight: this.farewell?.weight ?? 0, back: back.normalize() };
      } else if (this.farewell) this.farewell.on = false;
    });

    window.addEventListener("resize", this.onWindowResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.flushSave);
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
      this.systemReducedMotion = event.matches;
      this.applyMotion();
    });
    this.resize();
  }

  /** Settings: true or false forces reduced motion; null follows the system. */
  setReducedMotion(preference: boolean | null): void {
    this.motionPreference = preference;
    this.applyMotion();
  }

  get motionReduced(): boolean {
    return this.reducedMotion;
  }

  private applyMotion(): void {
    this.reducedMotion = this.motionPreference ?? this.systemReducedMotion;
    this.post.setReducedMotion(this.reducedMotion);
  }

  /**
   * Starts the opening: the camera flies from the lamp to the title and the
   * letters drop in. Returns false if the world has no intro.
   */
  startTitle(): boolean {
    const intro = this.world?.intro;
    if (!intro) return false;
    this.title?.dispose();
    this.title = new TitleSequence(this.toon, intro, this.bus, this.reducedMotion);
    this.scene.add(this.title.root);
    this.mode = "title";
    this.world?.setPower(0.2);
    return true;
  }

  /** Starts the flight. Until then the camera waits on the lamp, behind the loading page. */
  playTitle(): void {
    this.title?.play();
  }

  /** Skips the flight and the falling letters. */
  skipTitle(): void {
    this.title?.skip();
  }

  titleDrag(amount: number): void {
    this.title?.drag(amount);
  }

  titleRelease(): void {
    this.title?.release();
  }

  /** Pulls the chain: the bulb blazes and the windows light up. */
  titleBegin(): void {
    this.title?.begin();
  }

  /** Flies down to the player and hands over control. */
  leaveTitle(): void {
    if (!this.title) {
      this.mode = "play";
      return;
    }
    this.follow.snap(this.player);
    this.title.leave(this.camera);
  }

  /** Where the title's BEGIN tag is on screen, in CSS pixels. */
  titleTag(): { x: number; y: number; visible: boolean } | null {
    return this.title ? this.title.tagScreen(this.camera, window.innerWidth, window.innerHeight) : null;
  }

  get titlePhase(): string | null {
    return this.title?.phase ?? null;
  }

  /** A world point on screen, in CSS pixels. `visible` is false behind the camera or off screen. */
  project(point: Vector3): { x: number; y: number; visible: boolean } {
    const p = this.scratch.copy(point).project(this.camera);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    return { x, y, visible: p.z < 1 && p.z > -1 && x > -40 && y > -40 && x < window.innerWidth + 40 && y < window.innerHeight + 40 };
  }

  /**
   * For Dad's map: the world's map, where Remi stands, which way the camera
   * looks along the ground, and the next stop. Null in a world with no map.
   */
  /**
   * What the maps need, read fresh each call. The corner map asks every frame, so
   * the answer reuses the same vectors: callers copy what they keep.
   */
  mapView(): { map: WorldMap; worldId: string; up: Vector3; facing: Vector3; heading: Vector3; objective: Vector3 | null } | null {
    const world = this.world;
    if (!world?.map) return null;
    const v = this.mapAnswer;
    v.up.copy(this.player.up);
    this.camera.getWorldDirection(v.facing);
    projectOnTangent(v.facing, v.up, v.facing);
    if (v.facing.lengthSq() < 1e-6) v.facing.copy(this.player.forward);
    v.facing.normalize();
    v.heading.copy(this.player.forward);
    const objective = world.objective();
    return { map: world.map, worldId: world.id, up: v.up, facing: v.facing, heading: v.heading, objective: objective ? v.objective.copy(objective) : null };
  }
  private readonly mapAnswer = { up: new Vector3(), facing: new Vector3(), heading: new Vector3(), objective: new Vector3() };

  /** Which kid the local player plays: Remi solo, or the kid picked in a co-op room. */
  get playerKid(): KidId {
    return this.kid.id;
  }

  /** Plays another kid (co-op character select). The carried things move to the new kid's hands. */
  setPlayerKid(id: KidId): void {
    if (this.kid.id === id) return;
    const next = new Character(id, this.toon);
    next.carrySocket.add(this.envelope);
    for (const { model } of this.carried) next.carrySocket.add(model);
    next.setSuit(this.world?.suits === true);
    next.root.matrix.copy(this.kid.root.matrix);
    next.root.matrix.decompose(next.root.position, next.root.quaternion, next.root.scale);
    this.scene.remove(this.kid.root);
    this.scene.add(next.root);
    this.kid = next;
    this.bus.emit("player:kid", { kid: id });
  }

  /**
   * Where the local player stands, for co-op: position, facing, pace and a
   * few bits (1 carrying, 2 seated), rounded small for the wire.
   */
  motionSample(): { world: string | null; data: [number, number, number, number, number, number, number, number]; pace: number } {
    const p = this.player.position;
    const f = this.player.forward;
    const r = (n: number, k = 100): number => Math.round(n * k) / k;
    const bits = (this.store.value.carrying !== null ? 1 : 0) | (this.riding ? 2 : 0);
    return { world: this.world?.id ?? null, data: [r(p.x), r(p.y), r(p.z), r(f.x, 1000), r(f.y, 1000), r(f.z, 1000), r(this.player.pace), bits], pace: this.player.pace };
  }

  /** Puts the player next to a point (a friend), with a soft puff of light: how a late joiner arrives. */
  arriveNear(point: Vector3): void {
    const world = this.world;
    if (!world) return;
    const up = point.clone().normalize();
    const side = projectOnTangent(new Vector3(1, 0.3, 0.2), up, new Vector3());
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    const stand = point.clone().add(side.setLength(1.1)).normalize();
    this.player.teleport(stand, side.clone().negate().normalize(), world);
    this.follow.snap(this.player);
    this.puffs.emit(this.player.position, this.player.up, 14, 1.2);
  }

  /** The player's head in world space, for speech bubbles. */
  playerHead(): Vector3 {
    return this.player.position.clone().addScaledVector(this.player.up, 1.5);
  }

  /** The canvas as an image, for photo mode. Renders a fresh frame first so the buffer is full. */
  snapshot(type = "image/jpeg", quality = 0.85): string {
    // The drawing buffer clears after each frame, so draw one now and read it before it does.
    this.post.render(this.scene, this.camera, this.elapsed);
    return this.renderer.domElement.toDataURL(type, quality);
  }

  private applyRendererQuality(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio) * this.governor.scale);
    this.renderer.shadowMap.enabled = this.quality.shadowMap > 0;
    this.renderer.shadowMap.type = PCFShadowMap;
  }

  /** Sets the tier by hand (from Settings), or null to go back to automatic. */
  setQuality(tier: QualityTier | null): void {
    writeTierOverride(tier);
    this.autoQuality = tier === null;
    const next = tier ?? detectTier(readDeviceHints(this.renderer.getContext()));
    this.changeTier(next, this.autoQuality);
  }

  private changeTier(tier: QualityTier, auto: boolean): void {
    if (tier === this.quality.tier) return;
    this.quality = QUALITY[tier];
    this.governor.reset();
    this.applyRendererQuality();
    this.post.dispose();
    this.post = new PostPipeline(this.renderer, this.quality);
    this.post.setReducedMotion(this.reducedMotion);
    if (this.world) this.post.setLook(this.world.look);
    if (this.world) this.world.sun.castShadow = this.quality.shadowMap > 0;
    this.resize();
    this.watchdog.reset();
    this.bus.emit("quality:change", { tier, auto });
  }

  private loadTexture = (url: string): Texture => this.textureLoader.load(url);

  /**
   * Builds a world and stands the player in it. `announce` sends "world:ready"
   * at once; a trip sends it later, when the travel screen lifts, so the
   * story starts in sight.
   */
  async loadWorld(id: string, entry?: string, announce = true): Promise<void> {
    const load = WORLDS[id];
    if (!load) throw new Error(`Unknown world "${id}"`);
    this.bus.emit("world:loading", { id });
    const factory = await load();
    const ctx: WorldContext = {
      toon: this.toon,
      quality: this.quality,
      bus: this.bus,
      store: this.store,
      interactions: this.interactions,
      loadTexture: this.loadTexture,
    };
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.dispose();
    }
    const world = await factory(ctx);
    this.world = world;
    this.scene.add(world.root);
    world.root.updateMatrixWorld(true);
    this.horizon = [];
    world.root.traverse((o) => {
      if (o.userData["horizon"] && (o as Mesh).isMesh) this.horizon.push(o as Mesh);
    });

    if (this.sky) this.sky.set(world.sky);
    else {
      this.sky = new Sky(world.sky, Math.round(420 * this.quality.particles) + 80, this.renderer.getPixelRatio());
      this.scene.add(this.sky.group);
    }
    this.post.setLook(world.look);
    this.scene.fog = world.fog ? new Fog(world.fog.color, world.fog.near, world.fog.far) : null;
    this.puffs.setColor(world.dustColor);
    this.kid.setSuit(world.suits === true);
    this.crew.setSuits(world.suits === true);
    world.resize(this.renderer.domElement.height);

    this.bookmark = this.options.shot ? (world.bookmarks[this.options.shot] ?? null) : null;
    const start = this.bookmark?.player ?? (entry ? world.entries?.[entry] : undefined) ?? world.spawn;
    this.player.teleport(start.dir, start.forward, world);
    this.follow.snap(this.player);
    if (this.options.shot === "character") this.follow.pitch = 0.32;
    if (this.store.value.world !== id) {
      this.store.update((s) => {
        s.world = id;
      });
    }
    if (announce) this.bus.emit("world:ready", { id });
  }

  /** Wedges of the world that can hide behind its curve (see `Batcher.build`). */
  private horizon: Mesh[] = [];
  private cullSphere = new Sphere();

  /** Shows only the wedges of the world that are not wholly behind the planet. */
  private cullHorizon(world: World): void {
    if (this.horizon.length === 0) return;
    // A little inside the lowest ground (crater floors, the pond), so the test never hides too much.
    const occluder = world.terrain.radius - 1.2;
    const eye = this.camera.position;
    for (const mesh of this.horizon) {
      const s = this.cullSphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
      mesh.visible = !behindPlanet(eye, occluder, s.center, s.radius);
    }
  }

  /**
   * Starts compiling every shader the world could use, hidden things included
   * (carried props, story pieces), so nothing compiles the first time it shows.
   */
  private prepareShaders(): Promise<void> {
    const hidden: { visible: boolean }[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    try {
      this.renderer.compile(this.scene, this.camera);
    } finally {
      for (const o of hidden) o.visible = false;
    }
    return this.renderer.compileAsync(this.scene, this.camera).then(
      () => undefined,
      () => undefined,
    );
  }

  /** True while the iris is closed and a world is loading. */
  traveling = false;
  /** How many full-screen story screens (the star map, the last page) are up. The player stands still under them. */
  holdStill = 0;

  /** Closes the Looking Lamp iris, swaps worlds, and opens it again. */
  /**
   * Carries Remi to another little world. The lamp light closes on the world
   * here, the next world loads behind the light, and then the light opens on
   * the trip: the two little worlds in the night and the lamp's light flying
   * between them (render/trip.ts). As the light reaches the world ahead, it
   * closes on it, and opens again on the world itself. With reduced motion,
   * there is no flight: the light closes, holds a moment and opens.
   */
  async travel(id: string, entry?: string): Promise<void> {
    if (this.traveling) return;
    this.traveling = true;
    const from = this.world?.id ?? null;
    try {
      this.bus.emit("travel:start", { from, to: id });
      this.post.irisCenter.set(0.5, 0.5);
      await this.animateIris(0, 1, 0.7);
      const shut = performance.now();
      await this.loadWorld(id, entry, false);
      // Compile the new world's shaders while the light is still shut, so it opens smoothly.
      await this.prepareShaders();
      if (this.reducedMotion) {
        const hold = 400 - (performance.now() - shut);
        if (hold > 0) await new Promise((resolve) => window.setTimeout(resolve, hold));
      } else {
        const trip = this.ensureTrip();
        trip.begin(from, id);
        this.post.setLook(TRIP_LOOK);
        this.tripping = true;
        this.bus.emit("travel:flight", { from, to: id });
        await this.animateIris(1, 0, 0.5);
        await this.until(() => trip.progress >= trip.closeAt || !this.tripping);
        this.irisOnTrip = true;
        await this.animateIris(0, 1, 0.55);
        this.irisOnTrip = false;
        this.tripping = false;
        if (this.world) this.post.setLook(this.world.look);
        this.post.irisCenter.set(0.5, 0.5);
      }
      this.bus.emit("travel:arrive", { to: id });
      this.bus.emit("world:ready", { id });
      await this.animateIris(1, 0, 0.8);
    } finally {
      if (this.tripping) {
        this.tripping = false;
        if (this.world) this.post.setLook(this.world.look);
      }
      this.irisOnTrip = false;
      this.traveling = false;
      // Always, even if loading failed, so the travel screen never stays up.
      this.post.iris = 0;
      this.post.irisCenter.set(0.5, 0.5);
      this.bus.emit("travel:end", { to: id });
    }
  }

  /** The closing shot (see `farewell`). */
  private farewellShot(dt: number, world: World): void {
    const f = this.farewell!;
    f.age += dt;
    const fade = this.reducedMotion ? 0.3 : 1.6;
    f.weight = f.on ? Math.min(1, f.weight + dt / fade) : Math.max(0, f.weight - dt / fade);
    if (!f.on && f.weight <= 0) {
      this.farewell = null;
      return;
    }
    const R = world.terrain.radius;
    const up = this.player.up;
    // The lift: from just behind Remi to far enough out that the whole little world shows.
    const lift = this.reducedMotion ? 1 : Math.min(1, f.age / 6.5);
    const k = lift * lift * (3 - 2 * lift);
    const spin = this.reducedMotion ? 0 : Math.max(0, f.age - 2.5) * 0.04;
    const tilt = 0.95 - 0.4 * k;
    const side = this.scratch.crossVectors(up, f.back).normalize();
    const around = f.back.clone().multiplyScalar(Math.cos(spin)).addScaledVector(side, Math.sin(spin));
    const dir = up.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(around, Math.sin(tilt)).normalize();
    const distance = R + 7 + (R * 2.3 - 7) * k;
    this.farewellPos.copy(dir).multiplyScalar(distance);
    this.farewellTarget.copy(this.player.position).addScaledVector(up, 1.1).lerp(up.clone().multiplyScalar(R * 0.62), k);
    this.cineMatrix.lookAt(this.farewellPos, this.farewellTarget, up);
    this.cineQuat.setFromRotationMatrix(this.cineMatrix);
    const w = f.weight * f.weight * (3 - 2 * f.weight);
    this.camera.position.lerp(this.farewellPos, w);
    this.camera.quaternion.slerp(this.cineQuat, w);
  }

  private ensureTrip(): TripScene {
    if (!this.trip) {
      this.trip = new TripScene(this.toon);
      this.trip.resize(window.innerWidth, window.innerHeight);
    }
    return this.trip;
  }

  /** Resolves on the first animation frame where the test passes. */
  private until(test: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const step = (): void => {
        if (test()) resolve();
        else requestAnimationFrame(step);
      };
      step();
    });
  }

  private animateIris(from: number, to: number, seconds: number): Promise<void> {
    const duration = this.reducedMotion ? 0.15 : seconds;
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (): void => {
        const t = Math.min(1, (performance.now() - start) / (duration * 1000));
        const eased = t * t * (3 - 2 * t);
        this.post.iris = from + (to - from) * eased;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }

  /**
   * Compiles every shader the opening needs, without drawing a frame, so the
   * first frames after the light comes on are quick and the page stays
   * responsive while it waits.
   */
  async warm(): Promise<void> {
    try {
      await this.prepareShaders();
      // The trip's shaders too, so the first trip never stutters, but later and without
      // holding up the light: nobody can travel in the first few seconds.
      if (!this.reducedMotion) {
        window.setTimeout(() => {
          const trip = this.ensureTrip();
          trip.begin("home", "tranquility");
          void this.renderer.compileAsync(trip.scene, trip.camera).catch(() => undefined);
        }, 4000);
      }
    } catch {
      // Older drivers without parallel compile simply compile on first draw.
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    this.renderer.setAnimationLoop(this.frame);
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /** Writes a waiting save at once (the tab is hiding or closing, so no frame will come). */
  private flushSave = (): void => {
    if (this.saveTimer <= 0) return;
    this.saveTimer = 0;
    writeStorage(SAVE_KEY, this.store.serialize());
  };

  private onVisibility = (): void => {
    if (document.hidden) this.flushSave();
    if (document.hidden) this.renderer.setAnimationLoop(null);
    else if (this.running) {
      this.timer.reset();
      this.renderer.setAnimationLoop(this.frame);
    }
  };

  private onWindowResize = (): void => {
    this.pendingScale = true;
  };

  private resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Portrait screens get a slightly wider lens so the planet still fits.
    this.camera.fov = this.camera.aspect < 0.8 ? 52 : 40;
    this.camera.userData["baseFov"] = this.camera.fov;
    this.camera.updateProjectionMatrix();
    const ratio = this.renderer.getPixelRatio();
    this.post.setSize(width * ratio, height * ratio);
    this.puffs.setScale(height * ratio);
    this.world?.resize(height * ratio);
    this.trip?.resize(width, height);
  };

  private frame = (time: number): void => {
    this.timer.update(time);
    const dt = Math.min(0.05, this.timer.getDelta());
    this.elapsed += dt;
    this.toon.uniforms.uPohTime.value = this.elapsed;
    this.toon.uniforms.uPohWind.value = this.reducedMotion ? 0 : 0.06;
    const world = this.world;
    if (!world) return;
    // Under the notebook or a panel the world stands still. On a slow device a
    // full render can take longer than a frame, which starves the 2D layer and
    // the gamepad on top, so the frozen world is redrawn only now and then.
    // Under the notebook or a panel the frozen world needs only a few frames a second.
    if (this.paused && !this.bookmark && time - this.lastRender < Math.max(100, this.renderCost * 4)) {
      this.afterFrame(dt);
      return;
    }
    if (this.veiled) {
      if (this.warmFrames <= 0) {
        this.afterFrame(dt);
        return;
      }
      this.warmFrames -= 1;
    }
    if (this.pendingTier) {
      const tier = this.pendingTier;
      this.pendingTier = null;
      this.changeTier(tier, true);
    }
    if (this.pendingScale) {
      this.pendingScale = false;
      this.applyRendererQuality();
      this.resize();
    }
    this.renderer.info.reset();

    // Between worlds, the trip is drawn instead of a world. It runs on the real clock,
    // so a slow device sees fewer frames of it, never a longer trip.
    if (this.tripping && this.trip) {
      const trip = this.trip;
      trip.update(Math.min(0.25, this.timer.getDelta()), this.reducedMotion);
      if (this.irisOnTrip) trip.targetOnScreen(this.post.irisCenter);
      this.post.focus = 0.5;
      this.post.render(trip.scene, trip.camera, this.elapsed);
      this.afterFrame(dt);
      return;
    }

    const input = this.input.read();
    const shot = this.bookmark;
    const titling = this.mode === "title" && this.title !== null;
    if (shot || titling || this.paused || this.traveling || this.holdStill > 0) {
      // Screenshot mode: nobody moves.
      input.moveX = 0;
      input.moveY = 0;
      input.jumpPressed = false;
      input.lookX = 0;
      input.lookY = 0;
      input.zoom = 0;
      if (this.holdStill > 0) {
        input.interactPressed = false;
        input.interactHeld = false;
      }
    }

    // Movement is relative to the camera's flattened heading. In a ride, the world moves the player.
    const riding = !shot && !titling && (world.ride?.(dt, input, this.player) ?? false);
    this.riding = riding;
    if (!riding) this.player.update(dt, input, this.follow.forward, this.follow.right, world);
    world.update(dt, { player: this.player, carrying: this.store.value.carrying, time: this.elapsed, reducedMotion: this.reducedMotion });
    this.interactions.update(dt, this.player.position, this.player.forward, input);
    // Which named place the player is in, for the place-name card.
    const zone = shot || titling || !world.zoneAt ? null : world.zoneAt(this.player.up);
    if (zone !== this.zone) {
      this.zone = zone;
      this.bus.emit("player:zone", { zone });
    }

    // Character pose on the sphere.
    const kid = this.kid.root;
    kid.matrix.makeBasis(this.scratch.crossVectors(this.player.up, this.player.forward).normalize(), this.player.up, this.player.forward);
    kid.matrix.setPosition(this.player.position);
    kid.matrix.decompose(kid.position, kid.quaternion, kid.scale);
    const carrying = this.store.value.carrying;
    let other = false;
    for (const { prefix, model } of this.carried) {
      model.visible = carrying !== null && carrying.startsWith(prefix);
      other ||= model.visible;
    }
    this.envelope.visible = carrying !== null && !other;
    this.kid.update(dt, {
      pace: this.player.pace,
      running: this.player.running,
      grounded: this.player.grounded,
      verticalSpeed: this.player.verticalSpeed,
      sinceLanding: this.player.sinceLanding,
      landingSpeed: this.player.landingSpeed,
      carrying: this.store.value.carrying !== null,
      seated: riding,
    }, this.reducedMotion);
    this.crew.update(dt, this.world?.id ?? null, performance.now(), this.reducedMotion);

    // Camera.
    if (shot?.camera) {
      this.camera.position.copy(shot.camera.position);
      this.camera.up.copy(shot.camera.up ?? shot.camera.target).normalize();
      this.camera.lookAt(shot.camera.target);
    } else if (titling && this.title) {
      if (this.title.phase === "leaving") {
        this.follow.update(dt, this.player, input, world.terrain, world.cameraColliders, world.cameraHint(this.player));
      }
      this.title.update(dt, this.camera);
      if (this.title.phase === "done") {
        this.title.dispose();
        this.title = null;
        this.mode = "play";
        this.bus.emit("title:done", {});
      }
    } else {
      this.follow.update(dt, this.player, input, world.terrain, world.cameraColliders, world.cameraHint(this.player));
    }

    // A cinematic view eases in over the follow camera, holds, and eases back out.
    if (this.cine && !shot && !titling) {
      const c = this.cine;
      c.age += dt;
      const ease = this.reducedMotion ? 0.25 : 0.8;
      const w = Math.min(1, c.age / ease, Math.max(0, (c.seconds - c.age) / ease));
      const k = w * w * (3 - 2 * w);
      this.cineMatrix.lookAt(c.position, c.target, c.up);
      this.cineQuat.setFromRotationMatrix(this.cineMatrix);
      this.camera.position.lerp(c.position, k);
      this.camera.quaternion.slerp(this.cineQuat, k);
      if (c.age >= c.seconds) this.cine = null;
    }

    if (this.farewell && !shot && !titling) this.farewellShot(dt, world);

    // The low key light leans the same way wherever the player stands.
    const up = this.player.up;
    projectOnTangent(world.sunToward, up, this.scratch);
    if (this.scratch.lengthSq() < 1e-6) this.scratch.set(1, 0, 0);
    this.scratch.normalize();
    const h = world.sunHeight;
    this.sunDir.copy(up).multiplyScalar(h).addScaledVector(this.scratch, Math.sqrt(1 - h * h)).normalize();
    world.sun.position.copy(this.player.position).addScaledVector(this.sunDir, 35);
    world.sun.target.position.copy(this.player.position);
    world.sun.target.updateMatrixWorld();
    world.fill.position.copy(up);
    const liveSky = world.liveSky?.();
    if (liveSky) this.sky?.set(liveSky);
    const liveLook = world.liveLook?.();
    if (liveLook) this.post.setLook(liveLook);
    if (world.fog && this.scene.fog instanceof Fog) this.scene.fog.color.set(world.fog.color);
    this.sky?.setGlowDirection(this.sunDir);
    // A fixed shot from orbit uses the lens up, so the sky still shows its horizon glow and stars.
    this.camera.updateMatrixWorld();
    const skyUp = shot?.camera || titling ? this.scratch.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize() : up;
    this.sky?.update(this.camera.position, skyUp, this.elapsed);
    this.onFrame?.({ camera: this.camera, player: this.player.position, world, mode: this.mode });

    // Haze sits on the far curve: fog distances count from the horizon, so close ground stays clean from any height.
    if (this.scene.fog instanceof Fog && world.fog) {
      const d = this.camera.position.length();
      const radius = world.terrain.radiusAt(this.player.up);
      const horizon = Math.sqrt(Math.max(1, d * d - radius * radius));
      this.scene.fog.near = horizon + world.fog.near;
      this.scene.fog.far = horizon + world.fog.far;
    }

    this.arrow.update(dt, this.player.position, up, shot || titling ? null : world.objective(), this.reducedMotion);
    this.puffs.update(dt);

    // Keep the sharp band of the tilt-shift on the player.
    if (titling && this.title && this.title.phase !== "leaving") this.scratch.copy(this.title.focusPoint()).project(this.camera);
    else this.scratch.copy(this.player.position).addScaledVector(up, 0.6).project(this.camera);
    this.post.focus = Math.max(0.12, Math.min(0.88, this.scratch.y * 0.5 + 0.5));
    this.cullHorizon(world);
    const renderStart = performance.now();
    this.post.render(this.scene, this.camera, this.elapsed);
    this.renderCost = performance.now() - renderStart;
    this.lastRender = time;

    this.afterFrame(dt);
  };

  private afterFrame(dt: number): void {
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) writeStorage(SAVE_KEY, this.store.serialize());
    }
    if (this.autoQuality && !this.bookmark && this.mode === "play" && !this.paused) {
      if (this.governor.update(dt) !== null) this.pendingScale = true;
    }
    if (this.autoQuality && !this.bookmark && this.mode === "play" && this.quality.tier !== "low" && this.watchdog.update(dt)) {
      this.pendingTier = lowerTier(this.quality.tier);
    }
    this.frames += 1;
    this.statsTime += dt;
    if (this.options.debug && this.statsTime >= 0.5) {
      const info = this.renderer.info;
      this.bus.emit("debug:stats", {
        fps: Math.round(this.frames / this.statsTime),
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        tier: this.quality.tier,
      });
    }
    if (this.statsTime >= 0.5) {
      this.statsTime = 0;
      this.frames = 0;
    }
  }

  /** Test and debug hooks. */
  debugApi(): Record<string, unknown> {
    return {
      state: () => this.store.value,
      player: () => ({ position: this.player.position.toArray(), grounded: this.player.grounded }),
      camera: () => ({ position: this.camera.position.toArray(), forward: this.camera.getWorldDirection(new Vector3()).toArray(), cine: this.cine ? { position: this.cine.position.toArray(), target: this.cine.target.toArray(), age: this.cine.age } : null }),
      tier: () => this.quality.tier,
      mode: () => this.mode,
      titlePhase: () => this.title?.phase ?? null,
      /** The heaviest meshes in the scene, for budgeting. */
      heavy: () => {
        const rows: [string, number][] = [];
        let meshes = 0;
        this.scene.traverse((o) => {
          const g = (o as { geometry?: { index: { count: number } | null; attributes: { position: { count: number } } } }).geometry;
          if (!g || !(o as { isMesh?: boolean }).isMesh) return;
          meshes += 1;
          rows.push([o.name || o.parent?.name || "?", (g.index ? g.index.count : g.attributes.position.count) / 3]);
        });
        rows.sort((a, b) => b[1] - a[1]);
        return { meshes, top: rows.slice(0, 8) };
      },
      /** Draw calls and triangles of the last frame, every pass included. */
      stats: () => ({ calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, programs: this.renderer.info.programs?.length ?? 0 }),
      /** Names of the compiled shader programs, to catch ones that compile mid-play. */
      programs: () => (this.renderer.info.programs ?? []).map((p) => `${p.name}|${p.cacheKey}`),
      /** Meshes whose material matches a test, with their path in the scene, for debugging. */
      find: (test: (m: unknown) => boolean) => {
        const rows: string[] = [];
        this.scene.traverse((o) => {
          const m = (o as Mesh).material;
          if (m && test(m)) {
            const path: string[] = [];
            for (let p: import("three").Object3D | null = o; p; p = p.parent) path.push(`${p.name || p.type}${p.visible ? "" : "(hidden)"}`);
            rows.push(path.join(" < "));
          }
        });
        return rows;
      },
      setQuality: (tier: QualityTier | null) => this.setQuality(tier),
      /** Sends a game event, for screenshots of moments such as the stamp. */
      emit: <K extends keyof GameEvents>(type: K, payload: GameEvents[K]) => this.bus.emit(type, payload),
      travel: (id: string, entry?: string) => this.travel(id, entry),
      /** Holds the trip between two worlds still at one moment (0 to 1), for screenshots; null puts the world back. */
      tripAt: (from: string, to: string, t: number | null) => {
        if (t === null) {
          this.tripping = false;
          if (this.world) this.post.setLook(this.world.look);
          return;
        }
        const trip = this.ensureTrip();
        trip.begin(from, to);
        trip.seek(t);
        trip.frozen = true;
        this.post.setLook(TRIP_LOOK);
        this.tripping = true;
      },
      /** Runs a world's test hook, for example "solve" or "deliver". */
      world: (command: string) => this.world?.debug?.[command]?.() ?? false,
      worldId: () => this.world?.id ?? null,
      /** Changes the save directly, for tests. */
      patch: (change: Partial<{ carrying: string | null; delivered: string[]; stamps: string[]; flags: string[]; miloStage: number }>) =>
        this.store.update((s) => Object.assign(s, change)),
      /** Stands the player at a latitude and longitude, facing a compass heading (for screenshots). */
      standAt: (lat: number, lon: number, heading = 0): boolean => {
        if (!this.world) return false;
        const dir = latLonToDir(lat, lon);
        this.player.teleport(dir, headingToTangent(dir, heading), this.world);
        this.follow.snap(this.player);
        return true;
      },
      /** Stands the player next to an interactable, facing it. */
      teleportTo: (id: string): boolean => {
        const target = this.interactions.positionOf(id);
        if (!target || !this.world) return false;
        const dir = target.clone().normalize();
        const side = projectOnTangent(this.player.position.clone().sub(target), dir, new Vector3());
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        side.setLength(0.6);
        // Stand on the side away from neighbouring prompts (the domes on the bench sit close together).
        const others = this.interactions.positionsExcept(id).filter((p) => p.distanceTo(target) < 2);
        if (others.length) {
          const clearance = (offset: Vector3): number => Math.min(...others.map((p) => p.distanceTo(target.clone().add(offset))));
          let best = side.clone();
          for (let i = 1; i < 8; i += 1) {
            const turned = side.clone().applyAxisAngle(dir, (i * Math.PI) / 4);
            if (clearance(turned) > clearance(best) + 0.05) best = turned;
          }
          side.copy(best);
        }
        const stand = target.clone().add(side).normalize();
        this.player.teleport(stand, side.clone().negate(), this.world);
        this.follow.snap(this.player);
        return true;
      },
    };
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onWindowResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.flushSave);
    this.flushSave();
    this.input.dispose();
    this.world?.dispose();
    this.sky?.dispose();
    this.trip?.dispose();
    this.post.dispose();
    this.puffs.dispose();
    this.arrow.dispose();
    this.toon.dispose();
    this.renderer.dispose();
    this.bus.clear();
  }
}

/** A breeze flag held over the shoulder, its stick leaning back. */
function carriedFlag(flag: import("three").Group): import("three").Group {
  flag.scale.setScalar(0.72);
  flag.position.set(0.1, -0.42, -0.05);
  flag.rotation.set(-0.28, 0, -0.1);
  return flag;
}
