/**
 * Each chapter's main activity as a list of steps, for the goal card and the
 * three hint tiers (nudge, direction, show me). A step is done when its flag
 * `${activity}:${step}` is in the save. The game code in src/game/puzzles/
 * sets the flags; this file only holds the words.
 *
 * Copy rules: grade 3 to 5, no em dashes, no numbers.
 */
export interface ActivityStep {
  id: string;
  title: string;
  detail: string;
  /** Nudge, direction, show me. */
  hints: [string, string, string];
}

export interface ActivityDef {
  id: string;
  /** Lines the story director says at named moments, keyed by beat. */
  beats: Record<string, { who: "remi" | "milo"; say: string } | { note: string }>;
  steps: ActivityStep[];
}

export const SEND_A_LIGHT: ActivityDef = {
  id: "send-a-light",
  beats: {
    miss: { who: "remi", say: "It bounced away. It didn't go back to Earth." },
    "miss-two": { who: "remi", say: "Closer. But it still missed Earth." },
    home: { who: "remi", say: "Whoa! Three mirrors in a corner. It went right back to Earth!" },
    turned: { who: "remi", say: "I turned it, and the light still goes home!" },
    "turned-miss": { who: "remi", say: "Still missing. Maybe it needs more mirrors first." },
    "pulse-miss": { who: "remi", say: "Ping... but no pong. The light never came back." },
  },
  steps: [
    {
      id: "mirrors",
      title: "Build a corner of mirrors",
      detail: "One flat mirror sends the light away. Carry the other two mirrors to Dad's frame.",
      hints: [
        "Where does the light go after it hits one mirror? Can more mirrors bring it back?",
        "Two more mirrors wait on little stands near the frame. Pick one up and fit it in.",
        "Follow the paper arrow. It points to the next mirror, then back to the frame.",
      ],
    },
    {
      id: "turn",
      title: "Turn the frame",
      detail: "The light came home. Does it still come home if the corner turns?",
      hints: [
        "A good mirror trick works from any side. Let's test it.",
        "Stand by the frame and turn it a few times. Watch where the light goes.",
        "The arrow points at the frame. Use it to turn the corner.",
      ],
    },
    {
      id: "pulse",
      title: "Time the light",
      detail: "Send one blink from Dad's Earth console. Count until it comes back.",
      hints: [
        "Scientists time the light to measure how far away the Moon is.",
        "The Earth console is the little desk with a telescope. Send a light from there.",
        "Follow the arrow to the console. Send a light and listen for ping, then pong.",
      ],
    },
  ],
};

export const ACTIVITIES: Record<string, ActivityDef> = {
  [SEND_A_LIGHT.id]: SEND_A_LIGHT,
};

export const stepFlag = (activity: string, step: string): string => `${activity}:${step}`;
export const startedFlag = (activity: string): string => `${activity}:started`;
export const doneFlag = (activity: string): string => `${activity}:done`;
