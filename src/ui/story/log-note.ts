import { readStorage, writeStorage } from "../../game/core/state";

/**
 * The note Remi leaves in Ingenuity's log in Chapter 4, made of preset word
 * chips (never free text). Kept on this device only, like the last page, and
 * shown again in the notebook and at the end.
 */
const KEY = "poh.lognote.v1";

export interface LogNote {
  hello: string;
  middle: string;
  bye: string;
}

export const LOG_CHIPS = {
  hello: ["Hello, explorer!", "Hi, little helicopter!", "Dear friend on Mars,"],
  middle: ["You flew so well.", "We read Dad's letters to you.", "Your notes helped us.", "We came to visit."],
  bye: ["See you soon.", "Keep the notes safe.", "Thank you!", "Leave the light on."],
} as const;

export function readLogNote(): LogNote | null {
  try {
    const raw = JSON.parse(readStorage(KEY) ?? "null") as Partial<LogNote> | null;
    if (!raw || typeof raw !== "object") return null;
    const pick = (list: readonly string[], value: unknown): string | null => (typeof value === "string" && list.includes(value) ? value : null);
    const hello = pick(LOG_CHIPS.hello, raw.hello);
    const middle = pick(LOG_CHIPS.middle, raw.middle);
    const bye = pick(LOG_CHIPS.bye, raw.bye);
    return hello && middle && bye ? { hello, middle, bye } : null;
  } catch {
    return null;
  }
}

export function writeLogNote(note: LogNote): void {
  writeStorage(KEY, JSON.stringify(note));
}

export const logNoteText = (note: LogNote): string => `${note.hello} ${note.middle} ${note.bye}`;
