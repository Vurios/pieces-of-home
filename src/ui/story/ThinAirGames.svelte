<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";
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
  const DOTS = Array.from({ length: 70 }, (_, i) => {
    const r = (n: number): number => {
      const x = Math.sin(i * 47.3 + n * 13.1) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: 30 + r(1) * 540, y: 20 + r(2) * 170, r: 1.6 + r(3) * 1.6 };
  });
  /** In Mars air the jar holds only a few bits of air: about one in a hundred, rounded up so a few still show. */
  const dots = $derived(air === "earth" ? DOTS : DOTS.slice(0, 3));

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

{#if open?.id === "rotor"}
  <div class="game air" role="dialog" aria-live="polite" aria-label="Dad's rotor bench">
    <p class="from"><span class="pin" aria-hidden="true"></span>Dad's rotor bench <span class="model">Model</span></p>
    <p class="ask">{rotorAsk}</p>
    <svg class="bench" viewBox="0 0 600 240" aria-hidden="true">
      <!-- The glass jar, and the bits of air inside it: lots on Earth, hardly any on Mars. -->
      <rect x="20" y="10" width="560" height="196" rx="18" fill={air === "earth" ? "#E4EEF4" : "#F1E2D2"} stroke="#2B2622" stroke-width="2.5" />
      {#each dots as d, i (i)}<circle cx={d.x} cy={d.y} r={d.r} fill={air === "earth" ? "#8FB3C8" : "#C9926A"} opacity="0.7" />{/each}
      <text x="40" y="38" class="label">{air === "earth" ? "Earth air" : "Mars air"}</text>
      <!-- The table top. -->
      <rect x="20" y="206" width="560" height="22" fill="#B07A4E" stroke="#2B2622" stroke-width="2.5" />
      <g transform="translate({300 + wobble} {170 - hop * 120})">
        <!-- Legs and body. -->
        <path d="M-22 26 L-34 40 M22 26 L34 40 M-10 26 L-14 40 M10 26 L14 40" stroke="#4E4A48" stroke-width="3.5" stroke-linecap="round" />
        <rect x="-22" y="-2" width="44" height="30" rx="5" fill="#D9D3C6" stroke="#2B2622" stroke-width="2.5" />
        <path d="M0 -2 L0 -40" stroke="#8E8B86" stroke-width="4" />
        <!-- Two rotors: long blades for a long setting; a blur of a disc while they spin. -->
        {#each [-30, -40] as y, i (y)}
          {@const reach = 24 + length * 22}
          {#if spinning}
            <ellipse cx="0" cy={y} rx={reach} ry="4" fill="#3A3A40" opacity="0.25" />
            <line x1={-reach * Math.cos(blade + i)} y1={y} x2={reach * Math.cos(blade + i)} y2={y} stroke="#3A3A40" stroke-width="4" stroke-linecap="round" />
          {:else}
            <line x1={-reach} y1={y} x2={reach} y2={y} stroke="#3A3A40" stroke-width="4" stroke-linecap="round" />
          {/if}
        {/each}
        <rect x="-18" y="-50" width="36" height="6" fill="#27335E" stroke="#2B2622" stroke-width="1.5" />
      </g>
      <!-- Dad's chalk line: high enough counts as a hop. -->
      <path d="M210 120 L390 120" stroke="#8A8378" stroke-width="2" stroke-dasharray="6 6" />
      <text x="396" y="124" class="chalk">a hop</text>
    </svg>
    <div class="controls">
      <div class="air-pick" role="radiogroup" aria-label="Which air">
        <button type="button" role="radio" aria-checked={air === "earth"} class="chip" class:on={air === "earth"} disabled={spinning} onclick={() => setAir("earth")}>Earth air <kbd>1</kbd></button>
        <button type="button" role="radio" aria-checked={air === "mars"} class="chip" class:on={air === "mars"} disabled={spinning} onclick={() => setAir("mars")}>Mars air <kbd>2</kbd></button>
      </div>
      <div class="dial">
        <span>Blade length</span>
        <button type="button" class="step" aria-label="Shorter blades" disabled={spinning || length <= 1} onclick={() => nudge("length", -1)}>−</button>
        <span class="pips" aria-label="{length} of 5">{#each [1, 2, 3, 4, 5] as n (n)}<i class:lit={n <= length}></i>{/each}</span>
        <button type="button" class="step" aria-label="Longer blades" disabled={spinning || length >= 5} onclick={() => nudge("length", 1)}>+</button>
      </div>
      <div class="dial">
        <span>Spin speed</span>
        <button type="button" class="step" aria-label="Slower" disabled={spinning || speed <= 1} onclick={() => nudge("speed", -1)}>−</button>
        <span class="pips" aria-label="{speed} of 5">{#each [1, 2, 3, 4, 5] as n (n)}<i class:lit={n <= speed}></i>{/each}</span>
        <button type="button" class="step" aria-label="Faster" disabled={spinning || speed >= 5} onclick={() => nudge("speed", 1)}>+</button>
      </div>
      <div class="meter" aria-label="Lift">
        <span>Lift</span>
        <div class="bar"><b style:width="{Math.min(100, ratio * 66)}%" class:enough={ratio >= 1}></b><i style:left="66%"></i></div>
      </div>
    </div>
    <ul class="tasks">
      <li class:done={tasks.earth}>Spin it in Earth air</li>
      <li class:done={tasks.mars}>Spin it in Mars air</li>
      <li class:done={tasks.flew}>Make it hop on Mars</li>
    </ul>
    {#if tasks.flew}
      <p class="real">{rotorFact.kid}</p>
      <div class="row"><button type="button" class="btn amber got" disabled={spinning} onclick={finish}>It flies in thin air! <kbd>E</kbd></button></div>
    {:else}
      <div class="row"><button type="button" class="btn amber" disabled={spinning} onclick={spin}>Spin it <kbd>E</kbd></button></div>
    {/if}
  </div>
{:else if open?.id === "scout"}
  <div class="game scout" role="dialog" aria-live="polite" aria-label="The scout camera">
    <p class="from"><span class="pin" aria-hidden="true"></span>The toy helicopter's camera, looking down</p>
    <p class="ask">{scoutAsk}</p>
    <svg class="view" viewBox="-8 -8 {COLS * CELL + 16} {ROWS * CELL + 16}" role="img" aria-label="A map seen from above, with rocks, soft sand, the rover and a flag">
      <rect x="0" y="0" width={COLS * CELL} height={ROWS * CELL} fill="#D9A273" />
      {#each RIPPLES as i (i)}<path d="M{-10 + (i % 6) * 110} {12 + Math.floor(i / 6) * 110} q 18 -10 36 0 t 36 0" fill="none" stroke="#C48A5E" stroke-width="2" opacity="0.6" />{/each}
      {#each MAP as row, r (r)}
        {#each row.split("") as cell, c (c)}
          {#if cell === "R"}
            <ellipse cx={(c + 0.56) * CELL} cy={(r + 0.62) * CELL} rx={CELL * 0.36} ry={CELL * 0.22} fill="#8A5236" opacity="0.5" />
            <path d="M{(c + 0.2) * CELL} {(r + 0.55) * CELL} q {CELL * 0.1} {-CELL * 0.35} {CELL * 0.32} {-CELL * 0.3} t {CELL * 0.3} {CELL * 0.3} q {-CELL * 0.2} {CELL * 0.2} {-CELL * 0.6} 0 z" fill="#A8683F" stroke="#2B2622" stroke-width="2.5" />
          {:else if cell === "S"}
            <rect x={c * CELL + 4} y={r * CELL + 4} width={CELL - 8} height={CELL - 8} rx="16" fill="#C08452" opacity="0.8" />
            {#each [0.3, 0.5, 0.7] as y (y)}<path d="M{c * CELL + 12} {(r + y) * CELL} q 10 -6 20 0 t 20 0" fill="none" stroke="#8E5A36" stroke-width="2" />{/each}
          {:else}
            <rect x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="transparent" class="cell" role="presentation" onclick={() => stepTo(c, r)} />
          {/if}
        {/each}
      {/each}
      <!-- A faint grid, so each step is clear. -->
      {#each Array.from({ length: COLS + 1 }, (_, i) => i) as i (i)}<path d="M{i * CELL} 0 L{i * CELL} {ROWS * CELL}" stroke="#2B2622" stroke-width="1" opacity="0.08" />{/each}
      {#each Array.from({ length: ROWS + 1 }, (_, i) => i) as i (i)}<path d="M0 {i * CELL} L{COLS * CELL} {i * CELL}" stroke="#2B2622" stroke-width="1" opacity="0.08" />{/each}
      <!-- The way Remi has drawn, in pencil. -->
      <polyline points={path.map((p) => `${(p.c + 0.5) * CELL},${(p.r + 0.5) * CELL}`).join(" ")} fill="none" stroke="#2B2622" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" stroke-linejoin="round" />
      <!-- The flag. -->
      <g transform="translate({(GOAL.c + 0.5) * CELL} {(GOAL.r + 0.5) * CELL})">
        <path d="M-4 18 L-4 -20" stroke="#2B2622" stroke-width="3" />
        <path d="M-4 -20 L18 -13 L-4 -6 Z" fill="#C8553D" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
      </g>
      <!-- The toy rover, seen from above: a deck and six wheels. -->
      <g transform="translate({roverPos.x} {roverPos.y}) rotate({(roverPos.turn * 180) / Math.PI})">
        {#each [-14, 0, 14] as x (x)}{#each [-15, 15] as y (y)}<rect x={x - 5} y={y - 4} width="10" height="8" rx="2" fill="#4A4440" />{/each}{/each}
        <rect x="-18" y="-11" width="36" height="22" rx="4" fill="#E9E3D6" stroke="#2B2622" stroke-width="2.5" />
        <circle cx="10" cy="0" r="4" fill="#5A6B9C" stroke="#2B2622" stroke-width="1.5" />
      </g>
      <!-- The camera's frame corners. -->
      <path d="M-4 24 L-4 -4 L24 -4 M{COLS * CELL - 24} -4 L{COLS * CELL + 4} -4 L{COLS * CELL + 4} 24 M{COLS * CELL + 4} {ROWS * CELL - 24} L{COLS * CELL + 4} {ROWS * CELL + 4} L{COLS * CELL - 24} {ROWS * CELL + 4} M24 {ROWS * CELL + 4} L-4 {ROWS * CELL + 4} L-4 {ROWS * CELL - 24}" fill="none" stroke="#FFF6E0" stroke-width="4" />
    </svg>
    <p class="keys">Arrow keys or click a square next to the line. Go back the same way to undo.</p>
    {#if arrived}
      <p class="real">{scoutFact.kid}</p>
      <div class="row"><button type="button" class="btn amber got" onclick={finish}>Safe and sound! <kbd>E</kbd></button></div>
    {:else}
      <div class="row">
        <button type="button" class="btn" disabled={driving || path.length < 2} onclick={() => resetScout()}>Start over</button>
        <button type="button" class="btn amber" disabled={!reached || driving} onclick={drive}>Send it to the rover <kbd>E</kbd></button>
      </div>
    {/if}
  </div>
{:else if open?.id === "note"}
  <div class="game note" role="dialog" aria-live="polite" aria-label="Ingenuity's log">
    <p class="from"><span class="pin" aria-hidden="true"></span>Ingenuity's log, for whoever comes next</p>
    <p class="ask">Ingenuity keeps notes for future explorers. Leave one too.</p>
    {#if saved}<p class="old">Last time you wrote: {logNoteText(saved)}</p>{/if}
    <div class="log" aria-live="polite">{notePreview}</div>
    {#each [["hello", LOG_CHIPS.hello], ["middle", LOG_CHIPS.middle], ["bye", LOG_CHIPS.bye]] as const as [part, chips] (part)}
      <div class="chips" role="radiogroup" aria-label={part === "hello" ? "Start" : part === "middle" ? "Middle" : "End"}>
        {#each chips as chip (chip)}
          <button type="button" role="radio" aria-checked={note[part] === chip} class="chip" class:on={note[part] === chip} onclick={() => ((note = { ...note, [part]: chip }), audio.ui("pop"))}>{chip}</button>
        {/each}
      </div>
    {/each}
    <div class="row"><button type="button" class="btn amber got" disabled={!ready} onclick={finish}>Save it in the log <kbd>E</kbd></button></div>
  </div>
{/if}

<style>
  .game {
    position: fixed;
    left: 50%;
    top: 50%;
    width: min(700px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    box-sizing: border-box;
    padding: 22px 28px 18px;
    transform: translate(-50%, -50%) rotate(-0.5deg);
    color: var(--ink);
    background: var(--grain), var(--card);
    border-top: 6px solid var(--clay);
    box-shadow: var(--shadow-card);
    animation: drop 0.5s var(--ease-spring);
    z-index: 30;
  }
  .game.scout {
    width: min(760px, calc(100vw - 32px));
  }
  .game::before {
    content: "";
    position: absolute;
    top: -14px;
    left: 50%;
    width: 120px;
    height: 26px;
    margin-left: -60px;
    background: var(--tape);
    border: 1px solid var(--tape-edge);
    transform: rotate(2deg);
  }
  .from {
    margin: 0 0 6px;
    font: 700 0.82rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .model {
    margin-left: auto;
    padding: 3px 7px 2px;
    border: 1.5px solid currentColor;
    border-radius: 3px;
    font-size: 0.7rem;
  }
  .pin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--clay);
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25);
  }
  .ask {
    margin: 0 0 8px;
    font: 400 1.2rem/1.4 var(--read);
    min-height: 1.6em;
  }
  .bench,
  .view {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 0 10px;
    border: 2px solid var(--ink);
    border-radius: 4px;
  }
  .view {
    background: #3a2a22;
  }
  .label {
    fill: #5a5048;
    font: 700 16px/1 var(--label);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .chalk {
    fill: #8a8378;
    font: 700 15px/1 var(--hand);
  }
  .cell {
    cursor: pointer;
  }
  .cell:hover {
    fill: rgba(255, 246, 224, 0.18);
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 18px;
    margin-bottom: 10px;
  }
  .air-pick {
    display: flex;
    gap: 8px;
    grid-column: 1 / -1;
  }
  .dial,
  .meter {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 700 0.95rem/1 var(--read);
  }
  .dial > span:first-child,
  .meter > span {
    min-width: 6.8em;
  }
  .step {
    width: 30px;
    height: 30px;
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: #fbf6ec;
    color: var(--ink);
    font: 700 1.1rem/1 var(--read);
    cursor: pointer;
  }
  .step:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .pips {
    display: flex;
    gap: 4px;
  }
  .pips i {
    width: 14px;
    height: 14px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: #fbf6ec;
  }
  .pips i.lit {
    background: var(--amber);
  }
  .meter {
    grid-column: 1 / -1;
  }
  .bar {
    position: relative;
    flex: 1;
    height: 16px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: #fbf6ec;
    overflow: hidden;
  }
  .bar b {
    position: absolute;
    inset: 0 auto 0 0;
    background: #c8553d;
    transition: width 0.25s ease;
  }
  .bar b.enough {
    background: #6e9b5a;
  }
  .bar i {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--ink);
  }
  .tasks {
    display: flex;
    gap: 16px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font: 400 0.95rem/1.3 var(--read);
  }
  .tasks li::before {
    content: "○ ";
  }
  .tasks li.done::before {
    content: "✓ ";
    color: #4f7a3a;
  }
  .tasks li.done {
    font-weight: 700;
  }
  .chip {
    padding: 8px 12px;
    border: 2px solid var(--ink);
    border-radius: 8px 10px 9px 7px;
    background: #fbf6ec;
    color: var(--ink);
    font: 700 0.95rem/1.15 var(--read);
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      background 0.15s;
  }
  .chip:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  .chip.on {
    background: #f7dfa8;
    box-shadow: 0 3px 0 var(--ink);
  }
  .chip kbd {
    margin-left: 6px;
    font: 700 0.7rem/1 var(--label);
    opacity: 0.6;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .log {
    min-height: 3.2em;
    margin: 0 0 12px;
    padding: 12px 16px;
    background: repeating-linear-gradient(#fffdf6 0 27px, #d9e3ea 27px 28px);
    border: 2px solid var(--ink);
    border-radius: 4px;
    font: 700 1.25rem/28px var(--hand);
  }
  .old {
    margin: 0 0 8px;
    font: 400 0.9rem/1.3 var(--read);
    color: var(--ink-soft);
  }
  .keys {
    margin: 0 0 8px;
    font: 400 0.9rem/1.3 var(--read);
    color: var(--ink-soft);
  }
  .real {
    margin: 0 0 10px;
    padding: 8px 12px;
    background: #fff;
    border-left: 4px solid var(--amber);
    font: 400 1rem/1.4 var(--read);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) rotate(-2deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .game {
      animation: none;
    }
  }
</style>
