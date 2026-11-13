/**
 * Co-op wire protocol, shared by the browser client and the Room Durable Object.
 *
 * Kid safety: no message ever carries free text. Players are seats (0 to 3)
 * with a chosen kid, never names. Emotes, phrases, worlds and story events
 * travel as ids from fixed lists, and the room drops anything else.
 *
 * Messages are small JSON objects with one-letter keys. Movement is an array.
 */
import { ROOM_WORDS } from "./words";

/** PartyServer route name. `routePartykitRequest` kebab-cases the binding name `Room`. */
export const ROOM_PARTY = "room";

/** Most players allowed in one room. */
export const MAX_PLAYERS = 4;

/** The four kids. Each player plays a different one; Remi's story stays Remi's. */
export const KID_IDS = ["remi", "nori", "lumi", "theo"] as const;
export type Kid = (typeof KID_IDS)[number];

export const EMOTE_IDS = ["wave", "heart", "star", "look", "question", "yay"] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];

export const PHRASE_IDS = ["over", "look", "nice", "help", "go", "thanks"] as const;
export type PhraseId = (typeof PHRASE_IDS)[number];

export const WORLD_IDS = ["home", "tranquility", "hadley", "meridiani", "valinor", "storms"] as const;
export type WorldId = (typeof WORLD_IDS)[number];

/**
 * Story events every player should see when one player causes them: a letter
 * arriving, a puzzle beat, a finished activity, Milo's new part. Each client
 * plays the words from its own copy of the story, so no text is sent.
 */
export const SHARED_EVENTS = ["letter:delivered", "activity:beat", "activity:done", "milo:stage"] as const;
export type SharedEvent = (typeof SHARED_EVENTS)[number];

/**
 * Puzzle stations with a small game on screen. In a room, while one player
 * plays a station's game, a friend can stand by and hold it steady (Phase 06,
 * co-op roles). Solo, Dad's clamps hold it, so every puzzle works with anyone.
 */
export const STATION_GAMES = ["pinpoint", "snip", "wheels", "air", "scout", "note", "dish"] as const;
export type StationGame = (typeof STATION_GAMES)[number];

/** Story ids (letters, flags, stamps, activities) are short lowercase words with colons and dashes. */
export const ID_PATTERN = /^[a-z0-9]+(?:[:-][a-z0-9]+){0,5}$/;
export const isId = (value: unknown): value is string => typeof value === "string" && value.length <= 48 && ID_PATTERN.test(value);

/** Session ids are random, made on the device, and say nothing about the player. */
export const isSessionId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]{12,32}$/.test(value);

/** Room codes are three different words from the list and a number from 1 to 99, for example `lamp-otter-comet-42`. */
export function isValidRoomCode(code: string): boolean {
  if (typeof code !== "string" || code.length > 48) return false;
  const parts = code.split("-");
  if (parts.length !== 4) return false;
  const words = parts.slice(0, 3);
  if (new Set(words).size !== 3 || !words.every((w) => (ROOM_WORDS as readonly string[]).includes(w))) return false;
  return /^[1-9][0-9]?$/.test(parts[3]!);
}

/** Shared progress: what belongs to everyone in the room. Lists only grow; Milo only goes up. */
export interface Progress {
  /** Delivered letters. */
  d: string[];
  /** Stamps. */
  s: string[];
  /** Story flags (steps, places, chapters). */
  f: string[];
  /** Milo's stage. */
  m: number;
}

export const MAX_PROGRESS_ITEMS = 200;
export const MAX_MILO = 5;

export const emptyProgress = (): Progress => ({ d: [], s: [], f: [], m: 0 });

/** Flags that are a player's own settings, never shared. */
export const LOCAL_FLAGS: readonly string[] = ["explore-freely"];

/**
 * A move: position (x, y, z), facing (x, y, z), pace (0 still, 1 walk,
 * about 1.75 run) and bits (1 carrying, 2 seated). Positions are rounded to
 * centimeters to keep the message short.
 */
export type MoveData = [number, number, number, number, number, number, number, number];

/** A player in the room: seat, kid, and whether they are connected right now. */
export type Seat = [seat: number, kid: Kid, online: 0 | 1];

/** Server to client. */
export type ServerMessage =
  | { t: "wel"; y: number; k: Kid; r: string; pl: Seat[]; p: Progress; w: WorldId; v: string }
  | { t: "pj"; s: number; k: Kid }
  | { t: "pl"; s: number }
  | { t: "pk"; s: number; k: Kid }
  | { t: "m"; s: number; w: WorldId; d: MoveData }
  | { t: "e"; s: number; i: EmoteId }
  | { t: "ph"; s: number; i: PhraseId }
  | { t: "p"; p: Progress }
  | { t: "w"; s: number; w: WorldId; n: string }
  | { t: "ev"; s: number; e: SharedEvent; a: string; b: string; c: number }
  | { t: "u"; s: number; g: StationGame | "" }
  | { t: "h"; s: number; g: StationGame | "" }
  | { t: "full" }
  | { t: "pong"; n: number };

/** Client to server. */
export type ClientMessage =
  | { t: "hi"; s: string; k: Kid; p: Progress; w: WorldId }
  | { t: "k"; k: Kid }
  | { t: "m"; w: WorldId; d: MoveData }
  | { t: "e"; i: EmoteId }
  | { t: "ph"; i: PhraseId }
  | { t: "p"; p: Progress }
  | { t: "w"; w: WorldId; n: string }
  | { t: "ev"; e: SharedEvent; a: string; b: string; c: number }
  /** Using a station's game now ("" when done). */
  | { t: "u"; g: StationGame | "" }
  /** Holding a friend's station steady now ("" to let go). */
  | { t: "h"; g: StationGame | "" }
  | { t: "ping"; n: number };

export function encode(message: ServerMessage | ClientMessage): string {
  return JSON.stringify(message);
}

type Bag = Record<string, unknown>;

function parse(raw: unknown): Bag | null {
  if (typeof raw !== "string" || raw.length > 8192) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as Bag)["t"] === "string" ? (value as Bag) : null;
  } catch {
    return null;
  }
}

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const int = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function idList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_PROGRESS_ITEMS) return null;
  return value.every(isId) ? [...new Set(value as string[])] : null;
}

/** Returns valid progress, or null. */
export function readProgress(value: unknown): Progress | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Bag;
  const d = idList(v["d"]);
  const s = idList(v["s"]);
  const f = idList(v["f"]);
  if (!d || !s || !f || !int(v["m"], 0, MAX_MILO)) return null;
  return { d, s, f: f.filter((flag) => !LOCAL_FLAGS.includes(flag)), m: v["m"] as number };
}

function readMove(value: unknown): MoveData | null {
  if (!Array.isArray(value) || value.length !== 8 || !value.every(finite)) return null;
  const d = value as number[];
  // Worlds are small planets: anything far from the center is not a real position.
  if (d.slice(0, 3).some((n) => Math.abs(n) > 400) || d.slice(3, 6).some((n) => Math.abs(n) > 2)) return null;
  if (d[6]! < 0 || d[6]! > 3 || !int(d[7], 0, 3)) return null;
  return d as MoveData;
}

/** Story event arguments: two ids (either may be empty) and a small number. */
function readEvent(v: Bag): { e: SharedEvent; a: string; b: string; c: number } | null {
  if (!oneOf(SHARED_EVENTS, v["e"])) return null;
  const a = v["a"] === "" || isId(v["a"]) ? (v["a"] as string) : null;
  const b = v["b"] === "" || isId(v["b"]) ? (v["b"] as string) : null;
  if (a === null || b === null || !int(v["c"], 0, MAX_MILO)) return null;
  return { e: v["e"], a, b, c: v["c"] as number };
}

/** A travel nonce: a short random id so a client can tell its own trips from others'. */
const isNonce = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]{1,12}$/.test(value);

/** Returns a validated client message, or null for anything unexpected. */
export function decodeClientMessage(raw: unknown): ClientMessage | null {
  const v = parse(raw);
  if (!v) return null;
  switch (v["t"]) {
    case "hi": {
      const p = readProgress(v["p"]);
      return isSessionId(v["s"]) && oneOf(KID_IDS, v["k"]) && p && oneOf(WORLD_IDS, v["w"]) ? { t: "hi", s: v["s"], k: v["k"], p, w: v["w"] } : null;
    }
    case "k":
      return oneOf(KID_IDS, v["k"]) ? { t: "k", k: v["k"] } : null;
    case "m": {
      const d = readMove(v["d"]);
      return d && oneOf(WORLD_IDS, v["w"]) ? { t: "m", w: v["w"], d } : null;
    }
    case "e":
      return oneOf(EMOTE_IDS, v["i"]) ? { t: "e", i: v["i"] } : null;
    case "ph":
      return oneOf(PHRASE_IDS, v["i"]) ? { t: "ph", i: v["i"] } : null;
    case "p": {
      const p = readProgress(v["p"]);
      return p ? { t: "p", p } : null;
    }
    case "w":
      return oneOf(WORLD_IDS, v["w"]) && isNonce(v["n"]) ? { t: "w", w: v["w"], n: v["n"] } : null;
    case "ev": {
      const e = readEvent(v);
      return e ? { t: "ev", ...e } : null;
    }
    case "u":
    case "h":
      return v["g"] === "" || oneOf(STATION_GAMES, v["g"]) ? { t: v["t"], g: v["g"] as StationGame | "" } : null;
    case "ping":
      return finite(v["n"]) ? { t: "ping", n: v["n"] } : null;
    default:
      return null;
  }
}

function readSeats(value: unknown): Seat[] | null {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) return null;
  const out: Seat[] = [];
  for (const row of value) {
    if (!Array.isArray(row) || !int(row[0], 0, MAX_PLAYERS - 1) || !oneOf(KID_IDS, row[1]) || (row[2] !== 0 && row[2] !== 1)) return null;
    out.push([row[0], row[1], row[2]]);
  }
  return out;
}

const isSeat = (value: unknown): value is number => int(value, 0, MAX_PLAYERS - 1);

/** Returns a validated server message, or null for anything unexpected. */
export function decodeServerMessage(raw: unknown): ServerMessage | null {
  const v = parse(raw);
  if (!v) return null;
  switch (v["t"]) {
    case "wel": {
      const pl = readSeats(v["pl"]);
      const p = readProgress(v["p"]);
      return isSeat(v["y"]) && oneOf(KID_IDS, v["k"]) && typeof v["r"] === "string" && pl && p && oneOf(WORLD_IDS, v["w"]) && typeof v["v"] === "string"
        ? { t: "wel", y: v["y"], k: v["k"], r: v["r"], pl, p, w: v["w"], v: v["v"] }
        : null;
    }
    case "pj":
    case "pk":
      return isSeat(v["s"]) && oneOf(KID_IDS, v["k"]) ? { t: v["t"], s: v["s"], k: v["k"] } : null;
    case "pl":
      return isSeat(v["s"]) ? { t: "pl", s: v["s"] } : null;
    case "m": {
      const d = readMove(v["d"]);
      return isSeat(v["s"]) && d && oneOf(WORLD_IDS, v["w"]) ? { t: "m", s: v["s"], w: v["w"], d } : null;
    }
    case "e":
      return isSeat(v["s"]) && oneOf(EMOTE_IDS, v["i"]) ? { t: "e", s: v["s"], i: v["i"] } : null;
    case "ph":
      return isSeat(v["s"]) && oneOf(PHRASE_IDS, v["i"]) ? { t: "ph", s: v["s"], i: v["i"] } : null;
    case "p": {
      const p = readProgress(v["p"]);
      return p ? { t: "p", p } : null;
    }
    case "w":
      return isSeat(v["s"]) && oneOf(WORLD_IDS, v["w"]) && isNonce(v["n"]) ? { t: "w", s: v["s"], w: v["w"], n: v["n"] } : null;
    case "ev": {
      const e = readEvent(v);
      return isSeat(v["s"]) && e ? { t: "ev", s: v["s"], ...e } : null;
    }
    case "u":
    case "h":
      return isSeat(v["s"]) && (v["g"] === "" || oneOf(STATION_GAMES, v["g"])) ? { t: v["t"], s: v["s"], g: v["g"] as StationGame | "" } : null;
    case "full":
      return { t: "full" };
    case "pong":
      return finite(v["n"]) ? { t: "pong", n: v["n"] } : null;
    default:
      return null;
  }
}

/** Joins two progress records: every list grows to hold both, Milo takes the higher stage. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const join = (x: string[], y: string[]): string[] => {
    const out = [...x];
    for (const item of y) if (!out.includes(item) && out.length < MAX_PROGRESS_ITEMS) out.push(item);
    return out;
  };
  return { d: join(a.d, b.d), s: join(a.s, b.s), f: join(a.f, b.f), m: Math.max(a.m, b.m) };
}

/** True if `b` holds anything `a` lacks. */
export function progressAdds(a: Progress, b: Progress): boolean {
  return b.m > a.m || b.d.some((x) => !a.d.includes(x)) || b.s.some((x) => !a.s.includes(x)) || b.f.some((x) => !a.f.includes(x));
}

/** Only what `next` adds to `known`, for a small update message. */
export function progressDelta(known: Progress, next: Progress): Progress {
  return {
    d: next.d.filter((x) => !known.d.includes(x)),
    s: next.s.filter((x) => !known.s.includes(x)),
    f: next.f.filter((x) => !known.f.includes(x) && !LOCAL_FLAGS.includes(x)),
    m: Math.max(known.m, next.m),
  };
}
