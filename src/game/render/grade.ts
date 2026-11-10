import { Color, type ColorRepresentation, Data3DTexture, LinearFilter, RGBAFormat, UnsignedByteType } from "three";

/**
 * Per-world color grading. Each world describes its mood with a few numbers
 * and we bake that into a small 3D lookup table, so the grade costs one
 * texture read per pixel.
 */
export interface GradeSpec {
  /** Color that shadows lean toward. */
  shadows: ColorRepresentation;
  /** Color that highlights lean toward. */
  highlights: ColorRepresentation;
  /** 0 to 1. How strongly shadows take their tint. */
  shadowAmount: number;
  /** 0 to 1. How strongly highlights take their tint. */
  highlightAmount: number;
  /** 1 leaves saturation alone. */
  saturation: number;
  /** 1 leaves contrast alone. */
  contrast: number;
  /** Raises the darkest value, like ink on paper never reaching pure black. */
  lift: number;
}

export const LUT_SIZE = 24;

function channel(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Grades one display-space color. Exported so tests can check the math. */
export function gradeColor(r: number, g: number, b: number, spec: GradeSpec, shadows: Color, highlights: Color): [number, number, number] {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Contrast around middle grey.
  let cr = (r - 0.5) * spec.contrast + 0.5;
  let cg = (g - 0.5) * spec.contrast + 0.5;
  let cb = (b - 0.5) * spec.contrast + 0.5;

  // Saturation.
  const l2 = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
  cr = l2 + (cr - l2) * spec.saturation;
  cg = l2 + (cg - l2) * spec.saturation;
  cb = l2 + (cb - l2) * spec.saturation;

  // Split toning: tint darks one way and lights the other.
  const shadowWeight = (1 - luma) * (1 - luma) * spec.shadowAmount;
  const highlightWeight = luma * luma * spec.highlightAmount;
  cr += (shadows.r - cr) * shadowWeight + (highlights.r - 0.5) * highlightWeight;
  cg += (shadows.g - cg) * shadowWeight + (highlights.g - 0.5) * highlightWeight;
  cb += (shadows.b - cb) * shadowWeight + (highlights.b - 0.5) * highlightWeight;

  // Lift the blacks so nothing is darker than warm ink.
  cr = spec.lift + cr * (1 - spec.lift);
  cg = spec.lift + cg * (1 - spec.lift);
  cb = spec.lift + cb * (1 - spec.lift);

  return [channel(cr), channel(cg), channel(cb)];
}

export function createGradeLut(spec: GradeSpec): Data3DTexture {
  const n = LUT_SIZE;
  const data = new Uint8Array(n * n * n * 4);
  // These are display colors, so read the hex values without converting them.
  const shadows = new Color(spec.shadows).convertLinearToSRGB();
  const highlights = new Color(spec.highlights).convertLinearToSRGB();
  let o = 0;
  for (let b = 0; b < n; b += 1) {
    for (let g = 0; g < n; g += 1) {
      for (let r = 0; r < n; r += 1) {
        const [gr, gg, gb] = gradeColor(r / (n - 1), g / (n - 1), b / (n - 1), spec, shadows, highlights);
        data[o] = Math.round(gr * 255);
        data[o + 1] = Math.round(gg * 255);
        data[o + 2] = Math.round(gb * 255);
        data[o + 3] = 255;
        o += 4;
      }
    }
  }
  const texture = new Data3DTexture(data, n, n, n);
  texture.format = RGBAFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
