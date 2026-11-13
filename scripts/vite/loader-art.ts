import { GLYPHS, GLYPH_ROWS, signedArea, traceGlyph } from "../../src/game/title/letters";

/**
 * The loading page's title, made at build time as a plain SVG string so it
 * paints before any script runs: the same chunky block letters the 3D title
 * is built from (see `src/game/title/letters.ts`).
 */

type Point = [number, number];

/** A loop of grid points as an SVG path with rounded corners. Grid y runs up; SVG y runs down. */
function roundedLoop(loop: Point[], hole: boolean, ox: number, cell: number): string {
  const n = loop.length;
  const P = (x: number, y: number): string => `${((ox + x) * cell).toFixed(1)} ${((GLYPH_ROWS - y) * cell).toFixed(1)}`;
  const corner = (i: number): { b: Point; pin: Point; pout: Point } => {
    const a = loop[(i - 1 + n) % n]!;
    const b = loop[i]!;
    const c = loop[(i + 1) % n]!;
    const din: Point = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
    const dout: Point = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])];
    const convex = din[0] * dout[1] - din[1] * dout[0] > 0;
    const r = hole ? 0.16 : convex ? 0.42 : 0.12;
    return { b, pin: [b[0] - din[0] * r, b[1] - din[1] * r], pout: [b[0] + dout[0] * r, b[1] + dout[1] * r] };
  };
  const first = corner(0);
  let d = `M${P(first.pout[0], first.pout[1])}`;
  for (let i = 1; i <= n; i += 1) {
    const k = i === n ? first : corner(i);
    d += ` L${P(k.pin[0], k.pin[1])} Q${P(k.b[0], k.b[1])} ${P(k.pout[0], k.pout[1])}`;
  }
  return `${d} Z`;
}

function simplify(loop: Point[]): Point[] {
  return loop.filter((b, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length]!;
    const c = loop[(i + 1) % loop.length]!;
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0;
  });
}

/** One block letter's outline (with its holes) as a single path, placed `ox` cells from the left. */
function letterPath(letter: string, ox: number, cell: number): string {
  const loops = traceGlyph(GLYPHS[letter]!).map(simplify);
  return loops.map((loop) => roundedLoop(loop, signedArea(loop) < 0, ox, cell)).join(" ");
}

const width = (letter: string): number => GLYPHS[letter]![0]!.length;

/**
 * The game's title the way the 3D title builds it: chunky block letters in
 * three lines (PIECES, OF, HOME), cream faces on wooden sides with a thick ink
 * outline, OF in amber, and the O of HOME a light bulb that lights when the
 * light is turned on. Each letter drops in on its own, like the 3D blocks.
 */
export function blockTitle(): string {
  const cell = 10;
  const lines = ["PIECES", "OF", "HOME"];
  const faces = ["#FFF6E4", "#F7A93A", "#FFF6E4"];
  const lineHeight = (GLYPH_ROWS + 1.4) * cell;
  const widthOf = (word: string): number => [...word].reduce((s, ch) => s + width(ch), 0) + (word.length - 1);
  const maxW = Math.max(...lines.map(widthOf));
  const depth: [number, number] = [0.42 * cell, 0.52 * cell];
  const parts: string[] = [];
  let bulb = "";
  let order = 0;
  lines.forEach((word, row) => {
    let x = (maxW - widthOf(word)) / 2;
    const y = row * lineHeight;
    for (const letter of word) {
      const w = width(letter);
      const lean = ((order * 7919) % 7) / 7 > 0.6 ? (order % 2 ? 2 : -1.7) : 0;
      const cx = (x + w / 2) * cell;
      const cy = y + (GLYPH_ROWS / 2) * cell;
      if (row === 2 && letter === "O") {
        // The bulb: glass over a screw base, a coiled filament, and a glow for when the light comes on.
        const bx = cx;
        const top = y - 0.2 * cell;
        bulb = `<g class="blk bulb" style="--i:${order}">
          <circle class="bulb-glow" cx="${bx}" cy="${top + 2.1 * cell}" r="${4.2 * cell}" fill="url(#t-glow)"/>
          <path class="bulb-glass" d="M${bx - 1.2 * cell} ${top + 3.6 * cell} C ${bx - 1.2 * cell} ${top + 3.0 * cell}, ${bx - 2.2 * cell} ${top + 2.6 * cell}, ${bx - 2.2 * cell} ${top + 1.7 * cell} C ${bx - 2.2 * cell} ${top + 0.4 * cell}, ${bx - 1.2 * cell} ${top - 0.2 * cell}, ${bx} ${top - 0.2 * cell} C ${bx + 1.2 * cell} ${top - 0.2 * cell}, ${bx + 2.2 * cell} ${top + 0.4 * cell}, ${bx + 2.2 * cell} ${top + 1.7 * cell} C ${bx + 2.2 * cell} ${top + 2.6 * cell}, ${bx + 1.2 * cell} ${top + 3.0 * cell}, ${bx + 1.2 * cell} ${top + 3.6 * cell} Z"/>
          <path class="bulb-wire" d="M${bx - 0.55 * cell} ${top + 3.55 * cell} L ${bx - 0.45 * cell} ${top + 2.2 * cell} M${bx + 0.55 * cell} ${top + 3.55 * cell} L ${bx + 0.45 * cell} ${top + 2.2 * cell} M${bx - 0.45 * cell} ${top + 2.2 * cell} C ${bx - 0.3 * cell} ${top + 1.6 * cell}, ${bx - 0.15 * cell} ${top + 2.6 * cell}, ${bx} ${top + 2.0 * cell} C ${bx + 0.15 * cell} ${top + 1.4 * cell}, ${bx + 0.3 * cell} ${top + 2.6 * cell}, ${bx + 0.45 * cell} ${top + 2.2 * cell}"/>
          <path class="bulb-base" d="M${bx - 1.2 * cell} ${top + 3.65 * cell} L ${bx + 1.2 * cell} ${top + 3.65 * cell} L ${bx + 1.1 * cell} ${top + 4.15 * cell} L ${bx - 1.1 * cell} ${top + 4.15 * cell} Z M${bx - 1.1 * cell} ${top + 4.15 * cell} L ${bx + 1.1 * cell} ${top + 4.15 * cell} L ${bx + 1.0 * cell} ${top + 4.65 * cell} L ${bx - 1.0 * cell} ${top + 4.65 * cell} Z M${bx - 0.6 * cell} ${top + 4.65 * cell} C ${bx - 0.5 * cell} ${top + 5.2 * cell}, ${bx + 0.5 * cell} ${top + 5.2 * cell}, ${bx + 0.6 * cell} ${top + 4.65 * cell}"/>
        </g>`;
      } else {
        const d = letterPath(letter, x, cell);
        const steps = [1, 0.8, 0.6, 0.4, 0.2]
          .map((k, i) => `<path d="${d}" transform="translate(${(depth[0] * k).toFixed(1)} ${(depth[1] * k).toFixed(1)})"${i === 0 ? ' class="back"' : ' class="side"'}/>`)
          .join("");
        parts.push(`<g class="blk" style="--i:${order}" transform="translate(0 ${y}) rotate(${lean} ${cx} ${cy - y})">${steps}<path class="face" d="${d}" fill="${faces[row]}"/></g>`);
      }
      x += w + 1;
      order += 1;
    }
  });
  const w = maxW * cell;
  const h = 2 * lineHeight + GLYPH_ROWS * cell;
  return `<svg class="title-art" viewBox="${-1.2 * cell} ${-2.4 * cell} ${w + 2.4 * cell} ${h + 3.4 * cell}" role="img" aria-labelledby="boot-title">
    <defs><radialGradient id="t-glow"><stop offset="0" stop-color="#fff2c6"/><stop offset="0.35" stop-color="#ffcf74" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient></defs>
    ${parts.join("")}${bulb}
  </svg>`;
}
