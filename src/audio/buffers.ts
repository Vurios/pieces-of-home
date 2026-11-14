/**
 * Looping sound beds, computed sample by sample in plain JavaScript: vinyl
 * crackle, crickets, room tone, breeze, wind, a clock, a campfire, a pond,
 * Mars dust and radio hiss.
 *
 * They need no AudioContext, so they are made while the page loads. Every
 * bed loops without a seam: events wrap round the end of the buffer, and
 * filters run twice so the end flows into the start.
 *
 * 22,050 samples a second is plenty for soft beds and keeps memory small.
 */
export const BED_RATE = 22050;

type Channels = Float32Array[];

function make(seconds: number, channels: number): { buffer: AudioBuffer; data: Channels } {
  const buffer = new AudioBuffer({ length: Math.round(seconds * BED_RATE), numberOfChannels: channels, sampleRate: BED_RATE });
  const data: Channels = [];
  for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
  return { buffer, data };
}

function white(data: Float32Array, level = 1): void {
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * level;
}

function brown(data: Float32Array, level = 1): void {
  let last = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < data.length; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      if (pass === 1) data[i] = last * 3.5 * level;
    }
  }
}

/** One-pole lowpass, run twice round the loop so its state is continuous at the seam. */
function lowpass(data: Float32Array, hz: number): void {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / BED_RATE);
  let y = 0;
  for (let i = 0; i < data.length; i += 1) y += (data[i]! - y) * k;
  for (let i = 0; i < data.length; i += 1) {
    y += (data[i]! - y) * k;
    data[i] = y;
  }
}

function highpass(data: Float32Array, hz: number): void {
  const low = Float32Array.from(data);
  lowpass(low, hz);
  for (let i = 0; i < data.length; i += 1) data[i] = data[i]! - low[i]!;
}

/** A state-variable bandpass whose centre can move: `hz(i)` is the centre at sample i. */
function bandpass(data: Float32Array, hz: (i: number) => number, q: number): void {
  let low = 0;
  let band = 0;
  const damping = 1 / q;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < data.length; i += 1) {
      const f = 2 * Math.sin((Math.PI * Math.min(hz(i), BED_RATE * 0.22)) / BED_RATE);
      low += f * band;
      const high = data[i]! - low - damping * band;
      band += f * high;
      if (pass === 1) data[i] = band;
    }
  }
}

/** A slow wobble that repeats a whole number of times per loop, so it never jumps. */
const wobble = (i: number, length: number, cycles: number, phase = 0): number => Math.sin((2 * Math.PI * cycles * i) / length + phase);

/** Adds `fn(t)` for `seconds` starting at `start` seconds, wrapping round the end. */
function addEvent(data: Float32Array, start: number, seconds: number, fn: (t: number) => number): void {
  const from = Math.round(start * BED_RATE);
  const count = Math.round(seconds * BED_RATE);
  for (let n = 0; n < count; n += 1) {
    const i = (from + n) % data.length;
    data[i] = data[i]! + fn(n / BED_RATE);
  }
}

/** Vinyl crackle: a faint hiss, many tiny ticks and the odd soft pop. */
export function crackle(seconds = 5): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  for (const ch of data) {
    white(ch, 0.012);
    lowpass(ch, 4200);
    const ticks = Math.round(seconds * 9);
    for (let k = 0; k < ticks; k += 1) {
      const amp = 0.04 + Math.random() ** 3 * 0.32;
      const sign = Math.random() < 0.5 ? -1 : 1;
      addEvent(ch, Math.random() * seconds, 0.0007, (t) => sign * amp * Math.cos(t * 9000) * (1 - t / 0.0007));
    }
    for (let k = 0; k < Math.round(seconds * 0.6); k += 1) {
      const amp = 0.12 + Math.random() * 0.12;
      addEvent(ch, Math.random() * seconds, 0.006, (t) => amp * Math.sin(t * 2400) * Math.exp(-t * 900));
    }
  }
  return buffer;
}

/** Crickets: a few insects, each with its own pitch and rhythm, chirping in short pulses. */
export function crickets(seconds = 6, count = 4, level = 0.08): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  for (let c = 0; c < count; c += 1) {
    const hz = 4000 + Math.random() * 800;
    const period = 0.55 + Math.random() * 0.5;
    const pulses = 2 + Math.floor(Math.random() * 3);
    const amp = level * (0.5 + Math.random() * 0.5);
    const pan = Math.random();
    const offset = Math.random() * period;
    for (let start = offset; start < seconds; start += period) {
      if (Math.random() < 0.25) continue;
      for (let p = 0; p < pulses; p += 1) {
        const at = start + p * 0.04;
        const env = (t: number): number => Math.sin((Math.PI * t) / 0.018) ** 2;
        addEvent(data[0]!, at, 0.018, (t) => amp * (1 - pan) * env(t) * Math.sin(2 * Math.PI * hz * t));
        addEvent(data[1]!, at, 0.018, (t) => amp * pan * env(t) * Math.sin(2 * Math.PI * hz * t));
      }
    }
  }
  return buffer;
}

/** A katydid's raspy three-part "zip", for warm summer nights (the Finale). */
export function katydids(seconds = 6, level = 0.05): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  for (let start = Math.random(); start < seconds; start += 1.3 + Math.random() * 0.8) {
    const pan = Math.random();
    for (let p = 0; p < 3; p += 1) {
      const at = start + p * 0.12;
      addEvent(data[0]!, at, 0.06, (t) => level * (1 - pan) * Math.sin((Math.PI * t) / 0.06) * (Math.random() * 2 - 1));
      addEvent(data[1]!, at, 0.06, (t) => level * pan * Math.sin((Math.PI * t) / 0.06) * (Math.random() * 2 - 1));
    }
  }
  for (const ch of data) bandpass(ch, () => 5400, 3);
  return buffer;
}

/** Room tone: the low, still sound of an indoor space. */
export function roomTone(seconds = 5, hz = 180, level = 0.05): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  for (const ch of data) {
    brown(ch, level);
    lowpass(ch, hz);
  }
  return buffer;
}

/**
 * Star twinkles: a few tiny, high bell pings from the G major pentatonic,
 * scattered far apart and mostly in one ear or the other, like stars
 * winking. Cute, not cold: no drone underneath.
 */
export function twinkles(seconds = 9, count = 7, level = 0.03): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  const notes = [79, 81, 83, 86, 88, 91, 93];
  for (let k = 0; k < count; k += 1) {
    const hz = 440 * 2 ** ((notes[Math.floor(Math.random() * notes.length)]! - 69) / 12);
    const at = (k + Math.random() * 0.7) * (seconds / count);
    const pan = Math.random();
    const amp = level * (0.6 + Math.random() * 0.4);
    data.forEach((ch, c) => {
      const side = c === 0 ? 1 - pan * 0.7 : 0.3 + pan * 0.7;
      addEvent(ch, at, 1.2, (t) => amp * side * Math.exp(-t * 4.5) * (Math.sin(2 * Math.PI * hz * t) + 0.25 * Math.sin(2 * Math.PI * hz * 2.76 * t) * Math.exp(-t * 18)));
    });
  }
  return buffer;
}

/** A soft evening breeze: pink-ish noise that swells and settles. */
export function breeze(seconds = 8, level = 0.05): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  data.forEach((ch, c) => {
    white(ch, 1);
    lowpass(ch, 900);
    lowpass(ch, 1400);
    for (let i = 0; i < ch.length; i += 1) {
      const swell = 0.55 + 0.3 * wobble(i, ch.length, 2, c * 0.8) + 0.15 * wobble(i, ch.length, 5, 1.3);
      ch[i] = ch[i]! * level * 3 * Math.max(0.1, swell);
    }
  });
  return buffer;
}

/** Wind: noise through a bandpass that sweeps between `low` and `high` Hz, with gusts. */
export function wind(seconds = 8, low = 300, high = 1100, level = 0.06): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  data.forEach((ch, c) => {
    white(ch, 1);
    const length = ch.length;
    bandpass(ch, (i) => low + (high - low) * (0.5 + 0.35 * wobble(i, length, 3, c) + 0.15 * wobble(i, length, 7, 2)), 1.4);
    for (let i = 0; i < length; i += 1) {
      const gust = 0.6 + 0.4 * wobble(i, length, 2, c * 1.7);
      ch[i] = ch[i]! * level * 2.4 * gust;
    }
  });
  return buffer;
}

/** A wall clock: tick on the second, a lower tock on the next. */
export function clock(level = 0.06): AudioBuffer {
  const { buffer, data } = make(2, 1);
  const ch = data[0]!;
  for (const [at, hz] of [
    [0.02, 3100],
    [1.02, 2500],
  ] as const) {
    addEvent(ch, at, 0.03, (t) => level * Math.exp(-t * 260) * (Math.sin(2 * Math.PI * hz * t) + (t < 0.0015 ? Math.random() * 2 - 1 : 0)));
  }
  return buffer;
}

/** A campfire: a low roar that flickers, with crackles and pops. */
export function campfire(seconds = 6, level = 0.06): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  data.forEach((ch, c) => {
    brown(ch, level * 1.4);
    lowpass(ch, 500);
    for (let i = 0; i < ch.length; i += 1) ch[i] = ch[i]! * (0.7 + 0.3 * wobble(i, ch.length, 9, c));
    for (let k = 0; k < seconds * 7; k += 1) {
      const amp = level * (0.6 + Math.random() * 2.2);
      const ring = 1500 + Math.random() * 2500;
      addEvent(ch, Math.random() * seconds, 0.012, (t) => amp * Math.exp(-t * 500) * Math.sin(2 * Math.PI * ring * t) * (Math.random() * 0.6 + 0.4));
    }
  });
  return buffer;
}

/** A pond: gentle lapping water, a few bubbles and a frog now and then. */
export function pond(seconds = 8, level = 0.05): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  data.forEach((ch, c) => {
    brown(ch, 1);
    const length = ch.length;
    bandpass(ch, () => 520, 1.1);
    for (let i = 0; i < length; i += 1) ch[i] = ch[i]! * level * 6 * (0.5 + 0.5 * Math.max(0, wobble(i, length, 6, c)) ** 2);
    for (let k = 0; k < 3; k += 1) {
      addEvent(ch, Math.random() * seconds, 0.05, (t) => level * 0.8 * Math.sin(2 * Math.PI * (600 + 14000 * t) * t) * Math.sin((Math.PI * t) / 0.05));
    }
  });
  // A frog: a buzzy croak of quick pulses, once or twice a loop.
  for (let k = 0; k < 2; k += 1) {
    const at = Math.random() * seconds;
    const pan = Math.random();
    const croak = (t: number): number => level * 1.6 * Math.sin((Math.PI * t) / 0.32) * (Math.sin(2 * Math.PI * 23 * t) > 0 ? 1 : 0.15) * Math.sin(2 * Math.PI * 170 * t);
    addEvent(data[0]!, at, 0.32, (t) => croak(t) * (1 - pan));
    addEvent(data[1]!, at, 0.32, (t) => croak(t) * pan);
  }
  return buffer;
}

/** Mars dust: a thin, high hiss of grains on the wind. */
export function dustHiss(seconds = 6, level = 0.03): AudioBuffer {
  const { buffer, data } = make(seconds, 2);
  data.forEach((ch, c) => {
    white(ch, 1);
    highpass(ch, 2600);
    for (let i = 0; i < ch.length; i += 1) ch[i] = ch[i]! * level * (0.6 + 0.4 * wobble(i, ch.length, 3, c * 2));
  });
  return buffer;
}

/** Radio hiss between stations, with a faint whistle that drifts. */
export function radioHiss(seconds = 4, level = 0.05): AudioBuffer {
  const { buffer, data } = make(seconds, 1);
  const ch = data[0]!;
  white(ch, 1);
  bandpass(ch, () => 1800, 0.6);
  let phase = 0;
  for (let i = 0; i < ch.length; i += 1) {
    phase += (2 * Math.PI * (1400 + 500 * wobble(i, ch.length, 1))) / BED_RATE;
    ch[i] = ch[i]! * level * 1.6 + Math.sin(phase) * level * 0.08;
  }
  return buffer;
}
