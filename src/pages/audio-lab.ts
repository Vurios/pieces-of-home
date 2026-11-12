/**
 * The audio lab: a plain page for people to review every sound quickly.
 * Each cue has a button, loops have a switch and a slider, and the music,
 * ambience, voices and mix can all be driven by hand. It can also record a
 * minute of whatever is playing, to listen back for clicks and harsh spots.
 */
import { SOUNDSCAPES } from "../audio/ambience";
import { audio, BUSES, type Bus } from "../audio/audio";
import { CUES } from "../audio/cues";
import { Mixer } from "../audio/mixer";
import { RECIPES } from "../audio/sfx";
import { SampleBank } from "../audio/samples";
import { speak } from "../audio/voices";
import type { Scene, StormStage } from "../audio/music";
import type { LoopHandle } from "../audio/sfx";
import facts from "../data/facts.json";

const lab = document.getElementById("lab")!;
const status = document.getElementById("status")!;

/** The real round trip of a laser pulse to the Moon's mirrors, from facts.json. */
const roundTrip = (() => {
  const fact = (facts as { facts: { id: string; value: string }[] }).facts.find((f) => f.id === "light-roundtrip");
  const match = fact ? /about ([\d.]+) s/.exec(fact.value) : null;
  return match ? Number(match[1]) : 2.5;
})();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function section(title: string, note?: string): HTMLElement {
  const box = el("section");
  box.append(el("h2", { textContent: title }));
  if (note) box.append(el("p", { textContent: note }));
  lab.append(box);
  return box;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", { type: "button", textContent: label });
  b.addEventListener("click", () => {
    void audio.unlock().then(onClick);
  });
  return b;
}

function slider(label: string, value: number, onInput: (v: number) => void): HTMLLabelElement {
  const out = el("output", { textContent: String(Math.round(value * 100)) });
  const input = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(value) });
  input.addEventListener("input", () => {
    out.textContent = String(Math.round(Number(input.value) * 100));
    onInput(Number(input.value));
  });
  return el("label", { className: "slider" }, label, input, out);
}

/** A row of buttons where one is chosen. */
function choice<T extends string | number>(options: { label: string; value: T }[], onPick: (v: T) => void): HTMLDivElement {
  const row = el("div", { className: "row" });
  const buttons = options.map(({ label, value }) => {
    const b = button(label, () => {
      for (const other of buttons) other.classList.toggle("on", other === b);
      onPick(value);
    });
    return b;
  });
  row.append(...buttons);
  return row;
}

document.getElementById("start")!.addEventListener("click", () => {
  void audio.unlock().then(() => {
    status.textContent = audio.unlocked ? "Sound is on." : "The browser kept sound off. Try again.";
  });
});
void audio.prepare();

// ---- Mix ----
const mix = section("Mix", "Bus faders as in Settings. Low quality drops the room reverb, panning and a few layers.");
const faders = el("div", { className: "grid" });
const busNames: Record<Bus, string> = { master: "Everything", music: "Music", ambience: "World sounds", effects: "Effects", voices: "Voices", ui: "Paper and menus" };
for (const bus of BUSES) faders.append(slider(busNames[bus], audio.mixer?.getVolume(bus) ?? 0.7, (v) => audio.setVolume(bus, v)));
mix.append(faders);
mix.append(el("h3", { textContent: "Quality" }), choice([{ label: "Low", value: "low" }, { label: "Medium", value: "medium" }, { label: "High", value: "high" }] as const, (tier) => audio.setTier(tier)));
let muffled = false;
const muffleButton = button("Notebook open (muffle)", () => {
  muffled = !muffled;
  audio.muffle(muffled);
  muffleButton.classList.toggle("on", muffled);
});
const recordButton = button("Record 60 seconds", () => record());
const download = el("a", { textContent: "" });
mix.append(el("h3", { textContent: "Checks" }), el("div", { className: "row" }, muffleButton, button("Voice duck", () => audio.speak("remi", "Is anyone there? Hello! Can you hear me?")), recordButton, download));

function record(): void {
  const mx = audio.mixer;
  if (!mx || typeof MediaRecorder === "undefined") return;
  const destination = mx.ctx.createMediaStreamDestination();
  mx.out.connect(destination);
  const recorder = new MediaRecorder(destination.stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);
  recorder.onstop = () => {
    mx.out.disconnect(destination);
    const blob = new Blob(chunks, { type: recorder.mimeType });
    download.href = URL.createObjectURL(blob);
    download.download = "pieces-of-home-audio.webm";
    download.textContent = "Download the recording";
    recordButton.classList.remove("on");
  };
  recorder.start();
  recordButton.classList.add("on");
  download.textContent = "Recording...";
  window.setTimeout(() => recorder.stop(), 60_000);
}

// ---- Meter and measurements ----
const meter = el("span", { id: "meter", textContent: "Meter: start sound first." });
const table = el("table");
let peak = 0;
let jump = 0;
mix.append(
  el("h3", { textContent: "Loudness" }),
  el("p", { textContent: "Live peak of everything playing (it should stay under -1 dBFS), and the biggest jump between two samples (a click shows as a sudden large jump)." }),
  el("div", { className: "row" }, meter, button("Reset meter", () => ((peak = 0), (jump = 0))), button("Measure every effect and voice", () => void measure())),
  table,
);
const db = (v: number): string => (v > 0 ? `${(20 * Math.log10(v)).toFixed(1)} dB` : "silent");
function watch(): void {
  const mx = audio.mixer;
  if (!mx) {
    requestAnimationFrame(watch);
    return;
  }
  const analyser = mx.ctx.createAnalyser();
  analyser.fftSize = 4096;
  mx.out.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  const tick = (): void => {
    analyser.getFloatTimeDomainData(data);
    for (let i = 0; i < data.length; i += 1) {
      peak = Math.max(peak, Math.abs(data[i]!));
      if (i > 0) jump = Math.max(jump, Math.abs(data[i]! - data[i - 1]!));
    }
    meter.textContent = `Peak ${db(peak)}, largest jump ${jump.toFixed(3)}`;
    meter.dataset["peak"] = String(peak);
    meter.dataset["jump"] = String(jump);
    requestAnimationFrame(tick);
  };
  tick();
}
watch();

/**
 * Renders every one-shot effect and every voice offline through a fresh mixer
 * with the default volumes, and lists its peak, its loudness and its largest
 * sample-to-sample jump.
 */
async function measure(): Promise<void> {
  const rows: { name: string; peak: number; rms: number; jump: number }[] = [];
  const render = async (name: string, play: (mx: Mixer) => void, seconds: number): Promise<void> => {
    const ctx = new OfflineAudioContext(2, Math.round(44100 * seconds), 44100);
    const mx = new Mixer(ctx as unknown as AudioContext);
    play(mx);
    const buffer = await ctx.startRendering();
    let p = 0;
    let sum = 0;
    let count = 0;
    let j = 0;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const d = buffer.getChannelData(c);
      for (let i = 1; i < d.length; i += 1) {
        const v = Math.abs(d[i]!);
        p = Math.max(p, v);
        if (v > 0.001) {
          sum += v * v;
          count += 1;
        }
        j = Math.max(j, Math.abs(d[i]! - d[i - 1]!));
      }
    }
    rows.push({ name, peak: p, rms: count ? Math.sqrt(sum / count) : 0, jump: j });
  };
  for (const [name, spec] of Object.entries(CUES)) {
    if (spec.loop) continue;
    const recipe = RECIPES[spec.recipe]!;
    await render(name, (mx) => recipe({ mx, out: mx.input(spec.bus), at: 0.05, level: spec.volume, rate: 1, param: name === "laser" ? roundTrip : 6 }), name === "laser" ? 4 : 2.5);
  }
  // Recorded takes, at the gain the game uses, so each sits at its recipe's loudness.
  const probe = new OfflineAudioContext(2, 44100, 44100);
  const bank = new SampleBank(probe);
  await bank.load("sfx");
  for (const [name, spec] of Object.entries(CUES)) {
    if (!spec.sample) continue;
    const take = bank.take(spec.sample);
    if (!take) continue;
    await render(`take: ${name}`, (mx) => {
      const source = mx.ctx.createBufferSource();
      source.buffer = take;
      source.playbackRate.value = spec.sampleRate ?? 1;
      const g = mx.ctx.createGain();
      g.gain.value = spec.volume * (spec.sampleGain ?? 0.15);
      let node: AudioNode = source;
      if (spec.sampleTone) {
        const lp = mx.ctx.createBiquadFilter();
        lp.frequency.value = spec.sampleTone;
        node = node.connect(lp);
      }
      node.connect(g).connect(mx.input(spec.bus));
      source.start(0.05);
    }, 2);
  }
  for (const [speaker, , text] of lines) await render(`voice: ${speaker}`, (mx) => speak(mx, mx.input("voices"), speaker, text, 0.05), 3);
  table.replaceChildren(
    el("tr", {}, el("th", { textContent: "Sound" }), el("th", { textContent: "Peak" }), el("th", { textContent: "Loudness (RMS)" }), el("th", { textContent: "Largest jump" })),
    ...rows.map((r) =>
      el(
        "tr",
        { className: r.peak > 0.89 || r.jump > 0.5 ? "warn" : "" },
        el("td", { textContent: r.name }),
        el("td", { textContent: db(r.peak) }),
        el("td", { textContent: db(r.rms) }),
        el("td", { textContent: r.jump.toFixed(3) }),
      ),
    ),
  );
  table.dataset["done"] = JSON.stringify(rows.map((r) => [r.name, +(20 * Math.log10(r.peak || 1e-9)).toFixed(1), +(20 * Math.log10(r.rms || 1e-9)).toFixed(1), +r.jump.toFixed(3)]));
}

// ---- Music ----
const music = section("Music", "Generative and adaptive. Changes wait for the next bar line.");
music.append(
  el("h3", { textContent: "World" }),
  choice(
    (["silent", "title", "home", "moon", "mars", "finale"] as Scene[]).map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })),
    (scene) => audio.setMusic(scene),
  ),
);
let focus = false;
const focusButton = button("Focus (puzzle)", () => {
  focus = !focus;
  audio.setFocus(focus);
  focusButton.classList.toggle("on", focus);
});
music.append(
  el("h3", { textContent: "Layers" }),
  el("div", { className: "row" }, focusButton, button("Discovery sting", () => audio.sting()), button("Finale: Milo speaks", () => audio.statement()), button("Title motif", () => [0, 1, 2, 3, 4, 5].forEach((i) => window.setTimeout(() => audio.note(i), i * 380)))),
  el("h3", { textContent: "Friends in the room" }),
  choice([0, 1, 2, 3].map((value) => ({ label: value === 0 ? "Alone" : `${value} friend${value > 1 ? "s" : ""}`, value })), (n) => audio.setFriends(n)),
  el("h3", { textContent: "The Long Storm (Chapter 3)" }),
  choice(
    [
      { label: "Thin", value: "thin" },
      { label: "Silence", value: "silence" },
      { label: "Dad's note", value: "return" },
      { label: "End", value: "end" },
    ] as const,
    (stage) => audio.storm(stage === "end" ? null : (stage as StormStage)),
  ),
);

// ---- Ambience ----
const amb = section("Ambience", "Layers loop from the start at silence; where the player stands crossfades them.");
const ambLayers = el("div", { className: "grid" });
amb.append(
  choice(
    Object.keys(SOUNDSCAPES).map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })),
    (world) => {
      audio.ambient?.setWorld(world);
      ambLayers.replaceChildren();
      const levels: Record<string, number> = {};
      for (const name of Object.keys(SOUNDSCAPES[world] ?? {})) {
        levels[name] = 0;
        ambLayers.append(
          slider(name, 0, (v) => {
            levels[name] = v;
            audio.ambient?.setLevels(levels, 0.4);
          }),
        );
      }
    },
  ),
  ambLayers,
);

// ---- Voices ----
const voices = section("Voices", "Gibberish babble with captions. Questions rise at the end.");
const caption = el("div", { className: "caption", textContent: "" });
const lines: [string, string, string][] = [
  ["remi", "Remi", "Okay. Dad's lamp first. Then the mailbox?"],
  ["nori", "Nori", "Whoa! Did you see that? Let's go!"],
  ["lumi", "Lumi", "I think the mirrors send the light back home."],
  ["theo", "Theo", "Ha! Milo did a little hop!"],
  ["mom", "Mom", "Take your time, love. I'll be right here on the porch."],
  ["dad", "Dad", "Thanks for waiting up."],
  ["milo", "Milo", "Beep? Boop!"],
];
const voiceRow = el("div", { className: "row" });
for (const [speaker, name, text] of lines) {
  voiceRow.append(
    button(name, () => {
      caption.textContent = `${name}: ${text}`;
      audio.speak(speaker, text, speaker === "dad" ? "prologue-lamp-thanks" : undefined);
    }),
  );
}
voices.append(voiceRow, caption);

// ---- Cues ----
const groups = new Map<string, HTMLElement>();
const loops = new Map<string, LoopHandle>();
const cueSection = section("Sound effects", `Every effect in the game. The laser's echo waits the real round trip: ${roundTrip} seconds.`);
for (const [name, spec] of Object.entries(CUES)) {
  let group = groups.get(spec.group);
  if (!group) {
    cueSection.append(el("h3", { textContent: spec.group }));
    group = el("div", { className: "row" });
    cueSection.append(group);
    groups.set(spec.group, group);
  }
  if (spec.loop) {
    let value = 0.7;
    const toggle = button(spec.label, () => {
      const running = loops.get(name);
      if (running) {
        running.stop();
        loops.delete(name);
        toggle.classList.remove("on");
      } else {
        const handle = audio.loop(name, value);
        if (handle) loops.set(name, handle);
        toggle.classList.add("on");
      }
    });
    const range = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(value), title: spec.loop });
    range.addEventListener("input", () => {
      value = Number(range.value);
      loops.get(name)?.set(value);
    });
    group.append(el("span", { className: "loop" }, toggle, range));
  } else {
    group.append(button(spec.label, () => audio.play(name, { param: name === "laser" ? roundTrip : name === "land" ? 6 : 0 })));
  }
}
