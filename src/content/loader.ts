/**
 * Words on the loading page. The page is drawn into `index.html` at build
 * time, so it shows before any JavaScript runs.
 *
 * "Things that kept working" fills in one line per loading milestone. Each
 * line is a fact's short wording, so it carries a source like every number
 * in the game.
 */
export const LOADER = {
  heading: "Things that kept working",
  lines: ["{F:a11-lrrr-cubes}", "{F:v1-light-day}", "{F:ing-testbed}"],
  last: "This lamp.",
  ready: "For all the questions we haven't answered yet.",
  prompt: "Turn on the light",
  promptHint: "Click, tap or press any key",
  slow: "Still loading. The lamp is warming up.",
  noWebgl: "This computer can't draw the 3D worlds. You can still read the whole story, with every machine and every fact.",
  noWebglLink: "Open the Field Guide",
  milestones: ["Little worlds built.", "Pictures loaded.", "Sounds ready.", "Notebook ready."],
} as const;
