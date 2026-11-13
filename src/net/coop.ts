import { CHAPTERS, arrivedFlag, chapterForWorld, fittedFlag, partId } from "../content/chapters";
import { MILO_VOICE, RECORD } from "../content/finale";
import { KID_NAMES } from "../content/story";
import type { KidId } from "../game/actors/character";
import { MAX_FLAGS } from "../game/core/state";
import type { GameState } from "../game/core/state";
import type { Engine } from "../game/engine";
import type { NetClient } from "./client";
import { presence } from "./presence";
import {
  KID_IDS,
  type Kid,
  LOCAL_FLAGS,
  type Progress,
  SHARED_EVENTS,
  type ServerMessage,
  type SharedEvent,
  WORLD_IDS,
  type WorldId,
  emptyProgress,
  mergeProgress,
  progressAdds,
  progressDelta,
} from "./protocol";

/**
 * The bridge between the co-op room and the game (Phase 06).
 *
 * - Shared story: the room keeps one copy of the letters, stamps, flags and
 *   Milo. Anything new in the local save goes up; anything new from the room
 *   comes down into the local save, so every player keeps the progress.
 * - Story moments: when a friend delivers a letter, finishes a puzzle beat or
 *   gives Milo a part, the same event plays here from this player's own copy
 *   of the story. Only ids travel.
 * - Together: when anyone goes through the Looking Lamp, everyone follows.
 * - Friends: where each friend stands (sent only while they move), their
 *   emotes and their preset phrases.
 */

const KID_KEY = "poh.kid.v1";
/** Movement goes out at most this often, and only while moving. */
const MOVE_EVERY_MS = 125;

export function progressOf(s: Readonly<GameState>): Progress {
  return { d: [...s.delivered], s: [...s.stamps], f: s.flags.filter((f) => !LOCAL_FLAGS.includes(f)), m: s.miloStage };
}

/** The kid this device last played, so a room remembers the choice. */
export function preferredKid(): Kid {
  try {
    const found = localStorage.getItem(KID_KEY);
    if (found && (KID_IDS as readonly string[]).includes(found)) return found as Kid;
  } catch {
    // Storage can be blocked; Remi is the default.
  }
  return "remi";
}

function rememberKid(kid: Kid): void {
  try {
    localStorage.setItem(KID_KEY, kid);
  } catch {
    // Nothing to do.
  }
}

/**
 * What a player carries after the shared story moved on without them: a
 * letter a friend already delivered, or a part Milo already has, goes away.
 */
export function settleCarrying(s: Readonly<GameState>): string | null {
  const carrying = s.carrying;
  if (!carrying) return null;
  if (s.delivered.includes(carrying)) return null;
  const chapter = CHAPTERS.find((c) => partId(c) === carrying);
  if (chapter && (s.flags.includes(fittedFlag(chapter)) || s.stamps.includes(chapter.id))) return null;
  if (carrying === RECORD && s.miloStage >= MILO_VOICE) return null;
  return carrying;
}

export class Coop {
  /** True while this client replays something the room sent, so it is not sent back. */
  private echo = false;
  /** The room's copy of the shared story, as last heard. */
  private known: Progress = emptyProgress();
  private roomWorld: WorldId | null = null;
  private lastTrip = 0;
  private you: number | null = null;
  private lateJoin = false;
  private lastMove: number[] | null = null;
  private moving = false;
  private forceMove = false;
  private offs: (() => void)[] = [];
  private timer = 0;
  /** The last things heard from friends (emotes, phrases, story events), for tests. Ids only. */
  readonly heard: string[] = [];

  constructor(
    private readonly net: NetClient,
    private readonly engine: Engine,
  ) {}

  /** Opens a room and starts sharing. */
  join(room: string): boolean {
    return this.net.join(room, () => ({ k: preferredKid(), p: progressOf(this.engine.store.value), w: this.localWorld() ?? "home" }));
  }

  /** Back to solo: friends go, the kid goes back to Remi, the local save keeps everything. */
  leave(): void {
    this.net.leave();
    this.reset();
  }

  /** Picks a kid in the room (character select). The room says yes by echoing it. */
  pick(kid: Kid): void {
    rememberKid(kid);
    this.net.send({ t: "k", k: kid });
  }

  start(): () => void {
    const { engine, net } = this;
    const bus = engine.bus;
    this.offs.push(
      net.onMessage((m) => this.receive(m)),
      net.subscribe((state) => {
        if (state.status === "solo" || state.status === "offline" || state.status === "full") this.reset();
        if (state.status === "offline") bus.emit("toast", { text: "Co-op is resting right now. You can keep playing solo." });
        if (state.status === "full") bus.emit("toast", { text: "That room is full. You can keep playing solo." });
      }),
      // Anything new in the local save goes up to the room.
      engine.store.subscribe((s) => {
        if (!net.connected) return;
        const mine = progressOf(s);
        if (!progressAdds(this.known, mine)) return;
        const delta = progressDelta(this.known, mine);
        this.known = mergeProgress(this.known, mine);
        net.send({ t: "p", p: delta });
      }),
      ...SHARED_EVENTS.map((name) => bus.on(name, (payload: unknown) => this.share(name, payload))),
      bus.on("travel", ({ to }) => {
        if (this.echo || !net.connected || !(WORLD_IDS as readonly string[]).includes(to)) return;
        this.roomWorld = to as WorldId;
        this.lastTrip = performance.now();
        net.send({ t: "w", w: to as WorldId, n: Math.random().toString(36).slice(2, 10) });
      }),
      bus.on("emote", ({ id, seat }) => {
        if (seat === undefined) net.send({ t: "e", i: id as never });
      }),
      bus.on("phrase", ({ id, seat }) => {
        if (seat === undefined) net.send({ t: "ph", i: id as never });
      }),
      bus.on("world:ready", () => {
        this.forceMove = true;
      }),
    );
    this.timer = window.setInterval(() => this.tick(), MOVE_EVERY_MS);
    return () => {
      window.clearInterval(this.timer);
      for (const off of this.offs) off();
      this.offs = [];
    };
  }

  private localWorld(): WorldId | null {
    const id = this.engine.world?.id;
    return id && (WORLD_IDS as readonly string[]).includes(id) ? (id as WorldId) : null;
  }

  private reset(): void {
    this.you = null;
    this.roomWorld = null;
    this.known = emptyProgress();
    this.lateJoin = false;
    this.engine.crew.clear();
    this.engine.setPlayerKid("remi");
    this.updatePresence();
  }

  private updatePresence(): void {
    const kids = new Set<string>(this.engine.crew.list.map((f) => f.kid));
    if (this.you !== null) kids.add(this.engine.playerKid);
    presence.set(kids);
  }

  /** A story event happened here: tell the room, unless it came from the room. */
  private share(name: SharedEvent, payload: unknown): void {
    if (this.echo || !this.net.connected) return;
    const p = payload as Record<string, unknown>;
    const id = (key: string): string => (typeof p[key] === "string" ? (p[key] as string) : "");
    switch (name) {
      case "letter:delivered":
        this.net.send({ t: "ev", e: name, a: id("letter"), b: id("to"), c: 0 });
        break;
      case "activity:beat":
        this.net.send({ t: "ev", e: name, a: id("id"), b: id("beat"), c: 0 });
        break;
      case "activity:done":
        this.net.send({ t: "ev", e: name, a: id("id"), b: "", c: 0 });
        break;
      case "milo:stage":
        this.net.send({ t: "ev", e: name, a: id("chapter"), b: "", c: typeof p["stage"] === "number" ? p["stage"] : 0 });
        break;
    }
  }

  /** Brings the room's story into the local save. */
  private apply(progress: Progress, handNext: boolean): void {
    this.known = mergeProgress(this.known, progress);
    const store = this.engine.store;
    const local = progressOf(store.value);
    const changes = progressAdds(local, progress);
    const settled = settleCarrying({ ...store.value, delivered: [...new Set([...store.value.delivered, ...progress.d])], stamps: [...new Set([...store.value.stamps, ...progress.s])], flags: [...new Set([...store.value.flags, ...progress.f])], miloStage: Math.max(store.value.miloStage, progress.m) });
    if (!changes && settled === store.value.carrying) return;
    this.echo = true;
    try {
      store.update((s) => {
        for (const d of progress.d) if (!s.delivered.includes(d)) s.delivered.push(d);
        for (const st of progress.s) if (!s.stamps.includes(st)) s.stamps.push(st);
        for (const f of progress.f) if (!s.flags.includes(f) && s.flags.length < MAX_FLAGS) s.flags.push(f);
        s.miloStage = Math.max(s.miloStage, progress.m);
        s.carrying = settleCarrying(s);
        // Joining part way through a chapter: take the next letter, like coming back to a world.
        const chapter = handNext ? chapterForWorld(this.engine.world?.id ?? "") : null;
        if (chapter && s.carrying === null && s.flags.includes(arrivedFlag(chapter))) {
          const next = chapter.letters.find((l) => !s.delivered.includes(l.id));
          if (next) s.carrying = next.id;
        }
      });
    } finally {
      this.echo = false;
    }
  }

  /** Plays a friend's story moment here. */
  private replay(m: Extract<ServerMessage, { t: "ev" }>): void {
    const bus = this.engine.bus;
    this.echo = true;
    try {
      switch (m.e) {
        case "letter:delivered":
          // The letter is delivered for everyone; the beat plays here too.
          this.engine.store.update((s) => {
            if (!s.delivered.includes(m.a)) s.delivered.push(m.a);
            s.carrying = settleCarrying(s);
          });
          bus.emit("letter:delivered", { letter: m.a, to: m.b });
          break;
        case "activity:beat":
          bus.emit("activity:beat", { id: m.a, beat: m.b });
          break;
        case "activity:done":
          bus.emit("activity:done", { id: m.a });
          break;
        case "milo:stage":
          bus.emit("milo:stage", { stage: m.c, ...(m.a ? { chapter: m.a } : {}) });
          break;
      }
    } finally {
      this.echo = false;
    }
  }

  private name(seat: number): string {
    const kid = this.net.snapshot.seats.find((s) => s.seat === seat)?.kid;
    return kid ? KID_NAMES[kid] : "A friend";
  }

  private receive(m: ServerMessage): void {
    const { engine } = this;
    if (m.t === "e" || m.t === "ph") this.heard.push(`${m.t}:${m.i}`);
    else if (m.t === "ev") this.heard.push(`ev:${m.e}:${m.a}`);
    if (this.heard.length > 40) this.heard.splice(0, this.heard.length - 40);
    switch (m.t) {
      case "wel":
        this.you = m.y;
        engine.setPlayerKid(m.k as KidId);
        rememberKid(m.k);
        for (const [seat, kid, online] of m.pl) {
          if (seat === m.y) continue;
          if (online) engine.crew.set(seat, kid as KidId);
          else engine.crew.remove(seat);
        }
        this.known = emptyProgress();
        this.apply(m.p, true);
        // Anything this player had that the room did not is already merged by the room.
        this.roomWorld = m.w;
        this.lateJoin = m.pl.some(([seat, , online]) => seat !== m.y && online === 1);
        this.forceMove = true;
        this.updatePresence();
        break;
      case "pj":
        if (m.s === this.you) break;
        engine.crew.set(m.s, m.k as KidId);
        engine.bus.emit("toast", { text: `${KID_NAMES[m.k]} joined the room.` });
        // Show the newcomer where everyone stands, even standing still.
        this.forceMove = true;
        this.updatePresence();
        break;
      case "pk":
        if (m.s === this.you) {
          engine.setPlayerKid(m.k as KidId);
          rememberKid(m.k);
        } else engine.crew.set(m.s, m.k as KidId);
        this.forceMove = true;
        this.updatePresence();
        break;
      case "pl":
        if (m.s === this.you) break;
        engine.bus.emit("toast", { text: `${this.name(m.s)} left the room.` });
        engine.crew.remove(m.s);
        this.updatePresence();
        break;
      case "m":
        engine.crew.push(m.s, m.w, m.d, performance.now());
        break;
      case "e":
        engine.crew.emote(m.s);
        engine.bus.emit("emote", { id: m.i, seat: m.s });
        break;
      case "ph":
        engine.bus.emit("phrase", { id: m.i, seat: m.s });
        break;
      case "p":
        this.apply(m.p, false);
        break;
      case "w":
        this.roomWorld = m.w;
        this.lastTrip = 0;
        if (m.n !== "lock" && m.w !== this.localWorld()) engine.bus.emit("toast", { text: `${this.name(m.s)} went through the Looking Lamp. Follow!` });
        break;
      case "ev":
        this.replay(m);
        break;
      default:
        break;
    }
  }

  private tick(): void {
    const { engine, net } = this;
    if (!net.connected || engine.mode !== "play") return;
    const here = this.localWorld();

    // Together: follow the room to its world (a friend went through the lamp, or we just joined).
    if (this.roomWorld && here && this.roomWorld !== here && !engine.traveling && performance.now() - this.lastTrip > 3000) {
      this.lastTrip = performance.now();
      this.echo = true;
      try {
        engine.bus.emit("travel", { to: this.roomWorld, entry: this.roomWorld === "home" ? "bench" : "lamp" });
      } finally {
        this.echo = false;
      }
      return;
    }

    // A late joiner appears next to the group, with a soft light.
    if (this.lateJoin && here && here === this.roomWorld && !engine.traveling) {
      const friend = engine.crew.here(here)[0];
      if (friend) {
        this.lateJoin = false;
        engine.arriveNear(friend.position);
        this.forceMove = true;
      }
    }

    // Movement: only while moving, plus one last sample when the player stops.
    const sample = engine.motionSample();
    if (!sample.world || !(WORLD_IDS as readonly string[]).includes(sample.world)) return;
    const last = this.lastMove;
    const changed =
      !last ||
      Math.abs(last[0]! - sample.data[0]) + Math.abs(last[1]! - sample.data[1]) + Math.abs(last[2]! - sample.data[2]) > 0.015 ||
      Math.abs(last[3]! - sample.data[3]) + Math.abs(last[5]! - sample.data[5]) > 0.05 ||
      last[7] !== sample.data[7];
    // Walking, riding the buggy or turning on the spot all count; standing still sends nothing.
    const moving = changed;
    if (moving || this.forceMove || (this.moving && !moving)) {
      net.send({ t: "m", w: sample.world as WorldId, d: sample.data });
      this.lastMove = [...sample.data];
      this.forceMove = false;
    }
    this.moving = moving;
  }
}
