import { ARCHIVE } from "./archive";
import type { FactEntry } from "./facts";
import { SPREADS } from "./notebook";

/**
 * Words for the Field Guide and the About page. In the game both open as
 * panels (Field Guide from the menu, About inside Credits). The same words
 * also build a plain HTML Field Guide for computers without 3D, so it still
 * works with a screen reader and on paper.
 *
 * Grade 3 to 5 wording for the story parts. The notes for grown-ups can go a
 * little higher. No numbers or claims here: those come from facts.json.
 */
export const GUIDE = {
  title: "Pieces of Home: Field Guide",
  kicker: "For families and classrooms",
  lede: "The whole story and every fact from the game, on one page. It works without 3D, with a screen reader, and on paper.",
  print: "Print this guide",
  gameLede: "The whole story and every fact from the game, for families and classrooms.",
  startHere: "Start here",
  more: "More to read",
  printHint: "This prints the whole guide: the story, every machine and every source.",
  printShort: "Print",
  pickOne: "Pick a machine to start",
  play: "Play the game",
  about: "About this game",
  contents: "In this guide",
  storyTitle: "The story",
  story: [
    "Remi is 11. Their dad died last spring. One evening, Remi and Mom go back to Dad's workshop for the first time since then. Mom waits on the porch.",
    "Inside, Dad's desk lamp clicks on by itself. Dad built it to do that every evening, so you never come home to a dark workshop.",
    "On the workbench sits Milo, a little robot Dad never finished. There are glass domes with tiny worlds inside, and a notebook for Remi. Tucked in the notebook are letters Dad wrote and never sent. Each one is addressed to a machine that people left on the Moon, on Mars, or far out in space.",
    "Remi decides to deliver the letters and to finish Milo. Friends can come along.",
  ],
  modelsTitle: "About the little worlds",
  models:
    "Each world in the game is one of Dad's models of a real place. Models are not to scale, so the distances are squeezed. The real numbers are in this guide, and every one has a link to where it comes from.",
  machinesTitle: "The machines",
  archiveTitle: "Dad's archive",
  archiveLede: "Dad never built little worlds for these machines, but he kept a card for each one. In the game they are pinned up in the workshop.",
  forWhat: "What it was for",
  learned: "What we learned",
  thenNow: "Then and now",
  deeper: "Deeper notes",
  dadSays: "Dad's note",
  sketch: "Dad's sketch. Not to scale.",
  where: "Where it is",
  photoBy: "Photo",
  source: "Source",
  sourcesTitle: "Sources",
  sourcesLede: "Every fact in the game, with where it comes from and the day we last checked it.",
  checked: "checked",
  creditsTitle: "Pictures, fonts and code",
  forClassTitle: "Using this in class",
  forClass: [
    "Read one machine at a time. Each one fits on a page or two.",
    "Ask: what was it built to do, and what is it still doing?",
    "Every number has a source link. Older kids can open the source and check it.",
  ],
  notEndorsed: "NASA images are credited. NASA did not make, sponsor or endorse this game.",
};

export const ABOUT = {
  title: "About Pieces of Home",
  kicker: "About the game",
  lede: "A cozy game for 1 to 4 players. Deliver a dad's letters to the machines people left on the Moon and Mars, and finish the little robot he started.",
  madeTitle: "Who made it",
  made: "A small team made it as a learning game about the machines people left behind in space, and why they still matter.",
  playTitle: "How to play",
  play: [
    "Walk with WASD or the arrow keys. On a phone, use the stick on the screen.",
    "Press E, or tap the button that appears, to look at things and pick them up.",
    "Open Dad's notebook with N. It fills in as you deliver letters.",
  ],
  safeTitle: "Safe to play together",
  safe: "There is no chat, no voice, no names and no accounts. Friends join with a room code and talk with picture emotes and a few friendly phrases. Progress is saved only in your own browser. There are no ads and no trackers.",
  grownTitle: "For grown-ups",
  grown: [
    "The story includes the death of a parent. It is gentle. There is no illness on screen, nothing scary, and nobody is blamed.",
    "Some kids may want to talk afterward. You can ask what they noticed, what they would put in a letter, or who they would leave the light on for. Let them lead, and it is fine to say you miss someone too.",
    "This game is not therapy and does not claim to help with grief. If a child is struggling, a school counselor or family doctor is a good place to start.",
  ],
  factsTitle: "Facts and honesty",
  facts: "Every number in the game comes from a list of checked facts, and every fact links to its source. The little worlds are models and are labeled that way. Real photos carry their credit lines.",
  guideLink: "Read the Field Guide",
  creditsLink: "See every credit",
};

/** Every fact the Field Guide shows, in the order it first shows them, for the numbered source list. */
export function guideFacts(): FactEntry[] {
  const seen = new Map<string, FactEntry>();
  for (const spread of SPREADS) {
    for (const entry of [...(spread.place ? [spread.place] : []), ...spread.learned, ...spread.thenNow, ...spread.deeper]) seen.set(entry.id, entry);
  }
  for (const card of ARCHIVE) for (const entry of [card.place, ...card.facts, ...card.more]) seen.set(entry.id, entry);
  return [...seen.values()];
}
