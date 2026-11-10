import {
  Color,
  type ColorRepresentation,
  DataTexture,
  DoubleSide,
  FrontSide,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  type Side,
} from "three";

/**
 * The handmade look starts here: three flat light bands, a warm rim light and
 * a soft painted breakup so surfaces read as brushed paint, never plastic.
 *
 * We extend Three's own toon material instead of writing lighting from
 * scratch, so point lights and shadow maps keep working.
 */
export interface ToonOptions {
  color?: ColorRepresentation;
  vertexColors?: boolean;
  side?: Side;
  /** Paint breakup follows the object instead of the world. Use for things that move. */
  objectSpace?: boolean;
  /** Strength of the painted breakup. 0 turns it off. */
  paint?: number;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
  /** Scales the shared rim light for this material. 1 by default. */
  rim?: number;
  /** Bends vertices that carry an `aSway` weight in the wind (foliage batches). */
  sway?: boolean;
  /**
   * Dissolves the surface with a dither pattern when it comes very close to the
   * camera, so a bush or wall the camera brushes past never fills the screen.
   * On by default. Off for the ground.
   */
  nearFade?: boolean;
}

function createBandTexture(): DataTexture {
  // Left to right: deep shade, shade, half light, full light.
  const texture = new DataTexture(new Uint8Array([104, 150, 222, 255]), 4, 1, RedFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const VERTEX_HEAD = /* glsl */ `
varying vec3 vPohPaint;
#ifdef POH_SWAY
attribute float aSway;
uniform float uPohTime;
uniform float uPohWind;
#endif
`;

// Wind: a slow lean plus a quicker flutter, phased by position so a meadow ripples.
const VERTEX_SWAY = /* glsl */ `
#ifdef POH_SWAY
  vec3 pohUp = normalize(position);
  vec3 pohSide = normalize(cross(pohUp, vec3(0.31, 0.95, 0.12)));
  vec3 pohFwd = cross(pohSide, pohUp);
  float pohPhase = dot(position, vec3(0.37, 0.21, 0.29));
  float pohLean = sin(uPohTime * 0.9 + pohPhase) * 0.7 + sin(uPohTime * 2.3 + pohPhase * 2.1) * 0.3;
  float pohFlutter = sin(uPohTime * 5.1 + pohPhase * 3.7) * 0.25;
  transformed += (pohSide * pohLean + pohFwd * pohFlutter) * aSway * uPohWind;
#endif
`;

const VERTEX_BODY = /* glsl */ `
#ifdef POH_OBJECT_SPACE
  vPohPaint = transformed * 2.2;
#else
  vec4 pohWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    pohWorld = instanceMatrix * pohWorld;
  #endif
  vPohPaint = (modelMatrix * pohWorld).xyz;
#endif
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vPohPaint;
uniform vec3 uPohRimColor;
uniform float uPohRimStrength;
uniform float uPohPaint;
uniform float uPohRimScale;

float pohHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float pohNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pohHash(i), pohHash(i + vec3(1, 0, 0)), f.x), mix(pohHash(i + vec3(0, 1, 0)), pohHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(pohHash(i + vec3(0, 0, 1)), pohHash(i + vec3(1, 0, 1)), f.x), mix(pohHash(i + vec3(0, 1, 1)), pohHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
`;

const FRAGMENT_NEAR = /* glsl */ `
#ifdef POH_NEAR_FADE
{
  // 4x4 ordered dither: a clean screen-door fade with no sorting.
  vec2 pohA = floor(gl_FragCoord.xy);
  vec2 pohH = floor(pohA * 0.5);
  float pohB2a = fract(dot(pohH, vec2(0.5, pohH.y * 0.75)));
  float pohB2b = fract(dot(pohA, vec2(0.5, pohA.y * 0.75)));
  float pohBayer = pohB2a * 0.25 + pohB2b + 0.03;
  float pohFade = smoothstep(0.75, 1.7, -vViewPosition.z);
  if (pohFade < pohBayer) discard;
}
#endif
`;

const FRAGMENT_PAINT = /* glsl */ `
// Two sizes of brush mottling.
float pohBrush = pohNoise(vPohPaint * 1.3) * 0.65 + pohNoise(vPohPaint * 4.7) * 0.35;
diffuseColor.rgb *= 1.0 + (pohBrush - 0.5) * uPohPaint;
`;

const FRAGMENT_RIM = /* glsl */ `
// A thin warm edge light, drawn as a band so it stays graphic.
float pohFacing = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float pohRim = smoothstep(0.62, 0.74, pohFacing);
outgoingLight += uPohRimColor * pohRim * uPohRimStrength * uPohRimScale * (0.35 + 0.65 * diffuseColor.rgb);
`;

/** Creates and tracks every material in a world, so they share uniforms and can be freed together. */
export class ToonLibrary {
  readonly bands = createBandTexture();
  /** Shared by every toon material. Change the values, not the objects. */
  readonly uniforms = {
    uPohRimColor: { value: new Color("#F2A541") },
    uPohRimStrength: { value: 0.5 },
    /** Seconds. The engine sets it each frame. */
    uPohTime: { value: 0 },
    /** How far foliage tips travel, in world units. The engine sets 0 under reduced motion. */
    uPohWind: { value: 0.06 },
  };
  private materials = new Set<{ dispose(): void }>();
  private toonCache = new Map<string, MeshToonMaterial>();

  setRim(color: ColorRepresentation, strength: number): void {
    this.uniforms.uPohRimColor.value.set(color);
    this.uniforms.uPohRimStrength.value = strength;
  }

  /** A lit toon material. Materials with the same options are shared. */
  toon(options: ToonOptions = {}): MeshToonMaterial {
    const key = JSON.stringify(options);
    const cached = this.toonCache.get(key);
    if (cached) return cached;

    const paint = options.paint ?? 0.16;
    const material = new MeshToonMaterial({
      color: options.color ?? "#ffffff",
      vertexColors: options.vertexColors ?? false,
      gradientMap: this.bands,
      side: options.side ?? FrontSide,
    });
    if (options.emissive !== undefined) {
      material.emissive = new Color(options.emissive);
      material.emissiveIntensity = options.emissiveIntensity ?? 1;
    }
    const objectSpace = options.objectSpace ?? false;
    const paintUniform = { value: paint };
    const rimUniform = { value: options.rim ?? 1 };
    const sway = options.sway ?? false;
    const nearFade = options.nearFade ?? true;

    material.onBeforeCompile = (shader) => {
      shader.uniforms["uPohRimColor"] = this.uniforms.uPohRimColor;
      shader.uniforms["uPohRimStrength"] = this.uniforms.uPohRimStrength;
      shader.uniforms["uPohPaint"] = paintUniform;
      shader.uniforms["uPohRimScale"] = rimUniform;
      shader.uniforms["uPohTime"] = this.uniforms.uPohTime;
      shader.uniforms["uPohWind"] = this.uniforms.uPohWind;
      const define = (objectSpace ? "#define POH_OBJECT_SPACE\n" : "") + (sway ? "#define POH_SWAY\n" : "");
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `${define}#include <common>\n${VERTEX_HEAD}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_SWAY}`)
        .replace("#include <project_vertex>", `#include <project_vertex>\n${VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_HEAD}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAGMENT_PAINT}`)
        .replace("#include <opaque_fragment>", `${FRAGMENT_RIM}\n#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => `poh-toon-${objectSpace ? "o" : "w"}${sway ? "s" : ""}${nearFade ? "n" : ""}`;

    this.toonCache.set(key, material);
    this.materials.add(material);
    return material;
  }

  /** An unlit material for things that glow: windows, bulbs, screens. */
  glow(color: ColorRepresentation = "#ffffff", vertexColors = false): MeshBasicMaterial {
    const material = new MeshBasicMaterial({ color, vertexColors });
    this.materials.add(material);
    return material;
  }

  /** Thin glass for the diorama domes: clear in the middle, bright at the edge, with one soft streak. */
  glass(tint: ColorRepresentation = "#FFF6E0"): ShaderMaterial {
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: { uTint: { value: new Color(tint) } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vLocal;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          vLocal = normalize(position);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vLocal;
        void main() {
          float facing = abs(dot(normalize(vNormal), normalize(vView)));
          float edge = smoothstep(0.55, 0.05, facing);
          // One hand-painted highlight streak across the dome.
          float streak = smoothstep(0.035, 0.0, abs(vLocal.x * 0.8 + vLocal.y * 0.6 - 0.72)) * step(0.0, vLocal.z);
          float alpha = 0.05 + edge * 0.42 + streak * 0.5;
          gl_FragColor = vec4(uTint * (0.9 + streak), alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    this.materials.add(material);
    return material;
  }

  track<T extends { dispose(): void }>(material: T): T {
    this.materials.add(material);
    return material;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.materials.clear();
    this.toonCache.clear();
    this.bands.dispose();
  }
}
