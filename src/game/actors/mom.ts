import { type BufferGeometry, Group, type Object3D, Vector3 } from "three";
import type { ToonLibrary } from "../render/toon";
import { damp } from "../world/sphere";
import { type HairStyle, hairShell } from "./hair";
import { Assembly, box, capsule, cylinder, limb, sphere, torus } from "./parts";

/**
 * Mom, the safe adult (Game Bible 5.5). She sits on the porch bench with a mug
 * while Remi explores: calm, kind, always there when you look back.
 *
 * Same toy-like build as the kids, with adult proportions: a smaller head, a
 * longer body. She sips her tea now and then, turns to watch the player when
 * they come near, and waves once each time they walk up.
 *
 * Built seated. The root sits on the bench seat, facing +Z.
 */
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Mom's hair: neat locks swept from a side parting toward the back, where the bun sits. */
const MOM_HAIR: HairStyle = {
  center: [0, 0.158, -0.012],
  radius: [0.178, 0.188, 0.176],
  locks: 18,
  reach: (a) => {
    const k = Math.abs(a) / (Math.PI / 2);
    return k < 1 ? 0.95 + 0.6 * smooth(0, 1, k) : 1.55 + 0.38 * smooth(1, 2, k);
  },
  tipDepth: 0.12,
  tipSharp: 1.2,
  groove: 0.04,
  sweep: -0.55,
  flare: 0,
  thickness: 0.08,
  messy: 0.1,
  tilt: [-0.04, 0.26],
  sheen: 0.15,
  seed: 71,
};
let momHairGeometry: BufferGeometry | null = null;
const momHair = (): BufferGeometry => (momHairGeometry ??= hairShell(MOM_HAIR));

const P = {
  skin: "#B98263",
  hair: "#2F2420",
  cardigan: "#6F8F72",
  cardiganDark: "#557358",
  top: "#F4ECDD",
  trousers: "#4A4F66",
  shoes: "#6B3F2A",
  mug: "#E9DCCB",
  mugBand: "#C0573E",
  glasses: "#3A2F2A",
  ink: "#2B2622",
};

function joint(name: string, x = 0, y = 0, z = 0): Group {
  const group = new Group();
  group.name = name;
  group.position.set(x, y, z);
  return group;
}

const scratch = new Vector3();

export class Mom {
  readonly root = new Group();
  private torso = joint("torso", 0, 0.02, -0.04);
  private head: Group;
  private armL: Group;
  private armR: Group;
  private foreL: Group;
  private foreR: Group;
  private eyes: Group[] = [];
  private assembly: Assembly;
  private mug: Group;
  private time = Math.random() * 5;
  private blink = 2;
  private sip = 6;
  private wave = 0;
  private near = false;
  private look = { yaw: 0, pitch: 0 };

  constructor(toon: ToonLibrary) {
    this.root.name = "mom";
    this.assembly = new Assembly(toon.toon({ vertexColors: true, objectSpace: true, paint: 0.1 }));
    this.root.add(this.torso);

    // Seated legs: thighs forward along the seat, a knee, shins down to the porch floor.
    for (const side of [-1, 1]) {
      const thigh = joint("thigh", side * 0.1, 0.04, 0);
      this.root.add(thigh);
      limb(this.assembly, thigh, [0, 0, -0.02], [0, 0, 0.29], 0.08, P.trousers);
      const shin = joint("shin", 0, 0, 0.29);
      thigh.add(shin);
      limb(this.assembly, shin, [0, 0, 0], [0, -0.24, 0.01], 0.07, P.trousers);
      // A turned-up hem, then a flat loafer with a little heel.
      this.part(shin, cylinder(14), P.trousers, [0, -0.25, 0.01], [0.078, 0.03, 0.078]);
      this.part(shin, sphere("mid"), P.shoes, [0, -0.295, 0.045], [0.066, 0.042, 0.115]);
      this.part(shin, box(0.02), "#4A2C1F", [0, -0.33, 0.045], [0.125, 0.022, 0.235]);
      this.part(shin, box(0.02), "#4A2C1F", [0, -0.315, -0.035], [0.1, 0.03, 0.06]);
    }

    // Body: a cream top under an open sage cardigan, with soft sloped shoulders.
    this.part(this.torso, capsule(1.4), P.cardigan, [0, 0.27, 0], [0.155, 0.13, 0.125]);
    this.part(this.torso, capsule(1.2), P.top, [0, 0.3, 0.06], [0.07, 0.1, 0.07]);
    for (const side of [-1, 1]) {
      this.part(this.torso, box(0.02), P.cardigan, [side * 0.072, 0.29, 0.118], [0.05, 0.34, 0.035], [0, 0, side * 0.12]);
      limb(this.assembly, this.torso, [side * 0.05, 0.47, 0], [side * 0.165, 0.45, 0], 0.062, P.cardigan);
    }
    // A collar folded open at the neck.
    for (const side of [-1, 1]) this.part(this.torso, box(0.02), P.cardiganDark, [side * 0.06, 0.5, 0.075], [0.07, 0.02, 0.06], [0.3, 0, side * -0.5]);
    // A pocket with a folded letter peeking out: she has been reading Dad's notes too.
    this.part(this.torso, box(0.02), P.cardiganDark, [-0.1, 0.12, 0.12], [0.08, 0.07, 0.03]);
    this.part(this.torso, box(0.005), "#F4ECDD", [-0.1, 0.17, 0.125], [0.06, 0.04, 0.01], [0, 0, 0.15]);
    this.part(this.torso, cylinder(16), P.cardiganDark, [0, 0.04, 0], [0.17, 0.06, 0.14]);

    // Arms: shoulder joint, then an elbow joint so she can hold the mug in both hands.
    this.armL = joint("armL", -0.18, 0.47, 0);
    this.armR = joint("armR", 0.18, 0.47, 0);
    this.foreL = joint("foreL", 0, -0.2, 0);
    this.foreR = joint("foreR", 0, -0.2, 0);
    for (const [arm, fore] of [
      [this.armL, this.foreL],
      [this.armR, this.foreR],
    ] as const) {
      this.torso.add(arm);
      limb(this.assembly, arm, [0, 0.01, 0], [0, -0.2, 0], 0.056, P.cardigan);
      arm.add(fore);
      limb(this.assembly, fore, [0, 0, 0], [0, -0.13, 0], 0.05, P.cardigan);
      this.part(fore, cylinder(12), P.cardiganDark, [0, -0.145, 0], [0.054, 0.03, 0.054]);
      // A hand with a thumb, slightly flat like a real one.
      this.part(fore, sphere("mid"), P.skin, [0, -0.19, 0.004], [0.04, 0.05, 0.03]);
      this.part(fore, sphere("low"), P.skin, [arm === this.armL ? 0.03 : -0.03, -0.175, 0.022], [0.016, 0.024, 0.016]);
    }
    // The mug sits in the right hand.
    const mug = joint("mug", -0.03, -0.22, 0.03);
    this.mug = mug;
    this.foreR.add(mug);
    this.part(mug, cylinder(16), P.mug, [0, 0, 0], [0.05, 0.11, 0.05]);
    this.part(mug, cylinder(16), P.mugBand, [0, 0.01, 0], [0.052, 0.025, 0.052]);
    this.part(mug, cylinder(16), "#6B3F2A", [0, 0.052, 0], [0.042, 0.005, 0.042]);
    this.part(mug, torus(0.25), P.mug, [0.055, 0, 0], [0.03, 0.035, 0.03]);

    // Head: smaller than the kids', with a low bun, a soft fringe and round glasses.
    this.head = joint("head", 0, 0.58, 0.01);
    this.torso.add(this.head);
    this.part(this.head, cylinder(12), P.skin, [0, 0.0, 0], [0.05, 0.08, 0.05]);
    this.part(this.head, sphere("high"), P.skin, [0, 0.15, 0], [0.165, 0.175, 0.16]);
    for (const side of [-1, 1]) this.part(this.head, sphere("low"), P.skin, [side * 0.163, 0.14, 0], [0.03, 0.042, 0.026]);
    // Hair swept back from a side parting into a low bun, in one sculpted piece (see hair.ts).
    this.part(this.head, momHair(), P.hair, [0, 0, 0], 1);
    // The bun, wrapped round with a band.
    this.part(this.head, sphere("high"), P.hair, [0, 0.14, -0.175], [0.085, 0.08, 0.075]);
    this.part(this.head, torus(0.35), P.mugBand, [0, 0.16, -0.12], [0.05, 0.05, 0.05], [0.3, 0, 0]);
    for (const side of [-1, 1]) {
      const eye = joint("eye", side * 0.06, 0.15, 0.148);
      this.head.add(eye);
      this.part(eye, sphere("mid"), P.ink, [0, 0, 0], [0.019, 0.027, 0.012]);
      this.part(eye, sphere("tiny"), "#FFF8EC", [-0.0057, 0.0095, 0.009], [0.006, 0.006, 0.0048]);
      this.eyes.push(eye);
      this.part(this.head, torus(0.12), P.glasses, [side * 0.06, 0.15, 0.162], 0.042);
      this.part(this.head, sphere("low"), "#D98A78", [side * 0.1, 0.1, 0.13], [0.028, 0.016, 0.012]);
      this.part(this.head, capsule(0.6), P.hair, [side * 0.062, 0.2, 0.152], [0.008, 0.02, 0.008], [0, 0, Math.PI / 2 - side * 0.12]);
      this.part(this.head, sphere("low"), "#D9A441", [side * 0.165, 0.1, 0.01], 0.012);
    }
    this.part(this.head, box(0.005), P.glasses, [0, 0.155, 0.168], [0.04, 0.008, 0.008]);
    this.part(this.head, sphere("low"), P.skin, [0, 0.12, 0.162], [0.016, 0.016, 0.014]);
    this.part(this.head, torus(0.3, Math.PI * 0.7), P.ink, [0, 0.085, 0.153], 0.02, [0, 0, Math.PI * 1.15]);
    this.assembly.flush();
  }

  private part(parent: Object3D, geometry: BufferGeometry, color: string, position: [number, number, number], scale: number | [number, number, number], rotation: [number, number, number] = [0, 0, 0]): void {
    this.assembly.add(parent, geometry, color, position, scale, rotation);
  }

  /** `player` is the player's head in world space. */
  update(dt: number, player: Vector3, reducedMotion: boolean): void {
    this.time += dt;
    this.root.updateMatrixWorld();
    const p = scratch.copy(player);
    this.root.worldToLocal(p);
    p.y -= 0.7;
    const distance = Math.hypot(p.x, p.z);
    const near = distance < 6.5 && p.z > -0.5;
    // One wave each time the player walks up.
    if (near && !this.near && !reducedMotion) this.wave = 1.6;
    this.near = near;

    if (near) {
      this.look.yaw = Math.max(-0.9, Math.min(0.9, Math.atan2(p.x, p.z)));
      this.look.pitch = Math.max(-0.3, Math.min(0.35, -Math.atan2(p.y, Math.max(0.5, distance))));
    } else {
      this.look.yaw = reducedMotion ? 0.35 : 0.35 + Math.sin(this.time * 0.21) * 0.25;
      this.look.pitch = 0.08;
    }
    const k = damp(4, dt);
    this.head.rotation.y += (this.look.yaw - this.head.rotation.y) * k;
    this.head.rotation.x += (this.look.pitch - this.head.rotation.x) * k;
    this.head.rotation.z = reducedMotion ? 0 : Math.sin(this.time * 0.5) * 0.04;

    // A sip of tea every so often: the mug comes up, the head dips to meet it.
    this.sip -= dt;
    if (this.sip < -1.6) this.sip = 7 + Math.random() * 5;
    const sipping = this.sip < 0 && this.wave <= 0 && !reducedMotion ? Math.sin((-this.sip / 1.6) * Math.PI) : 0;

    this.wave = Math.max(0, this.wave - dt);
    const waving = this.wave > 0 ? Math.sin(Math.min(1, (1.6 - this.wave) * 3) * Math.PI * 0.5) * Math.min(1, this.wave * 3) : 0;

    // Resting pose: both hands hold the mug in the lap.
    const a = damp(10, dt);
    const set = (g: Group, x: number, z: number): void => {
      g.rotation.x += (x - g.rotation.x) * a;
      g.rotation.z += (z - g.rotation.z) * a;
    };
    set(this.armR, -0.35 - sipping * 0.55, 0.12);
    set(this.foreR, -1.05 - sipping * 0.85, 0.35);
    set(this.armL, -0.35 - waving * 2.3, -0.12 - waving * 0.3);
    set(this.foreL, -1.05 + waving * 0.9 + (waving > 0 ? Math.sin(this.time * 12) * 0.25 * waving : 0), -0.35);
    this.head.rotation.x += sipping * 0.2 * a;
    // Keep the tea level: undo the arm's tilt at the hand.
    this.mug.rotation.x = -(this.armR.rotation.x + this.foreR.rotation.x + this.torso.rotation.x);
    this.mug.rotation.z = -(this.armR.rotation.z + this.foreR.rotation.z);

    const breathe = reducedMotion ? 0 : Math.sin(this.time * 1.7) * 0.008;
    this.torso.position.y = 0.02 + breathe;
    this.torso.rotation.x = 0.04 + sipping * 0.05;

    this.blink -= dt;
    if (this.blink < 0) this.blink = 3 + Math.random() * 3;
    const closed = this.blink < 0.12;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.15 : 1;
  }
}
