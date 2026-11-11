<script lang="ts">
  /**
   * A round rubber stamp in red ink, like a post office cancellation: two
   * rings with words between them, two short lines in the middle and wavy
   * cancel lines running off to one side. Worn rubber eats a little of the
   * ink. Used for the big stamp moment and on the notebook pages.
   */
  interface Props {
    lines: [string, string];
    top?: string;
    bottom?: string;
    size?: number | string;
    tilt?: number;
    waves?: boolean;
    label?: string;
  }
  let { lines, top = "DELIVERED BY REMI", bottom = "HOME POST", size = 200, tilt = -8, waves = true, label }: Props = $props();
  const uid = $props.id();
  // Longer lines get a smaller size so they always fit inside the inner ring.
  const fit = (text: string, max: number): number => Math.min(max, Math.round(178 / Math.max(4, text.length)));
  const s1 = $derived(fit(lines[0], 30));
  const s2 = $derived(fit(lines[1], 25));
</script>

<svg
  class="ink-stamp"
  viewBox={waves ? "0 0 330 200" : "0 0 200 200"}
  style:width={typeof size === "number" ? `${(size * (waves ? 330 : 200)) / 200}px` : size}
  style:--tilt={`${tilt}deg`}
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
>
  <defs>
    <path id={`${uid}-t`} d="M 27 100 A 73 73 0 0 1 173 100" />
    <path id={`${uid}-b`} d="M 26 100 A 74 74 0 0 0 174 100" />
    <filter id={`${uid}-worn`} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="m" />
      <feComposite in="SourceGraphic" in2="m" operator="in" />
    </filter>
  </defs>
  <g filter={`url(#${uid}-worn)`}>
    {#if waves}
      <g class="waves">
        {#each [0, 1, 2, 3, 4] as i (i)}
          <path d={`M 196 ${62 + i * 19} c 14 -9, 28 9, 42 0 s 28 9, 42 0 s 28 9, 42 0`} />
        {/each}
      </g>
    {/if}
    <circle cx="100" cy="100" r="93" class="ring outer" />
    <circle cx="100" cy="100" r="66" class="ring inner" />
    <text class="arc"><textPath href={`#${uid}-t`} startOffset="50%" text-anchor="middle">{top}</textPath></text>
    <text class="arc"><textPath href={`#${uid}-b`} startOffset="50%" text-anchor="middle" dominant-baseline="hanging">{bottom}</textPath></text>
    <path class="star" d="M14 100 l3.5 -2 2 -3.6 2 3.6 3.5 2 -3.5 2 -2 3.6 -2 -3.6 z" />
    <path class="star" d="M175 100 l3.5 -2 2 -3.6 2 3.6 3.5 2 -3.5 2 -2 3.6 -2 -3.6 z" />
    <path class="rule" d="M52 100 L 148 100" />
    <text class="line" x="100" y="92" font-size={s1} text-anchor="middle">{lines[0]}</text>
    <text class="line" x="100" y={108 + s2 * 0.72} font-size={s2} text-anchor="middle">{lines[1]}</text>
  </g>
</svg>

<style>
  .ink-stamp {
    display: block;
    height: auto;
    overflow: visible;
    color: #a83a28;
    transform: rotate(var(--tilt));
    mix-blend-mode: multiply;
  }
  .ring {
    fill: none;
    stroke: currentColor;
  }
  .outer {
    stroke-width: 7;
  }
  .inner {
    stroke-width: 3;
  }
  .arc {
    fill: currentColor;
    font: 700 15px var(--label);
    letter-spacing: 0.16em;
  }
  .line {
    fill: currentColor;
    font-family: var(--label);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .rule {
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-dasharray: 2 5;
    stroke-linecap: round;
  }
  .star {
    fill: currentColor;
  }
  .waves path {
    fill: none;
    stroke: currentColor;
    stroke-width: 5;
    stroke-linecap: round;
  }
</style>
