import type { GameState } from "../../game/core/state";
import { ACTIVITIES, type ActivityStep, doneFlag, stepFlag } from "./activities";
import { HADLEY } from "./hadley";
import { MERIDIANI } from "./meridiani";
import { TRANQUILITY } from "./tranquility";
import { VALINOR } from "./valinor";
import type { ChapterDef, LetterDef } from "./types";

export type { ChapterDef, LetterDef, Line, Speaker } from "./types";

/** Every built chapter, in story order. */
export const CHAPTERS: ChapterDef[] = [TRANQUILITY, HADLEY, MERIDIANI, VALINOR];

export function chapterById(id: string): ChapterDef | null {
  return CHAPTERS.find((c) => c.id === id) ?? null;
}

export function chapterForWorld(world: string): ChapterDef | null {
  return CHAPTERS.find((c) => c.world === world) ?? null;
}

export const arrivedFlag = (chapter: ChapterDef): string => `${chapter.id}:arrived`;
/** Set when Milo gets this chapter's part. Chapters can be played in any order, so each part has its own flag. */
export const fittedFlag = (chapter: ChapterDef): string => `${chapter.id}:fitted`;

/** True once Milo has this chapter's part: it was fitted, or the chapter is stamped (saves from before the flag). */
export function hasPart(chapter: ChapterDef, state: Readonly<GameState>): boolean {
  return state.stamps.includes(chapter.id) || state.flags.includes(fittedFlag(chapter));
}

/** Which of Milo's parts a save has, for his model (Game Bible 5.6). */
export interface MiloParts {
  eyes: boolean;
  wheels: boolean;
  heart: boolean;
  rotor: boolean;
  record: boolean;
}

const PART_OF: Record<number, keyof MiloParts> = { 1: "eyes", 2: "wheels", 3: "heart", 4: "rotor" };

export function miloParts(state: Readonly<GameState>): MiloParts {
  const parts: MiloParts = { eyes: false, wheels: false, heart: false, rotor: false, record: state.miloStage >= 5 };
  for (const chapter of CHAPTERS) {
    const part = PART_OF[chapter.milo];
    if (part && hasPart(chapter, state)) parts[part] = true;
  }
  return parts;
}
export const partId = (chapter: ChapterDef): string => `part:${chapter.id}`;

/** The chapter a carried part belongs to. */
export function chapterForPart(carrying: string | null): ChapterDef | null {
  if (!carrying?.startsWith("part:")) return null;
  return chapterById(carrying.slice(5));
}

export type ChapterStep =
  | { kind: "arrive" }
  | { kind: "letter"; index: number; letter: LetterDef }
  /** `step` is null while the activity's last moment plays. */
  | { kind: "activity"; step: ActivityStep | null; index: number; steps: number }
  | { kind: "part-take" }
  | { kind: "part-home" }
  | { kind: "part-give" }
  /** Milo has his new part; the memory and the stamp are still to come. */
  | { kind: "memory" }
  | { kind: "done" };

/** Where a chapter stands in a save. One place decides, for the goal card, the arrow and the story. */
export function chapterStep(chapter: ChapterDef, state: Readonly<GameState>): ChapterStep {
  if (state.stamps.includes(chapter.id)) return { kind: "done" };
  if (state.carrying === partId(chapter)) return state.world === "home" ? { kind: "part-give" } : { kind: "part-home" };
  if (state.flags.includes(fittedFlag(chapter))) return { kind: "memory" };
  if (state.flags.includes(doneFlag(chapter.activity))) return { kind: "part-take" };
  const next = chapter.letters.findIndex((l) => !state.delivered.includes(l.id));
  if (next < 0) {
    const activity = ACTIVITIES[chapter.activity];
    const steps = activity?.steps ?? [];
    const index = steps.findIndex((s) => !state.flags.includes(stepFlag(chapter.activity, s.id)));
    return { kind: "activity", step: index >= 0 ? steps[index]! : null, index: index >= 0 ? index : steps.length, steps: steps.length };
  }
  if (!state.flags.includes(arrivedFlag(chapter))) return { kind: "arrive" };
  return { kind: "letter", index: next, letter: chapter.letters[next]! };
}
