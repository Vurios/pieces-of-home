/**
 * Small pure helpers for the music and the voices. No Web Audio here, so they
 * can be unit tested.
 */

/** The next time on a grid of `step` seconds that started at `origin`, never earlier than `now`. */
export function nextGridTime(now: number, origin: number, step: number): number {
  if (step <= 0) return now;
  const steps = Math.ceil((now - origin) / step - 1e-9);
  return origin + Math.max(0, steps) * step;
}

/** The chord tone nearest to `from`, searching every octave of the chord's pitch classes. */
export function nearestChordTone(from: number, chord: readonly number[], low = 0, high = 127): number {
  let best = from;
  let bestDistance = Infinity;
  const classes = new Set(chord.map((n) => ((n % 12) + 12) % 12));
  for (let n = low; n <= high; n += 1) {
    if (!classes.has(n % 12)) continue;
    const d = Math.abs(n - from);
    if (d < bestDistance || (d === bestDistance && n < best)) {
      best = n;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * A short phrase that walks a scale by small steps from a starting note and
 * ends on a chord tone, the way someone would hum it.
 */
export function walkPhrase(scale: readonly number[], start: number, length: number, chord: readonly number[], random: () => number): number[] {
  let index = scale.findIndex((n) => n >= start);
  if (index < 0) index = scale.length - 1;
  const notes: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const r = random();
    const step = r < 0.35 ? -1 : r < 0.8 ? 1 : r < 0.92 ? 2 : -2;
    index = Math.max(0, Math.min(scale.length - 1, index + step));
    notes.push(scale[index]!);
  }
  if (notes.length > 0) notes[notes.length - 1] = nearestChordTone(notes[notes.length - 1]!, chord, scale[0], scale[scale.length - 1]);
  return notes;
}

/** A small seeded random number generator (mulberry32), for repeatable patterns. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How a line ends, for the shape of its voice. */
export type Ending = "question" | "exclaim" | "statement" | "trail";

export function endingOf(text: string): Ending {
  const t = text.trim();
  if (/\?["')\]]*$/.test(t)) return "question";
  if (/!["')\]]*$/.test(t)) return "exclaim";
  if (/(\.\.\.|…)["')\]]*$/.test(t)) return "trail";
  return "statement";
}

/**
 * The pitch of syllable `i` of `count`, in semitones from the speaker's
 * base. Speech drifts down a little over a sentence; questions rise at the
 * end, exclamations sit higher, statements fall onto the last syllable.
 */
export function contour(i: number, count: number, ending: Ending): number {
  const last = count - 1;
  const fromEnd = last - i;
  let semis = -1.4 * (count > 1 ? i / last : 0);
  if (ending === "question" && fromEnd < 3) semis += [7, 4, 2][fromEnd]!;
  if (ending === "exclaim") semis += 2.5 + (fromEnd === 0 ? 1.5 : 0);
  if (ending === "statement" && fromEnd === 0 && count > 1) semis -= 2.5;
  if (ending === "trail" && fromEnd < 2) semis -= 1.5 * (2 - fromEnd);
  return semis;
}

/** How many babble syllables a line gets: about one per three letters, never fewer than one. */
export function syllableCount(text: string, max = 40): number {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, "").length;
  return Math.max(1, Math.min(max, Math.round(letters / 3)));
}

/** Anti-spam for cues: may a cue play now, given when it last started and how many are sounding? */
export function cueAllowed(now: number, last: number, minGap: number, sounding: number, maxVoices: number): boolean {
  return now - last >= minGap && sounding < maxVoices;
}
