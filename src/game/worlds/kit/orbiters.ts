import { BoxGeometry, type BufferGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Matrix4, Mesh, Object3D, Vector3 } from "three";
import type { ToonLibrary } from "../../render/toon";
import { dish } from "../shapes";

/**
 * Things that circle Dad's little worlds, so there is more to see around the
 * planet than the ground: tiny model probes with gold foil and blue solar
 * wings, and, round the Mars worlds, two lumpy little moons. They hang on
 * slow tilted orbits well above the ground, far from the camera's path, and
 * only look: nothing touches them.
 *
 * Like everything in the dioramas they are a toy maker's models, not to scale
 * and not on real orbits.
 */
export interface OrbitSpec {
  kind: "probe" | "moonlet";
  /** Distance from the planet's center. */
  distance: number;
  size: number;
  /** Tilt of the orbit from the equator, in degrees. */
  tilt: number;
  /** Turn of the orbit round the poles, in degrees. */
  node: number;
  /** Seconds for one trip round. */
  period: number;
  /** Where on the orbit it starts, 0 to 1. */
  phase: number;
  /** Moonlets: rock colour and how long and flat the potato is. */
  color?: string;
  stretch?: [number, number, number];
  /** Probes: the colour of the foil body. */
  foil?: string;
  /**
   * Start here instead (a unit direction from the planet's center) and travel
   * along `heading`: used to put one thing in the sky in front of the
   * arrival spot, so the first look round already shows it.
   */
  start?: { dir: Vector3; heading: Vector3 };
}

interface Item {
  spinner: Object3D;
  body: Object3D;
  spec: OrbitSpec;
  tumble: Vector3;
}

const DEG = Math.PI / 180;

/** A lumpy little moon: an icosahedron pushed in and out, with flat faces like a carved stone. */
function lumpy(seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  const p = g.getAttribute("position");
  const bump = (x: number, y: number, z: number): number => {
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 7.31) * 43758.5453;
    const big = Math.sin(x * 2.1 + seed) * Math.cos(y * 1.7 - seed * 0.5) * 0.12;
    return 0.86 + (h - Math.floor(h)) * 0.16 + big;
  };
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = bump(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export class Orbiters {
  readonly root = new Group();
  private readonly items: Item[] = [];
  private readonly geometries: BufferGeometry[] = [];

  constructor(toon: ToonLibrary, specs: readonly OrbitSpec[]) {
    this.root.name = "orbiters";
    specs.forEach((spec, i) => {
      // The orbit's plane: turned round the poles, then tilted off the equator.
      const plane = new Group();
      const tilted = new Group();
      const spinner = new Group();
      if (spec.start) {
        // Local X to the start, local Y to the orbit's axis: turning about Y then carries it along `heading`.
        const u = spec.start.dir.clone().normalize();
        const t = spec.start.heading.clone().addScaledVector(u, -spec.start.heading.dot(u)).normalize();
        const n = new Vector3().crossVectors(u, t).normalize();
        plane.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(u, n, new Vector3().crossVectors(u, n)));
      } else {
        plane.rotation.set(0, spec.node * DEG, 0);
        tilted.rotation.set(spec.tilt * DEG, 0, 0);
        spinner.rotation.y = spec.phase * Math.PI * 2;
      }
      plane.add(tilted);
      tilted.add(spinner);
      const body = spec.kind === "probe" ? this.probe(toon, spec) : this.moonlet(toon, spec, i);
      body.position.set(spec.distance, 0, 0);
      spinner.add(body);
      this.root.add(plane);
      this.items.push({ spinner, body, spec, tumble: new Vector3(0.05 + (i % 3) * 0.03, 0.08, 0.03 * ((i % 2) * 2 - 1)) });
    });
  }

  private keep<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /** A little probe: a foil box, two blue solar wings on a strut, and a white dish looking down at the planet. */
  private probe(toon: ToonLibrary, spec: OrbitSpec): Object3D {
    const s = spec.size;
    const probe = new Group();
    probe.name = "probe";
    const look = { paint: 0.08, rim: 0.7, nearFade: false, fog: false } as const;
    const foil = new Mesh(this.keep(new BoxGeometry(0.62 * s, 0.5 * s, 0.5 * s)), toon.toon({ color: spec.foil ?? "#D9A441", ...look }));
    probe.add(foil);
    const band = new Mesh(this.keep(new BoxGeometry(0.64 * s, 0.1 * s, 0.52 * s)), toon.toon({ color: "#F2E6CF", ...look }));
    band.position.y = 0.12 * s;
    probe.add(band);
    const strut = new Mesh(this.keep(new CylinderGeometry(0.035 * s, 0.035 * s, 2.9 * s, 6)), toon.toon({ color: "#8C8A86", ...look }));
    strut.rotation.x = Math.PI / 2;
    probe.add(strut);
    const wing = this.keep(new BoxGeometry(0.62 * s, 0.035 * s, 1.0 * s));
    const blue = toon.toon({ color: "#2F4F8F", ...look });
    for (const side of [-1, 1]) {
      const w = new Mesh(wing, blue);
      w.position.z = side * 0.98 * s;
      probe.add(w);
    }
    // The dish points at the planet (the planet's center is toward -X).
    const d = new Mesh(dish(0.32 * s, 0.1 * s, 0.03 * s), toon.toon({ color: "#F6F1E6", side: DoubleSide, ...look }));
    d.rotation.z = Math.PI / 2;
    d.position.x = -0.34 * s;
    probe.add(d);
    const mast = new Mesh(this.keep(new CylinderGeometry(0.02 * s, 0.02 * s, 0.5 * s, 5)), toon.toon({ color: "#8C8A86", ...look }));
    mast.position.y = 0.45 * s;
    probe.add(mast);
    return probe;
  }

  private moonlet(toon: ToonLibrary, spec: OrbitSpec, seed: number): Object3D {
    const [sx, sy, sz] = spec.stretch ?? [1, 0.85, 0.8];
    const rock = new Mesh(this.keep(lumpy(seed + 3)), toon.toon({ color: spec.color ?? "#6E5A4E", paint: 0.14, rim: 0.5, nearFade: false, fog: false }));
    rock.name = "moonlet";
    rock.scale.set(spec.size * sx, spec.size * sy, spec.size * sz);
    return rock;
  }

  update(dt: number, reducedMotion: boolean): void {
    const pace = reducedMotion ? 0.25 : 1;
    for (const item of this.items) {
      item.spinner.rotation.y += ((Math.PI * 2) / item.spec.period) * dt * pace;
      if (item.spec.kind === "moonlet") {
        item.body.rotation.x += item.tumble.x * dt * pace;
        item.body.rotation.y += item.tumble.y * dt * pace;
      } else {
        // Probes keep their wings level and roll a little, like a model on a string.
        item.body.rotation.x = Math.sin(item.spinner.rotation.y * 3) * 0.12;
      }
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
  }
}

/** The usual company for a little Moon world: two probes on different orbits. */
export function moonOrbiters(radius: number, seed: number): OrbitSpec[] {
  return [
    { kind: "probe", distance: radius * 1.75, size: 1.5, tilt: 28 + (seed % 3) * 6, node: seed * 47, period: 80, phase: (seed * 0.27) % 1 },
    { kind: "probe", distance: radius * 2.2, size: 1.15, tilt: -64, node: seed * 47 + 110, period: 120, phase: (seed * 0.61 + 0.5) % 1, foil: "#C7C3BB" },
  ];
}

/** Round a little Mars world: its two small moons, the bigger one nearer, and a probe. */
export function marsOrbiters(radius: number, seed: number): OrbitSpec[] {
  return [
    { kind: "moonlet", distance: radius * 2.0, size: 1.6, tilt: 14, node: seed * 40, period: 110, phase: (seed * 0.31) % 1, color: "#8A7062", stretch: [1.3, 0.92, 0.82] },
    { kind: "moonlet", distance: radius * 2.65, size: 1.0, tilt: 24, node: seed * 40 + 150, period: 180, phase: (seed * 0.47 + 0.3) % 1, color: "#A08A7A", stretch: [1.1, 0.86, 0.92] },
    { kind: "probe", distance: radius * 1.75, size: 1.4, tilt: -52, node: seed * 40 + 70, period: 90, phase: (seed * 0.13 + 0.6) % 1 },
  ];
}
