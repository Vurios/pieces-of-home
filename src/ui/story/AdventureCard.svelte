<script lang="ts">
  import { audio } from "../../audio/audio";
  import { ADVENTURE } from "../../content/story";
  import { trap } from "../focus";
  import { settings } from "../settings.svelte";

  /**
   * "Your adventure": the one card that says what the whole game is about and
   * what to do, shown once when a new story starts, right after the camera
   * lands behind Remi. Three steps, each with a little moving drawing (the
   * letters, Dad's little worlds, Milo), then the five keys that matter.
   * Any of E, Enter, Space, Escape, a click, a tap or gamepad A or B closes it.
   */
  interface Props {
    ondone: () => void;
  }
  let { ondone }: Props = $props();
  let closing = false;

  function close(): void {
    if (closing) return;
    closing = true;
    audio.ui("pop");
    ondone();
  }

  function onkey(event: KeyboardEvent): void {
    if (["KeyE", "Enter", "Space", "Escape", "NumpadEnter"].includes(event.code) || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  // Gamepad A or B closes it too. Wait for the buttons to be let go first, so the press that skipped the story does not.
  $effect(() => {
    let frame = 0;
    let armed = false;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      if (!pad) return;
      const down = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
      if (!down) armed = true;
      else if (armed) close();
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    audio.ui("toast");
  });
</script>

<svelte:window onkeydown={onkey} />

<div class="scrim" aria-hidden="true"></div>
<div class="wrap">
  <div class="card sheet" role="dialog" aria-modal="true" aria-labelledby="adv-title" tabindex="-1" use:trap={{ initial: ".go" }} class:still={settings.reducedMotion}>
    <span class="tape" aria-hidden="true"></span>
    <p class="kicker">{ADVENTURE.kicker}</p>
    <h2 id="adv-title">{ADVENTURE.title}</h2>
    <p class="goal"><span class="star" aria-hidden="true">★</span>{ADVENTURE.goal}</p>
    <ol class="steps">
      <li style:--i={0}>
        <span class="n" aria-hidden="true">1</span>
        <svg class="art letters" viewBox="0 0 120 90" aria-hidden="true">
          <ellipse class="shadow" cx="60" cy="80" rx="34" ry="5" />
          <g class="env back-env">
            <rect x="30" y="30" width="56" height="38" rx="3" class="paper2" />
            <path d="M30 31 L 58 52 L 86 31" class="ink" />
          </g>
          <g class="env front-env">
            <rect x="22" y="38" width="60" height="40" rx="3" class="paper" />
            <path d="M22 39 L 52 61 L 82 39" class="ink" />
            <path d="M22 78 L 44 58 M82 78 L 60 58" class="ink thin" />
            <circle cx="52" cy="61" r="5.5" class="seal" />
          </g>
          <path class="spark s1" d="M96 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" />
          <path class="spark s2" d="M16 24 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" />
        </svg>
        <h3>{ADVENTURE.steps[0]!.title}</h3>
        <p>{ADVENTURE.steps[0]!.text}</p>
      </li>
      <li style:--i={1}>
        <span class="n" aria-hidden="true">2</span>
        <svg class="art dome" viewBox="0 0 120 90" aria-hidden="true">
          <ellipse class="shadow" cx="60" cy="82" rx="40" ry="5" />
          <rect x="22" y="70" width="76" height="9" rx="3" class="wood" />
          <g class="spin">
            <circle cx="60" cy="50" r="17" class="moon" />
            <circle cx="53" cy="45" r="3.4" class="crater" />
            <circle cx="66" cy="56" r="2.6" class="crater" />
            <circle cx="64" cy="42" r="1.8" class="crater" />
          </g>
          <path d="M60 33 l0 -7 l7 2.5 l-7 2.5" class="flag" />
          <path d="M26 70 C 26 30, 44 16, 60 16 C 76 16, 94 30, 94 70" class="glass" />
          <path d="M36 58 C 36 40, 44 28, 54 24" class="shine" />
          <path class="spark s1" d="M100 26 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" />
        </svg>
        <h3>{ADVENTURE.steps[1]!.title}</h3>
        <p>{ADVENTURE.steps[1]!.text}</p>
      </li>
      <li style:--i={2}>
        <span class="n" aria-hidden="true">3</span>
        <svg class="art milo" viewBox="0 0 120 90" aria-hidden="true">
          <ellipse class="shadow" cx="60" cy="82" rx="30" ry="5" />
          <g class="bot">
            <rect x="40" y="48" width="40" height="28" rx="6" class="body" />
            <rect x="47" y="56" width="26" height="9" rx="2" class="panel" />
            <rect x="56" y="38" width="8" height="12" class="neck" />
            <g class="head">
              <circle cx="60" cy="30" r="15" class="face" />
              <circle cx="54" cy="29" r="3" class="eye" />
              <circle cx="66" cy="29" r="3" class="eye" />
              <path d="M55 36 C 58 38.5, 62 38.5, 65 36" class="ink" />
            </g>
          </g>
          <g class="part">
            <circle cx="96" cy="58" r="8" class="gear" />
            <circle cx="96" cy="58" r="3" class="paper" />
          </g>
          <path class="spark s2" d="M22 30 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" />
        </svg>
        <h3>{ADVENTURE.steps[2]!.title}</h3>
        <p>{ADVENTURE.steps[2]!.text}</p>
      </li>
    </ol>
    <p class="help">{ADVENTURE.help}</p>
    <ul class="keys" aria-label={ADVENTURE.keysLabel}>
      {#each ADVENTURE.keys as k (k.key)}
        <li><span class="key">{k.key}</span> {k.label}</li>
      {/each}
    </ul>
    <button type="button" class="btn amber go" onclick={close}>
      {ADVENTURE.go} <span class="key small" aria-hidden="true">E</span>
    </button>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    background: radial-gradient(ellipse at 50% 45%, rgba(30, 18, 12, 0.25), rgba(16, 9, 6, 0.6));
    animation: fade 0.4s ease both;
  }
  .wrap {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    pointer-events: none;
  }
  .sheet {
    position: relative;
    width: min(940px, 100%);
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 28px 34px 26px;
    pointer-events: auto;
    background-color: #fbf6ec;
    background-image: var(--grain);
    border: 3px solid var(--ink);
    border-radius: 16px;
    box-shadow:
      0 6px 0 var(--ink),
      0 28px 60px rgba(10, 8, 24, 0.45);
    rotate: -0.4deg;
    text-align: center;
    animation: drop 0.55s var(--ease-spring) both;
  }
  .sheet:focus {
    outline: none;
  }
  .tape {
    position: absolute;
    top: -14px;
    left: 50%;
    width: 120px;
    height: 26px;
    translate: -50% 0;
    background: rgba(214, 196, 150, 0.75);
    rotate: -2deg;
  }
  .kicker {
    display: inline-block;
    margin: 0 0 4px;
    padding: 3px 10px;
    border: 2px solid #b8433a;
    border-radius: 4px;
    color: #b8433a;
    font: 700 0.72rem/1.2 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    rotate: -2deg;
  }
  h2 {
    margin: 2px 0 10px;
    font: 700 clamp(2rem, 3.4vw, 2.7rem) / 1.05 var(--hand);
    color: var(--ink);
  }
  /* The main goal, said first and big: the machines left behind, and their true stories. */
  .goal {
    margin: 0 0 18px;
    padding: 10px 16px 10px 14px;
    display: flex;
    align-items: baseline;
    gap: 10px;
    border: 2px solid var(--ink);
    border-radius: 10px;
    background: #fff1cf;
    box-shadow: 0 3px 0 var(--ink);
    font: 700 1.15rem/1.35 var(--read);
    color: var(--ink);
    rotate: -0.4deg;
  }
  .goal .star {
    flex: none;
    color: #e0902a;
    font-size: 1.3rem;
    line-height: 1;
  }
  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps > li {
    position: relative;
    padding: 14px 14px 16px;
    background: #fffdf7;
    border: 2px solid var(--line-strong);
    border-radius: 12px;
    animation: rise 0.5s var(--ease-spring) both;
    animation-delay: calc(0.25s + var(--i) * 0.14s);
  }
  .steps > li:nth-child(2) {
    rotate: 0.6deg;
  }
  .steps > li:nth-child(3) {
    rotate: -0.5deg;
  }
  .n {
    position: absolute;
    top: -14px;
    left: -10px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 2.5px solid var(--ink);
    border-radius: 50%;
    background: var(--amber);
    font: 700 1.2rem var(--hand);
    box-shadow: 0 2px 0 var(--ink);
  }
  .art {
    display: block;
    width: 100%;
    max-width: 190px;
    height: auto;
    margin: 0 auto 6px;
  }
  h3 {
    margin: 0 0 4px;
    font: 700 1.3rem/1.15 var(--hand);
    color: var(--ink);
  }
  .steps p {
    margin: 0;
    color: var(--ink-soft);
    font: 400 0.98rem/1.45 var(--read);
  }
  .help {
    margin: 18px auto 10px;
    max-width: 60ch;
    font: 400 1.05rem/1.45 var(--read);
    color: var(--ink);
  }
  .keys {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 18px;
    margin: 0 0 20px;
    padding: 0;
    list-style: none;
    color: var(--ink-soft);
    font: 700 0.92rem var(--read);
  }
  .key {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 7px;
    box-sizing: border-box;
    margin-right: 4px;
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: #fffdf7;
    box-shadow: 0 2px 0 var(--ink);
    color: var(--ink);
    font: 700 0.8rem var(--read);
  }
  .key.small {
    margin: 0 0 0 8px;
    min-width: 24px;
    height: 24px;
  }
  .go {
    min-width: 220px;
    font-size: 1.25rem;
  }

  /* The drawings. */
  .art :global(*) {
    vector-effect: non-scaling-stroke;
  }
  .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ink.thin {
    stroke-width: 1.6;
  }
  .shadow {
    fill: rgba(43, 38, 34, 0.12);
  }
  .paper,
  .paper2,
  .moon,
  .face,
  .body,
  .wood,
  .gear,
  .panel,
  .neck {
    stroke: var(--ink);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .paper {
    fill: #fffaf0;
  }
  .paper2 {
    fill: #f3e3c4;
  }
  .seal {
    fill: #c0573e;
    stroke: var(--ink);
    stroke-width: 2;
  }
  .spark {
    fill: var(--amber);
    stroke: var(--ink);
    stroke-width: 1.4;
    transform-box: fill-box;
    transform-origin: center;
    animation: twinkle 1.8s ease-in-out infinite;
  }
  .spark.s2 {
    animation-delay: 0.9s;
  }
  .front-env {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: hop 1.6s ease-in-out infinite;
  }
  .back-env {
    transform-box: fill-box;
    transform-origin: center;
    animation: sway 3.2s ease-in-out infinite;
  }
  .wood {
    fill: #b27a4c;
  }
  .moon {
    fill: #d8d3c9;
  }
  .crater {
    fill: #aaa49a;
  }
  .spin {
    transform-box: fill-box;
    transform-origin: center;
    animation: turn 9s linear infinite;
  }
  .flag {
    fill: #c0573e;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .glass {
    fill: rgba(186, 214, 232, 0.28);
    stroke: var(--ink);
    stroke-width: 2.4;
  }
  .shine {
    fill: none;
    stroke: #fff;
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.8;
  }
  .body {
    fill: #e7b45a;
  }
  .panel {
    fill: #7fa3c4;
  }
  .neck {
    fill: #b8b1a6;
  }
  .face {
    fill: #f2ede3;
  }
  .eye {
    fill: var(--ink);
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 3.4s ease-in-out infinite;
  }
  .head {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: nod 2.2s ease-in-out infinite;
  }
  .gear {
    fill: var(--sage);
  }
  .part {
    animation: snap 2.6s ease-in-out infinite;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-24px) scale(0.96);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }
  @keyframes hop {
    0%,
    100% {
      transform: translateY(0) rotate(0deg);
    }
    40% {
      transform: translateY(-7px) rotate(-3deg);
    }
    60% {
      transform: translateY(-5px) rotate(2deg);
    }
  }
  @keyframes sway {
    50% {
      transform: rotate(4deg) translateY(-2px);
    }
  }
  @keyframes twinkle {
    0%,
    100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
  }
  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes blink {
    0%,
    92%,
    100% {
      transform: scaleY(1);
    }
    95% {
      transform: scaleY(0.15);
    }
  }
  @keyframes nod {
    50% {
      transform: rotate(-6deg);
    }
  }
  @keyframes snap {
    0%,
    15% {
      transform: translate(0, 0);
    }
    55%,
    70% {
      transform: translate(-16px, 2px);
    }
    100% {
      transform: translate(0, 0);
    }
  }
  .still,
  .still :global(*) {
    animation: none !important;
  }
  :global(:root[data-motion="reduce"]) .scrim {
    animation: none;
  }
  @media (max-width: 760px) {
    .steps {
      grid-template-columns: 1fr;
    }
    .art {
      max-width: 140px;
    }
  }
</style>
