/**
 * Co-op wire protocol, shared by the browser client and the Room Durable Object.
 *
 * Kid safety: no message type ever carries free text. Players are numbered
 * seats, never names. Phase 06 extends this with movement, emotes and progress.
 */

/** PartyServer route name. `routePartykitRequest` kebab-cases the binding name `Room`. */
export const ROOM_PARTY = "room";

/** Most players allowed in one room. */
export const MAX_PLAYERS = 4;

/** Room codes are lowercase words and digits joined by dashes, for example `sunny-otter-moon-42`. */
export const ROOM_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;

export function isValidRoomCode(code: string): boolean {
  return code.length >= 3 && code.length <= 48 && ROOM_CODE_PATTERN.test(code);
}

/** Server to client. */
export type ServerMessage =
  | { type: "hello"; room: string; you: string; players: number; version: string }
  | { type: "players"; players: number }
  | { type: "pong"; t: number }
  | { type: "full" };

/** Client to server. */
export type ClientMessage = { type: "ping"; t: number };

export function encode(message: ServerMessage | ClientMessage): string {
  return JSON.stringify(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parse(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && typeof value["type"] === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Returns a validated client message, or null for anything unexpected. */
export function decodeClientMessage(raw: unknown): ClientMessage | null {
  const value = parse(raw);
  if (!value) return null;
  if (value["type"] === "ping" && typeof value["t"] === "number" && Number.isFinite(value["t"])) {
    return { type: "ping", t: value["t"] };
  }
  return null;
}

/** Returns a validated server message, or null for anything unexpected. */
export function decodeServerMessage(raw: unknown): ServerMessage | null {
  const value = parse(raw);
  if (!value) return null;
  switch (value["type"]) {
    case "hello":
      if (
        typeof value["room"] === "string" &&
        typeof value["you"] === "string" &&
        typeof value["players"] === "number" &&
        typeof value["version"] === "string"
      ) {
        return {
          type: "hello",
          room: value["room"],
          you: value["you"],
          players: value["players"],
          version: value["version"],
        };
      }
      return null;
    case "players":
      return typeof value["players"] === "number" ? { type: "players", players: value["players"] } : null;
    case "pong":
      return typeof value["t"] === "number" ? { type: "pong", t: value["t"] } : null;
    case "full":
      return { type: "full" };
    default:
      return null;
  }
}
