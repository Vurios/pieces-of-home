import { BufferAttribute, BufferGeometry, type ColorRepresentation, Points, type ShaderMaterial, Vector3 } from "three";
import { createMaterial } from "../render/particles";

/**
 * A dotted light beam along a path, like the dashed line in a diagram. The
 * dots march from the start to the end, so you can see which way the light
 * goes. One draw call. A pulse is a bright blob that rides the same kind of
 * path at a set speed and calls back when it arrives.
 */
export class DottedBeam {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private positions: Float32Array;
  private alphas: Float32Array;
  private path: Vector3[] = [];
  private lengths: number[] = [];
  private total = 0;
  private offset = 0;
  private fade = 0;
  private target = 0;

  constructor(
    private max: number,
    color: ColorRepresentation,
    private spacing = 0.32,
    private speed = 3.2,
    size = 0.09,
  ) {
    this.positions = new Float32Array(max * 3);
    this.alphas = new Float32Array(max);
    const sizes = new Float32Array(max).fill(size);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial(color, true, 0.42));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  /** The path the light follows, as a list of points. */
  setPath(points: readonly Vector3[]): void {
    this.path = points.map((p) => p.clone());
    this.lengths = [];
    this.total = 0;
    for (let i = 1; i < this.path.length; i += 1) {
      const l = this.path[i]!.distanceTo(this.path[i - 1]!);
      this.lengths.push(l);
      this.total += l;
    }
  }

  /** Shows or hides the beam with a short fade. */
  show(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  setScale(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  /** The point `distance` along the path. */
  at(distance: number, out: Vector3): Vector3 {
    let d = Math.max(0, distance);
    for (let i = 0; i < this.lengths.length; i += 1) {
      const l = this.lengths[i]!;
      if (d <= l || i === this.lengths.length - 1) return out.copy(this.path[i]!).lerp(this.path[i + 1]!, Math.min(1, d / Math.max(1e-6, l)));
      d -= l;
    }
    return out.copy(this.path[0] ?? out);
  }

  get length(): number {
    return this.total;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.fade += (this.target - this.fade) * Math.min(1, dt * 4);
    if (!reducedMotion) this.offset = (this.offset + dt * this.speed) % this.spacing;
    const count = Math.min(this.max, Math.floor(this.total / this.spacing));
    const p = scratch;
    for (let i = 0; i < this.max; i += 1) {
      if (i < count) {
        const d = i * this.spacing + this.offset;
        this.at(d, p);
        this.positions[i * 3] = p.x;
        this.positions[i * 3 + 1] = p.y;
        this.positions[i * 3 + 2] = p.z;
        // Dots near the very ends fade, so the beam never starts with a hard edge.
        const end = Math.min(d, this.total - d);
        this.alphas[i] = this.fade * Math.min(1, end / 1.2) * 0.85;
      } else this.alphas[i] = 0;
    }
    this.points.visible = this.fade > 0.01;
    this.points.geometry.attributes["position"]!.needsUpdate = true;
    this.points.geometry.attributes["aAlpha"]!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/** A bright pulse of light that travels along a path at a set speed. */
export class Pulse {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private beam: DottedBeam;
  private distance = -1;
  private speed = 1;
  private done: (() => void) | null = null;
  private trail = 6;
  private positions: Float32Array;
  private alphas: Float32Array;

  constructor(color: ColorRepresentation) {
    this.beam = new DottedBeam(2, color);
    this.beam.show(true);
    this.positions = new Float32Array(this.trail * 3);
    this.alphas = new Float32Array(this.trail);
    const sizes = new Float32Array(this.trail).map((_, i) => 0.55 - i * 0.07);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial(color, true, 0.5));
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.points.visible = false;
  }

  /** Sends the pulse along `path`, taking `seconds` from end to end. */
  fire(path: readonly Vector3[], seconds: number, onArrive: () => void): void {
    this.beam.setPath(path);
    this.distance = 0;
    this.speed = this.beam.length / Math.max(0.05, seconds);
    this.done = onArrive;
    this.points.visible = true;
  }

  get flying(): boolean {
    return this.distance >= 0;
  }

  setScale(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  update(dt: number): void {
    if (this.distance < 0) return;
    this.distance += dt * this.speed;
    for (let i = 0; i < this.trail; i += 1) {
      this.beam.at(this.distance - i * this.speed * 0.012, scratch);
      this.positions[i * 3] = scratch.x;
      this.positions[i * 3 + 1] = scratch.y;
      this.positions[i * 3 + 2] = scratch.z;
      this.alphas[i] = 1 - i / this.trail;
    }
    this.points.geometry.attributes["position"]!.needsUpdate = true;
    this.points.geometry.attributes["aAlpha"]!.needsUpdate = true;
    if (this.distance >= this.beam.length) {
      this.distance = -1;
      this.points.visible = false;
      const done = this.done;
      this.done = null;
      done?.();
    }
  }

  dispose(): void {
    this.beam.dispose();
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

const scratch = new Vector3();
