import type { WorldFactory } from "./types";

/**
 * Each world is its own chunk of code, loaded the first time someone visits.
 * Chapter worlds join this list in Phase 05.
 */
export const WORLDS: Record<string, () => Promise<WorldFactory>> = {
  home: () => import("./home").then((module) => module.createHome),
};

export type WorldId = keyof typeof WORLDS;
