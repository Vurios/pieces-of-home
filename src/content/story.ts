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
