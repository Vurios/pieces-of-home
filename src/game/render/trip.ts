import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CubicBezierCurve3,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { Character } from "../actors/character";
import { box, cone, cylinder, sphere, torus } from "../actors/parts";
import { Batcher } from "./kit";
import type { LookSpec } from "./post";
import type { ToonLibrary } from "./toon";

/**
 * The trip between little worlds, in 3D, in the game's own toy style. On the
 * world left behind, Remi (in a space suit) walks over to Dad's toy rocket on
 * its launch pad and climbs in. The door shuts, the engine lights in a cloud
 * of smoke, and the rocket lifts off. The camera chases it across the starry
 * night, past tumbling rocks and a comet, then flies alongside for a moment
 * while the rocket rolls past it, and follows it on to the next little world,
 * where it turns over and settles down on its fins in a ring of dust, and the
 * door opens. Then the lamp light closes and opens on the world itself.
 *
 * Everything is built once and reused: the planets only change their dress.
 */
export type TripWorld = "home" | "moon" | "mars";
export type TripProp = "house" | "lander" | "buggy" | "rover" | "helicopter" | "none";

/** How each world looks on the trip. */
const DRESS: Record<string, { kind: TripWorld; prop: TripProp }> = {
  home: { kind: "home", prop: "house" },
  tranquility: { kind: "moon", prop: "lander" },
  storms: { kind: "moon", prop: "lander" },
  hadley: { kind: "moon", prop: "buggy" },
  meridiani: { kind: "mars", prop: "rover" },
  valinor: { kind: "mars", prop: "helicopter" },
};

const COLORS: Record<TripWorld, { land: string; shade: string; light: string; dust: string }> = {
  home: { land: "#7FA36B", shade: "#5E8452", light: "#9FC183", dust: "#E4DCC8" },
  moon: { land: "#BDB8AE", shade: "#8F8A80", light: "#D6D1C6", dust: "#DAD5CB" },
  mars: { land: "#D08A5A", shade: "#A85F38", light: "#E4A576", dust: "#E2AE80" },
};

/**
 * The trip's own grade: night blue shadows and warm lamp highlights, the same
 * whichever world is loading behind it, so the colors never jump mid-trip.
 */
export const TRIP_LOOK: LookSpec = {
  grade: { shadows: "#2C2A5E", highlights: "#F6C27A", shadowAmount: 0.3, highlightAmount: 0.2, saturation: 1.08, contrast: 1.04, lift: 0.04 },
  ink: "#211C2E",
  inkStrength: 0.8,
  inkWidth: 1.25,
  inkFade: [30, 70],
  grain: 0.05,
  vignette: 0.6,
  lamp: "#F2A541",
};

const Y_AXIS = new Vector3(0, 1, 0);

/** Seconds the light takes from one world to the next. */
export const TRIP_SECONDS = 2.6;

function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,248,230,1)");
  gradient.addColorStop(0.18, "rgba(255,226,160,0.95)");
  gradient.addColorStop(0.45, "rgba(255,190,100,0.35)");
  gradient.addColorStop(1, "rgba(255,170,80,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

class Planet {
  readonly root = new Group();
  private ground: Mesh;
  private dress = new Group();
  private glowMaterial: SpriteMaterial;
  readonly halo: Sprite;
  /** The color of dust kicked up on this world. */
  dustColor = COLORS.home.dust;

  constructor(
    private toon: ToonLibrary,
    readonly radius: number,
    glow: CanvasTexture,
  ) {
    this.ground = new Mesh(sphere("high"), toon.toon({ color: COLORS.home.land, objectSpace: true, paint: 0.13, rim: 0.35 }));
    this.ground.scale.setScalar(radius);
    this.root.add(this.ground, this.dress);
    this.glowMaterial = new SpriteMaterial({ map: glow, color: "#FFD98A", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
    this.halo = new Sprite(this.glowMaterial);
    this.halo.scale.setScalar(radius * 3.2);
    this.root.add(this.halo);
  }

  /**
   * Paints the planet as one of the little worlds, with a tiny model of its
   * machine. `clear` is the spot kept empty for the rocket; `turn` swings the
   * machine round it so it shows beside the rocket.
   */
  wear(id: string | null, clear: Vector3, turn: number): void {
    const { kind, prop } = DRESS[id ?? "home"] ?? DRESS["home"]!;
    const c = COLORS[kind];
    this.dustColor = c.dust;
    this.dress.quaternion.setFromUnitVectors(Y_AXIS, clear);
    this.dress.rotateOnAxis(Y_AXIS, turn);
    // One shared material per kind of world (the library keeps one per set of options).
    this.ground.material = this.toon.toon({ color: c.land, objectSpace: true, paint: 0.13, rim: 0.35 });
    for (const child of [...this.dress.children]) {
      this.dress.remove(child);
      (child as Mesh).geometry?.dispose();
    }
    const b = new Batcher();
    const R = this.radius;
    const on = (lat: number, lon: number, lift = 0): { p: Vector3; up: Vector3 } => {
      const up = new Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      return { p: up.clone().multiplyScalar(R + lift), up };
    };
    // Patches and craters on the ground, laid flat on the surface, then the small things
    // that make each world read at a glance: trees at home, boulders on the Moon and Mars.
    const random = mulberry(kind === "home" ? 3 : kind === "moon" ? 7 : 11);
    const helper = new Group();
    const stand = (lat: number, lon: number, lift: number, spin = 0): Matrix4 => {
      const { p, up } = on(lat, lon, lift);
      helper.position.copy(p);
      helper.quaternion.setFromUnitVectors(Y_AXIS, up);
      helper.rotateY(spin);
      helper.updateMatrix();
      return helper.matrix.clone();
    };
    // Keeps the north cap clear for the machine.
    const spot = (): [number, number] => [(random() - 0.62) * 2.5, random() * Math.PI * 2];
    for (let i = 0; i < 14; i += 1) {
      const [lat, lon] = spot();
      // Small enough that a flat patch hugs the curve instead of poking out of it.
      const r = (0.1 + random() * 0.14) * R;
      const m = stand(lat, lon, -(r * r) / (4 * R), random() * 3);
      if (kind === "moon") {
        b.place(torus(0.24), c.light, [0, 0.03, 0], [Math.PI / 2, 0, 0], [r * 0.5, r * 0.5, r * 0.25], m);
        b.place(cylinder(16), c.shade, [0, 0, 0], [0, 0, 0], [r * 0.46, 0.035, r * 0.46], m);
      } else b.place(sphere("mid"), i % 3 === 0 ? c.light : c.shade, [0, 0, 0], [0, 0, 0], [r * 0.8, 0.035, r * 0.55], m);
    }
    for (let i = 0; i < 12; i += 1) {
      const [lat, lon] = spot();
      const m = stand(lat, lon, 0, random() * 3);
      const k = 0.6 + random() * 0.8;
      if (kind === "home") {
        b.place(cylinder(6), "#6B3F2A", [0, R * 0.05 * k, 0], [0, 0, 0], [R * 0.025 * k, R * 0.1 * k, R * 0.025 * k], m);
        b.place(sphere("low"), i % 2 ? "#4F7A47" : "#6E9B5A", [0, R * 0.14 * k, 0], [0, 0, 0], R * 0.07 * k, m);
      } else {
        b.place(sphere("low"), i % 2 ? c.shade : c.light, [0, R * 0.01, 0], [random(), random(), random()], [R * 0.06 * k, R * 0.04 * k, R * 0.05 * k], m);
      }
    }
    // The machine, a little way down from the rocket's spot, small and clear.
    const top = new Group();
    top.position.copy(on(0.72, 0, -0.02).p);
    top.quaternion.setFromUnitVectors(Y_AXIS, on(0.72, 0).up);
    top.rotateY(0.5);
    top.updateMatrix();
    const m = top.matrix;
    const s = R * 0.11;
    if (prop === "house") {
      b.place(box(0.08), "#E8A066", [0, s * 1.2, 0], [0, 0, 0], [s * 2.4, s * 2.2, s * 2], m);
      b.place(cone(4), "#B5523B", [0, s * 3.0, 0], [0, Math.PI / 4, 0], [s * 2.0, s * 1.4, s * 2.0], m);
      b.place(box(0.02), "#FFD98A", [0, s * 1.3, s * 1.02], [0, 0, 0], [s * 0.7, s * 0.7, s * 0.06], m, "glow");
      b.place(cylinder(8), "#6B3F2A", [s * 3.2, s * 1.0, -s * 0.5], [0, 0, 0], [s * 0.25, s * 2, s * 0.25], m);
      b.place(sphere("mid"), "#5E8452", [s * 3.2, s * 2.6, -s * 0.5], [0, 0, 0], s * 1.2, m);
    } else if (prop === "lander" || prop === "buggy") {
      b.place(cylinder(8), "#D2A445", [0, s * 1.6, 0], [0, 0, 0], [s * 1.5, s * 1.1, s * 1.5], m);
      for (let i = 0; i < 4; i += 1) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        b.place(cylinder(6), "#C4C1BA", [Math.sin(a) * s * 1.6, s * 0.7, Math.cos(a) * s * 1.6], [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6], [s * 0.12, s * 1.6, s * 0.12], m);
      }
      if (prop === "buggy") {
        b.place(box(0.02), "#C4C1BA", [s * 3.4, s * 0.8, 0], [0, 0.5, 0], [s * 2.4, s * 0.3, s * 1.5], m);
        for (const [x, z] of [[2.6, 0.8], [4.2, 0.8], [2.6, -0.8], [4.2, -0.8]] as const) b.place(cylinder(12), "#6E7478", [s * x, s * 0.5, s * z], [Math.PI / 2, 0.5, 0], [s * 0.5, s * 0.3, s * 0.5], m);
        b.place(cylinder(6), "#EDEAE2", [s * 3.0, s * 1.8, 0], [0, 0, 0], [s * 0.08, s * 2, s * 0.08], m);
        b.place(sphere("mid"), "#EDEAE2", [s * 3.0, s * 2.8, 0], [0, 0, 0], [s * 0.7, s * 0.2, s * 0.7], m);
      }
    } else if (prop === "rover") {
      b.place(box(0.04), "#E9E3D6", [0, s * 1.2, 0], [0, 0, 0], [s * 1.6, s * 0.7, s * 2.0], m);
      b.place(box(0.01), "#2A3864", [0, s * 1.65, 0], [0, 0, 0], [s * 3.2, s * 0.12, s * 2.2], m);
      for (const x of [-1, 1]) for (const z of [-0.9, 0, 0.9]) b.place(cylinder(10), "#9C968C", [x * s * 1.2, s * 0.4, z * s], [0, 0, Math.PI / 2], [s * 0.4, s * 0.3, s * 0.4], m);
      b.place(cylinder(6), "#B9B4AA", [0, s * 2.5, s * 0.6], [0, 0, 0], [s * 0.1, s * 1.6, s * 0.1], m);
      b.place(box(0.02), "#E9E3D6", [0, s * 3.3, s * 0.6], [0, 0, 0], [s * 0.8, s * 0.35, s * 0.35], m);
    } else if (prop === "helicopter") {
      b.place(box(0.06), "#C9C4BA", [0, s * 2.0, 0], [0, 0, 0], [s * 1.0, s * 0.8, s * 1.0], m);
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        b.place(cylinder(6), "#8E8B86", [Math.sin(a) * s * 0.8, s * 0.8, Math.cos(a) * s * 0.8], [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], [s * 0.08, s * 1.8, s * 0.08], m);
      }
      b.place(cylinder(6), "#4A4440", [0, s * 3.0, 0], [0, 0, 0], [s * 0.08, s * 1.2, s * 0.08], m);
      for (const y of [2.8, 3.4]) b.place(box(0.01), "#3A3A40", [0, s * y, 0], [0, y * 0.7, 0], [s * 4.4, s * 0.06, s * 0.35], m);
    }
    const material = this.toon.toon({ vertexColors: true, paint: 0.13, objectSpace: true });
    for (const mesh of b.build({ solid: material, glow: this.toon.glow("#ffffff", true) }, { castShadow: false, receiveShadow: false })) this.dress.add(mesh);
  }

  set glow(value: number) {
    this.glowMaterial.opacity = value;
  }

  spin(dt: number, rate: number): void {
    this.root.rotation.y += dt * rate;
  }
}

/** A small seeded random, so the planets look the same every trip. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft round puff, for rocket smoke and landing dust. */
function puffTexture(): CanvasTexture {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.75)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Smoke and dust: a fixed pool of soft sprites that grow and fade. */
class Puffs {
  readonly group = new Group();
  private items: { sprite: Sprite; material: SpriteMaterial; age: number; life: number; vel: Vector3; from: number; to: number }[] = [];
  private next = 0;

  constructor(texture: CanvasTexture, count: number) {
    for (let i = 0; i < count; i += 1) {
      const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
      const sprite = new Sprite(material);
      sprite.visible = false;
      this.group.add(sprite);
      this.items.push({ sprite, material, age: 0, life: 1, vel: new Vector3(), from: 0.2, to: 1 });
    }
  }

  emit(at: Vector3, vel: Vector3, size: number, life: number, color: string): void {
    const item = this.items[this.next]!;
    this.next = (this.next + 1) % this.items.length;
    item.sprite.position.copy(at);
    item.vel.copy(vel);
    item.age = 0;
    item.life = life;
    item.from = size * 0.35;
    item.to = size;
    item.material.color.set(color);
    item.sprite.visible = true;
  }

  update(dt: number): void {
    for (const item of this.items) {
      if (!item.sprite.visible) continue;
      item.age += dt;
      const k = item.age / item.life;
      if (k >= 1) {
        item.sprite.visible = false;
        continue;
      }
      item.sprite.position.addScaledVector(item.vel, dt);
      item.vel.multiplyScalar(Math.max(0, 1 - dt * 2.2));
      item.sprite.scale.setScalar(item.from + (item.to - item.from) * (1 - (1 - k) ** 2));
      item.material.opacity = 0.85 * (1 - k) ** 1.4;
    }
  }

  clear(): void {
    for (const item of this.items) item.sprite.visible = false;
  }
}

/**
 * Dad's toy rocket: a cream body with red bands, a red nose, three fins it
 * stands on, a round window and a door on its side. Built as merged pieces in
 * its own group, with a door that swings and a flame that flickers.
 */
interface Rocket {
  root: Group;
  door: Group;
  flame: Group;
  inside: Mesh;
  /** The middle of the rocket, in its own frame. */
  middle: Vector3;
}

function buildRocket(toon: ToonLibrary): Rocket {
  const root = new Group();
  root.name = "trip-rocket";
  const b = new Batcher();
  const cream = "#F2EAD8";
  const red = "#C8553D";
  const brass = "#C9A24E";
  // Body, slightly narrower at the top, with two red bands.
  b.place(cylinder(24, 0.86), cream, [0, 0.95, 0], [0, 0, 0], [0.38, 1.3, 0.38]);
  for (const y of [0.42, 1.48]) b.place(cylinder(24), red, [0, y, 0], [0, 0, 0], [0.385 - (y - 0.42) * 0.05, 0.08, 0.385 - (y - 0.42) * 0.05]);
  // Nose cone and its little tip.
  b.place(cone(24), red, [0, 1.98, 0], [0, 0, 0], [0.33, 0.76, 0.33]);
  b.place(sphere("low"), brass, [0, 2.38, 0], [0, 0, 0], 0.045);
  // Three fins down to the ground: it stands on them.
  for (let i = 0; i < 3; i += 1) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const out = new Vector3(Math.cos(a), 0, Math.sin(a));
    b.place(box(0.03), red, [out.x * 0.46, 0.34, out.z * 0.46], [0, -a, 0.0], [0.34, 0.6, 0.06]);
    b.place(sphere("low"), "#4A4440", [out.x * 0.62, 0.04, out.z * 0.62], [0, 0, 0], [0.07, 0.04, 0.07]);
  }
  // The nozzle underneath.
  b.place(cylinder(16, 0.72), "#4A4440", [0, 0.2, 0], [Math.PI, 0, 0], [0.2, 0.2, 0.2]);
  // A round window with a brass ring, high on the door side, and a second one round the back.
  b.place(torus(0.2), brass, [0.335, 1.18, 0], [0, Math.PI / 2, 0], 0.13);
  b.place(cylinder(16), "#FFD98A", [0.33, 1.18, 0], [0, 0, Math.PI / 2], [0.115, 0.03, 0.115], undefined, "glow");
  b.place(torus(0.2), brass, [-0.335, 1.18, 0], [0, Math.PI / 2, 0], 0.11);
  b.place(cylinder(16), "#8FB3C8", [-0.33, 1.18, 0], [0, 0, Math.PI / 2], [0.095, 0.03, 0.095]);
  // Rivets round the lower band.
  for (let i = 0; i < 12; i += 1) {
    const a = (i * Math.PI * 2) / 12;
    b.place(sphere("tiny"), brass, [Math.cos(a) * 0.39, 0.42, Math.sin(a) * 0.39], [0, 0, 0], 0.018);
  }
  const material = toon.toon({ vertexColors: true, paint: 0.1, objectSpace: true, rim: 0.6 });
  for (const mesh of b.build({ solid: material, glow: toon.glow("#ffffff", true) }, { castShadow: false, receiveShadow: false })) root.add(mesh);

  // Warm light inside, seen through the open door.
  const inside = new Mesh(box(0.02), toon.glow("#FFC877"));
  inside.scale.set(0.02, 0.48, 0.26);
  inside.position.set(0.36, 0.68, 0);
  root.add(inside);

  // The door: hinged on its back edge, on the window side.
  const door = new Group();
  door.position.set(0.37, 0.68, -0.15);
  const panel = new Batcher();
  panel.place(box(0.03), cream, [0.025, 0, 0.15], [0, 0, 0], [0.04, 0.52, 0.3]);
  panel.place(box(0.01), red, [0.045, 0, 0.15], [0, 0, 0], [0.02, 0.06, 0.3]);
  panel.place(sphere("tiny"), brass, [0.055, 0, 0.26], [0, 0, 0], 0.025);
  for (const mesh of panel.build({ solid: material }, { castShadow: false, receiveShadow: false })) door.add(mesh);
  root.add(door);

  // The flame: a warm outer cone and a bright core, pointing down out of the nozzle.
  const flame = new Group();
  flame.position.set(0, 0.08, 0);
  const outer = new Mesh(cone(16), new MeshBasicMaterial({ color: "#FF9A3C", transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }));
  outer.rotation.x = Math.PI;
  outer.scale.set(0.2, 0.9, 0.2);
  outer.position.y = -0.45;
  const core = new Mesh(cone(12), new MeshBasicMaterial({ color: "#FFF1C2", transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }));
  core.rotation.x = Math.PI;
  core.scale.set(0.11, 0.55, 0.11);
  core.position.y = -0.27;
  flame.add(outer, core);
  flame.visible = false;
  root.add(flame);
  return { root, door, flame, inside, middle: new Vector3(0, 1.1, 0) };
}

/** Smooth step between two times. */
const window01 = (t: number, a: number, b: number): number => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * The trip's beats, in seconds. Remi walks to Dad's toy rocket and climbs in,
 * it lifts off in a cloud of smoke, flies across the night (the camera rides
 * alongside it from `pass` to `passEnd` while it rolls past), comes in to the
 * next little world, turns over and settles down on its fins, and the door opens.
 */
const BEAT = { inside: 1.2, doorShut: 1.45, ignite: 1.5, lift: 1.95, cruise: 3.0, pass: 4.55, passEnd: 5.75, land: 6.9, touch: 8.05, open: 8.15, end: 8.85 };
/** The moment the rocket draws level with the camera riding alongside. */
const PASS_MID = (BEAT.pass + BEAT.passEnd) / 2;

/** How far along the flight path the rocket is at a time in the cruise (0 to 1), easing in and out. */
const cruiseK = (t: number): number => {
  const u = Math.max(0, Math.min(1, (t - BEAT.cruise) / (BEAT.land - BEAT.cruise)));
  return u * u * (3 - 2 * u);
};

/** A lumpy little space rock in the toy style: two lumps and a few dents. */
function buildRock(toon: ToonLibrary): Mesh {
  const b = new Batcher();
  b.place(sphere("low"), "#8E8174", [0, 0, 0], [0, 0, 0], [1, 0.78, 0.86]);
  b.place(sphere("low"), "#9C8F80", [0.45, 0.22, 0.1], [0.4, 0.2, 0], [0.62, 0.5, 0.55]);
  for (const [x, y, z, r] of [[0.1, 0.72, 0.2, 0.26], [-0.62, 0.3, 0.42, 0.2], [0.3, -0.5, 0.6, 0.18]] as const) {
    const n = new Vector3(x, y, z).normalize();
    const q = new Quaternion().setFromUnitVectors(Y_AXIS, n);
    const m = new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1));
    b.place(cylinder(10), "#6F6459", [0, 0, 0], [0, 0, 0], [r, 0.05, r], m);
  }
  const [mesh] = b.build({ solid: toon.toon({ vertexColors: true, paint: 0.12, objectSpace: true, rim: 0.45 }) }, { castShadow: false, receiveShadow: false });
  return mesh!;
}

export class TripScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 400);
  /** 0 to 1 along the trip. */
  progress = 0;
  /** When the engine should start closing the lamp light over the view (0 to 1). */
  readonly closeAt = BEAT.open / BEAT.end;
  /** Held still at one moment, for screenshots (see the engine's `tripAt`). */
  frozen = false;
  private time = 0;
  private from: Planet;
  private to: Planet;
  private rocket: Rocket;
  private kid: Character;
  private puffs: Puffs;
  private pad: Group;
  private flameLight: PointLight;
  private trail: Points<BufferGeometry, PointsMaterial>;
  private trailPositions: Float32Array;
  private history: Vector3[] = [];
  private curve = new CubicBezierCurve3(new Vector3(), new Vector3(), new Vector3(), new Vector3());
  private glow: CanvasTexture;
  private puffTexture: CanvasTexture;
  private sky: Mesh<SphereGeometry, ShaderMaterial>;
  private stars: Points<BufferGeometry, PointsMaterial>;
  private reduced = false;
  private emitClock = 0;
  private touched = false;
  /** Called once at each sound in the trip: lift-off, the rocket rushing past, the landing. */
  onCue: ((name: "launch" | "whoosh" | "land") => void) | null = null;
  private cued = new Set<string>();
  private silent = false;
  /** Thin streaks of light along the way, so the flight feels fast. */
  private streaks: InstancedMesh<BoxGeometry, MeshBasicMaterial>;
  /** Little rocks that tumble past on the way. */
  private rocks: { mesh: Mesh; spin: Vector3 }[] = [];
  /** A comet far off across the night, with a soft tail. */
  private comet = new Group();
  private cometMaterials: SpriteMaterial[] = [];
  private readonly cometFrom = new Vector3();
  private readonly cometDrift = new Vector3();
  private readonly qRoll = new Quaternion();
  private readonly side = new Vector3();
  // Where things are on this trip.
  private readonly padTop = new Vector3();
  private readonly landing = new Vector3();
  private readonly landUp = new Vector3();
  private readonly landSide = new Vector3();
  private readonly walkFrom = new Vector3();
  private readonly walkTo = new Vector3();
  private readonly base = new Vector3();
  private readonly nose = new Vector3(0, 1, 0);
  private readonly center = new Vector3();
  private readonly qFlip = new Quaternion();
  private readonly qLand = new Quaternion();
  /** How the rocket stands once landed: upright, with its door toward the camera. */
  private readonly qLanded = new Quaternion();
  private readonly look = new Vector3();
  private readonly eye = new Vector3();
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();

  constructor(toon: ToonLibrary) {
    this.glow = glowTexture();
    this.puffTexture = puffTexture();
    // The night: a soft gradient dome and a field of stars.
    this.sky = new Mesh(
      new SphereGeometry(200, 24, 16),
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = vDir.y * 0.5 + 0.5;
            vec3 low = vec3(0.17, 0.12, 0.30);
            vec3 high = vec3(0.03, 0.05, 0.16);
            vec3 c = mix(low, high, smoothstep(0.2, 0.85, h));
            // A faint warm band of the Milky Way across the trip.
            c += vec3(0.10, 0.07, 0.04) * exp(-pow((vDir.y + vDir.z * 0.35 - 0.1) * 3.5, 2.0));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    this.sky.renderOrder = -10;
    const random = mulberry(5);
    const count = 1100;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const u = random() * 2 - 1;
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions.set([Math.cos(a) * r * 150, u * 150, Math.sin(a) * r * 150], i * 3);
      const warm = random();
      colors.set(warm > 0.8 ? [1, 0.88, 0.7] : warm < 0.15 ? [0.75, 0.82, 1] : [1, 0.97, 0.92], i * 3);
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new BufferAttribute(colors, 3));
    this.stars = new Points(starGeometry, new PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));

    this.from = new Planet(toon, 3.2, this.glow);
    this.to = new Planet(toon, 3.6, this.glow);
    this.from.root.position.set(0, 0, 0);
    this.to.root.position.set(34, 6, -24);

    // Dad's launch pad on the world left behind: a round board with a painted ring.
    this.pad = new Group();
    const pb = new Batcher();
    pb.place(cylinder(28), "#7A5136", [0, 0.03, 0], [0, 0, 0], [0.95, 0.1, 0.95]);
    pb.place(cylinder(28), "#B07A4E", [0, 0.085, 0], [0, 0, 0], [0.9, 0.012, 0.9]);
    pb.place(torus(0.05), "#F4ECDD", [0, 0.093, 0], [Math.PI / 2, 0, 0], [0.62, 0.62, 0.2]);
    // A little pennant on a pole at the edge of the pad.
    pb.place(cylinder(6), "#7A5136", [-0.62, 0.62, -0.62], [0, 0, 0], [0.025, 1.24, 0.025]);
    pb.place(sphere("low"), "#C9A24E", [-0.62, 1.25, -0.62], [0, 0, 0], 0.035);
    pb.place(cone(3), "#F2B23E", [-0.42, 1.1, -0.62], [0, 0, -Math.PI / 2], [0.1, 0.4, 0.02]);
    for (const mesh of pb.build({ solid: toon.toon({ vertexColors: true, paint: 0.1, objectSpace: true }) }, { castShadow: false, receiveShadow: false })) this.pad.add(mesh);

    this.rocket = buildRocket(toon);
    this.kid = new Character("remi", toon);
    this.kid.setSuit(true);
    this.puffs = new Puffs(this.puffTexture, 70);
    this.flameLight = new PointLight("#FFB25E", 0, 7, 1.6);

    // A soft glow streaming behind the rocket in flight.
    this.trailPositions = new Float32Array(48 * 3);
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute("position", new BufferAttribute(this.trailPositions, 3));
    this.trail = new Points(trailGeometry, new PointsMaterial({ map: this.glow, size: 0.7, color: "#FFC777", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    this.trail.frustumCulled = false;

    // Streaks of light, laid out along the flight path at the start of each trip.
    this.streaks = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: "#FFE6C0", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }), 170);
    this.streaks.frustumCulled = false;
    // Rocks: one shape, turned and sized differently each time.
    const rock = buildRock(toon);
    for (let i = 0; i < 9; i += 1) {
      const mesh = new Mesh(rock.geometry, rock.material);
      this.rocks.push({ mesh, spin: new Vector3() });
      this.scene.add(mesh);
    }
    // The comet: a pale head and a tail of softer glows.
    for (let i = 0; i < 9; i += 1) {
      const material = new SpriteMaterial({ map: this.glow, color: i === 0 ? "#F4FAFF" : "#A9D4FF", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: i === 0 ? 1 : 0.55 * (1 - i / 9) });
      const sprite = new Sprite(material);
      sprite.position.set(i * 0.9, i * 0.22, 0);
      sprite.scale.setScalar(i === 0 ? 2.4 : 2.2 + i * 0.35);
      this.cometMaterials.push(material);
      this.comet.add(sprite);
    }

    const key = new DirectionalLight("#FFF1DC", 2.1);
    key.position.set(8, 12, 10);
    const fill = new HemisphereLight("#8E9AC4", "#2A2440", 1.25);
    this.scene.add(this.sky, this.stars, this.comet, this.from.root, this.to.root, this.pad, this.rocket.root, this.kid.root, this.puffs.group, this.trail, this.streaks, this.flameLight, key, fill);
  }

  /** Sets up a trip from one world to another. */
  begin(from: string | null, to: string): void {
    const A = this.from.root.position;
    const B = this.to.root.position;
    const RA = this.from.radius;
    const RB = this.to.radius;
    // The rocket stands on top of the world left behind, and lands on the side of
    // the world ahead that faces where it comes from.
    this.padTop.copy(A).add(new Vector3(0, RA, 0));
    this.landUp.copy(A).sub(B).normalize().add(new Vector3(0, 1.3, 0)).normalize();
    this.landing.copy(B).addScaledVector(this.landUp, RB);
    this.landSide.crossVectors(this.landUp, new Vector3(0, 1, 0)).normalize();
    this.from.wear(from, new Vector3(0, 1, 0), -1.9);
    this.to.wear(to, this.landUp, 2.3);
    this.pad.position.copy(this.padTop);
    // Remi walks in from the camera's side of the world, over to the rocket's door.
    this.walkFrom.set(0.95, RA, 2.3).normalize().multiplyScalar(RA).add(A);
    this.walkTo.set(0.62, RA, 0.08).normalize().multiplyScalar(RA).add(A);
    // Up off the pad, out across the night, and in over the landing spot.
    const top = this.padTop.clone().add(new Vector3(0, 9, 0));
    this.curve.v0.copy(top);
    this.curve.v1.copy(top).add(new Vector3(2, 10, -2));
    this.curve.v2.copy(this.landing).addScaledVector(this.landUp, 15).addScaledVector(this.landSide, -5);
    this.curve.v3.copy(this.landing).addScaledVector(this.landUp, 5.5);
    this.layOut();
    // Upright on the landing spot, turned so the door faces the camera.
    this.qLanded.setFromUnitVectors(Y_AXIS, this.landUp);
    const toCamera = this.landSide.clone().multiplyScalar(5.4).add(new Vector3().crossVectors(this.landUp, this.landSide).normalize().multiplyScalar(3.4)).normalize();
    const ex = new Vector3(1, 0, 0).applyQuaternion(this.qLanded);
    const ez = new Vector3(0, 0, 1).applyQuaternion(this.qLanded);
    const turn = Math.atan2(-toCamera.dot(ez), toCamera.dot(ex));
    this.qLanded.multiply(new Quaternion().setFromAxisAngle(Y_AXIS, turn));
    this.time = 0;
    this.progress = 0;
    this.frozen = false;
    this.touched = false;
    this.cued.clear();
    this.silent = false;
    this.emitClock = 0;
    this.history = [];
    this.puffs.clear();
    this.kid.root.visible = true;
    this.place(0);
  }

  /**
   * Lays out what the rocket passes on the way: streaks of light and rocks
   * around the flight path (kept clear of the camera's ride alongside), and the
   * comet far off to one side.
   */
  private layOut(): void {
    const random = mulberry(19);
    const at = new Vector3();
    const tangent = new Vector3();
    const side = new Vector3();
    const lift = new Vector3();
    const out = new Vector3();
    const q = new Quaternion();
    const m = new Matrix4();
    const scale = new Vector3();
    /** A spot around the path at `k`, `r` out from it, never where the camera rides alongside. */
    const around = (k: number, r: number): Vector3 => {
      this.curve.getPoint(k, at);
      this.curve.getTangent(k, tangent);
      side.crossVectors(tangent, Y_AXIS).normalize();
      lift.crossVectors(side, tangent).normalize();
      let a = random() * Math.PI * 2;
      // The camera rides out along `side`: swing things on that side round below or above it.
      if (Math.cos(a) > 0.55 && r < 7.5) a += Math.PI * 0.5 * (Math.sin(a) >= 0 ? 1 : -1);
      return out.copy(side).multiplyScalar(Math.cos(a) * r).addScaledVector(lift, Math.sin(a) * r).add(at);
    };
    for (let i = 0; i < this.streaks.count; i += 1) {
      const k = 0.02 + random() * 0.96;
      const p = around(k, 1.4 + random() * 7);
      q.setFromUnitVectors(Y_AXIS, tangent);
      const width = 0.014 + random() * 0.014;
      m.compose(p, q, scale.set(width, 0.6 + random() * 1.4, width));
      this.streaks.setMatrixAt(i, m);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    this.rocks.forEach((rock, i) => {
      const k = 0.16 + (i / this.rocks.length) * 0.72 + random() * 0.05;
      rock.mesh.position.copy(around(k, 3.6 + random() * 5));
      rock.mesh.scale.setScalar(0.28 + random() * 0.6);
      rock.mesh.rotation.set(random() * 6, random() * 6, random() * 6);
      rock.spin.set(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(1.6);
    });
    // The comet: ahead and up, off to the far side of the path, drifting slowly.
    this.curve.getPoint(0.55, at);
    this.curve.getTangent(0.55, tangent);
    side.crossVectors(tangent, Y_AXIS).normalize();
    this.cometFrom.copy(at).addScaledVector(tangent, 26).addScaledVector(side, -20).add(new Vector3(0, 16, 0));
    this.cometDrift.copy(tangent).multiplyScalar(-0.5).addScaledVector(side, 0.9).add(new Vector3(0, -0.25, 0));
    this.comet.position.copy(this.cometFrom);
  }

  private cue(name: "launch" | "whoosh" | "land", at: number): void {
    if (this.time < at || this.cued.has(name)) return;
    this.cued.add(name);
    if (!this.silent) this.onCue?.(name);
  }

  /** Jumps ahead to the landing, for a player who has seen the trip before. */
  skip(): void {
    this.cued.add("launch");
    this.cued.add("whoosh");
    if (this.time < BEAT.land + 0.5) {
      this.time = BEAT.land + 0.5;
      this.puffs.clear();
      this.history = [];
    }
  }

  /** Plays the trip up to a moment (0 to 1) and holds it there, for screenshots. */
  seek(t: number): void {
    this.silent = true;
    const end = t * BEAT.end;
    while (this.time < end) this.update(Math.min(1 / 30, end - this.time + 1e-4), false);
    this.frozen = true;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 0.8 ? 56 : 40;
    this.camera.updateProjectionMatrix();
  }

  /** Moves the trip on. */
  update(dt: number, reducedMotion: boolean): void {
    if (this.frozen) return;
    this.reduced = reducedMotion;
    this.time += dt;
    this.progress = Math.min(1, this.time / BEAT.end);
    this.place(dt);
  }

  private place(dt: number): void {
    const t = this.time;
    const r = this.rocket;
    // ---- Remi walks over and climbs in ----
    const walk = window01(t, 0.15, BEAT.inside - 0.1);
    const kid = this.kid.root;
    if (t < BEAT.inside) {
      const A = this.from.root.position;
      const feet = this.v1.copy(this.walkFrom).sub(A).lerp(this.v2.copy(this.walkTo).sub(A), walk).normalize();
      const up = feet.clone();
      feet.multiplyScalar(this.from.radius).add(A);
      // The last few steps go into the doorway.
      const inDoor = window01(t, BEAT.inside - 0.32, BEAT.inside);
      feet.lerp(this.v3.copy(this.padTop).add(new Vector3(0.25, 0.25, 0)), inDoor * 0.85);
      const ahead = this.v3.copy(this.padTop).add(new Vector3(0.36, 0.3, 0)).sub(feet);
      ahead.addScaledVector(up, -ahead.dot(up)).normalize();
      kid.position.copy(feet);
      kid.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(up, ahead).normalize(), up, ahead));
      kid.scale.setScalar(1 - inDoor * 0.35);
      kid.visible = true;
      this.kid.update(dt, { pace: walk > 0 && walk < 1 ? 1 : inDoor > 0 ? 0.6 : 0, running: false, grounded: true, verticalSpeed: 0, sinceLanding: 2, landingSpeed: 0, carrying: false }, this.reduced);
    } else kid.visible = false;

    // ---- The door: open while Remi climbs in, shut for the flight, open again on arrival ----
    const shut = window01(t, BEAT.inside, BEAT.doorShut) * (1 - window01(t, BEAT.open, BEAT.open + 0.45));
    r.door.rotation.y = -1.75 * (1 - shut);
    r.inside.visible = shut < 0.98;

    // ---- Where the rocket is, and which way its nose points ----
    const lift = window01(t, BEAT.lift, BEAT.cruise);
    let thrust = 0;
    if (t < BEAT.cruise) {
      // Lift-off: slow at first, then faster.
      const u = Math.max(0, Math.min(1, (t - BEAT.lift) / (BEAT.cruise - BEAT.lift)));
      this.base.copy(this.padTop).add(new Vector3(0, 9 * u * u, 0));
      this.nose.set(0, 1, 0);
      r.root.quaternion.identity();
      // A shudder on the pad as the engine lights.
      const shake = t > BEAT.ignite && t < BEAT.lift + 0.3 && !this.reduced ? 0.025 : 0;
      this.base.x += Math.sin(t * 61) * shake;
      this.base.z += Math.cos(t * 53) * shake;
      thrust = window01(t, BEAT.ignite, BEAT.lift) * (0.8 + lift * 0.4);
    } else if (t < BEAT.land) {
      const u = (t - BEAT.cruise) / (BEAT.land - BEAT.cruise);
      const k = cruiseK(t);
      this.curve.getPoint(k, this.base);
      this.curve.getTangent(Math.min(0.999, Math.max(0.001, k)), this.nose);
      r.root.quaternion.setFromUnitVectors(Y_AXIS, this.nose);
      // One happy roll as it rushes past the camera riding alongside.
      const roll = this.reduced ? 0 : window01(t, PASS_MID - 0.35, BEAT.passEnd + 0.1) * Math.PI * 2;
      if (roll > 0) r.root.quaternion.multiply(this.qRoll.setFromAxisAngle(Y_AXIS, roll));
      thrust = 1 - u * 0.5 + window01(t, BEAT.pass, PASS_MID) * (1 - window01(t, PASS_MID, BEAT.passEnd)) * 0.35;
    } else {
      // Turn over, then settle down on the fins with the engine braking.
      const u = Math.min(1, (t - BEAT.land) / (BEAT.touch - BEAT.land));
      const flip = window01(u, 0, 0.42);
      const down = 1 - (1 - window01(u, 0.18, 1)) ** 1.6;
      this.base.copy(this.curve.v3).lerp(this.landing, down);
      this.curve.getTangent(0.999, this.nose);
      this.qFlip.setFromUnitVectors(Y_AXIS, this.nose);
      this.qLand.copy(this.qLanded);
      r.root.quaternion.slerpQuaternions(this.qFlip, this.qLand, flip);
      thrust = t < BEAT.touch ? 0.35 + window01(u, 0.35, 0.9) * 0.55 : 0;
      if (t >= BEAT.touch - 0.05 && !this.touched) {
        this.touched = true;
        // A ring of dust where it touches down.
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * Math.PI * 2;
          const out = this.landSide.clone().multiplyScalar(Math.cos(a)).add(this.v1.crossVectors(this.landUp, this.landSide).multiplyScalar(Math.sin(a)));
          this.puffs.emit(this.landing.clone().addScaledVector(this.landUp, 0.1), out.multiplyScalar(2.6), 0.9, 1.1, this.to.dustColor);
        }
      }
    }
    r.root.position.copy(this.base);
    this.center.copy(r.middle).applyQuaternion(r.root.quaternion).add(this.base);

    // ---- Fire and smoke ----
    r.flame.visible = thrust > 0.02;
    if (r.flame.visible) {
      const flicker = this.reduced ? 1 : 0.86 + Math.sin(t * 47) * 0.08 + Math.sin(t * 83) * 0.06;
      r.flame.scale.set(0.8 + thrust * 0.4, thrust * 1.5 * flicker, 0.8 + thrust * 0.4);
    }
    this.flameLight.intensity = thrust * 9;
    this.flameLight.position.copy(this.base).addScaledVector(this.nose, -0.4);
    this.emitClock -= dt;
    if (thrust > 0.05 && this.emitClock <= 0 && dt > 0) {
      this.emitClock = t < BEAT.cruise ? 0.03 : 0.06;
      const tail = this.base.clone().addScaledVector(this.v1.copy(Y_AXIS).applyQuaternion(r.root.quaternion), -0.25);
      const back = this.v2.copy(Y_AXIS).applyQuaternion(r.root.quaternion).multiplyScalar(-1);
      if (t < BEAT.lift + 0.5) {
        // Billowing out across the pad.
        const a = Math.random() * Math.PI * 2;
        this.puffs.emit(tail, new Vector3(Math.cos(a) * 3.2, 0.4 + Math.random() * 0.6, Math.sin(a) * 3.2), 1.1 + Math.random() * 0.5, 1.4, "#EDE6DA");
      } else if (t < BEAT.land) {
        this.puffs.emit(tail, back.multiplyScalar(1.5).add(new Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4)), 0.7, 0.9, "#E9E2D6");
      } else {
        this.puffs.emit(tail, back.multiplyScalar(2.2), 0.6, 0.6, this.to.dustColor);
      }
    }
    this.puffs.update(dt);

    // ---- A glowing trail in flight ----
    const flying = t > BEAT.cruise - 0.3 && t < BEAT.land + 0.4;
    if (flying && dt > 0) {
      this.history.unshift(this.base.clone().addScaledVector(this.nose, -0.2));
      if (this.history.length > 16) this.history.length = 16;
    }
    this.trail.material.opacity = window01(t, BEAT.cruise - 0.3, BEAT.cruise) * (1 - window01(t, BEAT.land, BEAT.land + 0.4)) * 0.7;
    for (let i = 0; i < 48; i += 1) {
      const h = this.history[Math.min(this.history.length - 1, Math.floor(i / 3))] ?? this.base;
      const n = this.history[Math.min(this.history.length - 1, Math.floor(i / 3) + 1)] ?? h;
      const f = (i % 3) / 3;
      this.trailPositions[i * 3] = h.x + (n.x - h.x) * f;
      this.trailPositions[i * 3 + 1] = h.y + (n.y - h.y) * f;
      this.trailPositions[i * 3 + 2] = h.z + (n.z - h.z) * f;
    }
    this.trail.geometry.attributes["position"]!.needsUpdate = true;
    this.to.glow = window01(t, BEAT.cruise, BEAT.land) * 0.45 * (1 - window01(t, BEAT.land, BEAT.touch));

    // ---- What it passes on the way ----
    const cruising = window01(t, BEAT.lift + 0.4, BEAT.cruise + 0.3) * (1 - window01(t, BEAT.land - 0.4, BEAT.land + 0.3));
    this.streaks.material.opacity = cruising * 0.5;
    this.streaks.visible = cruising > 0.01;
    for (const rock of this.rocks) {
      rock.mesh.visible = cruising > 0.01;
      rock.mesh.rotation.x += rock.spin.x * dt;
      rock.mesh.rotation.y += rock.spin.y * dt;
      rock.mesh.rotation.z += rock.spin.z * dt;
    }
    this.comet.position.copy(this.cometFrom).addScaledVector(this.cometDrift, t);
    this.comet.quaternion.copy(this.camera.quaternion);
    const flicker = this.reduced ? 1 : 0.92 + Math.sin(t * 3.1) * 0.08;
    this.cometMaterials.forEach((material, i) => (material.opacity = (i === 0 ? 1 : 0.55 * (1 - i / 9)) * flicker));

    // ---- Sounds ----
    this.cue("launch", BEAT.ignite);
    this.cue("whoosh", PASS_MID - 0.45);
    this.cue("land", BEAT.land + 0.25);

    this.placeCamera(t);
  }

  /** The camera: beside the pad, up with the rocket, chasing it across, then beside the landing spot. */
  private placeCamera(t: number): void {
    const cam = this.camera;
    // On the pad: a low three-quarter view of Remi and the rocket.
    const padEye = this.v1.copy(this.padTop).add(new Vector3(5.6, 0.9 + window01(t, BEAT.lift, BEAT.cruise) * 1.4, 3.6));
    const padLook = this.v2.copy(this.padTop).add(new Vector3(0.2, 1.0, 0.3)).lerp(this.center, window01(t, BEAT.lift, BEAT.cruise) * 0.9);
    this.eye.copy(padEye);
    this.look.copy(padLook);
    const up = this.v3.set(0, 1, 0);
    // In flight: behind and beside the rocket, looking ahead of it. After the ride
    // alongside it drops in lower behind, with the next world growing ahead.
    const chase = window01(t, BEAT.cruise - 0.15, BEAT.cruise + 0.55) * (1 - window01(t, BEAT.land - 0.1, BEAT.land + 0.6));
    if (chase > 0) {
      const side = this.side.crossVectors(this.nose, Y_AXIS);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      const late = window01(t, BEAT.passEnd, BEAT.passEnd + 0.8);
      const chaseEye = this.center.clone().addScaledVector(this.nose, -6.5 + late * 1.2).addScaledVector(side, 3.2 - late * 1.5).add(new Vector3(0, 1.8 - late * 0.5, 0));
      const chaseLook = this.center.clone().addScaledVector(this.nose, 4).lerp(this.to.root.position, late * 0.3);
      this.eye.lerp(chaseEye, chase);
      this.look.lerp(chaseLook, chase);
    }
    // The ride alongside: the camera flies beside the path a little slower than the
    // rocket, so it comes up from behind, rolls past, and pulls away ahead. It cuts
    // in (a cut reads cleaner than a swoop past the rocket) and eases back out.
    const over = t >= BEAT.pass && t < BEAT.passEnd + 0.6 && !this.reduced ? 1 - window01(t, BEAT.passEnd, BEAT.passEnd + 0.6) : 0;
    if (over > 0) {
      const level = cruiseK(PASS_MID);
      const k = level + (cruiseK(t) - level) * 0.7;
      const at = this.curve.getPoint(k);
      const tangent = this.curve.getTangent(k);
      const side = this.side.crossVectors(tangent, Y_AXIS).normalize();
      const overEye = at.addScaledVector(side, 5.2).add(new Vector3(0, 1.2, 0));
      const overLook = this.center.clone().addScaledVector(this.nose, 1.6);
      this.eye.lerp(overEye, over);
      this.look.lerp(overLook, over);
    }
    // At the landing: beside the spot, low, watching it come down.
    const land = window01(t, BEAT.land - 0.1, BEAT.land + 0.6);
    if (land > 0) {
      const toward = this.v1.crossVectors(this.landUp, this.landSide).normalize();
      const landEye = this.landing.clone().addScaledVector(this.landUp, 2.1 + (1 - window01(t, BEAT.touch, BEAT.end)) * 0.6).addScaledVector(this.landSide, 5.4).addScaledVector(toward, 3.4);
      const landLook = this.landing.clone().addScaledVector(this.landUp, 1.0).lerp(this.center, 0.55);
      this.eye.lerp(landEye, land);
      this.look.lerp(landLook, land);
      up.lerp(this.landUp, land).normalize();
    }
    cam.position.copy(this.eye);
    cam.up.copy(up);
    cam.lookAt(this.look);
  }

  /** Where the rocket is on screen (0 to 1), for the light that closes over the view. */
  targetOnScreen(out: { x: number; y: number }): void {
    const p = this.center.clone().project(this.camera);
    out.x = Math.min(0.9, Math.max(0.1, p.x * 0.5 + 0.5));
    out.y = Math.min(0.9, Math.max(0.1, p.y * 0.5 + 0.5));
  }

  get objects(): Object3D[] {
    return [this.scene];
  }

  dispose(): void {
    this.glow.dispose();
    this.puffTexture.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
    this.streaks.geometry.dispose();
    this.streaks.material.dispose();
    this.streaks.dispose();
    this.rocks[0]?.mesh.geometry.dispose();
    for (const material of this.cometMaterials) material.dispose();
  }
}
