import manifest from "../data/audio-assets.json";

/**
 * Recorded sounds (Phase 05 audio pass), on top of the sounds made in code.
 *
 * - Foley: real footsteps, pages, cloth and clicks (Kenney, CC0), several
 *   takes of each, played round robin with a little pitch drift so no two
 *   steps sound the same. The way modern games do footsteps.
 * - Instruments: single notes of a real piano, harp, ocarina, glockenspiel
 *   and hand chimes (VCSL, CC0). The score plays each note from the nearest
 *   sample, retuned by playback rate, so the music sounds played, not
 *   synthesized. Until the samples arrive, the code instruments play instead.
 * - Recordings: real sounds from NASA missions, each with a caption and a
 *   sourced fact (src/data/facts.json, rec-* ids).
 *
 * Every file is listed with its source and license in CREDITS.md and
 * src/data/credits.json. Total about 1.5 MB, fetched after the first click,
 * never on the critical path.
 */
interface SampleEntry {
  id: string;
  files: string[];
  kind: string;
}
interface InstrumentEntry {
  id: string;
  role: string;
  notes: Record<string, string>;
}
interface RecordingEntry {
  id: string;
  file: string;
  loop: boolean;
  credit: string;
  page: string;
}

const data = manifest as unknown as { samples: SampleEntry[]; instruments: InstrumentEntry[]; recordings: RecordingEntry[] };
const SAMPLES = data.samples;
const INSTRUMENTS = data.instruments;
const RECORDINGS = data.recordings;

export type InstrumentId = "piano" | "harp" | "ocarina" | "glockenspiel" | "handchimes";

export class SampleBank {
  private buffers = new Map<string, AudioBuffer>();
  private takes = new Map<string, AudioBuffer[]>();
  private turn = new Map<string, number>();
  private notes = new Map<string, { midi: number; buffer: AudioBuffer }[]>();
  private loading = new Map<string, Promise<void>>();

  constructor(
    private ctx: BaseAudioContext,
    private base = "/audio/",
  ) {}

  private async fetchBuffer(file: string): Promise<AudioBuffer | null> {
    const known = this.buffers.get(file);
    if (known) return known;
    try {
      const response = await fetch(this.base + file);
      if (!response.ok) return null;
      const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      this.buffers.set(file, buffer);
      return buffer;
    } catch {
      // A missing or broken file only means the code-made sound plays instead.
      return null;
    }
  }

  /** Loads a group once: "sfx", "inst", or a recording id. */
  load(group: string): Promise<void> {
    const known = this.loading.get(group);
    if (known) return known;
    const task = (async () => {
      if (group === "sfx") {
        await Promise.all(
          SAMPLES.map(async (s) => {
            const list = (await Promise.all(s.files.map((f) => this.fetchBuffer(f)))).filter((b): b is AudioBuffer => b !== null);
            if (list.length) this.takes.set(s.id, list);
          }),
        );
      } else if (group === "inst") {
        await Promise.all(
          INSTRUMENTS.map(async (inst) => {
            const list = await Promise.all(
              Object.entries(inst.notes).map(async ([midi, file]) => {
                const buffer = await this.fetchBuffer(file);
                return buffer ? { midi: Number(midi), buffer } : null;
              }),
            );
            const ok = list.filter((n): n is { midi: number; buffer: AudioBuffer } => n !== null).sort((a, b) => a.midi - b.midi);
            if (ok.length) this.notes.set(inst.id, ok);
          }),
        );
      } else {
        const rec = RECORDINGS.find((r) => r.id === group);
        if (rec) await this.fetchBuffer(rec.file);
      }
    })();
    this.loading.set(group, task);
    return task;
  }

  /** The next take of a sound, round robin, never the same one twice in a row. */
  take(id: string): AudioBuffer | null {
    const list = this.takes.get(id);
    if (!list?.length) return null;
    let i = ((this.turn.get(id) ?? -1) + 1 + Math.floor(Math.random() * Math.max(1, list.length - 1))) % list.length;
    if (list.length === 1) i = 0;
    this.turn.set(id, i);
    return list[i]!;
  }

  /** The nearest recorded note and how far to retune it, or null while loading. */
  note(instrument: InstrumentId, midi: number): { buffer: AudioBuffer; rate: number } | null {
    const list = this.notes.get(instrument);
    if (!list?.length) return null;
    let best = list[0]!;
    for (const n of list) if (Math.abs(n.midi - midi) < Math.abs(best.midi - midi)) best = n;
    // Too far from any sample sounds chipmunk or sludgy: let the code instrument play.
    if (Math.abs(best.midi - midi) > 7) return null;
    return { buffer: best.buffer, rate: 2 ** ((midi - best.midi) / 12) };
  }

  recording(id: string): { buffer: AudioBuffer; loop: boolean; credit: string } | null {
    const rec = RECORDINGS.find((r) => r.id === id);
    const buffer = rec ? this.buffers.get(rec.file) : undefined;
    return rec && buffer ? { buffer, loop: rec.loop, credit: rec.credit } : null;
  }
}

/** Hz to the nearest MIDI note number, with the fraction kept. */
export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);
