<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";
  import CardHead from "./card/CardHead.svelte";
  import GameAsk from "./card/GameAsk.svelte";
  import GameSteps from "./card/GameSteps.svelte";
  import { LOG_CHIPS, type LogNote, logNoteText, readLogNote, writeLogNote } from "./log-note";

  /**
   * Chapter 4's small games on screen (story games "rotor", "scout", "note").
   *
   * - rotor: Dad's rotor bench. The same rotor that hops in Earth air barely
   *   lifts in Mars air; make the blades bigger and faster until it hops.
   *   The numbers are Dad's model: lift grows with the air, the blade length
   *   and the spin speed. Mars air is about one hundredth as thick (fact
   *   mars-thin-air), and the model uses exactly that.
   * - scout: the view from Dad's toy helicopter, looking straight down. Draw
   *   a safe way for the toy rover between the rocks and the soft sand.
   * - note: leave a note in Ingenuity's log, made of word chips.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  type Id = "rotor" | "scout" | "note";
  let open = $state<{ key: number; id: Id } | null>(null);

  const sfx = (name: string, level?: number): void => engine.bus.emit("sfx", { name, ...(level === undefined ? {} : { level }) });

  $effect(() =>
    engine.bus.on("story:game", (p) => {
      if (p.id !== "rotor" && p.id !== "scout" && p.id !== "note") return;
      if (p.id === "rotor") resetRotor();
      if (p.id === "scout") resetScout();
      if (p.id === "note") resetNote();
      open = { key: p.key, id: p.id };
      audio.ui("page");
    }),
  );

  function finish(): void {
    if (!open || !ready) return;
    const key = open.key;
    if (open.id === "note" && note.hello && note.middle && note.bye) writeLogNote({ hello: note.hello, middle: note.middle, bye: note.bye });
    open = null;
    audio.ui("tick");
    engine.bus.emit("story:game-done", { key });
  }

  // ---------------- rotor ----------------
  const AIR = { earth: 1, mars: 0.01 } as const;
  /** What the little model weighs, in the model's own lift units. */
  const WEIGHT = 4;
  type Air = keyof typeof AIR;
  let air = $state<Air>("earth");
  let length = $state(2);
  let speed = $state(2);
  let spinning = $state(false);
  let hop = $state(0);
  let wobble = $state(0);
  let blade = $state(0);
  let rotorSay = $state<string | null>(null);
  /** How the last spin went, to tint Remi's line. */
  let lastFlew = $state<boolean | null>(null);
  let tasks = $state({ earth: false, mars: false, flew: false });
  const lift = $derived(AIR[air] * length * length * speed * speed);
  const ratio = $derived(lift / WEIGHT);

  function resetRotor(): void {
    air = "earth";
    length = 2;
    speed = 2;
    spinning = false;
    hop = 0;
    wobble = 0;
    rotorSay = null;
    lastFlew = null;
    tasks = { earth: false, mars: false, flew: false };
  }
  const rotorAsk = $derived(
    spinning
      ? "Spinning..."
      : (rotorSay ??
          (!tasks.earth ? "First, spin it in Earth air." : !tasks.mars ? "Now switch to Mars air and spin it again." : !tasks.flew ? "Make the blades bigger and faster. Can it hop on Mars?" : "It flies in thin air!")),
  );

  function setAir(next: Air): void {
    if (spinning || air === next) return;
    air = next;
    rotorSay = null;
    lastFlew = null;
    audio.ui("pop");
  }
  function nudge(kind: "length" | "speed", by: number): void {
    if (spinning) return;
    if (kind === "length") length = Math.max(1, Math.min(5, length + by));
    else speed = Math.max(1, Math.min(5, speed + by));
    rotorSay = null;
    audio.ui("tick");
  }

  function spin(): void {
    if (spinning || !open) return;
    spinning = true;
    rotorSay = null;
    const flies = ratio >= 1;
    lastFlew = null;
    const start = performance.now();
    const total = settings.reducedMotion ? 500 : 2200;
    sfx("hover-hop", 0.6 + speed * 0.06);
    const run = (now: number): void => {
      const t = Math.min(1, (now - start) / total);
      blade += 0.25 + speed * 0.22;
      // Up and down again in a smooth arc; a rotor without enough lift only trembles.
      const arc = Math.sin(Math.PI * Math.min(1, t * 1.05));
      hop = flies ? arc * Math.min(1, 0.45 + (ratio - 1) * 0.08) : 0;
      wobble = flies ? 0 : Math.sin(now / 30) * 1.4 * arc * Math.min(1, ratio * 2);
      if (t < 1) requestAnimationFrame(run);
      else {
        spinning = false;
        hop = 0;
        wobble = 0;
        lastFlew = flies;
        if (air === "earth") {
          if (flies) tasks = { ...tasks, earth: true };
          rotorSay = flies ? "It hops! Earth air is thick, so a small rotor can lift." : "Not enough lift yet. Try bigger blades, or spin faster.";
        } else {
          if (!tasks.earth) rotorSay = flies ? "It hops on Mars! Now try Earth air, to see the difference." : "Hardly anything. Try it in Earth air first.";
          else if (flies) {
            tasks = { ...tasks, mars: true, flew: true };
            rotorSay = "It hops, even in thin air! Long blades, spinning very fast.";
            sfx("corner-sparkle", 0.6);
          } else {
            tasks = { ...tasks, mars: true };
            rotorSay = "In Mars air the rotor barely lifts. Make the blades bigger and faster.";
          }
        }
      }
    };
    requestAnimationFrame(run);
  }
  /** The bits of air inside the glass jar, spread over its inside. */
  const DOTS = Array.from({ length: 70 }, (_, i) => {
    const r = (n: number): number => {
      const x = Math.sin(i * 47.3 + n * 13.1) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: 176 + r(1) * 210, y: 52 + r(2) * 200, r: 2 + r(3) * 2, delay: -r(4) * 6 };
  });
  /** In Mars air the jar holds only a few bits of air: about one in a hundred, rounded up so a few still show. */
  const dots = $derived(air === "earth" ? DOTS : DOTS.slice(0, 3));
  /** The glass jar on Dad's bench, in the picture's own units. */
  const JAR = "M166 264 V120 C166 60 214 36 280 36 C346 36 394 60 394 120 V264 Z";
  /** Where the chalk "hop" line is, and how high a good hop rises. */
  const HOP_Y = 200;
  const HOP_RISE = 118;
  const reach = $derived(18 + length * 18);
  /** The lift gauge: a half circle that reads up to a little past "enough to hop". */
  const GAUGE_MAX = 1.6;
  const arcAt = (f: number, r = 70): string => {
    const a = Math.PI - f * Math.PI;
    return `${(100 + r * Math.cos(a)).toFixed(1)} ${(88 - r * Math.sin(a)).toFixed(1)}`;
  };
  const HOP_F = 1 / GAUGE_MAX;
  const needle = $derived(Math.min(1, ratio / GAUGE_MAX));

  // ---------------- scout ----------------
  const COLS = 9;
  const ROWS = 5;
  const MAP = ["..R...S..", "..R.S.S..", "....S..R.", ".RR...RR.", "....R...."];
  const START = { c: 0, r: 2 };
  const GOAL = { c: 8, r: 2 };
  const CELL = 64;
  const blocked = (c: number, r: number): boolean => c < 0 || r < 0 || c >= COLS || r >= ROWS || MAP[r]![c] !== ".";
  let path = $state<{ c: number; r: number }[]>([]);
  let driving = $state(false);
  let roverAt = $state(0);
  let arrived = $state(false);
  let bumped = $state<string | null>(null);
  const reached = $derived(path.length > 0 && path[path.length - 1]!.c === GOAL.c && path[path.length - 1]!.r === GOAL.r);

  function resetScout(): void {
    path = [{ ...START }];
    driving = false;
    roverAt = 0;
    arrived = false;
    bumped = null;
  }
  function stepTo(c: number, r: number): void {
    if (driving || arrived) return;
    const end = path[path.length - 1]!;
    const i = path.findIndex((p) => p.c === c && p.r === r);
    if (i >= 0) {
      path = path.slice(0, i + 1);
      bumped = null;
      audio.ui("tick");
      return;
    }
    if (Math.abs(end.c - c) + Math.abs(end.r - r) !== 1 || reached) return;
    if (blocked(c, r)) {
      bumped = MAP[r]?.[c] === "S" ? "Soft sand! The rover could get stuck there." : "A rock is in the way.";
      audio.ui("pop");
      return;
    }
    bumped = null;
    path = [...path, { c, r }];
    audio.ui("tick");
  }
  function stepBy(dc: number, dr: number): void {
    const end = path[path.length - 1]!;
    const prev = path[path.length - 2];
    if (prev && prev.c === end.c + dc && prev.r === end.r + dr) {
      path = path.slice(0, -1);
      audio.ui("tick");
      return;
    }
    stepTo(end.c + dc, end.r + dr);
  }
  function drive(): void {
    if (!reached || driving || arrived) return;
    driving = true;
    sfx("motor-whine", 0.4);
    const start = performance.now();
    const per = settings.reducedMotion ? 60 : 260;
    const run = (now: number): void => {
      roverAt = Math.min(path.length - 1, (now - start) / per);
      if (roverAt < path.length - 1) requestAnimationFrame(run);
      else {
        driving = false;
        arrived = true;
        sfx("corner-sparkle", 0.6);
      }
    };
    requestAnimationFrame(run);
  }
  const roverPos = $derived.by(() => {
    const i = Math.floor(roverAt);
    const a = path[i] ?? START;
    const b = path[Math.min(path.length - 1, i + 1)] ?? a;
    const t = roverAt - i;
    return { x: (a.c + (b.c - a.c) * t + 0.5) * CELL, y: (a.r + (b.r - a.r) * t + 0.5) * CELL, turn: Math.atan2(b.r - a.r, b.c - a.c) };
  });
  const scoutAsk = $derived(
    arrived ? "The rover made it, safe and sound!" : driving ? "Driving..." : (bumped ?? (reached ? "A safe way! Send it to the rover." : "Find a safe way from the rover to the flag. Go round the rocks and the soft sand.")),
  );
  const RIPPLES = Array.from({ length: 18 }, (_, i) => i);
  /** Small pebbles on the ground, for texture only. */
  const PEBBLES = Array.from({ length: 40 }, (_, i) => {
    const r = (n: number): number => {
      const x = Math.sin(i * 91.7 + n * 7.3) * 24634.6345;
      return x - Math.floor(x);
    };
    return { x: r(1) * COLS * CELL, y: r(2) * ROWS * CELL, r: 1.2 + r(3) * 2.2 };
  });

  // ---------------- note ----------------
  let note = $state<{ hello: string | null; middle: string | null; bye: string | null }>({ hello: null, middle: null, bye: null });
  let saved = $state<LogNote | null>(null);
  function resetNote(): void {
    saved = readLogNote();
    note = { hello: null, middle: null, bye: null };
  }
  const notePreview = $derived(note.hello || note.middle || note.bye ? [note.hello, note.middle, note.bye].filter(Boolean).join(" ") : "Pick a few words for whoever comes next.");

  const ready = $derived(open?.id === "rotor" ? tasks.flew && !spinning : open?.id === "scout" ? arrived : open?.id === "note" ? Boolean(note.hello && note.middle && note.bye) : false);

  // ---------------- keys and the gamepad ----------------
  $effect(() => {
    if (!open) return;
    const id = open.id;
    engine.holdStill += 1;
    untrack(() => (banners.screens += 1));
    const shownAt = performance.now();
    const act = (): void => {
      if (performance.now() - shownAt < 400) return;
      if (ready) finish();
      else if (id === "rotor") spin();
      else if (id === "scout") drive();
    };
    const onDown = (e: KeyboardEvent): void => {
      const keys = ["KeyE", "Enter", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Digit1", "Digit2"];
      if (!keys.includes(e.code)) return;
      if ((e.code === "Enter" || e.code === "Space") && (e.target as Element | null)?.closest?.("button")) return;
      if (id === "note" && e.code !== "KeyE") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) return;
      const left = e.code === "ArrowLeft" || e.code === "KeyA";
      const right = e.code === "ArrowRight" || e.code === "KeyD";
      const up = e.code === "ArrowUp" || e.code === "KeyW";
      const down = e.code === "ArrowDown" || e.code === "KeyS";
      if (id === "rotor") {
        if (e.code === "Digit1") setAir("earth");
        else if (e.code === "Digit2") setAir("mars");
        else if (left || right) nudge("length", left ? -1 : 1);
        else if (up || down) nudge("speed", down ? -1 : 1);
        else act();
      } else if (id === "scout") {
        if (left) stepBy(-1, 0);
        else if (right) stepBy(1, 0);
        else if (up) stepBy(0, -1);
        else if (down) stepBy(0, 1);
        else act();
      } else act();
    };
    window.addEventListener("keydown", onDown, true);
    let frame = 0;
    let was = { a: true, l: true, r: true, u: true, d: true };
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      const b = (i: number): boolean => Boolean(pad?.buttons[i]?.pressed);
      const now = { a: b(0), l: b(14), r: b(15), u: b(12), d: b(13) };
      if (now.a && !was.a) act();
      if (id === "scout") {
        if (now.l && !was.l) stepBy(-1, 0);
        if (now.r && !was.r) stepBy(1, 0);
        if (now.u && !was.u) stepBy(0, -1);
        if (now.d && !was.d) stepBy(0, 1);
      } else if (id === "rotor") {
        if (now.l && !was.l) nudge("length", -1);
        if (now.r && !was.r) nudge("length", 1);
        if (now.u && !was.u) nudge("speed", 1);
        if (now.d && !was.d) nudge("speed", -1);
      }
      was = now;
    };
    frame = requestAnimationFrame(poll);
    return () => {
      engine.holdStill = Math.max(0, engine.holdStill - 1);
      banners.screens = Math.max(0, banners.screens - 1);
      window.removeEventListener("keydown", onDown, true);
      cancelAnimationFrame(frame);
    };
  });

  const rotorFact = fact("ing-rotor-speed");
  const scoutFact = fact("ing-scout");
</script>

{#if open}<div class="gc-scrim"></div>{/if}
{#if open?.id === "rotor"}
  <div class="game air gc gc-mars" role="dialog" aria-label="Dad's rotor bench">
    <CardHead kicker="Dad's rotor bench" title="Can a rotor fly in thin air?" stamp="Model">
      {#snippet badge()}
        <svg viewBox="-22 -22 44 44">
          <path d="M-19 -11 H19" stroke="#34343A" stroke-width="3" stroke-linecap="round" />
          <path d="M-14 -6 H14" stroke="#34343A" stroke-width="2.4" stroke-linecap="round" opacity="0.7" />
          <path d="M0 -12 V0" stroke="#5A5450" stroke-width="2.4" />
          <rect x="-8" y="-1" width="16" height="11" rx="3" fill="#ECE5D7" stroke="#2B2622" stroke-width="2" />
          <path d="M-8 3 H8" stroke="#C8553D" stroke-width="2.4" />
          <path d="M-5 10 L-11 17 M5 10 L11 17" stroke="#2B2622" stroke-width="2" stroke-linecap="round" />
          <rect x="-6" y="-15" width="12" height="3.4" rx="1" fill="#2E3D6E" stroke="#2B2622" stroke-width="1.4" />
        </svg>
      {/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={rotorAsk} tone={spinning || lastFlew === null ? null : lastFlew ? "good" : "oops"} />
      <div class="gc-split">
        <div class="gc-stage bench">
          <svg viewBox="0 -54 560 384" aria-hidden="true">
            <defs>
              <linearGradient id="rb-wall" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#F3E7D0" />
                <stop offset="1" stop-color="#E2CDA8" />
              </linearGradient>
              <linearGradient id="rb-glass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stop-color={air === "earth" ? "#BFDDF0" : "#F1CDB0"} stop-opacity="0.8" />
                <stop offset="0.45" stop-color={air === "earth" ? "#DCEFF8" : "#F8E3D2"} stop-opacity="0.35" />
                <stop offset="1" stop-color={air === "earth" ? "#BFDDF0" : "#F1CDB0"} stop-opacity="0.75" />
              </linearGradient>
              <radialGradient id="rb-lamp" cx="0.5" cy="0" r="0.9">
                <stop offset="0" stop-color="#FFF4D6" stop-opacity="0.9" />
                <stop offset="1" stop-color="#FFF4D6" stop-opacity="0" />
              </radialGradient>
              <pattern id="rb-peg" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="2.1" fill="#A9845A" /></pattern>
              <clipPath id="rb-jar"><path d={JAR} /></clipPath>
            </defs>
            <!-- The workshop wall: planks, a pinned blueprint and a pegboard with spare parts. -->
            <rect y="-54" width="560" height="330" fill="url(#rb-wall)" />
            {#each [62, 140, 218, 342, 420, 498] as x (x)}<path d="M{x} -54 V276" stroke="#D9C39C" stroke-width="2" />{/each}
            <ellipse cx="280" cy="-8" rx="300" ry="200" fill="url(#rb-lamp)" />
            <!-- Dad's workshop lamp over the bench. -->
            <path d="M280 -54 V-34" stroke="#2B2622" stroke-width="2" />
            <ellipse cx="280" cy="-12" rx="22" ry="6" fill="#FFF4D6" />
            <path d="M252 -12 L264 -36 H296 L308 -12 Z" fill="#5E8A55" stroke="#2B2622" stroke-width="2.5" stroke-linejoin="round" />
            <path d="M266 -31 H284" stroke="#9DC08F" stroke-width="2.5" stroke-linecap="round" />
            <g transform="translate(24 30) rotate(-4)">
              <rect width="116" height="96" rx="2" fill="#3F6C9C" stroke="#2B2622" stroke-width="2" />
              {#each [16, 32, 48, 64, 80] as y (y)}<path d="M4 {y} H112" stroke="#fff" stroke-width="1" opacity="0.14" />{/each}
              {#each [20, 40, 60, 80, 100] as x (x)}<path d="M{x} 4 V92" stroke="#fff" stroke-width="1" opacity="0.14" />{/each}
              <ellipse cx="58" cy="30" rx="40" ry="6" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 3" opacity="0.85" />
              <path d="M58 30 V48 M48 48 H68 V60 H48 Z M50 60 L42 70 M66 60 L74 70" fill="none" stroke="#fff" stroke-width="1.8" opacity="0.9" />
              <text x="10" y="88" class="bp">thin air?</text>
              <circle cx="58" cy="4" r="5" fill="#C8553D" stroke="#2B2622" stroke-width="1.6" />
            </g>
            <g transform="translate(432 26)">
              <rect width="110" height="150" rx="4" fill="#D6B184" stroke="#2B2622" stroke-width="2" />
              <rect width="110" height="150" rx="4" fill="url(#rb-peg)" />
              <g transform="translate(22 18) rotate(76)">
                <path d="M0 -4.5 L96 -2.5 Q101 0 96 2.5 L0 4.5 Z" fill="#34343A" stroke="#2B2622" stroke-width="1.5" />
                <circle r="5" fill="#8E8B86" stroke="#2B2622" stroke-width="1.5" />
              </g>
              <g transform="translate(78 22) rotate(12)">
                <rect x="-4.5" y="8" width="9" height="66" rx="4.5" fill="#A7AEB5" stroke="#2B2622" stroke-width="1.6" />
                <circle cy="4" r="11" fill="#A7AEB5" stroke="#2B2622" stroke-width="1.6" />
                <rect x="-4" y="-9" width="8" height="12" fill="#D6B184" stroke="#2B2622" stroke-width="1.4" />
              </g>
              <circle cx="56" cy="120" r="14" fill="none" stroke="#C8553D" stroke-width="5" />
              <circle cx="56" cy="120" r="7" fill="none" stroke="#B0473A" stroke-width="3" />
            </g>
            <!-- The bench. -->
            <path d="M0 270 H560 V288 H0 Z" fill="#C99363" stroke="#2B2622" stroke-width="2.5" />
            <path d="M0 288 H560 V330 H0 Z" fill="#A86E44" />
            {#each [[24, 300], [180, 312], [330, 302], [440, 318]] as [x, y] (x)}<path d="M{x} {y} q 40 -5 80 0 t 80 0" fill="none" stroke="#8A5634" stroke-width="2" opacity="0.55" />{/each}
            <path d="M0 288 H560" stroke="#2B2622" stroke-width="2.5" />
            <path d="M4 273 H556" stroke="#E2B07E" stroke-width="2" />
            <!-- The paper tag tied to the jar: which air is inside. -->
            <path d="M138 236 Q156 248 168 266" fill="none" stroke="#8A7A66" stroke-width="1.6" />
            <g transform="translate(52 214) rotate(-7)">
              <path d="M0 6 Q0 0 6 0 H92 L104 14 L92 28 H6 Q0 28 0 22 Z" fill="#FFF8E8" stroke="#2B2622" stroke-width="2" />
              <circle cx="94" cy="14" r="3" fill="#D9C7A6" stroke="#2B2622" stroke-width="1.2" />
              {#if air === "earth"}
                <circle cx="15" cy="14" r="8.5" fill="#6FA3C9" stroke="#2B2622" stroke-width="1.5" />
                <path d="M10 10 q 4 -3 6 1 t 4 4 q -3 3 -6 1 z" fill="#7FAE6A" />
              {:else}
                <circle cx="15" cy="14" r="8.5" fill="#C9683F" stroke="#2B2622" stroke-width="1.5" />
                <path d="M10 16 q 4 -2 7 1 M14 9 q 3 1 5 0" fill="none" stroke="#9E4A2E" stroke-width="1.6" />
              {/if}
              <text x="29" y="19" class="tag">{air === "earth" ? "Earth air" : "Mars air"}</text>
            </g>
            <!-- Inside the jar: its air, Dad's ruler and chalk line, and the little rotor model. -->
            <g clip-path="url(#rb-jar)">
              <rect x="160" y="10" width="240" height="260" fill="url(#rb-glass)" />
              <g class="motes" class:stir={spinning}>
                {#each dots as d, i (i)}<circle class="mote" cx={d.x} cy={d.y} r={d.r} fill={air === "earth" ? "#7FA9C4" : "#C08560"} opacity="0.75" style:animation-delay="{d.delay}s" />{/each}
              </g>
              <path d="M368 96 V262" stroke="#8A7A66" stroke-width="2" />
              {#each [114, 132, 150, 168, 186, 204, 222, 240] as y (y)}<path d="M368 {y} H{y % 36 === 6 ? 380 : 375}" stroke="#8A7A66" stroke-width="2" />{/each}
              <path d="M192 {HOP_Y} H368" stroke="#7A6A58" stroke-width="2.5" stroke-dasharray="8 6" />
              <text x="326" y={HOP_Y - 7} class="chalk">hop!</text>
              <ellipse cx={280 + wobble} cy="263" rx={38 * (1 - hop * 0.45)} ry="4.5" fill="#2B2622" opacity={0.22 * (1 - hop * 0.6)} />
              {#if spinning}
                <g class="puffs" opacity={air === "earth" ? 0.85 : 0.3}>
                  {#each [-58, -44, 46, 60] as x, i (x)}<circle class="puff" cx={280 + x} cy="258" r={5 + (i % 2) * 2} fill="#FFFDF6" style:animation-delay="{i * 0.12}s" />{/each}
                </g>
              {/if}
              <g transform="translate({280 + wobble} {262 - hop * HOP_RISE})">
                {#if spinning}
                  <g class="wash" opacity={air === "earth" ? 0.8 : 0.3}>
                    {#each [-44, -14, 16, 46] as x (x)}<path d="M{x} -56 q 5 9 0 18 t 0 18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />{/each}
                  </g>
                {/if}
                <path d="M-15 -20 L-34 -1 M15 -20 L34 -1" stroke="#5A5450" stroke-width="3.5" stroke-linecap="round" />
                <path d="M-7 -20 L-16 -4 M7 -20 L16 -4" stroke="#8A837C" stroke-width="2.6" stroke-linecap="round" />
                {#each [-34, 34] as x (x)}<ellipse cx={x} cy="0" rx="5.5" ry="2.6" fill="#5A5450" />{/each}
                <rect x="-21" y="-44" width="42" height="26" rx="6" fill="#ECE5D7" />
                <rect x="-21" y="-36" width="42" height="6" fill="#C8553D" />
                <rect x="-21" y="-44" width="42" height="26" rx="6" fill="none" stroke="#2B2622" stroke-width="2.5" />
                <path d="M-15 -40 H2" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
                <circle cx="11" cy="-25" r="3.6" fill="#27335E" stroke="#2B2622" stroke-width="1.2" />
                <rect x="-2.5" y="-92" width="5" height="50" fill="#8E8B86" stroke="#2B2622" stroke-width="1.5" />
                {#each [-62, -78] as y, i (y)}
                  {#if spinning}
                    {@const a = blade + i * 1.3}
                    <ellipse cx="0" cy={y} rx={reach} ry="6" fill="#34343A" opacity="0.15" />
                    <path d="M{reach - 16} {y - 5} Q{reach - 2} {y - 5} {reach + 1} {y}" fill="none" stroke="#34343A" stroke-width="1.6" opacity="0.45" />
                    <path d="M{-reach + 16} {y + 5} Q{-reach + 2} {y + 5} {-reach - 1} {y}" fill="none" stroke="#34343A" stroke-width="1.6" opacity="0.45" />
                    <line x1={-reach * Math.cos(a)} y1={y - Math.sin(a) * 4} x2={reach * Math.cos(a)} y2={y + Math.sin(a) * 4} stroke="#34343A" stroke-width="4" stroke-linecap="round" />
                  {:else}
                    {@const k = i === 0 ? 1 : 0.5}
                    {#each [-1, 1] as side (side)}
                      <path d="M0 {y - 3} L{side * reach * k} {y - 1.6} Q{side * (reach * k + 4)} {y} {side * reach * k} {y + 1.6} L0 {y + 3} Z" fill="#34343A" stroke="#2B2622" stroke-width="1.2" />
                    {/each}
                  {/if}
                  <ellipse cx="0" cy={y} rx="6" ry="3.4" fill="#4E4A48" stroke="#2B2622" stroke-width="1.4" />
                {/each}
                <rect x="-17" y="-99" width="34" height="8" rx="1.5" fill="#2E3D6E" stroke="#2B2622" stroke-width="2" />
                <path d="M-8.5 -99 V-91 M0 -99 V-91 M8.5 -99 V-91" stroke="#5A6FA8" stroke-width="1.2" />
              </g>
            </g>
            <!-- The glass itself: outline, brass base and knob, and two shines. -->
            <path d={JAR} fill="none" stroke="#2B2622" stroke-width="2.5" />
            <path d="M180 250 V124 C180 86 200 62 232 52" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.6" />
            <path d="M382 150 V236" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.45" />
            <rect x="272" y="22" width="16" height="16" rx="3" fill="#B8913F" stroke="#2B2622" stroke-width="2" />
            <circle cx="280" cy="20" r="8" fill="#D2AE5A" stroke="#2B2622" stroke-width="2" />
            <rect x="152" y="262" width="256" height="14" rx="5" fill="#C9A24E" stroke="#2B2622" stroke-width="2.5" />
            <path d="M160 267 H400" stroke="#E7C980" stroke-width="2" />
          </svg>
        </div>
        <div class="gc-side">
          <div class="gc-group">
            <p class="gc-label">Air in the jar <span><kbd>1</kbd> <kbd>2</kbd></span></p>
            <div class="gc-tiles row" role="radiogroup" aria-label="Which air">
              <button type="button" role="radio" aria-checked={air === "earth"} class="gc-tile" disabled={spinning} onclick={() => setAir("earth")}>
                <svg viewBox="-20 -20 40 40" aria-hidden="true">
                  <circle r="16" fill="#6FA3C9" stroke="#2B2622" stroke-width="2.2" />
                  <path d="M-10 -6 q 5 -6 10 -2 t 6 6 q -4 5 -9 2 t -7 -6 z M4 8 q 4 -2 7 1 q -2 4 -6 4 z" fill="#7FAE6A" />
                  <path d="M-12 6 q 4 -3 8 0 M2 -12 q 4 -2 8 1" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
                </svg>
                Earth air <kbd>1</kbd>
              </button>
              <button type="button" role="radio" aria-checked={air === "mars"} class="gc-tile" disabled={spinning} onclick={() => setAir("mars")}>
                <svg viewBox="-20 -20 40 40" aria-hidden="true">
                  <circle r="16" fill="#C9683F" stroke="#2B2622" stroke-width="2.2" />
                  <path d="M-11 2 q 5 -3 10 1 t 9 -1 M-4 9 q 3 -1 6 1" fill="none" stroke="#9E4A2E" stroke-width="2.4" stroke-linecap="round" />
                  <ellipse cx="-1" cy="-12.5" rx="6" ry="2.4" fill="#FFF6E6" />
                </svg>
                Mars air <kbd>2</kbd>
              </button>
            </div>
          </div>
          <div class="gc-group dials">
            <p class="gc-label">Blade length <span><kbd>←</kbd> <kbd>→</kbd></span></p>
            <div class="gc-dial">
              <button type="button" class="gc-step" aria-label="Shorter blades" disabled={spinning || length <= 1} onclick={() => nudge("length", -1)}>−</button>
              <span class="gc-bars" role="img" aria-label="Blade length {length} of 5">{#each [1, 2, 3, 4, 5] as n (n)}<i class:lit={n <= length}></i>{/each}</span>
              <button type="button" class="gc-step" aria-label="Longer blades" disabled={spinning || length >= 5} onclick={() => nudge("length", 1)}>+</button>
            </div>
            <p class="gc-label">Spin speed <span><kbd>↓</kbd> <kbd>↑</kbd></span></p>
            <div class="gc-dial">
              <button type="button" class="gc-step" aria-label="Slower" disabled={spinning || speed <= 1} onclick={() => nudge("speed", -1)}>−</button>
              <span class="gc-bars" role="img" aria-label="Spin speed {speed} of 5">{#each [1, 2, 3, 4, 5] as n (n)}<i class:lit={n <= speed}></i>{/each}</span>
              <button type="button" class="gc-step" aria-label="Faster" disabled={spinning || speed >= 5} onclick={() => nudge("speed", 1)}>+</button>
            </div>
          </div>
          <div class="gc-group gauge" role="img" aria-label={ratio >= 1 ? "Lift: enough to hop" : "Lift: not enough to hop yet"}>
            <p class="gc-label">Lift</p>
            <svg viewBox="0 0 200 100" aria-hidden="true">
              <path d="M{arcAt(0)} A70 70 0 0 1 {arcAt(HOP_F)}" fill="none" stroke="#E9B9A4" stroke-width="16" />
              <path d="M{arcAt(HOP_F)} A70 70 0 0 1 {arcAt(1)}" fill="none" stroke="#B7D3A2" stroke-width="16" />
              <path d="M{arcAt(0, 79)} A79 79 0 0 1 {arcAt(1, 79)}" fill="none" stroke="#2B2622" stroke-width="2.2" />
              <path d="M{arcAt(0, 61)} A61 61 0 0 1 {arcAt(1, 61)}" fill="none" stroke="#2B2622" stroke-width="1.6" opacity="0.5" />
              <path d="M{arcAt(HOP_F, 58)} L{arcAt(HOP_F, 84)}" stroke="#2B2622" stroke-width="3" />
              <g class="needle" style:transform="rotate({-90 + needle * 180}deg)">
                <path d="M100 88 L96.5 85 L100 24 L103.5 85 Z" fill={ratio >= 1 ? "#557358" : "#C0573E"} stroke="#2B2622" stroke-width="1.6" stroke-linejoin="round" />
              </g>
              <circle cx="100" cy="88" r="7" fill="#C9A24E" stroke="#2B2622" stroke-width="2" />
            </svg>
            <p class="gauge-say" class:enough={ratio >= 1}>{ratio >= 1 ? "Enough to hop!" : "Not enough yet"}</p>
          </div>
        </div>
      </div>
      {#if tasks.flew}<p class="gc-real"><span>True story</span>{rotorFact.kid}</p>{/if}
      <div class="gc-foot">
        <GameSteps steps={[{ label: "Spin in Earth air", done: tasks.earth }, { label: "Spin in Mars air", done: tasks.mars }, { label: "Hop on Mars", done: tasks.flew }]} />
        <div class="gc-actions">
          {#if tasks.flew}
            <button type="button" class="btn amber got" disabled={spinning} onclick={finish}>It flies in thin air! <kbd>E</kbd></button>
          {:else}
            <button type="button" class="btn amber" disabled={spinning} onclick={spin}>Spin it <kbd>E</kbd></button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else if open?.id === "scout"}
  <div class="game scout gc gc-mars" role="dialog" aria-label="The scout camera">
    <CardHead kicker="The toy helicopter's camera" title="Find a safe way for the rover" stamp="Model">
      {#snippet badge()}
        <svg viewBox="-22 -22 44 44">
          <rect x="-15" y="-10" width="30" height="22" rx="5" fill="#ECE5D7" stroke="#2B2622" stroke-width="2.2" />
          <circle cy="1" r="7.5" fill="#27335E" stroke="#2B2622" stroke-width="2" />
          <circle cx="-2.4" cy="-1.6" r="2.2" fill="#9FB4E0" />
          <rect x="-11" y="-15" width="9" height="6" rx="1.5" fill="#C8553D" stroke="#2B2622" stroke-width="1.6" />
          <circle cx="10" cy="-5" r="2" fill="#C8553D" />
        </svg>
      {/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={scoutAsk} tone={arrived || reached ? "good" : bumped ? "oops" : null} />
      <div class="gc-split">
        <div class="gc-stage cam">
          <svg class="view" viewBox="0 0 {COLS * CELL} {ROWS * CELL}" role="img" aria-label="A map seen from above, with rocks, soft sand, the rover and a flag">
            <defs>
              <radialGradient id="sc-ground" cx="0.45" cy="0.4" r="0.8">
                <stop offset="0" stop-color="#E2AD7E" />
                <stop offset="1" stop-color="#C98C5C" />
              </radialGradient>
              <radialGradient id="sc-vignette" cx="0.5" cy="0.5" r="0.72">
                <stop offset="0.6" stop-color="#2B1A12" stop-opacity="0" />
                <stop offset="1" stop-color="#2B1A12" stop-opacity="0.45" />
              </radialGradient>
              <pattern id="sc-ripple" width="34" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
                <path d="M0 10 q 8.5 -7 17 0 t 17 0" fill="none" stroke="#8E5A36" stroke-width="2" opacity="0.7" />
              </pattern>
            </defs>
            <rect width={COLS * CELL} height={ROWS * CELL} fill="url(#sc-ground)" />
            <!-- Gentle wind ripples and small pebbles: just the ground, never in the way. -->
            {#each RIPPLES as i (i)}<path d="M{(i * 97) % 560} {14 + ((i * 53) % 300)} q 14 -7 28 0 t 28 0" fill="none" stroke="#B9794C" stroke-width="2" opacity="0.4" />{/each}
            {#each PEBBLES as p, i (i)}<circle cx={p.x} cy={p.y} r={p.r} fill="#A86A44" opacity="0.55" />{/each}
            <!-- The tracks Remi has driven, and the pencil line still to go. -->
            {#if roverAt > 0}
              {@const done = path.slice(0, Math.floor(roverAt) + 1)}
              {@const pts = [...done.map((p) => `${(p.c + 0.5) * CELL},${(p.r + 0.5) * CELL}`), `${roverPos.x},${roverPos.y}`].join(" ")}
              <polyline points={pts} fill="none" stroke="#9A633E" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" />
              <polyline points={pts} fill="none" stroke="#7E4C2E" stroke-width="22" stroke-dasharray="3 5" stroke-linecap="butt" stroke-linejoin="round" opacity="0.4" />
            {/if}
            <!-- A faint grid, so each step is clear. -->
            {#each Array.from({ length: COLS - 1 }, (_, i) => i + 1) as i (i)}<path d="M{i * CELL} 0 V{ROWS * CELL}" stroke="#FFF6E0" stroke-width="1.2" opacity="0.22" />{/each}
            {#each Array.from({ length: ROWS - 1 }, (_, i) => i + 1) as i (i)}<path d="M0 {i * CELL} H{COLS * CELL}" stroke="#FFF6E0" stroke-width="1.2" opacity="0.22" />{/each}
            {#each MAP as row, r (r)}
              {#each row.split("") as cell, c (c)}
                {#if cell === "R"}
                  {@const x = c * CELL}
                  {@const y = r * CELL}
                  <ellipse cx={x + 37} cy={y + 41} rx="25" ry="17" fill="#6E3E24" opacity="0.4" />
                  <path d="M{x + 12} {y + 34} C{x + 10} {y + 18} {x + 26} {y + 10} {x + 38} {y + 13} C{x + 52} {y + 16} {x + 56} {y + 30} {x + 50} {y + 42} C{x + 42} {y + 52} {x + 18} {y + 50} {x + 12} {y + 34} Z" fill="#A8683F" stroke="#2B2622" stroke-width="2.5" />
                  <path d="M{x + 20} {y + 26} C{x + 24} {y + 18} {x + 32} {y + 17} {x + 38} {y + 19}" fill="none" stroke="#D49A6C" stroke-width="4" stroke-linecap="round" />
                  <path d="M{x + 30} {y + 38} l 8 -5 M{x + 40} {y + 42} l 5 -6" stroke="#7B4529" stroke-width="2" stroke-linecap="round" />
                {:else if cell === "S"}
                  <rect x={c * CELL + 3} y={r * CELL + 3} width={CELL - 6} height={CELL - 6} rx="20" fill="#B97A4B" />
                  <rect x={c * CELL + 3} y={r * CELL + 3} width={CELL - 6} height={CELL - 6} rx="20" fill="url(#sc-ripple)" />
                  <rect x={c * CELL + 3} y={r * CELL + 3} width={CELL - 6} height={CELL - 6} rx="20" fill="none" stroke="#8E5A36" stroke-width="2" stroke-dasharray="5 4" />
                {:else}
                  <rect x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="transparent" class="cell" role="presentation" onclick={() => stepTo(c, r)} />
                {/if}
              {/each}
            {/each}
            <!-- The way Remi has drawn, in pencil. -->
            <polyline points={path.map((p) => `${(p.c + 0.5) * CELL},${(p.r + 0.5) * CELL}`).join(" ")} fill="none" stroke="#FFF6E0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" />
            <polyline points={path.map((p) => `${(p.c + 0.5) * CELL},${(p.r + 0.5) * CELL}`).join(" ")} fill="none" stroke="#2B2622" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" stroke-linejoin="round" />
            {#if !reached && !driving && !arrived}
              {@const end = path[path.length - 1]!}
              <circle class="tip" cx={(end.c + 0.5) * CELL} cy={(end.r + 0.5) * CELL} r="13" fill="none" stroke="#FFF6E0" stroke-width="3" />
            {/if}
            <!-- The flag, with a ring around it. -->
            <g transform="translate({(GOAL.c + 0.5) * CELL} {(GOAL.r + 0.5) * CELL})">
              <circle r="24" fill="none" stroke="#FFF6E0" stroke-width="2.5" stroke-dasharray="6 5" opacity="0.8" />
              <ellipse cx="2" cy="18" rx="9" ry="3" fill="#2B2622" opacity="0.25" />
              <path d="M-4 18 L-4 -20" stroke="#2B2622" stroke-width="3" stroke-linecap="round" />
              <path d="M-4 -20 L18 -13 L-4 -6 Z" fill="#C8553D" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
            </g>
            <!-- The toy rover, seen from above: six wheels, a solar deck and its mast. -->
            <g transform="translate({roverPos.x} {roverPos.y}) rotate({(roverPos.turn * 180) / Math.PI})">
              <ellipse cx="3" cy="4" rx="24" ry="19" fill="#2B2622" opacity="0.22" />
              {#each [-14, 0, 14] as x (x)}{#each [-16, 16] as y (y)}<rect x={x - 5.5} y={y - 4.5} width="11" height="9" rx="2.5" fill="#4A4440" stroke="#2B2622" stroke-width="1.2" />{/each}{/each}
              <rect x="-20" y="-12" width="40" height="24" rx="4" fill="#E9E3D6" stroke="#2B2622" stroke-width="2.5" />
              <rect x="-17" y="-9" width="22" height="18" rx="2" fill="#2E3D6E" />
              <path d="M-11.5 -9 V9 M-6 -9 V9 M-0.5 -9 V9 M-17 0 H5" stroke="#5A6FA8" stroke-width="1.1" />
              <circle cx="12" cy="0" r="4.5" fill="#C8553D" stroke="#2B2622" stroke-width="1.5" />
              <path d="M16 0 H22" stroke="#2B2622" stroke-width="2" stroke-linecap="round" />
            </g>
            <!-- The helicopter's own little shadow, drifting as it hovers. -->
            <g class="heli-shadow" opacity="0.2" transform="translate(290 166)">
              <path d="M-26 0 H26 M0 -26 V26" stroke="#2B2622" stroke-width="5" stroke-linecap="round" />
              <circle r="7" fill="#2B2622" />
            </g>
            <rect width={COLS * CELL} height={ROWS * CELL} fill="url(#sc-vignette)" pointer-events="none" />
            <!-- The camera's frame: corners, a centre mark and a blinking dot. -->
            <g pointer-events="none" fill="none" stroke="#FFF6E0" stroke-width="4" stroke-linecap="round">
              <path d="M14 40 V14 H40 M{COLS * CELL - 40} 14 H{COLS * CELL - 14} V40 M{COLS * CELL - 14} {ROWS * CELL - 40} V{ROWS * CELL - 14} H{COLS * CELL - 40} M40 {ROWS * CELL - 14} H14 V{ROWS * CELL - 40}" />
            </g>
            <g pointer-events="none" transform="translate(30 32)">
              <circle class="rec" r="6" fill="#E0503A" />
              <text x="12" y="5" class="cam-label">CAMERA</text>
            </g>
          </svg>
        </div>
        <div class="gc-side">
          <div class="gc-group legend">
            <p class="gc-label">What the camera sees</p>
            <ul>
              <li>
                <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 24 C5 13 14 7 21 9 C30 11 33 20 29 28 C24 35 9 34 6 24 Z" fill="#A8683F" stroke="#2B2622" stroke-width="2" /><path d="M11 18 C13 13 18 12 22 13" fill="none" stroke="#D49A6C" stroke-width="3" stroke-linecap="round" /></svg>
                <span><b>Rock.</b> Go round it.</span>
              </li>
              <li>
                <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="11" fill="#B97A4B" stroke="#8E5A36" stroke-width="2" stroke-dasharray="4 3" /><path d="M8 15 q 6 -5 12 0 t 12 0 M8 25 q 6 -5 12 0 t 12 0" fill="none" stroke="#8E5A36" stroke-width="2" /></svg>
                <span><b>Soft sand.</b> Wheels get stuck.</span>
              </li>
              <li>
                <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 34 V6" stroke="#2B2622" stroke-width="3" stroke-linecap="round" /><path d="M14 6 L32 12 L14 18 Z" fill="#C8553D" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" /></svg>
                <span><b>Flag.</b> Get the rover here.</span>
              </li>
            </ul>
          </div>
          <div class="gc-group keys">
            <p class="gc-label">Draw the way</p>
            <div class="keys-row">
              <div class="arrows" aria-hidden="true"><kbd class="up">↑</kbd><kbd class="left">←</kbd><kbd class="down">↓</kbd><kbd class="right">→</kbd></div>
              <p class="gc-hint">Arrow keys, or click a square next to the line. Go back to undo.</p>
            </div>
          </div>
        </div>
      </div>
      {#if arrived}<p class="gc-real"><span>True story</span>{scoutFact.kid}</p>{/if}
      <div class="gc-foot">
        <GameSteps steps={[{ label: "Draw a safe way", done: reached }, { label: "Send it to the rover", done: arrived }]} />
        <div class="gc-actions">
          {#if arrived}
            <button type="button" class="btn amber got" onclick={finish}>Safe and sound! <kbd>E</kbd></button>
          {:else}
            <button type="button" class="btn" disabled={driving || path.length < 2} onclick={() => resetScout()}>Start over</button>
            <button type="button" class="btn amber" disabled={!reached || driving} onclick={drive}>Send it to the rover <kbd>E</kbd></button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else if open?.id === "note"}
  <div class="game note gc gc-mars" role="dialog" aria-label="Ingenuity's log">
    <CardHead kicker="Ingenuity's log" title="Leave a note for whoever comes next">
      {#snippet badge()}
        <svg viewBox="-22 -22 44 44">
          <rect x="-13" y="-16" width="26" height="32" rx="3" fill="#FFFDF6" stroke="#2B2622" stroke-width="2.2" />
          <path d="M-13 -16 H-7 V16 H-13 Z" fill="#B4553A" stroke="#2B2622" stroke-width="2" />
          <path d="M-3 -8 H8 M-3 -2 H8 M-3 4 H5" stroke="#8C8173" stroke-width="2" stroke-linecap="round" />
          <path d="M6 18 L17 3 L20.5 5.5 L9.5 20.5 L5 21.5 Z" fill="#F2A541" stroke="#2B2622" stroke-width="1.8" stroke-linejoin="round" />
        </svg>
      {/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={ready ? "That's a good note. Save it in the log." : "Ingenuity kept notes for future explorers. Pick a few words to leave one too."} tone={ready ? "good" : null} />
      <div class="gc-split wide">
        <div class="gc-stage log-stage">
          <div class="log-page">
            <p class="log-head"><span>Log</span> For future explorers</p>
            <div class="lines">
              <p class="log-text" class:empty={!(note.hello || note.middle || note.bye)} aria-live="polite">{notePreview}</p>
              <p class="log-sign">Remi</p>
            </div>
            <!-- A pencil doodle of Ingenuity in the corner of the page. -->
            <svg class="doodle" viewBox="-60 -70 120 100" aria-hidden="true">
              <g fill="none" stroke="#233F73" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M-52 -48 Q0 -56 52 -48 M-44 -38 Q0 -32 44 -38" />
                <path d="M0 -56 V-12" />
                <rect x="-15" y="-14" width="30" height="20" rx="4" />
                <path d="M-10 6 L-26 26 M10 6 L26 26 M-4 6 L-9 22 M4 6 L9 22" />
                <rect x="-12" y="-64" width="24" height="6" rx="1" />
              </g>
            </svg>
            {#if saved}<p class="old"><span>Last time</span>{logNoteText(saved)}</p>{/if}
          </div>
        </div>
        <div class="gc-side">
          {#each [["hello", LOG_CHIPS.hello, "1. Say hello"], ["middle", LOG_CHIPS.middle, "2. Say something"], ["bye", LOG_CHIPS.bye, "3. Say goodbye"]] as const as [part, chips, label] (part)}
            <div class="gc-group">
              <p class="gc-label">{label}</p>
              <div class="chips" role="radiogroup" aria-label={label}>
                {#each chips as chip (chip)}
                  <button type="button" role="radio" aria-checked={note[part] === chip} class="chip" class:on={note[part] === chip} onclick={() => ((note = { ...note, [part]: chip }), audio.ui("pop"))}>{chip}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="gc-foot">
        <GameSteps steps={[{ label: "Hello", done: Boolean(note.hello) }, { label: "Something kind", done: Boolean(note.middle) }, { label: "Goodbye", done: Boolean(note.bye) }]} />
        <div class="gc-actions"><button type="button" class="btn amber got" disabled={!ready} onclick={finish}>Save it in the log <kbd>E</kbd></button></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .game.air,
  .game.scout {
    --gc-w: 900px;
  }
  .game.note {
    --gc-w: 860px;
  }
  .game.air .gc-split {
    grid-template-columns: minmax(0, 1fr) 272px;
  }
  /* The rotor bench picture. */
  .bp {
    fill: #fff;
    font: 700 13px/1 var(--hand);
  }
  .tag {
    fill: #2b2622;
    font: 700 12px/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .chalk {
    fill: #7a6a58;
    font: 700 16px/1 var(--hand);
  }
  .mote {
    transform-box: fill-box;
    transform-origin: center;
    animation: drift 6s ease-in-out infinite alternate;
  }
  .motes.stir .mote {
    animation-duration: 0.9s;
  }
  @keyframes drift {
    0% {
      transform: translate(-4px, 3px);
    }
    50% {
      transform: translate(3px, -4px);
    }
    100% {
      transform: translate(5px, 4px);
    }
  }
  .puff {
    transform-box: fill-box;
    transform-origin: center;
    animation: puff 0.7s ease-out infinite;
  }
  @keyframes puff {
    from {
      transform: scale(0.4);
      opacity: 1;
    }
    to {
      transform: scale(2.2) translateY(-3px);
      opacity: 0;
    }
  }
  .wash path {
    stroke-dasharray: 8 8;
    animation: wash 0.35s linear infinite;
  }
  @keyframes wash {
    to {
      stroke-dashoffset: -16;
    }
  }
  .gauge svg {
    display: block;
    width: 100%;
    max-width: 170px;
    height: auto;
    margin: -4px auto 0;
  }
  .bench {
    background: #e7d5b5;
  }
  .needle {
    transform-box: view-box;
    transform-origin: 100px 88px;
    transition: transform 0.45s var(--ease-spring);
  }
  .gauge-say {
    margin: 2px 0 0;
    text-align: center;
    font: 700 0.92rem/1.1 var(--read);
    color: var(--clay-deep);
  }
  .gauge-say.enough {
    color: var(--sage-deep);
  }
  .dials .gc-dial + .gc-label {
    margin-top: 10px;
  }
  .gc-label span {
    display: flex;
    gap: 3px;
  }

  /* The scout camera. */
  .cam {
    background: #3a2a22;
  }
  .cell {
    cursor: pointer;
  }
  .cell:hover {
    fill: rgba(255, 246, 224, 0.2);
  }
  .tip {
    transform-box: fill-box;
    transform-origin: center;
    animation: tip 1.2s ease-in-out infinite;
  }
  @keyframes tip {
    50% {
      transform: scale(1.25);
      opacity: 0.4;
    }
  }
  .heli-shadow {
    animation: hover-drift 7s ease-in-out infinite alternate;
  }
  @keyframes hover-drift {
    from {
      transform: translate(250px, 150px) rotate(0deg);
    }
    to {
      transform: translate(330px, 182px) rotate(30deg);
    }
  }
  .rec {
    animation: rec 1.4s steps(2, jump-none) infinite;
  }
  @keyframes rec {
    50% {
      opacity: 0.15;
    }
  }
  .cam-label {
    fill: #fff6e0;
    font: 700 13px/1 var(--label);
    letter-spacing: 0.16em;
  }
  .legend ul {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 10px;
    font: 400 0.92rem/1.25 var(--read);
  }
  .legend svg {
    flex: none;
    width: 38px;
    height: 38px;
  }
  .keys-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .keys-row .gc-hint {
    margin: 0;
  }
  .arrows {
    flex: none;
    display: grid;
    grid-template-columns: repeat(3, 28px);
    grid-template-rows: repeat(2, 26px);
    gap: 3px;
  }
  .arrows kbd {
    display: grid;
    place-items: center;
    background: #fbf6ec;
    border: 2px solid var(--ink);
    border-radius: 7px;
    box-shadow: 0 2px 0 var(--ink);
    font: 700 0.95rem/1 var(--read);
  }
  .arrows .up {
    grid-area: 1 / 2;
  }
  .arrows .left {
    grid-area: 2 / 1;
  }
  .arrows .down {
    grid-area: 2 / 2;
  }
  .arrows .right {
    grid-area: 2 / 3;
  }
  .legend {
    flex: 1;
  }

  /* Ingenuity's log. */
  .log-stage {
    background: #fffdf6;
  }
  .log-page {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 300px;
    box-sizing: border-box;
    padding: 18px 24px 18px 64px;
    background:
      linear-gradient(90deg, transparent 46px, rgba(192, 87, 62, 0.45) 46px 48px, transparent 48px),
      var(--grain),
      #fffdf6;
  }
  .lines {
    background: repeating-linear-gradient(transparent 0 33px, #d6e1ea 33px 35px);
    flex: 1;
    min-height: 175px;
    margin-right: -24px;
    padding-right: 24px;
  }
  .doodle {
    position: absolute;
    right: 22px;
    bottom: 14px;
    width: 120px;
    height: 100px;
    opacity: 0.75;
    transform: rotate(-6deg);
  }
  .log-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .log-head span {
    padding: 4px 8px 3px;
    background: #b4553a;
    color: #fff6e6;
    border-radius: 3px;
  }
  .log-text {
    margin: 0;
    font: 700 1.55rem/35px var(--hand);
    color: var(--dad-ink);
  }
  .log-text.empty {
    color: var(--pencil);
    font-weight: 400;
  }
  .log-sign {
    margin: 6px 0 0;
    text-align: right;
    font: 700 1.3rem/35px var(--hand);
    color: var(--dad-ink);
  }
  .old {
    position: absolute;
    left: 64px;
    right: 160px;
    bottom: 22px;
    margin: 0;
    padding: 8px 12px;
    background: #fdf1c6;
    border: 1.5px solid rgba(43, 38, 34, 0.25);
    box-shadow: 0 6px 12px -8px rgba(43, 38, 34, 0.5);
    font: 400 0.92rem/1.35 var(--read);
    transform: rotate(-1.2deg);
  }
  .old span {
    display: block;
    margin-bottom: 2px;
    font: 700 0.66rem/1 var(--label);
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    padding: 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 8px 10px 9px 7px;
    background: #fbf6ec;
    color: var(--ink);
    font: 700 0.88rem/1.15 var(--read);
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      background 0.15s;
  }
  .chip:hover {
    transform: translateY(-2px);
  }
  .chip.on {
    background: #f9dc9e;
    box-shadow: 0 3px 0 var(--ink);
  }
  :global(:root[data-motion="reduce"]) .mote,
  :global(:root[data-motion="reduce"]) .puff,
  :global(:root[data-motion="reduce"]) .wash path,
  :global(:root[data-motion="reduce"]) .tip,
  :global(:root[data-motion="reduce"]) .heli-shadow,
  :global(:root[data-motion="reduce"]) .rec {
    animation: none;
  }
</style>
