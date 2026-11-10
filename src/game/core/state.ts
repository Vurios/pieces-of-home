/**
 * The serializable game state. One plain object holds everything that a save
 * file or a co-op room needs. No class instances, no Three.js types.
 */
export const SAVE_VERSION = 1;
export const SAVE_KEY = "poh.save.v1";
export const MAX_MILO_STAGE = 5;

export interface GameState {
  version: number;
  /** Which little world the players are in. */
  world: string;
  /** 0 to 5. See Game Bible 5.6. */
  miloStage: number;
  /** The letter being carried, or null. */
  carrying: string | null;
  /** Letters delivered so far. */
  delivered: string[];
  /** Notebook stamps earned so far. */
  stamps: string[];
}

export function createInitialState(): GameState {
  return { version: SAVE_VERSION, world: "home", miloStage: 0, carrying: null, delivered: [], stamps: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length < 64);
}

/** Rebuilds a safe state from anything. Unknown or broken input gives a fresh state. */
export function reviveState(raw: unknown): GameState {
  const fresh = createInitialState();
  if (typeof raw !== "object" || raw === null) return fresh;
  const value = raw as Record<string, unknown>;
  if (value["version"] !== SAVE_VERSION) return fresh;
  const stage = value["miloStage"];
  return {
    version: SAVE_VERSION,
    world: typeof value["world"] === "string" && value["world"].length < 32 ? value["world"] : fresh.world,
    miloStage:
      typeof stage === "number" && Number.isInteger(stage) ? Math.min(MAX_MILO_STAGE, Math.max(0, stage)) : 0,
    carrying: typeof value["carrying"] === "string" && value["carrying"].length < 64 ? value["carrying"] : null,
    delivered: isStringArray(value["delivered"]) ? [...new Set(value["delivered"])] : [],
    stamps: isStringArray(value["stamps"]) ? [...new Set(value["stamps"])] : [],
  };
}

type Listener = (state: GameState) => void;

export class StateStore {
  private state: GameState;
  private listeners = new Set<Listener>();

  constructor(initial: GameState = createInitialState()) {
    this.state = initial;
  }

  get value(): Readonly<GameState> {
    return this.state;
  }

  /** Applies a change and tells every listener. */
  update(change: (draft: GameState) => void): void {
    const draft: GameState = {
      ...this.state,
      delivered: [...this.state.delivered],
      stamps: [...this.state.stamps],
    };
    change(draft);
    this.state = draft;
    for (const listener of this.listeners) listener(draft);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  load(json: string | null): void {
    let parsed: unknown = null;
    try {
      parsed = json ? JSON.parse(json) : null;
    } catch {
      parsed = null;
    }
    this.state = reviveState(parsed);
    for (const listener of this.listeners) listener(this.state);
  }
}

/** Storage can throw in private windows. Saving must never break play. */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do. The game keeps working without a save.
  }
}
