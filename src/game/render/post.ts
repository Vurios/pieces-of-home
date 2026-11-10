import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  type ColorRepresentation,
  type Data3DTexture,
  DepthTexture,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  type PerspectiveCamera,
  RawShaderMaterial,
  Scene,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { QualitySettings } from "../core/quality";
import { type GradeSpec, LUT_SIZE, createGradeLut } from "./grade";

/**
 * Our post-processing, written from scratch.
 *
 * Pass 1 draws the scene into a float target with a depth texture.
 * Pass 2 finds ink lines from the depth buffer, then grades the color.
 * Pass 3 (Medium and High) adds the tilt-shift blur that sells "miniature".
 * The last pass also lays paper grain, a vignette and the Looking Lamp iris.
 *
 * Ink lines come from the second difference of the raw depth buffer. Raw
 * depth is linear across any flat surface on screen, so flat ground gives no
 * line at any viewing angle, while silhouettes and creases both do.
 */
export interface LookSpec {
  grade: GradeSpec;
  /** Ink color. Dark warm grey, never pure black. */
  ink: ColorRepresentation;
  inkStrength: number;
  /** Line width in pixels at a 900 pixel tall screen. */
  inkWidth: number;
  /** Lines fade out between these two distances from the camera. */
  inkFade: [number, number];
  grain: number;
  vignette: number;
  /** Color of the vignette and of the iris that closes between worlds. */
  lamp: ColorRepresentation;
}

const VERTEX = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Grain, vignette and iris. Shared by whichever pass draws to the screen. */
const FINISH = /* glsl */ `
uniform float uGrain;
uniform float uVignette;
uniform vec3 uLamp;
uniform float uIris;
uniform vec2 uIrisCenter;
uniform float uAspect;
uniform float uTime;
uniform vec2 uResolution;

float finishHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float finishNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(finishHash(i), finishHash(i + vec2(1, 0)), f.x), mix(finishHash(i + vec2(0, 1)), finishHash(i + vec2(1, 1)), f.x), f.y);
}

vec3 finish(vec3 color, vec2 uv) {
  // Paper: slow fibres that stay put, plus fine tooth that shifts a few times a second.
  vec2 px = uv * uResolution;
  float fibre = finishNoise(px * vec2(0.012, 0.09)) * 0.6 + finishNoise(px * 0.035) * 0.4;
  float tooth = finishHash(px + floor(uTime * 8.0) * 17.0);
  color *= 1.0 + ((fibre - 0.5) * 0.6 + (tooth - 0.5)) * uGrain;

  // Vignette, like lamplight falling off toward the edges of a page.
  vec2 centered = (uv - 0.5) * vec2(1.05, 1.0);
  float edge = smoothstep(0.38, 0.92, length(centered));
  color = mix(color, color * uLamp * 0.55, edge * uVignette);

  // The Looking Lamp iris: a circle of warm light that closes over the view.
  if (uIris > 0.001) {
    vec2 d = (uv - uIrisCenter) * vec2(uAspect, 1.0);
    float reach = length(vec2(max(uIrisCenter.x, 1.0 - uIrisCenter.x) * uAspect, max(uIrisCenter.y, 1.0 - uIrisCenter.y)));
    float radius = (1.0 - uIris) * (reach + 0.08);
    float dist = length(d);
    float outside = smoothstep(radius - 0.012, radius + 0.012, dist);
    float glow = smoothstep(radius - 0.22, radius, dist) * (1.0 - outside);
    vec3 light = mix(uLamp, vec3(1.0, 0.965, 0.88), 0.55);
    color = mix(color, color + uLamp * 0.5, glow * 0.6);
    color = mix(color, light, outside);
  }
  return color;
}
`;

const INK_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler2D tColor;
uniform highp sampler2D tDepth;
uniform sampler3D tLut;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uTanHalfFov;
uniform float uInkWidth;
uniform vec3 uInk;
uniform float uInkStrength;
uniform vec2 uInkFade;
uniform float uBoil;
uniform float uLutSize;

in vec2 vUv;
out vec4 outColor;

#ifdef POH_FINAL
FINISH_CHUNK
#else
uniform float uAspect;
uniform float uTime;
#endif

float viewZ(float depth) {
  return uNear * uFar / (uFar - depth * (uFar - uNear));
}

vec3 toDisplay(vec3 linear) {
  linear = clamp(linear, 0.0, 1.0);
  vec3 low = linear * 12.92;
  vec3 high = 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055;
  return mix(low, high, step(vec3(0.0031308), linear));
}

void main() {
  // Hand-drawn wobble: nudge where we look for lines a few times a second.
  float phase = floor(uTime * 5.0) * 1.37;
  // Whole pixels only: the depth buffer is read unfiltered, so a fractional
  // offset would sample unevenly and draw false lines across flat ground.
  vec2 wobble = floor(vec2(sin(vUv.y * 190.0 + phase * 1.7), cos(vUv.x * 170.0 + phase * 2.3)) * uBoil + 0.5);
  vec2 uv = (floor(vUv / uTexel) + 0.5 + wobble) * uTexel;
  vec2 o = uInkWidth * uTexel;

  float dc = texture(tDepth, uv).r;
  float dl = texture(tDepth, uv - vec2(o.x, 0.0)).r;
  float dr = texture(tDepth, uv + vec2(o.x, 0.0)).r;
  float du = texture(tDepth, uv + vec2(0.0, o.y)).r;
  float dd = texture(tDepth, uv - vec2(0.0, o.y)).r;
  float d1 = texture(tDepth, uv + o).r;
  float d2 = texture(tDepth, uv - o).r;
  float d3 = texture(tDepth, uv + vec2(o.x, -o.y)).r;
  float d4 = texture(tDepth, uv + vec2(-o.x, o.y)).r;

  float nearest = min(dc, min(min(dl, dr), min(du, dd)));
  float ink = 0.0;
  if (nearest < 0.99999) {
    float z = viewZ(nearest);
    // Turn the second difference of raw depth into a change of surface slope.
    float k = (uFar - uNear) / (uFar * uNear) * z / (2.0 * uTanHalfFov);
    float sx = abs(dl + dr - 2.0 * dc) * k / (o.x * uAspect);
    float sy = abs(du + dd - 2.0 * dc) * k / o.y;
    float diagonal = length(vec2(o.x * uAspect, o.y));
    float sa = abs(d1 + d2 - 2.0 * dc) * k / diagonal;
    float sb = abs(d3 + d4 - 2.0 * dc) * k / diagonal;
    float slope = max(max(sx, sy), max(sa, sb));
    ink = smoothstep(1.25, 2.3, slope);
    ink *= 1.0 - smoothstep(uInkFade.x, uInkFade.y, z);
  }

  vec3 color = toDisplay(texture(tColor, vUv).rgb);
  color = texture(tLut, color * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize).rgb;
  color = mix(color, uInk, ink * uInkStrength);

#ifdef POH_FINAL
  color = finish(color, vUv);
#endif
  outColor = vec4(color, 1.0);
}
`;

const TILT_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uBlur;
uniform float uFocus;

in vec2 vUv;
out vec4 outColor;

FINISH_CHUNK

void main() {
  // Sharp in a band around the player, soft toward the top and bottom of the screen.
  float amount = smoothstep(0.2, 0.52, abs(vUv.y - uFocus)) * uBlur;
  vec3 color = texture(tColor, vUv).rgb;
  if (amount > 0.05) {
    vec3 sum = color;
    float total = 1.0;
    // Twelve taps on a golden-angle spiral.
    for (int i = 1; i <= 12; i++) {
      float fi = float(i);
      float radius = sqrt(fi / 12.0) * amount;
      float angle = fi * 2.39996323;
      vec2 offset = vec2(cos(angle), sin(angle)) * radius * uTexel;
      sum += texture(tColor, vUv + offset).rgb;
      total += 1.0;
    }
    color = sum / total;
  }
  outColor = vec4(finish(color, vUv), 1.0);
}
`;

function fullscreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return geometry;
}

function finishUniforms(): Record<string, { value: unknown }> {
  return {
    uGrain: { value: 0.05 },
    uVignette: { value: 0.4 },
    uLamp: { value: new Color("#F2A541") },
    uIris: { value: 0 },
    uIrisCenter: { value: new Vector2(0.5, 0.5) },
    uAspect: { value: 1 },
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
  };
}

export class PostPipeline {
  /** 0 is open, 1 is fully closed. */
  iris = 0;
  readonly irisCenter = new Vector2(0.5, 0.5);
  /** Screen height (0 to 1) that stays sharp under the tilt-shift blur. */
  focus = 0.46;

  private sceneTarget: WebGLRenderTarget;
  private inkTarget: WebGLRenderTarget | null = null;
  private inkMaterial: RawShaderMaterial;
  private tiltMaterial: RawShaderMaterial | null = null;
  private quad: Mesh;
  private quadScene = new Scene();
  private quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private lut: Data3DTexture | null = null;
  private width = 2;
  private height = 2;
  private reducedMotion = false;

  constructor(
    private renderer: WebGLRenderer,
    private quality: QualitySettings,
  ) {
    const twoPass = quality.tiltShift;
    this.sceneTarget = this.createSceneTarget();
    if (twoPass) {
      this.inkTarget = new WebGLRenderTarget(2, 2, { type: UnsignedByteType, depthBuffer: false });
      this.inkTarget.texture.minFilter = LinearFilter;
      this.inkTarget.texture.magFilter = LinearFilter;
    }

    this.inkMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: (twoPass ? "" : "#define POH_FINAL\n") + INK_FRAGMENT.replace("FINISH_CHUNK", FINISH),
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.sceneTarget.texture },
        tDepth: { value: this.sceneTarget.depthTexture },
        tLut: { value: null },
        uTexel: { value: new Vector2(1, 1) },
        uNear: { value: 0.3 },
        uFar: { value: 400 },
        uTanHalfFov: { value: 0.36 },
        uInkWidth: { value: 1.2 },
        uInk: { value: new Color("#2B2622") },
        uInkStrength: { value: 0.85 },
        uInkFade: { value: new Vector2(40, 90) },
        uBoil: { value: 0 },
        uLutSize: { value: LUT_SIZE },
        ...(twoPass ? { uAspect: { value: 1 }, uTime: { value: 0 } } : finishUniforms()),
      },
    });

    if (twoPass) {
      this.tiltMaterial = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: VERTEX,
        fragmentShader: TILT_FRAGMENT.replace("FINISH_CHUNK", FINISH),
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tColor: { value: this.inkTarget?.texture ?? null },
          uTexel: { value: new Vector2(1, 1) },
          uBlur: { value: 5 },
          uFocus: { value: this.focus },
          ...finishUniforms(),
        },
      });
    }

    this.quad = new Mesh(fullscreenTriangle(), this.inkMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private createSceneTarget(): WebGLRenderTarget {
    const gl = this.renderer.getContext();
    const floatOk = gl.getExtension("EXT_color_buffer_half_float") !== null || gl.getExtension("EXT_color_buffer_float") !== null;
    const target = new WebGLRenderTarget(2, 2, {
      type: floatOk ? HalfFloatType : UnsignedByteType,
      samples: this.quality.msaa,
      depthBuffer: true,
    });
    target.texture.minFilter = LinearFilter;
    target.texture.magFilter = LinearFilter;
    const depth = new DepthTexture(2, 2, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    target.depthTexture = depth;
    return target;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setLook(look: LookSpec): void {
    this.lut?.dispose();
    this.lut = createGradeLut(look.grade);
    const ink = this.inkMaterial.uniforms;
    ink["tLut"]!.value = this.lut;
    (ink["uInk"]!.value as Color).set(look.ink).convertLinearToSRGB();
    ink["uInkStrength"]!.value = look.inkStrength;
    (ink["uInkFade"]!.value as Vector2).set(look.inkFade[0], look.inkFade[1]);
    this.inkWidth = look.inkWidth;
    const finish = (this.tiltMaterial ?? this.inkMaterial).uniforms;
    finish["uGrain"]!.value = look.grain;
    finish["uVignette"]!.value = look.vignette;
    (finish["uLamp"]!.value as Color).set(look.lamp).convertLinearToSRGB();
    this.applyInkWidth();
  }

  private inkWidth = 1.2;

  private applyInkWidth(): void {
    // Keep lines the same visual weight on any screen.
    const scale = Math.max(0.75, this.height / 900);
    this.inkMaterial.uniforms["uInkWidth"]!.value = Math.max(1, Math.round(this.inkWidth * scale));
  }

  /** Sizes are in real pixels. */
  setSize(width: number, height: number): void {
    this.width = Math.max(2, Math.floor(width));
    this.height = Math.max(2, Math.floor(height));
    this.sceneTarget.setSize(this.width, this.height);
    this.inkTarget?.setSize(this.width, this.height);
    const texel = new Vector2(1 / this.width, 1 / this.height);
    (this.inkMaterial.uniforms["uTexel"]!.value as Vector2).copy(texel);
    this.inkMaterial.uniforms["uAspect"]!.value = this.width / this.height;
    if (this.tiltMaterial) {
      (this.tiltMaterial.uniforms["uTexel"]!.value as Vector2).copy(texel);
      this.tiltMaterial.uniforms["uAspect"]!.value = this.width / this.height;
      this.tiltMaterial.uniforms["uBlur"]!.value = 5.5 * Math.max(0.75, this.height / 900);
    }
    const finish = (this.tiltMaterial ?? this.inkMaterial).uniforms;
    (finish["uResolution"]!.value as Vector2).set(this.width, this.height);
    this.applyInkWidth();
  }

  render(scene: Scene, camera: Camera, time: number): void {
    const renderer = this.renderer;
    const perspective = camera as PerspectiveCamera;
    const ink = this.inkMaterial.uniforms;
    ink["uNear"]!.value = perspective.near;
    ink["uFar"]!.value = perspective.far;
    ink["uTanHalfFov"]!.value = Math.tan((perspective.fov * Math.PI) / 360);
    ink["uTime"]!.value = time;
    ink["uBoil"]!.value = this.quality.outlineBoil && !this.reducedMotion ? 1 : 0;

    const finish = (this.tiltMaterial ?? this.inkMaterial).uniforms;
    finish["uTime"]!.value = this.reducedMotion ? 0 : time;
    finish["uIris"]!.value = this.iris;
    (finish["uIrisCenter"]!.value as Vector2).copy(this.irisCenter);

    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);

    this.quad.material = this.inkMaterial;
    renderer.setRenderTarget(this.inkTarget);
    renderer.render(this.quadScene, this.quadCamera);

    if (this.tiltMaterial) {
      this.tiltMaterial.uniforms["uFocus"]!.value = this.focus;
      this.quad.material = this.tiltMaterial;
      renderer.setRenderTarget(null);
      renderer.render(this.quadScene, this.quadCamera);
    }
  }

  dispose(): void {
    this.sceneTarget.depthTexture?.dispose();
    this.sceneTarget.dispose();
    this.inkTarget?.dispose();
    this.inkMaterial.dispose();
    this.tiltMaterial?.dispose();
    this.lut?.dispose();
    this.quad.geometry.dispose();
  }
}
