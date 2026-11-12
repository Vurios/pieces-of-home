import { ACTIVITIES } from "../../content/chapters/activities";
import { CHAPTERS, type ChapterDef, type Line, type Speaker, arrivedFlag, chapterForWorld, partId } from "../../content/chapters";
import { STORY_COPY } from "../../content/chapters/common";
import { fact } from "../../content/facts";
import {
  AIM_START,
  ENDING,
  FINALE,
  FINALE_AIMED,
  FINALE_BEGINS,
  FINALE_BEGUN,
  FINALE_ENDED,
  FINALE_HEARD,
  FINALE_PAGE,
  LAST_PAGE,
  LETTER_TAKEN,
  MESSAGES,
  MILO_VOICE,
  RECORD_FITTED,
  SENT,
  STAMP,
  V1_LETTER,
  finaleOpen,
  finaleStep,
} from "../../content/finale";
import { factText } from "../../content/notebook";
import type { GameState } from "../../game/core/state";
import type { Engine } from "../../game/engine";
import { audio } from "../../audio/audio";

/**
 * The story director plays the chapter scripts (src/content/chapters/):
 * speech bubbles, Dad's note cards and fact cards, one line after another.
 * It listens to what happens in the world (arrivals, deliveries, activity
 * steps, Milo's new parts) and moves the chapter on: the next letter, the
 * activity, the parcel, the memory and the stamp.
 *
 * Nothing here can fail or time out. A card waits for the player.
 */
const NAMES: Record<Speaker, string> = { remi: "Remi", nori: "Nori", lumi: "Lumi", theo: "Theo", mom: "Mom", dad: "Dad", milo: "Milo" };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

export class StoryDirector {
  private chain: Promise<void> = Promise.resolve();
  private depth = 0;
  private key = 0;
  private waiting = new Map<number, () => void>();
  private offs: (() => void)[] = [];

  constructor(
    private engine: Engine,
    private toast: (text: string) => void,
  ) {
    const bus = engine.bus;
    this.offs.push(
      bus.on("story:card-done", ({ key }) => {
        const done = this.waiting.get(key);
        this.waiting.delete(key);
        if (this.waiting.size === 0) engine.interactions.blocked = false;
        done?.();
      }),
      bus.on("world:ready", ({ id }) => {
        void this.arrive(id);
        if (id === "home") void this.resumeFinale();
      }),
      bus.on("finale:aim", () => void this.aim()),
      // A save that opens in the Finale picks it up once play begins.
      bus.on("title:done", () => void this.resumeFinale()),
      bus.on("letter:delivered", ({ letter }) => this.delivered(letter)),
      bus.on("letter:taken", ({ letter }) => {
        const chapter = CHAPTERS.find((c) => partId(c) === letter);
        if (chapter) this.toast(STORY_COPY.partTaken);
        if (letter === V1_LETTER) void this.play(LETTER_TAKEN);
      }),
      bus.on("activity:beat", ({ id, beat }) => {
        const line = ACTIVITIES[id]?.beats[beat];
        // Beats are little reactions: skip them if a script is already talking.
        if (line && this.depth === 0) void this.play(["note" in line ? line : { say: line.say, who: line.who }]);
      }),
      bus.on("activity:done", ({ id }) => {
        const chapter = CHAPTERS.find((c) => c.activity === id);
        if (chapter) void this.play([{ wait: 0.8 }, ...chapter.activityDone, { say: STORY_COPY.partFound, who: "remi", at: "tag" }]);
      }),
      bus.on("milo:stage", ({ stage }) => {
        const chapter = CHAPTERS.find((c) => c.milo === stage);
        if (chapter) void this.fitted(chapter);
        else if (stage === MILO_VOICE) void this.play(RECORD_FITTED).then(() => this.resumeFinale());
      }),
    );
    // Already playing (a reload, or a test that skips the title): pick the Finale up now.
    window.setTimeout(() => {
      if (engine.mode === "play") void this.resumeFinale();
    }, 1200);
  }

  /** True while a script is playing. */
  get busy(): boolean {
    return this.depth > 0;
  }

  /** Plays lines one after another, after anything already playing. */
  play(lines: Line[]): Promise<void> {
    const run = this.chain.then(async () => {
      this.depth += 1;
      try {
        for (const line of lines) await this.line(line);
      } finally {
        this.depth -= 1;
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async line(line: Line): Promise<void> {
    if ("wait" in line) return sleep(line.wait * 1000);
    if ("say" in line) {
      const anchor = line.at ? this.engine.world?.anchor(line.at) : null;
      const at = anchor ?? (line.who === "remi" ? this.engine.playerHead() : null);
      this.engine.bus.emit("say", {
        speaker: line.who,
        name: line.name ?? NAMES[line.who],
        text: line.say,
        at: at ? [at.x, at.y, at.z] : null,
        ...(line.voice ? { line: line.voice } : {}),
      });
      // As long as the bubble stays up (see Speech.svelte), and a breath after.
      return sleep((Math.max(2.8, line.say.length * 0.065 + 1.8) + 0.3) * 1000);
    }
    if ("recording" in line) {
      // A real mission recording: the caption shows the words exactly as heard.
      this.engine.bus.emit("say", { speaker: "radio", name: `${line.name} (real recording)`, text: line.caption, at: null, recording: true });
      const reading = (Math.max(3, line.caption.length * 0.07 + 1.8) + 0.4) * 1000;
      await Promise.all([audio.clip(line.recording), sleep(reading)]);
      return;
    }
    if ("game" in line) {
      const key = ++this.key;
      this.engine.interactions.blocked = true;
      await new Promise<void>((resolve) => {
        const off = this.engine.bus.on("story:game-done", (done) => {
          if (done.key !== key) return;
          off();
          resolve();
        });
        this.engine.bus.emit("story:game", { key, id: line.game });
      });
      this.engine.interactions.blocked = this.waiting.size > 0;
      return;
    }
    if ("cue" in line) {
      this.engine.bus.emit("story:cue", { id: line.cue });
      return;
    }
    if ("note" in line) return this.card("note", line.note);
    // Date-aware facts (Voyager 1's light-day) read the same as in the notebook.
    return this.card("fact", factText(fact(line.fact)), line.fact);
  }

  private card(kind: "note" | "fact", text: string, id?: string): Promise<void> {
    const key = ++this.key;
    this.engine.interactions.blocked = true;
    return new Promise((resolve) => {
      this.waiting.set(key, resolve);
      this.engine.bus.emit("story:card", { key, kind, text, ...(id ? { fact: id } : {}) });
    });
  }

  private update(change: (s: GameState) => void): void {
    this.engine.store.update(change);
  }

  /** Hands Remi the chapter's next letter from Dad's satchel. */
  private giveNext(chapter: ChapterDef): void {
    const s = this.engine.store.value;
    if (s.carrying !== null) return;
    const next = chapter.letters.find((l) => !s.delivered.includes(l.id));
    if (!next) return;
    this.update((d) => void (d.carrying = next.id));
    this.engine.bus.emit("letter:taken", { letter: next.id });
    this.toast(`${STORY_COPY.nextLetter} ${next.address}`);
  }

  private async arrive(world: string): Promise<void> {
    const chapter = chapterForWorld(world);
    if (!chapter) return;
    const s = this.engine.store.value;
    if (s.flags.includes(arrivedFlag(chapter))) return;
    await this.play(chapter.arrival);
    this.update((d) => {
      if (!d.flags.includes(arrivedFlag(chapter))) d.flags.push(arrivedFlag(chapter));
    });
    this.giveNext(chapter);
  }

  private async delivered(letter: string): Promise<void> {
    const chapter = CHAPTERS.find((c) => c.letters.some((l) => l.id === letter));
    if (!chapter) return;
    const def = chapter.letters.find((l) => l.id === letter)!;
    await this.play([{ wait: 0.9 }, ...def.beat]);
    const s = this.engine.store.value;
    if (chapter.letters.every((l) => s.delivered.includes(l.id))) {
      this.engine.bus.emit("activity:start", { id: chapter.activity });
      await this.play(chapter.activityStart);
    } else this.giveNext(chapter);
  }

  /** Milo's new part clicked in: Remi's lines, the memory, then the stamp. */
  private async fitted(chapter: ChapterDef): Promise<void> {
    await this.play([{ wait: 1.2 }, ...chapter.partFitted, { wait: 0.6 }, ...chapter.memory]);
    this.engine.bus.emit("stamp", { id: chapter.id, lines: chapter.stamp });
    this.update((d) => {
      if (!d.stamps.includes(chapter.id)) d.stamps.push(chapter.id);
    });
    await sleep(3400);
    this.toast(STORY_COPY.saved);
    if (finaleOpen(this.engine.store.value)) void this.resumeFinale();
  }

  // ---- Finale: The Long Light ----

  private finaleBusy = false;

  /**
   * Moves the Finale on from wherever the save stands: night and the mailbox
   * flag, then (after Milo's record) the messages, the last page, the stamp
   * and the ending. Safe to call again: it only plays what is still to come.
   */
  private async resumeFinale(): Promise<void> {
    if (this.finaleBusy) return;
    const state = (): GameState => this.engine.store.value;
    if (!finaleOpen(state()) || this.engine.world?.id !== "home") return;
    this.finaleBusy = true;
    try {
      if (!state().flags.includes(FINALE_BEGUN)) {
        this.flag(FINALE_BEGUN);
        this.engine.bus.emit("story:banner", { label: "Finale", name: "The Long Light" });
        await this.play(FINALE_BEGINS);
      }
      if (finaleStep(state()) === "listen") {
        await this.play(MESSAGES);
        this.flag(FINALE_HEARD);
      }
      if (finaleStep(state()) === "page") {
        await this.play(LAST_PAGE);
        this.flag(FINALE_PAGE);
        this.engine.bus.emit("stamp", { id: FINALE, lines: STAMP });
        this.update((d) => {
          if (!d.stamps.includes(FINALE)) d.stamps.push(FINALE);
        });
        await sleep(3400);
        this.toast(STORY_COPY.saved);
      }
      if (finaleStep(state()) === "ending") {
        await this.play(ENDING);
        this.flag(FINALE_ENDED);
      }
    } finally {
      this.finaleBusy = false;
    }
  }

  /** The dish is aimed: find Voyager 1, send the letter, and the facts that go with it. */
  private aiming = false;
  private async aim(): Promise<void> {
    if (this.aiming || this.engine.store.value.carrying !== V1_LETTER) return;
    this.aiming = true;
    try {
      await this.play([...AIM_START, { game: "dish" }]);
    } finally {
      this.aiming = false;
    }
    this.update((d) => {
      d.carrying = null;
      if (!d.delivered.includes(V1_LETTER)) d.delivered.push(V1_LETTER);
      if (!d.flags.includes(FINALE_AIMED)) d.flags.push(FINALE_AIMED);
    });
    this.engine.bus.emit("letter:delivered", { letter: V1_LETTER, to: "dish" });
    await this.play(SENT);
  }

  private flag(id: string): void {
    this.update((d) => {
      if (!d.flags.includes(id)) d.flags.push(id);
    });
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.engine.interactions.blocked = false;
  }
}

