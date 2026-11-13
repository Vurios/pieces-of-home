import { type Group, type Object3D, Quaternion, Vector3 } from "three";
import { PINPOINT, doneFlag, startedFlag, stepFlag } from "../../content/chapters/activities";
import type { Site } from "../worlds/kit/little-world";
import type { WorldContext } from "../worlds/types";
import type { Activity } from "./types";

/**
 * The bonus chapter's activity, Pinpoint (Game Bible 6, P2).
 *
 * 1. Dad's landing table (a small game on screen): find the Snowman, the
 *    pattern of craters the Apollo 12 crew steered by, and set a toy lander
 *    down right next to Surveyor 3.
 * 2. Dad's cutters (a small game on screen): snip Surveyor's camera, its
 *    scoop and a piece of tube, the parts the astronauts took home.
 * 3. Carry the parts bag up the hill and pack it in the sample box by
 *    Intrepid's ladder.
 *
 * Nothing can fail. The steps go in order; the save keeps them as flags.
 */
const ID = PINPOINT.id;
const BAG = "bag:surveyor";

export interface PinpointSpec {
  ctx: WorldContext;
  /** Where a player stands to use the landing table, and the toy lander over it. */
  table: Vector3;
  toyLander: Object3D;
  /** The toy lander's rest point and the map spot it lands on, in world space. */
  toyRest: Vector3;
  toyLand: Vector3;
  toyUp: Vector3;
  /** Where a player stands to use the cutters on Surveyor. */
  surveyor: Vector3;
  /** The parts that come off: hidden once snipped. */
  parts: Object3D[];
  /** The parts bag, waiting at Surveyor's feet after the snip, and the one packed in the box. */
  bag: Object3D;
  bagSite: Site;
  packed: Object3D;
  /** The sample box and its lid. */
  box: Vector3;
  lid: Group;
  /** Two good views: over the crater (Intrepid and Surveyor together) and close on Surveyor's camera. */
  views: { crater: { position: Vector3; target: Vector3 }; camera: { position: Vector3; target: Vector3 } };
}

export class Pinpoint implements Activity {
  readonly id = ID;
  private time = 0;
  private gameKey = 0;
  private told = new Set<string>();
  private offs: (() => void)[] = [];
  /** 0 hanging at rest, 1 landed on the map. */
  private drop = 0;
  /** 0 open, 1 shut. */
  private shut = 0;
  private readonly lidBase: Quaternion;
  private readonly bagHome: Vector3;

  constructor(private spec: PinpointSpec) {
    this.lidBase = spec.lid.quaternion.clone();
    this.bagHome = spec.bag.position.clone();
    this.addInteractions();
    this.offs.push(spec.ctx.bus.on("activity:start", ({ id }) => id === ID && this.start()));
    this.drop = this.has("land") ? 1 : 0;
    this.shut = this.has("pack") ? 1 : 0;
    this.pose();
  }

  private get saved(): readonly string[] {
    return this.spec.ctx.store.value.flags;
  }

  private has(step: string): boolean {
    return this.saved.includes(stepFlag(ID, step));
  }

  private get started(): boolean {
    return this.saved.includes(startedFlag(ID));
  }

  private get done(): boolean {
    return this.saved.includes(doneFlag(ID));
  }

  private get carrying(): string | null {
    return this.spec.ctx.store.value.carrying;
  }

  private setFlag(flag: string): boolean {
    if (this.saved.includes(flag)) return false;
    this.spec.ctx.store.update((s) => void s.flags.push(flag));
    return true;
  }

  private beat(name: string): void {
    if (this.told.has(name)) return;
    this.told.add(name);
    this.spec.ctx.bus.emit("activity:beat", { id: ID, beat: name });
  }

  private sfx(name: string, point: Vector3, delay?: number): void {
    this.spec.ctx.bus.emit("sfx", { name, at: [point.x, point.y, point.z], ...(delay === undefined ? {} : { delay }) });
  }

  private step(name: string): void {
    if (this.setFlag(stepFlag(ID, name))) this.spec.ctx.bus.emit("activity:step", { id: ID, step: name });
  }

  start(): void {
    this.setFlag(startedFlag(ID));
  }

  /** Opens a small game on screen and runs `then` when it is done. */
  private play(id: string, then: () => void): void {
    const { bus } = this.spec.ctx;
    const key = 900_000 + Math.floor(Math.random() * 99_999);
    this.gameKey = key;
    const off = bus.on("story:game-done", (done) => {
      if (done.key !== key) return;
      off();
      this.gameKey = 0;
      then();
    });
    this.offs.push(off);
    bus.emit("story:game", { key, id });
  }

  private look(view: { position: Vector3; target: Vector3 }, seconds: number): void {
    const up = view.target.clone().normalize();
    this.spec.ctx.bus.emit("camera:cinematic", { position: view.position.toArray() as [number, number, number], target: view.target.toArray() as [number, number, number], up: up.toArray() as [number, number, number], seconds });
  }

  private addInteractions(): void {
    const { interactions, store } = this.spec.ctx;
    interactions.add({
      id: "landing-table",
      position: this.spec.table,
      radius: 1.5,
      kind: "press",
      label: () => (this.started && !this.has("land") && this.gameKey === 0 ? "Try Dad's landing table" : null),
      onDone: () =>
        this.play("pinpoint", () => {
          this.step("land");
          this.sfx("rocket-land", this.spec.toyLand);
          // Then the real thing: a look over the crater, Intrepid on the rim and Surveyor below.
          this.look(this.spec.views.crater, 4.2);
          window.setTimeout(() => this.beat("landed"), 600);
        }),
    });
    interactions.add({
      id: "surveyor-cutters",
      position: this.spec.surveyor,
      radius: 1.7,
      kind: "press",
      label: () => (this.started && this.has("land") && !this.has("snip") && this.gameKey === 0 ? "Use Dad's cutters on Surveyor" : null),
      onDone: () => {
        this.look(this.spec.views.camera, 2.2);
        window.setTimeout(
          () =>
            this.play("snip", () => {
              this.step("snip");
              this.sfx("part-clunk", this.spec.bagSite.origin);
              this.beat("snipped");
            }),
          900,
        );
      },
    });
    interactions.add({
      id: "parts-bag",
      position: this.spec.bagSite.origin,
      radius: 1.3,
      kind: "press",
      label: () => (this.has("snip") && !this.has("pack") && this.carrying === null ? "Pick up the parts bag" : null),
      onDone: () => {
        store.update((s) => void (s.carrying = BAG));
        this.spec.ctx.bus.emit("letter:taken", { letter: BAG });
        this.beat("bag");
      },
    });
    interactions.add({
      id: "sample-box",
      position: this.spec.box,
      radius: 1.4,
      kind: "press",
      label: () => (this.carrying === BAG ? "Put the bag in the sample box" : null),
      onDone: () => {
        store.update((s) => void (s.carrying = null));
        this.sfx("part-clunk", this.spec.box, 0.5);
        this.step("pack");
        this.finish();
      },
    });
  }

  private finish(): void {
    if (this.setFlag(doneFlag(ID))) this.spec.ctx.bus.emit("activity:done", { id: ID });
  }

  objective(): Vector3 | null {
    if (!this.started || this.done) return null;
    if (!this.has("land")) return this.spec.table;
    if (!this.has("snip")) return this.spec.surveyor;
    if (this.carrying === BAG) return this.spec.box;
    return this.spec.bagSite.origin;
  }

  /** Places the toy lander, the parts, the bag and the lid from the save and the animations. */
  private pose(): void {
    const { toyLander, toyRest, toyLand, toyUp } = this.spec;
    const k = this.drop * this.drop * (3 - 2 * this.drop);
    toyLander.position.copy(toyRest).lerp(toyLand, k);
    // A little sway on its string while it hangs.
    toyLander.position.addScaledVector(toyUp, (1 - k) * Math.sin(this.time * 1.4) * 0.015);
    const snipped = this.has("snip");
    for (const part of this.spec.parts) part.visible = !snipped;
    this.spec.bag.visible = snipped && !this.has("pack") && this.carrying !== BAG;
    this.spec.bag.position.copy(this.bagHome);
    this.spec.packed.visible = this.has("pack");
    const angle = -1.9 * (1 - this.shut);
    this.spec.lid.quaternion.copy(this.lidBase).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle));
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const speed = reducedMotion ? 6 : 0.9;
    const drop = this.has("land") ? 1 : 0;
    this.drop += Math.sign(drop - this.drop) * Math.min(Math.abs(drop - this.drop), dt * speed);
    const shut = this.has("pack") ? 1 : 0;
    this.shut += Math.sign(shut - this.shut) * Math.min(Math.abs(shut - this.shut), dt * speed * 1.4);
    this.pose();
  }

  debugState(): { steps: string[]; carrying: string | null } {
    return { steps: PINPOINT.steps.filter((s) => this.has(s.id)).map((s) => s.id), carrying: this.carrying };
  }

  solve(): void {
    for (const flag of [startedFlag(ID), ...PINPOINT.steps.map((s) => stepFlag(ID, s.id))]) this.setFlag(flag);
    if (this.carrying === BAG) this.spec.ctx.store.update((s) => void (s.carrying = null));
    this.finish();
  }

  dispose(): void {
    for (const off of this.offs) off();
  }
}
