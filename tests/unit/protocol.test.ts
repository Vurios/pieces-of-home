import { describe, expect, it } from "vitest";
import { decodeClientMessage, decodeServerMessage, encode, isValidRoomCode } from "../../src/net/protocol";

describe("room codes", () => {
  it("accepts friendly word codes", () => {
    expect(isValidRoomCode("sunny-otter-moon-42")).toBe(true);
    expect(isValidRoomCode("smoke-test")).toBe(true);
  });

  it("rejects anything that is not lowercase words and digits", () => {
    for (const bad of ["", "ab", "Has-Caps", "spaces here", "a--b", "-lead", "x".repeat(60), "emoji-🙂", "a/b"]) {
      expect(isValidRoomCode(bad)).toBe(false);
    }
  });
});

describe("messages", () => {
  it("round-trips a hello", () => {
    const hello = { type: "hello", room: "smoke-test", you: "abc", players: 2, version: "0.1.0" } as const;
    expect(decodeServerMessage(encode(hello))).toEqual(hello);
  });

  it("round-trips a ping", () => {
    expect(decodeClientMessage(encode({ type: "ping", t: 12 }))).toEqual({ type: "ping", t: 12 });
  });

  it("drops junk, unknown types and extra fields", () => {
    expect(decodeClientMessage("not json")).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ type: "chat", text: "hi" }))).toBeNull();
    expect(decodeClientMessage(new ArrayBuffer(4))).toBeNull();
    expect(decodeClientMessage(JSON.stringify({ type: "ping", t: 1, text: "hi" }))).toEqual({ type: "ping", t: 1 });
    expect(decodeServerMessage(JSON.stringify({ type: "hello" }))).toBeNull();
  });
});
