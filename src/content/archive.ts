import imageData from "../data/images.json";
import { type FactEntry, fact } from "./facts";
import type { NotebookImage } from "./notebook";

/**
 * Dad's archive cards (Game Bible 6, P2): small museum cards pinned up in the
 * workshop, one for each machine Dad did not build a world for. Each card has
 * a real picture with its credit, a pin on the globe, three facts and their
 * sources. The same data feeds the Field Guide.
 *
 * Every fact here is checked (facts.json); a card is only added when all of
 * its facts are. Dad's notes are his own words and make no claims.
 */
export interface ArchiveCard {
  id: string;
  /** The machine's real name. */
  name: string;
  world: "Moon" | "Mars";
  /** Where it is: a location fact with coordinates, for the pin. */
  place: FactEntry;
  image: NotebookImage;
  /** The three facts on the card, in order. */
  facts: [FactEntry, FactEntry, FactEntry];
  /** More checked facts, for the Field Guide. */
  more: FactEntry[];
  /** Dad's handwritten line at the bottom of the card. */
  note: string;
}

const images = imageData.images as NotebookImage[];
function image(id: string): NotebookImage {
  const found = images.find((i) => i.id === id);
  if (!found) throw new Error(`Unknown image "${id}"`);
  return found;
}

export const ARCHIVE: readonly ArchiveCard[] = [
  {
    id: "surveyor3",
    name: "Surveyor 3",
    world: "Moon",
    place: fact("sur3-site"),
    image: image("archive-surveyor3"),
    facts: [fact("sur3-wet-sand"), fact("sur3-last-contact"), fact("sur3-visit")],
    more: [fact("sur3-parts")],
    note: "Fancy waiting all that time, and then someone drops by.",
  },
  {
    id: "sojourner",
    name: "Sojourner",
    world: "Mars",
    place: fact("soj-site"),
    image: image("archive-sojourner"),
    facts: [fact("soj-mission"), fact("soj-size"), fact("soj-tried")],
    more: [fact("soj-lasers"), fact("soj-name"), fact("soj-images")],
    note: "Small, slow and very brave. My kind of robot.",
  },
  {
    id: "viking1",
    name: "Viking 1",
    world: "Mars",
    place: fact("vik1-site"),
    image: image("archive-viking1"),
    facts: [fact("vik1-first"), fact("vik1-scoop"), fact("vik1-last")],
    more: [fact("vik1-weather")],
    note: "It kept sending the weather report. Somebody has to.",
  },
  {
    id: "spirit",
    name: "Spirit",
    world: "Mars",
    place: fact("spi-site"),
    image: image("archive-spirit"),
    facts: [fact("spi-life"), fact("spi-wheel"), fact("spi-search")],
    more: [fact("spi-distance")],
    note: "When a wheel quit, it kept going and found something new. I like that.",
  },
  {
    id: "insight",
    name: "InSight",
    world: "Mars",
    place: fact("ins-site"),
    image: image("archive-insight"),
    facts: [fact("ins-quakes"), fact("ins-dust-trick"), fact("ins-last")],
    more: [fact("ins-landing"), fact("ins-friend")],
    note: "It listened to a whole planet. Good listeners are rare.",
  },
  {
    id: "reflectors",
    name: "The Apollo 14 and 15 mirrors",
    world: "Moon",
    place: fact("a14-lrrr-site"),
    image: image("archive-reflectors"),
    facts: [fact("a14-lrrr"), fact("a15-lrrr"), fact("lrrr-last-working")],
    more: [fact("lrrr-orange-peel"), fact("lrrr-fluid-core"), fact("lrrr-dust")],
    note: "Still saying hello back, whenever someone says hello first.",
  },
];

/** Every source on a card, without repeats, in the order they first appear. */
export function cardSources(card: ArchiveCard): { title: string; url: string }[] {
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const entry of [card.place, ...card.facts]) {
    if (seen.has(entry.sourceUrl)) continue;
    seen.add(entry.sourceUrl);
    out.push({ title: entry.sourceTitle, url: entry.sourceUrl });
  }
  return out;
}
