import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { createRandom } from "../world/noise";

/**
 * A painted sky dome that moves with the camera. Gradient from the horizon up,
 * a warm glow toward the sun or lamp, soft drifting cloud bands, and stars
 * that fade in where the sky is dark.
 *
 * "Up" for the gradient is the player's up, so the horizon stays calm as
 * they walk around the little planet.
 */
export interface SkySpec {
  zenith: ColorRepresentation;
  horizon: ColorRepresentation;
  /** Color near the ground, below the horizon line. */
  ground: ColorRepresentation;
  glow: ColorRepresentation;
  /** Direction of the glow, in world space. */
  glowDirection: Vector3;
  glowStrength: number;
  /** 0 to 1. Drifting cloud or dust bands. */
  clouds: number;
  cloudColor: ColorRepresentation;
  /** 0 to 1. Star brightness. */
  stars: number;
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99999;
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uGlow;
uniform vec3 uGlowDir;
uniform float uGlowStrength;
uniform vec3 uUp;
uniform float uClouds;
uniform vec3 uCloudColor;
uniform float uTime;
varying vec3 vDir;

float skyHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float skyNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(skyHash(i), skyHash(i + vec3(1, 0, 0)), f.x), mix(skyHash(i + vec3(0, 1, 0)), skyHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(skyHash(i + vec3(0, 0, 1)), skyHash(i + vec3(1, 0, 1)), f.x), mix(skyHash(i + vec3(0, 1, 1)), skyHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dot(dir, uUp);
  // Painted, stepped gradient: soft bands rather than a smooth airbrush.
  float t = clamp(h * 1.25 + 0.06, 0.0, 1.0);
  t = mix(t, floor(t * 7.0 + 0.5) / 7.0, 0.35);
  vec3 color = mix(uHorizon, uZenith, pow(t, 0.75));
  color = mix(uGround, color, smoothstep(-0.18, 0.02, h));

  float glow = pow(max(dot(dir, normalize(uGlowDir)), 0.0), 5.0);
  color += uGlow * glow * uGlowStrength * (1.0 - smoothstep(0.1, 0.8, h) * 0.6);

  if (uClouds > 0.0) {
    vec3 p = dir * 3.2 + vec3(uTime * 0.012, 0.0, uTime * 0.007);
    float n = skyNoise(p) * 0.6 + skyNoise(p * 2.3) * 0.4;
    // Long thin strokes that sit near the horizon.
    float band = smoothstep(0.55, 0.72, n) * smoothstep(-0.02, 0.12, h) * (1.0 - smoothstep(0.25, 0.6, h));
    color = mix(color, uCloudColor, band * uClouds);
  }

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform vec3 uUp;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vec3 dir = normalize(position);
  float h = dot(dir, uUp);
  float twinkle = 0.75 + 0.25 * sin(uTime * (0.8 + aPhase) + aPhase * 6.28);
  vAlpha = smoothstep(0.02, 0.35, h) * twinkle;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99998;
  gl_PointSize = aSize * uPixelRatio;
}
`;

const STAR_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // A small four-point twinkle, like a star drawn with a pen.
  float cross = max(1.0 - abs(c.x) * 9.0, 0.0) * max(1.0 - abs(c.y) * 2.2, 0.0)
              + max(1.0 - abs(c.y) * 9.0, 0.0) * max(1.0 - abs(c.x) * 2.2, 0.0);
  float dot = smoothstep(0.22, 0.0, length(c));
  float a = clamp(max(dot, cross * 0.8), 0.0, 1.0) * vAlpha * uStrength;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export class Sky {
  readonly group = new Group();
  private dome: Mesh<SphereGeometry, ShaderMaterial>;
  private stars: Points<BufferGeometry, ShaderMaterial>;

  constructor(spec: SkySpec, starCount: number, pixelRatio: number) {
    const domeMaterial = new ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uGround: { value: new Color() },
        uGlow: { value: new Color() },
        uGlowDir: { value: new Vector3() },
        uGlowStrength: { value: 0 },
        uUp: { value: new Vector3(0, 1, 0) },
        uClouds: { value: 0 },
        uCloudColor: { value: new Color() },
        uTime: { value: 0 },
      },
    });
    this.dome = new Mesh(new SphereGeometry(300, 48, 24), domeMaterial);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    const random = createRandom(77);
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    const v = new Vector3();
    for (let i = 0; i < starCount; i += 1) {
      v.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) {
        i -= 1;
        continue;
      }
      v.normalize().multiplyScalar(280);
      positions.set([v.x, v.y, v.z], i * 3);
      const big = random();
      sizes[i] = big > 0.97 ? 9 : big > 0.85 ? 5.5 : 3.2;
      phases[i] = random();
    }
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    starGeometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    starGeometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
    const starMaterial = new ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uUp: { value: domeMaterial.uniforms["uUp"]!.value },
        uPixelRatio: { value: pixelRatio },
        uColor: { value: new Color("#FFF6E0") },
        uStrength: { value: 0 },
      },
    });
    this.stars = new Points(starGeometry, starMaterial);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    this.set(spec);
  }

  set(spec: SkySpec): void {
    const u = this.dome.material.uniforms;
    (u["uZenith"]!.value as Color).set(spec.zenith);
    (u["uHorizon"]!.value as Color).set(spec.horizon);
    (u["uGround"]!.value as Color).set(spec.ground);
    (u["uGlow"]!.value as Color).set(spec.glow);
    (u["uGlowDir"]!.value as Vector3).copy(spec.glowDirection).normalize();
    u["uGlowStrength"]!.value = spec.glowStrength;
    u["uClouds"]!.value = spec.clouds;
    (u["uCloudColor"]!.value as Color).set(spec.cloudColor);
    this.stars.material.uniforms["uStrength"]!.value = spec.stars;
    this.stars.visible = spec.stars > 0;
  }

  setGlowDirection(direction: Vector3): void {
    (this.dome.material.uniforms["uGlowDir"]!.value as Vector3).copy(direction).normalize();
  }

  update(cameraPosition: Vector3, up: Vector3, time: number): void {
    this.group.position.copy(cameraPosition);
    (this.dome.material.uniforms["uUp"]!.value as Vector3).copy(up);
    this.dome.material.uniforms["uTime"]!.value = time;
    this.stars.material.uniforms["uTime"]!.value = time;
  }

  dispose(): void {
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
  }
}
