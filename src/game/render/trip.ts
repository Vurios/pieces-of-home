import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CubicBezierCurve3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { box, cone, cylinder, sphere, torus } from "../actors/parts";
import { Batcher } from "./kit";
import type { LookSpec } from "./post";
import type { ToonLibrary } from "./toon";

/**
 * The trip between little worlds, in 3D. When the Looking Lamp carries Remi
 * off, the view shows the world left behind and the world ahead floating in a
 * starry night, both small and turning, and the lamp's light arcs from one to
 * the other with one of Dad's envelopes tumbling behind it. The camera follows
 * the light. As it dives into the new world, the view fills with lamp light,
 * and the light opens on the world itself.
 *
 * Everything is built once and reused: the planets only change their dress.
 */
export type TripWorld = "home" | "moon" | "mars";
export type TripProp = "house" | "lander" | "buggy" | "rover" | "helicopter" | "none";

/** How each world looks on the trip. */
const DRESS: Record<string, { kind: TripWorld; prop: TripProp }> = {
  home: { kind: "home", prop: "house" },
  tranquility: { kind: "moon", prop: "lander" },
  hadley: { kind: "moon", prop: "buggy" },
  meridiani: { kind: "mars", prop: "rover" },
  valinor: { kind: "mars", prop: "helicopter" },
};

const COLORS: Record<TripWorld, { land: string; shade: string; light: string }> = {
  home: { land: "#7FA36B", shade: "#5E8452", light: "#9FC183" },
  moon: { land: "#BDB8AE", shade: "#8F8A80", light: "#D6D1C6" },
  mars: { land: "#D08A5A", shade: "#A85F38", light: "#E4A576" },
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

  /** Paints the planet as one of the little worlds, with a tiny model of its machine on top. */
  wear(id: string | null): void {
    const { kind, prop } = DRESS[id ?? "home"] ?? DRESS["home"]!;
    const c = COLORS[kind];
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
    // The machine on the top of the world, small and clear.
    const top = new Group();
    top.position.set(0, R - 0.02, 0);
    top.rotation.set(0.25, 0.4, 0.15);
    top.updateMatrix();
    const m = top.matrix;
    const s = R * 0.16;
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

export class TripScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 400);
  /** 0 to 1 along the trip; the engine closes the lamp light over the view near the end. */
  progress = 0;
  private time = 0;
  private from: Planet;
  private to: Planet;
  private spark: Sprite;
  private sparkLight: PointLight;
  private envelope: Group;
  private trail: Points<BufferGeometry, PointsMaterial>;
  private trailPositions: Float32Array;
  private history: Vector3[] = [];
  private curve: CubicBezierCurve3;
  private glow: CanvasTexture;
  private sky: Mesh<SphereGeometry, ShaderMaterial>;
  private stars: Points<BufferGeometry, PointsMaterial>;
  private readonly look = new Vector3();
  private readonly scratch = new Vector3();

  constructor(toon: ToonLibrary) {
    this.glow = glowTexture();
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
            // A faint warm band where the trip goes.
            c += vec3(0.10, 0.07, 0.03) * exp(-pow((vDir.y - 0.12) * 4.0, 2.0)) * smoothstep(-0.2, 0.6, -vDir.z);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    );
    this.sky.renderOrder = -10;
    const random = mulberry(5);
    const count = 900;
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

    this.from = new Planet(toon, 2.1, this.glow);
    this.to = new Planet(toon, 2.5, this.glow);
    this.from.root.position.set(-5.6, -1.5, 0);
    this.to.root.position.set(5.2, -0.2, -1.2);

    // The lamp's light, and a little warm point light so the planets catch it as it passes.
    this.spark = new Sprite(new SpriteMaterial({ map: this.glow, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    this.spark.scale.setScalar(1.6);
    this.sparkLight = new PointLight("#FFC777", 7, 6, 1.4);
    // One of Dad's envelopes, riding along.
    this.envelope = new Group();
    const eb = new Batcher();
    eb.place(box(0.01), "#F4ECDD", [0, 0, 0], [0, 0, 0], [0.3, 0.2, 0.02]);
    eb.place(box(0.004), "#D9CDB4", [0, 0.04, 0.012], [0, 0, 0.6], [0.3, 0.012, 0.01]);
    eb.place(box(0.004), "#D9CDB4", [0, 0.04, 0.012], [0, 0, -0.6], [0.3, 0.012, 0.01]);
    eb.place(box(0.004), "#C8553D", [0.13, 0.07, 0.013], [0, 0, 0], [0.08, 0.09, 0.01]);
    for (const mesh of eb.build({ solid: toon.toon({ vertexColors: true, paint: 0.13, objectSpace: true }) }, { castShadow: false, receiveShadow: false })) this.envelope.add(mesh);

    // The light's trail: a fading line of soft dots.
    this.trailPositions = new Float32Array(48 * 3);
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute("position", new BufferAttribute(this.trailPositions, 3));
    this.trail = new Points(trailGeometry, new PointsMaterial({ map: this.glow, size: 0.55, color: "#FFD98A", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.75 }));
    this.trail.frustumCulled = false;

    this.curve = new CubicBezierCurve3(new Vector3(), new Vector3(), new Vector3(), new Vector3());

    const moon = new DirectionalLight("#C9D6FF", 1.6);
    moon.position.set(-4, 8, 6);
    const fill = new HemisphereLight("#7E89B0", "#2A2440", 1.1);
    this.scene.add(this.sky, this.stars, this.from.root, this.to.root, this.trail, this.spark, this.sparkLight, this.envelope, moon, fill);
  }

  /** Sets up a trip from one world to another. */
  begin(from: string | null, to: string): void {
    this.from.wear(from);
    this.to.wear(to);
    this.time = 0;
    this.progress = 0;
    this.frozen = false;
    this.history = [];
    // From just above the world left behind, up over the night, and down into the world ahead.
    const a = this.from.root.position.clone().add(new Vector3(0.9, this.from.radius + 0.2, 0.6));
    const d = this.to.root.position.clone().add(new Vector3(-0.5, this.to.radius * 0.55, this.to.radius * 0.8));
    this.curve.v0.copy(a);
    this.curve.v1.copy(a).add(new Vector3(2.4, 3.6, 1.2));
    this.curve.v2.copy(d).add(new Vector3(-3.2, 3.0, 1.6));
    this.curve.v3.copy(d);
    this.place(0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 0.8 ? 56 : 40;
    this.camera.updateProjectionMatrix();
  }

  /** Held still at one moment, for screenshots (see the engine's `tripAt`). */
  frozen = false;

  /** Jumps to a moment of the trip, with the light's trail drawn behind it. */
  seek(t: number): void {
    this.history = [];
    for (let i = 15; i >= 0; i -= 1) {
      this.time = Math.max(0, t * TRIP_SECONDS - i / 60);
      this.place(Math.max(0, t - i / (60 * TRIP_SECONDS)));
    }
    this.progress = t;
  }

  /** Moves the trip on. */
  update(dt: number, reducedMotion: boolean): void {
    if (this.frozen) return;
    this.time += dt;
    this.progress = Math.min(1, this.time / (reducedMotion ? 0.8 : TRIP_SECONDS));
    this.from.spin(dt, reducedMotion ? 0 : 0.35);
    this.to.spin(dt, reducedMotion ? 0 : -0.28);
    this.place(this.progress);
  }

  private place(t: number): void {
    const k = t * t * (3 - 2 * t);
    const p = this.curve.getPoint(k, this.scratch);
    this.spark.position.copy(p);
    this.sparkLight.position.copy(p);
    const pulse = 1.5 + Math.sin(this.time * 18) * 0.12;
    this.spark.scale.setScalar(pulse * (1 + Math.max(0, k - 0.85) * 4));
    // The envelope tumbles just behind the light.
    const behind = this.curve.getPoint(Math.max(0, k - 0.035));
    this.envelope.position.copy(behind).add(new Vector3(0, -0.18, 0));
    this.envelope.rotation.set(this.time * 2.1, this.time * 1.3, Math.sin(this.time * 3) * 0.6);
    this.envelope.visible = k < 0.93;
    // Trail.
    this.history.unshift(p.clone());
    if (this.history.length > 16) this.history.length = 16;
    for (let i = 0; i < 48; i += 1) {
      const h = this.history[Math.min(this.history.length - 1, Math.floor(i / 3))] ?? p;
      const n = this.history[Math.min(this.history.length - 1, Math.floor(i / 3) + 1)] ?? h;
      const f = (i % 3) / 3;
      this.trailPositions[i * 3] = h.x + (n.x - h.x) * f;
      this.trailPositions[i * 3 + 1] = h.y + (n.y - h.y) * f;
      this.trailPositions[i * 3 + 2] = h.z + (n.z - h.z) * f;
    }
    this.trail.geometry.attributes["position"]!.needsUpdate = true;
    // The world ahead glows more as the light comes near.
    this.from.glow = Math.max(0, 0.5 - k) * 0.6;
    this.to.glow = Math.min(0.85, Math.max(0, k - 0.45) * 1.6);
    // The camera: a wide view of both little worlds that slowly drifts toward the one
    // ahead, then leans in as the light dives, always keeping the light in sight.
    const c = Math.max(0, (t - 0.35) / 0.65);
    const lean = c * c * (3 - 2 * c);
    this.camera.position.set(-1.6 + t * 1.2, 1.0 + Math.sin(t * Math.PI) * 0.6, 17.5 - t * 1.5);
    this.look.set(-0.3 + t * 0.8, 0.2, -0.4);
    this.camera.position.lerp(this.scratch.copy(this.to.root.position).add(new Vector3(-1.4, 1.2, 8.8)), lean * 0.75);
    this.look.lerp(this.to.root.position, lean * 0.8);
    this.camera.lookAt(this.look);
  }

  /** Where the world ahead is on screen (0 to 1), for the light that closes over the view. */
  targetOnScreen(out: { x: number; y: number }): void {
    const p = this.to.root.position.clone().project(this.camera);
    out.x = p.x * 0.5 + 0.5;
    out.y = p.y * 0.5 + 0.5;
  }

  /** Everything that needs a shader, for compiling ahead of the first trip. */
  get objects(): Object3D[] {
    return [this.scene];
  }

  dispose(): void {
    this.glow.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.trail.geometry.dispose();
    this.trail.material.dispose();
    this.spark.material.dispose();
  }
}
