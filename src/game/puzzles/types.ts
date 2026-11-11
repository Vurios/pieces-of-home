import type { Vector3 } from "three";

/**
 * A chapter's main activity (Phase 05). Each one lives in its world, keeps
 * its progress in the save's flags, says what happened through the event bus
 * ("activity:step", "activity:beat", "activity:done") and has a test hook
 * that finishes it at once.
 */
export interface Activity {
  id: string;
  /** Where the paper arrow should point for the next step, or null. */
  objective(): Vector3 | null;
  update(dt: number, reducedMotion: boolean): void;
  /** Finishes the activity at once, for automated tests. */
  solve(): void;
  resize?(pixelHeight: number): void;
  dispose(): void;
}
