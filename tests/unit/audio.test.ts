import { describe, expect, it } from "vitest";
import { CUES, stepCue } from "../../src/audio/cues";
import { ANSWER, MOTIF, MOTIF_BEATS, PENTATONIC, motifEvents } from "../../src/audio/motif";
import { ARRANGEMENTS } from "../../src/audio/music";
import { LOOPS, RECIPES } from "../../src/audio/sfx";
import { contour, cueAllowed, endingOf, nearestChordTone, nextGridTime, seeded, syllableCount, walkPhrase } from "../../src/audio/theory";
import { VOICES, planLine } from "../../src/audio/voices";

describe("the motif", () => {
  it("is six notes that fill exactly two bars of 4/4", () => {
    expect(MOTIF).toHaveLength(6);
    expect(MOTIF_BEATS).toHaveLength(6);
    expect(MOTIF_BEATS.reduce((a, b) => a + b, 0)).toBe(8);
  });

  it("rises like a question and lands on the high tonic", () => {
    expect(MOTIF[0]! % 12).toBe(7); // G
    expect(MOTIF[5]).toBe(MOTIF[0]! + 12);
    expect(Math.max(...MOTIF) - Math.min(...MOTIF)).toBeLessThanOrEqual(12);
  });

  it("uses only notes from G major pentatonic, so it fits every world", () => {
    const classes = new Set(PENTATONIC.map((n) => n % 12));
    for (const note of [...MOTIF, ...ANSWER]) expect(classes.has(note % 12)).toBe(true);
  });

  it("lays out events back to back and stretches them", () => {
    const events = motifEvents(MOTIF, { stretch: 2, octave: 1 });
    expect(events[0]).toEqual({ note: MOTIF[0]! + 12, beat: 0, beats: 1 });
    expect(events[5]!.beat + events[5]!.beats).toBe(16);
  });
});

describe("music theory helpers", () => {
  it("quantizes to the next grid line", () => {
    expect(nextGridTime(1.01, 0, 0.5)).toBeCloseTo(1.5);
    expect(nextGridTime(1.5, 0, 0.5)).toBeCloseTo(1.5);
    expect(nextGridTime(0.2, 1, 0.5)).toBeCloseTo(1);
  });

  it("finds the nearest chord tone in any octave", () => {
    const gmaj7 = [55, 59, 62, 66];
    expect(nearestChordTone(73, gmaj7)).toBe(74);
    expect(nearestChordTone(60, gmaj7)).toBe(59);
  });

  it("walks phrases by small steps and ends on a chord tone", () => {
    const chord = [52, 55, 59, 66];
    const random = seeded(4);
    for (let i = 0; i < 20; i += 1) {
      const phrase = walkPhrase(PENTATONIC, 64, 5, chord, random);
      expect(phrase).toHaveLength(5);
      const last = phrase[phrase.length - 1]!;
      expect(chord.map((n) => n % 12)).toContain(last % 12);
    }
  });

  it("repeats a seeded pattern", () => {
    const a = seeded(9);
    const b = seeded(9);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("keeps a cue from spamming", () => {
    expect(cueAllowed(1, 0.98, 0.07, 0, 3)).toBe(false);
    expect(cueAllowed(1, 0.9, 0.07, 0, 3)).toBe(true);
    expect(cueAllowed(1, 0, 0.07, 3, 3)).toBe(false);
  });
});

describe("voices", () => {
  it("reads how a line ends", () => {
    expect(endingOf("Is this Dad's lamp?")).toBe("question");
    expect(endingOf("Let's go!")).toBe("exclaim");
    expect(endingOf("Take your time, love.")).toBe("statement");
    expect(endingOf("Well...")).toBe("trail");
  });

  it("lets questions rise and statements fall at the end", () => {
    const n = 8;
    expect(contour(n - 1, n, "question")).toBeGreaterThan(contour(0, n, "question"));
    expect(contour(n - 1, n, "statement")).toBeLessThan(contour(0, n, "statement"));
  });

  it("counts about one syllable per three letters", () => {
    expect(syllableCount("Hi")).toBe(1);
    expect(syllableCount("Take your time, love.")).toBe(5);
  });

  it("plans a babble as long as the typing, with each speaker's pitch", () => {
    const text = "Take your time, love. I'll be right here on the porch.";
    const plan = planLine(VOICES["mom"]!, text, 1);
    const last = plan[plan.length - 1]!;
    expect(last.at).toBeGreaterThan(text.length / 42 - 0.4);
    expect(last.at).toBeLessThan(text.length / 42 + 0.4);
    const nori = planLine(VOICES["nori"]!, "Whoa! Let's go!", 2);
    const theo = planLine(VOICES["theo"]!, "Whoa! Let's go!", 2);
    const mean = (p: { hz: number }[]): number => p.reduce((a, s) => a + s.hz, 0) / p.length;
    expect(mean(nori)).toBeGreaterThan(mean(theo));
  });

  it("keeps the kids' babble cute: high, quick and on the pentatonic scale", async () => {
    const { toScale } = await import("../../src/audio/voices");
    for (const kid of ["remi", "nori", "lumi", "theo"]) {
      expect(VOICES[kid]!.hz).toBeGreaterThan(280);
      expect(VOICES[kid]!.syllable).toBeLessThan(0.095);
    }
    expect(toScale(1)).toBe(0);
    expect(toScale(5.6)).toBe(7);
    expect(toScale(-1)).toBe(0);
    expect(toScale(-2.6)).toBe(-3);
    const plan = planLine(VOICES["nori"]!, "Whoa! Let's go see the rover!", 3);
    for (const s of plan) {
      const semis = 12 * Math.log2(s.hz / VOICES["nori"]!.hz);
      expect(Math.abs(semis - Math.round(semis))).toBeLessThan(1e-6);
      expect([0, 2, 4, 7, 9]).toContain(((Math.round(semis) % 12) + 12) % 12);
    }
  });

  it("gives every character a voice, and Milo bleeps instead of words", () => {
    for (const id of ["remi", "nori", "lumi", "theo", "mom", "dad", "milo"]) expect(VOICES[id]).toBeDefined();
    expect(VOICES["milo"]!.kind).toBe("bleep");
    expect(VOICES["dad"]!.kind).toBe("hum");
  });
});

describe("cues", () => {
  it("point at real recipes and loops", () => {
    for (const [name, spec] of Object.entries(CUES)) {
      const table = spec.loop ? LOOPS : RECIPES;
      expect(table[spec.recipe], name).toBeDefined();
    }
  });

  it("cover every effect Phase 04 lists", () => {
    const needed = ["lamp-click", "lamp-hum", "page-flip", "pencil", "tape", "stamp", "toast", "step-wood", "step-grass", "step-regolith", "step-dust", "jump", "land", "regolith-puff", "envelope-pickup", "delivery-chime", "milo-boot", "milo-happy", "milo-curious", "milo-sleepy", "milo-hop", "part-clunk", "laser", "mirror-snap", "corner-sparkle", "wheel-crunch", "motor-whine", "servo", "grinder", "microscope-focus", "dust-devil", "solar-rise", "call-blip", "rotor", "hover-hop", "dish-servo", "radio-hiss", "record-crackle", "needle-drop", "shutter", "polaroid-whirr", "emote-pop", "join-chime", "leave-chime"];
    for (const name of needed) expect(CUES[name], name).toBeDefined();
  });

  it("map every surface to a footstep", () => {
    expect(stepCue("wood")).toBe("step-wood");
    expect(stepCue("regolith")).toBe("step-regolith");
    expect(stepCue("mystery")).toBe("step-path");
  });
});

describe("arrangements", () => {
  it("keep the Moon free of bass and give Mars its dust", () => {
    expect(ARRANGEMENTS.moon.bass).toBe(0);
    expect(ARRANGEMENTS.moon.air).toBeGreaterThan(0);
    expect(ARRANGEMENTS.mars.dust).toBeGreaterThan(0);
    expect(ARRANGEMENTS.moon.bpm).toBeLessThan(ARRANGEMENTS.home.bpm);
    // A little kalimba bounces along on every world, quietly.
    for (const a of Object.values(ARRANGEMENTS)) expect(a.bounce).toBeGreaterThan(0);
    for (const a of Object.values(ARRANGEMENTS)) expect(a.bounce).toBeLessThan(0.08);
  });
});

describe("voices follow the words", async () => {
  const { syllablesOf, planLine: plan, VOICES: V } = await import("../../src/audio/voices");
  it("finds one syllable per vowel group", () => {
    const s = syllablesOf("Hello, Milo");
    expect(s.map((x) => x.letter).join("")).toBe("hlml");
    expect(s.map((x) => x.vowel)).toEqual([1, 3, 2, 3]);
  });
  it("says the same line the same way", () => {
    const a = plan(V["remi"]!, "Look at the little mirrors!", 3).map((p) => p.vowel);
    const b = plan(V["remi"]!, "Look at the little mirrors!", 3).map((p) => p.vowel);
    expect(a).toEqual(b);
  });
});
