/**
 * Chapters as data (Phase 05). Each chapter names its world, its three
 * letters and the beats that play around them, its main activity, Milo's
 * new part, the memory and the stamp. The story director in
 * src/ui/story/ plays the scripts; the worlds in src/game/worlds/ place the
 * things the letters are for.
 *
 * Copy rules: grade 3 to 5, short sentences, no em dashes, and no numbers in
 * the text. A number a player sees comes from a fact (`fact` lines show a
 * fact's own wording from facts.json, with its source in the notebook).
 */
export type Speaker = "remi" | "nori" | "lumi" | "theo" | "mom" | "dad" | "milo";

export type Line =
  /** Someone says something. `at` is an anchor id in the world for the bubble (default: the player). */
  | { say: string; who: Speaker; at?: string; voice?: string }
  /** Dad's handwritten margin note, on a card of his paper. */
  | { note: string }
  /** A fact card: the fact's kid wording, from facts.json. */
  | { fact: string }
  /** A pause, in seconds. */
  | { wait: number };

export interface LetterDef {
  /** Saved in `delivered` when given. */
  id: string;
  /** World anchor the letter is delivered to. */
  to: string;
  /** "To the little mirrors", as written on the envelope. */
  address: string;
  /** The prompt, for example "Give the letter to the mirrors". */
  prompt: string;
  /** Where to find it, for the goal card and hints. */
  where: string;
  /** What Dad wrote, shown on the opened letter. */
  letter: string;
  /** What happens after it is delivered. */
  beat: Line[];
}

export interface ChapterDef {
  /** Also the stamp id, for example "chapter-1". */
  id: string;
  /** World id in the registry. */
  world: string;
  /** Notebook spread id. */
  spread: string;
  /** Dome label on the workbench. */
  dome: string;
  /** "Chapter 1: Tranquility Base". */
  title: string;
  /** Short label for the goal card. */
  place: string;
  arrival: Line[];
  /** Dad's tag on its stake. */
  tag: { title: string; lines: string[] };
  letters: [LetterDef, LetterDef, LetterDef];
  /** The main activity's id (see src/game/puzzles/). */
  activity: string;
  /** Lines when the activity starts and when it is done. */
  activityStart: Line[];
  activityDone: Line[];
  /** Milo's stage after this chapter. */
  milo: number;
  miloPart: string;
  /** "Give Milo his new eyes", the prompt at the workbench. */
  partPrompt: string;
  /** Said when Milo's part clicks in. */
  partFitted: Line[];
  memory: Line[];
  stamp: [string, string];
  /** The goal card copy for each step. */
  goals: { arrive: string; letters: string; activity: string; home: string };
}
