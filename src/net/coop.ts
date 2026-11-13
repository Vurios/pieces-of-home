import { Vector3 } from "three";
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
  STATION_GAMES,
  type ServerMessage,
  type StationGame,
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

/** Each station game and the interaction (the machine) it is played at. */
const STATION_AT: Record<StationGame, string> = {
  pinpoint: "landing-table",
  snip: "surveyor-cutters",
  wheels: "wheel-test",
  air: "rotor-bench",
  scout: "scout-pad",
  note: "ingenuity-log",
  dish: "dish",
};
/** A helper who wanders this far from the station lets go. */
const HOLD_REACH = 3.5;
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
  /** Co-op roles: which station game each friend plays now, and which one each friend holds steady. */
  private using = new Map<number, StationGame>();
  private holdingBy = new Map<number, StationGame>();
  /** The station game this player plays now (and its card's key), and the one they hold for a friend. */
  private myGame: { id: StationGame; key: number } | null = null;
  private myHold: { seat: number; game: StationGame } | null = null;
  private readonly holdSpot = new Vector3(0, -9999, 0);
  private lastToggle = 0;

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
        this.letGo();
        this.addHold();
      }),
      bus.on("story:game", ({ key, id }) => {
        if (!(STATION_GAMES as readonly string[]).includes(id)) return;
        this.letGo();
        this.myGame = { id: id as StationGame, key };
        net.send({ t: "u", g: id as StationGame });
        this.updateHelpers();
      }),
      bus.on("story:game-done", ({ key }) => {
        if (this.myGame?.key !== key) return;
        this.myGame = null;
        net.send({ t: "u", g: "" });
        this.updateHelpers();
      }),
    );
    this.addHold();
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
    this.using.clear();
    this.holdingBy.clear();
    this.myHold = null;
    this.updateHelpers();
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
        this.using.delete(m.s);
        this.holdingBy.delete(m.s);
        if (this.myHold?.seat === m.s) this.letGo();
        engine.crew.remove(m.s);
        this.updatePresence();
        this.updateHelpers();
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
      case "u":
        if (m.g) this.using.set(m.s, m.g);
        else {
          this.using.delete(m.s);
          // The friend finished: a helper lets go with a little cheer.
          if (this.myHold?.seat === m.s) {
            engine.bus.emit("toast", { text: "Nice teamwork!" });
            this.letGo();
          }
        }
        break;
      case "h":
        if (m.g) this.holdingBy.set(m.s, m.g);
        else this.holdingBy.delete(m.s);
        this.updateHelpers();
        break;
      default:
        break;
    }
  }

  /** The friends holding steady the station game this player plays now. */
  private updateHelpers(): void {
    const game = this.myGame?.id;
    const kids = game
      ? [...this.holdingBy]
          .filter(([, g]) => g === game)
          .map(([seat]) => this.engine.crew.list.find((f) => f.seat === seat)?.kid)
          .filter((k): k is KidId => Boolean(k))
      : [];
    presence.setHelpers(kids);
  }

  private kidName(seat: number): string {
    const kid = this.engine.crew.list.find((f) => f.seat === seat)?.kid;
    return kid ? KID_NAMES[kid] : "your friend";
  }

  /** A friend playing a station game in this world, nearest first, and where the station is. */
  private friendAtStation(): { seat: number; game: StationGame; at: Vector3 } | null {
    const here = this.localWorld();
    if (!here) return null;
    const me = this.engine.motionSample().data;
    let best: { seat: number; game: StationGame; at: Vector3 } | null = null;
    let bestDistance = Infinity;
    for (const [seat, game] of this.using) {
      const friend = this.engine.crew.list.find((f) => f.seat === seat && f.world === here);
      const at = this.engine.interactions.positionOf(STATION_AT[game]);
      if (!friend || !at) continue;
      const distance = Math.hypot(at.x - me[0], at.y - me[1], at.z - me[2]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { seat, game, at };
      }
    }
    return best;
  }

  /** "Hold it steady for Nori": a station that appears only while a friend plays a station's game. */
  private addHold(): void {
    this.engine.interactions.add({
      id: "coop-hold",
      position: this.holdSpot,
      radius: 2.4,
      kind: "press",
      weight: 0.7,
      label: () => {
        if (!this.net.connected || this.myGame) return null;
        if (this.myHold) return "Let go";
        const friend = this.friendAtStation();
        return friend ? "Hold it steady for " + this.kidName(friend.seat) : null;
      },
      onDone: () => {
        // One press is one change, even if the key bounces.
        if (performance.now() - this.lastToggle < 600) return;
        this.lastToggle = performance.now();
        if (this.myHold) {
          this.letGo();
          return;
        }
        const friend = this.friendAtStation();
        if (!friend) return;
        this.myHold = { seat: friend.seat, game: friend.game };
        this.net.send({ t: "h", g: friend.game });
        this.engine.bus.emit("toast", { text: "You are holding it steady for " + this.kidName(friend.seat) + "." });
      },
    });
  }

  private letGo(): void {
    if (!this.myHold) return;
    this.myHold = null;
    this.net.send({ t: "h", g: "" });
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

    // Co-op roles: keep the hold station on the friend's machine, and let go when walking away.
    const station = this.friendAtStation();
    if (station) this.holdSpot.copy(station.at);
    else this.holdSpot.set(0, -9999, 0);
    if (this.myHold) {
      const game = this.using.get(this.myHold.seat);
      const at = game ? engine.interactions.positionOf(STATION_AT[game]) : null;
      const me = engine.motionSample().data;
      if (!at || Math.hypot(at.x - me[0], at.y - me[1], at.z - me[2]) > HOLD_REACH) this.letGo();
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
