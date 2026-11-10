import { PartySocket } from "partysocket";
import { ROOM_PARTY, type ServerMessage, decodeServerMessage, isValidRoomCode } from "./protocol";

export type NetStatus = "solo" | "connecting" | "connected" | "offline" | "full";

export interface NetState {
  status: NetStatus;
  room: string | null;
  players: number;
}

type Listener = (state: NetState) => void;

/**
 * Thin co-op client. Solo play never opens a socket. If the room server is
 * busy or offline the game keeps working solo.
 */
export class NetClient {
  private socket: PartySocket | null = null;
  private listeners = new Set<Listener>();
  private state: NetState = { status: "solo", room: null, players: 1 };

  get snapshot(): NetState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  join(room: string): boolean {
    if (!isValidRoomCode(room)) return false;
    this.leave();
    this.set({ status: "connecting", room, players: 1 });

    const socket = new PartySocket({ host: window.location.host, party: ROOM_PARTY, room });
    this.socket = socket;

    socket.addEventListener("message", (event: MessageEvent) => {
      const message = decodeServerMessage(event.data);
      if (message) this.handle(message);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      if (this.state.status !== "full") this.set({ ...this.state, status: "offline" });
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) return;
      if (this.state.status === "connecting") this.set({ ...this.state, status: "offline" });
    });
    return true;
  }

  leave(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.set({ status: "solo", room: null, players: 1 });
  }

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case "hello":
        this.set({ status: "connected", room: message.room, players: message.players });
        break;
      case "players":
        this.set({ ...this.state, players: message.players });
        break;
      case "full": {
        const socket = this.socket;
        this.socket = null;
        this.set({ ...this.state, status: "full" });
        socket?.close();
        break;
      }
      case "pong":
        break;
    }
  }

  private set(next: NetState): void {
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
