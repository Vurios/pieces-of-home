/**
 * A small typed event bus. Systems talk through events so the engine, the UI
 * layer, audio and co-op stay loosely coupled.
 */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Copy so a handler can unsubscribe while we iterate.
    for (const handler of [...set]) (handler as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export type QualityTier = "low" | "medium" | "high";
export type InputDevice = "keyboard" | "touch" | "gamepad";

/** What the player can do at the thing in front of them. */
export interface PromptInfo {
  id: string;
  /** Short verb phrase, for example "Take the letter". */
  label: string;
  /** "press" acts at once. "hold" fills while the button is held. */
  kind: "press" | "hold";
  /** 0 to 1 while holding. */
  progress: number;
}

/** Every event the game can emit. Payloads are plain data so they serialize. */
export interface GameEvents {
  "world:loading": { id: string };
  "world:ready": { id: string };
  "prompt:change": PromptInfo | null;
  "interact:done": { id: string };
  "letter:taken": { letter: string };
  "letter:delivered": { letter: string; to: string };
  "player:step": { surface: string; running: boolean };
  "player:jump": Record<string, never>;
  "player:land": { speed: number };
  "player:zone": { zone: string | null };
  "input:device": { device: InputDevice };
  "quality:change": { tier: QualityTier; auto: boolean };
  "milo:stage": { stage: number };
  "debug:stats": { fps: number; calls: number; triangles: number; geometries: number; textures: number; tier: QualityTier };
}

export type GameBus = EventBus<GameEvents>;
