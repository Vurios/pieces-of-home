import {
  Fog,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { Character } from "./actors/character";
import { PaperArrow, createEnvelope } from "./actors/props";
import { EventBus, type GameEvents, type QualityTier } from "./core/events";
import { Input } from "./core/input";
import { FrameWatchdog, QUALITY, type QualitySettings, detectTier, lowerTier, readDeviceHints, readTierOverride, writeTierOverride } from "./core/quality";
import { SAVE_KEY, StateStore, readStorage, writeStorage } from "./core/state";
import { Puffs } from "./render/particles";
import { PostPipeline } from "./render/post";
import { Sky } from "./render/sky";
import { ToonLibrary } from "./render/toon";
import { FollowCamera } from "./world/camera";
import { PlayerController } from "./world/controller";
import { InteractionSystem } from "./world/interaction";
import { projectOnTangent } from "./world/sphere";
import { WORLDS } from "./worlds/registry";
import type { Bookmark, World, WorldContext } from "./worlds/types";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** Show fps and draw calls. */
  debug: boolean;
  /** Fixed camera view for screenshots, from the world's bookmarks. */
  shot: string | null;
}

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

  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(40, 1, 0.5, 160);
  private toon = new ToonLibrary();
  private post: PostPipeline;
  private sky: Sky | null = null;
  private player: PlayerController;
  private kid: Character;
  private envelope;
  private follow: FollowCamera;
  private arrow = new PaperArrow();
  private puffs: Puffs;
  private timer = new Timer();
  private watchdog = new FrameWatchdog();
  private textureLoader = new TextureLoader();
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private bookmark: Bookmark | null = null;
  private statsTime = 0;
  private frames = 0;
  private saveTimer = 0;
  private running = false;
  private elapsed = 0;
  private readonly sunDir = new Vector3();
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
    return new Engine(renderer, options);
  }

  private constructor(
    renderer: WebGLRenderer,
    private options: EngineOptions,
  ) {
    this.renderer = renderer;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.info.autoReset = false;

    const override = readTierOverride();
    this.autoQuality = override === null;
    const tier: QualityTier = override ?? detectTier(readDeviceHints(renderer.getContext()));
    this.quality = QUALITY[tier];
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
    this.follow = new FollowCamera(this.camera);
    this.puffs = new Puffs(Math.round(90 * this.quality.particles) + 10, "#D8C3A0");
    this.scene.add(this.kid.root, this.arrow.root, this.puffs.points);

    this.bus.on("player:step", ({ running }) => {
      this.scratch.copy(this.player.position).addScaledVector(this.player.forward, -0.1);
      this.puffs.emit(this.scratch, this.player.up, running ? 3 : 2, running ? 0.9 : 0.6);
    });
    this.bus.on("player:land", ({ speed }) => {
      if (speed > 3) this.puffs.emit(this.player.position, this.player.up, Math.min(10, Math.round(speed)), Math.min(2, speed * 0.2));
    });
    this.bus.on("interact:done", () => this.kid.play("interact"));
    this.bus.on("letter:delivered", () => this.kid.play("celebrate"));

    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
      this.reducedMotion = event.matches;
      this.post.setReducedMotion(event.matches);
    });
    this.resize();
  }

  private applyRendererQuality(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
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

  async loadWorld(id: string): Promise<void> {
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

    if (this.sky) this.sky.set(world.sky);
    else {
      this.sky = new Sky(world.sky, Math.round(420 * this.quality.particles) + 80, this.renderer.getPixelRatio());
      this.scene.add(this.sky.group);
    }
    this.post.setLook(world.look);
    this.scene.fog = world.fog ? new Fog(world.fog.color, world.fog.near, world.fog.far) : null;
    this.puffs.setColor(world.dustColor);
    world.resize(this.renderer.domElement.height);

    this.bookmark = this.options.shot ? (world.bookmarks[this.options.shot] ?? null) : null;
    const start = this.bookmark?.player ?? world.spawn;
    this.player.teleport(start.dir, start.forward, world);
    this.follow.snap(this.player);
    if (this.options.shot === "character") this.follow.pitch = 0.32;
    this.bus.emit("world:ready", { id });
  }

  /** Closes the Looking Lamp iris, swaps worlds, and opens it again. */
  async travel(id: string): Promise<void> {
    await this.animateIris(0, 1, 0.7);
    await this.loadWorld(id);
    await this.animateIris(1, 0, 0.8);
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

  private onVisibility = (): void => {
    if (document.hidden) this.renderer.setAnimationLoop(null);
    else if (this.running) {
      this.timer.reset();
      this.renderer.setAnimationLoop(this.frame);
    }
  };

  private resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Portrait screens get a slightly wider lens so the planet still fits.
    this.camera.fov = this.camera.aspect < 0.8 ? 52 : 40;
    this.camera.updateProjectionMatrix();
    const ratio = this.renderer.getPixelRatio();
    this.post.setSize(width * ratio, height * ratio);
    this.puffs.setScale(height * ratio);
    this.world?.resize(height * ratio);
  };

  private frame = (time: number): void => {
    this.timer.update(time);
    const dt = Math.min(0.05, this.timer.getDelta());
    this.elapsed += dt;
    this.toon.uniforms.uPohTime.value = this.elapsed;
    this.toon.uniforms.uPohWind.value = this.reducedMotion ? 0 : 0.06;
    const world = this.world;
    if (!world) return;
    this.renderer.info.reset();

    const input = this.input.read();
    const shot = this.bookmark;
    if (shot) {
      // Screenshot mode: nobody moves.
      input.moveX = 0;
      input.moveY = 0;
      input.jumpPressed = false;
      input.lookX = 0;
      input.lookY = 0;
    }

    // Movement is relative to the camera's flattened heading.
    this.player.update(dt, input, this.follow.forward, this.follow.right, world);
    world.update(dt, { player: this.player, carrying: this.store.value.carrying, time: this.elapsed, reducedMotion: this.reducedMotion });
    this.interactions.update(dt, this.player.position, this.player.forward, input);

    // Character pose on the sphere.
    const kid = this.kid.root;
    kid.matrix.makeBasis(this.scratch.crossVectors(this.player.up, this.player.forward).normalize(), this.player.up, this.player.forward);
    kid.matrix.setPosition(this.player.position);
    kid.matrix.decompose(kid.position, kid.quaternion, kid.scale);
    this.envelope.visible = this.store.value.carrying !== null;
    this.kid.update(dt, {
      pace: this.player.pace,
      running: this.player.running,
      grounded: this.player.grounded,
      verticalSpeed: this.player.verticalSpeed,
      sinceLanding: this.player.sinceLanding,
      landingSpeed: this.player.landingSpeed,
      carrying: this.store.value.carrying !== null,
    }, this.reducedMotion);

    // Camera.
    if (shot?.camera) {
      this.camera.position.copy(shot.camera.position);
      this.camera.up.copy(shot.camera.target).normalize();
      this.camera.lookAt(shot.camera.target);
    } else {
      this.follow.update(dt, this.player, input, world.terrain, world.cameraColliders, world.cameraHint(this.player));
    }

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
    this.sky?.setGlowDirection(this.sunDir);
    // A fixed shot from orbit uses the lens up, so the sky still shows its horizon glow and stars.
    const skyUp = shot?.camera ? this.scratch.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize() : up;
    this.sky?.update(this.camera.position, skyUp, this.elapsed);

    // Haze sits on the far curve: fog distances count from the horizon, so close ground stays clean from any height.
    if (this.scene.fog instanceof Fog && world.fog) {
      const d = this.camera.position.length();
      const radius = world.terrain.radiusAt(this.player.up);
      const horizon = Math.sqrt(Math.max(1, d * d - radius * radius));
      this.scene.fog.near = horizon + world.fog.near;
      this.scene.fog.far = horizon + world.fog.far;
    }

    this.arrow.update(dt, this.player.position, up, shot ? null : world.objective(), this.reducedMotion);
    this.puffs.update(dt);

    // Keep the sharp band of the tilt-shift on the player.
    this.scratch.copy(this.player.position).addScaledVector(up, 0.6).project(this.camera);
    this.post.focus = Math.max(0.12, Math.min(0.88, this.scratch.y * 0.5 + 0.5));
    this.post.render(this.scene, this.camera, this.elapsed);

    this.afterFrame(dt);
  };

  private afterFrame(dt: number): void {
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) writeStorage(SAVE_KEY, this.store.serialize());
    }
    if (this.autoQuality && !this.bookmark && this.quality.tier !== "low" && this.watchdog.update(dt)) {
      this.changeTier(lowerTier(this.quality.tier), true);
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
      tier: () => this.quality.tier,
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
      stats: () => ({ calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }),
      setQuality: (tier: QualityTier | null) => this.setQuality(tier),
      travel: (id: string) => this.travel(id),
      /** Stands the player next to an interactable, facing it. */
      teleportTo: (id: string): boolean => {
        const target = this.interactions.positionOf(id);
        if (!target || !this.world) return false;
        const dir = target.clone().normalize();
        const side = projectOnTangent(this.player.position.clone().sub(target), dir, new Vector3());
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        side.setLength(0.6);
        const stand = target.clone().add(side).normalize();
        this.player.teleport(stand, side.clone().negate(), this.world);
        this.follow.snap(this.player);
        return true;
      },
    };
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.input.dispose();
    this.world?.dispose();
    this.sky?.dispose();
    this.post.dispose();
    this.puffs.dispose();
    this.arrow.dispose();
    this.toon.dispose();
    this.renderer.dispose();
    this.bus.clear();
  }
}
