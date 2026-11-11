<script lang="ts" module>
  /**
   * Dad's homemade mission patches, one per machine, like the embroidered
   * patches crews sew on their jackets. They are our own designs: a twill
   * circle, a satin-stitch border, the machine in thread and its name round
   * the edge. A patch not earned yet is only a pencil outline.
   */
  export type PatchId = "notebook" | "lamp" | "lrrr" | "lrv" | "opportunity" | "ingenuity" | "voyager";

  interface PatchDesign {
    top: string;
    bottom: string;
    /** Twill, border thread and the main thread colour. */
    cloth: string;
    rim: string;
    thread: string;
    art: string;
  }

  const STARS = `<path class="star" d="M30 40 l1.6 3.4 3.6 .5 -2.6 2.5 .6 3.6 -3.2 -1.7 -3.2 1.7 .6 -3.6 -2.6 -2.5 3.6 -.5 z" /><path class="star" d="M90 34 l1.2 2.5 2.7 .4 -2 1.9 .5 2.7 -2.4 -1.3 -2.4 1.3 .5 -2.7 -2 -1.9 2.7 -.4 z" />`;

  export const PATCHES: Record<PatchId, PatchDesign> = {
    notebook: {
      top: "DAD'S NOTEBOOK",
      bottom: "FOR REMI",
      cloth: "#2e2a4f",
      rim: "#e9b44c",
      thread: "#fbe7b8",
      art: `${STARS}
        <ellipse class="orbit" cx="60" cy="64" rx="34" ry="12" transform="rotate(-14 60 64)" />
        <circle cx="60" cy="64" r="15" fill="#8fb488" /><path d="M46 66 C 54 62, 64 70, 74 63" class="thin" />
        <path d="M54 52 L 54 46 L 60 41 L 66 46 L 66 52" fill="#f3e3c3" class="thin" />
        <g transform="translate(88 52) rotate(-18)"><rect x="-7" y="-5" width="14" height="10" rx="1" fill="#fffaf0" /><path d="M-7 -5 L 0 1 L 7 -5" class="thin" /></g>`,
    },
    lamp: {
      top: "THE LAMP",
      bottom: "HOME",
      cloth: "#2e2a4f",
      rim: "#e9b44c",
      thread: "#fbe7b8",
      art: `${STARS}
        <circle cx="70" cy="58" r="20" fill="#f2a541" opacity=".35" />
        <path d="M42 84 L 70 84" class="line" /><path d="M48 84 L 52 66 L 66 52" class="line" />
        <path d="M62 46 L 76 40 L 82 56 L 70 60 Z" fill="#f2a541" class="thin" /><circle cx="76" cy="60" r="4" fill="#fff4cf" />`,
    },
    lrrr: {
      top: "LITTLE MIRRORS",
      bottom: "MOON",
      cloth: "#3f5677",
      rim: "#d7dbe0",
      thread: "#eef1f4",
      art: `<circle cx="84" cy="36" r="9" fill="#9fc1d6" /><path d="M78 34 C 82 32, 86 38, 90 35" class="thin" />
        <path d="M30 80 C 46 74, 74 74, 92 80 L 92 92 L 30 92 Z" fill="#c9ced6" />
        <g transform="translate(46 62)"><rect x="0" y="0" width="22" height="14" fill="#eef1f4" class="thin" /><path d="M7 0 L 7 14 M14 0 L 14 14 M0 7 L 22 7" class="thin" /></g>
        <path d="M60 60 L 81 42" class="beam" />`,
    },
    lrv: {
      top: "MOON BUGGY",
      bottom: "MOON",
      cloth: "#3f5677",
      rim: "#d7dbe0",
      thread: "#eef1f4",
      art: `${STARS}
        <path d="M24 82 C 46 74, 76 74, 98 82 L 98 94 L 24 94 Z" fill="#c9ced6" />
        <path d="M38 86 C 52 82, 66 82, 86 86" class="beam" />
        <path d="M44 66 L 78 66 L 74 58 L 50 58 Z" fill="#eef1f4" class="thin" />
        <circle cx="50" cy="70" r="5" fill="#3f5677" class="thin" /><circle cx="72" cy="70" r="5" fill="#3f5677" class="thin" />
        <path d="M70 58 L 72 48 M66 48 L 78 48" class="thin" />`,
    },
    opportunity: {
      top: "KEPT GOING",
      bottom: "MARS",
      cloth: "#b5523a",
      rim: "#f2c28b",
      thread: "#fde6c8",
      art: `<circle cx="84" cy="36" r="7" fill="#fde6c8" />
        <path d="M22 80 C 44 72, 78 72, 100 80 L 100 94 L 22 94 Z" fill="#8f3b27" />
        <path d="M40 60 L 82 60 M44 60 L 46 66 M78 60 L 76 66" class="line" />
        <rect x="52" y="62" width="18" height="9" fill="#fde6c8" class="thin" />
        <circle cx="54" cy="75" r="3.5" fill="#fde6c8" /><circle cx="68" cy="75" r="3.5" fill="#fde6c8" />
        <path d="M66 62 L 68 52 L 72 52" class="thin" />`,
    },
    ingenuity: {
      top: "LITTLE HELICOPTER",
      bottom: "MARS",
      cloth: "#b5523a",
      rim: "#f2c28b",
      thread: "#fde6c8",
      art: `${STARS}
        <path d="M22 84 C 44 78, 78 78, 100 84 L 100 96 L 22 96 Z" fill="#8f3b27" />
        <ellipse cx="60" cy="86" rx="12" ry="2.5" fill="#6e2c1c" />
        <path d="M42 48 L 78 44 M44 54 L 76 56" class="line" />
        <path d="M60 46 L 60 62" class="line" /><rect x="54" y="60" width="12" height="9" rx="2" fill="#fde6c8" />
        <path d="M55 69 L 50 78 M65 69 L 70 78" class="thin" />`,
    },
    voyager: {
      top: "FARTHEST LETTER",
      bottom: "SPACE",
      cloth: "#1f2547",
      rim: "#e8c15a",
      thread: "#fff2c6",
      art: `${STARS}<path class="star" d="M44 84 l1 2 2 .3 -1.5 1.4 .4 2 -1.9 -1 -1.9 1 .4 -2 -1.5 -1.4 2 -.3 z" />
        <path d="M26 74 C 40 66, 52 62, 62 60" class="beam" />
        <circle cx="72" cy="56" r="11" fill="#e8c15a" /><circle cx="72" cy="56" r="3" fill="#1f2547" />
        <path d="M66 46 C 70 40, 80 40, 84 46" class="line" /><path d="M75 45 L 84 32" class="thin" />`,
    },
  };
</script>

<script lang="ts">
  interface Props {
    id: PatchId;
    earned?: boolean;
    size?: number;
    tilt?: number;
    label?: string;
  }
  let { id, earned = true, size = 96, tilt = 0, label }: Props = $props();
  const p = $derived(PATCHES[id]);
  const uid = $props.id();
</script>

<svg
  class="patch"
  class:pencil={!earned}
  viewBox="0 0 120 120"
  width={size}
  height={size}
  style:--tilt={`${tilt}deg`}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  <defs>
    <path id={`${uid}-top`} d="M 18 60 A 42 42 0 0 1 102 60" />
    <path id={`${uid}-bottom`} d="M 19.5 60 A 40.5 40.5 0 0 0 100.5 60" />
    <pattern id={`${uid}-twill`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0 L 0 4" stroke="rgba(255,255,255,0.07)" stroke-width="1.6" />
    </pattern>
    <clipPath id={`${uid}-face`}><circle cx="60" cy="60" r="31" /></clipPath>
  </defs>
  {#if earned}
    <!-- Satin-stitch border, twill face, a ring for the words. -->
    <circle cx="60" cy="60" r="58" fill={p.rim} />
    <circle cx="60" cy="60" r="55.5" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.2" stroke-dasharray="0.8 1.6" />
    <circle cx="60" cy="60" r="51" fill={p.cloth} />
    <circle cx="60" cy="60" r="51" fill={`url(#${uid}-twill)`} />
    <circle cx="60" cy="60" r="33" fill="none" stroke={p.rim} stroke-width="2.2" />
    <g class="art" clip-path={`url(#${uid}-face)`} style:--thread={p.thread}>
      <circle cx="60" cy="60" r="31" fill={p.cloth} />
      {@html p.art}
    </g>
    <text class="ring" fill={p.thread}><textPath href={`#${uid}-top`} startOffset="50%" text-anchor="middle">{p.top}</textPath></text>
    <text class="ring" fill={p.thread}><textPath href={`#${uid}-bottom`} startOffset="50%" text-anchor="middle" dominant-baseline="hanging">{p.bottom}</textPath></text>
  {:else}
    <circle cx="60" cy="60" r="55" class="outline" />
    <circle cx="60" cy="60" r="33" class="outline faint" />
  {/if}
</svg>

<style>
  .patch {
    display: block;
    overflow: visible;
    transform: rotate(var(--tilt));
    filter: drop-shadow(0 2px 0 rgba(43, 38, 34, 0.35)) drop-shadow(0 6px 6px rgba(43, 38, 34, 0.18));
  }
  .patch.pencil {
    filter: none;
  }
  .ring {
    font: 700 9.5px var(--label);
    letter-spacing: 0.12em;
  }
  .art :global(.line) {
    fill: none;
    stroke: var(--thread);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .art :global(.thin) {
    stroke: var(--thread);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .art :global(path.thin:not([fill])) {
    fill: none;
  }
  .art :global(.beam) {
    fill: none;
    stroke: #f2a541;
    stroke-width: 2;
    stroke-dasharray: 2 3;
    stroke-linecap: round;
  }
  .art :global(.orbit) {
    fill: none;
    stroke: var(--thread);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }
  .art :global(.star) {
    fill: var(--thread);
  }
  .outline {
    fill: none;
    stroke: rgba(107, 98, 88, 0.55);
    stroke-width: 1.6;
    stroke-dasharray: 4 4;
  }
  .outline.faint {
    stroke: rgba(107, 98, 88, 0.3);
  }
</style>
