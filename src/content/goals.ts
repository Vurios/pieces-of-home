import type { InputDevice } from "../game/core/events";
import type { GameState } from "../game/core/state";
import { PLACE_IDS, placesFound } from "./places";

/**
 * What to do next, in plain words, and the short how-to-play tips.
 *
 * The goal card always shows exactly one goal: what to do, where, and why.
 * The tips teach one control at a time and finish when the player does the
 * thing, not when they press "OK". Grade 3 to 5 wording, no em dashes.
 */
export const LETTER_TO_THE_LAMP = "to-the-lamp";
export const SEEN_NOTEBOOK = "seen-notebook";

export type GoalId = "mailbox" | "lamp" | "notebook" | "explore";

export interface Goal {
  id: GoalId;
  /** Which part of the story this is. */
  chapter: string;
  /** What to do, as a short command. */
  title: string;
  /** Where to go and why. */
  detail: string;
  /** A little more help when the player asks for a hint. */
  hint: string;
  /** Step number in this chapter, and how many steps it has. */
  step: number;
  steps: number;
}

export const PROLOGUE = { label: "Prologue", name: "The Workshop", chapter: "Prologue: The Workshop" };

export function goalFor(state: Readonly<GameState>, device: InputDevice): Goal {
  const base = { chapter: PROLOGUE.chapter, steps: 3 };
  if (state.carrying === LETTER_TO_THE_LAMP) {
    return {
      ...base,
      id: "lamp",
      step: 2,
      title: "Bring the letter to Dad's lamp",
      detail: "The lamp is on the workbench in Dad's workshop. Walk in through the open door.",
      hint: "Dad's workshop is the red shed with the green roof. The lamp is on the bench inside.",
    };
  }
  if (!state.delivered.includes(LETTER_TO_THE_LAMP)) {
    return {
      ...base,
      id: "mailbox",
      step: 1,
      title: "Check the mailbox",
      detail: "The flag is up. Something is waiting inside. Follow the paper arrow.",
      hint: "The mailbox is next to the porch, in front of the house. Walk up to it and take the letter.",
    };
  }
  if (!state.flags.includes(SEEN_NOTEBOOK)) {
    const how = device === "touch" ? "Tap Notebook at the top." : device === "gamepad" ? "Press the View button." : "Press N.";
    return {
      ...base,
      id: "notebook",
      step: 3,
      title: "Open Dad's notebook",
      detail: `See what the letter changed. ${how}`,
      hint: `The notebook keeps every letter and every machine. ${how}`,
    };
  }
  const found = placesFound(state.flags);
  const total = PLACE_IDS.length;
  if (found >= total) {
    return {
      ...base,
      id: "explore",
      step: 3,
      title: "You found every place",
      detail: "You walked all the way round Home. The next letters are still being written.",
      hint: "Say hi to Mom on the porch, or sit by the campfire for a while.",
    };
  }
  return {
    ...base,
    id: "explore",
    step: 3,
    title: "Explore Home",
    detail: `You found ${found} of ${total} places. Follow the paths to find the rest.`,
    hint: "Paths lead to every place, and lamps light the way. Walk all the way round the little planet.",
  };
}

/** One control at a time. Each tip ends when the player does it. */
export type TipId = "move" | "look" | "arrow" | "use" | "notebook";

export interface Tip {
  id: TipId;
  /** Keys or buttons to draw as little caps. */
  keys: string[];
  text: string;
}

export const TIP_ORDER: readonly TipId[] = ["move", "look", "arrow", "use", "notebook"];

/** The tip in words for this device. `key` turns a key code into a cap label. */
export function tipFor(id: TipId, device: InputDevice, bindings: Record<string, string[]>, key: (code: string) => string): Tip {
  const first = (action: string, fallback: string): string => key(bindings[action]?.[0] ?? fallback);
  switch (id) {
    case "move":
      if (device === "touch") return { id, keys: [], text: "Drag on the left side of the screen to walk. Push far to run." };
      if (device === "gamepad") return { id, keys: ["Left stick"], text: "Walk around. Push it all the way to run." };
      return { id, keys: [first("forward", "KeyW"), first("left", "KeyA"), first("back", "KeyS"), first("right", "KeyD")], text: `Walk around. Hold ${first("run", "ShiftLeft")} to run.` };
    case "look":
      if (device === "touch") return { id, keys: [], text: "Drag on the right side of the screen to look around." };
      if (device === "gamepad") return { id, keys: ["Right stick"], text: "Look around." };
      return { id, keys: ["Mouse"], text: "Click and drag to look around. Scroll to zoom." };
    case "arrow":
      return { id, keys: [], text: "See the paper arrow by your feet? It always points to your goal." };
    case "use":
      if (device === "touch") return { id, keys: ["Use"], text: "Tap Use when you see a word pop up." };
      if (device === "gamepad") return { id, keys: ["X"], text: "Press X when you see a word pop up." };
      return { id, keys: [first("interact", "KeyE")], text: "Press it when you see a word pop up." };
    case "notebook":
      if (device === "touch") return { id, keys: ["Notebook"], text: "Tap it to open Dad's notebook." };
      if (device === "gamepad") return { id, keys: ["View"], text: "Open Dad's notebook." };
      return { id, keys: ["N"], text: "Open Dad's notebook." };
  }
}
