<script lang="ts">
  import type { StringKey } from "../../content/strings";
  import type { Engine } from "../../game/engine";
  import { trap } from "../focus";
  import Icon, { type IconName } from "../Icon.svelte";
  import { t } from "../settings.svelte";

  /**
   * Emotes and preset phrases (Game Bible 7). No typing, ever: only these
   * friendly choices, so co-op stays safe for kids.
   */
  interface Props {
    engine: Engine;
    onclose: () => void;
  }
  let { engine, onclose }: Props = $props();

  const EMOTES: IconName[] = ["wave", "heart", "star", "look", "question", "yay"];
  const PHRASES: { id: string; key: StringKey }[] = [
    { id: "over", key: "phrase.over" },
    { id: "look", key: "phrase.look" },
    { id: "nice", key: "phrase.nice" },
    { id: "help", key: "phrase.help" },
    { id: "go", key: "phrase.go" },
    { id: "thanks", key: "phrase.thanks" },
  ];

  function emote(id: IconName): void {
    engine.bus.emit("emote", { id });
    onclose();
  }

  /** A preset phrase by id: the speech bubble shows it, and a co-op room sends only the id. */
  function phrase(id: string): void {
    engine.bus.emit("phrase", { id });
    onclose();
  }

  function onkey(event: KeyboardEvent): void {
    if (event.key === "Escape" || event.code === "KeyG") {
      event.preventDefault();
      event.stopPropagation();
      onclose();
    }
  }
</script>

<div class="wheel paper" role="dialog" aria-modal="true" aria-labelledby="emote-h" tabindex="-1" use:trap onkeydown={onkey}>
  <h2 id="emote-h">{t("emote.title")}</h2>
  <div class="emotes">
    {#each EMOTES as id (id)}
      <button type="button" class="emote" onclick={() => emote(id)} aria-label={t(`emote.${id}` as StringKey)}><Icon name={id} size={34} /></button>
    {/each}
  </div>
  <div class="phrases">
    {#each PHRASES as p (p.id)}
      <button type="button" class="phrase" onclick={() => phrase(p.id)}>{t(p.key)}</button>
    {/each}
  </div>
</div>

<style>
  .wheel {
    position: fixed;
    right: max(104px, calc(env(safe-area-inset-right) + 104px));
    top: 120px;
    width: min(340px, calc(100vw - 32px));
    padding: 14px 16px 16px;
    border-radius: 6px 10px 7px 9px;
    transform: rotate(-0.8deg);
    animation: unfold 0.32s var(--ease-spring);
  }
  h2 {
    margin: 0 0 8px;
    font: 700 1.2rem var(--hand);
  }
  .emotes {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    margin-bottom: 10px;
  }
  .emote {
    display: grid;
    place-items: center;
    height: 48px;
    color: var(--clay-deep);
    background: var(--paper-light);
    border: 2px solid var(--ink-soft);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring);
  }
  .emote:hover {
    transform: scale(1.12) rotate(-6deg);
  }
  .phrases {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .phrase {
    min-height: 44px;
    padding: 0 12px;
    font: 700 1rem var(--hand);
    background: #fff4c9;
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 16px 18px 14px 18px;
    cursor: pointer;
    transition: transform 0.15s var(--ease-spring);
  }
  .phrase:hover {
    transform: translateY(-2px);
  }
  @keyframes unfold {
    from {
      transform: scale(0.8) rotate(-4deg);
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .wheel {
    animation: none;
  }
  @media (max-width: 640px) {
    .wheel {
      right: 16px;
      top: 96px;
    }
  }
</style>
