import type { MachineSpread } from "../../content/notebook";
import type { Prim } from "./sketch";

/**
 * Dad's notebook sketches of each machine, as simple shapes on a 320 by 220
 * page. They are drawings, not photos: loose lines, a few labels' worth of
 * detail, the way an engineer sketches in a margin.
 */
const circleRow = (x: number, y: number, n: number, gap: number, d: number): Prim[] =>
  Array.from({ length: n }, (_, i) => ({ k: "circle", x: x + i * gap, y, d }) as Prim);

export const DRAWINGS: Record<MachineSpread["drawing"], () => Prim[]> = {
  lamp: () => [
    { k: "path", d: "M92 196 C 96 176, 176 176, 180 196 Z" },
    { k: "line", a: [80, 198], b: [192, 198] },
    { k: "line", a: [132, 186], b: [104, 104] },
    { k: "line", a: [142, 184], b: [114, 108] },
    { k: "line", a: [106, 102], b: [184, 52] },
    { k: "line", a: [114, 112], b: [190, 62] },
    { k: "circle", x: 137, y: 186, d: 14 },
    { k: "circle", x: 108, y: 106, d: 16 },
    { k: "circle", x: 186, y: 56, d: 12 },
    { k: "path", d: "M182 46 C 192 36, 210 36, 218 46 L 258 96 C 248 114, 216 124, 196 116 L 178 60 Z" },
    { k: "curve", pts: [[200, 116], [216, 132], [240, 126], [252, 104]] },
    { k: "line", a: [218, 140], b: [212, 152] },
    { k: "line", a: [236, 136], b: [240, 150] },
  ],
  lrrr: () => {
    // A square panel of corner cubes, tilted toward Earth on a little stand.
    const prims: Prim[] = [{ k: "poly", pts: [[70, 70], [200, 50], [230, 140], [100, 160]] }];
    for (let i = 1; i < 5; i += 1) {
      const t = i / 5;
      prims.push({ k: "line", a: [70 + 130 * t, 70 - 20 * t], b: [100 + 130 * t, 160 - 20 * t] });
      prims.push({ k: "line", a: [70 + 30 * t, 70 + 90 * t], b: [200 + 30 * t, 50 + 90 * t] });
    }
    prims.push(
      { k: "line", a: [150, 150], b: [150, 196] },
      { k: "line", a: [110, 196], b: [200, 196] },
      { k: "line", a: [130, 196], b: [150, 170] },
      { k: "line", a: [170, 196], b: [150, 170] },
      // The laser coming in and going straight back.
      { k: "line", a: [250, 20], b: [196, 92] },
      { k: "line", a: [262, 26], b: [208, 98] },
      { k: "path", d: "M250 20 L 244 34 M250 20 L 236 26" },
      { k: "path", d: "M262 26 L 268 12 M262 26 L 276 20" },
    );
    return prims;
  },
  lrv: () => [
    // Side view: a flat frame, four mesh wheels, two seats and the umbrella antenna.
    { k: "line", a: [52, 132], b: [268, 132] },
    { k: "line", a: [52, 142], b: [268, 142] },
    { k: "circle", x: 86, y: 158, d: 46 },
    { k: "circle", x: 234, y: 158, d: 46 },
    { k: "circle", x: 86, y: 158, d: 18 },
    { k: "circle", x: 234, y: 158, d: 18 },
    ...[66, 76, 96, 106].map((x) => ({ k: "line", a: [x, 140], b: [x + 6, 176] }) as Prim),
    ...[214, 224, 244, 254].map((x) => ({ k: "line", a: [x, 140], b: [x + 6, 176] }) as Prim),
    { k: "curve", pts: [[56, 136], [86, 118], [116, 136]] },
    { k: "curve", pts: [[204, 136], [234, 118], [264, 136]] },
    { k: "path", d: "M126 130 L 130 100 L 150 100 L 152 130" },
    { k: "path", d: "M162 130 L 166 100 L 186 100 L 188 130" },
    { k: "line", a: [212, 130], b: [222, 70] },
    { k: "path", d: "M196 70 C 206 52, 238 52, 248 70 Z" },
    { k: "line", a: [60, 130], b: [50, 100] },
    { k: "rect", x: 40, y: 84, w: 22, h: 16 },
  ],
  opportunity: () => [
    // Solar wings, a box body, the camera mast and six wheels.
    { k: "poly", pts: [[44, 104], [276, 104], [258, 118], [62, 118]] },
    ...[90, 136, 182, 228].map((x) => ({ k: "line", a: [x, 104], b: [x - 4, 118] }) as Prim),
    { k: "rect", x: 110, y: 118, w: 100, h: 30 },
    { k: "line", a: [196, 104], b: [196, 52] },
    { k: "rect", x: 182, y: 34, w: 30, h: 18 },
    { k: "circle", x: 190, y: 43, d: 7 },
    { k: "circle", x: 204, y: 43, d: 7 },
    { k: "line", a: [112, 146], b: [84, 170] },
    { k: "line", a: [208, 146], b: [236, 170] },
    { k: "line", a: [84, 170], b: [236, 170] },
    ...circleRow(84, 180, 3, 76, 26),
    { k: "line", a: [52, 192], b: [270, 192] },
  ],
  ingenuity: () => [
    // Two long rotors stacked on a mast, a small body, a solar panel and four legs.
    { k: "ellipse", x: 160, y: 66, w: 236, h: 14 },
    { k: "ellipse", x: 160, y: 88, w: 236, h: 14 },
    { k: "line", a: [160, 40], b: [160, 120] },
    { k: "rect", x: 140, y: 32, w: 40, h: 8 },
    { k: "rect", x: 140, y: 120, w: 40, h: 30 },
    { k: "line", a: [144, 150], b: [104, 194] },
    { k: "line", a: [176, 150], b: [216, 194] },
    { k: "line", a: [152, 150], b: [134, 196] },
    { k: "line", a: [168, 150], b: [186, 196] },
    { k: "line", a: [96, 196], b: [224, 196] },
    // The tiny swatch of Wright Flyer fabric, circled.
    { k: "rect", x: 150, y: 132, w: 10, h: 6 },
    { k: "ellipse", x: 155, y: 135, w: 30, h: 22 },
  ],
  voyager: () => [
    // The big dish, the body, the long booms and the Golden Record on its side.
    { k: "ellipse", x: 140, y: 70, w: 150, h: 46 },
    { k: "line", a: [140, 70], b: [140, 40] },
    { k: "poly", pts: [[118, 94], [162, 94], [170, 120], [110, 120]] },
    { k: "line", a: [170, 108], b: [300, 70] },
    { k: "line", a: [110, 112], b: [24, 150] },
    ...circleRow(36, 146, 3, 16, 10).map((p) => p),
    { k: "line", a: [140, 120], b: [140, 176] },
    { k: "circle", x: 188, y: 140, d: 34 },
    { k: "circle", x: 188, y: 140, d: 8 },
  ],
};
