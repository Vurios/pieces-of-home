import type { QualityTier } from "./events";
import { readStorage, writeStorage } from "./state";

/**
 * Quality tiers. One table decides what each tier costs, so every system reads
 * the same numbers.
 */
export interface QualitySettings {
  tier: QualityTier;
  /** Upper limit for the device pixel ratio. */
  maxPixelRatio: number;
  /** MSAA samples on the scene target. 0 turns it off. */
  msaa: number;
  /** Shadow map size. 0 turns shadows off. */
  shadowMap: number;
  /** Tilt-shift blur at the top and bottom of the screen. */
  tiltShift: boolean;
  /** Hand-drawn wobble on the ink lines. */
  outlineBoil: boolean;
  /** Scale for particle counts. */
  particles: number;
  /** Planet mesh detail (icosphere subdivisions). */
  terrainDetail: number;
  /** How many music layers audio may run (used from Phase 04). */
  audioLayers: number;
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    tier: "low",
    maxPixelRatio: 1,
    msaa: 0,
    shadowMap: 0,
    tiltShift: false,
    outlineBoil: false,
    particles: 0.35,
    terrainDetail: 36,
    audioLayers: 2,
  },
  medium: {
    tier: "medium",
    maxPixelRatio: 1.5,
    msaa: 2,
    shadowMap: 1024,
    tiltShift: true,
    outlineBoil: true,
    particles: 0.7,
    terrainDetail: 52,
    audioLayers: 4,
  },
  high: {
    tier: "high",
    maxPixelRatio: 2,
    msaa: 4,
    shadowMap: 2048,
    tiltShift: true,
    outlineBoil: true,
    particles: 1,
    terrainDetail: 80,
    audioLayers: 6,
  },
};

export interface DeviceHints {
  /** Gigabytes, from `navigator.deviceMemory`. Undefined when the browser hides it. */
  memory: number | undefined;
  cores: number | undefined;
  mobile: boolean;
  /** Unmasked GPU renderer string, lowercase. Empty when hidden. */
  gpu: string;
  /** Smaller side of the screen in CSS pixels. */
  minSide: number;
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/;
const WEAK_GPU = /mali-4|mali-t|adreno \(tm\) [2-5]\d\d|powervr|intel\(r\) hd graphics [2-5]\d{3}|hd graphics 4\d\d|uhd graphics 6\d\d/;
const STRONG_GPU = /rtx|gtx|radeon rx|radeon pro|apple m\d|apple gpu|arc\(tm\)|iris\(r\) xe|geforce/;

/**
 * Picks a starting tier from what the device tells us. We chose simple hints
 * over a GPU benchmark library: no extra download, no network lookups, and the
 * frame-time watchdog in the engine corrects a wrong first guess.
 */
export function detectTier(hints: DeviceHints): QualityTier {
  if (SOFTWARE_GPU.test(hints.gpu)) return "low";
  if (hints.memory !== undefined && hints.memory <= 2) return "low";
  if (hints.cores !== undefined && hints.cores <= 2) return "low";
  if (WEAK_GPU.test(hints.gpu)) return "low";

  if (hints.mobile) {
    const roomy = (hints.memory ?? 4) >= 6 && (hints.cores ?? 4) >= 8;
    return roomy ? "medium" : "low";
  }

  if (STRONG_GPU.test(hints.gpu)) return "high";
  if ((hints.memory ?? 8) >= 8 && (hints.cores ?? 4) >= 8) return "high";
  return "medium";
}

export function readDeviceHints(gl: WebGLRenderingContext | WebGL2RenderingContext | null): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  let gpu = "";
  if (gl) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "").toLowerCase();
  }
  const mobile =
    nav.userAgentData?.mobile ?? (/android|iphone|ipad|ipod|mobile/i.test(nav.userAgent) || nav.maxTouchPoints > 1);
  return {
    memory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    mobile,
    gpu,
    minSide: Math.min(window.screen.width, window.screen.height),
  };
}

const TIER_KEY = "poh.quality";

export function isTier(value: unknown): value is QualityTier {
  return value === "low" || value === "medium" || value === "high";
}

/** The player's manual choice from Settings, or null for automatic. */
export function readTierOverride(): QualityTier | null {
  const fromUrl = new URLSearchParams(window.location.search).get("quality");
  if (isTier(fromUrl)) return fromUrl;
  const stored = readStorage(TIER_KEY);
  return isTier(stored) ? stored : null;
}

export function writeTierOverride(tier: QualityTier | null): void {
  writeStorage(TIER_KEY, tier ?? "auto");
}

const ORDER: QualityTier[] = ["low", "medium", "high"];

export function lowerTier(tier: QualityTier): QualityTier {
  return ORDER[Math.max(0, ORDER.indexOf(tier) - 1)] ?? "low";
}

/**
 * Watches frame times while the tier is automatic. If the game runs slowly for
 * a few seconds it asks to drop one tier. It never raises the tier by itself,
 * so quality does not flicker.
 */
/**
 * Keeps play smooth by drawing fewer pixels when frames run slow, and more
 * again when there is room. It acts before the watchdog drops a whole tier,
 * so a busy moment costs a little sharpness instead of the shadows.
 */
export class ResolutionGovernor {
  scale = 1;
  private sampleTime = 0;
  private frames = 0;
  private fastSamples = 0;

  /** Returns the new scale when it changes, otherwise null. */
  update(dt: number): number | null {
    this.sampleTime += dt;
    this.frames += 1;
    if (this.sampleTime < 1) return null;
    const fps = this.frames / this.sampleTime;
    this.sampleTime = 0;
    this.frames = 0;
    if (fps < 50 && this.scale > 0.6) {
      this.fastSamples = 0;
      this.scale = Math.max(0.6, Math.round((this.scale - 0.1) * 100) / 100);
      return this.scale;
    }
    this.fastSamples = fps > 58 ? this.fastSamples + 1 : 0;
    if (this.fastSamples >= 3 && this.scale < 1) {
      this.fastSamples = 0;
      this.scale = Math.min(1, Math.round((this.scale + 0.05) * 100) / 100);
      return this.scale;
    }
    return null;
  }

  reset(): void {
    this.scale = 1;
    this.sampleTime = 0;
    this.frames = 0;
    this.fastSamples = 0;
  }
}

export class FrameWatchdog {
  private slowTime = 0;
  private sampleTime = 0;
  private frames = 0;

  /** Returns true when the tier should drop. */
  update(dt: number, slowFps = 40): boolean {
    this.sampleTime += dt;
    this.frames += 1;
    if (this.sampleTime < 1) return false;
    const fps = this.frames / this.sampleTime;
    this.sampleTime = 0;
    this.frames = 0;
    this.slowTime = fps < slowFps ? this.slowTime + 1 : 0;
    if (this.slowTime >= 4) {
      this.slowTime = 0;
      return true;
    }
    return false;
  }

  reset(): void {
    this.slowTime = 0;
    this.sampleTime = 0;
    this.frames = 0;
  }
}
