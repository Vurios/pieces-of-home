import type { WorldFactory } from "./types";

/**
 * Each world is its own chunk of code, loaded the first time someone visits.
 * Chapter worlds are added here as they are built.
 */
export const WORLDS: Record<string, () => Promise<WorldFactory>> = {
  home: () => import("./home").then((module) => module.createHome),
  tranquility: () => import("./tranquility").then((module) => module.createTranquility),
  hadley: () => import("./hadley").then((module) => module.createHadley),
  meridiani: () => import("./meridiani").then((module) => module.createMeridiani),
  valinor: () => import("./valinor").then((module) => module.createValinor),
};

export type WorldId = keyof typeof WORLDS;
