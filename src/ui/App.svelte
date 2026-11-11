<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../audio/audio";
  import type { GameState } from "../game/core/state";
  import type { Engine } from "../game/engine";
  import type { NetClient, NetState } from "../net/client";
  import DebugOverlay from "./DebugOverlay.svelte";
  import { flow } from "./flow.svelte";
  import { gamepadNav } from "./focus";
  import Hud from "./Hud.svelte";
  import { goalFor } from "../content/goals";
  import EmoteWheel from "./hud/EmoteWheel.svelte";
  import Guide from "./hud/Guide.svelte";
  import PlaceCard from "./hud/PlaceCard.svelte";
  import Speech from "./hud/Speech.svelte";
  import StampMoment from "./hud/StampMoment.svelte";
  import Toasts from "./hud/Toasts.svelte";
  import Notebook from "./notebook/Notebook.svelte";
  import ChaptersPanel from "./panels/ChaptersPanel.svelte";
  import CreditsPanel from "./panels/CreditsPanel.svelte";
  import SettingsPanel from "./panels/SettingsPanel.svelte";
  import TogetherPanel from "./panels/TogetherPanel.svelte";
  import { keepPhoto } from "./photos";
  import { settings, t } from "./settings.svelte";
  import Menu from "./title/Menu.svelte";
  import StoryIntro from "./title/StoryIntro.svelte";
  import TitleScreen from "./title/TitleScreen.svelte";

  interface Props {
    net: NetClient;
    engine: Engine;
    version: string;
    debug: boolean;
  }

  let { net, engine, version, debug }: Props = $props();
  // `subscribe` reports the current state right away, so this default never shows.
  let netState: NetState = $state({ status: "solo", room: null, players: 1 });
  let game = $state<GameState>(untrack(() => ({ ...engine.store.value })));
  let flash = $state(false);
  /** The short story plays before a new story starts. */
  let story = $state(false);

  $effect(() => net.subscribe((next) => (netState = next)));
  $effect(() => engine.store.subscribe((next) => (game = { ...next })));

  // The world holds still under the notebook and panels, and sounds muffled.
  $effect(() => {
    engine.paused = flow.covered || flow.emotes;
    audio.muffle(flow.notebook);
  });
  $effect(() => {
    const m = settings.value.motion;
    engine.setReducedMotion(m === "system" ? null : m === "reduce");
  });

  // A gamepad steers the 2D screens too: the title, the menu and any open panel.
  // The notebook runs its own, and in play the pad drives the game instead.
  $effect(() =>
    gamepadNav(
      () => {
        if (flow.notebook) return null;
        if (story) return document.querySelector<HTMLElement>("#ui .story");
        if (flow.panel) return document.querySelector<HTMLElement>("#ui [role='dialog']");
        if (flow.emotes) return document.querySelector<HTMLElement>("#ui .wheel");
        if (flow.stage === "menu") return document.querySelector<HTMLElement>("#ui .confirm") ?? document.querySelector<HTMLElement>("#ui .menu");
        if (flow.stage === "title") return document.getElementById("ui");
        return null;
      },
      () => {
        if (story) begin(true);
        else if (flow.panel) flow.close();
        else if (flow.emotes) flow.emotes = false;
      },
    ),
  );

  const hasSave = $derived(game.delivered.length > 0 || game.carrying !== null || game.stamps.length > 0);
  const chaptersOpen = $derived(settings.value.exploreFreely || game.stamps.includes("prologue"));

  $effect(() => {
    const offs = [
      engine.bus.on("title:done", () => {
        flow.setStage("play");
        greet();
      }),
      engine.bus.on("letter:delivered", ({ letter }) => {
        if (letter !== "to-the-lamp") return;
        const lamp = engine.world?.anchor("lamp");
        engine.bus.emit("say", { speaker: "dad", name: "Dad", text: "Thanks for waiting up.", at: lamp ? [lamp.x, lamp.y + 0.3, lamp.z] : null });
        window.setTimeout(() => {
          engine.bus.emit("stamp", { id: "prologue", lines: ["Left on.", "Still shining."] });
          engine.store.update((s) => {
            if (!s.stamps.includes("prologue")) s.stamps.push("prologue");
          });
          window.setTimeout(() => engine.bus.emit("toast", { text: t("toast.saved") }), 3400);
        }, 2600);
      }),
    ];
    return () => offs.forEach((off) => off());
  });

  function greet(): void {
    const mom = engine.world?.anchor("mom");
    if (!mom) return;
    window.setTimeout(() => engine.bus.emit("say", { speaker: "mom", name: "Mom", text: "Take your time, love. I'll be right here on the porch.", at: [mom.x, mom.y, mom.z] }), 900);
  }

  /** The chain was pulled: click, light the windows, start the music, open the menu. */
  function pull(): void {
    audio.lampClick();
    engine.titleBegin();
    audio.startMusic();
    const start = performance.now();
    const ramp = (): void => {
      const k = Math.min(1, (performance.now() - start) / 1400);
      engine.world?.setPower(0.2 + 0.8 * k);
      if (k < 1) requestAnimationFrame(ramp);
    };
    ramp();
    window.setTimeout(() => flow.setStage("menu"), 650);
  }

  function start(fresh: boolean): void {
    // A new story opens with the short story of how Remi got here.
    if (fresh) {
      flow.close();
      story = true;
      return;
    }
    begin(false);
  }

  function begin(fresh: boolean): void {
    if (fresh && !story) return;
    story = false;
    if (fresh) engine.store.load(null);
    flow.close();
    flow.setStage("title");
    audio.setHum(0.4);
    engine.leaveTitle();
  }

  function home(): void {
    flow.close();
    if (flow.stage === "menu") start(false);
  }

  async function photo(): Promise<void> {
    flash = true;
    window.setTimeout(() => (flash = false), 180);
    audio.ui("tick");
    const { full } = await keepPhoto(engine.snapshot());
    engine.bus.emit("toast", { text: full ? t("toast.photoFull") : t("toast.photo") });
  }

  /** A hint is the current goal, said a little more fully. */
  function hint(): void {
    engine.bus.emit("toast", { text: goalFor(game, engine.input.device).hint });
  }

  function toggleNotebook(open: boolean): void {
    audio.ui("page");
    flow.setNotebook(open);
  }

  const label = $derived.by(() => {
    switch (netState.status) {
      case "connecting":
        return "Finding your room";
      case "connected":
        return netState.players === 1 ? "Room open. Just you so far." : `Room open. ${netState.players} friends here.`;
      case "offline":
        return "Friends can't join right now. You can still play.";
      case "full":
        return "That room is full. You can still play on your own.";
      default:
        return "";
    }
  });
</script>

{#if flow.stage === "title" || flow.stage === "menu"}
  <TitleScreen {engine} onpull={pull} />
{/if}
{#if flow.stage === "menu" && !flow.panel && !story}
  <Menu {hasSave} chapters={chaptersOpen} onstart={start} />
{/if}
{#if story}
  <StoryIntro ondone={() => begin(true)} />
{/if}

<Hud
  {engine}
  hidden={flow.stage !== "play" || flow.covered}
  onnotebook={() => toggleNotebook(true)}
  onphoto={photo}
  onemote={() => (flow.emotes = !flow.emotes)}
  onsettings={() => flow.open("settings")}
  onhint={hint}
/>
<Guide {engine} {game} hidden={flow.stage !== "play" || flow.covered} notebookOpen={flow.notebook} />
<PlaceCard {engine} hidden={flow.stage !== "play" || flow.covered || flow.notebook} />
<Speech {engine} />
<Toasts {engine} />
<StampMoment {engine} />

{#if flow.emotes && flow.stage === "play" && !flow.covered}
  <EmoteWheel {engine} onclose={() => (flow.emotes = false)} />
{/if}
{#if flow.notebook}
  <Notebook {game} page={flow.notebookPage} onclose={() => toggleNotebook(false)} onpage={(p) => (flow.notebookPage = p)} />
{/if}
{#if flow.panel === "settings"}
  <SettingsPanel {engine} onclose={() => flow.close()} />
{:else if flow.panel === "credits"}
  <CreditsPanel onclose={() => flow.close()} />
{:else if flow.panel === "together"}
  <TogetherPanel onclose={() => flow.close()} />
{:else if flow.panel === "chapters"}
  <ChaptersPanel onclose={() => flow.close()} onhome={home} />
{/if}

{#if flash}<div class="flash" aria-hidden="true"></div>{/if}
{#if debug}<DebugOverlay {engine} {version} />{/if}
{#if label}
  <aside class="net" aria-live="polite">{label}</aside>
{/if}

<style>
  .net {
    position: fixed;
    left: 50%;
    top: 16px;
    transform: translateX(-50%) rotate(-0.8deg);
    max-width: calc(100vw - 32px);
    padding: 8px 14px;
    background: var(--paper);
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 4px 10px 4px 9px;
    box-shadow: 3px 4px 0 var(--shadow);
    font: 700 1rem/1.35 var(--hand);
  }
  .flash {
    position: fixed;
    inset: 0;
    background: #fffaf0;
    animation: flash 0.18s ease-out forwards;
  }
  @keyframes flash {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }
</style>
