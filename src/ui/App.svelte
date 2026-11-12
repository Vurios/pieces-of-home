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
  import MiniMap from "./map/MiniMap.svelte";
  import MapPanel from "./map/MapPanel.svelte";
  import PlaceCard from "./hud/PlaceCard.svelte";
  import TravelScreen from "./hud/TravelScreen.svelte";
  import Speech from "./hud/Speech.svelte";
  import StampMoment from "./hud/StampMoment.svelte";
  import Toasts from "./hud/Toasts.svelte";
  import Notebook from "./notebook/Notebook.svelte";
  import ChaptersPanel from "./panels/ChaptersPanel.svelte";
  import CreditsPanel from "./panels/CreditsPanel.svelte";
  import SettingsPanel from "./panels/SettingsPanel.svelte";
  import TogetherPanel from "./panels/TogetherPanel.svelte";
  import { keepPhoto } from "./photos";
  import { CHAPTERS } from "../content/chapters";
  import { SPREADS } from "../content/notebook";
  import Countdown from "./story/Countdown.svelte";
  import { StoryDirector } from "./story/director";
  import Seismograph from "./story/Seismograph.svelte";
  import StoryCards from "./story/StoryCards.svelte";
  import StoryGames from "./story/StoryGames.svelte";
  import DishGame from "./story/DishGame.svelte";
  import FinaleGames from "./story/FinaleGames.svelte";
  import { V1_LETTER } from "../content/finale";
  import ActivityMeter from "./story/ActivityMeter.svelte";
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

  /** A trip into a dome waits for its countdown. */
  let trip = $state<{ to: string; entry?: string; place: string } | null>(null);

  $effect(() => net.subscribe((next) => (netState = next)));
  // The story director plays chapter scripts and moves each chapter along.
  $effect(() => {
    const director = new StoryDirector(engine, (text) => engine.bus.emit("toast", { text }));
    return () => director.dispose();
  });
  // Explore freely opens every built dome.
  $effect(() => {
    const on = settings.value.exploreFreely;
    untrack(() => {
      if (on !== engine.store.value.flags.includes("explore-freely"))
        engine.store.update((s) => {
          s.flags = on ? [...s.flags, "explore-freely"] : s.flags.filter((f) => f !== "explore-freely");
        });
    });
  });
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
      engine.bus.on("travel", ({ to, entry }) => {
        if (engine.traveling || trip) return;
        // A mirror panel or a breeze flag stays in its world: it goes back where it came from.
        if (/^(mirror|flag):/.test(engine.store.value.carrying ?? "")) engine.store.update((s) => void (s.carrying = null));
        const chapter = CHAPTERS.find((c) => c.world === to);
        if (chapter) trip = { to, place: chapter.dome, ...(entry ? { entry } : {}) };
        else void engine.travel(to, entry);
      }),
      engine.bus.on("notebook:open", ({ spread }) => {
        const index = SPREADS.findIndex((s) => s.id === spread);
        audio.ui("page");
        flow.setNotebook(true, index + 1);
      }),
      engine.bus.on("title:done", () => {
        flow.setStage("play");
        greet();
      }),
      // Dad's dish on the hill: it turns, the radio hisses, a few faint blips come in.
      engine.bus.on("interact:done", ({ id }) => {
        // With Dad's last letter in hand, the dish opens the star map instead (Finale).
        if (id !== "dish" || engine.store.value.carrying === V1_LETTER) return;
        const at = engine.world?.anchor("dish") ?? null;
        audio.play("dish-servo", { at });
        window.setTimeout(() => {
          const hiss = audio.loop("radio-hiss", 0.8, at);
          for (const delay of [0.6, 1.5, 1.9, 2.8]) audio.play("call-blip", { at, delay, level: 0.5 });
          window.setTimeout(() => {
            hiss?.stop();
            engine.bus.emit("toast", { text: t("toast.dish") });
          }, 3400);
        }, 1200);
      }),
      engine.bus.on("letter:delivered", ({ letter }) => {
        if (letter !== "to-the-lamp") return;
        const lamp = engine.world?.anchor("lamp");
        engine.bus.emit("say", { speaker: "dad", name: "Dad", text: "Thanks for waiting up.", at: lamp ? [lamp.x, lamp.y + 0.3, lamp.z] : null, line: "prologue-lamp-thanks" });
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
    // A shutter, then the instant photo rolls out.
    audio.play("shutter");
    audio.play("polaroid-whirr", { delay: 0.25 });
    const { full } = await keepPhoto(engine.snapshot());
    engine.bus.emit("toast", { text: full ? t("toast.photoFull") : t("toast.photo") });
  }

  /** Hints come in three tiers: a nudge, a direction, then "show me". Each press of Hint goes one further. */
  let hintFor = "";
  let hintTier = 0;
  function hint(): void {
    const goal = goalFor(game, engine.input.device);
    const key = `${goal.id}:${goal.title}`;
    hintTier = key === hintFor ? Math.min(2, hintTier + 1) : 0;
    hintFor = key;
    const tiers = goal.hints ?? [goal.hint, goal.hint, goal.hint];
    engine.bus.emit("toast", { text: tiers[hintTier]! });
  }

  function toggleNotebook(open: boolean): void {
    audio.play(open ? "book-open" : "book-close");
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
  onmap={() => engine.mapView() && flow.open("map")}
/>
<MiniMap {engine} {game} hidden={flow.stage !== "play" || flow.covered || !settings.value.miniMap} onopen={() => flow.open("map")} />
<Guide {engine} {game} hidden={flow.stage !== "play" || flow.covered} notebookOpen={flow.notebook} />
<PlaceCard {engine} hidden={flow.stage !== "play" || flow.covered || flow.notebook} />
<Speech {engine} />
<StoryCards {engine} />
<StoryGames {engine} />
<DishGame {engine} />
<FinaleGames {engine} />
<ActivityMeter {engine} />
<Seismograph {engine} {game} />
{#if trip}
  <Countdown
    place={trip.place}
    ondone={() => {
      const t = trip;
      trip = null;
      if (t) void engine.travel(t.to, t.entry);
    }}
  />
{/if}
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
{:else if flow.panel === "map"}
  <MapPanel {engine} {game} onclose={() => flow.close()} />
{/if}

<TravelScreen {engine} />
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
