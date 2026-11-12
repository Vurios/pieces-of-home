import { Vector3 } from "three";
import type { GameBus, PromptInfo } from "../core/events";
import type { InputFrame } from "../core/input";

/**
 * Proximity prompts. The nearest thing in reach that is roughly in front of
 * the player shows its prompt. "press" acts at once; "hold" fills while the
 * interact button is held (used for holding puzzle pieces steady).
 */
export interface Interactable {
  id: string;
  /** World-space point the player walks up to. */
  position: Vector3;
  /** How close the player must be, in world units. */
  radius: number;
  kind: "press" | "hold";
  /** Seconds to hold, for "hold". */
  holdTime?: number;
  /** The prompt text right now, or null when nothing can be done here. */
  label: () => string | null;
  onDone: () => void;
}

export class InteractionSystem {
  private items = new Map<string, Interactable>();
  private current: Interactable | null = null;
  private progress = 0;
  private lastPrompt: string | null = null;
  private readonly toItem = new Vector3();
  /** While a story card is up, the interact button belongs to the card. */
  blocked = false;

  constructor(private bus: GameBus) {}

  add(item: Interactable): void {
    this.items.set(item.id, item);
  }

  remove(id: string): void {
    this.items.delete(id);
    if (this.current?.id === id) this.current = null;
  }

  clear(): void {
    this.items.clear();
    this.current = null;
    this.emitIfChanged(null, null);
  }

  /** Where an item is, for tests and hints. */
  positionOf(id: string): Vector3 | null {
    return this.items.get(id)?.position ?? null;
  }

  get focused(): Interactable | null {
    return this.current;
  }

  /**
   * Chooses the focused item and handles the button.
   * Returns the id of an item that finished this frame, or null.
   */
  update(dt: number, feet: Vector3, forward: Vector3, input: InputFrame): string | null {
    let best: Interactable | null = null;
    let bestScore = Infinity;
    let bestLabel: string | null = null;
    for (const item of this.blocked ? [] : this.items.values()) {
      const distance = this.toItem.copy(item.position).sub(feet).length();
      if (distance > item.radius) continue;
      const label = item.label();
      if (!label) continue;
      // Prefer what the player faces: things off to the side count as a little farther away, things behind more.
      const facing = distance > 0.01 ? this.toItem.divideScalar(distance).dot(forward) : 1;
      const score = distance * (facing > 0 ? 1 + (1 - facing) * 0.9 : 2.2);
      if (score < bestScore) {
        bestScore = score;
        best = item;
        bestLabel = label;
      }
    }

    if (best !== this.current) {
      this.current = best;
      this.progress = 0;
    }

    let finished: string | null = null;
    if (best && bestLabel) {
      if (best.kind === "press") {
        if (input.interactPressed) finished = best.id;
      } else {
        const needed = best.holdTime ?? 1;
        this.progress = input.interactHeld ? Math.min(1, this.progress + dt / needed) : Math.max(0, this.progress - dt * 2);
        if (this.progress >= 1) {
          finished = best.id;
          this.progress = 0;
        }
      }
    }

    if (finished && best) {
      best.onDone();
      this.bus.emit("interact:done", { id: finished });
    }

    const prompt: PromptInfo | null =
      best && bestLabel ? { id: best.id, label: bestLabel, kind: best.kind, progress: this.progress } : null;
    this.emitIfChanged(prompt, best ? `${best.id}|${best.label() ?? ""}|${this.progress.toFixed(2)}` : null);
    return finished;
  }

  private emitIfChanged(prompt: PromptInfo | null, key: string | null): void {
    if (key === this.lastPrompt) return;
    this.lastPrompt = key;
    this.bus.emit("prompt:change", prompt);
  }
}
