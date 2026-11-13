import { PartySocket } from "partysocket";
import { type ClientMessage, type Kid, ROOM_PARTY, type ServerMessage, decodeServerMessage, encode, isValidRoomCode } from "./protocol";

/**
 * - solo: no room.
 * - connecting: opening the room for the first time.
 * - connected: in the room.
 * - reconnecting: the connection dropped; it keeps trying and keeps your kid.
 * - offline: the room could not be reached (the game keeps working solo).
 * - full: four players are already in.
 */
export type NetStatus = "solo" | "connecting" | "connected" | "reconnecting" | "offline" | "full";

export interface NetPlayer {
  seat: number;
  kid: Kid;
  online: boolean;
}

export interface NetState {
  status: NetStatus;
  room: string | null;
  /** Players online, counting you (1 when solo). */
  players: number;
  /** Your seat, once the room says welcome. */
  you: number | null;
  /** Every seat in the room, you included. */
  seats: NetPlayer[];
}

/** What a player says when they open a room: who they want to play, and their story so far. */
export type HelloSource = () => Extract<ClientMessage, { t: "hi" }> extends infer H ? Omit<H, "t" | "s"> : never;

type Listener = (state: NetState) => void;
type Handler = (message: ServerMessage) => void;

const SESSION_KEY = "poh.session.v1";

/** A random id for this tab, so a dropped connection gets the same seat back. Nothing personal. */
function sessionId(): string {
  try {
    const found = sessionStorage.getItem(SESSION_KEY);
    if (found && /^[a-z0-9]{12,32}$/.test(found)) return found;
  } catch {
    // Private windows can block storage; a fresh id still works for this visit.
  }
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const id = [...bytes].map((b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    // Same as above.
  }
  return id;
}

/** Close codes from the room that mean "do not try again". */
const FINAL_CLOSES = new Set([4000, 4001, 4002, 4008]);

/**
 * Thin co-op client. Solo play never opens a socket. If the room server is
 * busy or offline the game keeps working solo.
 */
export class NetClient {
  private socket: PartySocket | null = null;
  private listeners = new Set<Listener>();
  private handlers = new Set<Handler>();
  private state: NetState = { status: "solo", room: null, players: 1, you: null, seats: [] };
  private hello: HelloSource | null = null;
  private failures = 0;
  private everConnected = false;
  readonly session = sessionId();
  /** Messages sent and received, for the budget test. */
  readonly stats = { sent: 0, received: 0 };

  get snapshot(): NetState {
    return this.state;
  }

  get connected(): boolean {
    return this.state.status === "connected";
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Every message from the room, already checked. */
  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  join(room: string, hello: HelloSource): boolean {
    if (!isValidRoomCode(room)) return false;
    this.leave();
    this.hello = hello;
    this.failures = 0;
    this.everConnected = false;
    this.set({ status: "connecting", room, players: 1, you: null, seats: [] });

    const socket = new PartySocket({ host: window.location.host, party: ROOM_PARTY, room, maxRetries: 30, connectionTimeout: 6000, maxReconnectionDelay: 8000 });
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket || !this.hello) return;
      this.failures = 0;
      // Every (re)connect says hello again with the same session, so the seat and kid come back.
      this.raw({ t: "hi", s: this.session, ...this.hello() } as ClientMessage);
    });
    socket.addEventListener("message", (event: MessageEvent) => {
      if (this.socket !== socket) return;
      const message = decodeServerMessage(event.data);
      if (!message) return;
      this.stats.received += 1;
      this.handle(message);
      for (const handler of this.handlers) handler(message);
    });
    socket.addEventListener("close", (event: CloseEvent) => {
      if (this.socket !== socket) return;
      if (FINAL_CLOSES.has(event.code)) {
        this.stop(event.code === 4001 ? "full" : "offline");
        return;
      }
      this.failures += 1;
      // Never got in after a few tries: co-op is resting, so play solo.
      if (!this.everConnected && this.failures >= 3) {
        this.stop("offline");
        return;
      }
      if (this.everConnected) this.set({ ...this.state, status: "reconnecting" });
    });
    return true;
  }

  /** Drops the connection and lets it come back, like a wobbly Wi-Fi (for tests). */
  drop(): void {
    this.socket?.reconnect();
  }

  /** Back to solo. Progress stays in the local save. */
  leave(): void {
    const socket = this.socket;
    this.socket = null;
    this.hello = null;
    socket?.close();
    if (this.state.status !== "solo") this.set({ status: "solo", room: null, players: 1, you: null, seats: [] });
  }

  /** Sends a message if the room is open; otherwise drops it (solo play needs nothing sent). */
  send(message: ClientMessage): void {
    if (this.state.status !== "connected") return;
    this.raw(message);
  }

  private raw(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.stats.sent += 1;
    this.socket.send(encode(message));
  }

  private stop(status: "full" | "offline"): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.set({ ...this.state, status, players: 1, you: null, seats: [] });
  }

  private handle(message: ServerMessage): void {
    switch (message.t) {
      case "wel": {
        this.everConnected = true;
        const seats = message.pl.map(([seat, kid, online]) => ({ seat, kid, online: online === 1 || seat === message.y }));
        this.set({ status: "connected", room: message.r, you: message.y, seats, players: seats.filter((s) => s.online).length });
        break;
      }
      case "pj":
      case "pk": {
        const seats = this.state.seats.filter((s) => s.seat !== message.s);
        const before = this.state.seats.find((s) => s.seat === message.s);
        seats.push({ seat: message.s, kid: message.k, online: message.t === "pj" ? true : (before?.online ?? true) });
        seats.sort((a, b) => a.seat - b.seat);
        this.set({ ...this.state, seats, players: seats.filter((s) => s.online).length });
        break;
      }
      case "pl": {
        const seats = this.state.seats.map((s) => (s.seat === message.s ? { ...s, online: false } : s));
        this.set({ ...this.state, seats, players: seats.filter((s) => s.online).length });
        break;
      }
      case "full":
        this.stop("full");
        break;
      default:
        break;
    }
  }

  private set(next: NetState): void {
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
