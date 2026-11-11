<script lang="ts" module>
  /** Each world's postage stamp: a colour and a little engraving. */
  const STAMPS: Record<string, { bg: string; ink: string; art: string; name: string }> = {
    Home: {
      bg: "#e9b44c",
      ink: "#5a3a12",
      name: "HOME",
      art: `<path d="M8 30 L 22 30 M11 30 L 13 22 L 20 15" /><path d="M18 12 L 26 9 L 29 17 L 22 19 Z" /><circle cx="25" cy="20" r="2" />`,
    },
    Moon: {
      bg: "#8ea4c0",
      ink: "#1f2e4a",
      name: "MOON",
      art: `<path d="M24 7 C 16 8, 12 16, 15 23 C 18 29, 26 31, 31 26 C 24 27, 19 22, 19 16 C 19 12, 21 9, 24 7 Z" /><path d="M6 31 C 12 28, 22 28, 32 31" />`,
    },
    Mars: {
      bg: "#d9825f",
      ink: "#4a1d10",
      name: "MARS",
      art: `<circle cx="19" cy="16" r="9" /><path d="M11 13 C 15 11, 22 15, 27 12 M12 19 C 16 18, 22 21, 26 19" /><path d="M6 31 C 12 28, 24 28, 32 31" />`,
    },
    Space: {
      bg: "#4c5a9a",
      ink: "#0f1430",
      name: "SPACE",
      art: `<circle cx="22" cy="17" r="6" /><circle cx="22" cy="17" r="1.8" /><path d="M14 9 C 17 5, 27 5, 30 9" /><path d="M6 30 C 10 26, 13 23, 16 21" stroke-dasharray="1.5 2.5" /><path d="M8 10 l0 3 M6.5 11.5 l3 0" />`,
    },
  };
</script>

<script lang="ts">
  import { t } from "../settings.svelte";

  /**
   * One of Dad's letters, as space mail: a cream envelope with an airmail
   * edge, "By lamplight" in the corner, his handwriting on the front, a
   * perforated postage stamp for the world it goes to and an amber wax seal
   * with a lamp pressed in it. Once delivered, the stamp is cancelled with a
   * round postmark and a red "Delivered" stamp. `empty` draws a pencil
   * outline, for a memory not found yet.
   */
  interface Props {
    to?: string;
    world?: string;
    done?: boolean;
    doneLabel?: string;
    empty?: boolean;
    tilt?: number;
  }
  let { to = "", world = "", done = false, doneLabel = "", empty = false, tilt = 0 }: Props = $props();
  const stamp = $derived(STAMPS[world]);
</script>

<div class="env" class:done class:empty style:--tilt={`${tilt}deg`}>
  <svg class="folds" viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path class="back" d="M2 60 L 36 26 M98 60 L 64 26" />
    <path class="flap" d="M2 2 L 50 29 L 98 2" />
  </svg>
  {#if !empty}
    <span class="via" aria-hidden="true">{t("mail.via")}</span>
    {#if stamp}
      <span class="stamp" aria-hidden="true" style:--bg={stamp.bg} style:--ink={stamp.ink}>
        <svg viewBox="0 0 38 38"><g>{@html stamp.art}</g></svg>
        <span class="name">{stamp.name}</span>
      </span>
    {/if}
    {#if done}
      <svg class="postmark" viewBox="0 0 120 60" aria-hidden="true">
        <path d="M6 18 c 8 -5, 16 5, 24 0 s 16 5, 24 0 M6 30 c 8 -5, 16 5, 24 0 s 16 5, 24 0 M6 42 c 8 -5, 16 5, 24 0 s 16 5, 24 0" />
        <circle cx="88" cy="30" r="22" />
        <circle cx="88" cy="30" r="15" />
        <text x="88" y="33.5" text-anchor="middle">{stamp?.name ?? ""}</text>
      </svg>
    {/if}
    <span class="to">{to}</span>
    {#if stamp && world !== "Home"}<span class="where" aria-hidden="true">{t(`mail.${world.toLowerCase()}` as "mail.moon")}</span>{/if}
    {#if done}
      <span class="posted">{doneLabel}</span>
    {:else}
      <span class="seal" aria-hidden="true">
        <svg viewBox="0 0 20 20"><path d="M5 15 L 11 15 M7 15 L 8 11 L 12 7.5" /><path d="M10.5 6 L 15 4.5 L 16.5 8.5 L 12.5 9.5 Z" /></svg>
      </span>
    {/if}
  {/if}
</div>

<style>
  .env {
    position: relative;
    aspect-ratio: 100 / 62;
    width: 100%;
    box-sizing: border-box;
    border-radius: 3px;
    /* An airmail edge: clay, cream and night-blue stripes round the cream paper (the ::before). */
    background: repeating-linear-gradient(-45deg, #c4613f 0 6px, #fdf6e6 6px 11px, #2e4a7a 11px 17px, #fdf6e6 17px 22px);
    box-shadow:
      0 0 0 1px rgba(122, 94, 52, 0.25),
      0 8px 14px -8px rgba(46, 30, 12, 0.5);
    transform: rotate(var(--tilt));
    container-type: inline-size;
  }
  .env::before {
    content: "";
    position: absolute;
    inset: 5px;
    border-radius: 1px;
    background: linear-gradient(170deg, #fdf6e6, #f3e6cb);
  }
  .folds {
    position: absolute;
    inset: 5px;
    width: calc(100% - 10px);
    height: calc(100% - 10px);
  }
  .folds path {
    fill: none;
    stroke: rgba(122, 94, 52, 0.3);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .folds .back {
    stroke: rgba(122, 94, 52, 0.16);
  }
  .via {
    position: absolute;
    left: 8%;
    top: 12%;
    font: 700 clamp(0.42rem, 4.6cqi, 0.62rem) / 1 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #2e4a7a;
  }
  .to {
    position: absolute;
    left: 9%;
    right: 30%;
    bottom: 24%;
    font: 700 clamp(0.9rem, 8.2cqi, 1.28rem) / 1.08 var(--hand);
    color: var(--dad-ink);
    text-wrap: balance;
  }
  .where {
    position: absolute;
    left: 9%;
    bottom: 12%;
    padding-top: 2px;
    border-top: 1px solid rgba(47, 74, 122, 0.35);
    font: 700 clamp(0.42rem, 4.4cqi, 0.6rem) / 1 var(--label);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(47, 74, 122, 0.85);
  }
  /* A postage stamp with a perforated edge and a small engraving. */
  .stamp {
    position: absolute;
    top: 11%;
    right: 7%;
    display: grid;
    grid-template-rows: 1fr auto;
    justify-items: center;
    width: 21%;
    aspect-ratio: 4 / 5;
    box-sizing: border-box;
    padding: 6% 6% 4%;
    background: #fffaf0;
    filter: drop-shadow(0 1px 1px rgba(46, 30, 12, 0.3));
    -webkit-mask: radial-gradient(circle at 50% 50%, transparent 1.3px, #000 1.6px) -2.5px -2.5px / 5px 5px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat;
    mask: radial-gradient(circle at 50% 50%, transparent 1.3px, #000 1.6px) -2.5px -2.5px / 5px 5px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat;
  }
  .stamp svg {
    width: 100%;
    height: 100%;
    background: var(--bg);
    border-radius: 1px;
  }
  .stamp svg g {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .stamp .name {
    margin-top: 1px;
    font: 700 clamp(0.36rem, 3.4cqi, 0.5rem) / 1 var(--label);
    letter-spacing: 0.12em;
    color: var(--ink);
  }
  /* Amber wax where the flap meets, with Dad's lamp pressed into it. */
  .seal {
    position: absolute;
    left: 50%;
    top: 40%;
    display: grid;
    place-items: center;
    width: 12%;
    aspect-ratio: 1;
    translate: -50% -50%;
    border-radius: 48% 52% 50% 46%;
    background: radial-gradient(circle at 38% 34%, #f6c06a, #d98a2b 55%, #a9601a);
    box-shadow:
      0 1px 2px rgba(80, 40, 6, 0.45),
      inset 0 0 0 2px rgba(255, 220, 160, 0.25);
  }
  .seal svg {
    width: 70%;
    fill: none;
    stroke: rgba(110, 56, 10, 0.75);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* A round postmark cancels the stamp, its wavy lines running off to the left. */
  .postmark {
    position: absolute;
    top: 3%;
    right: 2%;
    width: 44%;
    transform: rotate(-8deg);
    fill: none;
    stroke: rgba(40, 46, 70, 0.62);
    stroke-width: 2;
    mix-blend-mode: multiply;
  }
  .postmark text {
    fill: rgba(40, 46, 70, 0.7);
    stroke: none;
    font: 700 8.5px var(--label);
    letter-spacing: 0.08em;
  }
  .posted {
    position: absolute;
    right: 7%;
    bottom: 12%;
    padding: 3px 7px 2px;
    border: 2px solid #b0402b;
    border-radius: 4px;
    color: #b0402b;
    font: 700 clamp(0.58rem, 5cqi, 0.74rem) / 1 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-9deg);
    mix-blend-mode: multiply;
  }
  .done::before {
    background: linear-gradient(170deg, #f6eedd, #ebdfc5);
  }
  .done .to {
    color: #44587d;
  }
  /* Not found yet: a pencil sketch of an envelope. */
  .empty::before {
    display: none;
  }
  .empty {
    background: transparent;
    box-shadow: none;
    outline: 1.5px dashed rgba(140, 129, 115, 0.7);
    outline-offset: -1px;
  }
  .empty .folds path {
    stroke: rgba(140, 129, 115, 0.55);
    stroke-dasharray: 3 3;
  }
</style>
