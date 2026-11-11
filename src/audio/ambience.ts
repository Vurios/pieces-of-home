import { breeze, campfire, clock, crickets, dustHiss, katydids, pond, roomTone, wind } from "./buffers";
import { Loop } from "./instruments";
import type { Mixer } from "./mixer";

/**
 * Ambience, Messenger style: every layer of a world loops from the start at
 * silence, and where the player stands crossfades their levels.
 */
interface Bed {
  make: () => AudioBuffer;
  level: number;
  /** Skipped on the Low tier. */
  rich?: boolean;
}

export const SOUNDSCAPES: Record<string, Record<string, Bed[]>> = {
  home: {
    // Dad's workshop: the still air of a shed and the wall clock.
    workshop: [
      { make: () => roomTone(5, 170, 0.06), level: 1 },
      { make: () => clock(0.07), level: 1 },
    ],
    // Dusk outside: crickets and a soft breeze.
    dusk: [
      { make: () => crickets(6, 5, 0.07), level: 1 },
      { make: () => breeze(8, 0.05), level: 1, rich: true },
    ],
    hill: [{ make: () => wind(8, 420, 1300, 0.05), level: 1 }],
    pond: [{ make: () => pond(8, 0.05), level: 1, rich: true }],
    camp: [{ make: () => campfire(6, 0.06), level: 1 }],
  },
  // The real Moon is silent: there is no air to carry sound. Dad's model only has a quiet room.
  moon: { room: [{ make: () => roomTone(6, 120, 0.045), level: 1 }] },
  mars: {
    wind: [{ make: () => wind(8, 250, 800, 0.07), level: 1 }],
    dust: [{ make: () => dustHiss(6, 0.03), level: 1, rich: true }],
  },
  finale: {
    night: [
      { make: () => crickets(6, 6, 0.065), level: 1 },
      { make: () => katydids(6, 0.045), level: 1, rich: true },
    ],
  },
};

/** Buffers made once and kept, keyed by world and layer. */
const made = new Map<string, AudioBuffer[]>();

/** Makes a world's beds ahead of time, a layer at a time, so a loading page keeps moving. */
export async function prepareBeds(world: string): Promise<void> {
  const layers = SOUNDSCAPES[world];
  if (!layers) return;
  for (const [layer, beds] of Object.entries(layers)) {
    const key = `${world}/${layer}`;
    if (made.has(key)) continue;
    made.set(
      key,
      beds.map((b) => b.make()),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function bedsFor(world: string, layer: string): AudioBuffer[] {
  const key = `${world}/${layer}`;
  let buffers = made.get(key);
  if (!buffers) {
    buffers = (SOUNDSCAPES[world]?.[layer] ?? []).map((b) => b.make());
    made.set(key, buffers);
  }
  return buffers;
}

export class Ambience {
  private world: string | null = null;
  private layers = new Map<string, { loops: { loop: Loop; level: number }[]; target: number }>();

  constructor(private mx: Mixer) {}

  get current(): string | null {
    return this.world;
  }

  /** Starts a world's layers at silence and fades out the last world's. */
  setWorld(world: string | null): void {
    if (world === this.world) return;
    for (const { loops } of this.layers.values()) for (const { loop } of loops) loop.stop(1.5);
    this.layers.clear();
    this.world = world;
    if (!world) return;
    const layers = SOUNDSCAPES[world] ?? {};
    const out = this.mx.input("ambience");
    for (const [name, beds] of Object.entries(layers)) {
      const buffers = bedsFor(world, name);
      const loops: { loop: Loop; level: number }[] = [];
      beds.forEach((bed, i) => {
        if (bed.rich && this.mx.tier === "low") return;
        loops.push({ loop: new Loop(this.mx, buffers[i]!, out, 0), level: bed.level });
      });
      this.layers.set(name, { loops, target: -1 });
    }
  }

  /** Crossfades the layers to these levels (0 to 1). Missing layers fall silent. */
  setLevels(levels: Record<string, number>, seconds = 1.6): void {
    for (const [name, layer] of this.layers) {
      const target = Math.max(0, Math.min(1, levels[name] ?? 0));
      if (Math.abs(target - layer.target) < 0.02) continue;
      layer.target = target;
      for (const { loop, level } of layer.loops) loop.setLevel(target * level, seconds);
    }
  }

  /** Every layer this world has, for the audio lab. */
  names(): string[] {
    return [...this.layers.keys()];
  }
}
