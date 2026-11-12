import { Group, Mesh, type MeshBasicMaterial, MeshToonMaterial, Object3D, PointLight, Vector3 } from "three";
import type { ToonLibrary } from "../render/toon";
import { damp } from "../world/sphere";
import { box, cone, cylinder, sphere, torus } from "./parts";

/**
 * Milo: Dad's unfinished robot, with a desk lamp for a head.
 *
 * One modular model. Each stage (Game Bible 5.6) shows one more part:
 * 0 dark lamp head on a stand, 1 corner-cube eyes, 2 mesh wheels,
 * 3 solar heart, 4 rotor, 5 golden-record voice.
 */
export const MILO_STAGES = 5;

const METAL = "#B9B4AA";
const METAL_DARK = "#6E6A66";
// Unfinished: dark gunmetal and dusty paint. He brightens as he gets his parts.
const SHELL = "#4F4843";
const SHELL_DARK = "#3A3431";
const LAMP = "#5F7F7A";
const INK = "#2B2622";
const GOLD = "#E0B34A";

export class Milo {
  readonly root = new Group();
  /** 0 to 5. */
  stage = 0;
  /** True while Milo stands on his workbench stand. */
  onStand = true;
  /** Lit up (he has his eyes), and spinning his rotor. */
  private awake = false;
  private spinning = false;

  private body = new Group();
  private neck = new Group();
  private head = new Group();
  private bulb: Mesh;
  private bulbDark: MeshToonMaterial;
  private bulbLit: MeshBasicMaterial;
  private light: PointLight;
  private parts: Record<"stand" | "eyes" | "wheels" | "feet" | "heart" | "rotor" | "record", Object3D>;
  private rotor = new Group();
  private wheels: Object3D[] = [];
  private time = 0;
  private hum = 0;
  private readonly lookTarget = new Vector3();
  private hasLook = false;

  constructor(private toon: ToonLibrary) {
    this.root.name = "milo";
    this.root.add(this.body);

    // Body: a small rounded rover shell.
    this.mesh(this.body, box(0.06), SHELL, [0, 0.3, 0], [0.42, 0.26, 0.34]);
    this.mesh(this.body, box(0.03), SHELL_DARK, [0, 0.19, 0], [0.44, 0.05, 0.36]);
    // Little panel screws, Dad style, a painted stripe and a carry handle.
    for (const x of [-0.17, 0.17]) for (const y of [0.22, 0.4]) this.mesh(this.body, sphere("low"), METAL_DARK, [x, y, 0.172], 0.012);
    this.mesh(this.body, box(0.01), LAMP, [0, 0.245, 0.171], [0.42, 0.035, 0.01]);
    this.mesh(this.body, box(0.01), SHELL_DARK, [-0.212, 0.31, 0], [0.01, 0.12, 0.2]);
    // Folded little arms, not finished yet: bare hinges and stubby grippers.
    for (const side of [-1, 1]) {
      this.mesh(this.body, sphere("low"), METAL_DARK, [side * 0.225, 0.34, 0.05], 0.035);
      this.mesh(this.body, cylinder(8), METAL, [side * 0.235, 0.27, 0.09], [0.018, 0.13, 0.018], [0.5, 0, 0]);
      this.mesh(this.body, box(0.01), METAL_DARK, [side * 0.235, 0.22, 0.13], [0.04, 0.035, 0.05]);
    }

    // Panel seams, and axle stubs waiting for wheels.
    for (const x of [-0.07, 0.07]) this.mesh(this.body, box(0.002), "#2E2926", [x, 0.32, 0.171], [0.006, 0.2, 0.004]);
    for (const x of [-0.215, 0.215]) for (const z of [-0.12, 0.12]) this.mesh(this.body, cylinder(10), METAL_DARK, [x, 0.21, z], [0.035, 0.03, 0.035], [0, 0, Math.PI / 2]);
    // Neck: a desk-lamp arm in two segments, with springs along the side.
    this.neck.position.set(0, 0.43, -0.08);
    this.body.add(this.neck);
    this.mesh(this.neck, sphere("low"), METAL_DARK, [0, 0.0, 0], 0.045);
    this.mesh(this.neck, cylinder(8), METAL, [0, 0.12, -0.03], [0.022, 0.25, 0.022], [-0.25, 0, 0]);
    this.mesh(this.neck, sphere("low"), METAL_DARK, [0, 0.24, -0.06], 0.035);
    this.mesh(this.neck, cylinder(8), METAL, [0, 0.31, 0.0], [0.02, 0.17, 0.02], [0.75, 0, 0]);
    for (let i = 0; i < 4; i += 1) {
      this.mesh(this.neck, torus(0.3), METAL_DARK, [0.04, 0.06 + i * 0.045, -0.015 - i * 0.012], [0.018, 0.018, 0.018], [0, Math.PI / 2, 0]);
    }

    // Head: a desk lamp shade with the bulb as his face.
    this.head.position.set(0, 0.37, 0.06);
    this.neck.add(this.head);
    this.mesh(this.head, sphere("low"), METAL_DARK, [0, 0, 0], 0.045);
    // The wide mouth of the shade faces forward and a little down: that is his face.
    const shade = this.mesh(this.head, cylinder(20, 0.45, true), LAMP, [0, 0.02, 0.1], [0.17, 0.2, 0.17], [-1.27, 0, 0]);
    shade.material = this.toon.toon({ color: LAMP, objectSpace: true, paint: 0.08, side: 2 });
    this.mesh(this.head, cylinder(20, 1), LAMP, [0, 0.05, 0.01], [0.08, 0.05, 0.08], [-1.27, 0, 0]);
    this.bulbDark = this.toon.toon({ color: "#7A746A", objectSpace: true, paint: 0.05 });
    this.bulbLit = this.toon.glow("#FFE2A6");
    this.bulb = this.mesh(this.head, sphere("mid"), "#8E8676", [0, -0.005, 0.16], [0.09, 0.09, 0.07]);
    this.bulb.material = this.bulbDark;

    this.light = new PointLight("#FFC777", 0, 3.5, 1.6);
    this.light.position.set(0, -0.01, 0.3);
    this.head.add(this.light);

    // Stage 1: corner-cube eyes. Each eye is three faces meeting in a corner, like the Moon mirrors.
    const eyes = new Group();
    for (const side of [-1, 1]) {
      const eye = new Group();
      eye.position.set(side * 0.042, 0.005, 0.235);
      const corner = this.mesh(eye, cone(3), "#D8E2E6", [0, 0, 0], [0.026, 0.02, 0.026], [-Math.PI / 2, 0, 0]);
      corner.material = this.toon.glow("#E8F3F5");
      this.mesh(eye, sphere("low"), INK, [0, 0, -0.008], [0.03, 0.03, 0.012]);
      eyes.add(eye);
    }
    this.head.add(eyes);

    // Stage 0 and 1: a stand. Milo has no wheels yet.
    const stand = new Group();
    // A turned wooden display stand, like the ones for Dad's models.
    this.mesh(stand, cylinder(20), "#6B3F2A", [0, 0.02, 0], [0.27, 0.04, 0.27]);
    this.mesh(stand, cylinder(20, 0.8), "#7A4A2E", [0, 0.06, 0], [0.22, 0.05, 0.22]);
    this.mesh(stand, torus(0.25), GOLD, [0, 0.04, 0], [0.27, 0.27, 0.06], [Math.PI / 2, 0, 0]);
    this.mesh(stand, cylinder(12, 0.7), "#7A4A2E", [0, 0.12, 0], [0.07, 0.08, 0.07]);
    // A paper tag tied to the stand: no words yet, only a doodle.
    this.mesh(stand, box(0.004), "#F4ECDD", [0.2, 0.09, 0.2], [0.09, 0.055, 0.004], [0, -0.7, 0.1]);
    this.root.add(stand);

    // Stubby feet while he waits for wheels.
    const feet = new Group();
    for (const x of [-0.13, 0.13]) this.mesh(feet, box(0.02), METAL_DARK, [x, 0.17, 0], [0.09, 0.05, 0.22]);
    this.body.add(feet);

    // Stage 2: wire-mesh wheels with chevrons.
    const wheels = new Group();
    for (const x of [-0.25, 0.25]) {
      for (const z of [-0.13, 0.13]) {
        const wheel = new Group();
        wheel.position.set(x, 0.12, z);
        this.mesh(wheel, cylinder(16), METAL, [0, 0, 0], [0.11, 0.07, 0.11], [0, 0, Math.PI / 2]);
        this.mesh(wheel, cylinder(16), METAL_DARK, [0, 0, 0], [0.06, 0.075, 0.06], [0, 0, Math.PI / 2]);
        for (let i = 0; i < 6; i += 1) {
          const angle = (i / 6) * Math.PI * 2;
          this.mesh(wheel, box(0.005), "#D9A441", [0, Math.cos(angle) * 0.108, Math.sin(angle) * 0.108], [0.075, 0.012, 0.03], [angle, 0, 0]);
        }
        wheels.add(wheel);
        this.wheels.push(wheel);
      }
    }
    this.body.add(wheels);

    // Stage 3: solar heart on the chest.
    const heart = new Group();
    this.mesh(heart, box(0.01), "#2E3B5C", [0, 0.31, 0.172], [0.16, 0.12, 0.015]);
    for (let i = 0; i < 3; i += 1) this.mesh(heart, box(0.002), "#4A90C8", [-0.05 + i * 0.05, 0.31, 0.18], [0.04, 0.1, 0.004]);
    this.body.add(heart);

    // Stage 4: a little rotor above the shade.
    this.rotor.position.set(0, 0.13, 0.02);
    this.mesh(this.rotor, cylinder(8), METAL_DARK, [0, -0.03, 0], [0.012, 0.06, 0.012]);
    for (const angle of [0, Math.PI]) {
      this.mesh(this.rotor, box(0.01), SHELL, [Math.cos(angle) * 0.13, 0, Math.sin(angle) * 0.13], [0.26, 0.008, 0.04], [0, -angle, 0]);
    }
    this.head.add(this.rotor);

    // Stage 5: the golden record in his chest.
    const record = new Group();
    this.mesh(record, cylinder(24), GOLD, [0.14, 0.3, 0.17], [0.05, 0.01, 0.05], [Math.PI / 2, 0, 0]);
    this.mesh(record, cylinder(12), "#8E6A1F", [0.14, 0.3, 0.177], [0.012, 0.004, 0.012], [Math.PI / 2, 0, 0]);
    this.body.add(record);

    this.parts = { stand, eyes, wheels, feet, heart, rotor: this.rotor, record };
    this.root.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = true;
    });
    this.setStage(0);
  }

  private mesh(
    parent: Object3D,
    geometry: Mesh["geometry"],
    color: string,
    position: [number, number, number],
    scale: number | [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    const mesh = new Mesh(geometry, this.toon.toon({ color, objectSpace: true, paint: 0.08 }));
    mesh.position.set(position[0], position[1], position[2]);
    if (typeof scale === "number") mesh.scale.setScalar(scale);
    else mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    return mesh;
  }

  setStage(stage: number): void {
    const s = Math.max(0, Math.min(MILO_STAGES, Math.floor(stage)));
    this.setParts({ eyes: s >= 1, wheels: s >= 2, heart: s >= 3, rotor: s >= 4, record: s >= 5 });
  }

  /**
   * Shows the parts Milo has. Chapters can be played in any order, so each
   * part is its own switch; `stage` counts them.
   */
  setParts(parts: { eyes: boolean; wheels: boolean; heart: boolean; rotor: boolean; record: boolean }): void {
    this.stage = [parts.eyes, parts.wheels, parts.heart, parts.rotor, parts.record].filter(Boolean).length;
    this.awake = parts.eyes;
    this.spinning = parts.rotor;
    this.onStand = !parts.wheels;
    this.parts.stand.visible = this.onStand;
    this.parts.feet.visible = !parts.wheels;
    this.parts.eyes.visible = parts.eyes;
    this.parts.wheels.visible = parts.wheels;
    this.parts.heart.visible = parts.heart;
    this.parts.rotor.visible = parts.rotor;
    this.parts.record.visible = parts.record;
    this.body.position.y = this.onStand ? 0.0 : -0.06;
    this.bulb.material = parts.eyes ? this.bulbLit : this.bulbDark;
    this.light.intensity = parts.eyes ? 0.8 : 0;
  }

  /** Milo turns his lamp head toward a point, such as the nearest player. */
  lookAt(target: Vector3 | null): void {
    if (target) this.lookTarget.copy(target);
    this.hasLook = target !== null;
  }

  /**
   * @param nearness 0 to 1, how close the nearest player is. At stage 0 this
   * only makes his faint hum (and a tiny tremble) stronger.
   */
  update(dt: number, nearness: number, reducedMotion = false): void {
    this.time += dt;
    this.hum += (nearness - this.hum) * damp(2, dt);

    if (!this.awake) {
      // Dark and still. The faintest tremble when Remi is close.
      const tremble = reducedMotion ? 0 : Math.sin(this.time * 40) * 0.004 * this.hum;
      this.head.rotation.set(0.45 + tremble, 0, 0);
      this.neck.rotation.set(0.1, 0, 0);
      return;
    }

    let yaw = Math.sin(this.time * 0.6) * 0.3;
    let pitch = Math.sin(this.time * 0.9) * 0.08;
    if (this.hasLook) {
      const local = this.head.parent?.worldToLocal(this.lookTarget.clone()) ?? this.lookTarget;
      yaw = Math.atan2(local.x, local.z);
      pitch = -Math.atan2(local.y - 0.2, Math.hypot(local.x, local.z)) * 0.6;
    }
    this.head.rotation.y += (yaw - this.head.rotation.y) * damp(5, dt);
    this.head.rotation.x += (pitch - this.head.rotation.x) * damp(5, dt);
    if (this.spinning) this.rotor.rotation.y += dt * (reducedMotion ? 2 : 10);
  }

  /** Spins the wheels by the distance travelled. */
  roll(distance: number): void {
    for (const wheel of this.wheels) wheel.rotation.x += distance / 0.11;
  }
}

