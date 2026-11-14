/** App version from package.json, injected by Vite at build time. */
declare const __APP_VERSION__: string;

/** The inline loader in index.html. It exists before any module runs. */
interface PohBoot {
  /** 0 to 1. Only moves forward. */
  progress(value: number): void;
  /** Writes line `index` of "Things that kept working". */
  milestone(index: number): void;
  /** Lights the bulb, then waits for a click, tap or key and calls `onGo` inside that gesture. */
  ready(onGo: () => void): void;
  /** No WebGL: a kind note and a link to the Field Guide. */
  fail(): void;
  /** No graphics chip: the page's loops hold still so the game loads sooner. */
  calm(): void;
  /** After the switch, ms until the live world shows through the page. */
  reveal: number;
  /** Kept for older callers: the page now leaves on its own after the switch. */
  leave(): void;
  /** Removes the page at once. */
  hide(): void;
}

interface Window {
  __pohBoot?: PohBoot;
}
