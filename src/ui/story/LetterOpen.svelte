<script lang="ts">
  import { audio } from "../../audio/audio";
  import type { Engine } from "../../game/engine";
  import InkStamp from "../notebook/InkStamp.svelte";
  import { settings } from "../settings.svelte";

  /**
   * Dad's letter, opened. When Remi delivers a letter (or rereads one from the
   * notebook) the envelope drops in, its flap opens, and the letter slides up
   * out of it in Dad's handwriting; on a delivery the red "Delivered" stamp
   * lands in the corner. It stays until the player folds it up (click, tap, E,
   * Enter or the gamepad's A). The story waits for it, then goes on.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  const STAMP_ART: Record<string, { bg: string; ink: string; name: string }> = {
    Home: { bg: "#e9b44c", ink: "#5a3a12", name: "HOME" },
    Moon: { bg: "#8ea4c0", ink: "#1f2e4a", name: "MOON" },
    Mars: { bg: "#d9825f", ink: "#4a1d10", name: "MARS" },
    Space: { bg: "#4c5a9a", ink: "#0f1430", name: "SPACE" },
  };
  const POSTS: Record<string, string> = { Home: "HOME POST", Moon: "MOON POST", Mars: "MARS POST", Space: "DEEP SPACE POST" };

  let open = $state<{ key: number; to: string; world: string; text: string; delivered: boolean } | null>(null);
  let button = $state<HTMLButtonElement | null>(null);
  const stamp = $derived(open ? (STAMP_ART[open.world] ?? STAMP_ART["Home"]!) : null);

  $effect(() =>
    engine.bus.on("letter:open", (p) => {
      open = { key: p.key, to: p.to, world: p.world, text: p.text, delivered: p.delivered ?? false };
      audio.play("envelope-pickup", { level: 0.7 });
      audio.ui("page");
      if (open.delivered) audio.play("stamp", { delay: settings.reducedMotion ? 0.1 : 2.1, level: 0.8 });
    }),
  );

  $effect(() => {
    if (open && button) button.focus({ preventScroll: true });
  });

  function done(): void {
    if (!open) return;
    const key = open.key;
    open = null;
    audio.ui("page");
    engine.bus.emit("letter:open-done", { key });
  }

  $effect(() => {
    if (!open) return;
    const shownAt = performance.now();
    // Long enough for the letter to slide out, so a key still held from delivering never folds it unread.
    const ready = (): boolean => performance.now() - shownAt > (settings.reducedMotion ? 400 : 1300);
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === "Space") {
        if ((event.target as Element | null)?.closest?.(".letter-open")) event.preventDefault();
        return;
      }
      if ((event.code === "KeyE" || event.code === "Enter" || event.code === "Escape") && ready()) {
        event.preventDefault();
        done();
      }
    };
    let frame = 0;
    let wasDown = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const down = Boolean(navigator.getGamepads?.().find((g) => g)?.buttons[0]?.pressed);
      if (down && !wasDown && ready()) done();
      wasDown = down;
    };
    window.addEventListener("keydown", onKey);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if open && stamp}
  {#key open.key}
    <div class="letter-open" role="dialog" aria-modal="true" aria-label={`Dad's letter: ${open.to}`}>
      <div class="dim" aria-hidden="true"></div>
      <div class="stage">
        <!-- The envelope: back, the letter inside, the front pocket, then the flap on top. -->
        <div class="env" aria-hidden="true">
          <div class="back"></div>
          <div class="peek"><span></span><span></span><span></span></div>
          <div class="front">
            <span class="via">By lamplight</span>
            <span class="stamp" style:--bg={stamp.bg} style:--ink={stamp.ink}>{stamp.name}</span>
            <span class="addr">{open.to}</span>
          </div>
          <div class="flap"><i class="seal"></i></div>
        </div>
        <article class="sheet card">
          <p class="to">{open.to},</p>
          <p class="body">{open.text}</p>
          <p class="sign">Dad</p>
          {#if open.delivered}
            <div class="mark" aria-hidden="true"><InkStamp lines={["Delivered.", "By Remi."]} top="BY LAMPLIGHT" bottom={POSTS[open.world] ?? "HOME POST"} size={112} tilt={-10} /></div>
          {/if}
          <div class="foot">
            <button type="button" class="btn amber got" bind:this={button} onclick={done}>Fold it up <kbd>E</kbd></button>
          </div>
        </article>
      </div>
    </div>
  {/key}
{/if}

<style>
  .letter-open {
    position: fixed;
    inset: 0;
    z-index: 45;
    display: grid;
    place-items: center;
    pointer-events: auto;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 70% at 50% 50%, rgba(20, 14, 30, 0.35), rgba(20, 14, 30, 0.62));
    animation: fade 0.4s ease both;
  }
  .stage {
    position: relative;
    width: min(560px, calc(100vw - 32px));
    display: grid;
    place-items: center;
  }

  /* ---------- The envelope ---------- */
  .env {
    --w: min(440px, calc(100vw - 48px));
    position: absolute;
    top: 50%;
    width: var(--w);
    aspect-ratio: 1.62;
    perspective: 900px;
    animation: env-life 2s cubic-bezier(0.3, 0.9, 0.3, 1) both;
  }
  .back,
  .front,
  .flap {
    position: absolute;
    inset: 0;
  }
  .back {
    border-radius: 6px;
    background: #ead9b8;
    border: 3px solid var(--ink);
  }
  .peek {
    position: absolute;
    left: 7%;
    right: 7%;
    top: 8%;
    height: 80%;
    padding: 10% 8%;
    box-sizing: border-box;
    display: grid;
    align-content: start;
    gap: 9%;
    background: #fffdf6;
    border: 2px solid rgba(43, 38, 34, 0.5);
    border-radius: 3px;
    animation: peek-up 2s cubic-bezier(0.3, 0.9, 0.3, 1) both;
  }
  .peek span {
    height: 3px;
    border-radius: 2px;
    background: rgba(43, 70, 140, 0.35);
  }
  .peek span:nth-child(2) {
    width: 80%;
  }
  .peek span:nth-child(3) {
    width: 55%;
  }
  /* The front pocket: the two side folds and the bottom fold, with the airmail edge. */
  .front {
    border-radius: 6px;
    border: 3px solid var(--ink);
    background:
      linear-gradient(to top right, #f3e7cf 49.5%, transparent 50%) left bottom / 51% 100% no-repeat,
      linear-gradient(to top left, #f3e7cf 49.5%, transparent 50%) right bottom / 51% 100% no-repeat,
      linear-gradient(#f3e7cf, #f3e7cf) bottom / 100% 46% no-repeat;
    box-shadow: inset 0 0 0 7px transparent;
  }
  .front::before {
    /* Airmail stripes round the edge. */
    content: "";
    position: absolute;
    inset: 5px;
    border: 6px solid transparent;
    border-image: repeating-linear-gradient(-45deg, #c0573e 0 10px, transparent 10px 16px, #3d5a8a 16px 26px, transparent 26px 32px) 6;
    border-radius: 3px;
    pointer-events: none;
  }
  .via {
    position: absolute;
    left: 7%;
    bottom: 34%;
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #3d5a8a;
  }
  .stamp {
    position: absolute;
    right: 7%;
    bottom: 12%;
    width: 15%;
    aspect-ratio: 0.82;
    display: grid;
    place-items: end center;
    padding-bottom: 4px;
    box-sizing: border-box;
    background: var(--bg);
    color: var(--ink);
    border: 3px dotted #fffdf6;
    outline: 2px solid rgba(43, 38, 34, 0.4);
    font: 700 0.62rem/1 var(--label);
    letter-spacing: 0.08em;
  }
  .addr {
    position: absolute;
    left: 7%;
    bottom: 11%;
    max-width: 66%;
    font: 700 clamp(1.05rem, 2.4vw, 1.45rem) / 1.1 var(--hand);
    color: var(--dad-ink, #2b4a8a);
  }
  .flap {
    transform-origin: top center;
    clip-path: polygon(0 0, 100% 0, 50% 58%);
    background: #efdfbf;
    border-top: 3px solid var(--ink);
    animation: flap-open 2s ease both;
    backface-visibility: visible;
  }
  .flap::after {
    /* The flap's inked edge. */
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom right, transparent calc(50% - 2px), var(--ink) calc(50% - 2px) calc(50% + 1px), transparent calc(50% + 1px)) left / 50% 58% no-repeat,
      linear-gradient(to bottom left, transparent calc(50% - 2px), var(--ink) calc(50% - 2px) calc(50% + 1px), transparent calc(50% + 1px)) right / 50% 58% no-repeat;
    background-position: left top, right top;
  }
  .seal {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 13%;
    aspect-ratio: 1;
    translate: -50% -50%;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 35%, #f6b863, #d98a2b 60%, #b56a1c);
    border: 2.5px solid var(--ink);
  }

  /* ---------- The letter ---------- */
  .sheet {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    padding: 30px 34px 22px 46px;
    background:
      linear-gradient(90deg, transparent 30px, rgba(196, 80, 60, 0.35) 30px 31.5px, transparent 31.5px),
      repeating-linear-gradient(180deg, transparent 0 33px, rgba(64, 108, 170, 0.16) 33px 34px) 0 22px,
      #fffcf3;
    border: 3px solid var(--ink);
    border-radius: 6px;
    box-shadow:
      0 6px 0 var(--ink),
      0 24px 50px rgba(10, 8, 24, 0.5);
    rotate: -1deg;
    animation: sheet-out 2s cubic-bezier(0.3, 0.9, 0.3, 1) both;
  }
  .to {
    margin: 0 0 6px;
    font: 700 1.55rem/34px var(--hand);
    color: var(--dad-ink, #2b4a8a);
  }
  .body {
    margin: 0;
    font: 400 1.45rem/34px var(--hand);
    color: var(--dad-ink, #2b4a8a);
  }
  .sign {
    margin: 6px 0 0;
    text-align: right;
    font: 700 1.5rem/34px var(--hand);
    color: var(--dad-ink, #2b4a8a);
    padding-right: 12px;
  }
  /* The Delivered stamp lands on the top corner, over the edge, like a postmark. */
  .mark {
    position: absolute;
    right: -26px;
    top: -34px;
    pointer-events: none;
    mix-blend-mode: multiply;
    animation: stamp-in 0.32s cubic-bezier(0.3, 1.6, 0.5, 1) 2.05s both;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
  kbd {
    margin-left: 6px;
    padding: 1px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    font: 700 0.8rem/1.2 var(--read);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  /* 0 to 0.4 s the envelope drops in; the flap opens until 0.8 s; then it slides away under the letter. */
  @keyframes env-life {
    0% {
      opacity: 0;
      transform: translateY(-50%) translateY(-90px) rotate(-6deg) scale(0.85);
    }
    20% {
      opacity: 1;
      transform: translateY(-50%) rotate(-2deg) scale(1);
    }
    45% {
      opacity: 1;
      transform: translateY(-50%) rotate(-2deg) scale(1);
    }
    75% {
      opacity: 0;
      transform: translateY(-50%) translateY(170px) rotate(2deg) scale(0.92);
    }
    100% {
      opacity: 0;
      transform: translateY(-50%) translateY(170px) rotate(2deg) scale(0.92);
    }
  }
  @keyframes flap-open {
    0%,
    20% {
      transform: rotateX(0deg);
      z-index: 3;
    }
    40% {
      transform: rotateX(180deg);
      z-index: 0;
    }
    100% {
      transform: rotateX(180deg);
      z-index: 0;
    }
  }
  @keyframes peek-up {
    0%,
    40% {
      transform: translateY(0);
    }
    62% {
      transform: translateY(-46%);
    }
    100% {
      transform: translateY(-46%);
    }
  }
  @keyframes sheet-out {
    0%,
    52% {
      opacity: 0;
      transform: translateY(40px) scale(0.86);
    }
    72% {
      opacity: 1;
      transform: translateY(-6px) scale(1.01);
    }
    100% {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes stamp-in {
    from {
      opacity: 0;
      transform: scale(1.6) rotate(8deg);
    }
  }
  :global(:root[data-motion="reduce"]) .letter-open :is(.dim, .env, .peek, .flap, .sheet, .mark) {
    animation: none;
  }
  :global(:root[data-motion="reduce"]) .env {
    display: none;
  }
  @media (max-width: 560px) {
    .sheet {
      padding: 24px 18px 16px 38px;
    }
    .body {
      font-size: 1.25rem;
    }
    .mark {
      right: -8px;
      top: -40px;
    }
  }
</style>
