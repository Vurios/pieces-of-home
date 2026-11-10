import type { DirectionalLight, Group, HemisphereLight, Texture, Vector3 } from "three";
import type { GameBus } from "../core/events";
import type { QualitySettings } from "../core/quality";
import type { StateStore } from "../core/state";
import type { LookSpec } from "../render/post";
import type { SkySpec } from "../render/sky";
import type { ToonLibrary } from "../render/toon";
import type { IntroSpec } from "../title/title";
import type { CameraHint } from "../world/camera";
import type { ColliderGroup } from "../world/colliders";
import type { PlayerController } from "../world/controller";
import type { InteractionSystem } from "../world/interaction";
import type { Terrain } from "../world/terrain";

export interface WorldContext {
  toon: ToonLibrary;
  quality: QualitySettings;
  bus: GameBus;
  store: StateStore;
  interactions: InteractionSystem;
  loadTexture(url: string): Texture;
}

/** A fixed view for screenshots and the title sequence. */
export interface Bookmark {
  /** Where the player stands. Unit direction from the planet center, and facing. */
  player: { dir: Vector3; forward: Vector3 };
  /** Camera position and look target in world space. Null follows the player normally. */
  camera: { position: Vector3; target: Vector3 } | null;
}

export interface FrameInfo {
  player: PlayerController;
  /** The player's carried letter, if any. */
  carrying: string | null;
  time: number;
  reducedMotion: boolean;
}

export interface World {
  id: string;
  root: Group;
  terrain: Terrain;
  /** Colliders the player bumps into. May change, for example when a door opens. */
  colliders: ColliderGroup[];
  /** Colliders the camera avoids. */
  cameraColliders: ColliderGroup[];
  sky: SkySpec;
  look: LookSpec;
  /** Key light. The engine aims it and moves its shadow box with the player. */
  sun: DirectionalLight;
  /** Fill light. The engine points it along the player's up. */
  fill: HemisphereLight;
  /** Low sun: how high the key light sits above the local horizon, 0 to 1. */
  sunHeight: number;
  /** A fixed world direction the key light leans toward. */
  sunToward: Vector3;
  dustColor: string;
  /**
   * Haze toward the horizon, so the curve of the little world reads with depth.
   * `near` and `far` count from the camera's horizon distance, so they can be negative.
   */
  fog: { color: string; near: number; far: number } | null;
  spawn: { dir: Vector3; forward: Vector3 };
  /** The title flight for this world, or null. Only Home has one. */
  intro: IntroSpec | null;
  /** Lamps and windows, 0 dark to 1 fully lit. The title lights them when the chain is pulled. */
  setPower(level: number): void;
  /** A named point for speech bubbles, for example "mom" or "lamp". */
  anchor(id: string): Vector3 | null;
  bookmarks: Record<string, Bookmark>;
  surfaceAt(dir: Vector3, onPlatform: boolean): string;
  cameraHint(player: PlayerController): CameraHint | null;
  /** Where the paper arrow should point, or null. */
  objective(): Vector3 | null;
  update(dt: number, frame: FrameInfo): void;
  /** Called when the pixel height of the screen changes, so particles keep their size. */
  resize(pixelHeight: number): void;
  dispose(): void;
}

export type WorldFactory = (ctx: WorldContext) => World | Promise<World>;
