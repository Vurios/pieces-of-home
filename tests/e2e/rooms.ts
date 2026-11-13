import { ROOM_WORDS } from "../../src/net/words";

/**
 * A fresh room code for a test: three different words from the kid-safe list
 * and a number. `salt` keeps rooms apart when tests run side by side.
 */
export function testRoom(salt = 0): string {
  const words = new Set<string>();
  let n = Date.now() + salt * 7919 + Math.floor(Math.random() * 1e6);
  while (words.size < 3) {
    words.add(ROOM_WORDS[n % ROOM_WORDS.length]!);
    n = Math.floor(n / ROOM_WORDS.length) + 13 + words.size;
  }
  return `${[...words].join("-")}-${1 + Math.floor(Math.random() * 99)}`;
}
