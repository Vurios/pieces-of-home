<script lang="ts">
  import { banners } from "./hud/banners.svelte";
  import { untrack } from "svelte";
  import { audio } from "../audio/audio";
  import type { GameState } from "../game/core/state";
  import type { Engine } from "../game/engine";
  import type { NetClient, NetState } from "../net/client";
  import type { Coop } from "../net/coop";
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
  import FriendTags from "./hud/FriendTags.svelte";
  import HelpBadge from "./hud/HelpBadge.svelte";
  import StampMoment from "./hud/StampMoment.svelte";
  import Toasts from "./hud/Toasts.svelte";
  import Notebook from "./notebook/Notebook.svelte";
  import ArchivePanel from "./panels/ArchivePanel.svelte";
  import RocketPanel from "./panels/RocketPanel.svelte";
  import LetterOpen from "./story/LetterOpen.svelte";
  import ChaptersPanel from "./panels/ChaptersPanel.svelte";
  import CreditsPanel from "./panels/CreditsPanel.svelte";
  import GuidePanel from "./panels/GuidePanel.svelte";
  import SettingsPanel from "./panels/SettingsPanel.svelte";
  import TogetherPanel from "./panels/TogetherPanel.svelte";
  import { keepPhoto } from "./photos";
  import { CHAPTERS } from "../content/chapters";
  import { SPREADS } from "../content/notebook";
  import { StoryDirector } from "./story/director";
  import Seismograph from "./story/Seismograph.svelte";
  import StoryCards from "./story/StoryCards.svelte";
  import StoryGames from "./story/StoryGames.svelte";
  import DishGame from "./story/DishGame.svelte";
  import FinaleGames from "./story/FinaleGames.svelte";
  import WheelGame from "./story/WheelGame.svelte";
  import ThinAirGames from "./story/ThinAirGames.svelte";
  import SurveyorGames from "./story/SurveyorGames.svelte";
  import DriveCard from "./story/DriveCard.svelte";
  import { V1_LETTER } from "../content/finale";
  import ActivityMeter from "./story/ActivityMeter.svelte";
  import { settings, t } from "./settings.svelte";
  import Menu from "./title/Menu.svelte";
  import StoryIntro from "./title/StoryIntro.svelte";
  import AdventureCard from "./story/AdventureCard.svelte";
  import TitleScreen from "./title/TitleScreen.svelte";

  interface Props {
    net: NetClient;
    coop: Coop;
    engine: Engine;
    version: string;
    debug: boolean;
  }

  let { net, coop, engine, version, debug }: Props = $props();
  // `subscribe` reports the current state right away, so this default never shows.
  let netState: NetState = $state({ status: "solo", room: null, players: 1, you: null, seats: [] });
  let game = $state<GameState>(untrack(() => ({ ...engine.store.value })));
  let flash = $state(false);
  /** The short story plays before a new story starts. */
  let story = $state(false);
  /** "Your adventure": shown once, when a new story lands behind Remi. */
  let adventure = $state(false);
  let adventureNext = false;

  /** A dive into one of Dad's domes, before the trip itself. */
  let trip = $state<{ to: string; entry?: string } | null>(null);

  $effect(() => net.subscribe((next) => (netState = next)));
  // The story director plays chapter scripts and moves each chapter along.
  $effect(() => {
    const director = new StoryDirector(engine, (text) => engine.bus.emit("toast", { text }));
    return () => director.dispose();
  });
  // The paper arrow can be turned off in Settings.
  $effect(() => engine.setGuideArrow(settings.value.guideArrow));
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
      engine.bus.on("travel", ({ to, entry, via }) => {
        if (engine.traveling || trip) return;
        // A mirror panel, a breeze flag or the parts bag stays in its world: it goes back where it came from.
        if (/^(mirror|flag|bag):/.test(engine.store.value.carrying ?? "")) engine.store.update((s) => void (s.carrying = null));
        // Looking into a dome on Dad's bench: the camera dives into its little world first.
        // Otherwise (Dad's rocket, the chapter list) the rocket trip is the whole ride.
        const chapter = CHAPTERS.find((c) => c.world === to);
        const dome = chapter && via !== "rocket" && engine.world?.id === "home" ? engine.world.anchor(`dome-top-${to}`) : null;
        if (dome) {
          trip = { to, ...(entry ? { entry } : {}) };
          audio.play("lamp-click");
          void engine.diveInto(dome).then(() => {
            const t = trip;
            trip = null;
            if (t) void engine.travel(t.to, t.entry);
          });
        } else void engine.travel(to, entry);
      }),
      engine.bus.on("notebook:open", ({ spread }) => {
        const index = SPREADS.findIndex((s) => s.id === spread);
        audio.ui("page");
        // One spread per machine, after the cover.
        flow.setNotebook(true, index + 1);
      }),
      engine.bus.on("title:done", () => {
        flow.setStage("play");
        if (adventureNext) {
          adventureNext = false;
          adventure = true;
          banners.screens += 1;
          engine.holdStill += 1;
          return;
        }
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
      engine.bus.on("archive:open", () => flow.open("archive")),
      engine.bus.on("rocket:open", () => flow.open("rocket")),
      engine.bus.on("hint:ask", ({ who, name, at }) => friendHint(who, name, at)),
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
    const at: [number, number, number] = [mom.x, mom.y, mom.z];
    const fresh = !engine.store.value.flags.includes("workshop-key") && !engine.store.value.delivered.includes("to-the-lamp");
    if (!fresh) {
      window.setTimeout(() => engine.bus.emit("say", { speaker: "mom", name: "Mom", text: "Take your time, love. I'll be right here on the porch.", at }), 900);
      return;
    }
    // A new story: Mom hands Remi the key to Dad's workshop first.
    window.setTimeout(() => engine.bus.emit("say", { speaker: "mom", name: "Mom", text: "Here's the key to Dad's workshop.", at }), 900);
    window.setTimeout(() => {
      engine.store.update((s) => {
        if (!s.flags.includes("workshop-key")) s.flags.push("workshop-key");
      });
      audio.play("envelope-pickup");
      engine.bus.emit("toast", { text: t("toast.key") });
    }, 3000);
    window.setTimeout(() => engine.bus.emit("say", { speaker: "mom", name: "Mom", text: "Take your time, love. I'll be right here on the porch.", at }), 4300);
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
      engine.store.load(null);
      story = true;
      return;
    }
    begin(false);
  }

  function begin(fresh: boolean): void {
    if (fresh && !story) return;
    story = false;
    if (fresh) engine.store.load(null);
    adventureNext = fresh;
    flow.close();
    flow.setStage("title");
    audio.setHum(0.4);
    engine.leaveTitle();
  }

  function adventureDone(): void {
    adventure = false;
    banners.screens = Math.max(0, banners.screens - 1);
    engine.holdStill = Math.max(0, engine.holdStill - 1);
    greet();
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
    const { full, count } = await keepPhoto(engine.snapshot());
    engine.bus.emit("photo:taken", { count });
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

  /** A friend in the workshop says the same hint out loud, one tier further each time. */
  function friendHint(who: string, name: string, at: [number, number, number]): void {
    const goal = goalFor(game, engine.input.device);
    const key = `${goal.id}:${goal.title}`;
    hintTier = key === hintFor ? Math.min(2, hintTier + 1) : 0;
    hintFor = key;
    const tiers = goal.hints ?? [goal.hint, goal.hint, goal.hint];
    engine.bus.emit("say", { speaker: who, name, text: tiers[hintTier]!, at });
  }

  function toggleNotebook(open: boolean): void {
    audio.play(open ? "book-open" : "book-close");
    flow.setNotebook(open);
  }

  const label = $derived.by(() => {
    switch (netState.status) {
      case "connecting":
        return t("together.opening");
      case "reconnecting":
        return t("together.again");
      case "connected":
        return netState.players === 1 ? "Room open. Just you so far." : `Room open. ${netState.players} here.`;
      case "offline":
        return t("together.resting");
      case "full":
        return t("together.full");
      default:
        return "";
    }
  });

  // The game's own screens, a trip starting and the dive into a dome all clear the HUD away.
  const quiet = $derived(flow.stage !== "play" || flow.covered || banners.traveling || banners.screens > 0 || !!trip);
</script>

{#if flow.stage === "title" || flow.stage === "menu"}
  <TitleScreen {engine} onpull={pull} />
{/if}
{#if flow.stage === "menu" && !flow.panel && !story}
  <Menu {hasSave} chapters={chaptersOpen} onstart={start} />
{/if}
{#if story}
  <StoryIntro {engine} ondone={() => begin(true)} />
{/if}
{#if adventure}
  <AdventureCard ondone={adventureDone} />
{/if}

<Hud
  {engine}
  hidden={quiet}
  onnotebook={() => toggleNotebook(true)}
  onphoto={photo}
  onemote={() => (flow.emotes = !flow.emotes)}
  onsettings={() => flow.open("settings")}
  onhint={hint}
  onmap={() => engine.mapView() && flow.open("map")}
/>
<MiniMap {engine} {game} hidden={quiet || !settings.value.miniMap} onopen={() => flow.open("map")} />
<Guide {engine} {game} hidden={quiet} notebookOpen={flow.notebook} />
<PlaceCard {engine} hidden={flow.stage !== "play" || flow.covered || flow.notebook || !!trip} />
<FriendTags {engine} hidden={quiet} />
<Speech {engine} />
<HelpBadge />
<StoryCards {engine} />
<LetterOpen {engine} />
<StoryGames {engine} />
<DishGame {engine} />
<FinaleGames {engine} />
<WheelGame {engine} />
<ThinAirGames {engine} />
<SurveyorGames {engine} />
<DriveCard {engine} />
<ActivityMeter {engine} />
<Seismograph {engine} {game} />
<Toasts {engine} />
<StampMoment {engine} />

{#if flow.emotes && flow.stage === "play" && !flow.covered}
  <EmoteWheel {engine} onclose={() => (flow.emotes = false)} />
{/if}
{#if flow.notebook}
  <Notebook
    {game}
    page={flow.notebookPage}
    onclose={() => toggleNotebook(false)}
    onpage={(p) => (flow.notebookPage = p)}
    onread={(letter) => engine.bus.emit("letter:open", { key: Date.now(), ...letter, delivered: true })}
  />
{/if}
{#if flow.panel === "settings"}
  <SettingsPanel {engine} onclose={() => flow.close()} />
{:else if flow.panel === "credits"}
  <CreditsPanel onclose={() => flow.close()} />
{:else if flow.panel === "together"}
  <TogetherPanel {net} {coop} onclose={() => flow.close()} />
{:else if flow.panel === "guide"}
  <GuidePanel onclose={() => flow.close()} />
{:else if flow.panel === "archive"}
  <ArchivePanel onclose={() => flow.close()} />
{:else if flow.panel === "chapters"}
  <ChaptersPanel
    {game}
    onclose={() => flow.close()}
    onhome={home}
    ongo={(world) => {
      home();
      // Into play first, then through the Looking Lamp to the chosen world.
      window.setTimeout(() => engine.bus.emit("travel", { to: world, entry: "lamp" }), 600);
    }}
  />
{:else if flow.panel === "map"}
  <MapPanel {engine} {game} onclose={() => flow.close()} onrocket={chaptersOpen && !game.carrying?.startsWith("part:") ? () => flow.open("rocket") : undefined} />
{:else if flow.panel === "rocket"}
  <RocketPanel
    {game}
    here={engine.world?.id ?? "home"}
    onclose={() => flow.close()}
    ongo={(world) => {
      flow.close();
      // Home by rocket lands in the yard by the toy rocket; a little world at its lamp.
      window.setTimeout(() => engine.bus.emit("travel", { to: world, entry: world === "home" ? "rocket" : "lamp", via: "rocket" }), 250);
    }}
  />
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
