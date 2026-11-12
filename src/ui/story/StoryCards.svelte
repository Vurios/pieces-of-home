<script lang="ts">
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import { type FactStory, factStory } from "../../content/notebook";
  import type { Engine } from "../../game/engine";

  /**
   * Story cards: Dad's handwritten notes on his lined paper, and true stories.
   *
   * A true story is a big index card taped over the world: a real picture of
   * the machine with its exact credit, the place, the story in plain words,
   * the details behind it (higher reading level, from the same sourced fact)
   * and where it comes from. A card stays until the player says "Got it"
   * (click, tap, E, Enter, Space or the gamepad's A); the world keeps going.
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
    story: FactStory | null;
  }
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
      card = { key: p.key, kind: p.kind, text: p.text, source: p.fact ? fact(p.fact).sourceTitle : null, story };
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
      if (event.code === "KeyE" || event.code === "Enter" || event.code === "Space") {
        if (event.code !== "KeyE" && (event.target as Element | null)?.closest?.(".more")) return;
        event.preventDefault();
        done();
      }
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
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onKey);
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
      <div class="card fact" class:pictured={Boolean(story?.image)} role="dialog" aria-live="polite" aria-label="A true story">
        {#if story?.image}
          <figure class="photo">
            <img src={story.image.file} alt={story.image.alt} />
            <figcaption>{story.image.credit}</figcaption>
          </figure>
        {/if}
        <div class="words">
          <p class="from">
            <span class="badge">True story</span>
            {#if story?.where}<span class="where">{story.where}</span>{/if}
          </p>
          {#if story?.spread}<p class="machine">{story.spread.nickname}</p>{/if}
          <p class="text">{card.text}</p>
          {#if story && (story.details.length || story.when)}
            {#if more}
              <ul class="details" aria-label="More about it">
                {#if story.when}<li><b>When:</b> {story.when}</li>{/if}
                {#each story.details as line, i (i)}<li>{line}</li>{/each}
              </ul>
            {:else}
              <button type="button" class="more" onclick={() => (more = true)}>More about it</button>
            {/if}
          {/if}
          <div class="foot">
            {#if card.source}<p class="source">From: {card.source}</p>{/if}
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
    color: var(--dad-ink);
  }

  /* ---- The true story: a big index card with a taped photo ---- */
  .fact {
    width: min(880px, calc(100vw - 32px));
    padding: 26px 30px 20px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 26px;
    align-items: start;
    background:
      var(--grain),
      repeating-linear-gradient(to bottom, transparent 0 33px, rgba(92, 115, 147, 0.12) 33px 34px),
      var(--card);
    background-position: 0 0, 0 70px, 0 0;
    transform: translateX(-50%) rotate(0.5deg);
    border-top: 8px solid var(--sky);
  }
  .fact.pictured {
    grid-template-columns: minmax(220px, 300px) 1fr;
  }
  .photo {
    margin: 4px 0 0;
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
  .photo figcaption {
    margin-top: 6px;
    font: 400 0.72rem/1.2 var(--read);
    color: var(--ink-soft);
  }
  .words {
    min-width: 0;
    animation: words-in 0.5s ease-out 0.18s both;
  }
  .from {
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
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
  .where {
    letter-spacing: 0.06em;
  }
  .machine {
    margin: 0 0 4px;
    font: 700 1.15rem/1.2 var(--hand);
    color: var(--dad-ink);
  }
  .fact .text {
    margin: 0;
    font: 700 1.5rem/1.4 var(--read);
    text-wrap: pretty;
  }
  .more {
    margin: 14px 0 0;
    padding: 6px 12px;
    border: 2px dashed var(--ink-soft);
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    font: 700 0.95rem/1 var(--read);
    cursor: pointer;
  }
  .more:hover,
  .more:focus-visible {
    border-style: solid;
    background: rgba(242, 165, 65, 0.15);
  }
  .details {
    margin: 14px 0 0;
    padding: 10px 14px 10px 30px;
    background: rgba(255, 255, 255, 0.75);
    border-left: 4px solid var(--amber);
    font: 400 1rem/1.45 var(--read);
    animation: words-in 0.3s ease-out both;
  }
  .details li + li {
    margin-top: 2px;
  }
  .foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-top: 14px;
  }
  .source {
    margin: 0;
    font: 400 0.82rem/1.3 var(--read);
    color: var(--ink-soft);
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
    .fact.pictured {
      grid-template-columns: 1fr;
    }
    .photo {
      max-width: 220px;
    }
  }
  :global(:root[data-motion="reduce"]) .card,
  :global(:root[data-motion="reduce"]) .photo,
  :global(:root[data-motion="reduce"]) .words {
    animation: none;
  }
</style>
