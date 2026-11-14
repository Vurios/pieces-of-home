import type { DirectionalLight, Group, HemisphereLight, Texture, Vector3 } from "three";
import type { GameBus } from "../core/events";
import type { InputFrame } from "../core/input";
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
  camera: { position: Vector3; target: Vector3; up?: Vector3 } | null;
}

/** A point in world space, for sounds. */
export interface SoundPoint {
  x: number;
  y: number;
  z: number;
}

/** A sound that lives in a place: a loop that keeps going, or a cue now and then while the player is near. */
export interface SoundSpot {
  position: SoundPoint;
  /** A looping cue (see src/audio/cues.ts), kept running at `value`. */
  loop?: string;
  value?: number;
  /** A one-shot cue played every `every` seconds (a random time in the range) while the player is within `radius`. */
  cue?: string;
  every?: [number, number];
  radius?: number;
  /** The world moves `position` and changes `value` while it plays (a dust devil). */
  live?: boolean;
}

/** A small hand-drawn picture on Dad's map (see src/ui/map/MapGlyph.svelte). */
export type MapIcon =
  | "lamp"
  | "tag"
  | "house"
  | "workshop"
  | "mailbox"
  | "garden"
  | "dish"
  | "hill"
  | "meadow"
  | "treehouse"
  | "playground"
  | "pond"
  | "tent"
  | "weather"
  | "rocket"
  | "orchard"
  | "windpump"
  | "balloon"
  | "lander"
  | "flag"
  | "camera"
  | "listener"
  | "mirrors"
  | "console"
  | "crater"
  | "rover"
  | "rocks"
  | "bounce"
  | "pennant"
  | "corner"
  | "wheel"
  | "buggy"
  | "helicopter";

/** One labelled place on a world's map. */
export interface MapMark {
  id: string;
  label: string;
  /** Unit direction from the planet's center. */
  at: Vector3;
  icon: MapIcon;
  /** Shown as a pencil question mark until this save flag is set (places still to find). */
  found?: string;
  /** Letters go here: a little envelope shows until they are all delivered. */
  letters?: string[];
}

/**
 * Dad's map of a little world, for the corner map and the big globe. Every
 * position is a unit direction from the planet's center.
 */
export interface WorldMap {
  title: string;
  radius: number;
  /** Where the globe faces when it first opens, if Remi is not there. */
  center: Vector3;
  colors: { land: string; shade: string; ink: string; path?: string; water?: string };
  marks: MapMark[];
  craters?: { at: Vector3; radius: number }[];
  paths?: Vector3[][];
  /** Long valleys (Hadley Rille): drawn as a dark band `width` world units wide. */
  valleys?: { path: Vector3[]; width: number }[];
  water?: { at: Vector3; radius: number }[];
  patches?: { at: Vector3; radius: number; color: string }[];
}

export interface FrameInfo {
  player: PlayerController;
  /** The player's carried letter, if any. */
  carrying: string | null;
  time: number;
  reducedMotion: boolean;
  /** The short story before a new game is playing (see the engine's storyShot). */
  story?: boolean;
  /** The title is up: the flight from Dad's lamp, the menu, the flight down to Remi. */
  title?: boolean;
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
  /** Named places to arrive at, for example "bench" when coming back from a dome. */
  entries?: Record<string, { dir: Vector3; forward: Vector3 }>;
  /**
   * A ride (Chapter 2's Moon buggy). While it returns true, the world has
   * moved the player this frame (sitting in a seat), so walking is skipped
   * and the kid sits.
   */
  ride?(dt: number, input: InputFrame, player: PlayerController): boolean;
  /** Kids wear their space suits here (the Moon and Mars). */
  suits?: boolean;
  /** A sky that changes while you play (a dust storm), or null when it holds still. */
  liveSky?(): SkySpec | null;
  /** A colour grade that changes while you play, or null. Return one only when it really changed: each costs a new lookup table. */
  liveLook?(): LookSpec | null;
  /** Test hooks, run through the debug API: "solve", "deliver" and so on. */
  debug?: Record<string, () => unknown>;
  /** The title flight for this world, or null. Only Home has one. */
  intro: IntroSpec | null;
  /** Lamps and windows, 0 dark to 1 fully lit. The title lights them when the chain is pulled. */
  setPower(level: number): void;
  /** A named point for speech bubbles, for example "mom" or "lamp". */
  anchor(id: string): Vector3 | null;
  bookmarks: Record<string, Bookmark>;
  surfaceAt(dir: Vector3, onPlatform: boolean): string;
  cameraHint(player: PlayerController): CameraHint | null;
  /** The named place the player is standing in, for the place-name card. Null between places. */
  zoneAt?(dir: Vector3): string | null;
  /** Where the paper arrow should point, or null. */
  objective(): Vector3 | null;
  /** Dad's map of this world, for the corner map and the big globe. */
  map?: WorldMap;
  /** Sounds placed in the world (machine hums, Milo's chirps). */
  sounds?: SoundSpot[];
  /** How loud each ambience layer should be where the player stands, 0 to 1 (see src/audio/ambience.ts). */
  ambience?(player: SoundPoint): Record<string, number>;
  update(dt: number, frame: FrameInfo): void;
  /** Called when the pixel height of the screen changes, so particles keep their size. */
  resize(pixelHeight: number): void;
  dispose(): void;
}

export type WorldFactory = (ctx: WorldContext) => World | Promise<World>;
