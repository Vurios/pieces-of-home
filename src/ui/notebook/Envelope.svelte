<script lang="ts">
  /**
   * One of Dad's letters: a cream envelope with his handwriting on the front,
   * a little postage stamp for the world it goes to, and an amber wax seal.
   * Once delivered it gets a red "Delivered" stamp instead of the seal.
   * `empty` draws just a pencil outline, for a memory not found yet.
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
</script>

<div class="env" class:done class:empty style:--tilt={`${tilt}deg`}>
  <svg class="folds" viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path class="back" d="M0.8 61.2 L 36 24 M99.2 61.2 L 64 24" />
    <path class="flap" d="M0.8 0.8 L 50 27 L 99.2 0.8" />
  </svg>
  {#if !empty}
    {#if world}<span class="stamp" aria-hidden="true"><span>{world}</span></span>{/if}
    <span class="to">{to}</span>
    {#if done}
      <span class="posted">{doneLabel}</span>
    {:else}
      <span class="seal" aria-hidden="true"></span>
    {/if}
  {/if}
</div>

<style>
  .env {
    position: relative;
    aspect-ratio: 100 / 62;
    width: 100%;
    border-radius: 3px;
    background: linear-gradient(170deg, #fbf3e2, #f2e4c8);
    box-shadow:
      0 0 0 1px rgba(122, 94, 52, 0.28),
      0 1px 0 rgba(255, 255, 255, 0.8) inset,
      0 8px 14px -8px rgba(46, 30, 12, 0.5);
    transform: rotate(var(--tilt));
    container-type: inline-size;
  }
  .folds {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .folds path {
    fill: none;
    stroke: rgba(122, 94, 52, 0.35);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .folds .back {
    stroke: rgba(122, 94, 52, 0.18);
  }
  .to {
    position: absolute;
    left: 8%;
    right: 6%;
    bottom: 10%;
    font: 400 clamp(0.95rem, 8.4cqi, 1.3rem) / 1.12 var(--hand);
    color: var(--dad-ink);
  }
  /* A tiny postage stamp with a perforated edge. */
  .stamp {
    position: absolute;
    top: 9%;
    right: 6%;
    display: grid;
    place-items: center;
    width: 20%;
    aspect-ratio: 4 / 5;
    padding: 3px;
    background: #fff;
    filter: drop-shadow(0 1px 1px rgba(46, 30, 12, 0.3));
    -webkit-mask: radial-gradient(circle at 50% 50%, transparent 1.4px, #000 1.7px) -2.5px -2.5px / 5px 5px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat;
    mask: radial-gradient(circle at 50% 50%, transparent 1.4px, #000 1.7px) -2.5px -2.5px / 5px 5px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat;
  }
  .stamp span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(160deg, #5c7393, #3f5677);
    color: #fdf6e6;
    font: 700 clamp(0.5rem, 5cqi, 0.66rem) / 1 var(--read);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  /* Amber wax where the flap meets. */
  .seal {
    position: absolute;
    left: 50%;
    top: 43%;
    width: 12%;
    aspect-ratio: 1;
    translate: -50% -50%;
    border-radius: 48% 52% 50% 46%;
    background: radial-gradient(circle at 38% 34%, #f6c06a, #d98a2b 55%, #a9601a);
    box-shadow: 0 1px 2px rgba(80, 40, 6, 0.45), inset 0 0 0 2px rgba(255, 220, 160, 0.25);
  }
  .posted {
    position: absolute;
    right: 6%;
    bottom: 12%;
    padding: 3px 7px 2px;
    border: 2px solid #b0402b;
    border-radius: 4px;
    color: #b0402b;
    font: 700 clamp(0.6rem, 5cqi, 0.74rem) / 1 var(--read);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-9deg);
    mix-blend-mode: multiply;
  }
  .done {
    background: linear-gradient(170deg, #f4ecdc, #e9dcc2);
  }
  .done .to {
    right: 36%;
    color: #4d5d7a;
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
