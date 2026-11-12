import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh, type Object3D, ShaderMaterial, Vector3 } from "three";
import { createParcel } from "../../actors/props";
import { box, cylinder, sphere, torus } from "../../actors/parts";
import type { GameState } from "../../core/state";
import type { Batcher } from "../../render/kit";
import type { ToonLibrary } from "../../render/toon";
import type { Shape } from "../../world/colliders";
import { headingToTangent, latLonToDir, surfaceMatrix } from "../../world/sphere";
import type { Terrain } from "../../world/terrain";
import { type ChapterDef, arrivedFlag, chapterStep, partId } from "../../../content/chapters";
import type { WorldContext } from "../types";

/**
 * Shared pieces for Dad's little worlds (the chapter dioramas): sites on a
 * planet of any size, Dad's tag on its stake, the Looking Lamp's beam that
 * takes you home, the parcel with Milo's next part, and the letter drop-offs.
 * Each chapter world builds its own ground and machines, then calls these.
 */
export interface Site {
  dir: Vector3;
  forward: Vector3;
  origin: Vector3;
  matrix: Matrix4;
}

/** A site standing on the terrain, facing `heading` degrees from north. */
export function siteOn(terrain: Terrain, lat: number, lon: number, heading: number, sink = 0.03): Site {
  const dir = latLonToDir(lat, lon);
  const forward = headingToTangent(dir, heading);
  const origin = dir.clone().multiplyScalar(terrain.radiusAt(dir) - sink);
  return { dir, forward, origin, matrix: surfaceMatrix(origin, dir, forward) };
}

/** A point in a site's frame, as a world position. */
export function at(s: Site, x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z).applyMatrix4(s.matrix);
}

/** The heading (degrees from north) to look from one direction toward another. */
export function headingToward(from: Vector3, to: Vector3): number {
  const north = headingToTangent(from, 0);
  const east = headingToTangent(from, 90);
  const d = to.clone().sub(from);
  return (Math.atan2(d.dot(east), d.dot(north)) * 180) / Math.PI;
}

const C = {
  paper: "#F4ECDD",
  ink: "#2B2622",
  wood: "#8A5A3A",
  woodDark: "#5E3B26",
  brass: "#C9A04A",
  twine: "#E9DCC0",
};

/** Dad's tag on a little wooden stake: "Model, not to scale." Returns its collider. */
export function buildTag(b: Batcher, s: Site): Shape[] {
  const m = s.matrix;
  b.place(cylinder(6), C.woodDark, [0, 0.45, 0], [0, 0, 0.04], [0.035, 0.9, 0.035], m);
  b.place(sphere("low"), C.woodDark, [0, 0.9, 0], [0, 0, 0], 0.045, m);
  // The tag hangs from a loop of twine, tilted the way a paper tag does.
  b.place(torus(0.2), C.twine, [0, 0.86, 0.04], [0, 0, 0], 0.04, m);
  b.place(box(0.01), C.paper, [0.02, 0.7, 0.06], [0.08, 0, -0.1], [0.36, 0.22, 0.012], m);
  b.place(cylinder(10), "#B9A88A", [-0.13, 0.78, 0.068], [Math.PI / 2, 0, 0], [0.018, 0.004, 0.018], m);
  for (let i = 0; i < 3; i += 1) b.place(box(0.002), C.ink, [0.03 - i * 0.01, 0.74 - i * 0.05, 0.068], [0.08, 0, -0.1], [0.24 - i * 0.05, 0.012, 0.003], m);
  return [{ kind: "circle", x: 0, z: 0, radius: 0.12, height: 1 }];
}

/** The beam of the Looking Lamp, shining down on the landing circle. Step into it to go home. */
export class LampBeam {
  readonly root = new Group();
  private glow: Mesh<CylinderGeometry, ShaderMaterial>;
  private ring: Mesh;

  constructor(s: Site, toon: ToonLibrary, b: Batcher) {
    const m = s.matrix;
    // A ring of dotted paper chips on the ground, like a chalk circle.
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2;
      b.place(box(0.004), "#E8D9B8", [Math.cos(a) * 1.05, 0.02, Math.sin(a) * 1.05], [0, -a, 0], [0.16, 0.02, 0.06], m);
    }
    const geometry = new CylinderGeometry(0.7, 1.05, 7, 32, 1, true);
    geometry.translate(0, 3.5, 0);
    this.glow = new Mesh(
      geometry,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vH;
          varying vec3 vN;
          varying vec3 vV;
          varying float vDist;
          void main() {
            vH = position.y / 7.0;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            vDist = length(mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying float vH;
          varying vec3 vN;
          varying vec3 vV;
          varying float vDist;
          void main() {
            float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
            float fade = pow(1.0 - vH, 1.6) * smoothstep(0.0, 0.12, vH);
            float shimmer = 0.85 + 0.15 * sin(vH * 24.0 - uTime * 2.0);
            // Close to the lens the beam fades away, so it never fogs the view.
            float a = (0.035 + 0.16 * edge * edge) * fade * shimmer * smoothstep(3.5, 8.0, vDist);
            gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * a, a);
          }
        `,
      }),
    );
    this.glow.renderOrder = 9;
    this.root.add(this.glow);
    this.ring = new Mesh(torus(0.022), toon.glow("#FFD08A"));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.scale.setScalar(1.05);
    this.ring.position.y = 0.05;
    this.root.add(this.ring);
    this.root.matrixAutoUpdate = false;
    this.root.matrix.copy(m);
    this.root.matrixWorldNeedsUpdate = true;
    this.glow.matrixAutoUpdate = true;
  }

  update(time: number, reducedMotion: boolean): void {
    this.glow.material.uniforms["uTime"]!.value = reducedMotion ? 0 : time;
    this.ring.scale.setScalar(1.05 + (reducedMotion ? 0 : Math.sin(time * 2) * 0.03));
  }

  dispose(): void {
    this.glow.geometry.dispose();
    this.glow.material.dispose();
  }
}

/** A world's letter targets and the parcel for Milo, with every interaction the chapter needs. */
export interface ChapterSpots {
  /** Letter target anchor ids to where a player stands to deliver. */
  targets: Record<string, Vector3>;
  /** The Looking Lamp's landing circle, to go home. */
  home: Vector3;
  /** Dad's tag. */
  tag: Vector3;
  /** Where the parcel for Milo waits. */
  parcel: Site;
}

export interface ChapterRuntime {
  objective(activity: () => Vector3 | null): Vector3 | null;
  update(dt: number, time: number): void;
  objects: Object3D[];
  debug: Record<string, () => unknown>;
}

/**
 * The letters, the tag, the parcel and the way home. The story director
 * plays the words; this only changes the save and says what happened.
 */
export function chapterRuntime(ctx: WorldContext, chapter: ChapterDef, spots: ChapterSpots): ChapterRuntime {
  const { store, bus, interactions, toon } = ctx;
  const letters = chapter.letters;
  const part = partId(chapter);
  const state = (): Readonly<GameState> => store.value;

  for (const letter of letters) {
    const target = spots.targets[letter.to];
    if (!target) continue;
    interactions.add({
      id: `letter-${letter.to}`,
      position: target,
      radius: 1.9,
      kind: "press",
      label: () => (state().carrying === letter.id ? letter.prompt : null),
      onDone: () => {
        store.update((s) => {
          s.carrying = null;
          if (!s.delivered.includes(letter.id)) s.delivered.push(letter.id);
        });
        bus.emit("letter:delivered", { letter: letter.id, to: letter.to });
      },
    });
  }

  interactions.add({
    id: "tag",
    position: spots.tag,
    radius: 1.6,
    kind: "press",
    label: () => "Flip Dad's tag",
    onDone: () => bus.emit("notebook:open", { spread: chapter.spread }),
  });

  interactions.add({
    id: "lamp-home",
    position: spots.home,
    radius: 1.5,
    kind: "press",
    label: () => (state().carrying === part ? "Take the part home" : "Go back to the workshop"),
    onDone: () => bus.emit("travel", { to: "home", entry: "bench" }),
  });

  // Dad's parcel with Milo's next part, tied with twine, waiting by the tag.
  const parcel = createParcel(toon);
  parcel.scale.setScalar(1.5);
  const parcelSpot = at(spots.parcel, 0, 0.14, 0);
  parcel.position.copy(parcelSpot);
  parcel.quaternion.setFromRotationMatrix(spots.parcel.matrix);
  interactions.add({
    id: "parcel",
    position: parcelSpot,
    radius: 1.5,
    kind: "press",
    label: () => (chapterStep(chapter, state()).kind === "part-take" ? "Take Milo's part" : null),
    onDone: () => {
      store.update((s) => {
        s.carrying = part;
      });
      bus.emit("letter:taken", { letter: part });
    },
  });

  // Coming back to a world part way through: hand Remi the next letter again.
  const s0 = state();
  if (s0.flags.includes(arrivedFlag(chapter)) && s0.carrying === null) {
    const next = letters.find((l) => !s0.delivered.includes(l.id));
    if (next) store.update((s) => void (s.carrying = next.id));
  }

  return {
    objects: [parcel],
    objective(activity) {
      const step = chapterStep(chapter, state());
      switch (step.kind) {
        case "letter":
          return spots.targets[step.letter.to] ?? null;
        case "activity":
          return activity();
        case "part-take":
          return parcelSpot;
        case "part-home":
          return spots.home;
        default:
          return null;
      }
    },
    update(_dt, time) {
      const kind = chapterStep(chapter, state()).kind;
      // The parcel shows from the start (a little mystery), until it is picked up.
      parcel.visible = kind !== "part-home" && kind !== "part-give" && kind !== "done";
      parcel.position.copy(parcelSpot).addScaledVector(spots.parcel.dir, kind === "part-take" ? 0.04 + Math.sin(time * 3) * 0.04 : 0);
    },
    debug: {
      deliver: () => {
        const next = letters.find((l) => !state().delivered.includes(l.id));
        if (!next) return false;
        store.update((s) => {
          s.carrying = null;
          if (!s.flags.includes(arrivedFlag(chapter))) s.flags.push(arrivedFlag(chapter));
          s.delivered.push(next.id);
        });
        bus.emit("letter:delivered", { letter: next.id, to: next.to });
        return next.id;
      },
    },
  };
}
