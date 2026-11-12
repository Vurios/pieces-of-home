import type { GameState } from "../game/core/state";
import { CHAPTERS, type Line } from "./chapters";

/**
 * Finale: The Long Light (Game Bible 5.8 and 6, P0). Night on Home. The
 * mailbox flag is up one last time: Dad's letter "To Voyager 1, far from
 * home". Remi aims Dad's backyard dish at Voyager 1's real place in tonight's
 * sky (JPL Horizons) and sends it; the notebook works out how long light
 * would take to get there today. Under the dish waits the last part, Milo's
 * record. It clicks in, Milo finds his voice and plays Dad's saved messages,
 * then the photos Remi took. One page is left to fill. Then the stamp, the
 * ending and the credits, and the workshop opens as a little museum.
 *
 * Copy: grade 3 to 5, short sentences, no em dashes. Dad's words are saved
 * messages, always labeled as recordings, never a copy of him.
 */
export const FINALE = "finale";
export const FINALE_TITLE = "Finale: The Long Light";
export const V1_LETTER = "v1-letter";
export const RECORD = "part:finale";
export const MILO_VOICE = 5;

/** Flags, in story order. */
export const FINALE_BEGUN = "finale:begun";
export const FINALE_AIMED = "finale:aimed";
export const FINALE_HEARD = "finale:heard";
export const FINALE_PAGE = "finale:page";
export const FINALE_ENDED = "finale:ended";

/** The Finale opens once every built chapter has its stamp. */
export function finaleOpen(state: Readonly<GameState>): boolean {
  return state.stamps.includes("prologue") && CHAPTERS.every((c) => state.stamps.includes(c.id));
}

export type FinaleStep = "closed" | "mailbox" | "dish" | "record-take" | "record-give" | "listen" | "page" | "ending" | "museum";

/** Where the Finale stands in a save. One place decides, for the goal card, the arrow and the story. */
export function finaleStep(state: Readonly<GameState>): FinaleStep {
  if (!finaleOpen(state)) return "closed";
  if (state.flags.includes(FINALE_ENDED)) return "museum";
  if (state.stamps.includes(FINALE)) return "ending";
  if (state.flags.includes(FINALE_HEARD)) return "page";
  if (state.miloStage >= MILO_VOICE) return "listen";
  if (state.carrying === RECORD) return "record-give";
  if (state.delivered.includes(V1_LETTER)) return "record-take";
  if (state.carrying === V1_LETTER) return "dish";
  return "mailbox";
}

export const FINALE_COPY = {
  address: "To Voyager 1, far from home",
  takeLetter: "Take Dad's last letter",
  aim: "Aim the dish at Voyager 1",
  takeRecord: "Take Milo's record",
  giveRecord: "Give Milo his record",
  letter: "You left home a long time ago, and you never stopped sending. Every day you get a little farther, and you still call home. Thank you for showing us the way.",
  goals: {
    mailbox: { title: "Check the mailbox", detail: "The flag is up again. One last letter.", hint: "The mailbox is by the porch, in front of the house." },
    dish: { title: "Take the letter to Dad's dish", detail: "The dish on the hill can talk to faraway things.", hint: "The dish is up the hill behind the workshop. Follow the paper arrow." },
    recordTake: { title: "Take Milo's record", detail: "Dad left something in the dish's little box.", hint: "Look by the foot of the dish." },
    recordGive: { title: "Give Milo his record", detail: "Milo waits on Dad's workbench.", hint: "Milo is on the workbench in the workshop." },
    listen: { title: "Listen to Milo", detail: "Milo has something to play for you.", hint: "Stay with Milo for a moment." },
    page: { title: "Fill in the last page", detail: "One page of Dad's notebook is still blank.", hint: "The last page waits in Dad's notebook." },
    ending: { title: "Leave the light on", detail: "The lamp stays on.", hint: "Stay a moment." },
    museum: { title: "The museum is open", detail: "Visit any little world again, or walk round Home. The lamp stays on.", hint: "The domes are on the workbench. Every world is waiting." },
  },
};

/** When the last chapter's stamp lands: night comes, and the flag goes up one more time. */
export const FINALE_BEGINS: Line[] = [
  { wait: 2.4 },
  { say: "It's getting dark, love. Look. The mailbox flag is up again.", who: "mom", at: "mom" },
  { say: "One more letter from Dad?", who: "remi" },
];

export const LETTER_TAKEN: Line[] = [
  { wait: 0.6 },
  { say: "To Voyager 1, far from home.", who: "remi" },
  { say: "Dad's dish on the hill! It can talk to faraway things.", who: "remi" },
];

export const AIM_START: Line[] = [
  { say: "Voyager 1 is way out past all the planets. Let's find it.", who: "remi" },
  { note: "Turn the dish slowly. Listen for the beeps." },
];

/** After the letter is sent. The light-day fact is shown date-aware. */
export const SENT: Line[] = [
  { wait: 0.6 },
  { fact: "v1-launch" },
  { fact: "v1-interstellar" },
  { fact: "v1-light-day" },
  { fact: "golden-record" },
  { say: "A golden record. Like a letter from all of us.", who: "remi" },
  { say: "Wait. There's something in the dish's little box.", who: "remi" },
];

export const RECORD_FITTED: Line[] = [
  { wait: 1.0 },
  { say: "A golden record. Just like Voyager's.", who: "remi" },
  { say: "Milo? Can you talk now?", who: "remi" },
];

const SAVED = "Dad (saved message)";

/** Milo plays Dad's saved messages, then the photos Remi took. */
export const MESSAGES: Line[] = [
  { wait: 0.8 },
  { say: "Hi, kiddo. This is Dad. If you can hear this, Milo has his voice. Nice work.", who: "dad", name: SAVED },
  { say: "I put some sounds of home on this record. Rain on the workshop roof. The lamp's click. You, laughing at my jokes. Mostly at my jokes.", who: "dad", name: SAVED },
  { say: "I couldn't know every question you would ask. I just wanted to leave you a little company while you found the answers.", who: "dad", name: SAVED },
  { wait: 0.8 },
  { say: "Thanks, Dad.", who: "remi" },
  { say: "Milo is showing something new. Our trip!", who: "remi" },
  { game: "photos" },
];

export const LAST_PAGE: Line[] = [{ game: "lastpage" }, { note: "Leave the light on for whoever comes next." }];

export const STAMP: [string, string] = ["Not left behind.", "Still sending."];

export const ENDING: Line[] = [{ wait: 1.2 }, { say: "Let's keep the workshop open. For everyone.", who: "remi" }, { game: "ending" }];

/** Word chips for the next adventure's name (no free text, nothing is ever sent). */
export const NAME_WORDS: [string[], string[]] = [
  ["The Secret", "The Long", "The Bright", "The Brave", "The Tiny", "The Great"],
  ["Comet Trip", "Ocean Dive", "Star Map", "Robot Club", "Moon Garden", "Cloud Hunt"],
];
