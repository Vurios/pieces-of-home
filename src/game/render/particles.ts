import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { createRandom } from "../world/noise";

/**
 * Two small particle systems:
 * - Puffs: little dust clouds at footsteps and landings.
 * - Floaters: dust motes in lamplight, or fireflies in the garden at dusk.
 * Both draw as soft painted dots in a single draw call each.
 */
const VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uSoft;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  // A soft blot with a slightly darker painted edge.
  float a = smoothstep(0.5, 0.5 - uSoft, d);
  if (a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(uColor, a * vAlpha);
  #include <colorspace_fragment>
}
`;

function createMaterial(color: ColorRepresentation, additive: boolean, soft: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uScale: { value: 300 },
      uSoft: { value: soft },
    },
  });
}

export class Puffs {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private velocity: Float32Array;
  private life: Float32Array;
  private next = 0;
  private random = createRandom(9);

  constructor(
    private capacity: number,
    color: ColorRepresentation,
  ) {
    this.positions = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial(color, false, 0.22));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setColor(color: ColorRepresentation): void {
    (this.points.material.uniforms["uColor"]!.value as Color).set(color);
  }

  setScale(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  /** A ring of dust around `at`, rising along `up`. */
  emit(at: Vector3, up: Vector3, count: number, strength = 1): void {
    if (this.capacity === 0) return;
    const side = new Vector3().crossVectors(up, Math.abs(up.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)).normalize();
    const other = new Vector3().crossVectors(up, side);
    for (let n = 0; n < count; n += 1) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      const angle = this.random() * Math.PI * 2;
      const speed = (0.6 + this.random() * 0.8) * strength;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      this.positions[i * 3] = at.x + (side.x * dx + other.x * dz) * 0.08;
      this.positions[i * 3 + 1] = at.y + (side.y * dx + other.y * dz) * 0.08;
      this.positions[i * 3 + 2] = at.z + (side.z * dx + other.z * dz) * 0.08;
      this.velocity[i * 3] = (side.x * dx + other.x * dz) * speed + up.x * 0.5;
      this.velocity[i * 3 + 1] = (side.y * dx + other.y * dz) * speed + up.y * 0.5;
      this.velocity[i * 3 + 2] = (side.z * dx + other.z * dz) * speed + up.z * 0.5;
      this.life[i] = 1;
      this.sizes[i] = 0;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.life[i]! <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      const life = Math.max(0, this.life[i]! - dt * 1.6);
      this.life[i] = life;
      const drag = Math.exp(-dt * 4);
      for (let k = 0; k < 3; k += 1) {
        this.velocity[i * 3 + k]! *= drag;
        this.positions[i * 3 + k]! += this.velocity[i * 3 + k]! * dt;
      }
      this.sizes[i] = (1 - life) * 0.55 + 0.12;
      this.alphas[i] = life * life * 0.55;
    }
    const geometry = this.points.geometry;
    geometry.attributes["position"]!.needsUpdate = true;
    geometry.attributes["aSize"]!.needsUpdate = true;
    geometry.attributes["aAlpha"]!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

export interface FloaterSpec {
  count: number;
  center: Vector3;
  /** Floaters stay inside this sphere. */
  radius: number;
  color: ColorRepresentation;
  size: number;
  /** Glowing floaters (fireflies) blend additively. */
  glow: boolean;
  speed: number;
  /** Fireflies blink. Motes shimmer. */
  blink: boolean;
  seed: number;
}

export class Floaters {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private base: Float32Array;
  private positions: Float32Array;
  private alphas: Float32Array;
  private phase: Float32Array;
  private time = 0;

  constructor(private spec: FloaterSpec) {
    const random = createRandom(spec.seed);
    const n = spec.count;
    this.base = new Float32Array(n * 3);
    this.positions = new Float32Array(n * 3);
    this.alphas = new Float32Array(n);
    this.phase = new Float32Array(n);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      let x = 0;
      let y = 0;
      let z = 0;
      do {
        x = random() * 2 - 1;
        y = random() * 2 - 1;
        z = random() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      this.base[i * 3] = spec.center.x + x * spec.radius;
      this.base[i * 3 + 1] = spec.center.y + y * spec.radius;
      this.base[i * 3 + 2] = spec.center.z + z * spec.radius;
      this.phase[i] = random() * 100;
      sizes[i] = spec.size * (0.6 + random() * 0.8);
    }
    this.positions.set(this.base);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial(spec.color, spec.glow, spec.glow ? 0.45 : 0.3));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setScale(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += reducedMotion ? 0 : dt * this.spec.speed;
    const t = this.time;
    const r = this.spec.radius * 0.25;
    for (let i = 0; i < this.spec.count; i += 1) {
      const p = this.phase[i]!;
      this.positions[i * 3] = this.base[i * 3]! + Math.sin(t * 0.7 + p) * r;
      this.positions[i * 3 + 1] = this.base[i * 3 + 1]! + Math.sin(t * 0.5 + p * 1.3) * r;
      this.positions[i * 3 + 2] = this.base[i * 3 + 2]! + Math.cos(t * 0.6 + p * 0.7) * r;
      this.alphas[i] = this.spec.blink
        ? Math.max(0, Math.sin(t * 1.3 + p * 2)) ** 3
        : 0.35 + 0.35 * Math.sin(t * 2 + p);
    }
    this.points.geometry.attributes["position"]!.needsUpdate = true;
    this.points.geometry.attributes["aAlpha"]!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/**
 * Chimney smoke: soft puffs that rise along `up`, drift with the breeze,
 * swell and fade, then start again at the chimney.
 */
export class Smoke {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private time = 0;
  private readonly side: Vector3;

  constructor(
    private origin: Vector3,
    private up: Vector3,
    private count: number,
    color: ColorRepresentation,
  ) {
    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.side = new Vector3().crossVectors(up, new Vector3(0.3, 0.9, 0.2)).normalize();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.points = new Points(geometry, createMaterial(color, false, 0.35));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setScale(pixelHeight: number): void {
    this.points.material.uniforms["uScale"]!.value = pixelHeight * 1.37;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.time += reducedMotion ? 0 : dt;
    const life = 5.5;
    for (let i = 0; i < this.count; i += 1) {
      const t = ((this.time + (i / this.count) * life) % life) / life;
      const rise = t * 2.6;
      const drift = t * t * 2.2 + Math.sin(this.time * 0.6 + i * 1.7) * 0.22 * t;
      const p = scratchSmoke.copy(this.origin).addScaledVector(this.up, rise).addScaledVector(this.side, drift);
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      this.sizes[i] = 0.32 + t * 1.25;
      this.alphas[i] = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.42;
    }
    const geometry = this.points.geometry;
    geometry.attributes["position"]!.needsUpdate = true;
    geometry.attributes["aSize"]!.needsUpdate = true;
    geometry.attributes["aAlpha"]!.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

const scratchSmoke = new Vector3();
