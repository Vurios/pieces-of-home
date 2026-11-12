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

/** One line of a beat: Remi or Milo says something, Dad's note, or a fact card. */
export type BeatLine = { who: "remi" | "milo"; say: string } | { note: string } | { fact: string };

export interface ActivityDef {
  id: string;
  /** Lines the story director says at named moments, keyed by beat. A beat can be one line or a few. */
  beats: Record<string, BeatLine | BeatLine[]>;
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

export const WAIT_FOR_THE_WIND: ActivityDef = {
  id: "wait-for-the-wind",
  beats: {
    "no-hands": { who: "remi", say: "No hands on Mars. Nobody could wipe them there. We wait for the wind." },
    planted: { who: "remi", say: "The breeze flag is up. Dust devils follow the breeze." },
    "all-flags": { who: "remi", say: "That's all the flags. I can pull one up and move it." },
    missed: { who: "remi", say: "So close! Another dust devil will come. They always do." },
    cleaning: { who: "remi", say: "It's going right over the panels!" },
  },
  steps: [
    {
      id: "flags",
      title: "Plant breeze flags",
      detail: "Dust devils follow the breeze. Take a flag and plant it between a dust devil and the rover.",
      hints: [
        "A dust devil goes where the breeze pulls it. What could pull it toward the rover?",
        "The breeze flags lean against a rock by the rover. Take one and plant it.",
        "Follow the arrow to the flags. Plant one right next to the rover.",
      ],
    },
    {
      id: "clean",
      title: "Lead a dust devil over the panels",
      detail: "Each flag pulls a passing dust devil toward it. Make a path of flags to the rover. Another dust devil always comes.",
      hints: [
        "Watch where the dust devils go. Then put a flag in their way.",
        "Plant one flag near the dust devils' path and one right beside the rover.",
        "You can pull a flag up and plant it again. Try lining them up from the dust devils to the rover.",
      ],
    },
  ],
};

export const STEER_FROM_THE_BACK: ActivityDef = {
  id: "steer-from-the-back",
  beats: {
    ready: { who: "remi", say: "The mesh wheel with chevrons wins! Now let's drive the buggy." },
    seat: [{ who: "remi", say: "The front wheels won't turn. Only the back ones do!" }, { fact: "lrv-rear-steer" }],
    swing: { who: "remi", say: "Whoa! The back swings out when I turn." },
    edge: { who: "remi", say: "Too close! The rille is steep. Back up a little." },
    overlook: [
      { who: "remi", say: "There it is. Hadley Rille!" },
      { fact: "a15-rille-edge" },
      { who: "remi", say: "Now let's take the buggy back to its spot." },
    ],
    "park-near": { who: "remi", say: "Slow, slow... right in the lines." },
  },
  steps: [
    {
      id: "wheels",
      title: "Test Dad's wheels",
      detail: "Dad's long tray is full of soft dust. Push each wheel across. Which one grips?",
      hints: [
        "Soft dust is slippery. What kind of wheel could grip it?",
        "Dad's wheel test is the long wooden tray near the buggy.",
        "Follow the arrow to the tray, then push all three wheels.",
      ],
    },
    {
      id: "drive",
      title: "Drive to the rille",
      detail: "Sit in the driver's seat. Only the back wheels steer! Follow Dad's photo to the red flag at the rille.",
      hints: [
        "The back wheels do the steering, so the back swings out. Turn gently.",
        "Dad's taped photo shows the way. The red flag marks the edge of the rille.",
        "Follow the arrow. Hold forward and tap left or right to turn.",
      ],
    },
    {
      id: "park",
      title: "Park it back in its spot",
      detail: "Drive back and stop inside Dad's chalk marks.",
      hints: [
        "Every good driver parks the buggy where they found it.",
        "The chalk marks are next to the lander. Come in slowly.",
        "Follow the arrow to the chalk marks. Slow down when you get close and it rolls in.",
      ],
    },
  ],
};

export const ACTIVITIES: Record<string, ActivityDef> = {
  [SEND_A_LIGHT.id]: SEND_A_LIGHT,
  [STEER_FROM_THE_BACK.id]: STEER_FROM_THE_BACK,
  [WAIT_FOR_THE_WIND.id]: WAIT_FOR_THE_WIND,
};

export const stepFlag = (activity: string, step: string): string => `${activity}:${step}`;
export const startedFlag = (activity: string): string => `${activity}:started`;
export const doneFlag = (activity: string): string => `${activity}:done`;
