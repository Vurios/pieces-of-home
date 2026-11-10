import { type Connection, type ConnectionContext, Server, type WSMessage } from "partyserver";
import { MAX_PLAYERS, decodeClientMessage, encode, isValidRoomCode } from "../net/protocol";

/**
 * One Room per room code. It will hold the shared notebook, Milo and puzzle
 * state in Phase 06. For now it counts players and says hello.
 *
 * Kid safety: the room stores nothing about players. Connections are counted,
 * never named, and no message carries free text.
 */
export class Room extends Server<Env> {
  // Hibernate between messages so idle rooms cost nothing on the free plan.
  static override options = { hibernate: true };

  private playerCount(): number {
    let count = 0;
    for (const _ of this.getConnections()) count += 1;
    return count;
  }

  override onConnect(connection: Connection, _ctx: ConnectionContext): void {
    if (!isValidRoomCode(this.name)) {
      connection.close(4000, "bad_room");
      return;
    }

    const players = this.playerCount();
    if (players > MAX_PLAYERS) {
      connection.send(encode({ type: "full" }));
      connection.close(4001, "room_full");
      return;
    }

    connection.send(
      encode({ type: "hello", room: this.name, you: connection.id, players, version: __APP_VERSION__ }),
    );
    this.broadcast(encode({ type: "players", players }), [connection.id]);
  }

  override onMessage(connection: Connection, raw: WSMessage): void {
    const message = decodeClientMessage(raw);
    if (!message) return;
    if (message.type === "ping") {
      connection.send(encode({ type: "pong", t: message.t }));
    }
  }

  override onClose(connection: Connection): void {
    // The closing socket can still be listed here, so count the others.
    let players = 0;
    for (const other of this.getConnections()) {
      if (other.id !== connection.id) players += 1;
    }
    this.broadcast(encode({ type: "players", players }), [connection.id]);
  }

  override onError(connection: Connection, error: unknown): void {
    console.error(JSON.stringify({ event: "room_error", room: this.name, error: String(error) }));
    this.onClose(connection);
  }
}
