<script lang="ts">
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
   * words and a number, picked from lists, so nobody can type a name or a message.
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
        <button type="button" class="btn amber" disabled={busy} onclick={make}>{t("together.make")}</button>
      </section>

      <section class="option" aria-labelledby="tg-join">
        <span class="mark" aria-hidden="true"><Icon name="door" size={22} /></span>
        <h3 id="tg-join">{t("together.join")}</h3>
        <p class="help">{t("together.joinHelp")}</p>
        <div class="pickers">
          {#each [0, 1, 2] as i (i)}
            <label>
              <span class="eyebrow">{t("together.word", { n: i + 1 })}</span>
              <select class="select" bind:value={words[i]}>
                {#each ROOM_WORDS as w (w)}<option value={w}>{w}</option>{/each}
              </select>
            </label>
          {/each}
          <label>
            <span class="eyebrow">{t("together.number")}</span>
            <select class="select" bind:value={number}>
              {#each Array.from({ length: 99 }, (_, n) => n + 1) as n (n)}<option value={n}>{n}</option>{/each}
            </select>
          </label>
        </div>
        <button type="button" class="btn" disabled={new Set(words).size < 3} onclick={() => enter(`${words.join("-")}-${number}`)}>{t("together.joinGo")}</button>
      </section>
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
  .eyebrow {
    margin: 4px 0 6px;
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
  .pickers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 10px;
    width: 100%;
    margin-bottom: 16px;
  }
  .pickers label {
    display: grid;
  }
  .pickers .eyebrow {
    margin: 0 0 6px;
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
