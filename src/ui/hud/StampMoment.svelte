<script lang="ts">
  import { audio } from "../../audio/audio";
  import type { Engine } from "../../game/engine";
  import InkStamp from "../notebook/InkStamp.svelte";
  import MissionPatch, { type PatchId } from "../notebook/MissionPatch.svelte";
  import { t } from "../settings.svelte";

  /**
   * The stamp moment: a big round ink stamp thunks onto the screen when a
   * chapter or beat is complete, like a post office cancelling a letter.
   * Then that machine's mission patch flies in, to be sewn into Dad's
   * notebook. Brief, and any key, click or tap skips it.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  /** Which patch and which post office each stamp belongs to. */
  const STAMPS: Record<string, { patch: PatchId; post: string }> = {
    prologue: { patch: "lamp", post: "HOME POST" },
    "chapter-1": { patch: "lrrr", post: "MOON POST" },
    "chapter-2": { patch: "lrv", post: "MOON POST" },
    "chapter-3": { patch: "opportunity", post: "MARS POST" },
    "chapter-4": { patch: "ingenuity", post: "MARS POST" },
    finale: { patch: "voyager", post: "DEEP SPACE POST" },
  };

  let current = $state<{ key: number; id: string; lines: [string, string] } | null>(null);
  let timer = 0;
  let counter = 0;
  const info = $derived(current ? (STAMPS[current.id] ?? null) : null);

  $effect(() =>
    engine.bus.on("stamp", ({ id, lines }) => {
      current = { key: counter++, id, lines };
      window.setTimeout(() => audio.ui("stamp"), 430);
      if (STAMPS[id]) window.setTimeout(() => audio.play("part-clunk", { level: 0.6 }), 1250);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (current = null), STAMPS[id] ? 4200 : 3200);
    }),
  );

  function skip(): void {
    current = null;
    window.clearTimeout(timer);
  }

  function onkey(event: KeyboardEvent): void {
    if (current && event.key !== "Tab") skip();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if current}
  {#key current.key}
    <div class="moment" role="status" aria-live="assertive">
      <button type="button" class="hit" onclick={skip} aria-label={t("stamp.skip")}></button>
      <div class="press">
        <span class="sheet" aria-hidden="true"></span>
        <div class="stamp">
          <InkStamp lines={current.lines} bottom={info?.post ?? "HOME POST"} size="min(64vmin, 470px)" tilt={-7} label={`${current.lines[0]} ${current.lines[1]}`} />
        </div>
        {#if info}
          <div class="patch">
            <MissionPatch id={info.patch} size={150} tilt={8} />
            <p>{t("stamp.patch")}</p>
          </div>
        {/if}
      </div>
      <p class="skip">{t("stamp.skip")}</p>
    </div>
  {/key}
{/if}

<style>
  .moment {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: radial-gradient(circle, rgba(244, 236, 221, 0.25), rgba(24, 18, 30, 0.35));
  }
  .hit {
    position: absolute;
    inset: 0;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .press {
    position: relative;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  /* A page of Dad's paper slides in first, so the red ink has something to land on. */
  .sheet {
    position: absolute;
    inset: -8% -6% -8% -6%;
    background-color: #fbf6ea;
    background-image:
      var(--grain),
      repeating-linear-gradient(180deg, transparent 0 27px, rgba(64, 108, 170, 0.12) 27px 28px);
    border-radius: 4px;
    box-shadow:
      0 2px 0 #e2d4b8,
      0 30px 60px -20px rgba(0, 0, 0, 0.7);
    transform: rotate(2deg);
    animation: sheet-in 0.35s var(--ease-out) both;
  }
  .stamp {
    position: relative;
    animation: thunk 0.55s 0.18s cubic-bezier(0.5, 0, 0.3, 1.4) both;
  }
  /* The patch flies in from the side and settles at the stamp's corner. */
  .patch {
    position: absolute;
    right: -70px;
    bottom: -40px;
    display: grid;
    justify-items: center;
    gap: 6px;
    animation: patch-in 0.7s 1.1s cubic-bezier(0.3, 1.4, 0.5, 1) both;
  }
  .patch p {
    margin: 0;
    padding: 4px 10px;
    background: var(--paper-light);
    border-radius: 3px;
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.5);
    font: 700 1rem/1.2 var(--hand);
    color: var(--ink);
    transform: rotate(-3deg);
  }
  .skip {
    position: absolute;
    bottom: 40px;
    margin: 0;
    font: 700 1rem var(--hand);
    color: var(--paper-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    pointer-events: none;
  }
  @keyframes thunk {
    0% {
      transform: scale(2.6) rotate(-7deg);
      opacity: 0;
    }
    55% {
      transform: scale(0.94);
      opacity: 1;
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes sheet-in {
    from {
      opacity: 0;
      transform: translateY(30px) rotate(-2deg);
    }
  }
  @keyframes patch-in {
    from {
      opacity: 0;
      transform: translate(120px, 40px) rotate(40deg) scale(0.6);
    }
  }
  :global(:root[data-motion="reduce"]) .stamp,
  :global(:root[data-motion="reduce"]) .sheet,
  :global(:root[data-motion="reduce"]) .patch {
    animation: none;
  }
</style>
