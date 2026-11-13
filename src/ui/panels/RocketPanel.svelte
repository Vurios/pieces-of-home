<script lang="ts">
  import { CHAPTERS, bonusOpen } from "../../content/chapters";
  import type { GameState } from "../../game/core/state";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";

  /**
   * Dad's rocket: fly to any little world that is open, any time. Opened from
   * the toy rocket in the yard or from the map. Three little planets side by
   * side (home, the Moon, Mars), each with its places as tickets under it.
   * A world opens once the prologue is stamped (or Explore freely is on); the
   * bonus world once Chapter 3 is stamped, as in the chapter list.
   */
  interface Props {
    game: Readonly<GameState>;
    /** The world the player is in now. */
    here: string;
    onclose: () => void;
    ongo: (world: string) => void;
  }
  let { game, here, onclose, ongo }: Props = $props();

  interface Ticket {
    world: string;
    name: string;
    line: string;
    open: boolean;
    done: boolean;
  }
  interface Body {
    id: "home" | "moon" | "mars";
    name: string;
    tickets: Ticket[];
  }

  const opened = $derived(game.stamps.includes("prologue") || game.flags.includes("explore-freely"));
  const MOON = ["tranquility", "hadley", "storms"];
  const ticket = (world: string): Ticket => {
    const c = CHAPTERS.find((x) => x.world === world)!;
    return {
      world,
      name: c.place,
      line: c.bonus ? t("rocket.bonus") : c.title.split(":")[0]!,
      open: opened && (!c.bonus || bonusOpen(game) || game.flags.includes("explore-freely")),
      done: game.stamps.includes(c.id),
    };
  };
  const bodies = $derived<Body[]>([
    { id: "home", name: t("rocket.home"), tickets: [{ world: "home", name: t("rocket.homePlace"), line: t("rocket.homeLine"), open: true, done: false }] },
    { id: "moon", name: t("rocket.moon"), tickets: MOON.map(ticket) },
    { id: "mars", name: t("rocket.mars"), tickets: ["meridiani", "valinor"].map(ticket) },
  ]);
</script>

<Panel title={t("rocket.title")} lede={t("rocket.lede")} icon="pin" size="lg" {onclose}>
  <div class="bodies">
    {#each bodies as body (body.id)}
      <section class="body {body.id}" aria-label={body.name}>
        <svg class="planet" viewBox="-60 -60 120 120" aria-hidden="true">
          <circle r="44" class="land" />
          {#if body.id === "home"}
            <path class="patch" d="M-30 -14 q12 -14 26 -6 q10 8 -4 16 q-16 6 -22 -10z" />
            <path class="patch" d="M8 14 q14 -8 24 2 q4 12 -12 14 q-14 0 -12 -16z" />
            <g class="tree"><rect x="-4" y="-40" width="3" height="8" /><circle cx="-2.5" cy="-42" r="6" /></g>
            <g class="house"><rect x="10" y="-38" width="14" height="10" /><path d="M8 -38 l9 -8 l9 8z" /></g>
          {:else if body.id === "moon"}
            <circle class="crater" cx="-16" cy="-8" r="9" />
            <circle class="crater" cx="18" cy="12" r="6" />
            <circle class="crater" cx="-4" cy="22" r="4" />
            <circle class="crater" cx="20" cy="-20" r="3.5" />
          {:else}
            <path class="patch" d="M-36 -6 q16 -10 34 -2 q14 6 34 -4" fill="none" />
            <circle class="crater" cx="-12" cy="14" r="7" />
            <circle class="crater" cx="16" cy="-16" r="5" />
            <ellipse class="cap" cx="0" cy="-41" rx="13" ry="4" />
          {/if}
          <circle r="44" class="rim" />
        </svg>
        <h3>{body.name}</h3>
        <ul>
          {#each body.tickets as tk (tk.world)}
            <li>
              {#if tk.world === here}
                <span class="ticket here">
                  <span class="name">{tk.name}</span>
                  <span class="line">{t("rocket.here")}</span>
                </span>
              {:else if tk.open}
                <button type="button" class="ticket" onclick={() => ongo(tk.world)}>
                  <span class="name">{tk.name}</span>
                  <span class="line">{tk.line}{#if tk.done}<span class="stamped">{t("rocket.stamped")}</span>{/if}</span>
                  <span class="go" aria-hidden="true">{t("rocket.go")}</span>
                </button>
              {:else}
                <span class="ticket shut">
                  <span class="name">{tk.name}</span>
                  <span class="line"><Icon name="lock" size={14} /> {t("rocket.notYet")}</span>
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</Panel>

<style>
  .bodies {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    align-items: start;
  }
  .body {
    display: grid;
    justify-items: center;
    gap: 10px;
  }
  .planet {
    width: 112px;
    height: 112px;
    overflow: visible;
  }
  .land {
    stroke: none;
  }
  .home .land {
    fill: #7fa36b;
  }
  .moon .land {
    fill: #c4bfb4;
  }
  .mars .land {
    fill: #d08a5a;
  }
  .patch {
    fill: rgba(255, 255, 255, 0.16);
    stroke: rgba(43, 38, 34, 0.25);
    stroke-width: 1.5;
  }
  .mars .patch {
    stroke: rgba(120, 50, 20, 0.45);
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .crater {
    fill: rgba(43, 38, 34, 0.14);
    stroke: rgba(43, 38, 34, 0.45);
    stroke-width: 1.4;
  }
  .cap {
    fill: #f4efe4;
    stroke: #2b2622;
    stroke-width: 1.4;
  }
  .tree rect {
    fill: #6b3f2a;
  }
  .tree circle {
    fill: #4f7a47;
    stroke: #2b2622;
    stroke-width: 1.4;
  }
  .house rect {
    fill: #e8a066;
    stroke: #2b2622;
    stroke-width: 1.4;
  }
  .house path {
    fill: #b5523b;
    stroke: #2b2622;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
  .rim {
    fill: none;
    stroke: #2b2622;
    stroke-width: 2.6;
  }
  h3 {
    margin: 0;
    font: 700 1.35rem/1.1 var(--hand);
    color: var(--ink);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
    width: 100%;
  }
  .ticket {
    box-sizing: border-box;
    position: relative;
    display: grid;
    gap: 2px;
    width: 100%;
    min-height: 64px;
    padding: 10px 46px 10px 16px;
    border: 1.5px solid rgba(43, 38, 34, 0.22);
    border-radius: 4px;
    background:
      radial-gradient(circle at 0 50%, transparent 7px, #fffdf6 7.5px) left / 51% 100% no-repeat,
      radial-gradient(circle at 100% 50%, transparent 7px, #fffdf6 7.5px) right / 51% 100% no-repeat;
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.1);
    color: var(--ink);
    text-align: left;
    font: inherit;
    transition:
      transform 140ms ease,
      box-shadow 140ms ease;
  }
  button.ticket {
    cursor: pointer;
  }
  button.ticket:hover,
  button.ticket:focus-visible {
    transform: translateY(-2px) rotate(-0.4deg);
    box-shadow: 0 4px 0 rgba(43, 38, 34, 0.14);
  }
  button.ticket:active {
    transform: translateY(1px);
    box-shadow: 0 1px 0 rgba(43, 38, 34, 0.1);
  }
  .name {
    font: 700 1.12rem/1.2 var(--hand);
  }
  .line {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--ink-soft);
    font-size: 0.86rem;
    font-weight: 600;
  }
  .go {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--amber, #f2a541);
    border: 1.5px solid #2b2622;
    font-size: 0;
  }
  .go::before {
    content: "";
    width: 7px;
    height: 7px;
    margin-left: -2px;
    border-top: 2.5px solid #2b2622;
    border-right: 2.5px solid #2b2622;
    transform: rotate(45deg);
  }
  .here {
    background: #f6ecd2;
    border-style: dashed;
  }
  .here .line {
    color: #8a5a1f;
  }
  .shut {
    background: transparent;
    box-shadow: none;
    border-style: dashed;
  }
  .shut .name {
    color: var(--ink-soft);
  }
  .shut .line :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .stamped {
    padding: 1px 7px;
    border: 1.5px solid #b8433a;
    border-radius: 3px;
    color: #b8433a;
    font: 700 0.66rem/1.2 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transform: rotate(-3deg);
  }
  @media (max-width: 720px) {
    .bodies {
      grid-template-columns: 1fr;
    }
    .planet {
      width: 84px;
      height: 84px;
    }
  }
</style>
