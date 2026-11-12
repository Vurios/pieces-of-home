<script lang="ts">
  import { audio } from "../../audio/audio";
  import { ARCHIVE, type ArchiveCard, cardSources } from "../../content/archive";
  import { factCoords } from "../../content/facts";
  import Panel from "../Panel.svelte";

  /**
   * Dad's archive (Game Bible 6, P2): the cards pinned on the workshop wall,
   * one per machine. Pick a card on the left; it shows a real picture with its
   * credit, a pin on a little globe, three checked facts with their sources,
   * and a line from Dad. Arrow keys or the D-pad move between cards.
   * Nothing scrolls: each card fits on one sheet.
   */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let index = $state(0);
  const card = $derived(ARCHIVE[index]!);
  const sources = $derived(cardSources(card));

  function pick(i: number): void {
    const next = (i + ARCHIVE.length) % ARCHIVE.length;
    if (next === index) return;
    index = next;
    audio.ui("page");
  }

  function onkey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      pick(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      pick(index - 1);
    }
  }

  // The gamepad: D-pad moves between cards, B closes.
  $effect(() => {
    let frame = 0;
    let was = { up: true, down: true, b: true };
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      if (!pad) return;
      const now = { up: Boolean(pad.buttons[12]?.pressed || pad.buttons[14]?.pressed), down: Boolean(pad.buttons[13]?.pressed || pad.buttons[15]?.pressed), b: Boolean(pad.buttons[1]?.pressed) };
      if (now.down && !was.down) pick(index + 1);
      if (now.up && !was.up) pick(index - 1);
      if (now.b && !was.b) onclose();
      was = now;
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  });

  /**
   * A little globe, seen from above the pin: graticule lines in pencil and the
   * pin itself. Orthographic projection, centered a little north of the pin so
   * the pin sits low on the ball like on a desk globe.
   */
  const R = 52;
  function globe(c: ArchiveCard): { lines: string[]; pin: { x: number; y: number } } {
    const { lat, lon } = factCoords(c.place);
    const lat0 = (lat * 0.6 * Math.PI) / 180;
    const lon0 = (lon * Math.PI) / 180;
    const project = (la: number, lo: number): { x: number; y: number; seen: boolean } => {
      const p = (la * Math.PI) / 180;
      const l = (lo * Math.PI) / 180 - lon0;
      const cosc = Math.sin(lat0) * Math.sin(p) + Math.cos(lat0) * Math.cos(p) * Math.cos(l);
      return { x: R * Math.cos(p) * Math.sin(l), y: -R * (Math.cos(lat0) * Math.sin(p) - Math.sin(lat0) * Math.cos(p) * Math.cos(l)), seen: cosc > 0 };
    };
    const lines: string[] = [];
    const trace = (points: { x: number; y: number; seen: boolean }[]): void => {
      let d = "";
      for (const pt of points) {
        if (!pt.seen) {
          if (d) lines.push(d);
          d = "";
          continue;
        }
        d += `${d ? "L" : "M"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
      }
      if (d) lines.push(d);
    };
    for (let la = -60; la <= 60; la += 30) trace(Array.from({ length: 73 }, (_, i) => project(la, i * 5 - 180)));
    for (let lo = -180; lo < 180; lo += 30) trace(Array.from({ length: 37 }, (_, i) => project(i * 5 - 90, lo)));
    const pin = project(lat, lon);
    return { lines, pin: { x: pin.x, y: pin.y } };
  }
  const ball = $derived(globe(card));
  const coords = $derived(factCoords(card.place));
  const where = $derived(`${Math.abs(coords.lat).toFixed(1)}° ${coords.lat >= 0 ? "N" : "S"}, ${Math.abs(coords.lon).toFixed(1)}° ${coords.lon >= 0 ? "E" : "W"}`);
</script>

<svelte:window onkeydown={onkey} />

<Panel title="Dad's archive" lede="Machines Dad never built a little world for. He kept a card for each one." icon="book" size="xl" flush {onclose}>
  <div class="archive">
    <nav class="drawer" aria-label="Archive cards">
      {#each ARCHIVE as c, i (c.id)}
        <button type="button" class="tab" class:on={i === index} aria-current={i === index ? "true" : undefined} onclick={() => pick(i)}>
          <img src={c.image.file} alt="" loading="lazy" decoding="async" />
          <span class="tab-name">{c.name}</span>
          <span class="chip" class:mars={c.world === "Mars"}>{c.world}</span>
        </button>
      {/each}
      <p class="keys">Arrow keys to flip through</p>
    </nav>
    {#key card.id}
      <article class="card" aria-label={card.name}>
        <span class="tape" aria-hidden="true"></span>
        <div class="left">
          <figure class="photo">
            <img src={card.image.file} alt={card.image.alt} decoding="async" />
            <figcaption>Photo: {card.image.credit}</figcaption>
          </figure>
          <div class="where">
            <svg viewBox="-60 -60 120 120" aria-hidden="true">
              <circle r={R} class="ball" class:mars={card.world === "Mars"} />
              {#each ball.lines as d, i (i)}<path {d} class="grid" />{/each}
              <circle r={R} class="rim" />
              <circle cx={ball.pin.x} cy={ball.pin.y} r="9" class="halo" />
              <path d="M{ball.pin.x} {ball.pin.y} l -5 -13 a 5.5 5.5 0 1 1 10 0 z" class="pin" />
            </svg>
            <div>
              <p class="place">{card.place.kid}</p>
              <p class="coords">{where}</p>
            </div>
          </div>
        </div>
        <div class="right">
          <p class="kicker"><span class="chip" class:mars={card.world === "Mars"}>{card.world}</span> Archive card {index + 1} of {ARCHIVE.length}</p>
          <h3>{card.name}</h3>
          <ol class="facts">
            {#each card.facts as f, i (f.id)}
              <li><span class="n" aria-hidden="true">{i + 1}</span><span>{f.kid}</span></li>
            {/each}
          </ol>
          <p class="note">{card.note}<span class="sign">Dad</span></p>
          <div class="sources">
            <span class="label">Sources</span>
            {#each sources as s (s.url)}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{/each}
          </div>
        </div>
      </article>
    {/key}
  </div>
</Panel>

<style>
  .archive {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    gap: 22px;
    padding: 6px 26px 24px;
    min-height: 0;
  }
  .drawer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tab {
    display: grid;
    grid-template-columns: 46px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 6px 10px 6px 6px;
    background: #fbf6ec;
    border: 2px solid var(--line-strong);
    border-radius: 10px 12px 11px 9px;
    color: var(--ink);
    font: 700 0.95rem/1.15 var(--read);
    text-align: left;
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      border-color 0.15s,
      background 0.15s;
  }
  .tab img {
    width: 46px;
    height: 40px;
    object-fit: cover;
    border-radius: 5px;
    border: 1.5px solid var(--ink);
  }
  .tab:hover {
    transform: translateX(3px);
  }
  .tab.on {
    background: var(--amber-wash);
    border-color: var(--ink);
    box-shadow: 0 3px 0 var(--ink);
    transform: translateX(6px);
  }
  .keys {
    margin: 6px 0 0;
    color: var(--ink-soft);
    font: 400 0.82rem/1.3 var(--read);
  }
  .chip {
    padding: 2px 7px;
    border-radius: 999px;
    background: #dcdad4;
    color: #3e3a36;
    font: 700 0.66rem/1.3 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .chip.mars {
    background: #f1cbb4;
    color: #7a3a24;
  }

  /* The card itself: a big index card with a taped photo. */
  .card {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: 24px;
    padding: 22px 24px 20px;
    background:
      var(--grain),
      repeating-linear-gradient(to bottom, transparent 0 29px, rgba(92, 115, 147, 0.16) 29px 30px),
      #fffdf7;
    border: 2px solid var(--ink);
    border-radius: 6px 8px 7px 9px;
    box-shadow:
      0 4px 0 var(--ink),
      0 24px 40px -24px rgba(14, 8, 4, 0.6);
    transform: rotate(0.3deg);
    animation: card-in 0.4s var(--ease-spring);
  }
  .tape {
    position: absolute;
    top: -12px;
    left: 32%;
    width: 110px;
    height: 24px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    transform: rotate(-3deg);
  }
  .photo {
    margin: 0;
    padding: 10px 10px 8px;
    background: #fff;
    border: 1.5px solid rgba(43, 38, 34, 0.2);
    box-shadow: 0 10px 18px -12px rgba(43, 38, 34, 0.55);
    transform: rotate(-1.4deg);
  }
  .photo img {
    display: block;
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    background: #1b1a1a;
  }
  .photo figcaption {
    margin-top: 6px;
    color: var(--ink-soft);
    font: 400 0.78rem/1.2 var(--read);
  }
  .where {
    display: grid;
    grid-template-columns: 112px 1fr;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }
  .where svg {
    width: 112px;
    height: 112px;
    overflow: visible;
  }
  .ball {
    fill: #cfcac2;
  }
  .ball.mars {
    fill: #cf8a62;
  }
  .grid {
    fill: none;
    stroke: rgba(43, 38, 34, 0.28);
    stroke-width: 0.9;
  }
  .rim {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.2;
  }
  .halo {
    fill: rgba(242, 165, 65, 0.35);
    animation: breathe 2.2s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .pin {
    fill: #c0573e;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .place {
    margin: 0;
    font: 400 0.98rem/1.4 var(--read);
  }
  .coords {
    margin: 4px 0 0;
    color: var(--ink-soft);
    font: 700 0.8rem/1 var(--label);
    letter-spacing: 0.06em;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--ink-soft);
    font: 700 0.72rem/1 var(--label);
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }
  h3 {
    margin: 6px 0 10px;
    font: 700 2.2rem/1.05 var(--hand);
  }
  .facts {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .facts li {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
    font: 400 1.04rem/1.45 var(--read);
  }
  .n {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--amber);
    border: 2px solid var(--ink);
    font: 700 0.8rem/1 var(--label);
  }
  .note {
    margin: 14px 0 0;
    color: var(--dad-ink);
    font: 700 1.3rem/1.3 var(--hand);
    transform: rotate(-0.8deg);
  }
  .sign {
    margin-left: 10px;
    font-size: 1rem;
    opacity: 0.8;
  }
  .sources {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1.5px dashed var(--line-strong);
    font: 400 0.78rem/1.35 var(--read);
  }
  .sources .label {
    font: 700 0.68rem/1 var(--label);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .sources a {
    color: var(--ink-soft);
  }
  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(10px) rotate(1.5deg);
    }
  }
  @keyframes breathe {
    50% {
      transform: scale(1.35);
      opacity: 0.6;
    }
  }
  :global(:root[data-motion="reduce"]) .card,
  :global(:root[data-motion="reduce"]) .halo {
    animation: none;
  }
</style>
