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

<Panel title={t("together.title")} {onclose}>
  <p>{t("together.intro")}</p>
  <section aria-labelledby="tg-make">
    <h3 id="tg-make">{t("together.make")}</h3>
    {#if made}
      <p class="code-label">{t("together.code")}</p>
      <p class="code">{made}</p>
      <div class="row">
        <button type="button" class="btn" onclick={copy}><Icon name="copy" size={22} /> {copied ? t("together.copied") : t("together.copy")}</button>
        <button type="button" class="btn amber" onclick={() => made && go(made)}>{t("together.open")}</button>
      </div>
    {:else}
      <button type="button" class="btn amber" onclick={make}>{t("together.make")}</button>
    {/if}
  </section>
  <section aria-labelledby="tg-join">
    <h3 id="tg-join">{t("together.join")}</h3>
    <div class="pickers">
      {#each [0, 1, 2] as i (i)}
        <label>
          <span>{t("together.word", { n: i + 1 })}</span>
          <select bind:value={words[i]}>
            {#each ROOM_WORDS as w (w)}<option value={w}>{w}</option>{/each}
          </select>
        </label>
      {/each}
      <label>
        <span>{t("together.number")}</span>
        <select bind:value={number}>
          {#each Array.from({ length: 99 }, (_, n) => n + 1) as n (n)}<option value={n}>{n}</option>{/each}
        </select>
      </label>
    </div>
    <button type="button" class="btn" onclick={() => go(`${words.join("-")}-${number}`)}>{t("together.joinGo")}</button>
  </section>
</Panel>

<style>
  section {
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1.5px dashed rgba(43, 38, 34, 0.22);
  }
  h3 {
    margin: 0 0 10px;
    font: 700 1.25rem var(--hand);
  }
  .code-label {
    margin: 0;
    color: var(--ink-soft);
  }
  .code {
    margin: 4px 0 12px;
    font: 700 1.6rem/1.2 var(--label);
    letter-spacing: 0.02em;
    background: #efe2c7;
    padding: 8px 14px;
    width: max-content;
    max-width: 100%;
    transform: rotate(-0.8deg);
    border: 2px solid var(--ink);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .row .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .pickers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .pickers label {
    display: grid;
    gap: 4px;
    font-weight: 700;
    font-size: 0.92rem;
  }
  select {
    min-height: 44px;
    font: inherit;
    font-weight: 400;
    padding: 0 8px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--paper-light);
    color: var(--ink);
  }
</style>
