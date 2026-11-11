import type { GameState } from "../../game/core/state";
import { ACTIVITIES, type ActivityStep, doneFlag, stepFlag } from "./activities";
import { TRANQUILITY } from "./tranquility";
import type { ChapterDef, LetterDef } from "./types";

export type { ChapterDef, LetterDef, Line, Speaker } from "./types";

/** Every built chapter, in story order. */
export const CHAPTERS: ChapterDef[] = [TRANQUILITY];

export function chapterById(id: string): ChapterDef | null {
  return CHAPTERS.find((c) => c.id === id) ?? null;
}

export function chapterForWorld(world: string): ChapterDef | null {
  return CHAPTERS.find((c) => c.world === world) ?? null;
}

export const arrivedFlag = (chapter: ChapterDef): string => `${chapter.id}:arrived`;
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
  | { kind: "done" };

/** Where a chapter stands in a save. One place decides, for the goal card, the arrow and the story. */
export function chapterStep(chapter: ChapterDef, state: Readonly<GameState>): ChapterStep {
  if (state.stamps.includes(chapter.id)) return { kind: "done" };
  if (state.carrying === partId(chapter)) return state.world === "home" ? { kind: "part-give" } : { kind: "part-home" };
  if (state.miloStage >= chapter.milo && state.flags.includes(doneFlag(chapter.activity))) return { kind: "done" };
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
