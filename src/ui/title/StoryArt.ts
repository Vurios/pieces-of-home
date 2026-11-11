import type { StoryArt } from "../../content/story";

/**
 * Dad's drawings for the opening story, as SVG on a 480 by 300 page.
 * Each has a colour wash (printed a little off the line, like a cheap
 * two-colour print) and ink lines that draw themselves in.
 */
export interface Drawing {
  wash: string;
  ink: string;
}

const STARS = `<path d="M40 40 l 0 -10 M35 35 l 10 0 M444 120 l 0 -8 M440 116 l 8 0 M300 30 l 0 -8 M296 26 l 8 0" />`;

export const STORY_ART: Record<StoryArt, Drawing> = {
  home: {
    wash: `
      <circle cx="392" cy="62" r="24" fill="#fff1c2" />
      <path d="M40 300 C 60 170, 420 170, 440 300 Z" fill="#b5cda0" />
      <g transform="rotate(-14 134 218)"><rect x="106" y="172" width="58" height="46" fill="#f3e3c3" /><path d="M98 174 L 135 140 L 172 174 Z" fill="#df8b6c" /><rect x="128" y="184" width="15" height="15" fill="#ffd27a" /></g>
      <g transform="rotate(13 336 214)"><rect x="306" y="178" width="62" height="40" fill="#c98a5a" /><path d="M298 180 L 337 154 L 376 180 Z" fill="#8fb488" /><rect x="324" y="190" width="14" height="13" fill="#ffd27a" /></g>
      <path d="M218 186 L 236 186 L 234 160 L 220 160 Z" fill="#9fc1d6" />
      <path d="M246 188 L 260 188 L 259 172 L 247 172 Z" fill="#e9b44c" />
      <rect x="259" y="172" width="8" height="13" fill="#b5523a" />`,
    ink: `
      <path d="M40 300 C 60 170, 420 170, 440 300" />
      <path d="M402 44 C 384 46, 376 68, 392 80 C 404 88, 418 82, 420 74 C 408 78, 394 70, 396 58 C 397 50, 400 46, 402 44 Z" />
      ${STARS}
      <g transform="rotate(-14 134 218)"><path d="M106 172 L 106 218 L 164 218 L 164 172" /><path d="M98 174 L 135 140 L 172 174" /><path d="M128 184 L 143 184 L 143 199 L 128 199 Z" /><path d="M150 218 L 150 196 L 160 196 L 160 218" /><path d="M150 152 L 150 138 L 158 138 L 158 160" /></g>
      <g transform="rotate(13 336 214)"><path d="M306 180 L 306 218 L 368 218 L 368 180" /><path d="M298 180 L 337 154 L 376 180" /><path d="M324 190 L 338 190 L 338 203 L 324 203 Z" /><path d="M346 218 L 346 192 L 360 192 L 360 218" /></g>
      <circle cx="227" cy="151" r="8" /><path d="M220 160 L 234 160 L 236 186 L 218 186 Z" /><path d="M223 186 L 223 202 M231 186 L 231 202" />
      <circle cx="253" cy="164" r="7" /><path d="M247 172 L 259 172 L 260 188 L 246 188 Z" /><path d="M259 173 L 267 173 L 267 186 L 260 186" /><path d="M250 188 L 250 202 M256 188 L 256 202" />
      <path d="M234 170 C 239 175, 243 177, 247 177" />`,
  },
  bench: {
    wash: `
      <circle cx="152" cy="116" r="54" fill="#ffe7a8" />
      <rect x="40" y="190" width="400" height="16" fill="#c98a5a" />
      <path d="M296 190 A 34 34 0 0 1 364 190 Z" fill="#dcecf3" />
      <path d="M374 190 A 26 26 0 0 1 426 190 Z" fill="#dcecf3" />
      <circle cx="330" cy="178" r="12" fill="#b5cda0" />
      <circle cx="400" cy="181" r="9" fill="#e6a47a" />
      <rect x="200" y="140" width="50" height="40" fill="#a9c0d3" />
      <path d="M204 140 C 204 116, 246 116, 246 140 Z" fill="#f3e3c3" />`,
    ink: `
      <path d="M40 190 L 440 190 L 440 206 L 40 206 Z" />
      <path d="M64 206 L 64 292 M416 206 L 416 292" />
      <path d="M94 190 C 94 180, 142 180, 142 190" />
      <path d="M118 184 L 104 142 L 140 110" />
      <path d="M108 168 L 116 166 M106 160 L 114 158 M104 152 L 112 150" />
      <path d="M140 110 L 160 94 L 182 126 L 154 138 Z" />
      <path d="M160 132 C 162 144, 176 142, 174 130" />
      <path d="M200 140 L 250 140 L 250 180 L 200 180 Z" />
      <path d="M204 140 C 204 116, 246 116, 246 140" />
      <circle cx="217" cy="160" r="4" /><circle cx="233" cy="160" r="4" />
      <circle cx="212" cy="184" r="7" />
      <circle cx="238" cy="184" r="7" stroke-dasharray="3 4" class="keep" />
      <path d="M296 190 A 34 34 0 0 1 364 190" /><circle cx="330" cy="178" r="12" />
      <path d="M374 190 A 26 26 0 0 1 426 190" /><circle cx="400" cy="181" r="9" />
      <path d="M318 98 l 0 -10 M313 93 l 10 0" />`,
  },
  door: {
    wash: `
      <rect x="90" y="54" width="300" height="236" fill="#c98a5a" />
      <path d="M80 60 L 240 0 L 400 60 Z" fill="#8fb488" />
      <rect x="306" y="84" width="54" height="42" fill="#ffd27a" />
      <path d="M268 290 L 286 116 L 300 116 L 330 290 Z" fill="#ffd27a" />
      <rect x="190" y="116" width="96" height="174" fill="#8a5a3a" />
      <circle cx="150" cy="200" r="13" fill="#e9c46a" />`,
    ink: `
      <path d="M90 60 L 90 290 M390 60 L 390 290" />
      <path d="M80 60 L 240 0 L 400 60 Z" />
      <path d="M90 110 L 190 110 M90 160 L 190 160 M90 210 L 190 210 M300 160 L 390 160 M300 210 L 390 210" />
      <path d="M190 116 L 286 116 L 286 290 L 190 290 Z" />
      <path d="M286 116 L 300 118 L 300 290" />
      <circle cx="274" cy="206" r="4" />
      <path d="M306 84 L 360 84 L 360 126 L 306 126 Z M333 84 L 333 126 M306 105 L 360 105" />
      <circle cx="150" cy="200" r="13" /><circle cx="150" cy="200" r="4" />
      <path d="M163 200 L 198 200 M186 200 L 186 209 M193 200 L 193 207" />
      <path d="M30 40 l 0 -10 M25 35 l 10 0 M450 30 l 0 -8 M446 26 l 8 0" />`,
  },
  letters: {
    wash: `
      <circle cx="92" cy="74" r="30" fill="#ebe6d8" />
      <circle cx="392" cy="82" r="28" fill="#e6a47a" />
      <circle cx="240" cy="38" r="12" fill="#fff1c2" />
      <rect x="128" y="150" width="34" height="24" fill="#fffaf0" transform="rotate(-20 145 162)" />
      <rect x="300" y="160" width="34" height="24" fill="#fffaf0" transform="rotate(16 317 172)" />
      <rect x="224" y="118" width="34" height="24" fill="#fffaf0" transform="rotate(-4 241 130)" />`,
    ink: `
      <path d="M240 270 C 190 230, 120 200, 100 112" stroke-dasharray="3 8" class="keep" />
      <path d="M240 270 C 300 230, 370 200, 386 118" stroke-dasharray="3 8" class="keep" />
      <path d="M240 270 C 236 200, 240 120, 240 58" stroke-dasharray="3 8" class="keep" />
      <circle cx="92" cy="74" r="30" /><circle cx="82" cy="66" r="6" /><circle cx="102" cy="84" r="4" />
      <circle cx="392" cy="82" r="28" /><path d="M368 76 C 382 70, 398 82, 416 74 M370 92 C 384 86, 400 98, 414 90" />
      <path d="M232 38 L 248 38 M240 30 L 240 46 M234 32 L 246 44 M246 32 L 234 44" />
      <g transform="rotate(-20 145 162)"><path d="M128 150 L 162 150 L 162 174 L 128 174 Z" /><path d="M128 150 L 145 164 L 162 150" /></g>
      <g transform="rotate(16 317 172)"><path d="M300 160 L 334 160 L 334 184 L 300 184 Z" /><path d="M300 160 L 317 174 L 334 160" /></g>
      <g transform="rotate(-4 241 130)"><path d="M224 118 L 258 118 L 258 142 L 224 142 Z" /><path d="M224 118 L 241 132 L 258 118" /></g>
      <path d="M200 286 C 220 276, 260 276, 280 286" />
      <path d="M40 150 l 0 -10 M35 145 l 10 0 M450 200 l 0 -10 M445 195 l 10 0" />`,
  },
  milo: {
    wash: `
      <path d="M190 128 L 214 64 L 266 64 L 290 128 Z" fill="#f3e3c3" />
      <circle cx="240" cy="116" r="16" fill="#5a5866" />
      <rect x="186" y="146" width="108" height="80" fill="#a9c0d3" />
      <rect x="60" y="256" width="360" height="12" fill="#c98a5a" />
      <rect x="352" y="214" width="16" height="42" fill="#d0654c" transform="rotate(30 360 235)" />`,
    ink: `
      <path d="M190 128 L 214 64 L 266 64 L 290 128 Z" />
      <circle cx="240" cy="116" r="16" />
      <path d="M232 128 L 232 146 M248 128 L 248 146" />
      <path d="M198 146 L 282 146 C 290 146, 294 150, 294 158 L 294 214 C 294 222, 290 226, 282 226 L 198 226 C 190 226, 186 222, 186 214 L 186 158 C 186 150, 190 146, 198 146 Z" />
      <circle cx="240" cy="186" r="13" stroke-dasharray="3 4" class="keep" />
      <path d="M186 172 L 160 196 L 150 190" />
      <path d="M294 172 L 318 194" stroke-dasharray="3 5" class="keep" />
      <circle cx="210" cy="240" r="15" /><circle cx="210" cy="240" r="4" />
      <circle cx="270" cy="240" r="15" stroke-dasharray="3 5" class="keep" />
      <path d="M60 256 L 420 256" />
      <g transform="rotate(30 360 235)"><path d="M352 214 L 368 214 L 368 256 L 352 256 Z" /><path d="M360 214 L 360 180" /></g>
      <path d="M120 120 l 0 -10 M115 115 l 10 0 M380 90 l 0 -10 M375 85 l 10 0" />`,
  },
  go: {
    wash: `
      <path d="M30 250 C 160 236, 320 236, 450 250 L 450 300 L 30 300 Z" fill="#b5cda0" />
      <path d="M318 190 L 318 164 C 318 152, 362 152, 362 164 L 362 190 Z" fill="#9fc1d6" />
      <path d="M376 150 L 392 156 L 376 162 Z" fill="#d0654c" />
      <path d="M236 248 L 280 244 L 278 236 L 298 246 L 280 256 L 280 250 L 238 254 Z" fill="#fffaf0" />
      <path d="M184 186 L 206 186 L 204 214 L 186 214 Z" fill="#e9b44c" />
      <rect x="170" y="186" width="14" height="22" fill="#b5523a" />`,
    ink: `
      <path d="M30 250 C 160 236, 320 236, 450 250" />
      <path d="M340 242 L 340 190" />
      <path d="M318 190 L 318 164 C 318 152, 362 152, 362 164 L 362 190 Z" />
      <path d="M362 172 L 376 172 L 376 150 L 392 156 L 376 162" />
      <path d="M236 248 L 280 244 L 278 236 L 298 246 L 280 256 L 280 250 L 238 254 Z" />
      <circle cx="196" cy="174" r="11" />
      <path d="M186 186 L 206 186 L 204 214 L 186 214 Z" />
      <path d="M184 188 L 170 188 L 170 208 L 184 208" />
      <path d="M190 214 L 182 238 M200 214 L 212 236" />
      <path d="M206 192 L 222 204" />
      ${STARS}`,
  },
};
