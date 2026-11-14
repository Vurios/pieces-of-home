/**
 * The short story that plays before a new story starts (Game Bible 5.1).
 * Each page is one of Dad's drawings with one or two short lines under it.
 * Grade 3 to 5 wording, clear words about Dad's death (Game Bible 5.9),
 * no em dashes, no numbers.
 */
export type StoryArt = "home" | "bench" | "door" | "letters" | "milo" | "go";

export interface StoryPage {
  art: StoryArt;
  text: string;
}

export const STORY = {
  label: "The story so far",
  next: "Next",
  begin: "Let's go",
  skip: "Skip story",
  pages: [
    { art: "home", text: "This is Home, a tiny round world at dusk. Remi and Mom have come back to Dad's workshop." },
    { art: "bench", text: "Dad loved to build things. A lamp that turns on by itself. A little robot. Tiny worlds under glass." },
    { art: "door", text: "Dad died last spring. Tonight, Remi opens Dad's workshop for the first time since then." },
    { art: "letters", text: "Inside are letters Dad wrote but never sent. Each one is for a machine people left behind, on the Moon, on Mars and far out in space." },
    { art: "milo", text: "And Milo, Dad's robot, is still in pieces on the bench." },
    { art: "go", text: "So Remi makes a plan. Deliver Dad's letters. Finish Milo. Start with the mailbox." },
  ] satisfies StoryPage[],
} as const;

/**
 * "Your adventure": the card after the story that says what the game is about
 * and what to do, in three steps, with the keys that matter.
 */
export const ADVENTURE = {
  kicker: "How it works",
  title: "Your adventure",
  /** The heart of the game, said first: the machines and their true stories. */
  goal: "People left machines on the Moon and Mars. They are not forgotten. Meet them, and learn their true stories.",
  steps: [
    { title: "Find Dad's letters", text: "Mom has the key. Dad's first letter is waiting in the mailbox." },
    { title: "Visit the real machines", text: "Each glass dome on Dad's bench is a little model of a real place. Look into one to go inside." },
    { title: "Learn and finish Milo", text: "Read each True Story. Every machine you meet gives Milo a new part." },
  ],
  help: "Follow the paper arrow and the note in the corner. Stuck? Press H for a hint. Nothing can go wrong, so take your time.",
  keysLabel: "Keys",
  keys: [
    { key: "WASD", label: "walk" },
    { key: "E", label: "use" },
    { key: "N", label: "notebook" },
    { key: "M", label: "map" },
    { key: "H", label: "hint" },
  ],
  go: "Let's go!",
};

/** The four kids' names, for name tags and co-op character select. */
export const KID_NAMES: Record<"remi" | "nori" | "lumi" | "theo", string> = { remi: "Remi", nori: "Nori", lumi: "Lumi", theo: "Theo" };
