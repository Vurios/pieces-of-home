import { readStorage, writeStorage } from "../../game/core/state";

/**
 * The notebook's last page (Finale): a favorite-discovery sticker and a name
 * for the next adventure, picked from word chips, and whether a group photo
 * was taken (the photo itself lives with the other photos). It stays on this
 * device and is never sent to anyone.
 */
export const LAST_PAGE_KEY = "poh.lastpage.v1";

export interface LastPage {
  sticker: string | null;
  first: string | null;
  second: string | null;
  /** When the group photo was taken (its id among the saved photos), or null. */
  photoAt: number | null;
}

export function readLastPage(): LastPage | null {
  try {
    const raw = JSON.parse(readStorage(LAST_PAGE_KEY) ?? "null") as Partial<LastPage> | null;
    if (!raw || typeof raw !== "object") return null;
    const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
    return { sticker: text(raw.sticker), first: text(raw.first), second: text(raw.second), photoAt: typeof raw.photoAt === "number" ? raw.photoAt : null };
  } catch {
    return null;
  }
}

export function writeLastPage(page: LastPage): void {
  writeStorage(LAST_PAGE_KEY, JSON.stringify(page));
}
