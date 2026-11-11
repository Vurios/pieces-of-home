import imageData from "../data/images.json";
import { type FactEntry, fact } from "./facts";

/**
 * Dad's notebook: one spread per machine. The same data feeds the in-game
 * notebook and the Field Guide, so they can never disagree.
 *
 * Only checked facts appear. A claim we could not verify yet is left out, not
 * reworded into something vaguer.
 */
export interface NotebookImage {
  id: string;
  file: string;
  title: string;
  credit: string;
  sourceUrl: string;
  alt: string;
  width: number;
  height: number;
  date: string | null;
}

export interface MachineSpread {
  id: string;
  /** What Dad calls it. */
  nickname: string;
  /** Who Dad wrote the letter to, as written on the envelope. */
  letterTo: string;
  /** Its real name. */
  name: string;
  /** Where it is. From a location fact when there is one. */
  place: FactEntry | null;
  /** Shown on the tag, for example "Moon". */
  world: "Moon" | "Mars" | "Space" | "Home";
  /** Which drawing to use. */
  drawing: "lamp" | "lrrr" | "lrv" | "opportunity" | "ingenuity" | "voyager";
  forWhat: string;
  learned: FactEntry[];
  thenNow: FactEntry[];
  deeper: FactEntry[];
  dadNote: string;
  images: NotebookImage[];
  /** Fills in (inked) once this letter or stamp is in the save. */
  completeWhen: { delivered?: string; stamp?: string };
  /** The chapter that visits it, for the Field Guide. */
  chapter: string;
}

const images = new Map((imageData.images as NotebookImage[]).map((image) => [image.id, image]));
const pics = (...ids: string[]): NotebookImage[] => ids.map((id) => images.get(id)).filter((image): image is NotebookImage => Boolean(image));

export const SPREADS: MachineSpread[] = [
  {
    id: "lamp",
    letterTo: "To the lamp",
    nickname: "The lamp",
    name: "Dad's workshop lamp",
    place: null,
    world: "Home",
    drawing: "lamp",
    forWhat: "So you never come home to a dark workshop.",
    learned: [],
    thenNow: [],
    deeper: [],
    dadNote: "I made it turn on by itself. Thanks for waiting up.",
    images: [],
    completeWhen: { delivered: "to-the-lamp" },
    chapter: "Prologue: The Workshop",
  },
  {
    id: "lrrr",
    letterTo: "To the little mirrors",
    nickname: "The little mirrors",
    name: "Apollo 11 Laser Ranging Retroreflector",
    place: fact("a11-site"),
    world: "Moon",
    drawing: "lrrr",
    forWhat: "Bouncing laser light straight back to Earth.",
    learned: [fact("a11-lrrr-placed"), fact("a11-lrrr-cubes"), fact("light-roundtrip"), fact("moon-distance"), fact("moon-recede")],
    thenNow: [fact("lrrr-still-used"), fact("a11-lrrr-nopower")],
    deeper: [fact("lrrr-others")],
    dadNote: "Send a light, get a light back. Works on the Moon. Works on your bedroom window too.",
    images: pics("apollo11-lrrr", "apollo11-lroc"),
    completeWhen: { stamp: "chapter-1" },
    chapter: "Chapter 1: Tranquility Base",
  },
  {
    id: "lrv",
    letterTo: "To the Moon buggy",
    nickname: "The Moon buggy",
    name: "Apollo 15 Lunar Roving Vehicle",
    place: fact("a15-site"),
    world: "Moon",
    drawing: "lrv",
    forWhat: "Letting astronauts drive farther than they could walk.",
    learned: [fact("lrv-wheels"), fact("a15-lrv-distance")],
    thenNow: [],
    deeper: [],
    dadNote: "You don't always steer from the front. Sometimes someone steadies you from behind.",
    images: pics("apollo15-lrv"),
    completeWhen: { stamp: "chapter-2" },
    chapter: "Chapter 2: Hadley-Apennine",
  },
  {
    id: "opportunity",
    letterTo: "To the rover who kept going",
    nickname: "The rover that kept going",
    name: "Opportunity, Mars Exploration Rover",
    place: fact("opp-site"),
    world: "Mars",
    drawing: "opportunity",
    forWhat: "A robot geologist, looking for signs of old water.",
    learned: [fact("opp-planned"), fact("opp-years"), fact("opp-distance"), fact("opp-blueberries")],
    thenNow: [],
    deeper: [],
    dadNote: "Some days are dusty. Wait for the wind.",
    images: pics("opportunity-tracks", "opportunity-blueberries"),
    completeWhen: { stamp: "chapter-3" },
    chapter: "Chapter 3: Meridiani Planum",
  },
  {
    id: "ingenuity",
    letterTo: "To the little helicopter",
    nickname: "The little helicopter",
    name: "Ingenuity Mars Helicopter",
    place: null,
    world: "Mars",
    drawing: "ingenuity",
    forWhat: "Finding out if flying on another planet could work.",
    learned: [fact("ing-first-flight"), fact("ing-72"), fact("ing-wright")],
    thenNow: [fact("ing-final"), fact("ing-testbed")],
    deeper: [],
    dadNote: "Every good flying machine carries a little piece of where it came from.",
    images: pics("ingenuity-shadow", "ingenuity-valinor"),
    completeWhen: { stamp: "chapter-4" },
    chapter: "Chapter 4: Valinor Hills",
  },
  {
    id: "voyager",
    letterTo: "To Voyager 1, far from home",
    nickname: "The farthest letter",
    name: "Voyager 1",
    place: null,
    world: "Space",
    drawing: "voyager",
    forWhat: "Carrying a message from Earth, farther away than any other machine.",
    learned: [fact("v1-light-day"), fact("golden-record")],
    thenNow: [],
    deeper: [fact("v2-light-day")],
    dadNote: "I couldn't know every question you would ask. I just wanted to leave you a little company while you found the answers.",
    images: pics("voyager"),
    completeWhen: { stamp: "finale" },
    chapter: "Finale: The Long Light",
  },
];

/** A fact's kid wording, made date-aware where the fact has a future date. */
export function factText(entry: FactEntry, today = new Date()): string {
  if (entry.id === "v1-light-day" && entry.date) {
    const when = new Date(`${entry.date}T10:16:07Z`);
    const day = formatDate(entry.date);
    if (today < when) return `On ${day}, Voyager 1 becomes the first human-made object one light-day from Earth: its signals will take a whole day to reach us.`;
    return `On ${day}, Voyager 1 became the first human-made object one light-day from Earth. Its signals now take more than a day to reach us.`;
  }
  return entry.kid;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** The year on the tag, from the first dated fact on the spread. */
export function spreadYear(spread: MachineSpread): string | null {
  const dated = spread.learned.find((entry) => entry.date);
  return dated?.date ? dated.date.slice(0, 4) : null;
}

export function isComplete(spread: MachineSpread, state: { delivered: readonly string[]; stamps: readonly string[] }): boolean {
  if (spread.completeWhen.delivered && state.delivered.includes(spread.completeWhen.delivered)) return true;
  if (spread.completeWhen.stamp && state.stamps.includes(spread.completeWhen.stamp)) return true;
  return false;
}

/** The first two pages: Dad's dedication and the contents. */
export const COVER = {
  title: "Dad's notebook",
  dedication: "For Remi. For all the questions we haven't answered yet.",
  signature: "Dad",
  contentsTitle: "The machines that stayed",
  memoriesTitle: "Memories",
  memoriesEmpty: "Deliver letters to find memories.",
};
