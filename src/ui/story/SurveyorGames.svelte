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

  /**
   * The bonus chapter's small games on screen (story games "pinpoint" and
   * "snip").
   *
   * Pinpoint: Dad's landing table seen from above. Steer the toy lander's
   * shadow over a field of craters, find the Snowman (a big round crater with
   * a smaller one on top), and set down in its tummy, right by Surveyor 3.
   * The Apollo 12 crew steered by that pattern (fact a12-snowman).
   *
   * Snip: Dad's drawing of Surveyor 3 with dotted lines round the parts the
   * astronauts took home (fact sur3-cutters). Pick a part, snip it, and it
   * drops into the bag. Nothing can fail in either game.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  type Id = "pinpoint" | "snip";
  let open = $state<{ key: number; id: Id } | null>(null);
  let doneButton = $state<HTMLButtonElement | null>(null);
  let actButton = $state<HTMLButtonElement | null>(null);

  const snowmanFact = fact("a12-snowman");
  const cuttersFact = fact("sur3-cutters");

  // ---------------------------------------------------------------- Pinpoint
  const W = 600;
  const H = 400;
  const BODY = { x: 392, y: 250, r: 52 };
  const HEAD = { x: 392, y: 172, r: 29 };
  const ARMS = [
    { x: 328, y: 236, r: 12 },
    { x: 457, y: 232, r: 13 },
  ];
  const SURVEYOR = { x: 410, y: 266 };
  /** The other craters on Dad's map: none of them make a snowman. */
  const FIELD = (() => {
    const out: { x: number; y: number; r: number }[] = [];
    const rand = (n: number): number => {
      const v = Math.sin(n * 91.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const keep = [BODY, HEAD, ...ARMS];
    for (let i = 0; out.length < 26 && i < 400; i += 1) {
      const c = { x: 26 + rand(i * 3 + 1) * (W - 52), y: 24 + rand(i * 3 + 2) * (H - 48), r: 6 + rand(i * 3 + 3) ** 2 * 34 };
      if (keep.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < k.r + c.r + 30)) continue;
      if (out.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < k.r + c.r + 8)) continue;
      out.push(c);
    }
    return out;
  })();
  const GRAINS = Array.from({ length: 70 }, (_, i) => {
    const r = (n: number): number => {
      const v = Math.sin(i * 47.1 + n * 13.3) * 15731.743;
      return v - Math.floor(v);
    };
    return { x: r(1) * W, y: r(2) * H, r: 0.8 + r(3) * 1.4 };
  });

  let px = $state(120);
  let py = $state(130);
  /** 1 high up, 0 on the ground. */
  let height = $state(1);
  let landing = $state(false);
  let found = $state(false);
  let landed = $state(false);
  let landTone = $state<"good" | "oops" | null>(null);
  let landSay = $state<string | null>(null);
  let goal = $state<{ x: number; y: number } | null>(null);
  let puffs = $state<{ id: number; x: number; y: number; r: number; o: number; vx: number; vy: number }[]>([]);
  const held = new Set<string>();

  const over = $derived(Math.hypot(px - BODY.x, py - BODY.y) < BODY.r - 8);
  const onHead = $derived(Math.hypot(px - HEAD.x, py - HEAD.y) < HEAD.r);
  const pinAsk = $derived(
    landSay ?? (landing ? "Down, down, down..." : over ? "Right over its tummy. Land now!" : found ? "That's the Snowman! Aim for its tummy." : "Steer the shadow. Can you find the Snowman?"),
  );

  function resetPinpoint(): void {
    px = 120;
    py = 130;
    height = 1;
    landing = false;
    found = false;
    landed = false;
    landTone = null;
    landSay = null;
    goal = null;
    puffs = [];
    held.clear();
  }

  let puffId = 0;
  function land(): void {
    if (!open || landing || landed) return;
    landing = true;
    landSay = null;
    landTone = null;
    goal = null;
    engine.bus.emit("sfx", { name: "hover-hop", level: 0.5 });
    const start = performance.now();
    const length = settings.reducedMotion ? 400 : 1500;
    const fall = (now: number): void => {
      const t = Math.min(1, (now - start) / length);
      height = 1 - (1 - (1 - t) ** 2);
      if (t > 0.6 && !settings.reducedMotion && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        puffs = [...puffs.slice(-30), { id: (puffId += 1), x: px, y: py, r: 4 + Math.random() * 4, o: 0.8, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.2 }];
      }
      if (t < 1) {
        requestAnimationFrame(fall);
        return;
      }
      height = 0;
      if (over) {
        landed = true;
        landTone = "good";
        landSay = "Landed! Right next to Surveyor.";
        engine.bus.emit("sfx", { name: "rocket-land", level: 0.6 });
        engine.bus.emit("sfx", { name: "corner-sparkle", level: 0.5, delay: 0.4 });
        window.setTimeout(() => doneButton?.focus({ preventScroll: true }), 80);
      } else {
        landTone = "oops";
        landSay = onHead ? "That's the Snowman's head. Surveyor is in its tummy!" : found ? "Close! Try the big round crater, the Snowman's tummy." : "Not quite. Look for the Snowman first.";
        audio.ui("tick");
        // Back up into the air to try again.
        window.setTimeout(() => {
          if (!open || landed) return;
          const up = performance.now();
          const rise = (n: number): void => {
            const k = Math.min(1, (n - up) / (settings.reducedMotion ? 150 : 700));
            height = k;
            if (k < 1) requestAnimationFrame(rise);
            else landing = false;
          };
          requestAnimationFrame(rise);
        }, 900);
      }
    };
    requestAnimationFrame(fall);
  }

  /** Clicking the map sets where the lander drifts to. */
  function aim(e: PointerEvent): void {
    if (landing || landed) return;
    const svg = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    goal = { x: ((e.clientX - svg.left) / svg.width) * W, y: ((e.clientY - svg.top) / svg.height) * H };
  }

  // ------------------------------------------------------------------ Snip
  type Part = "camera" | "scoop" | "tube";
  const PARTS: { id: Part; name: string; short: string; x: number; y: number }[] = [
    { id: "camera", name: "TV camera", short: "Camera", x: 352, y: 128 },
    { id: "scoop", name: "Scoop", short: "Scoop", x: 132, y: 236 },
    { id: "tube", name: "Piece of tube", short: "Tube", x: 258, y: 228 },
  ];
  let picked = $state<Part>("camera");
  let snipped = $state<Part[]>([]);
  let snipping = $state(false);
  /** 0 to 1 while a part flies into the bag. */
  let fly = $state(0);
  let flying = $state<Part | null>(null);
  const allSnipped = $derived(PARTS.every((p) => snipped.includes(p.id)));
  const part = $derived(PARTS.find((p) => p.id === picked)!);
  const BAG = { x: 520, y: 248 };
  const snipAsk = $derived(
    allSnipped ? "All three are in the bag. Scientists will study them back home!" : snipping ? "Snip!" : snipped.length === 0 ? "Dad drew dotted lines round the parts to take home. Pick one and snip it." : "Good! Now the next one.",
  );

  function resetSnip(): void {
    picked = "camera";
    snipped = [];
    snipping = false;
    fly = 0;
    flying = null;
  }

  function pick(id: Part): void {
    if (snipping || snipped.includes(id)) return;
    picked = id;
    audio.ui("pop");
  }

  function snip(): void {
    if (!open || snipping || snipped.includes(picked)) return;
    snipping = true;
    flying = picked;
    engine.bus.emit("sfx", { name: "servo", level: 0.5 });
    const start = performance.now();
    const length = settings.reducedMotion ? 300 : 1100;
    const go = (now: number): void => {
      const t = Math.min(1, (now - start) / length);
      fly = t;
      if (t < 1) {
        requestAnimationFrame(go);
        return;
      }
      const id = flying!;
      snipped = [...snipped, id];
      flying = null;
      fly = 0;
      snipping = false;
      engine.bus.emit("sfx", { name: "part-clunk", level: 0.4 });
      const next = PARTS.find((p) => !snipped.includes(p.id));
      if (next) picked = next.id;
      else window.setTimeout(() => doneButton?.focus({ preventScroll: true }), 80);
    };
    requestAnimationFrame(go);
  }

  /** Where a part is drawn: in place, flying in an arc to the bag, or hidden in the bag. */
  function partAt(id: Part): { x: number; y: number; s: number; show: boolean } {
    const p = PARTS.find((q) => q.id === id)!;
    if (snipped.includes(id)) return { x: BAG.x, y: BAG.y, s: 0, show: false };
    if (flying !== id) return { x: 0, y: 0, s: 1, show: true };
    const t = fly < 0.25 ? 0 : (fly - 0.25) / 0.75;
    const e = t * t * (3 - 2 * t);
    const dx = (BAG.x - p.x) * e;
    const dy = (BAG.y - p.y) * e - Math.sin(e * Math.PI) * 90;
    return { x: dx, y: dy, s: 1 - 0.55 * e, show: true };
  }

  // ------------------------------------------------------------------ Shared
  $effect(() =>
    engine.bus.on("story:game", (p) => {
      if (p.id !== "pinpoint" && p.id !== "snip") return;
      if (p.id === "pinpoint") resetPinpoint();
      else resetSnip();
      open = { key: p.key, id: p.id };
      audio.ui("page");
      window.setTimeout(() => actButton?.focus({ preventScroll: true }), 80);
    }),
  );

  const ready = $derived(open?.id === "pinpoint" ? landed : open?.id === "snip" ? allSnipped && !snipping : false);

  function finish(): void {
    if (!open || !ready) return;
    const key = open.key;
    open = null;
    audio.ui("tick");
    engine.bus.emit("story:game-done", { key });
  }

  function act(): void {
    if (ready) finish();
    else if (open?.id === "pinpoint") land();
    else snip();
  }

  // Keys, the gamepad and the steering loop while a game is up. Remi stays put.
  $effect(() => {
    if (!open) return;
    const id = open.id;
    engine.holdStill += 1;
    untrack(() => (banners.screens += 1));
    const steer = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"];
    const onDown = (e: KeyboardEvent): void => {
      const keys = [...steer, "Digit1", "Digit2", "Digit3", "KeyE", "Enter", "Space"];
      if (!keys.includes(e.code)) return;
      if ((e.code === "Enter" || e.code === "Space") && (e.target as Element | null)?.closest?.("button")) return;
      e.preventDefault();
      e.stopPropagation();
      if (steer.includes(e.code)) {
        held.add(e.code);
        if (id === "snip" && !e.repeat) {
          const left = PARTS.filter((p) => !snipped.includes(p.id));
          const i = left.findIndex((p) => p.id === picked);
          const step = e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowUp" || e.code === "KeyW" ? -1 : 1;
          if (left.length) pick(left[(i + step + left.length) % left.length]!.id);
        }
        return;
      }
      if (e.repeat) return;
      if (e.code.startsWith("Digit") && id === "snip") pick(PARTS[Number(e.code.slice(5)) - 1]!.id);
      else if (!e.code.startsWith("Digit")) act();
    };
    const onUp = (e: KeyboardEvent): void => void held.delete(e.code);
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    let frame = 0;
    let padA = true;
    let last = performance.now();
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pad = navigator.getGamepads?.().find((g) => g);
      const a = Boolean(pad?.buttons[0]?.pressed);
      if (a && !padA) act();
      padA = a;
      if (id !== "pinpoint") return;
      if (!landing && !landed) {
        let dx = (held.has("ArrowRight") || held.has("KeyD") ? 1 : 0) - (held.has("ArrowLeft") || held.has("KeyA") ? 1 : 0);
        let dy = (held.has("ArrowDown") || held.has("KeyS") ? 1 : 0) - (held.has("ArrowUp") || held.has("KeyW") ? 1 : 0);
        const sx = pad?.axes[0] ?? 0;
        const sy = pad?.axes[1] ?? 0;
        if (Math.abs(sx) > 0.2) dx = sx;
        if (Math.abs(sy) > 0.2) dy = sy;
        if (dx || dy) goal = null;
        else if (goal) {
          const gx = goal.x - px;
          const gy = goal.y - py;
          const d = Math.hypot(gx, gy);
          if (d < 3) goal = null;
          else {
            dx = gx / d;
            dy = gy / d;
            if (d < 30) {
              dx *= d / 30;
              dy *= d / 30;
            }
          }
        }
        const speed = 190;
        px = Math.max(16, Math.min(W - 16, px + dx * speed * dt));
        py = Math.max(16, Math.min(H - 16, py + dy * speed * dt));
        if (!found && Math.hypot(px - (BODY.x + HEAD.x) / 2, py - (BODY.y + HEAD.y) / 2) < 105) {
          found = true;
          engine.bus.emit("sfx", { name: "corner-sparkle", level: 0.3 });
        }
      }
      if (puffs.length) puffs = puffs.map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, r: p.r + 0.3, o: p.o - 0.02 })).filter((p) => p.o > 0);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      engine.holdStill = Math.max(0, engine.holdStill - 1);
      banners.screens = Math.max(0, banners.screens - 1);
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      cancelAnimationFrame(frame);
      held.clear();
    };
  });
</script>

{#snippet crater(x: number, y: number, r: number, tone = "#9C978F")}
  <ellipse cx={x + r * 0.08} cy={y + r * 0.1} rx={r * 1.12} ry={r * 1.1} fill="#CFCAC0" />
  <circle cx={x} cy={y} r={r} fill={tone} stroke="#2B2622" stroke-width={r > 20 ? 2.2 : 1.6} />
  <path d="M{x - r * 0.78} {y - r * 0.35} A {r * 0.86} {r * 0.86} 0 0 1 {x + r * 0.5} {y - r * 0.72}" fill="none" stroke="#6E6A64" stroke-width={Math.max(1.4, r * 0.18)} stroke-linecap="round" opacity="0.6" />
{/snippet}

{#snippet lander(s: number)}
  <g transform="scale({s})">
    <path d="M-14 6 L-22 18 M14 6 L22 18 M-6 8 L-9 20 M6 8 L9 20" stroke="#2B2622" stroke-width="2.4" stroke-linecap="round" />
    <path d="M-26 18 H-18 M18 18 H26" stroke="#2B2622" stroke-width="3" stroke-linecap="round" />
    <path d="M-15 -4 L15 -4 L17 8 L-17 8 Z" fill="#D2A445" stroke="#2B2622" stroke-width="2.2" stroke-linejoin="round" />
    <path d="M-10 -4 L-8 -16 L8 -16 L10 -4 Z" fill="#C4C1BA" stroke="#2B2622" stroke-width="2.2" stroke-linejoin="round" />
    <circle cx="0" cy="-10" r="3" fill="#2B3A63" />
  </g>
{/snippet}

{#snippet badgeArt()}
  <svg viewBox="-24 -24 48 48">
    <circle cx="0" cy="6" r="12" fill="#9C978F" stroke="#2B2622" stroke-width="2" />
    <circle cx="0" cy="-10" r="7" fill="#9C978F" stroke="#2B2622" stroke-width="2" />
    <circle cx="4" cy="9" r="2.4" fill="#C9B48C" />
  </svg>
{/snippet}

{#if open?.id === "pinpoint"}
  <div class="gc-scrim"></div>
  <div class="game pinpoint gc gc-moon" role="dialog" aria-label="Dad's landing table">
    <CardHead kicker="Dad's landing table" title="Can you land by the Snowman?" stamp="Model">
      {#snippet badge()}{@render badgeArt()}{/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={pinAsk} tone={landTone} />
      <div class="gc-split">
        <div class="gc-stage map-stage">
          <svg viewBox="0 0 {W} {H}" role="img" aria-label="Dad's crater map, seen from above" onpointerdown={aim}>
            <rect width={W} height={H} fill="#B9B4AB" />
            {#each GRAINS as g, i (i)}<circle cx={g.x} cy={g.y} r={g.r} fill="#A29D94" opacity="0.7" />{/each}
            {#each FIELD as c, i (i)}{@render crater(c.x, c.y, c.r)}{/each}
            <!-- The Snowman: a big tummy, a smaller head, and two little arms. -->
            {#each ARMS as c, i (i)}{@render crater(c.x, c.y, c.r)}{/each}
            {@render crater(HEAD.x, HEAD.y, HEAD.r)}
            {@render crater(BODY.x, BODY.y, BODY.r, "#948F87")}
            <!-- Surveyor 3, a tiny tan robot on the slope inside the tummy. -->
            <g transform="translate({SURVEYOR.x} {SURVEYOR.y})">
              <path d="M-6 5 L0 -7 L6 5 Z" fill="#C9B48C" stroke="#2B2622" stroke-width="1.6" stroke-linejoin="round" />
              <circle r="11" fill="none" stroke="#F4ECDD" stroke-width="1.5" stroke-dasharray="3 3" class:glint={!landed} />
            </g>
            {#if found}
              <text x={HEAD.x + HEAD.r + 10} y={HEAD.y - 4} class="chalk">the Snowman!</text>
            {/if}
            {#if goal && !landing}
              <circle cx={goal.x} cy={goal.y} r="7" fill="none" stroke="#C8553D" stroke-width="2.5" />
            {/if}
            {#each puffs as p (p.id)}<circle cx={p.x} cy={p.y} r={p.r} fill="#E2DDD3" opacity={p.o} />{/each}
            <!-- The lander's shadow on the ground, sharp and small as it comes down, and the lander above it. -->
            <ellipse cx={px} cy={py + 4} rx={18 + height * 14} ry={9 + height * 7} fill="#2B2622" opacity={0.42 - height * 0.22} />
            <circle cx={px} cy={py + 4} r="3" fill="#C8553D" opacity={height > 0.05 ? 0.9 : 0} />
            <g transform="translate({px - 34 * height} {py - 70 * height - 8})">{@render lander(0.95 + height * 0.35)}</g>
          </svg>
        </div>
        <div class="gc-side">
          <div class="gc-group sketch">
            <p class="gc-label">Dad's note</p>
            <svg viewBox="0 0 120 92" aria-hidden="true">
              <circle cx="60" cy="58" r="24" fill="none" stroke="#2B2622" stroke-width="2.4" />
              <circle cx="60" cy="24" r="13" fill="none" stroke="#2B2622" stroke-width="2.4" />
              <circle cx="27" cy="54" r="5" fill="none" stroke="#2B2622" stroke-width="2" />
              <circle cx="94" cy="52" r="6" fill="none" stroke="#2B2622" stroke-width="2" />
              <path d="M68 66 l 6 4" stroke="#C8553D" stroke-width="3" stroke-linecap="round" />
              <path d="M84 80 C 80 74, 76 72, 72 70" fill="none" stroke="#C8553D" stroke-width="1.8" />
            </svg>
            <p class="hand">Find the Snowman. Land in its tummy.</p>
          </div>
          <div class="gc-group">
            <p class="gc-label">Height</p>
            <div class="altimeter" aria-hidden="true">
              <i style="height: {Math.round(height * 100)}%"></i>
            </div>
          </div>
          <p class="gc-hint">Arrow keys or the stick steer. You can also tap the map.</p>
        </div>
      </div>
      {#if landed}<p class="gc-real"><span>True story</span>{snowmanFact.kid}</p>{/if}
      <div class="gc-foot">
        <GameSteps
          steps={[
            { label: "Find the Snowman", done: found },
            { label: "Fly over its tummy", done: over || landed },
            { label: "Land", done: landed },
          ]}
        />
        <div class="gc-actions">
          {#if landed}
            <button type="button" class="btn amber got" bind:this={doneButton} onclick={finish}>Touchdown! <kbd>E</kbd></button>
          {:else}
            <button type="button" class="btn amber" bind:this={actButton} disabled={landing} onclick={land}>Land <kbd>E</kbd></button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else if open?.id === "snip"}
  <div class="gc-scrim"></div>
  <div class="game snip gc gc-moon" role="dialog" aria-label="Dad's cutters">
    <CardHead kicker="Dad's cutters" title="Which parts go home to be studied?" stamp="Model">
      {#snippet badge()}
        <svg viewBox="-24 -24 48 48">
          <path d="M-14 -14 L8 8 M14 -14 L-8 8" stroke="#2B2622" stroke-width="3.5" stroke-linecap="round" />
          <circle cx="-11" cy="12" r="6" fill="#C8553D" stroke="#2B2622" stroke-width="2" />
          <circle cx="11" cy="12" r="6" fill="#C8553D" stroke="#2B2622" stroke-width="2" />
        </svg>
      {/snippet}
    </CardHead>
    <div class="gc-body">
      <GameAsk text={snipAsk} tone={allSnipped ? "good" : null} />
      <div class="gc-stage plan-stage">
        <svg viewBox="0 0 600 300" aria-hidden="true">
          <defs>
            <pattern id="sv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0 H0 V20" fill="none" stroke="#9FB8D8" stroke-width="0.8" opacity="0.5" />
            </pattern>
          </defs>
          <rect width="600" height="300" fill="#2F5585" />
          <rect width="600" height="300" fill="url(#sv-grid)" />
          <text x="20" y="30" class="plan-title">SURVEYOR 3, BY DAD</text>
          <text x="20" y="58" class="plan-note">Bring these home,</text>
          <text x="20" y="80" class="plan-note">and see what the Moon did.</text>
          <path d="M150 84 C 170 110, 160 140, 132 170" fill="none" stroke="#F9DC9E" stroke-width="2" stroke-dasharray="5 5" />
          <path d="M126 160 L132 172 L142 164" fill="none" stroke="#F9DC9E" stroke-width="2" />
          <!-- Ground and the trenches. -->
          <path d="M20 268 C 160 260, 420 262, 580 270" fill="none" stroke="#E8F0FA" stroke-width="2" />
          {#each [92, 112, 132] as tx (tx)}<path d="M{tx} 266 l 10 0" stroke="#E8F0FA" stroke-width="5" opacity="0.5" />{/each}
          <!-- The frame, the legs and the footpads. -->
          <g class="plan">
            <path d="M226 200 L300 84 L374 200 Z M248 166 L352 166" />
            <path d="M232 200 L182 262 M368 200 L420 262 M300 200 L306 264" />
            <ellipse cx="178" cy="265" rx="20" ry="5" /><ellipse cx="424" cy="265" rx="20" ry="5" /><ellipse cx="306" cy="267" rx="18" ry="4.5" />
            <path d="M300 84 L300 50" />
            <path d="M300 50 L246 30 L236 56 L290 70 Z" />
            <path d="M302 52 L364 28 L376 52 L314 72 Z" />
            <path d="M318 40 L326 66 M334 34 L342 60 M350 30 L358 56" class="thin" />
            <rect x="254" y="172" width="36" height="24" />
            <!-- The scoop arm, folded out toward the trenches. -->
            <path d="M240 196 L200 218 L160 226" />
            <path d="M232 204 L196 210" class="thin" />
          </g>
          <!-- The parts to take home, each with Dad's dotted line round it. -->
          {#each PARTS as p (p.id)}
            {@const at = partAt(p.id)}
            {#if at.show}
              <g transform="translate({p.x + at.x} {p.y + at.y}) scale({at.s})" class="part" class:picked={picked === p.id && !snipping}>
                {#if p.id === "camera"}
                  <rect x="-12" y="-26" width="24" height="44" rx="3" fill="#E8F0FA" />
                  <path d="M-14 -26 L14 -26 L18 -38 L-8 -40 Z" fill="#C9D9EC" />
                  <path d="M-10 -32 L10 -36" stroke="#2F5585" stroke-width="2" />
                {:else if p.id === "scoop"}
                  <path d="M-22 -10 L22 -10 L18 12 L-18 12 Z" fill="#E8F0FA" />
                  <path d="M-16 12 l 0 6 M0 12 l 0 6 M16 12 l 0 6" stroke="#E8F0FA" stroke-width="3" stroke-linecap="round" />
                {:else}
                  <rect x="-26" y="-5" width="52" height="10" rx="5" fill="#E8F0FA" />
                {/if}
                {#if flying !== p.id}
                  <ellipse rx={p.id === "tube" ? 40 : 32} ry={p.id === "camera" ? 36 : 26} cy={p.id === "camera" ? -10 : 0} class="cut" />
                  <text x={p.id === "camera" ? 40 : p.id === "scoop" ? -6 : -46} y={p.id === "camera" ? 18 : p.id === "scoop" ? -34 : 5} class="part-label" text-anchor={p.id === "camera" ? "start" : p.id === "scoop" ? "middle" : "end"}>{p.short.toLowerCase()}</text>
                {/if}
              </g>
            {/if}
          {/each}
          {#if !snipping && !allSnipped}
            <g transform="translate({part.x + 34} {part.y - 30}) rotate(150)">
              <g class="cutters">
                <path d="M0 0 L22 -10 M0 0 L22 10" stroke="#F4ECDD" stroke-width="4" stroke-linecap="round" />
                <circle cx="-10" cy="-8" r="7" fill="#C8553D" stroke="#2B2622" stroke-width="2" />
                <circle cx="-10" cy="8" r="7" fill="#C8553D" stroke="#2B2622" stroke-width="2" />
              </g>
            </g>
          {/if}
          <!-- The bag, open and waiting, with the parts inside so far. -->
          <g transform="translate({BAG.x} {BAG.y})">
            <path d="M-34 -16 C -40 20, -30 34, 0 36 C 30 34, 40 20, 34 -16 Z" fill="#EFE9DC" stroke="#2B2622" stroke-width="2.4" stroke-linejoin="round" />
            <ellipse cy="-16" rx="34" ry="8" fill="#CFC6B2" stroke="#2B2622" stroke-width="2.2" />
            <text y="16" class="bag-count" text-anchor="middle">{snipped.length} / 3</text>
          </g>
        </svg>
      </div>
      <div class="gc-tiles three" role="radiogroup" aria-label="Pick a part">
        {#each PARTS as p, i (p.id)}
          <button type="button" role="radio" aria-checked={picked === p.id && !snipped.includes(p.id)} class="gc-tile" disabled={snipping || snipped.includes(p.id)} onclick={() => pick(p.id)}>
            <span class="name">{p.name} <kbd>{i + 1}</kbd></span>
            {#if snipped.includes(p.id)}<span class="verdict win">In the bag</span>{:else}<span class="verdict todo">Still on</span>{/if}
          </button>
        {/each}
      </div>
      {#if allSnipped}<p class="gc-real"><span>True story</span>{cuttersFact.kid}</p>{/if}
      <div class="gc-foot">
        <GameSteps steps={PARTS.map((p) => ({ label: p.short, done: snipped.includes(p.id) }))} />
        <div class="gc-actions">
          {#if allSnipped}
            <button type="button" class="btn amber got" bind:this={doneButton} disabled={snipping} onclick={finish}>Close the bag <kbd>E</kbd></button>
          {:else}
            <button type="button" class="btn amber" bind:this={actButton} disabled={snipping} onclick={snip}>Snip <kbd>E</kbd></button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .game.pinpoint {
    --gc-w: 880px;
  }
  .game.snip {
    --gc-w: 780px;
  }
  .map-stage svg {
    cursor: crosshair;
    touch-action: none;
  }
  .chalk {
    fill: #fffdf6;
    font: 700 17px/1 var(--hand);
    paint-order: stroke;
    stroke: #2b2622;
    stroke-width: 3px;
  }
  .glint {
    animation: glint 1.6s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  @keyframes glint {
    50% {
      opacity: 0.2;
      transform: scale(1.3);
    }
  }
  .sketch svg {
    display: block;
    width: 100%;
    max-width: 150px;
    margin: 0 auto;
  }
  .hand {
    margin: 4px 0 0;
    font: 700 1.05rem/1.2 var(--hand);
    text-align: center;
    color: var(--ink);
  }
  .altimeter {
    position: relative;
    height: 62px;
    width: 34px;
    margin: 0 auto;
    background: repeating-linear-gradient(to top, transparent 0 17px, rgba(43, 38, 34, 0.18) 17px 18px), #f4efe3;
    border: 2px solid var(--ink);
    border-radius: 8px;
    overflow: hidden;
  }
  .altimeter i {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: #d2a445;
    border-top: 2px solid var(--ink);
  }
  .plan :global(*) {
    fill: none;
    stroke: #e8f0fa;
    stroke-width: 2.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .plan :global(.thin) {
    stroke-width: 1.3;
    opacity: 0.7;
  }
  .plan-note {
    fill: #f9dc9e;
    font: 700 16px/1 var(--hand);
  }
  .part-label {
    fill: #f9dc9e;
    font: 700 16px/1 var(--hand);
  }
  .plan-title {
    fill: #e8f0fa;
    font: 700 13px/1 var(--label);
    letter-spacing: 0.14em;
  }
  .cut {
    fill: none;
    stroke: #f9dc9e;
    stroke-width: 2.4;
    stroke-dasharray: 6 5;
  }
  .part.picked .cut {
    stroke: #ffcf6e;
    stroke-width: 3.4;
    animation: march 0.9s linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -22;
    }
  }
  .cutters {
    animation: snipper 1.1s ease-in-out infinite;
  }
  @keyframes snipper {
    50% {
      transform: translate(-4px, 4px);
    }
  }
  .bag-count {
    fill: #2b2622;
    font: 700 15px/1 var(--hand);
  }
  .gc-tiles.three {
    grid-template-columns: repeat(3, 1fr);
    margin-top: 12px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .name kbd {
    padding: 1px 5px;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    font: 700 0.62rem/1.2 var(--label);
    opacity: 0.8;
  }
  .verdict {
    padding: 2px 8px;
    border-radius: 999px;
    font: 700 0.78rem/1.3 var(--read);
  }
  .verdict.win {
    background: #dcebd0;
    color: var(--sage-deep);
  }
  .verdict.todo {
    color: var(--ink-soft);
    font-weight: 400;
  }
  :global(:root[data-motion="reduce"]) .glint,
  :global(:root[data-motion="reduce"]) .cutters,
  :global(:root[data-motion="reduce"]) .part.picked .cut {
    animation: none;
  }
</style>
