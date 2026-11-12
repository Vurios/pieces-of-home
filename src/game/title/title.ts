import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  type PerspectiveCamera,
  PointLight,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import { box, cylinder, sphere, torus } from "../actors/parts";
import type { GameBus } from "../core/events";
import type { ToonLibrary } from "../render/toon";
import { GLYPH_ROWS, glyphWidth, letterGeometry } from "./letters";

/** Where the title flight starts and ends, from the world. */
export interface IntroSpec {
  /** The lamp's bulb: the flight opens framed on its glow. */
  lamp: Vector3;
  /** Camera points from beside the lamp, out through the window and up. */
  path: Vector3[];
  /** The resting title camera. */
  final: { position: Vector3; target: Vector3; up: Vector3 };
  /** The planet's radius at the horizon, so the title can sit on it at any planet size. */
  radius: number;
}

const LINES = ["PIECES", "OF", "HOME"];
const CELL = 0.5;
const DEPTH = 0.9;
const FLIGHT = 6.8;
const DROP = 0.6;
const GAP = 0.13;
/** The whole title's size, so all three lines fit above the planet. */
const SCALE = 0.72;

interface Letter {
  mesh: Group;
  rest: Vector3;
  start: number;
  landed: boolean;
  index: number;
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The opening: the camera pulls back from Dad's lamp, out through the
 * workshop window and up to the whole planet. Then "PIECES / OF / HOME"
 * drops onto the horizon letter by letter, each landing with a note. The O
 * in HOME is a glass bulb that warms up, and a pull chain hangs below it.
 */
export class TitleSequence {
  readonly root = new Group();
  phase: "flight" | "letters" | "waiting" | "pulled" | "leaving" | "done" = "flight";
  private time = 0;
  private playing = false;
  private lastNow: number | null = null;
  private letters: Letter[] = [];
  private curve: CatmullRomCurve3;
  private bulbGlass!: Mesh;
  private bulbGlow!: Mesh<never, MeshBasicMaterial>;
  private filament!: MeshBasicMaterial;
  private bulbLight = new PointLight("#FFC27A", 0, 14, 1.4);
  private scale = SCALE;
  /** The scale the title was tuned at, before it shrinks to fit a narrow screen. */
  private baseScale = SCALE;
  /** Half the width of the widest line, in title units. */
  private halfWidth = 0;
  private fitted = "";
  private chain = new Group();
  private chainLinks: Mesh[] = [];
  private tag: Group;
  private pull = 0;
  private pullVelocity = 0;
  private dragging = false;
  private warm = 0;
  private bright = 0;
  private leaveTime = 0;
  private leaveFrom = { position: new Vector3(), quaternion: new Quaternion() };
  private materials: Material[] = [];
  private tagTexture: CanvasTexture;
  private frame = { right: new Vector3(), up: new Vector3(), toward: new Vector3(), anchor: new Vector3() };
  private scratch = new Vector3();

  constructor(
    private toon: ToonLibrary,
    private intro: IntroSpec,
    private bus: GameBus,
    private reducedMotion: boolean,
  ) {
    this.root.name = "title";
    this.curve = new CatmullRomCurve3([...intro.path, intro.final.position], false, "centripetal");

    // The title stands in front of the planet, lined up so its baseline sits on the horizon.
    const { position, target, up } = intro.final;
    const forward = target.clone().sub(position).normalize();
    const screenUp = up.clone().addScaledVector(forward, -up.dot(forward)).normalize();
    const right = new Vector3().crossVectors(forward, screenUp).normalize();
    const toCamera = position.clone().normalize();
    const distance = position.length();
    // Everything was tuned on a 15.4 m horizon; a bigger planet scales the title with it.
    const radius = this.intro.radius;
    const k = radius / 15.4;
    this.scale = SCALE * k;
    this.baseScale = this.scale;
    const theta = Math.asin(Math.min(0.99, radius / distance));
    const limb = screenUp.clone().multiplyScalar(Math.cos(theta)).addScaledVector(toCamera, Math.sin(theta)).multiplyScalar(radius);
    const anchor = limb.clone().add(position.clone().sub(limb).normalize().multiplyScalar(17 * k));
    this.frame = { right, up: screenUp, toward: forward.clone().negate(), anchor };
    this.root.matrixAutoUpdate = false;
    this.root.matrix.makeBasis(right, screenUp, this.frame.toward).scale(new Vector3(this.scale, this.scale, this.scale)).setPosition(anchor);
    this.root.matrixWorldNeedsUpdate = true;

    const painted = (color: string): Material => {
      const m = this.toon.toon({ color, paint: 0.12, rim: 0.8 });
      return m;
    };
    const wood = painted("#9C6A43");
    const faces = [painted("#FFF6E4"), painted("#F7A93A"), painted("#FFF6E4")];
    // A thick ink outline round every block letter, so the title reads against any sky.
    const ink = new MeshBasicMaterial({ color: "#241c18", side: BackSide });
    this.materials.push(ink);
    const OUTLINE = 0.075;

    // Letters, line by line, centered. Lines stack from the top down.
    const lineHeight = (GLYPH_ROWS + 1.3) * CELL;
    let order = 0;
    LINES.forEach((line, row) => {
      const widths = [...line].map((ch) => glyphWidth(ch));
      const total = widths.reduce((s, w) => s + w, 0) + (line.length - 1);
      this.halfWidth = Math.max(this.halfWidth, (total / 2) * CELL);
      let x = (-total / 2) * CELL;
      const y = (LINES.length - 1 - row) * lineHeight;
      [...line].forEach((ch, i) => {
        const w = widths[i]!;
        const cx = x + (w / 2) * CELL;
        x += (w + 1) * CELL;
        const holder = new Group();
        if (row === 2 && ch === "O") {
          const bulb = this.buildBulb(w);
          holder.add(bulb);
        } else {
          const geometry = letterGeometry(ch, CELL, DEPTH);
          const mesh = new Mesh(geometry, [faces[row]!, wood]);
          mesh.castShadow = false;
          holder.add(mesh);
          geometry.computeBoundingBox();
          const box3 = geometry.boundingBox!;
          const size = box3.getSize(new Vector3());
          const center = box3.getCenter(new Vector3());
          const hull = new Mesh(geometry, ink);
          hull.scale.set(1 + (2 * OUTLINE) / size.x, 1 + (2 * OUTLINE) / size.y, 1 + (2 * OUTLINE) / size.z);
          hull.position.set(center.x * (1 - hull.scale.x), center.y * (1 - hull.scale.y), center.z * (1 - hull.scale.z));
          holder.add(hull);
        }
        // A slight lean on some letters, the way wooden blocks never sit quite square.
        holder.rotation.z = ((order * 7919) % 7) / 7 > 0.6 ? (order % 2 ? 0.035 : -0.03) : 0;
        const rest = new Vector3(cx, y, 0);
        holder.position.copy(rest);
        holder.visible = false;
        this.root.add(holder);
        this.letters.push({ mesh: holder, rest, start: order * GAP, landed: false, index: order });
        order += 1;
      });
    });

    this.tagTexture = this.makeTagTexture();
    this.tag = this.buildChain();
    this.root.add(this.bulbLight);
  }

  private bulbX = 0;

  /** The O in HOME: a glass bulb on a brass screw base. */
  private buildBulb(width: number): Group {
    const g = new Group();
    const r = (width / 2) * CELL * 1.02;
    const glass = this.toon.glass("#FFF3D6");
    this.bulbGlass = new Mesh(sphere("high"), glass);
    this.bulbGlass.scale.set(r, r * 1.08, r * 0.9);
    this.bulbGlass.position.y = 2.9 * CELL;
    this.bulbGlass.renderOrder = 3;
    // Inner warm glow, faded in as the bulb warms.
    const glowMaterial = new MeshBasicMaterial({ color: "#FFB65C", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    this.materials.push(glowMaterial);
    this.bulbGlow = new Mesh(sphere("mid"), glowMaterial) as unknown as Mesh<never, MeshBasicMaterial>;
    this.bulbGlow.scale.set(r * 0.78, r * 0.82, r * 0.7);
    this.bulbGlow.position.y = 2.9 * CELL;
    this.bulbGlow.renderOrder = 2;
    // Filament on two little posts.
    this.filament = new MeshBasicMaterial({ color: "#5A4A3A" });
    this.materials.push(this.filament);
    // A short coiled filament strung across the posts: a row of tiny loops, not a letter shape.
    const coil = new Group();
    for (let i = 0; i < 5; i += 1) {
      const loop = new Mesh(torus(0.32), this.filament);
      loop.scale.setScalar(r * 0.055);
      loop.rotation.y = Math.PI / 2;
      loop.position.x = (i - 2) * r * 0.11;
      coil.add(loop);
    }
    coil.position.y = 3.0 * CELL;
    const metal = this.toon.toon({ color: "#B9B4AA", paint: 0.05 });
    const brass = this.toon.toon({ color: "#D9A441", paint: 0.08, rim: 0.9 });
    for (const side of [-1, 1]) {
      const post = new Mesh(cylinder(6), metal);
      post.scale.set(0.02, 1.1 * CELL, 0.02);
      post.position.set(side * r * 0.28, 2.4 * CELL, 0);
      g.add(post);
    }
    // Screw base with threads, and a dark tip.
    const base = new Mesh(cylinder(18, 1.05), brass);
    base.scale.set(r * 0.5, 1.05 * CELL, r * 0.5);
    base.position.y = 0.58 * CELL;
    for (let i = 0; i < 3; i += 1) {
      const thread = new Mesh(torus(0.22), brass);
      thread.scale.set(r * 0.52, r * 0.52, r * 0.6);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = (0.3 + i * 0.32) * CELL;
      g.add(thread);
    }
    const tip = new Mesh(cylinder(12, 0.6), this.toon.toon({ color: "#2B2622" }));
    tip.scale.set(r * 0.22, 0.18 * CELL, r * 0.22);
    tip.position.y = 0.02 * CELL;
    const neck = new Mesh(cylinder(18, 1.4), brass);
    neck.scale.set(r * 0.52, 0.4 * CELL, r * 0.52);
    neck.position.y = 1.25 * CELL;
    g.add(this.bulbGlow, coil, base, tip, neck, this.bulbGlass);
    return g;
  }

  private makeTagTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#FFF6E4";
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = "#B13F2C";
    c.lineWidth = 8;
    c.strokeRect(9, 9, 238, 110);
    c.lineWidth = 3;
    c.strokeRect(20, 20, 216, 88);
    c.fillStyle = "#B13F2C";
    c.font = "700 60px 'Zilla Slab', Georgia, serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("BEGIN", 128, 70);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  /** A beaded pull chain hanging from the bulb's base, with a paper BEGIN tag. */
  private buildChain(): Group {
    const home = this.letters.filter((l) => l.rest.y === 0);
    const bulb = home[1]!;
    this.bulbX = bulb.rest.x;
    this.bulbLight.position.set(this.bulbX, 2.9 * CELL, 1);
    this.chain.position.set(this.bulbX + 0.42, -0.05, 0.25);
    const metal = this.toon.toon({ color: "#B9B4AA", paint: 0.05, rim: 1 });
    for (let i = 0; i < 16; i += 1) {
      const bead = new Mesh(sphere("low"), metal);
      bead.scale.setScalar(0.045);
      this.chain.add(bead);
      this.chainLinks.push(bead);
    }
    const tag = new Group();
    const card = new MeshToonMaterial({ map: this.tagTexture, gradientMap: this.toon.bands });
    this.materials.push(card);
    const face = new Mesh(box(0.02), [this.toon.toon({ color: "#E8DCC5" }), this.toon.toon({ color: "#E8DCC5" }), this.toon.toon({ color: "#E8DCC5" }), this.toon.toon({ color: "#E8DCC5" }), card, this.toon.toon({ color: "#E8DCC5" })]);
    face.scale.set(1.9, 0.95, 0.03);
    face.position.y = -0.54;
    const ring = new Mesh(torus(0.25), metal);
    ring.scale.setScalar(0.06);
    tag.add(face, ring);
    this.chain.add(tag);
    this.chain.visible = false;
    this.root.add(this.chain);
    return tag;
  }

  /** Where the BEGIN tag is on screen, in CSS pixels, for the accessible button over it. */
  tagScreen(camera: PerspectiveCamera, width: number, height: number): { x: number; y: number; visible: boolean } {
    // Where the tag hangs at rest, with no sway and no pull: the chain moves, the button over it holds still.
    const sway = this.chain.rotation.z;
    const hang = this.tag.position.y;
    this.chain.rotation.z = 0;
    this.tag.position.y = -1.2 - 0.04;
    this.root.updateMatrixWorld();
    this.tag.updateMatrixWorld();
    const p = this.scratch.set(0, -0.54, 0).applyMatrix4(this.tag.matrixWorld).project(camera);
    this.chain.rotation.z = sway;
    this.tag.position.y = hang;
    this.root.updateMatrixWorld();
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height, visible: this.chain.visible && p.z < 1 };
  }

  /** World point at the center of the title, for the tilt-shift focus. */
  focusPoint(): Vector3 {
    return this.frame.anchor.clone().addScaledVector(this.frame.up, 4.5 * this.scale);
  }

  play(): void {
    this.playing = true;
  }

  /** Jumps to the finished title. */
  skip(): void {
    if (this.phase === "flight" || this.phase === "letters") {
      this.time = Math.max(this.time, FLIGHT + this.letters.length * GAP + DROP + 2);
      for (const letter of this.letters) {
        letter.mesh.visible = true;
        letter.mesh.position.copy(letter.rest);
        letter.mesh.scale.setScalar(1);
        letter.landed = true;
      }
      this.phase = "waiting";
      this.chain.visible = true;
      this.warm = 1;
      this.bus.emit("title:ready", {});
    }
  }

  /** Drag the chain: 0 at rest, 1 fully pulled. */
  drag(amount: number): void {
    this.dragging = true;
    this.pull = Math.max(0, Math.min(1, amount));
  }

  release(): void {
    this.dragging = false;
  }

  /** Pull the chain: the bulb brightens and the planet's windows light up. */
  begin(): void {
    if (this.phase !== "waiting") return;
    this.phase = "pulled";
    this.pullVelocity = 6;
    this.bus.emit("title:pulled", {});
  }

  /** Flies from the title camera down to the player's follow camera. */
  leave(camera: PerspectiveCamera): void {
    if (this.phase === "leaving" || this.phase === "done") return;
    this.phase = "leaving";
    this.leaveTime = 0;
    this.leaveFrom.position.copy(camera.position);
    this.leaveFrom.quaternion.copy(camera.quaternion);
  }

  /**
   * Runs one frame and drives the camera. During "leaving" the engine first
   * places the camera where the follow camera wants it; we blend toward it.
   */
  /**
   * On a tall phone the full-size title is wider than the screen. Shrink it
   * about its baseline, so HOME still sits on the horizon and every letter shows.
   */
  private fit(camera: PerspectiveCamera): void {
    const key = `${camera.fov}:${camera.aspect.toFixed(3)}`;
    if (key === this.fitted) return;
    this.fitted = key;
    const distance = this.intro.final.position.distanceTo(this.frame.anchor);
    const halfView = distance * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    const f = Math.min(1, (0.86 * halfView) / (this.baseScale * this.halfWidth));
    this.scale = this.baseScale * f;
    const { right, up, toward, anchor } = this.frame;
    this.root.matrix.makeBasis(right, up, toward).scale(new Vector3(this.scale, this.scale, this.scale)).setPosition(anchor);
    this.root.matrixWorldNeedsUpdate = true;
  }

  update(frameDt: number, camera: PerspectiveCamera): void {
    this.fit(camera);
    // Wall-clock time, so a slow machine sees the same 7-second flight instead of slow motion.
    const now = performance.now();
    const dt = this.lastNow === null ? frameDt : Math.min(0.25, (now - this.lastNow) / 1000);
    this.lastNow = now;
    if (this.playing) this.time += dt;
    const reduced = this.reducedMotion;

    if (this.phase === "flight" || this.phase === "letters") {
      if (reduced && this.playing) this.skip();
      const t = Math.min(1, this.time / FLIGHT);
      const e = easeInOut(t);
      const pos = this.curve.getPoint(e);
      camera.position.copy(pos);
      // Hold on the lamp while backing out the door, then turn to the planet.
      const turn = ease(Math.min(1, Math.max(0, (t - 0.48) / 0.4)));
      const look = this.scratch.copy(this.intro.lamp).lerp(this.intro.final.target, turn);
      const up = pos.clone().normalize().lerp(this.intro.final.up, ease(Math.min(1, Math.max(0, (t - 0.45) / 0.5)))).normalize();
      camera.up.copy(up);
      camera.lookAt(look);
      if (this.time > FLIGHT * 0.78 && this.phase === "flight") this.phase = "letters";
    } else if (this.phase !== "leaving" && this.phase !== "done") {
      camera.position.copy(this.intro.final.position);
      camera.up.copy(this.intro.final.up);
      camera.lookAt(this.intro.final.target);
    }

    // Letters drop in reading order, each with a soft bounce and a note.
    if (this.phase === "letters") {
      const local = this.time - FLIGHT * 0.78;
      let allLanded = true;
      for (const letter of this.letters) {
        const t = (local - letter.start) / DROP;
        if (t < 0) {
          allLanded = false;
          continue;
        }
        letter.mesh.visible = true;
        if (t < 1) {
          allLanded = false;
          const fall = 1 - t * t;
          letter.mesh.position.copy(letter.rest).addScaledVector(new Vector3(0, 1, 0), fall * 9);
          letter.mesh.scale.set(1 - 0.06 * (1 - t), 1 + 0.12 * (1 - t), 1);
        } else {
          if (!letter.landed) {
            letter.landed = true;
            this.bus.emit("title:note", { index: letter.index });
          }
          const k = Math.min(1, (t - 1) * DROP / 0.45);
          // Squash on impact, then a little spring.
          const squash = Math.sin(k * Math.PI * 2.2) * (1 - k) * 0.22;
          letter.mesh.position.copy(letter.rest).addScaledVector(new Vector3(0, 1, 0), Math.max(0, Math.sin(k * Math.PI) * (1 - k) * 0.35));
          letter.mesh.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.3);
          if (k < 1) allLanded = false;
        }
      }
      if (allLanded) {
        this.phase = "waiting";
        this.chain.visible = true;
        this.bus.emit("title:ready", {});
      }
    }

    // The bulb warms after the last letter lands, and blazes when the chain is pulled.
    if (this.phase === "waiting" || this.phase === "pulled" || this.phase === "leaving") this.warm = Math.min(1, this.warm + dt * 0.7);
    if (this.phase === "pulled" || this.phase === "leaving") this.bright = Math.min(1, this.bright + dt * 1.6);
    const glow = this.warm * 0.55 + this.bright * 0.45;
    this.bulbGlow.material.opacity = glow * 0.75;
    this.filament.color.copy(FILAMENT_COLD).lerp(FILAMENT_HOT, glow);
    this.bulbLight.intensity = glow * 9;

    // The chain: a spring back to rest after a pull, and a lazy sway.
    if (!this.dragging) {
      this.pullVelocity += (-this.pull * 90 - this.pullVelocity * 9) * dt;
      this.pull += this.pullVelocity * dt;
      if (this.phase === "pulled" && this.pull < 0) this.pull = Math.max(this.pull, -0.15);
    }
    const sway = reduced ? 0 : Math.sin(this.time * 1.3) * 0.04;
    this.chain.rotation.z = sway;
    const length = 1.2 + Math.max(0, this.pull) * 0.7;
    this.chainLinks.forEach((bead, i) => bead.position.set(0, (-(i + 0.5) / this.chainLinks.length) * length, 0));
    this.tag.position.set(0, -length - 0.04, 0);

    if (this.phase === "leaving") {
      this.leaveTime += dt;
      const t = reduced ? 1 : Math.min(1, this.leaveTime / 2.4);
      const e = easeInOut(t);
      // The engine set the camera to the follow pose; blend from the title pose toward it.
      const toPos = camera.position.clone();
      const toRot = camera.quaternion.clone();
      camera.position.lerpVectors(this.leaveFrom.position, toPos, e);
      camera.quaternion.slerpQuaternions(this.leaveFrom.quaternion, toRot, e);
      // Letters lift away and shrink as we fly down.
      for (const letter of this.letters) {
        const d = Math.max(0, e * 1.4 - letter.index * 0.03);
        letter.mesh.position.copy(letter.rest).addScaledVector(new Vector3(0, 1, 0), d * d * 14);
      }
      this.chain.visible = e < 0.3;
      if (t >= 1) {
        this.phase = "done";
        this.root.visible = false;
      }
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof Mesh && o.geometry.type === "ExtrudeGeometry") o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.tagTexture.dispose();
    this.root.removeFromParent();
  }
}

const FILAMENT_COLD = new Color("#5A4A3A");
const FILAMENT_HOT = new Color("#FFF1C9");
