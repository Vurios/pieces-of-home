import type { Bus } from "./mixer";

/**
 * Every named sound the game can play, with its mix settings. A cue points at
 * a recipe in sfx.ts (one-shots) or a loop in LOOPS (sounds that keep going).
 *
 * - `volume`: loudness before the bus fader.
 * - `pitch`: random pitch change, as a fraction (0.05 is about a semitone).
 * - `vary`: random loudness drop, as a fraction.
 * - `minGap`: seconds before the same cue may start again (anti-spam).
 * - `maxVoices`: how many may sound at once.
 * - `length`: about how long one lasts, for counting voices.
 * - `sample`: a recorded sound (src/audio/samples.ts) that plays instead of
 *   the recipe once loaded, a different take each time. `layer` plays both.
 */
export interface CueSpec {
  recipe: string;
  bus: Exclude<Bus, "master">;
  volume: number;
  pitch?: number;
  vary?: number;
  minGap?: number;
  maxVoices?: number;
  length?: number;
  /** For the audio lab. */
  group: string;
  label: string;
  /** Loops have a control from 0 to 1, named here. */
  loop?: string;
  /** Recorded takes to use instead of the recipe (see samples.ts). */
  sample?: string;
  /** Gain on the recording, to sit at the recipe's loudness. */
  sampleGain?: number;
  /** Playback rate on the recording: below 1 is lower and heavier. */
  sampleRate?: number;
  /** A lowpass on the recording, in Hz, for muffled ground like Moon dust. */
  sampleTone?: number;
  /** Play the recording and the recipe together. */
  layer?: boolean;
}

const step = (surface: string, label: string, volume: number, sample?: Pick<CueSpec, "sample" | "sampleGain" | "sampleRate" | "sampleTone">): CueSpec => ({
  recipe: `step-${surface}`,
  bus: "effects",
  volume,
  pitch: 0.09,
  vary: 0.3,
  minGap: 0.07,
  maxVoices: 3,
  length: 0.15,
  group: "Feet",
  label,
  ...sample,
});

export const CUES: Record<string, CueSpec> = {
  "lamp-click": { recipe: "lamp-click", bus: "effects", volume: 1, pitch: 0.04, group: "Home", label: "Lamp click" },
  "lamp-hum": { recipe: "lamp-hum", bus: "ambience", volume: 1, group: "Home", label: "Lamp hum", loop: "brightness" },
  "page-flip": { recipe: "page-flip", bus: "ui", volume: 0.8, pitch: 0.08, vary: 0.15, minGap: 0.08, group: "Paper", label: "Page flip", sample: "page", sampleGain: 0.3 },
  "book-open": { recipe: "page-flip", bus: "ui", volume: 0.8, minGap: 0.2, group: "Paper", label: "Notebook opens", sample: "book-open", sampleGain: 0.21 },
  "book-close": { recipe: "page-flip", bus: "ui", volume: 0.8, minGap: 0.2, group: "Paper", label: "Notebook closes", sample: "book-close", sampleGain: 0.21 },
  pencil: { recipe: "pencil", bus: "ui", volume: 1.1, pitch: 0.05, minGap: 0.3, group: "Paper", label: "Pencil scribble" },
  tape: { recipe: "tape", bus: "ui", volume: 1.3, pitch: 0.06, minGap: 0.2, group: "Paper", label: "Tape" },
  stamp: { recipe: "stamp", bus: "ui", volume: 1, pitch: 0.03, minGap: 0.3, group: "Paper", label: "Ink stamp" },
  toast: { recipe: "toast", bus: "ui", volume: 1, pitch: 0.06, minGap: 0.15, group: "Paper", label: "Paper toast" },
  tick: { recipe: "tick", bus: "ui", volume: 1, pitch: 0.04, minGap: 0.03, group: "Paper", label: "Menu tick", sample: "ui-click", sampleGain: 0.13 },
  pop: { recipe: "pop", bus: "ui", volume: 0.8, pitch: 0.06, minGap: 0.05, group: "Paper", label: "Menu pop", sample: "ui-pop", sampleGain: 0.28 },

  "step-wood": step("wood", "Step on wood", 0.55, { sample: "step-wood", sampleGain: 0.26 }),
  "step-grass": step("grass", "Step on grass", 1, { sample: "step-grass", sampleGain: 0.21 }),
  "step-path": step("path", "Step on the path", 1.1, { sample: "step-gravel", sampleGain: 0.28 }),
  "step-water": step("water", "Step in shallow water", 0.75),
  "step-regolith": step("regolith", "Step on Moon regolith", 1.1, { sample: "step-snow", sampleGain: 0.14, sampleRate: 0.82, sampleTone: 2600 }),
  "step-dust": step("dust", "Step on Mars dust", 1.5, { sample: "step-snow", sampleGain: 0.093, sampleRate: 0.9, sampleTone: 3400 }),
  jump: { recipe: "jump", bus: "effects", volume: 1.4, pitch: 0.08, minGap: 0.15, group: "Feet", label: "Jump" },
  land: { recipe: "land", bus: "effects", volume: 0.8, pitch: 0.05, minGap: 0.12, group: "Feet", label: "Land", sample: "land-soft", sampleGain: 0.3, layer: true },
  "regolith-puff": { recipe: "regolith-puff", bus: "effects", volume: 0.7, pitch: 0.1, minGap: 0.1, group: "Feet", label: "Regolith puff" },

  "envelope-pickup": { recipe: "envelope-pickup", bus: "effects", volume: 0.9, group: "Letters", label: "Pick up a letter", sample: "cloth", sampleGain: 0.3, layer: true },
  "delivery-chime": { recipe: "delivery-chime", bus: "effects", volume: 0.7, group: "Letters", label: "Deliver a letter" },
  discovery: { recipe: "discovery", bus: "music", volume: 0.9, minGap: 1, group: "Letters", label: "Discovery sting" },

  "milo-boot": { recipe: "milo-boot", bus: "effects", volume: 0.9, group: "Milo", label: "Boot up" },
  "milo-happy": { recipe: "milo-happy", bus: "effects", volume: 0.8, pitch: 0.06, minGap: 0.4, group: "Milo", label: "Happy" },
  "milo-curious": { recipe: "milo-curious", bus: "effects", volume: 0.8, pitch: 0.08, minGap: 0.4, group: "Milo", label: "Curious" },
  "milo-sleepy": { recipe: "milo-sleepy", bus: "effects", volume: 0.8, minGap: 1, group: "Milo", label: "Sleepy (solar nap)" },
  "milo-hop": { recipe: "milo-hop", bus: "effects", volume: 0.8, pitch: 0.06, minGap: 0.3, group: "Milo", label: "Hop" },
  "part-clunk": { recipe: "part-clunk", bus: "effects", volume: 1, minGap: 0.5, group: "Milo", label: "Part clicks into place" },

  laser: { recipe: "laser", bus: "effects", volume: 0.8, minGap: 0.5, length: 3.5, group: "Chapter 1", label: "Laser ping and pong" },
  "laser-ping": { recipe: "laser-ping", bus: "effects", volume: 0.8, minGap: 0.3, group: "Chapter 1", label: "Laser ping (sent)" },
  "laser-pong": { recipe: "laser-pong", bus: "effects", volume: 0.85, minGap: 0.3, group: "Chapter 1", label: "Laser pong (came home)" },
  "mirror-snap": { recipe: "mirror-snap", bus: "effects", volume: 0.9, pitch: 0.05, minGap: 0.1, group: "Chapter 1", label: "Mirror panel snap", sample: "metal-click", sampleGain: 0.27, layer: true },
  "shed-open": { recipe: "tick", bus: "effects", volume: 0.9, minGap: 0.6, group: "Home", label: "Workshop front swings down", sample: "creak", sampleGain: 0.16 },
  "shed-close": { recipe: "tick", bus: "effects", volume: 0.9, minGap: 0.6, group: "Home", label: "Workshop front swings up", sample: "door-close", sampleGain: 0.16 },
  latch: { recipe: "tick", bus: "effects", volume: 0.9, minGap: 0.3, group: "Home", label: "Latch", sample: "latch", sampleGain: 0.2 },
  "corner-sparkle": { recipe: "corner-sparkle", bus: "effects", volume: 0.65, minGap: 0.5, group: "Chapter 1", label: "Corner cube clicks home" },

  "wheel-crunch": { recipe: "wheel-crunch", bus: "effects", volume: 1.4, pitch: 0.06, minGap: 0.3, group: "Chapter 2", label: "Mesh wheel crunch" },
  "motor-whine": { recipe: "motor-whine", bus: "effects", volume: 1, group: "Chapter 2", label: "Rover motor", loop: "speed" },
  servo: { recipe: "servo", bus: "effects", volume: 1.7, pitch: 0.05, minGap: 0.2, group: "Chapter 2", label: "Steering servo" },

  grinder: { recipe: "grinder", bus: "effects", volume: 1, group: "Chapter 3", label: "Rock grinder", loop: "pressure" },
  "microscope-focus": { recipe: "microscope-focus", bus: "effects", volume: 0.8, minGap: 0.3, group: "Chapter 3", label: "Microscope focus" },
  "dust-devil": { recipe: "dust-devil", bus: "ambience", volume: 1, group: "Chapter 3", label: "Dust devil", loop: "strength" },
  "solar-rise": { recipe: "solar-rise", bus: "effects", volume: 0.9, minGap: 1, group: "Chapter 3", label: "Solar power rises" },
  "call-blip": { recipe: "call-blip", bus: "effects", volume: 0.8, minGap: 0.06, maxVoices: 4, group: "Chapter 3", label: "Call signal" },

  rotor: { recipe: "rotor", bus: "effects", volume: 1, group: "Chapter 4", label: "Rotor whir", loop: "spin" },
  "hover-hop": { recipe: "hover-hop", bus: "effects", volume: 0.9, minGap: 0.4, group: "Chapter 4", label: "Hover hop" },
  "rocket-launch": { recipe: "rocket-launch", bus: "effects", volume: 0.8, group: "Trips", label: "Rocket lift-off" },
  "rocket-land": { recipe: "rocket-land", bus: "effects", volume: 0.8, group: "Trips", label: "Rocket landing" },

  "dish-servo": { recipe: "dish-servo", bus: "effects", volume: 0.9, minGap: 1, group: "Finale", label: "Dish servo" },
  "radio-hiss": { recipe: "radio-hiss", bus: "ambience", volume: 1, group: "Finale", label: "Radio hiss", loop: "level" },
  "record-crackle": { recipe: "record-crackle", bus: "music", volume: 1, group: "Finale", label: "Record crackle", loop: "level" },
  "needle-drop": { recipe: "needle-drop", bus: "effects", volume: 0.9, minGap: 1, group: "Finale", label: "Needle drop" },

  shutter: { recipe: "shutter", bus: "effects", volume: 0.9, minGap: 0.2, group: "Together", label: "Camera shutter" },
  "polaroid-whirr": { recipe: "polaroid-whirr", bus: "effects", volume: 1.6, minGap: 0.5, group: "Together", label: "Instant photo whirr" },
  "emote-pop": { recipe: "emote-pop", bus: "ui", volume: 0.8, pitch: 0.08, minGap: 0.1, group: "Together", label: "Emote pop" },
  "join-chime": { recipe: "join-chime", bus: "ui", volume: 0.8, minGap: 0.5, group: "Together", label: "A friend joins" },
  "leave-chime": { recipe: "leave-chime", bus: "ui", volume: 0.8, minGap: 0.5, group: "Together", label: "A friend leaves" },
};

/** Footstep cue for a surface name from the world. */
export function stepCue(surface: string): string {
  switch (surface) {
    case "wood":
      return "step-wood";
    case "grass":
      return "step-grass";
    case "water":
      return "step-water";
    case "regolith":
      return "step-regolith";
    case "dust":
      return "step-dust";
    default:
      return "step-path";
  }
}
