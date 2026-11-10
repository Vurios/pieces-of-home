/**
 * Room codes are three friendly words and a number, for example
 * "lamp-otter-comet-42". The words are picked from this list only, so a code
 * can never spell a name or a message.
 */
export const ROOM_WORDS = [
  "lamp", "otter", "comet", "maple", "pebble", "rocket", "willow", "button", "kettle", "meadow",
  "acorn", "crater", "garden", "lantern", "marble", "pepper", "pickle", "puffin", "ribbon", "rover",
  "sparrow", "teapot", "tulip", "walnut", "wombat", "zipper", "biscuit", "cactus", "dune", "ember",
  "fern", "ginger", "harbor", "island", "jelly", "koala", "lemon", "mango", "nutmeg", "orbit",
] as const;

export function makeRoomCode(random: () => number = Math.random): string {
  const pick = (): string => ROOM_WORDS[Math.floor(random() * ROOM_WORDS.length)]!;
  const words = new Set<string>();
  while (words.size < 3) words.add(pick());
  return `${[...words].join("-")}-${1 + Math.floor(random() * 99)}`;
}
