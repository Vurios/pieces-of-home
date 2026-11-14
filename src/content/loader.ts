/**
 * Words on the loading page. The page is drawn into `index.html` at build
 * time, so it shows before any JavaScript runs.
 *
 * The page is Dad's notebook, held open in his dark workshop. Behind it is
 * the game's own 3D workshop, drawn by the game itself (see
 * `scripts/render-backdrop.ts`). On the left page his sketch of the desk lamp
 * draws itself as the game loads, with his notes beside each part. On the
 * right page the title drops in, and a pencil ticks off "Things that kept
 * working". When everything is ready, a light switch waits. The notebook
 * closes, the live workshop takes the picture's place, and Dad's lamp clicks
 * on in 3D.
 *
 * "Things that kept working" fills in one line per loading milestone. Each
 * line is a fact's short wording, so it carries a source like every number
 * in the game.
 */
export const LOADER = {
  kicker: "Left behind. Still shining.",
  title: "Pieces of Home",
  /** The cover, the same as the notebook in the game. */
  cover: "Dad's notebook",
  coverFor: "For Remi",
  /** The left page: Dad's drawing of his lamp. */
  tag: "Home",
  page: "The lamp",
  pageNote: "Dad's workshop lamp",
  heading: "Things that kept working",
  lines: ["{F:a11-lrrr-cubes}", "{F:v1-light-day}", "{F:ing-testbed}"],
  last: "This lamp.",
  /** Dad's notes beside each part of the drawing, in drawing order: base, arm, pivots, shade, bulb. */
  parts: [["weighted base"], ["spring arm"], ["pivots"], ["shade"], ["turns on by itself", "every evening"]],
  travel: ["home", "the Moon", "Mars"],
  loading: "Loading",
  ready: "For all the questions we haven't answered yet.",
  prompt: "Turn on the light",
  promptHint: "Click, tap or press any key",
  slow: "Still loading. The lamp is warming up.",
  noWebgl: "This computer can't draw the 3D worlds. You can still read the whole story, with every machine and every fact.",
  noWebglLink: "Open the Field Guide",
  milestones: ["Little worlds built.", "Pictures loaded.", "Sounds ready.", "Notebook ready."],
} as const;
