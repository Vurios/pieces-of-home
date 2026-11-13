import { type Connection, type ConnectionContext, Server, type WSMessage } from "partyserver";
import {
  KID_IDS,
  type Kid,
  MAX_PLAYERS,
  type Progress,
  type Seat,
  type ServerMessage,
  type WorldId,
  decodeClientMessage,
  emptyProgress,
  encode,
  isValidRoomCode,
  mergeProgress,
  progressAdds,
  readProgress,
} from "../net/protocol";

/**
 * One Room per room code (Phase 06). The room keeps the shared story (letters,
 * stamps, flags, Milo) and which kid each seat plays, in its own SQLite
 * storage. It relays movement, emotes, phrases and story events between the
 * players, and drops anything that does not match the protocol.
 *
 * Kid safety: the room stores no names and no free text. A seat is a random
 * session id made on the device, a kid, and when it was last seen. Rooms are
 * never listed, and a room clears itself after a day without play.
 */

/** A day without play and the room forgets everything. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** A seat that drops keeps its kid this long, so a reconnect finds the same character. */
export const SEAT_HOLD_MS = 5 * 60 * 1000;
/** Only touch storage for "last active" this often, to keep writes low on the free plan. */
const ACTIVE_EVERY_MS = 10 * 60 * 1000;
/** Two players pressing the lamp at once: the first trip wins for this long. */
const TRAVEL_LOCK_MS = 4000;

/** Rate limit: a bucket of messages per connection that refills every second. */
const BUCKET_SIZE = 40;
const BUCKET_REFILL = 20;
const DROP_LIMIT = 400;

interface SeatRow {
  seat: number;
  sid: string;
  kid: Kid;
  last: number;
}

interface ConnState {
  seat: number;
  sid: string;
}

export class Room extends Server<Env> {
  // Hibernate between messages so idle rooms cost nothing on the free plan.
  static override options = { hibernate: true };

  private ready = false;
  private buckets = new Map<string, { tokens: number; at: number; dropped: number }>();
  private lastTravel = 0;

  private setup(): void {
    if (this.ready) return;
    this.sql`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS seats (seat INTEGER PRIMARY KEY, sid TEXT NOT NULL, kid TEXT NOT NULL, last INTEGER NOT NULL)`;
    this.ready = true;
  }

  private get(key: string): string | null {
    const rows = this.sql<{ v: string }>`SELECT v FROM kv WHERE k = ${key}`;
    return rows[0]?.v ?? null;
  }

  private put(key: string, value: string): void {
    this.sql`INSERT INTO kv (k, v) VALUES (${key}, ${value}) ON CONFLICT(k) DO UPDATE SET v = excluded.v`;
  }

  private progress(): Progress {
    const raw = this.get("progress");
    try {
      return (raw && readProgress(JSON.parse(raw))) || emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  private world(): WorldId {
    return (this.get("world") as WorldId | null) ?? "home";
  }

  private seats(): SeatRow[] {
    return this.sql<{ seat: number; sid: string; kid: string; last: number }>`SELECT seat, sid, kid, last FROM seats ORDER BY seat`.map((r) => ({
      seat: r.seat,
      sid: r.sid,
      kid: r.kid as Kid,
      last: r.last,
    }));
  }

  private online(): Set<number> {
    const seats = new Set<number>();
    for (const c of this.getConnections<ConnState>()) if (c.state) seats.add(c.state.seat);
    return seats;
  }

  private seatList(): Seat[] {
    const online = this.online();
    return this.seats().map((r) => [r.seat, r.kid, online.has(r.seat) ? 1 : 0]);
  }

  /** Marks the room as played now, and makes sure it clears itself a day after the last play. */
  private async touch(force = false): Promise<void> {
    const now = Date.now();
    const last = Number(this.get("active") ?? 0);
    if (!force && now - last < ACTIVE_EVERY_MS) return;
    if (!this.get("created")) this.put("created", String(now));
    this.put("active", String(now));
    await this.ctx.storage.setAlarm(now + ROOM_TTL_MS);
  }

  override async onAlarm(): Promise<void> {
    this.setup();
    const last = Number(this.get("active") ?? 0);
    const anyone = [...this.getConnections()].length > 0;
    if (!anyone && Date.now() - last >= ROOM_TTL_MS - 60_000) {
      await this.ctx.storage.deleteAll();
      this.ready = false;
      return;
    }
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  private send(connection: Connection, message: ServerMessage): void {
    connection.send(encode(message));
  }

  private toOthers(connection: Connection, message: ServerMessage): void {
    this.broadcast(encode(message), [connection.id]);
  }

  override onConnect(connection: Connection, _ctx: ConnectionContext): void {
    if (!isValidRoomCode(this.name)) {
      connection.close(4000, "bad_room");
      return;
    }
    this.setup();
    // The player says hello next; until then the connection holds no seat.
  }

  /** Too many messages: drop the extra ones, and close a connection that keeps flooding. */
  private allow(connection: Connection): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(connection.id) ?? { tokens: BUCKET_SIZE, at: now, dropped: 0 };
    bucket.tokens = Math.min(BUCKET_SIZE, bucket.tokens + ((now - bucket.at) / 1000) * BUCKET_REFILL);
    bucket.at = now;
    this.buckets.set(connection.id, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    bucket.dropped += 1;
    if (bucket.dropped > DROP_LIMIT) connection.close(4008, "slow_down");
    return false;
  }

  override async onMessage(connection: Connection<ConnState>, raw: WSMessage): Promise<void> {
    if (!this.allow(connection)) return;
    const message = decodeClientMessage(raw);
    if (!message) return;
    this.setup();
    const me = connection.state;

    if (message.t === "ping") {
      this.send(connection, { t: "pong", n: message.n });
      return;
    }
    if (message.t === "hi") {
      await this.hello(connection, message.s, message.k, message.p, message.w);
      return;
    }
    // Everything else needs a seat.
    if (!me) return;

    switch (message.t) {
      case "k": {
        const taken = this.seats().some((r) => r.seat !== me.seat && r.kid === message.k && this.holds(r));
        if (taken) return;
        this.sql`UPDATE seats SET kid = ${message.k} WHERE seat = ${me.seat}`;
        this.broadcast(encode({ t: "pk", s: me.seat, k: message.k }));
        return;
      }
      case "m":
        this.toOthers(connection, { t: "m", s: me.seat, w: message.w, d: message.d });
        return;
      case "e":
        this.toOthers(connection, { t: "e", s: me.seat, i: message.i });
        return;
      case "ph":
        this.toOthers(connection, { t: "ph", s: me.seat, i: message.i });
        return;
      case "ev":
        this.toOthers(connection, { t: "ev", s: me.seat, e: message.e, a: message.a, b: message.b, c: message.c });
        return;
      case "p": {
        const known = this.progress();
        if (!progressAdds(known, message.p)) return;
        const next = mergeProgress(known, message.p);
        this.put("progress", JSON.stringify(next));
        await this.touch();
        this.broadcast(encode({ t: "p", p: next }));
        return;
      }
      case "w": {
        const now = Date.now();
        if (now - this.lastTravel < TRAVEL_LOCK_MS && message.w !== this.world()) {
          // Someone else just went somewhere: this player follows them instead.
          this.send(connection, { t: "w", s: me.seat, w: this.world(), n: "lock" });
          return;
        }
        this.lastTravel = now;
        this.put("world", message.w);
        await this.touch();
        this.toOthers(connection, { t: "w", s: me.seat, w: message.w, n: message.n });
        return;
      }
    }
  }

  /** A seat that is online, or dropped only a moment ago, keeps its kid. */
  private holds(row: SeatRow): boolean {
    return this.online().has(row.seat) || Date.now() - row.last < SEAT_HOLD_MS;
  }

  private async hello(connection: Connection<ConnState>, sid: string, wanted: Kid, progress: Progress, world: WorldId): Promise<void> {
    if (connection.state) return;
    const now = Date.now();
    const rows = this.seats();
    const online = this.online();
    let row = rows.find((r) => r.sid === sid);
    const fresh = rows.length === 0;

    if (row && online.has(row.seat)) {
      // The same device twice (two tabs): the old tab lets go.
      for (const c of this.getConnections<ConnState>()) if (c.state?.seat === row.seat) c.close(4002, "moved");
    }
    if (!row) {
      const free = [0, 1, 2, 3].find((n) => !rows.some((r) => r.seat === n));
      // A seat left empty for a while can be taken by someone new.
      const stale = rows.find((r) => !online.has(r.seat) && now - r.last >= SEAT_HOLD_MS);
      const seat = free ?? stale?.seat;
      if (seat === undefined || online.size >= MAX_PLAYERS) {
        this.send(connection, { t: "full" });
        connection.close(4001, "room_full");
        return;
      }
      const held = new Set(rows.filter((r) => r.seat !== seat && this.holds(r)).map((r) => r.kid));
      // The kid the player asked for, else Remi, else the first free one.
      const kid = [wanted, "remi" as Kid, ...KID_IDS].find((k) => !held.has(k))!;
      this.sql`INSERT INTO seats (seat, sid, kid, last) VALUES (${seat}, ${sid}, ${kid}, ${now}) ON CONFLICT(seat) DO UPDATE SET sid = excluded.sid, kid = excluded.kid, last = excluded.last`;
      row = { seat, sid, kid, last: now };
    } else {
      this.sql`UPDATE seats SET last = ${now} WHERE seat = ${row.seat}`;
    }
    connection.setState({ seat: row.seat, sid });

    // The first player in a new room brings their story and their world.
    if (fresh) this.put("world", world);
    const known = this.progress();
    const merged = progressAdds(known, progress) ? mergeProgress(known, progress) : known;
    if (merged !== known) this.put("progress", JSON.stringify(merged));
    await this.touch(true);

    this.send(connection, { t: "wel", y: row.seat, k: row.kid, r: this.name, pl: this.seatList(), p: merged, w: this.world(), v: __APP_VERSION__ });
    this.toOthers(connection, { t: "pj", s: row.seat, k: row.kid });
    if (merged !== known) this.toOthers(connection, { t: "p", p: merged });
  }

  override onClose(connection: Connection<ConnState>): void {
    this.buckets.delete(connection.id);
    const me = connection.state;
    if (!me) return;
    this.setup();
    this.sql`UPDATE seats SET last = ${Date.now()} WHERE seat = ${me.seat}`;
    // Another tab of the same device may hold the seat now.
    for (const other of this.getConnections<ConnState>()) if (other.id !== connection.id && other.state?.seat === me.seat) return;
    this.broadcast(encode({ t: "pl", s: me.seat }), [connection.id]);
  }

  override onError(connection: Connection<ConnState>, error: unknown): void {
    console.error(JSON.stringify({ event: "room_error", error: String(error) }));
    this.onClose(connection);
  }
}
