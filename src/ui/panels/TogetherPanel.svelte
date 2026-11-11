<script lang="ts">
  import Icon from "../Icon.svelte";
  import Panel from "../Panel.svelte";
  import { t } from "../settings.svelte";
  import { ROOM_WORDS, makeRoomCode } from "../../net/words";

  /**
   * Make or join a private room. No typing: codes are three kid-safe words and
   * a number, picked from lists, so nobody can type a name or a message.
   */
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let made = $state<string | null>(null);
  let copied = $state(false);
  let words = $state<[string, string, string]>([ROOM_WORDS[0]!, ROOM_WORDS[1]!, ROOM_WORDS[2]!]);
  let number = $state(1);

  const link = (code: string): string => `${location.origin}/?room=${code}`;

  function make(): void {
    made = makeRoomCode();
    copied = false;
  }

  async function copy(): Promise<void> {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(link(made));
      copied = true;
    } catch {
      copied = false;
    }
  }

  function go(code: string): void {
    location.href = link(code);
  }
</script>

<Panel title={t("together.title")} lede={t("together.intro")} icon="people" size="lg" {onclose}>
  <div class="cards">
    <section class="option" aria-labelledby="tg-make">
      <span class="mark" aria-hidden="true"><Icon name="plus" size={22} /></span>
      <h3 id="tg-make">{t("together.make")}</h3>
      <p class="help">{t("together.makeHelp")}</p>
      {#if made}
        <p class="eyebrow">{t("together.code")}</p>
        <p class="code">
          {#each made.split("-") as part, i (i)}<span>{part}</span>{/each}
        </p>
        <div class="row">
          <button type="button" class="btn" onclick={copy}><Icon name={copied ? "check" : "copy"} size={18} /> {copied ? t("together.copied") : t("together.copy")}</button>
          <button type="button" class="btn amber" onclick={() => made && go(made)}>{t("together.open")}</button>
        </div>
      {:else}
        <button type="button" class="btn amber" onclick={make}>{t("together.make")}</button>
      {/if}
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
      <button type="button" class="btn" onclick={() => go(`${words.join("-")}-${number}`)}>{t("together.joinGo")}</button>
    </section>
  </div>
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
</style>
