import { describe, expect, it } from "vitest";
import {
  type Progress,
  decodeClientMessage,
  decodeServerMessage,
  emptyProgress,
  encode,
  isValidRoomCode,
  mergeProgress,
  progressAdds,
  progressDelta,
} from "../../src/net/protocol";
import { ROOM_WORDS, makeRoomCode } from "../../src/net/words";

describe("room codes", () => {
  it("accepts three different listed words and a number", () => {
    expect(isValidRoomCode("lamp-otter-comet-42")).toBe(true);
    expect(isValidRoomCode("maple-rover-tulip-1")).toBe(true);
    expect(isValidRoomCode("maple-rover-tulip-99")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of [
      "",
      "smoke-test",
      "lamp-otter-comet",
      "lamp-otter-comet-0",
      "lamp-otter-comet-100",
      "lamp-otter-comet-07",
      "lamp-lamp-comet-4",
      "lamp-otter-sunny-4",
      "Lamp-otter-comet-4",
      "lamp-otter-comet-4-5",
      "lamp otter comet 4",
      "x".repeat(60),
    ]) {
      expect(isValidRoomCode(bad), bad).toBe(false);
    }
  });

  it("makes valid codes from the word list only", () => {
    let seed = 1;
    const random = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 200; i += 1) {
      const code = makeRoomCode(random);
      expect(isValidRoomCode(code), code).toBe(true);
      for (const word of code.split("-").slice(0, 3)) expect(ROOM_WORDS).toContain(word);
    }
  });
});

const progress = (p: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...p });

describe("messages", () => {
  it("round-trips a welcome and a hello", () => {
    const welcome = { t: "wel", y: 1, k: "nori", r: "lamp-otter-comet-42", pl: [[0, "remi", 1], [1, "nori", 1]], p: progress({ d: ["to-the-lamp"], m: 2 }), w: "home", v: "0.1.0" } as const;
    expect(decodeServerMessage(encode(welcome as never))).toEqual(welcome);
    const hello = { t: "hi", s: "abcdefabcdef12", k: "remi", p: progress({ s: ["prologue"] }), w: "tranquility" } as const;
    expect(decodeClientMessage(encode(hello as never))).toEqual(hello);
  });

  it("round-trips a move, an emote, a phrase and a story event", () => {
    const move = { t: "m", w: "home", d: [1.25, 20.5, -3, 0, 0, 1, 1, 1] } as const;
    expect(decodeClientMessage(encode(move as never))).toEqual(move);
    expect(decodeClientMessage(encode({ t: "e", i: "wave" }))).toEqual({ t: "e", i: "wave" });
    expect(decodeClientMessage(encode({ t: "ph", i: "thanks" }))).toEqual({ t: "ph", i: "thanks" });
    const ev = { t: "ev", e: "letter:delivered", a: "a11-letter-descent", b: "descent", c: 0 } as const;
    expect(decodeClientMessage(encode(ev))).toEqual(ev);
  });

  it("never carries free text", () => {
    // Unknown types, text fields, and ids that are not ids are all dropped.
    expect(decodeClientMessage(JSON.stringify({ t: "chat", text: "hi" }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "e", i: "hello there" }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "ph", i: "my name is" }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "ev", e: "letter:delivered", a: "Hi Sam!", b: "", c: 0 }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "ev", e: "say", a: "x", b: "", c: 0 }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "hi", s: "abcdefabcdef12", k: "sam", p: progress(), w: "home" }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "p", p: { ...progress(), d: ["Call me at 555"] } }))).toBeNull();
    // Extra fields are not passed on.
    expect(decodeClientMessage(JSON.stringify({ t: "e", i: "wave", text: "hi" }))).toEqual({ t: "e", i: "wave" });
  });

  it("drops junk, wild positions and oversize lists", () => {
    expect(decodeClientMessage("not json")).toBeNull();
    expect(decodeClientMessage(new ArrayBuffer(4))).toBeNull();
    expect(decodeClientMessage(JSON.stringify([1, 2]))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "m", w: "home", d: [1e9, 0, 0, 0, 0, 1, 1, 0] }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "m", w: "mars", d: [1, 0, 0, 0, 0, 1, 1, 0] }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "p", p: { ...progress(), f: Array.from({ length: 300 }, (_, i) => `f${i}`) } }))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ t: "p", p: { ...progress(), m: 9 } }))).toBeNull();
    expect(decodeServerMessage(JSON.stringify({ t: "wel" }))).toBeNull();
  });

  it("keeps settings flags out of shared progress", () => {
    const decoded = decodeClientMessage(JSON.stringify({ t: "p", p: progress({ f: ["explore-freely", "chapter-1:arrived"] }) }));
    expect(decoded).toEqual({ t: "p", p: progress({ f: ["chapter-1:arrived"] }) });
  });
});

describe("shared progress", () => {
  it("only grows: lists join, Milo takes the higher stage", () => {
    const a = progress({ d: ["to-the-lamp"], s: ["prologue"], m: 1 });
    const b = progress({ d: ["a11-letter-descent"], f: ["chapter-1:arrived"], m: 0 });
    expect(mergeProgress(a, b)).toEqual({ d: ["to-the-lamp", "a11-letter-descent"], s: ["prologue"], f: ["chapter-1:arrived"], m: 1 });
    expect(mergeProgress(b, a).m).toBe(1);
  });

  it("knows when something is new, and sends only that", () => {
    const known = progress({ d: ["to-the-lamp"], m: 1 });
    expect(progressAdds(known, progress({ d: ["to-the-lamp"] }))).toBe(false);
    expect(progressAdds(known, progress({ m: 2 }))).toBe(true);
    const next = progress({ d: ["to-the-lamp", "a11-letter-descent"], f: ["explore-freely"], m: 1 });
    expect(progressDelta(known, next)).toEqual({ d: ["a11-letter-descent"], s: [], f: [], m: 1 });
  });
});
