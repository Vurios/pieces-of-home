import { type BufferGeometry, Color, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import type { ToonLibrary } from "../../render/toon";
import { createColliderGroup } from "../../world/colliders";
import { createRandom } from "../../world/noise";
import { angleBetween, latLonToDir } from "../../world/sphere";
import { distanceToArc } from "../shapes";
import type { FrameInfo, World } from "../types";
import { type OrbitSpec, Orbiters } from "./orbiters";

/**
 * More to see round Dad's little Moon and Mars worlds (team feedback,
 * 2026-11-14: "add more things ... around the planet so that it doesn't look
 * boring"), added the same way on every world after it is built:
 *
 * - Things circling the planet: little model probes, and Mars's two small
 *   moons round the Mars worlds (see orbiters.ts).
 * - Low rounded hills on the skyline, on the Moon worlds that have no
 *   mountains of their own.
 * - A scatter of small stones, so the ground between the machines has some
 *   texture up close.
 *
 * Everything keeps well clear of the machines, the marked places and the
 * walked paths (Game Bible: roomy layouts, nothing on the paths). Models,
 * not to scale.
 */
export interface SurroundingsSpec {
  toon: ToonLibrary;
  /** Fewer stones on slower devices: the quality tier's particle share, 0 to 1. */
  particles: number;
  shadows: boolean;
  seed: number;
  orbits: readonly OrbitSpec[];
  stones: { count: number; colors: readonly string[] };
  hills?: { count: number; colors: readonly string[] };
  /** More directions to keep clear, besides the map's places and paths. */
  keep?: readonly Vector3[];
}

const UP = new Vector3(0, 1, 0);

/** A soft, wide hill: a dome pushed a little out of round, with flat painted faces. */
function hillGeometry(seed: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const wobble = 0.9 + 0.1 * Math.sin(Math.round(x * 50) * 0.7 + seed) * Math.cos(Math.round(z * 50) * 0.5 - seed);
    p.setXYZ(i, x * wobble, Math.max(-0.2, y) * wobble, z * wobble);
  }
  g.computeVertexNormals();
  return g;
}

/** A small flat-bottomed stone. */
function stoneGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(Math.round(x * 100) * 12.98 + Math.round(y * 100) * 78.2 + Math.round(z * 100) * 37.7) * 43758.5453;
    const k = 0.8 + (h - Math.floor(h)) * 0.35;
    p.setXYZ(i, x * k, Math.max(-0.25, y * 0.7) * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

export function addSurroundings(world: World, spec: SurroundingsSpec): void {
  const random = createRandom(spec.seed);
  const R = world.map?.radius ?? world.terrain.radiusAt(UP);
  const places = [...(world.map?.marks ?? []).map((m) => m.at), ...(spec.keep ?? [])];
  const paths = world.map?.paths ?? [];
  const craters = world.map?.craters ?? [];
  const pathDistance = (dir: Vector3): number => {
    let best = Infinity;
    for (const line of paths) for (let i = 1; i < line.length; i += 1) best = Math.min(best, distanceToArc(dir, line[i - 1]!, line[i]!) * R);
    return best;
  };
  const near = (dir: Vector3, room: number): boolean => places.some((k) => angleBetween(dir, k) * R < room);
  const extra: { dispose(): void }[] = [];

  // ---- Things circling the planet ----
  // The first one starts in the sky ahead of the arrival spot, a little to the side, and drifts across.
  const up = world.spawn.dir.clone().normalize();
  const ahead = world.spawn.forward.clone().addScaledVector(up, -world.spawn.forward.dot(up)).normalize();
  const side = new Vector3().crossVectors(ahead, up).normalize();
  // Far enough round the planet that it sits low in the sky, just above the skyline, where the camera looks.
  const round = 1.15;
  const skyAt = (lean: number): Vector3 =>
    up
      .clone()
      .multiplyScalar(Math.cos(round))
      .addScaledVector(ahead.clone().multiplyScalar(Math.cos(lean)).addScaledVector(side, Math.sin(lean)), Math.sin(round))
      .normalize();
  // Lean to whichever side keeps it off the Sun.
  const sun = world.sunToward?.clone().normalize();
  const [left, right] = [skyAt(-0.3), skyAt(0.3)];
  const startDir = sun && left.dot(sun) < right.dot(sun) ? left : right;
  const drift = startDir === left ? side.clone() : side.clone().negate();
  const orbits = spec.orbits.map((o, i) => (i === 0 ? { ...o, start: { dir: startDir, heading: drift } } : o));
  const orbiters = new Orbiters(spec.toon, orbits);
  world.root.add(orbiters.root);
  extra.push(orbiters);

  // ---- Low hills on the skyline ----
  const hillSpots: { dir: Vector3; room: number }[] = [];
  if (spec.hills) {
    const geometry = hillGeometry(spec.seed);
    extra.push(geometry);
    for (let tries = 0; hillSpots.length < spec.hills.count && tries < 600; tries += 1) {
      const dir = latLonToDir(random() * 150 - 75, random() * 360 - 180);
      const width = 2.6 + random() * 1.8;
      const room = width + 3.2;
      if (near(dir, room + 2.5) || pathDistance(dir) < room + 1) continue;
      if (craters.some((c) => angleBetween(dir, c.at) * R < c.radius + width + 1)) continue;
      if (hillSpots.some((h) => angleBetween(dir, h.dir) * R < h.room + room)) continue;
      if (Math.abs(world.terrain.radiusAt(dir) - R) > 0.35) continue;
      hillSpots.push({ dir, room });
      const height = width * (0.42 + random() * 0.2);
      const mesh = new Mesh(geometry, spec.toon.toon({ color: spec.hills.colors[hillSpots.length % spec.hills.colors.length]!, paint: 0.16, rim: 0.7 }));
      mesh.name = "hill";
      mesh.castShadow = spec.shadows;
      mesh.receiveShadow = true;
      const q = new Quaternion().setFromUnitVectors(UP, dir).multiply(new Quaternion().setFromAxisAngle(UP, random() * Math.PI * 2));
      const ground = world.terrain.radiusAt(dir);
      mesh.position.copy(dir).multiplyScalar(ground - height * 0.12);
      mesh.quaternion.copy(q);
      mesh.scale.set(width, height, width * (0.7 + random() * 0.3));
      world.root.add(mesh);
      const matrix = new Matrix4().compose(dir.clone().multiplyScalar(ground), q, new Vector3(1, 1, 1));
      world.colliders.push(createColliderGroup(matrix, [{ kind: "circle", x: 0, z: 0, radius: width * 0.85, height: height }]));
      world.cameraColliders?.push?.(createColliderGroup(matrix, [{ kind: "circle", x: 0, z: 0, radius: width * 0.85, height: height }]));
    }
  }

  // ---- Small stones, off the paths ----
  const count = Math.round(spec.stones.count * Math.max(0.4, spec.particles));
  if (count > 0) {
    const geometry = stoneGeometry();
    extra.push(geometry);
    const stones = new InstancedMesh(geometry, spec.toon.toon({ color: "#ffffff", paint: 0.1, rim: 0.5 }), count);
    stones.name = "stones";
    stones.receiveShadow = true;
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const color = new Color();
    let made = 0;
    for (let tries = 0; made < count && tries < count * 8; tries += 1) {
      const dir = latLonToDir(Math.asin(random() * 2 - 1) * (180 / Math.PI) * 0.97, random() * 360 - 180);
      if (near(dir, 1.6) || pathDistance(dir) < 0.75) continue;
      if (hillSpots.some((h) => angleBetween(dir, h.dir) * R < h.room - 2.6)) continue;
      const size = 0.06 + random() ** 2 * 0.16;
      q.setFromUnitVectors(UP, dir).multiply(new Quaternion().setFromAxisAngle(UP, random() * Math.PI * 2));
      s.set(size * (0.8 + random() * 0.5), size, size * (0.8 + random() * 0.5));
      m.compose(dir.clone().multiplyScalar(world.terrain.radiusAt(dir) - size * 0.15), q, s);
      stones.setMatrixAt(made, m);
      stones.setColorAt(made, color.set(spec.stones.colors[Math.floor(random() * spec.stones.colors.length)]!));
      made += 1;
    }
    stones.count = made;
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
    world.root.add(stones);
  }

  // ---- Keep them moving, and clean up with the world ----
  const update = world.update.bind(world);
  world.update = (dt: number, frame: FrameInfo): void => {
    update(dt, frame);
    orbiters.update(dt, frame.reducedMotion);
  };
  const dispose = world.dispose.bind(world);
  world.dispose = (): void => {
    for (const e of extra) e.dispose();
    dispose();
  };
}
