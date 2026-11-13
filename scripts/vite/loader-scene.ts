/**
 * The loading page's scene, drawn at build time as plain SVG so it paints
 * before any script runs. It is the game's own look in 2.5D: the little home
 * planet turning slowly under the night sky, with Dad's workshop, the house,
 * the windpump and the toy rocket going round on it, Remi walking on top with
 * a letter, the Moon and Mars hanging in the sky, and letters flying the dotted
 * route out to them. Lighting sits in a layer that does not turn, so the flat
 * drawing reads as a round world going by. Each layer is its own element, so
 * the browser moves them as whole pictures.
 */

const INK = "#2B2622";
const R = 440;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const f = (n: number): string => n.toFixed(1);

/** A thing standing on the planet's rim at `deg` (0 is the top, clockwise), drawn upright with its foot at 0, 0. */
const stand = (deg: number, body: string, cls = ""): string => `<g${cls ? ` class="${cls}"` : ""} transform="rotate(${f(deg)}) translate(0 ${-R + 2})">${body}</g>`;

// ---------------------------------------------------------------- things on the planet

const glow = (x: number, y: number, r: number): string => `<circle class="glow" cx="${x}" cy="${y}" r="${r}" fill="url(#ld-warm)" stroke="none"/>`;

const lampPost = (): string =>
  `${glow(0, -132, 70)}<rect x="-4" y="-124" width="8" height="124" fill="#3B3330"/><rect x="-11" y="-6" width="22" height="8" rx="2" fill="#3B3330"/><path d="M-13 -122 L13 -122 L10 -146 L-10 -146 Z" fill="#FFD27A"/><path d="M-16 -146 L16 -146 L0 -160 Z" fill="#3B3330"/>`;

const roundTree = (k = 1): string =>
  `<g transform="scale(${k})"><rect x="-7" y="-52" width="14" height="52" fill="#6B3F2A"/><circle cx="-26" cy="-70" r="28" fill="#5E8A52"/><circle cx="24" cy="-74" r="30" fill="#6E9B5A"/><circle cx="0" cy="-92" r="40" fill="#4F7A47"/><path d="M-14 -104 C -6 -114, 8 -114, 16 -106" fill="none" stroke-width="3" opacity="0.35"/></g>`;

const pine = (k = 1): string =>
  `<g transform="scale(${k})"><rect x="-6" y="-26" width="12" height="26" fill="#6B3F2A"/><path d="M-40 -24 L40 -24 L0 -76 Z" fill="#3F6B4A"/><path d="M-32 -58 L32 -58 L0 -108 Z" fill="#4E7A57"/><path d="M-22 -90 L22 -90 L0 -134 Z" fill="#5E8A62"/></g>`;

const shed = (): string =>
  `${glow(40, -64, 90)}<rect x="-72" y="-104" width="144" height="104" fill="#B27D51"/>` +
  `<path d="M-48 -100 L-48 -2 M-24 -100 L-24 -2 M24 -100 L24 -2 M48 -100 L48 -2" stroke-width="2.5" opacity="0.35"/>` +
  `<path d="M-88 -98 L0 -152 L88 -98 Z" fill="#5F7F6C"/><path d="M-70 -108 L0 -148 L70 -108" fill="none" stroke-width="2.5" opacity="0.3"/>` +
  `<rect x="-52" y="-62" width="30" height="62" fill="#7A4A2E"/><circle cx="-28" cy="-30" r="3" fill="${INK}"/>` +
  `<rect class="win" x="18" y="-80" width="40" height="32" fill="#FFC973"/><path d="M38 -80 L38 -48 M18 -64 L58 -64" stroke-width="3"/>` +
  `<circle cx="-82" cy="-14" r="13" fill="none" stroke-width="5"/>`;

const house = (): string =>
  `<g stroke="none"><circle cx="50" cy="-200" r="12" fill="#EDE4D3"/><circle cx="58" cy="-226" r="15" fill="#EDE4D3"/><circle cx="50" cy="-256" r="18" fill="#EDE4D3"/></g>` +
  `<rect x="38" y="-196" width="22" height="44" fill="#8C8478"/>` +
  `<rect x="-84" y="-122" width="168" height="122" fill="#E6CF9F"/>` +
  `<path d="M-102 -116 L0 -200 L102 -116 Z" fill="#C0573E"/><path d="M-80 -126 L0 -192 L80 -126" fill="none" stroke-width="2.5" opacity="0.3"/>` +
  `<circle cx="0" cy="-150" r="13" fill="#FFC973"/>` +
  `<rect x="-17" y="-62" width="34" height="62" fill="#7A4A2E"/>` +
  `${glow(-48, -82, 46)}${glow(48, -82, 46)}` +
  `<rect class="win" x="-66" y="-98" width="36" height="32" fill="#FFC973"/><rect class="win" x="30" y="-98" width="36" height="32" fill="#FFC973"/>` +
  `<path d="M-48 -98 L-48 -66 M48 -98 L48 -66" stroke-width="3"/><rect x="-30" y="-6" width="60" height="8" fill="#A8744A"/>`;

const windpump = (): string =>
  `<path d="M-30 0 L-8 -168 M30 0 L8 -168" fill="none" stroke-width="6"/>` +
  `<path d="M-26 -30 L22 -60 M24 -30 L-22 -60 M-20 -80 L16 -110 M18 -80 L-16 -110 M-13 -130 L11 -152 M12 -130 L-11 -152" fill="none" stroke-width="3"/>` +
  `<path d="M0 -178 L58 -186 L64 -170 L0 -172 Z" fill="#C0573E"/>` +
  `<g><circle cx="0" cy="-178" r="40" fill="#EDE4D3"/>` +
  Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<path d="M0 -178 L${f(Math.cos(a) * 38)} ${f(-178 + Math.sin(a) * 38)}" stroke-width="3"/>`;
  }).join("") +
  `<circle cx="0" cy="-178" r="7" fill="#C0573E"/></g>`;

const rocket = (): string =>
  `<rect x="-46" y="-10" width="92" height="12" rx="3" fill="#8C8478"/>` +
  `<path d="M-14 -34 L-34 -6 L-14 -12 Z M14 -34 L34 -6 L14 -12 Z" fill="#C0573E"/>` +
  `<path d="M-17 -150 C -17 -170, 17 -170, 17 -150 L17 -14 L-17 -14 Z" fill="#F4ECDD"/>` +
  `<path d="M-17 -150 C -12 -186, 12 -186, 17 -150 Z" fill="#C0573E"/>` +
  `<rect x="-17" y="-60" width="34" height="10" fill="#C0573E"/>` +
  `<circle cx="0" cy="-112" r="10" fill="#3F5A86"/><circle cx="-3" cy="-115" r="3" fill="#9FC3E8" stroke="none"/>`;

const balloon = (): string =>
  `<path d="M0 0 C 10 -60, -10 -120, 0 -186" fill="none" stroke-width="2.5" stroke-dasharray="6 5"/>` +
  `<g><path d="M-14 -200 L-10 -186 L10 -186 L14 -200" fill="#A8744A"/><path d="M-12 -210 L-14 -200 M12 -210 L14 -200" stroke-width="2.5"/>` +
  `<path d="M0 -320 C 56 -320, 60 -250, 12 -210 L-12 -210 C -60 -250, -56 -320, 0 -320 Z" fill="#E9A66B"/>` +
  `<path d="M0 -320 C 22 -300, 22 -240, 6 -210 L-6 -210 C -22 -240, -22 -300, 0 -320 Z" fill="#C0573E"/>` +
  `<path d="M-36 -296 C -20 -310, 20 -310, 36 -296" fill="none" stroke-width="2.5" opacity="0.4"/></g>`;

const dish = (): string =>
  `<path d="M-26 0 L0 -60 L26 0" fill="none" stroke-width="6"/><rect x="-6" y="-80" width="12" height="24" fill="#8C8478"/>` +
  `<g transform="translate(0 -84) rotate(-28)"><path d="M-58 0 C -40 34, 40 34, 58 0 Z" fill="#EDE4D3"/><path d="M0 18 L0 -26" stroke-width="4"/><circle cx="0" cy="-28" r="6" fill="#C0573E"/></g>`;

const mailbox = (): string =>
  `<rect x="-5" y="-70" width="10" height="70" fill="#7A4A2E"/><path d="M-26 -70 L26 -70 L26 -98 C 26 -114, -26 -114, -26 -98 Z" fill="#5C7393"/>` +
  `<path d="M26 -96 L32 -96 L32 -122 L50 -116 L32 -110" fill="#C0573E"/>`;

const fence = (): string =>
  [-36, -12, 12, 36].map((x) => `<rect x="${x - 4}" y="-40" width="8" height="40" fill="#C79C6C"/>`).join("") + `<path d="M-44 -30 L44 -30 M-44 -14 L44 -14" stroke-width="4"/>`;

const tuft = (): string => `<path d="M-8 0 C -8 -10, -12 -16, -14 -20 M0 0 C 0 -12, 2 -20, 0 -26 M8 0 C 8 -10, 12 -16, 14 -20" fill="none" stroke="#3E5E36" stroke-width="3"/>`;

const flower = (color: string): string => `<path d="M0 0 L0 -22" stroke="#3E5E36" stroke-width="3"/><circle cx="0" cy="-26" r="7" fill="${color}"/><circle cx="0" cy="-26" r="2.5" fill="#FFE2AE" stroke="none"/>`;

/**
 * The little home planet: its face, the dirt paths over it, and everything
 * standing round its rim. It goes on the page as an image, drawn once, so
 * turning it never redraws a single path.
 */
export function planetSvg(): string {
  const random = seeded(11);
  // Lighter and darker patches of grass on the face, and dirt paths wandering over it (outlined like the map).
  const patches = Array.from({ length: 16 }, () => {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * (R - 70);
    return `<ellipse cx="${f(Math.cos(a) * d)}" cy="${f(Math.sin(a) * d)}" rx="${f(30 + random() * 50)}" ry="${f(18 + random() * 30)}" transform="rotate(${f(random() * 180)} ${f(Math.cos(a) * d)} ${f(Math.sin(a) * d)})" fill="${random() > 0.5 ? "#86AE6E" : "#5E8452"}" opacity="0.55"/>`;
  }).join("");
  const paths = [
    "M-300 -250 C -150 -120, -60 -40, 0 0 C 80 50, 200 90, 330 230",
    "M0 0 C -60 90, -140 180, -180 360",
    "M0 0 C 110 -60, 220 -150, 260 -300",
    "M-400 120 C -260 80, -120 120, -60 60",
  ];
  const pathInk = paths.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>`).join("");
  const pathDirt = paths.map((d) => `<path d="${d}" fill="none" stroke="#D9B48A" stroke-width="22" stroke-linecap="round"/>`).join("");
  const pond = `<ellipse cx="150" cy="170" rx="56" ry="36" fill="#7FA6C2" stroke="${INK}" stroke-width="5"/><path d="M120 162 C 136 156, 152 156, 166 162" fill="none" stroke="#DCEBF2" stroke-width="4" stroke-linecap="round"/>`;
  const dots = Array.from({ length: 40 }, () => {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * (R - 40);
    const c = ["#F4ECDD", "#E9A66B", "#C9B4E6", "#FFD27A"][Math.floor(random() * 4)]!;
    return `<circle cx="${f(Math.cos(a) * d)}" cy="${f(Math.sin(a) * d)}" r="${f(3 + random() * 3)}" fill="${c}"/>`;
  }).join("");

  // Round the rim, clockwise from the top, with room between so nothing crowds.
  const rim = [
    stand(18, lampPost()),
    stand(36, roundTree(0.9)),
    stand(58, shed()),
    stand(84, pine(1.05)),
    stand(94, pine(0.75)),
    stand(118, windpump()),
    stand(142, flower("#E9A66B")),
    stand(160, rocket()),
    stand(186, roundTree(1.1)),
    stand(204, balloon()),
    stand(226, pine(0.9)),
    stand(246, dish()),
    stand(268, lampPost()),
    stand(292, house()),
    stand(318, fence()),
    stand(332, mailbox()),
    stand(348, roundTree(0.8)),
  ].join("");
  const little = Array.from({ length: 26 }, (_, i) => {
    const deg = i * (360 / 26) + 5 + random() * 6;
    return stand(deg, random() > 0.35 ? tuft() : flower(["#F4ECDD", "#C9B4E6", "#FFD27A"][i % 3]!));
  }).join("");

  // Wide enough for the tallest things on the rim (the balloon), since an image clips to its box.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-800 -800 1600 1600">
    <defs>
      <radialGradient id="ld-warm"><stop offset="0" stop-color="#FFE2AE" stop-opacity="0.75"/><stop offset="0.45" stop-color="#FFC66E" stop-opacity="0.25"/><stop offset="1" stop-color="#FFAE48" stop-opacity="0"/></radialGradient>
      <clipPath id="ld-face"><circle r="${R}"/></clipPath>
    </defs>
    <circle r="${R}" fill="#6E9B5A"/>
    <g clip-path="url(#ld-face)">${patches}${pathInk}${pathDirt}${pond}${dots}</g>
    <circle r="${R}" fill="none" stroke="${INK}" stroke-width="7"/>
    <g stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">${little}${rim}</g>
  </svg>`;
}

// ---------------------------------------------------------------- Remi

/** Remi from the side, walking to the right with a letter: legs and an arm swing, the body bobs. */
export function remiSvg(): string {
  return `<svg viewBox="0 0 140 180" aria-hidden="true" focusable="false">
    <g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <g class="body">
        <g class="leg back"><rect x="58" y="118" width="16" height="44" rx="6" fill="#2F3A56"/><path d="M56 160 L80 160 C 86 160, 88 170, 80 172 L56 172 Z" fill="#5E2E24"/></g>
        <g class="arm back"><rect x="62" y="84" width="13" height="40" rx="6" fill="#A97A24"/></g>
        <rect x="38" y="78" width="26" height="46" rx="8" fill="#8E4E35"/>
        <path d="M42 84 L42 118" stroke-width="2.5" opacity="0.4"/>
        <rect x="52" y="76" width="40" height="52" rx="12" fill="#D3A13A"/>
        <g class="leg front"><rect x="66" y="118" width="16" height="44" rx="6" fill="#3D4A6B"/><path d="M64 160 L88 160 C 94 160, 96 170, 88 172 L64 172 Z" fill="#7A3B2E"/></g>
        <g class="head">
          <circle cx="76" cy="48" r="34" fill="#C68E64"/>
          <path d="M44 50 C 36 18, 70 2, 96 12 C 112 18, 114 34, 108 42 C 98 34, 86 32, 76 36 C 70 44, 58 46, 52 58 C 48 56, 46 54, 44 50 Z" fill="#3A2A22"/>
          <path d="M78 10 C 82 0, 90 -2, 96 2" fill="none" stroke-width="5"/>
          <circle cx="94" cy="52" r="4" fill="${INK}" stroke="none"/>
          <path d="M92 66 C 96 70, 102 70, 106 66" fill="none" stroke-width="3"/>
          <circle cx="86" cy="62" r="5" fill="#E79A7A" stroke="none" opacity="0.6"/>
        </g>
        <g class="arm front">
          <rect x="70" y="84" width="14" height="40" rx="6" fill="#D3A13A"/>
          <g transform="translate(72 112) rotate(-12)"><rect x="0" y="0" width="44" height="30" rx="2" fill="#F4ECDD"/><path d="M0 0 L22 16 L44 0" fill="none" stroke-width="2.5"/><rect x="31" y="4" width="9" height="11" fill="#C0573E" stroke-width="2"/></g>
        </g>
      </g>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------- the sky

/** Stars across the whole sky: one still picture (a few sparkles twinkle on their own, see `sparklesHtml`). */
export function starsSvg(): string {
  const random = seeded(23);
  const stars = Array.from({ length: 90 }, () => {
    const x = random() * 1600;
    const y = random() * 760;
    const r = 1 + random() * 2.2;
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${random() > 0.8 ? "#FFE2AE" : "#FFF6E0"}" opacity="${f(0.45 + random() * 0.55)}"/>`;
  }).join("");
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${stars}</svg>`;
}

/** Four-point sparkles that twinkle, each its own small element so only it changes. */
export function sparklesHtml(): string {
  const spots = [
    [12, 12, 0],
    [89, 14, 1.1],
    [68, 7, 2.3],
    [33, 9, 0.6],
    [8, 44, 1.8],
    [94, 46, 2.9],
  ];
  return spots.map(([x, y, d]) => `<i style="left:${x}%;top:${y}%;--d:${d}s"></i>`).join("");
}

/** The dotted routes Dad's letters fly, from the top of the home planet out to the Moon and to Mars. */
const TO_MOON = "M760 600 C 640 440, 480 330, 360 268";
const TO_MARS = "M840 600 C 980 430, 1120 360, 1252 312";

/**
 * The Moon and Mars in the sky, each with its machine on top (a gold lander,
 * a rover with blue wings), and the dotted routes Dad's letters fly.
 */
export function farSvg(): string {
  const moon = `<g class="moon"><circle cx="300" cy="240" r="62" fill="#C9C4BA"/><circle cx="280" cy="228" r="13" fill="#A9A49A"/><circle cx="322" cy="262" r="9" fill="#A9A49A"/><circle cx="300" cy="280" r="6" fill="#A9A49A"/><circle cx="330" cy="220" r="5" fill="#A9A49A"/>
    <g transform="translate(300 178)"><path d="M-12 -2 L-16 4 M12 -2 L16 4" stroke-width="2.5"/><rect x="-11" y="-14" width="22" height="13" fill="#D9A441"/></g>
    <circle cx="300" cy="240" r="62" fill="none" stroke-width="5"/></g>`;
  const mars = `<g class="mars"><circle cx="1300" cy="300" r="48" fill="#D08A5A"/><path d="M1258 296 C 1280 286, 1300 304, 1342 292" fill="none" stroke="#A85F38" stroke-width="5"/><circle cx="1288" cy="322" r="8" fill="#A85F38"/><circle cx="1318" cy="276" r="6" fill="#A85F38"/>
    <g transform="translate(1300 252)"><rect x="-10" y="-9" width="20" height="8" fill="#E9E3D6" stroke-width="2"/><rect x="-16" y="-12" width="32" height="4" fill="#3D4D78" stroke-width="2"/><circle cx="-7" cy="-1" r="3" fill="#6E6A66" stroke-width="1.5"/><circle cx="7" cy="-1" r="3" fill="#6E6A66" stroke-width="1.5"/></g>
    <circle cx="1300" cy="300" r="48" fill="none" stroke-width="5"/></g>`;
  const route = `<path d="${TO_MOON}" class="route"/><path d="${TO_MARS}" class="route"/>`;
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">${route}${moon}${mars}</g>
  </svg>`;
}

/** Two of Dad's letters flying the routes, in a layer of their own so moving them never repaints the sky. */
export function lettersSvg(): string {
  const letter = (path: string, begin: number): string =>
    `<g class="letter" opacity="0"><path d="M-14 -9 L14 -9 L14 9 L-14 9 Z" fill="#F4ECDD" stroke-width="2.5"/><path d="M-14 -9 L0 2 L14 -9" fill="none" stroke-width="2"/><rect x="5" y="-6" width="6" height="7" fill="#C0573E" stroke="none"/>
      <animateMotion dur="7s" begin="${begin}s" repeatCount="indefinite" rotate="auto" path="${path}"/>
      <animate attributeName="opacity" dur="7s" begin="${begin}s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.08;0.62;0.72;1"/></g>`;
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">${letter(TO_MOON, 0.6)}${letter(TO_MARS, 4.1)}</g>
  </svg>`;
}

/** A paper cloud with a soft ink edge. */
export function cloudSvg(seed: number): string {
  const random = seeded(seed);
  const bumps = [
    [40, 60, 34],
    [80, 44, 42],
    [128, 52, 36],
    [160, 66, 26],
  ]
    .map(([x, y, r]) => `<circle cx="${f(x! + (random() - 0.5) * 6)}" cy="${f(y! + (random() - 0.5) * 6)}" r="${r}"/>`)
    .join("");
  return `<svg viewBox="0 0 200 100" aria-hidden="true" focusable="false"><g fill="#E8DDF0" stroke="${INK}" stroke-width="4" opacity="0.9">${bumps}<rect x="14" y="62" width="168" height="26" rx="13"/></g><g fill="#E8DDF0">${bumps}<rect x="16" y="62" width="164" height="24" rx="12"/></g></svg>`;
}
