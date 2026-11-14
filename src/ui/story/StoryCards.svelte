<script lang="ts">
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import { type FactStory, type MachineSpread, factStory } from "../../content/notebook";
  import type { Engine } from "../../game/engine";
  import Icon from "../Icon.svelte";
  import Sketch from "../drawing/Sketch.svelte";
  import { DRAWINGS } from "../drawing/machines";

  /**
   * Story cards: Dad's handwritten notes on his lined paper, and true stories.
   *
   * A true story is a big index card taped over the world: a real picture of
   * the machine with its exact credit, the place, the story in plain words,
   * the details behind it (higher reading level, from the same sourced fact)
   * and where it comes from. A card stays until the player says "Got it"
   * (click, tap, E, Enter or the gamepad's A; Space stays the jump key); the world keeps going.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  interface Card {
    key: number;
    kind: "note" | "fact";
    text: string;
    source: string | null;
    sourceUrl: string | null;
    story: FactStory | null;
    /** The machine this story belongs to: the one whose notebook page holds the fact. */
    machine: MachineSpread | null;
    /** Where it happened: from the notebook page, else the world the player is standing in. */
    place: string | null;
  }
  /**
   * The real place each little world shows, for stories that are not on a
   * machine's notebook page (Eagle's descent stage, say). A story never borrows
   * another machine's name or drawing.
   */
  const PLACE_OF_WORLD: Record<string, string> = {
    tranquility: "Tranquility Base, the Moon",
    hadley: "Hadley-Apennine, the Moon",
    meridiani: "Meridiani Planum, Mars",
    valinor: "Valinor Hills, Mars",
    storms: "Ocean of Storms, the Moon",
  };
  let card = $state<Card | null>(null);
  let button = $state<HTMLButtonElement | null>(null);
  let more = $state(false);

  $effect(() =>
    engine.bus.on("story:card", (p) => {
      let story: FactStory | null = null;
      try {
        story = p.fact ? factStory(p.fact) : null;
      } catch {
        story = null;
      }
      const entry = p.fact ? fact(p.fact) : null;
      const machine = story?.spread ?? null;
      const place = story?.where ?? PLACE_OF_WORLD[engine.world?.id ?? ""] ?? null;
      card = { key: p.key, kind: p.kind, text: p.text, source: entry?.sourceTitle ?? null, sourceUrl: entry?.sourceUrl ?? null, story, machine, place };
      more = false;
      audio.ui(p.kind === "note" ? "page" : "toast");
    }),
  );

  // Focus the button without scrolling, so Enter and Space work at once.
  $effect(() => {
    if (card && button) button.focus({ preventScroll: true });
  });

  function done(): void {
    if (!card) return;
    const key = card.key;
    card = null;
    audio.ui("tick");
    engine.bus.emit("story:card-done", { key });
  }

  $effect(() => {
    if (!card) return;
    const shownAt = performance.now();
    const onKey = (event: KeyboardEvent): void => {
      // A short pause first, so a key held from walking or delivering never skips a card unread.
      if (performance.now() - shownAt < 450) return;
      // Space is the jump key (the moonquake listener's game wants jumps), so it never closes a card.
      if (event.code === "Space") {
        if ((event.target as Element | null)?.closest?.(".card")) event.preventDefault();
        return;
      }
      if (event.code === "KeyE" || event.code === "Enter") {
        if (event.code !== "KeyE" && (event.target as Element | null)?.closest?.(".more")) return;
        event.preventDefault();
        done();
      }
    };
    // A focused button would also click on Space's key up.
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space" && (event.target as Element | null)?.closest?.(".card")) event.preventDefault();
    };
    let frame = 0;
    let wasDown = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      const down = Boolean(pad?.buttons[0]?.pressed);
      if (down && !wasDown && performance.now() - shownAt > 450) done();
      wasDown = down;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if card}
  {#key card.key}
    {#if card.kind === "note"}
      <div class="card note" role="dialog" aria-live="polite" aria-label="A note from Dad">
        <p class="from">A note from Dad</p>
        <p class="text">{card.text}</p>
        <p class="sign">Dad</p>
        <button type="button" class="btn amber got" bind:this={button} onclick={done}>Got it <kbd>E</kbd></button>
      </div>
    {:else}
      {@const story = card.story}
      {@const machine = card.machine}
      <div class="card fact" class:solo={!story?.image && !machine} role="dialog" aria-live="polite" aria-label="A true story">
        <div class="pic">
          {#if story?.image}
            <figure class="photo">
              <img src={story.image.file} alt={story.image.alt} decoding="async" />
              <figcaption>{story.image.credit}</figcaption>
            </figure>
          {:else if machine}
            <figure class="drawn">
              <div class="sheet"><Sketch id={`fact-${machine.id}`} prims={DRAWINGS[machine.drawing]} color="var(--dad-ink)" still /></div>
              <figcaption>Dad's drawing. Not to scale.</figcaption>
            </figure>
          {/if}
        </div>
        <div class="words">
          <p class="from">
            <span class="badge">True story</span>
            {#if machine}<span class="who">{machine.name}</span>{:else if card.place}<span class="who"><Icon name="pin" size={15} /> {card.place}</span>{/if}
          </p>
          <p class="text">{card.text}</p>
          {#if story && (story.details.length || story.when || (story.where && machine))}
            {#if more}
              <dl class="notes" aria-label="More about it">
                {#if story.when}<div class="row"><dt>When</dt><dd>{story.when}</dd></div>{/if}
                {#if story.where && machine}<div class="row"><dt><Icon name="pin" size={16} /> Where</dt><dd>{story.where}</dd></div>{/if}
                {#if story.details.length}
                  <div class="row facts">
                    <dt>The facts</dt>
                    <dd>
                      <ol>
                        {#each story.details as line, i (i)}<li style:--i={i}>{line}</li>{/each}
                      </ol>
                    </dd>
                  </div>
                {/if}
              </dl>
            {:else}
              <button type="button" class="more" onclick={() => (more = true)}><Icon name="look" size={18} /> More about it</button>
            {/if}
          {/if}
          <div class="foot">
            <div class="cite">
              {#if card.source}
                <p class="source">
                  Source:
                  {#if card.sourceUrl}<a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">{card.source} <Icon name="external" size={12} /></a>{:else}{card.source}{/if}
                </p>
              {/if}
              {#if story?.spread}<p class="kept"><Icon name="book" size={16} /> Find it again in Dad's notebook.</p>{/if}
            </div>
            <button type="button" class="btn amber got" bind:this={button} onclick={done}>Got it <kbd>E</kbd></button>
          </div>
        </div>
      </div>
    {/if}
  {/key}
{/if}

<style>
  .card {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    width: min(600px, calc(100vw - 32px));
    padding: 22px 28px 18px;
    transform: translateX(-50%) rotate(-0.8deg);
    color: var(--ink);
    box-shadow: var(--shadow-card);
    animation: drop 0.5s var(--ease-spring);
    z-index: 30;
  }
  .card::before {
    content: "";
    position: absolute;
    top: -12px;
    left: 50%;
    width: 120px;
    height: 26px;
    margin-left: -60px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    transform: rotate(-2deg);
    z-index: 2;
  }
  .note {
    background:
      var(--grain),
      repeating-linear-gradient(to bottom, transparent 0 31px, rgba(92, 115, 147, 0.28) 31px 32px),
      linear-gradient(to right, transparent 0 46px, rgba(192, 87, 62, 0.35) 46px 47px, transparent 47px),
      var(--paper-light);
    background-position: 0 0, 0 14px, 0 0, 0 0;
  }
  .note .text {
    margin: 0;
    padding-left: 30px;
    font: 700 1.55rem/32px var(--hand);
    color: var(--ink);
  }

  /* ---- The true story: a museum label card, with a taped photo or Dad's drawing ---- */
  .fact {
    width: min(920px, calc(100vw - 32px));
    padding: 24px 30px 20px 24px;
    display: grid;
    grid-template-columns: 230px 1fr;
    gap: 26px;
    align-items: start;
    background:
      var(--grain),
      linear-gradient(90deg, rgba(242, 165, 65, 0.16) 0 254px, transparent 254px),
      var(--card);
    transform: translateX(-50%) rotate(0.4deg);
    border-radius: 6px 10px 8px 12px;
    border: 3px solid var(--ink);
    box-shadow:
      0 6px 0 var(--ink),
      0 26px 50px -10px rgba(10, 8, 24, 0.55);
  }
  .fact.solo {
    grid-template-columns: 1fr;
    background: var(--grain), var(--card);
  }
  .solo .pic {
    display: none;
  }
  .photo,
  .drawn {
    margin: 2px 0 0;
    padding: 10px 10px 8px;
    background: #fff;
    box-shadow:
      0 1px 0 rgba(43, 38, 34, 0.25),
      0 14px 24px -12px rgba(14, 8, 4, 0.55);
    rotate: -2.5deg;
    animation: photo-in 0.6s var(--ease-spring) 0.12s both;
  }
  .photo img {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: #ddd;
  }
  .drawn .sheet {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 12px;
    box-sizing: border-box;
    background:
      linear-gradient(rgba(35, 63, 115, 0.08) 1px, transparent 1px) 0 0 / 14px 14px,
      linear-gradient(90deg, rgba(35, 63, 115, 0.08) 1px, transparent 1px) 0 0 / 14px 14px,
      #fdfaf2;
  }
  .photo figcaption,
  .drawn figcaption {
    margin-top: 6px;
    font: 400 0.72rem/1.2 var(--read);
    color: var(--ink-soft);
  }
  .words {
    min-width: 0;
    animation: words-in 0.5s ease-out 0.18s both;
  }
  .from {
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 14px;
    font: 700 0.82rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .note .from {
    padding-left: 30px;
    color: var(--clay-deep);
  }
  .badge {
    padding: 5px 10px 4px;
    border: 2px solid var(--clay);
    border-radius: 4px;
    color: var(--clay-deep);
    rotate: -3deg;
  }
  .who {
    letter-spacing: 0.02em;
    text-transform: none;
    font: 700 1rem/1.2 var(--read);
    color: var(--ink);
  }
  .fact .text {
    margin: 0;
    font: 700 1.55rem/1.4 var(--read);
    color: var(--ink);
    text-wrap: pretty;
  }
  .more {
    margin: 16px 0 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff6e2;
    color: var(--ink);
    font: 700 1rem/1 var(--read);
    cursor: pointer;
    box-shadow: 0 3px 0 var(--ink);
    transition:
      transform 0.15s var(--ease-spring),
      box-shadow 0.15s ease;
  }
  .more:hover,
  .more:focus-visible {
    transform: translateY(-2px);
    box-shadow: 0 5px 0 var(--ink);
  }
  .more :global(.icon),
  .notes :global(.icon),
  .kept :global(.icon),
  .who :global(.icon),
  .source :global(.icon) {
    display: inline-block;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vertical-align: -3px;
  }
  /* Field notes: when, where and the facts, like the label beside a museum piece. */
  .notes {
    margin: 16px 0 0;
    display: grid;
    border: 2px solid rgba(43, 38, 34, 0.18);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.82);
    overflow: hidden;
    animation: words-in 0.3s ease-out both;
  }
  .row {
    display: grid;
    grid-template-columns: 118px 1fr;
    gap: 12px;
    padding: 9px 14px;
  }
  .row + .row {
    border-top: 1.5px dashed rgba(43, 38, 34, 0.18);
  }
  dt {
    display: flex;
    align-items: center;
    gap: 6px;
    font: 700 0.74rem/1.4 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  dd {
    margin: 0;
    font: 400 1.02rem/1.45 var(--read);
    color: var(--ink);
  }
  .facts dt {
    align-self: start;
    padding-top: 2px;
  }
  .facts ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
    counter-reset: fact;
  }
  .facts li {
    position: relative;
    padding-left: 30px;
    counter-increment: fact;
    animation: words-in 0.3s ease-out calc(0.08s * var(--i)) both;
  }
  .facts li::before {
    content: counter(fact);
    position: absolute;
    left: 0;
    top: 1px;
    width: 21px;
    height: 21px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--amber);
    border: 1.5px solid var(--ink);
    font: 700 0.72rem/1 var(--read);
  }
  .foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-top: 16px;
  }
  .cite {
    display: grid;
    gap: 4px;
  }
  .source,
  .kept {
    margin: 0;
    font: 400 0.82rem/1.3 var(--read);
    color: var(--ink-soft);
  }
  .source a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .kept {
    font: 400 0.98rem/1.3 var(--hand);
  }
  .sign {
    margin: 2px 0 0;
    text-align: right;
    font: 700 1.3rem/1 var(--hand);
    color: var(--dad-ink);
    transform: rotate(-4deg);
  }
  .got {
    display: flex;
    flex: none;
    margin: 12px 0 0 auto;
    align-items: center;
    gap: 10px;
  }
  .foot .got {
    margin: 0 0 0 auto;
  }
  kbd {
    font: 700 0.8rem/1 var(--label);
    padding: 3px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    opacity: 0.7;
  }
  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 30px;
    }
  }
  @keyframes photo-in {
    from {
      opacity: 0;
      rotate: -9deg;
      translate: -18px 10px;
    }
  }
  @keyframes words-in {
    from {
      opacity: 0;
      translate: 0 8px;
    }
  }
  @media (max-width: 680px) {
    .fact {
      grid-template-columns: 1fr;
      background: var(--grain), var(--card);
    }
    .photo,
    .drawn {
      max-width: 200px;
    }
    .row {
      grid-template-columns: 1fr;
      gap: 2px;
    }
  }
  :global(:root[data-motion="reduce"]) .card,
  :global(:root[data-motion="reduce"]) .photo,
  :global(:root[data-motion="reduce"]) .drawn,
  :global(:root[data-motion="reduce"]) .facts li,
  :global(:root[data-motion="reduce"]) .words {
    animation: none;
  }
</style>
