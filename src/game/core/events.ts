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
  /** A title letter landed. `index` counts letters in reading order. */
  "title:note": { index: number };
  /** Every title letter is down and the chain can be pulled. */
  "title:ready": Record<string, never>;
  "title:pulled": Record<string, never>;
  /** The camera reached the player after the title. */
  "title:done": Record<string, never>;
  /** Someone speaks. `at` is a world position for the bubble, or null for a caption only. */
  say: { speaker: string; name: string; text: string; at: [number, number, number] | null; recording?: boolean; line?: string };
  /** A small paper note at the edge of the screen. */
  toast: { text: string };
  /** A chapter or beat is complete. Two short lines for the big ink stamp. */
  stamp: { id: string; lines: [string, string] };
  emote: { id: string };
  "photo:taken": { count: number };
  /** A story card: Dad's handwritten note, or a fact from facts.json. The UI answers with story:card-done. */
  "story:card": { key: number; kind: "note" | "fact"; text: string; fact?: string };
  "story:card-done": { key: number };
  /** A small game on screen (the microscope, the storm calls). The UI answers with story:game-done. */
  "story:game": { key: number; id: string };
  "story:game-done": { key: number };
  /** The story tells the world to start something, for example "storm", "silence" or "clear". */
  "story:cue": { id: string };
  /** A gauge for the activity on screen, 0 to 1, or null to hide it. */
  "activity:meter": { id: string; label: string; value: number | null };
  /** A chapter's main activity begins, moves on a step, or is finished. */
  "activity:start": { id: string };
  "activity:step": { id: string; step: string };
  "activity:done": { id: string };
  /** Something in an activity worth saying out loud, for example "miss" or "home". The story director picks the words. */
  "activity:beat": { id: string; beat: string };
  /** A ride (Chapter 2's Moon buggy): someone is driving, which leg of the trip, and how far along Dad's route, 0 to 1. */
  "ride:state": { riding: boolean; leg: "out" | "back"; progress: number };
  /** Kicks up a little dust (wheels, landings). */
  "dust:puff": { at: [number, number, number]; count: number; spread: number };
  /** Ask to go to another little world through the Looking Lamp. `entry` picks where to stand there. */
  travel: { to: string; entry?: string };
  /**
   * A trip through the Looking Lamp, for the travel screen: it starts as the
   * iris closes, `arrive` comes once the new world is ready and the screen has
   * had its moment, and `end` once the iris is open again.
   */
  "travel:start": { from: string | null; to: string };
  /** A big chapter card on demand ("Finale / The Long Light"). */
  "story:banner": { label: string; name: string };
  /** The dish is aimed with Dad's last letter in hand (Finale). */
  "finale:aim": Record<string, never>;
  "travel:arrive": { to: string };
  "travel:end": { to: string };
  /** Open Dad's notebook at a spread. */
  "notebook:open": { spread: string };
  /** A short camera move to show something (a pulse flying to Earth), blended in and out of the follow camera. */
  "camera:cinematic": { position: [number, number, number]; target: [number, number, number]; up?: [number, number, number]; seconds: number };
  /** A one-shot sound from game code (see src/audio/cues.ts). */
  sfx: { name: string; at?: [number, number, number] | null; param?: number; delay?: number; level?: number };
  "debug:stats": { fps: number; calls: number; triangles: number; geometries: number; textures: number; tier: QualityTier };
}

export type GameBus = EventBus<GameEvents>;
