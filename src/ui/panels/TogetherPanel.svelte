<script lang="ts">
  import { tick } from "svelte";
  import { audio } from "../../audio/audio";
  import { KID_NAMES } from "../../content/story";
  import type { NetClient, NetState } from "../../net/client";
  import type { Coop } from "../../net/coop";
  import { KID_IDS, type Kid } from "../../net/protocol";
  import { ROOM_WORDS, makeRoomCode } from "../../net/words";
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";
  import KidFace from "./KidFace.svelte";

  /**
   * Play together (Phase 06). Make a private room or join one with a code,
   * then pick which kid to play. No typing anywhere: codes are three kid-safe
   * words and a number, so nobody can type a name or a message. Joining shows
   * the code as four paper tiles, like the code a friend sees: spin a tile with
   * its arrows (or the arrow keys), or tap it to pick from a board of words.
   */
  interface Props {
    net: NetClient;
    coop: Coop;
    onclose: () => void;
  }
  let { net, coop, onclose }: Props = $props();

  // `subscribe` reports the current state right away, so this default never shows.
  let room = $state<NetState>({ status: "solo", room: null, players: 1, you: null, seats: [] });
  $effect(() => net.subscribe((next) => (room = next)));

  let copied = $state(false);
  let busy = $state(false);
  let words = $state<[string, string, string]>([ROOM_WORDS[0]!, ROOM_WORDS[1]!, ROOM_WORDS[2]!]);
  let number = $state(1);
  /** Which tile's board is open: 0 to 2 for the words, 3 for the number. */
  let board = $state<number | null>(null);
  let boardEl: HTMLElement | null = $state(null);

  const NUMBERS = Array.from({ length: 99 }, (_, n) => n + 1);

  const tileText = (i: number): string => (i === 3 ? String(number) : words[i]!);
  const tileLabel = (i: number): string => (i === 3 ? t("together.number") : t("together.word", { n: i + 1 }));
  const focusTile = (i: number): void => {
    void tick().then(() => document.querySelector<HTMLElement>(`[data-tile="${i}"]`)?.focus({ preventScroll: true }));
  };

  function setWord(i: number, word: string): void {
    const next = [...words] as [string, string, string];
    next[i] = word;
    words = next;
  }

  function spin(i: number, step: number): void {
    if (i === 3) number = ((((number - 1 + step) % 99) + 99) % 99) + 1;
    else {
      // Skip words the other tiles already show: a code never repeats a word.
      let at = (ROOM_WORDS as readonly string[]).indexOf(words[i]!);
      do at = (at + step + ROOM_WORDS.length) % ROOM_WORDS.length;
      while (words.some((w, j) => j !== i && w === ROOM_WORDS[at]));
      setWord(i, ROOM_WORDS[at]!);
    }
    audio.ui("tick");
  }

  async function toggleBoard(i: number): Promise<void> {
    board = board === i ? null : i;
    audio.ui("pop");
    if (board === null) return;
    await tick();
    boardEl?.querySelector<HTMLElement>("[aria-pressed='true']")?.focus({ preventScroll: true });
  }

  function choose(value: string | number): void {
    if (board === null) return;
    const i = board;
    if (i === 3) number = value as number;
    else setWord(i, value as string);
    board = null;
    audio.ui("tick");
    focusTile(i);
  }

  function tileKey(event: KeyboardEvent, i: number): void {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      spin(i, event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    // A letter jumps to the first word that starts with it. Nothing is typed anywhere.
    if (i < 3 && /^[a-z]$/i.test(event.key)) {
      const found = ROOM_WORDS.find((w) => w.startsWith(event.key.toLowerCase()));
      if (found) {
        setWord(i, found);
        audio.ui("tick");
      }
    }
  }

  function boardKey(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    const i = board;
    board = null;
    if (i !== null) focusTile(i);
  }
  const repeated = $derived(new Set(words).size < 3);

  const inRoom = $derived(room.status === "connected" || room.status === "reconnecting" || room.status === "connecting");
  const mine = $derived(room.seats.find((s) => s.seat === room.you)?.kid ?? null);
  const link = (code: string): string => `${location.origin}/?room=${code}`;

  /** Keeps the address bar on the room link, so a reload comes back to it. */
  function address(code: string | null): void {
    const url = new URL(location.href);
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    history.replaceState(history.state, "", url);
  }

  async function make(): Promise<void> {
    busy = true;
    let code = makeRoomCode();
    try {
      const response = await fetch("/api/room", { method: "POST" });
      const body = (await response.json()) as { code?: string };
      if (response.ok && body.code) code = body.code;
    } catch {
      // The room server may be resting; joining will say so kindly.
    }
    busy = false;
    enter(code);
  }

  function enter(code: string): void {
    copied = false;
    if (coop.join(code)) address(code);
  }

  function leave(): void {
    coop.leave();
    address(null);
  }

  async function copy(): Promise<void> {
    if (!room.room) return;
    try {
      await navigator.clipboard.writeText(link(room.room));
      copied = true;
    } catch {
      copied = false;
    }
  }

  function holder(kid: Kid): "you" | "taken" | "free" {
    if (kid === mine) return "you";
    return room.seats.some((s) => s.kid === kid && s.seat !== room.you) ? "taken" : "free";
  }
</script>

<Panel title={t("together.title")} lede={t("together.intro")} icon="people" size="lg" {onclose}>
  {#if inRoom && room.room}
    <div class="room">
      <section class="option" aria-labelledby="tg-room">
        <span class="mark" aria-hidden="true"><Icon name="door" size={22} /></span>
        <h3 id="tg-room">{t("together.code")}</h3>
        <p class="code">
          {#each room.room.split("-") as part, i (i)}<span>{part}</span>{/each}
        </p>
        <p class="help">{t("together.share")}</p>
        <div class="row">
          <button type="button" class="btn amber" onclick={copy}><Icon name={copied ? "check" : "copy"} size={18} /> {copied ? t("together.copied") : t("together.copy")}</button>
        </div>
        <p class="status" role="status">
          {#if room.status === "connecting"}{t("together.opening")}{:else if room.status === "reconnecting"}{t("together.again")}{:else}<Icon name="people" size={18} /> {t("together.here", { n: room.players })}{/if}
        </p>
        <div class="leave">
          <button type="button" class="btn" onclick={leave}>{t("together.leave")}</button>
          <span class="help">{t("together.leaveHelp")}</span>
        </div>
      </section>

      <section class="option kids-card" aria-labelledby="tg-who">
        <h3 id="tg-who">{t("together.who")}</h3>
        <p class="help">{t("together.whoHelp")}</p>
        <ul class="kids">
          {#each KID_IDS as kid (kid)}
            {@const who = holder(kid)}
            <li class:you={who === "you"} class:taken={who === "taken"} data-kid={kid}>
              <KidFace {kid} size={72} />
              <span class="kid-name">{KID_NAMES[kid]}</span>
              {#if who === "you"}
                <span class="badge you-badge">{t("together.you")}</span>
              {:else if who === "taken"}
                <span class="badge">{t("together.taken")}</span>
              {:else}
                <button type="button" class="btn small" disabled={room.status !== "connected"} onclick={() => coop.pick(kid)} aria-label={`${t("together.pick")} ${KID_NAMES[kid]}`}>{t("together.pick")}</button>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {:else}
    {#if room.status === "offline" || room.status === "full"}
      <p class="resting" role="status">{room.status === "full" ? t("together.full") : t("together.resting")}</p>
    {/if}
    <div class="cards">
      <section class="option" aria-labelledby="tg-make">
        <span class="mark" aria-hidden="true"><Icon name="plus" size={22} /></span>
        <h3 id="tg-make">{t("together.make")}</h3>
        <p class="help">{t("together.makeHelp")}</p>
        <div class="crew" aria-hidden="true">
          {#each KID_IDS as kid, i (kid)}
            <span class="crew-kid" style:--i={i}><KidFace {kid} size={64} /></span>
          {/each}
        </div>
        <button type="button" class="btn amber" disabled={busy} onclick={make}>{t("together.make")}</button>
      </section>

      <section class="option join-card" aria-labelledby="tg-join">
        <span class="mark" aria-hidden="true"><Icon name="door" size={22} /></span>
        <h3 id="tg-join">{t("together.join")}</h3>
        <p class="help">{t("together.joinHelp")}</p>
        <div class="tiles" role="group" aria-label={t("together.code")}>
          {#each [0, 1, 2, 3] as i (i)}
            <div class="tile-col" class:num={i === 3} class:open={board === i}>
              <button type="button" class="spin up" tabindex="-1" aria-label={`${tileLabel(i)}: ${t("together.before")}`} onclick={() => spin(i, -1)}>
                <svg viewBox="0 0 20 12" aria-hidden="true"><path d="M3 9.5 L 10 3 L 17 9.5" /></svg>
              </button>
              <button
                type="button"
                class="tile"
                data-tile={i}
                aria-label={`${tileLabel(i)}: ${tileText(i)}`}
                aria-expanded={board === i}
                aria-describedby="tg-tile-help"
                onclick={() => toggleBoard(i)}
                onkeydown={(e) => tileKey(e, i)}
              >
                {#key tileText(i)}<span class="tile-word">{tileText(i)}</span>{/key}
              </button>
              <button type="button" class="spin down" tabindex="-1" aria-label={`${tileLabel(i)}: ${t("together.after")}`} onclick={() => spin(i, 1)}>
                <svg viewBox="0 0 20 12" aria-hidden="true"><path d="M3 2.5 L 10 9 L 17 2.5" /></svg>
              </button>
            </div>
          {/each}
        </div>
        <p class="tile-help" id="tg-tile-help">{t("together.tileHelp")}</p>
        {#if repeated}<p class="help warn" role="status">{t("together.sameWord")}</p>{/if}
        <button type="button" class="btn amber join-go" disabled={repeated} onclick={() => enter(`${words.join("-")}-${number}`)}>{t("together.joinGo")}</button>
      </section>
      {#if board !== null}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="board" class:numbers={board === 3} role="group" aria-label={tileLabel(board)} bind:this={boardEl} onkeydown={boardKey}>
          <p class="board-title">{board === 3 ? t("together.pickNumber") : t("together.pickWord", { n: board + 1 })}</p>
          <div class="chips">
            {#if board === 3}
              {#each NUMBERS as n (n)}<button type="button" class="chip-btn" aria-pressed={n === number} onclick={() => choose(n)}>{n}</button>{/each}
            {:else}
              {#each ROOM_WORDS as w (w)}
                {@const usedElsewhere = words.some((x, j) => j !== board && x === w)}
                <button type="button" class="chip-btn" aria-pressed={w === words[board]} disabled={usedElsewhere} onclick={() => choose(w)}>{w}</button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
  <p class="safe"><Icon name="lock" size={18} /> {t("together.safe")}</p>
</Panel>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: 14px;
  }
  .option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 20px 20px 22px;
    border-radius: 4px;
    background-color: #fffdf6;
    background-image: repeating-linear-gradient(180deg, transparent 0 27px, rgba(64, 108, 170, 0.12) 27px 28px);
    border: 1.5px solid rgba(43, 38, 34, 0.18);
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.1);
  }
  .option:nth-child(2) {
    transform: rotate(0.5deg);
  }
  .mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: 4px;
    border: 2.2px solid var(--ink);
    border-radius: 50% 46% 52% 48%;
    background: #f9d79a;
    color: var(--ink);
  }
  .mark :global(.icon),
  .row :global(.icon),
  .safe :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  h3 {
    margin: 0;
    font: 700 1.45rem/1.15 var(--hand);
  }
  .help {
    margin: 0 0 12px;
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  .option > .btn {
    margin-top: auto;
  }
  .code {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px;
  }
  .code span {
    padding: 8px 12px;
    border-radius: 10px 8px 11px 7px;
    background: #f9d79a;
    border: 2px solid var(--ink);
    box-shadow: 0 2px 0 var(--ink);
    font: 700 1.1rem var(--read);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  /* The code as four paper tiles, each with little spin arrows above and below. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 64px;
    gap: 8px;
    width: 100%;
    margin: 2px 0 4px;
  }
  .tile-col {
    display: grid;
    justify-items: center;
    gap: 2px;
  }
  .tile {
    position: relative;
    width: 100%;
    min-height: 52px;
    padding: 6px 4px;
    overflow: hidden;
    border: 2px solid var(--ink);
    border-radius: 10px 8px 11px 7px;
    background: #f9d79a;
    box-shadow: 0 3px 0 var(--ink);
    color: var(--ink);
    font: 700 1.05rem/1.1 var(--read);
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      background 0.15s;
  }
  .tile-col:nth-child(2) .tile {
    rotate: 0.8deg;
  }
  .tile-col:nth-child(3) .tile {
    rotate: -0.6deg;
  }
  .tile-col.num .tile {
    background: #fffaf0;
  }
  .tile:hover {
    transform: translateY(-2px);
  }
  .tile:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }
  .tile-col.open .tile {
    background: var(--amber);
  }
  .tile-word {
    display: block;
    animation: roll 0.22s var(--ease-spring);
  }
  @keyframes roll {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
  }
  .spin {
    display: grid;
    place-items: center;
    width: 44px;
    height: 26px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink-soft);
    cursor: pointer;
  }
  .spin:hover {
    background: rgba(242, 165, 65, 0.22);
    color: var(--ink);
  }
  .spin svg {
    width: 20px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tile-help {
    margin: 2px 0 10px;
    color: var(--ink-soft);
    font: 400 0.84rem/1.3 var(--read);
  }
  /* Four friends waiting on the Make card: who can come along. */
  .crew {
    display: flex;
    justify-content: center;
    align-self: stretch;
    margin: 10px 0 18px;
  }
  .crew-kid {
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    margin: 0 -6px;
    border: 2.4px solid var(--ink);
    border-radius: 50%;
    background: #fdf0cf;
    box-shadow: 0 3px 0 var(--ink);
    rotate: calc((var(--i) - 1.5) * 4deg);
    translate: 0 calc(var(--i) * var(--i) * 1px - var(--i) * 3px);
  }
  .crew-kid:nth-child(2) {
    background: #e3ecd6;
  }
  .crew-kid:nth-child(3) {
    background: #e8dff0;
  }
  .crew-kid:nth-child(4) {
    background: #d9e6f0;
  }
  /* The board: every word as a little paper chip, like letter tiles spread on a
     table. It lies over the Make card, beside the tiles it sets, so the panel
     never grows or scrolls. */
  .cards {
    position: relative;
  }
  .board {
    position: absolute;
    z-index: 2;
    left: -4px;
    top: -4px;
    bottom: -4px;
    width: calc(50% - 3px);
    display: flex;
    flex-direction: column;
    padding: 12px 14px 14px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    background: #fffaf0;
    box-shadow:
      0 4px 0 var(--ink),
      0 22px 36px -18px rgba(20, 12, 4, 0.55);
    animation: board-in 0.22s var(--ease-spring);
  }
  .board-title {
    margin: 0 0 8px;
    font: 700 1rem var(--hand);
  }
  /* A little paper arrow on the board's edge, pointing at the tiles. */
  .board::after {
    content: "";
    position: absolute;
    right: -13px;
    top: 192px;
    width: 22px;
    height: 22px;
    background: #fffaf0;
    border-right: 2px solid var(--ink);
    border-top: 2px solid var(--ink);
    rotate: 45deg;
  }
  .chips {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-content: start;
    gap: 6px;
    overflow-y: auto;
    padding: 2px 4px 4px 2px;
  }
  .board.numbers .chips {
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 3px;
  }
  .board.numbers .chip-btn {
    min-height: 27px;
    font-size: 0.82rem;
  }
  @media (max-width: 720px) {
    .board {
      width: auto;
      right: -4px;
    }
    .board::after {
      display: none;
    }
  }
  .chip-btn {
    min-height: 34px;
    padding: 2px 4px;
    border: 1.5px solid rgba(43, 38, 34, 0.35);
    border-radius: 7px;
    background: #fffdf6;
    color: var(--ink);
    font: 700 0.88rem var(--read);
    cursor: pointer;
  }
  .chip-btn:hover:not(:disabled) {
    border-color: var(--ink);
    background: #fdf0cf;
  }
  .chip-btn[aria-pressed="true"] {
    border: 2px solid var(--ink);
    background: #f9d79a;
    box-shadow: 0 2px 0 var(--ink);
  }
  .chip-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .warn {
    color: #9a3a22;
  }
  .join-go {
    align-self: stretch;
  }
  @keyframes board-in {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }
  :global(:root[data-motion="reduce"]) :is(.tile-word, .board) {
    animation: none;
  }
  .safe {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 18px 0 0;
    color: var(--ink-soft);
    font-size: 0.92rem;
  }
  .room {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 14px;
  }
  .kids-card {
    transform: rotate(0.4deg);
  }
  .kids {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }
  .kids li {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 12px 8px;
    border-radius: 6px 4px 7px 5px;
    border: 1.5px solid rgba(43, 38, 34, 0.18);
    background: #fffaf0;
  }
  .kids li.you {
    border: 2.4px solid var(--ink);
    background: #fdf0cf;
    box-shadow: 0 3px 0 var(--ink);
  }
  .kids li.taken {
    opacity: 0.62;
  }
  .kid-name {
    font: 700 1.25rem/1 var(--hand);
  }
  .badge {
    padding: 3px 10px;
    border: 1.5px solid var(--pencil);
    border-radius: 3px;
    color: var(--pencil);
    font: 700 0.72rem/1.2 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .you-badge {
    border-color: #b8433a;
    color: #b8433a;
    transform: rotate(-3deg);
  }
  .btn.small {
    min-height: 36px;
    padding: 4px 18px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 0;
    font-weight: 600;
  }
  .status :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
  }
  .leave {
    display: grid;
    gap: 6px;
    margin-top: auto;
    padding-top: 16px;
  }
  .leave .help {
    margin: 0;
  }
  .resting {
    margin: 0 0 14px;
    padding: 12px 16px;
    border-left: 4px solid #d2a445;
    background: #fdf3dc;
    font-weight: 600;
  }
  @media (max-width: 720px) {
    .room {
      grid-template-columns: 1fr;
    }
  }
</style>
