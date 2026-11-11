import { type BufferGeometry, Group, Mesh, type Object3D, Vector3 } from "three";
import type { ToonLibrary } from "../render/toon";
import { damp } from "../world/sphere";
import { Assembly, box, capsule, cone, cylinder, limb, sphere, torus } from "./parts";

/**
 * Chunky chibi kids, built from simple shapes in code.
 *
 * Proportions follow Game Bible section 9: the head is about 40 percent of
 * the height. Silhouettes carry identity (backpack, cap, beret, goggles), so
 * nobody has to rely on color alone. All four kids share one rig and one set
 * of animations; personality shows in the idle and in small timing changes.
 */
export type KidId = "remi" | "nori" | "lumi" | "theo";

export const KIDS: KidId[] = ["remi", "nori", "lumi", "theo"];

interface Palette {
  skin: string;
  hair: string;
  top: string;
  topDark: string;
  legs: string;
  shoes: string;
  accent: string;
  accentDark: string;
}

export const KID_PALETTES: Record<KidId, Palette> = {
  remi: { skin: "#C68E64", hair: "#3A2A22", top: "#D3A13A", topDark: "#A97A24", legs: "#3D4A6B", shoes: "#7A3B2E", accent: "#8E4E35", accentDark: "#6B3825" },
  nori: { skin: "#EFC59C", hair: "#211A17", top: "#EA7038", topDark: "#B9502A", legs: "#4A4F5C", shoes: "#F1E6D2", accent: "#2F3B63", accentDark: "#C0573E" },
  lumi: { skin: "#8C5A3B", hair: "#251B18", top: "#B9A5D8", topDark: "#9481B8", legs: "#5A4A69", shoes: "#2E2A4F", accent: "#7D3A4E", accentDark: "#5B2838" },
  theo: { skin: "#F1D0B2", hair: "#C3743A", top: "#2F8A86", topDark: "#21625F", legs: "#2F8A86", shoes: "#5A3A2A", accent: "#D9A441", accentDark: "#7A4A2E" },
};

export interface Motion {
  /** 0 standing, 1 walking, about 1.75 running. */
  pace: number;
  running: boolean;
  grounded: boolean;
  verticalSpeed: number;
  sinceLanding: number;
  landingSpeed: number;
  carrying: boolean;
}

export type Action = "none" | "interact" | "emote" | "celebrate";

const INK = "#2B2622";
const SOCK = "#F4ECDD";
const SOLE = "#EFE6D6";

/** A posable joint. */
function joint(name: string, x = 0, y = 0, z = 0): Group {
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);
  return group;
}

const lookScratch = new Vector3();

export class Character {
  readonly root = new Group();
  readonly id: KidId;
  /** Where a carried envelope sits. */
  readonly carrySocket: Group;

  private body = joint("body");
  private hips: Group;
  private torso: Group;
  private head: Group;
  private armL: Group;
  private armR: Group;
  private legL: Group;
  private legR: Group;
  private kneeL: Group;
  private kneeR: Group;
  private elbowL: Group;
  private elbowR: Group;
  private eyes: Group[] = [];
  private brows: Group[] = [];
  /** Parts are painted with vertex colors and merged per joint: one draw call per joint. */
  private assembly: Assembly;
  /** Secondary motion: the backpack and hair lag behind the body a little. */
  private trail: Group | null = null;
  private trailSwing = 0;
  private trailVelocity = 0;
  private lastPhase = 0;
  /** Where the head should turn, in the character's own frame, or null. */
  private lookTarget: { yaw: number; pitch: number } | null = null;
  private propInHand: Object3D | null = null;

  private phase = 0;
  private time = Math.random() * 10;
  private idleTime = 0;
  private idleQuirk = 0;
  private blink = 3;
  private action: Action = "none";
  private actionTime = 0;
  private lean = 0;
  private squash = 0;

  constructor(
    id: KidId,
    private toon: ToonLibrary,
  ) {
    this.id = id;
    this.root.name = `kid-${id}`;
    this.assembly = new Assembly(toon.toon({ vertexColors: true, objectSpace: true, paint: 0.1 }));
    const p = KID_PALETTES[id];
    this.root.add(this.body);

    this.hips = joint("hips", 0, 0.31, 0);
    this.body.add(this.hips);

    // Legs: a thigh from the hip, a knee, and a shin that ends in a rolled cuff and a sneaker.
    this.legL = joint("legL", -0.085, 0, 0);
    this.legR = joint("legR", 0.085, 0, 0);
    this.kneeL = joint("kneeL", 0, -0.135, 0);
    this.kneeR = joint("kneeR", 0, -0.135, 0);
    for (const [leg, knee] of [
      [this.legL, this.kneeL],
      [this.legR, this.kneeR],
    ] as const) {
      this.hips.add(leg);
      leg.add(knee);
      limb(this.assembly, leg, [0, 0.01, 0], [0, -0.135, 0], 0.068, p.legs);
      limb(this.assembly, knee, [0, 0, 0], [0, -0.07, 0], 0.063, p.legs);
      this.part(knee, cylinder(14), p.legs, [0, -0.066, 0], [0.076, 0.034, 0.076]);
      this.part(knee, cylinder(12), SOCK, [0, -0.1, 0], [0.056, 0.03, 0.056]);
      // Rounded sneaker: a puffy upper, a toe box, a pale sole and a toe cap, with two lace bars.
      this.part(knee, sphere("mid"), p.shoes, [0, -0.122, 0.022], [0.07, 0.052, 0.1]);
      this.part(knee, sphere("mid"), p.shoes, [0, -0.134, 0.08], [0.066, 0.042, 0.066]);
      this.part(knee, box(0.03), SOLE, [0, -0.157, 0.032], [0.142, 0.036, 0.232]);
      this.part(knee, sphere("low"), SOLE, [0, -0.141, 0.118], [0.058, 0.03, 0.042]);
      for (const [z, y] of [
        [0.035, -0.07],
        [0.065, -0.075],
      ] as const) {
        this.part(knee, box(0.005), SOCK, [0, y, z], [0.058, 0.008, 0.012], [0.45, 0, 0]);
      }
    }

    // Torso.
    this.torso = joint("torso", 0, 0.02, 0);
    this.hips.add(this.torso);
    this.part(this.torso, capsule(0.16), p.top, [0, 0.2, 0], [0.175, 0.175, 0.145]);
    // Hem, so the top reads as clothing.
    this.part(this.torso, cylinder(16), p.topDark, [0, 0.03, 0], [0.18, 0.05, 0.15]);

    // Arms hang from the shoulders: an upper arm, an elbow, a forearm, a cuff and a mitten hand.
    this.armL = joint("armL", -0.2, 0.33, 0);
    this.armR = joint("armR", 0.2, 0.33, 0);
    this.elbowL = joint("elbowL", 0, -0.105, 0);
    this.elbowR = joint("elbowR", 0, -0.105, 0);
    const sleeve = id === "theo" ? "#F1E4CC" : p.top;
    const cuff = id === "theo" ? "#F1E4CC" : p.topDark;
    for (const [arm, elbow] of [
      [this.armL, this.elbowL],
      [this.armR, this.elbowR],
    ] as const) {
      this.torso.add(arm);
      arm.add(elbow);
      limb(this.assembly, arm, [0, 0.005, 0], [0, -0.105, 0], 0.056, sleeve);
      limb(this.assembly, elbow, [0, 0, 0], [0, -0.07, 0], 0.052, sleeve);
      this.part(elbow, cylinder(12), cuff, [0, -0.08, 0], [0.061, 0.03, 0.061]);
      this.part(elbow, sphere("mid"), p.skin, [0, -0.132, 0.005], [0.058, 0.064, 0.054]);
      this.part(elbow, sphere("low"), p.skin, [arm === this.armL ? 0.04 : -0.04, -0.117, 0.035], [0.024, 0.03, 0.024]);
    }
    // Rounded shoulders, so the arms grow out of the body.
    for (const side of [-1, 1]) this.part(this.torso, sphere("mid"), p.top, [side * 0.165, 0.315, 0], [0.075, 0.07, 0.075]);
    this.carrySocket = joint("carry", 0, 0.2, 0.24);
    this.torso.add(this.carrySocket);

    // Head.
    this.head = joint("head", 0, 0.45, 0);
    this.torso.add(this.head);
    this.part(this.head, sphere("high"), p.skin, [0, 0.2, 0], [0.27, 0.255, 0.255]);
    this.part(this.head, sphere("low"), p.skin, [-0.265, 0.18, 0], [0.05, 0.065, 0.04]);
    this.part(this.head, sphere("low"), p.skin, [0.265, 0.18, 0], [0.05, 0.065, 0.04]);
    for (const side of [-1, 1]) {
      // Each eye is its own joint so it can blink. The catch lights sit inside it and blink too.
      const eye = joint("eye", side * 0.095, 0.2, 0.235);
      this.head.add(eye);
      this.part(eye, sphere("mid"), INK, [0, 0, 0], [0.034, 0.05, 0.022]);
      this.part(eye, sphere("tiny"), "#FFF8EC", [-0.011, 0.019, 0.0165], [0.0116, 0.012, 0.0088]);
      this.part(eye, sphere("tiny"), "#FFF8EC", [0.0102, -0.0175, 0.0176], [0.0054, 0.0055, 0.0044]);
      this.eyes.push(eye);
      this.part(this.head, sphere("low"), "#E59A86", [side * 0.155, 0.13, 0.21], [0.045, 0.026, 0.02]);
      // Brows sit just under the fringe and lift a little when the kid is happy.
      const brow = joint("brow", side * 0.1, 0.268, 0.228);
      this.head.add(brow);
      this.part(brow, capsule(0.6), p.hair, [0, 0, 0], [0.011, 0.024, 0.011], [0, 0, Math.PI / 2 + side * 0.18]);
      this.brows.push(brow);
    }
    // A button nose.
    this.part(this.head, sphere("low"), p.skin, [0, 0.158, 0.255], [0.024, 0.02, 0.018]);
    this.part(this.head, torus(0.3, Math.PI * 0.8), INK, [0, 0.12, 0.246], 0.032, [0, 0, Math.PI * 1.1]);

    this.dress(id, p);
    this.assembly.flush();
  }

  /** Adds a painted shape to a joint. Shapes merge when the assembly is flushed. */
  private part(
    parent: Object3D,
    geometry: BufferGeometry,
    color: string,
    position: [number, number, number],
    scale: number | [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): void {
    this.assembly.add(parent, geometry, color, position, scale, rotation);
  }

  /** Hair, hats and the things that make each kid a silhouette. */
  private dress(id: KidId, p: Palette): void {
    const h = this.head;
    const t = this.torso;
    switch (id) {
      case "remi": {
        // Messy short hair: a cap of hair, a side-swept fringe, a cowlick and tufts at the nape.
        this.part(h, sphere("high"), p.hair, [0, 0.29, -0.03], [0.285, 0.2, 0.27]);
        this.part(h, sphere("mid"), p.hair, [-0.09, 0.33, 0.14], [0.17, 0.09, 0.12], [0.3, 0, 0.35]);
        this.part(h, cone(6), p.hair, [0.07, 0.48, 0.0], [0.05, 0.1, 0.05], [0.2, 0, -0.55]);
        this.part(h, cone(6), p.hair, [0.12, 0.46, -0.05], [0.04, 0.08, 0.04], [-0.1, 0, -0.9]);
        for (const [x, y, z] of [[-0.12, 0.15, -0.2], [0.0, 0.13, -0.23], [0.12, 0.15, -0.2], [-0.21, 0.2, -0.1], [0.21, 0.2, -0.1]] as const) {
          this.part(h, sphere("low"), p.hair, [x, y, z], [0.075, 0.07, 0.065]);
        }
        // Mustard jacket with many pockets, each with a flap and a button.
        for (const [x, y] of [[-0.09, 0.14], [0.09, 0.14], [-0.1, 0.27], [0.1, 0.27]] as const) {
          this.part(t, box(0.02), p.topDark, [x, y, 0.135], [0.07, 0.06, 0.03]);
          this.part(t, box(0.01), p.topDark, [x, y + 0.035, 0.145], [0.076, 0.022, 0.03]);
          this.part(t, sphere("low"), "#F4ECDD", [x, y + 0.03, 0.163], 0.009);
        }
        this.part(t, box(0.02), p.topDark, [0, 0.4, 0.07], [0.2, 0.05, 0.12]);
        this.part(t, box(0.005), "#7A5A1E", [0, 0.22, 0.155], [0.012, 0.3, 0.01]);
        for (const side of [-1, 1]) this.part(t, box(0.01), p.accentDark, [side * 0.1, 0.25, 0.1], [0.035, 0.3, 0.05]);

        // The big backpack hangs from the shoulders on its own pivot, so it can swing.
        const pack = joint("pack", 0, 0.42, -0.14);
        t.add(pack);
        this.trail = pack;
        const y0 = -0.42;
        const z0 = 0.14;
        this.part(pack, box(0.09), p.accent, [0, 0.23 + y0, -0.21 + z0], [0.42, 0.44, 0.22]);
        // Top flap with two buckles.
        this.part(pack, box(0.06), p.accentDark, [0, 0.4 + y0, -0.24 + z0], [0.44, 0.13, 0.2]);
        for (const side of [-1, 1]) {
          this.part(pack, box(0.01), p.accentDark, [side * 0.11, 0.3 + y0, -0.325 + z0], [0.04, 0.14, 0.02]);
          this.part(pack, box(0.01), "#D9A441", [side * 0.11, 0.255 + y0, -0.33 + z0], [0.055, 0.035, 0.02]);
        }
        // Front pocket with a round patch: an orange planet with a ring.
        this.part(pack, box(0.04), p.accentDark, [0, 0.12 + y0, -0.32 + z0], [0.26, 0.15, 0.06]);
        this.part(pack, cylinder(16), "#F2A541", [0, 0.125 + y0, -0.352 + z0], [0.045, 0.01, 0.045], [Math.PI / 2, 0, 0]);
        this.part(pack, torus(0.12), "#F4ECDD", [0, 0.125 + y0, -0.358 + z0], [0.068, 0.025, 0.03], [0, 0, 0.35]);
        // Side pockets: a water bottle on one side, a rolled map on the other.
        this.part(pack, box(0.04), p.accentDark, [0.235, 0.15 + y0, -0.21 + z0], [0.07, 0.2, 0.15]);
        this.part(pack, cylinder(12), "#6E8FB0", [0.24, 0.29 + y0, -0.21 + z0], [0.04, 0.12, 0.04]);
        this.part(pack, cylinder(12), "#2E2A4F", [0.24, 0.36 + y0, -0.21 + z0], [0.03, 0.03, 0.03]);
        this.part(pack, box(0.04), p.accentDark, [-0.235, 0.15 + y0, -0.21 + z0], [0.07, 0.2, 0.15]);
        this.part(pack, cylinder(10), "#F4ECDD", [-0.245, 0.3 + y0, -0.2 + z0], [0.03, 0.2, 0.03], [0.25, 0, 0]);
        // A bedroll strapped under the bottom, and a little brass key charm.
        this.part(pack, cylinder(16), "#C0573E", [0, 0.0 + y0, -0.2 + z0], [0.075, 0.46, 0.075], [0, 0, Math.PI / 2]);
        for (const side of [-1, 1]) this.part(pack, cylinder(12), "#6B3825", [side * 0.14, 0.0 + y0, -0.2 + z0], [0.079, 0.025, 0.079], [0, 0, Math.PI / 2]);
        this.part(pack, torus(0.3), "#D9A441", [-0.15, 0.34 + y0, -0.35 + z0], 0.018);
        this.part(pack, box(0.01), "#D9A441", [-0.15, 0.3 + y0, -0.35 + z0], [0.015, 0.05, 0.008]);
        break;
      }
      case "nori": {
        this.part(h, sphere("high"), p.hair, [0, 0.25, -0.05], [0.275, 0.2, 0.26]);
        // Cap with a long brim.
        this.part(h, sphere("high"), p.accent, [0, 0.33, 0], [0.275, 0.17, 0.27]);
        this.part(h, cylinder(20), p.accentDark, [0, 0.33, 0.25], [0.19, 0.018, 0.15]);
        this.part(h, sphere("low"), p.accentDark, [0, 0.5, 0], 0.03);
        // Windbreaker zip and collar.
        this.part(t, box(0.005), "#F4ECDD", [0, 0.22, 0.142], [0.02, 0.32, 0.01]);
        this.part(t, torus(0.35), p.topDark, [0, 0.4, 0], [0.13, 0.13, 0.1], [Math.PI / 2, 0, 0]);
        break;
      }
      case "lumi": {
        this.part(h, sphere("high"), p.hair, [0, 0.23, -0.06], [0.29, 0.24, 0.27]);
        // Hair falls to the shoulders.
        this.part(h, capsule(0.12), p.hair, [-0.22, 0.08, -0.06], [0.08, 0.1, 0.09]);
        this.part(h, capsule(0.12), p.hair, [0.22, 0.08, -0.06], [0.08, 0.1, 0.09]);
        // A soft beret tipped to one side.
        this.part(h, sphere("mid"), p.accent, [0.04, 0.42, -0.02], [0.27, 0.075, 0.25], [0, 0, -0.22]);
        this.part(h, cylinder(8), p.accentDark, [0.06, 0.49, -0.02], [0.02, 0.04, 0.02]);
        // The hood bunched at the back.
        this.part(t, sphere("mid"), p.topDark, [0, 0.4, -0.12], [0.17, 0.1, 0.1]);
        this.part(t, box(0.03), p.topDark, [0, 0.12, 0.14], [0.2, 0.08, 0.03]);
        // Sketchbook in the left hand.
        const book = new Group();
        this.part(book, box(0.01), "#C0573E", [0, 0, 0], [0.2, 0.26, 0.035]);
        this.part(book, box(0.005), "#F4ECDD", [0, 0, 0.014], [0.18, 0.24, 0.015]);
        book.position.set(0, -0.155, 0.05);
        book.rotation.set(-0.3, 0, 0);
        this.elbowL.add(book);
        break;
      }
      case "theo": {
        // Curly hair, built from bumps.
        this.part(h, sphere("high"), p.hair, [0, 0.29, -0.03], [0.28, 0.19, 0.27]);
        for (const [x, y, z] of [[-0.18, 0.36, 0.08], [0.0, 0.43, 0.06], [0.17, 0.37, 0.07], [-0.2, 0.25, -0.1], [0.2, 0.26, -0.1]] as const) {
          this.part(h, sphere("low"), p.hair, [x, y, z], 0.075);
        }
        // Goggles pushed up on the forehead, with a strap.
        this.part(h, torus(0.07), "#3A2F2A", [0, 0.3, -0.01], [0.275, 0.275, 0.2], [Math.PI / 2 - 0.3, 0, 0]);
        for (const side of [-1, 1]) {
          this.part(h, cylinder(16), p.accent, [side * 0.1, 0.33, 0.215], [0.09, 0.06, 0.09], [Math.PI / 2 - 0.45, 0, 0]);
          this.part(h, cylinder(16), "#86C1CF", [side * 0.1, 0.345, 0.245], [0.07, 0.014, 0.07], [Math.PI / 2 - 0.45, 0, 0]);
          this.part(h, sphere("low"), "#FFFFFF", [side * 0.1 - 0.02, 0.365, 0.255], 0.015);
        }
        this.part(t, box(0.03), p.topDark, [0, 0.27, 0.13], [0.2, 0.18, 0.04]);
        for (const side of [-1, 1]) this.part(t, box(0.01), p.topDark, [side * 0.09, 0.36, 0.0], [0.035, 0.05, 0.3]);
        // Tool belt with a hammer and a screwdriver.
        this.part(t, torus(0.22), p.accentDark, [0, 0.05, 0], [0.18, 0.18, 0.15], [Math.PI / 2, 0, 0]);
        // A hammer and a wrench hang from the belt, and a pouch sits at the front.
        this.part(t, box(0.02), "#7A4A2E", [0.2, -0.05, 0.03], [0.035, 0.2, 0.035]);
        this.part(t, box(0.03), "#9A9286", [0.2, 0.06, 0.03], [0.05, 0.05, 0.13]);
        this.part(t, box(0.02), "#B9B4AA", [-0.2, -0.04, 0.03], [0.03, 0.18, 0.03]);
        this.part(t, torus(0.3), "#B9B4AA", [-0.2, -0.14, 0.03], [0.035, 0.035, 0.035]);
        this.part(t, box(0.03), p.accent, [0.0, 0.02, 0.15], [0.12, 0.09, 0.06]);
        break;
      }
    }
  }

  /**
   * Turns the head toward a world point, or back to idle with null.
   * Only points in front of the kid are followed; behind, the head relaxes.
   */
  lookAt(point: Vector3 | null): void {
    if (!point) {
      this.lookTarget = null;
      return;
    }
    this.root.updateMatrixWorld();
    const p = lookScratch.copy(point);
    this.root.worldToLocal(p);
    p.y -= 1.0;
    if (p.z < -0.2) {
      this.lookTarget = null;
      return;
    }
    const flat = Math.hypot(p.x, p.z);
    this.lookTarget = { yaw: Math.atan2(p.x, p.z), pitch: -Math.atan2(p.y, flat) };
  }

  /** Starts a one-off action, such as reaching for a letter or waving. */
  play(action: Action): void {
    this.action = action;
    this.actionTime = 0;
  }

  /** Shows a small thing in the right hand for a personality idle. */
  private holdProp(kind: "pebble" | "screwdriver" | null): void {
    if (this.propInHand) {
      this.elbowR.remove(this.propInHand);
      this.propInHand.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      this.propInHand = null;
    }
    if (!kind) return;
    const prop = new Group();
    if (kind === "pebble") this.part(prop, sphere("low"), "#8C8478", [0, 0, 0], [0.045, 0.035, 0.04]);
    else {
      this.part(prop, cylinder(8), "#C0573E", [0, 0, 0], [0.022, 0.07, 0.022]);
      this.part(prop, cylinder(6), "#B9B4AA", [0, -0.07, 0], [0.008, 0.08, 0.008]);
    }
    prop.position.set(0, -0.185, 0.04);
    this.assembly.flush();
    this.elbowR.add(prop);
    this.propInHand = prop;
  }

  update(dt: number, motion: Motion, reducedMotion = false): void {
    this.time += dt;
    const pace = Math.min(motion.pace, 2);
    const moving = pace > 0.08 && motion.grounded;

    // Stride: run cadence is quicker, and Nori always moves a touch faster.
    const cadence = (motion.running ? 11.5 : 8.4) * (this.id === "nori" ? 1.06 : 1);
    if (moving) this.phase += dt * cadence * Math.min(1, pace + 0.15);

    // Idle timer and personality quirks.
    if (moving || !motion.grounded || this.action !== "none" || motion.carrying) {
      this.idleTime = 0;
      if (this.idleQuirk > 0) {
        this.idleQuirk = 0;
        this.holdProp(null);
      }
    } else {
      this.idleTime += dt;
      if (this.idleQuirk === 0 && this.idleTime > 6 && !reducedMotion) {
        this.idleQuirk = 0.0001;
        if (this.id === "remi") this.holdProp("pebble");
        if (this.id === "theo") this.holdProp("screwdriver");
      }
      if (this.idleQuirk > 0) {
        this.idleQuirk += dt;
        if (this.idleQuirk > 3.6) {
          this.idleQuirk = 0;
          this.idleTime = 0;
          this.holdProp(null);
        }
      }
    }
    if (this.action !== "none") {
      this.actionTime += dt;
      const length = this.action === "interact" ? 0.6 : this.action === "emote" ? 1.4 : 1.8;
      if (this.actionTime > length) this.action = "none";
    }

    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const swing = moving ? (motion.running ? 0.95 : 0.62) * Math.min(1, pace) : 0;
    const breathe = reducedMotion ? 0 : Math.sin(this.time * 2.1) * 0.012;

    // Legs and arms. The leg swinging forward bends its knee to lift the foot;
    // the leg on the ground stays nearly straight. Elbows bend more on a run.
    let legL = s * swing;
    let legR = -s * swing;
    let armL = -s * swing * 0.85;
    let armR = s * swing * 0.85;
    let armLz = 0.12;
    let armRz = -0.12;
    const lift = moving ? (motion.running ? 1.4 : 0.95) * Math.min(1, pace) : 0;
    let kneeL = 0.05 + Math.max(0, -c) * lift;
    let kneeR = 0.05 + Math.max(0, c) * lift;
    const bend = moving ? (motion.running ? -1.3 : -0.3) : -0.16;
    let elbowL = bend - Math.max(0, s * swing) * 0.4;
    let elbowR = bend - Math.max(0, -s * swing) * 0.4;
    let headX = 0;
    let headZ = 0;
    let headY = 0;
    let bob = moving ? Math.abs(c) * (motion.running ? 0.07 : 0.045) : breathe;

    if (!motion.grounded) {
      // Up: tuck one knee and throw the arms. Down: reach for the ground.
      const rising = motion.verticalSpeed > 0;
      legL = rising ? -0.9 : -0.35;
      legR = rising ? 0.25 : 0.15;
      armL = rising ? -2.4 : -1.1;
      armR = rising ? -2.2 : -1.0;
      armLz = 0.45;
      armRz = -0.45;
      kneeL = rising ? 1.35 : 0.55;
      kneeR = rising ? 0.45 : 0.3;
      elbowL = -0.45;
      elbowR = -0.45;
      bob = 0;
    }

    if (motion.carrying) {
      armL = -0.85;
      armR = -0.85;
      armLz = -0.22;
      armRz = 0.22;
      elbowL = -0.75;
      elbowR = -0.75;
    }

    // Personality idles.
    if (this.idleQuirk > 0) {
      const q = Math.min(1, this.idleQuirk * 2.5) * Math.min(1, (3.6 - this.idleQuirk) * 2.5);
      switch (this.id) {
        case "remi":
          armR = -1.0 * q;
          armRz = 0.35 * q;
          elbowR = -0.16 - 0.9 * q;
          headX = 0.4 * q;
          if (this.propInHand) this.propInHand.rotation.y = this.time * 2;
          break;
        case "nori":
          armL = -2.9 * q;
          armR = -2.9 * q;
          armLz = 0.2 * q;
          armRz = -0.2 * q;
          elbowL = -0.1;
          elbowR = -0.1;
          headX = -0.25 * q;
          bob += 0.03 * q;
          break;
        case "lumi":
          armL = -0.8 * q;
          elbowL = -0.16 - 1.0 * q;
          armR = (-0.7 + Math.sin(this.time * 9) * 0.12) * q;
          elbowR = -0.16 - 0.9 * q;
          armRz = 0.3 * q;
          headX = 0.3 * q;
          headZ = 0.15 * q;
          break;
        case "theo":
          armR = -0.8 * q;
          elbowR = -0.16 - 0.95 * q;
          armRz = 0.2 * q;
          headX = 0.25 * q;
          if (this.propInHand) this.propInHand.rotation.y = this.time * 14;
          break;
      }
    }

    // One-off actions.
    if (this.action !== "none") {
      const a = this.actionTime;
      if (this.action === "interact") {
        const k = Math.sin(Math.min(1, a / 0.6) * Math.PI);
        armR = -1.4 * k;
        elbowR = -0.16 + 0.1 * k;
        headX = 0.3 * k;
      } else if (this.action === "emote") {
        // A wave: the arm up, the forearm rocking from the elbow.
        armR = -2.5;
        armRz = -0.35;
        elbowR = -0.45 + Math.sin(a * 13) * 0.45;
      } else {
        armL = -2.8;
        armR = -2.8;
        armLz = 0.35;
        armRz = -0.35;
        elbowL = -0.15;
        elbowR = -0.15;
        const hop = Math.abs(Math.sin(a * 7));
        bob += hop * 0.22;
        kneeL = kneeR = 0.6 * (1 - hop);
      }
    }

    // Head looks around a little while standing, or turns toward someone nearby.
    if (this.lookTarget && this.action === "none" && this.idleQuirk === 0) {
      headY = Math.max(-1.0, Math.min(1.0, this.lookTarget.yaw));
      headX = Math.max(-0.35, Math.min(0.35, this.lookTarget.pitch));
    } else if (!moving && this.action === "none" && this.idleQuirk === 0 && !reducedMotion) {
      headY = Math.sin(this.time * 0.37) * 0.25;
    }

    // Happy actions lift the brows.
    const browLift = this.action === "celebrate" || this.action === "emote" ? 0.018 : 0;
    for (const brow of this.brows) brow.position.y += (0.268 + browLift - brow.position.y) * damp(12, dt);

    // The backpack lags behind: a damped spring pushed by leaning, each footfall and jumps.
    if (this.trail) {
      const footfall = moving ? Math.abs(Math.sin(this.phase)) - Math.abs(Math.sin(this.lastPhase)) : 0;
      const target = this.lean * 0.9 + (motion.grounded ? 0 : Math.max(-0.25, Math.min(0.25, -motion.verticalSpeed * 0.04)));
      this.trailVelocity += ((target - this.trailSwing) * 120 - this.trailVelocity * 11) * dt + footfall * (motion.running ? 1.6 : 0.9);
      this.trailSwing += this.trailVelocity * dt;
      if (reducedMotion) this.trailSwing = target;
      this.trailSwing = Math.max(-0.3, Math.min(0.45, this.trailSwing));
      this.trail.rotation.x = this.trailSwing;
    }
    this.lastPhase = this.phase;

    // Landing: the knees take the squash.
    kneeL += this.squash * 2.4;
    kneeR += this.squash * 2.4;

    const k = damp(18, dt);
    this.legL.rotation.x += (legL - this.legL.rotation.x) * k;
    this.legR.rotation.x += (legR - this.legR.rotation.x) * k;
    this.kneeL.rotation.x += (kneeL - this.kneeL.rotation.x) * k;
    this.kneeR.rotation.x += (kneeR - this.kneeR.rotation.x) * k;
    this.elbowL.rotation.x += (elbowL - this.elbowL.rotation.x) * damp(14, dt);
    this.elbowR.rotation.x += (elbowR - this.elbowR.rotation.x) * damp(14, dt);
    this.armL.rotation.x += (armL - this.armL.rotation.x) * k;
    this.armR.rotation.x += (armR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * k;
    this.head.rotation.x += (headX - this.head.rotation.x) * damp(8, dt);
    // Shoulders turn against the hips while walking; the head stays facing ahead.
    // The torso is a child of the hips, so it undoes their turn and then some.
    const twist = moving ? -s * (0.12 + (motion.running ? 0.1 : 0.06) * Math.min(1, pace)) : 0;
    this.torso.rotation.y += (twist - this.torso.rotation.y) * k;
    const facing = this.torso.rotation.y + (moving ? s * 0.12 : 0);
    this.head.rotation.y += (headY - facing - this.head.rotation.y) * damp(moving ? 10 : 4, dt);
    this.head.rotation.z += (headZ - this.head.rotation.z) * damp(8, dt);

    // Lean into a run. A little sway while walking.
    const wantLean = moving ? (motion.running ? 0.22 : 0.08) * Math.min(1, pace) : 0;
    this.lean += (wantLean - this.lean) * damp(6, dt);
    this.torso.rotation.x = this.lean;
    this.torso.rotation.z = moving ? s * 0.035 : 0;
    this.hips.rotation.y = moving ? s * 0.12 : 0;
    this.hips.rotation.z = moving ? c * 0.025 : 0;

    // Squash on landing, springing back with a little overshoot.
    if (motion.sinceLanding < 0.4 && motion.landingSpeed > 2) {
      const t = motion.sinceLanding / 0.4;
      this.squash = Math.min(0.22, motion.landingSpeed * 0.022) * Math.sin(t * Math.PI) * (1 - t * 0.4);
    } else {
      this.squash *= 1 - damp(10, dt);
    }
    const stretch = motion.grounded ? 0 : Math.min(0.08, Math.abs(motion.verticalSpeed) * 0.01);
    this.body.scale.set(1 + this.squash * 0.6 - stretch * 0.4, 1 - this.squash + stretch, 1 + this.squash * 0.6 - stretch * 0.4);
    this.body.position.y = bob;

    // Blink.
    this.blink -= dt;
    const closed = this.blink < 0.12;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.16 : 1;
  }
}
