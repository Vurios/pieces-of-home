/**
 * The motif: six notes, first heard as the title letters land, then woven
 * through every world's music.
 *
 *     G4  B4  D5 | E5 ... D5 | G5 ~~~~~~~~
 *     .5  .5  1    1.5   .5    4          (beats)
 *
 * Its shape: three quick steps up a G major chord, like a switch clicking on;
 * a reach up to E (the warm sixth, a "what if?"); one step back to D; then a
 * leap to the high G that holds, like coming home. It spans exactly two bars
 * of 4/4. It rises like a question and lands like an answer.
 *
 * Every note sits in the G major pentatonic scale (G A B D E), so the same
 * six notes sound right over Home's major sevenths, inside Mars's pentatonic
 * phrases and as glassy bells on the Moon, without any wrong notes.
 */
export const MOTIF = [67, 71, 74, 76, 74, 79] as const;

/** How long each motif note lasts, in beats. Two bars of 4/4 in all. */
export const MOTIF_BEATS = [0.5, 0.5, 1, 1.5, 0.5, 4] as const;

/**
 * The answer: the motif turned upside down and walked back home, used when a
 * friend's counter-melody replies, and on Dad's margin notes.
 */
export const ANSWER = [79, 76, 74, 71, 74, 67] as const;

/** G major pentatonic across the useful range, for improvised phrases. */
export const PENTATONIC = [43, 45, 47, 50, 52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76, 79, 81, 83, 86, 88] as const;

export const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12);

/** The motif's notes with start offsets in beats, optionally moved by octaves and slowed down. */
export function motifEvents(
  notes: readonly number[] = MOTIF,
  { octave = 0, stretch = 1 }: { octave?: number; stretch?: number } = {},
): { note: number; beat: number; beats: number }[] {
  let beat = 0;
  return notes.map((note, i) => {
    const beats = (MOTIF_BEATS[i] ?? 1) * stretch;
    const event = { note: note + octave * 12, beat, beats };
    beat += beats;
    return event;
  });
}
