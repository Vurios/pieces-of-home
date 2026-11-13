<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import { hoursAndMinutes, voyagerOn } from "../../content/voyager";
  import stars from "../../data/stars-voyager.json";
  import type { Engine } from "../../game/engine";
  import { presence } from "../../net/presence";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";
  import CardHead from "./card/CardHead.svelte";
  import GameAsk from "./card/GameAsk.svelte";
  import GameSteps from "./card/GameSteps.svelte";

  /**
   * Finale: aim Dad's dish at Voyager 1 (story game "dish").
   *
   * Dad's star map shows the real bright stars round tonight's patch of sky
   * (Yale Bright Star Catalog, NASA HEASARC) and hides Voyager 1 at its real
   * place for today (JPL Horizons). Turning the dish (drag, arrow keys or
   * WASD, or a stick) changes the radio: static far away, then beeps, faster
   * as the dish gets close. Close enough, the dish locks on and Voyager 1's
   * spot lights up. Then Remi sends Dad's letter, and the map says how long
   * light would take to get there today.
   *
   * Nothing can fail. After a while Dad's pencil circle shows the way.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  // ---- The map: a flat patch of sky round Voyager 1's part of the sky ----
  const W = 720;
  const H = 440;
  const RA0 = 259;
  const DEC0 = 9;
  /** Pixels per degree. East (bigger right ascension) is to the left, as on any sky map. */
  const K = W / 64;
  const COS = Math.cos((DEC0 * Math.PI) / 180);
  const toX = (ra: number): number => W / 2 - (ra - RA0) * COS * K;
  const toY = (dec: number): number => H / 2 - (dec - DEC0) * K;
  const fromX = (x: number): number => RA0 - (x - W / 2) / (COS * K);
  const fromY = (y: number): number => DEC0 - (y - H / 2) / K;
  const STARS = (stars as { stars: { hr: number; ra: number; dec: number; mag: number }[] }).stars
    .map((s) => ({ x: toX(s.ra), y: toY(s.dec), r: Math.max(0.9, 3.9 - s.mag * 0.68), twinkle: (s.hr % 7) * 0.4 }))
    .filter((s) => s.x > -10 && s.x < W + 10 && s.y > -10 && s.y < H + 10);
  const LOCK = 2.2;
  /** A friend holding the dish steady (co-op) widens the lock a little. */
  let steady = $state(false);
  $effect(() => presence.subscribe(() => (steady = presence.steady)));
  const SIGHT = 28;

  let open = $state<{ key: number } | null>(null);
  let voyager = $state(voyagerOn());
  let aim = $state({ ra: RA0 + 20, dec: DEC0 - 9 });
  let target: { ra: number; dec: number } | null = null;
  let phase = $state<"aim" | "locked" | "sending" | "sent">("aim");
  let hint = $state(false);
  let sendProgress = $state(0);
  let svg = $state<SVGSVGElement | null>(null);
  let sendButton = $state<HTMLButtonElement | null>(null);
  let doneButton = $state<HTMLButtonElement | null>(null);

  /** Angle on the sky between the dish and Voyager 1, in degrees. */
  const distance = $derived(Math.hypot((aim.ra - voyager.ra) * Math.cos((voyager.dec * Math.PI) / 180), aim.dec - voyager.dec));
  const signal = $derived(phase === "aim" ? Math.max(0, Math.min(1, 1 - distance / SIGHT)) : 1);
  const words = $derived(
    phase !== "aim" ? "Voyager 1!" : distance > 18 ? "Just stars and static." : distance > 8 ? "A faint beep..." : "Beeps! Getting closer.",
  );
  const light = $derived(hoursAndMinutes(voyager.lightMinutes));
  const source = fact("v1-light-time");
  const skyNote = fact("v1-sky-place").kid;

  $effect(() =>
    engine.bus.on("story:game", (p) => {
      if (p.id !== "dish") return;
      voyager = voyagerOn();
      // Start the dish well away, low and to the east.
      aim = { ra: voyager.ra + 19, dec: voyager.dec - 9 };
      target = null;
      phase = "aim";
      hint = false;
      sendProgress = 0;
      open = { key: p.key };
      audio.ui("page");
    }),
  );

  function finish(): void {
    if (!open) return;
    const key = open.key;
    open = null;
    audio.ui("tick");
    engine.bus.emit("story:game-done", { key });
  }

  const sfx = (name: string, level?: number): void => engine.bus.emit("sfx", { name, ...(level === undefined ? {} : { level }) });

  function lockOn(): void {
    phase = "locked";
    aim = { ra: voyager.ra, dec: voyager.dec };
    target = null;
    sfx("corner-sparkle", 0.7);
    window.setTimeout(() => sendButton?.focus({ preventScroll: true }), 60);
  }

  function send(): void {
    if (phase !== "locked") return;
    phase = "sending";
    sfx("laser", 0.5);
    const start = performance.now();
    const run = (now: number): void => {
      sendProgress = Math.min(1, (now - start) / (settings.reducedMotion ? 300 : 2200));
      if (sendProgress < 1) requestAnimationFrame(run);
      else {
        phase = "sent";
        sfx("delivery-chime");
        window.setTimeout(() => doneButton?.focus({ preventScroll: true }), 60);
      }
    };
    requestAnimationFrame(run);
  }

  /** E, Enter, Space or the A button. */
  function press(): void {
    if (phase === "locked") send();
    else if (phase === "sent") finish();
  }

  // Turning the dish, the radio, and the hint, every frame while the map is up.
  $effect(() => {
    if (!open) return;
    engine.holdStill += 1;
    // Untracked: this effect must not re-run because it changed the count itself.
    untrack(() => (banners.screens += 1));
    const held = new Set<string>();
    const onDown = (e: KeyboardEvent): void => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) {
        // The dish has the keys while the map is up; Remi stays put.
        e.preventDefault();
        e.stopPropagation();
        held.add(e.code);
      } else if ((e.code === "KeyE" || e.code === "Enter" || e.code === "Space") && !e.repeat) {
        if ((e.target as Element | null)?.closest?.("button") && e.code !== "KeyE") return;
        e.preventDefault();
        e.stopPropagation();
        press();
      }
    };
    const onUp = (e: KeyboardEvent): void => void held.delete(e.code);
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);

    const hiss = audio.loop("radio-hiss", 0.6, engine.world?.anchor("dish") ?? null);
    let frame = 0;
    let last = performance.now();
    const opened = last;
    let beep = 0;
    let servo = 0;
    let padA = true;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const pad = navigator.getGamepads?.().find((g) => g);
      const a = Boolean(pad?.buttons[0]?.pressed);
      if (a && !padA) press();
      padA = a;
      if (phase !== "aim") {
        hiss?.set(0.15);
        return;
      }
      // Keys and the stick turn the dish at a steady pace; a drag pulls it toward the pointer.
      let vx = 0;
      let vy = 0;
      if (held.has("ArrowLeft") || held.has("KeyA")) vx += 1;
      if (held.has("ArrowRight") || held.has("KeyD")) vx -= 1;
      if (held.has("ArrowUp") || held.has("KeyW")) vy += 1;
      if (held.has("ArrowDown") || held.has("KeyS")) vy -= 1;
      const sx = pad?.axes[0] ?? 0;
      const sy = pad?.axes[1] ?? 0;
      if (Math.abs(sx) > 0.2) vx -= sx;
      if (Math.abs(sy) > 0.2) vy -= sy;
      let moving = false;
      if (vx !== 0 || vy !== 0) {
        target = null;
        const speed = 13;
        aim = { ra: aim.ra + (vx * speed * dt) / COS, dec: aim.dec + vy * speed * dt };
        moving = true;
      } else if (target) {
        const dra = (target.ra - aim.ra) * COS;
        const ddec = target.dec - aim.dec;
        const far = Math.hypot(dra, ddec);
        const step = Math.min(far, 30 * dt);
        if (far > 0.05) {
          aim = { ra: aim.ra + ((dra / far) * step) / COS, dec: aim.dec + (ddec / far) * step };
          moving = true;
        } else target = null;
      }
      // Stay on the map.
      aim = { ra: Math.max(fromX(W - 12), Math.min(fromX(12), aim.ra)), dec: Math.max(fromY(H - 12), Math.min(fromY(12), aim.dec)) };
      if (moving) {
        servo -= dt;
        if (servo <= 0) {
          sfx("dish-servo", 0.35);
          servo = 0.7;
        }
      }
      // The radio: static fades as beeps come in, faster the closer the dish points.
      hiss?.set(0.7 - signal * 0.5);
      if (signal > 0.2) {
        beep -= dt;
        if (beep <= 0) {
          sfx("call-blip", 0.25 + signal * 0.45);
          beep = 2.2 - signal * 1.9;
        }
      }
      if (distance < (steady ? LOCK * 1.6 : LOCK)) lockOn();
      if (!hint && now - opened > 20_000) hint = true;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      engine.holdStill = Math.max(0, engine.holdStill - 1);
      banners.screens = Math.max(0, banners.screens - 1);
      cancelAnimationFrame(frame);
      hiss?.stop();
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  });

  // ---- Pointer: press or drag anywhere on the map to turn the dish there ----
  function pointAt(e: PointerEvent): void {
    if (!svg || phase !== "aim") return;
    const box = svg.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const y = ((e.clientY - box.top) / box.height) * H;
    target = { ra: fromX(x), dec: fromY(y) };
  }
  let dragging = false;

  const sendPath = $derived(`M ${W / 2} ${H + 30} Q ${W / 2 - 40} ${(H + toY(voyager.dec)) / 2} ${toX(voyager.ra)} ${toY(voyager.dec)}`);
</script>

{#if open}
  <div class="gc-scrim night" aria-hidden="true"></div>
  {#key open.key}
    <div class="dish gc gc-night" role="dialog" aria-modal="true" aria-label="Aim Dad's dish at Voyager 1">
      <CardHead kicker="Dad's star map" title="Find Voyager 1 and say hello" stamp="Real stars">
        {#snippet badge()}
          <svg viewBox="-22 -22 44 44">
            <path d="M-16 -2 A16 16 0 0 0 14 -10 Z" fill="#ECE5D7" stroke="#2B2622" stroke-width="2.2" stroke-linejoin="round" />
            <path d="M-1 -6 L8 -16" stroke="#2B2622" stroke-width="2" />
            <circle cx="9" cy="-17" r="2.6" fill="#C8553D" stroke="#2B2622" stroke-width="1.4" />
            <path d="M-4 3 L-8 16 H6 L2 3" fill="#8E8B86" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
            <path d="M12 -20 q 4 2 4 6 M15 -23 q 6 3 6 10" fill="none" stroke="#E0B34A" stroke-width="2" stroke-linecap="round" />
          </svg>
        {/snippet}
      </CardHead>
      <div class="gc-body">
        <GameAsk text={phase === "aim" ? (hint ? "Dad circled a spot on his map. Try there!" : "Turn the dish. Listen for the beeps.") : phase === "locked" ? "Locked on! Send Dad's letter." : phase === "sending" ? "Sending..." : "Sent!"} tone={phase === "aim" ? null : "good"} />
        <div class="gc-stage sky">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <svg
            class="map"
            viewBox="0 0 {W} {H}"
            bind:this={svg}
            aria-hidden="true"
            onpointerdown={(e) => {
              dragging = true;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              pointAt(e);
            }}
            onpointermove={(e) => dragging && pointAt(e)}
            onpointerup={() => (dragging = false)}
            onpointercancel={() => (dragging = false)}
          >
            <defs>
              <radialGradient id="dish-beam">
                <stop offset="0" stop-color="#FFD98A" stop-opacity="0.35" />
                <stop offset="1" stop-color="#FFD98A" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="dish-voyager">
                <stop offset="0" stop-color="#FFF6E0" />
                <stop offset="0.4" stop-color="#E0B34A" stop-opacity="0.8" />
                <stop offset="1" stop-color="#E0B34A" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="dish-milky" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#9AA6E8" stop-opacity="0.16" />
                <stop offset="1" stop-color="#9AA6E8" stop-opacity="0" />
              </radialGradient>
            </defs>
            <!-- A soft band of faint light, for the feel of the night sky. -->
            <ellipse cx={W * 0.58} cy={H * 0.4} rx={W * 0.6} ry={H * 0.2} transform="rotate(-24 {W * 0.58} {H * 0.4})" fill="url(#dish-milky)" />
            <!-- Dad's grid, in pencil. -->
            {#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
              <line x1={(i + 1) * (W / 10)} y1="0" x2={(i + 1) * (W / 10)} y2={H} class="grid" />
            {/each}
            {#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
              <line x1="0" y1={(i + 1) * (H / 6)} x2={W} y2={(i + 1) * (H / 6)} class="grid" />
            {/each}
            {#each STARS as s, i (i)}
              <circle cx={s.x} cy={s.y} r={s.r} class="star" style:animation-delay="{-s.twinkle}s" />
            {/each}
            {#if hint && phase === "aim"}
              <ellipse cx={toX(voyager.ra)} cy={toY(voyager.dec)} rx={K * 7} ry={K * 6} class="pencil" />
              <text x={toX(voyager.ra) + K * 7.5} y={toY(voyager.dec) - K * 5} class="pencil-note">Dad circled this spot</text>
            {/if}
            {#if phase !== "aim"}
              <circle cx={toX(voyager.ra)} cy={toY(voyager.dec)} r="26" fill="url(#dish-voyager)" class="found" />
              <circle cx={toX(voyager.ra)} cy={toY(voyager.dec)} r="4" fill="#FFF6E0" />
              <text x={toX(voyager.ra)} y={toY(voyager.dec) + 34} class="label">Voyager 1</text>
            {/if}
            {#if phase === "sending" || phase === "sent"}
              <path d={sendPath} pathLength="1" class="signal" stroke-dashoffset={1 - sendProgress} />
            {/if}
            <!-- The dish's aim: a soft beam spot and a pencil cross. -->
            {#if phase === "aim"}
              <g transform="translate({toX(aim.ra).toFixed(1)} {toY(aim.dec).toFixed(1)})">
                <circle r={K * 4} fill="url(#dish-beam)" />
                <circle r="16" class="aim" />
                <path d="M-24 0 H-10 M10 0 H24 M0 -24 V-10 M0 10 V24" class="aim" />
              </g>
            {/if}
            <!-- Map corners, like a page taped into Dad's notebook. -->
            <path d="M10 34 V10 H34 M{W - 34} 10 H{W - 10} V34 M{W - 10} {H - 34} V{H - 10} H{W - 34} M34 {H - 10} H10 V{H - 34}" fill="none" stroke="rgba(255,246,224,0.45)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>
        <div class="radio-row">
          <div class="radio" aria-live="polite">
            <span class="speaker" aria-hidden="true">{#each [0, 1, 2, 3, 4] as i (i)}<i></i>{/each}</span>
            <span class="bars" aria-hidden="true">{#each [0.15, 0.35, 0.55, 0.75, 0.92] as b (b)}<i class:on={signal >= b}></i>{/each}</span>
            <span class="words">{words}</span>
          </div>
          {#if phase === "aim"}<p class="gc-hint how">Drag on the map, or use the arrow keys, to turn the dish.</p>{/if}
          {#if phase === "locked"}
            <button type="button" class="btn amber" bind:this={sendButton} onclick={send}>Send Dad's letter <kbd>E</kbd></button>
          {/if}
        </div>
        {#if phase === "sent"}
          <div class="sent gc-real">
            <span>True story</span>
            <div>
              <p class="big">At the speed of light, Dad's letter would take about {light} to reach Voyager 1.</p>
              <p class="src">From: {source.sourceTitle}</p>
            </div>
            <button type="button" class="btn amber" bind:this={doneButton} onclick={finish}>Got it <kbd>E</kbd></button>
          </div>
        {/if}
        <div class="gc-foot">
          <GameSteps steps={[{ label: "Find Voyager 1", done: phase !== "aim" }, { label: "Send Dad's letter", done: phase === "sent" }]} />
          <p class="note">{skyNote}</p>
        </div>
      </div>
    </div>
  {/key}
{/if}

<style>
  .dish {
    --gc-w: 820px;
  }
  .gc-scrim.night {
    background: radial-gradient(ellipse at 50% 45%, rgba(8, 10, 30, 0.35), rgba(4, 5, 16, 0.78));
  }
  .sky {
    background: radial-gradient(ellipse at 50% 60%, #1d2560, #0b1030 75%);
  }
  .map {
    touch-action: none;
    cursor: crosshair;
  }
  .grid {
    stroke: rgba(255, 246, 224, 0.07);
    stroke-width: 1;
  }
  .star {
    fill: #fff6e0;
    animation: twinkle 3.4s ease-in-out infinite;
  }
  .aim {
    fill: none;
    stroke: #ffd98a;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .pencil {
    fill: none;
    stroke: rgba(255, 246, 224, 0.6);
    stroke-width: 2;
    stroke-dasharray: 6 7;
  }
  .pencil-note {
    fill: rgba(255, 246, 224, 0.75);
    font: 700 15px/1 var(--hand);
  }
  .found {
    animation: pulse 1.3s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .label {
    fill: #ffd98a;
    font: 700 20px/1 var(--hand);
    text-anchor: middle;
  }
  .signal {
    fill: none;
    stroke: #ffd98a;
    stroke-width: 3;
    stroke-dasharray: 0.02 0.015;
    stroke-linecap: round;
  }
  .radio-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 52px;
    margin-top: 12px;
  }
  .radio-row .how {
    margin: 0;
  }
  .radio-row .btn {
    margin-left: auto;
  }
  /* Dad's little radio: a speaker grille, signal bars and what it hears. */
  .radio {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px 8px 10px;
    background: #27306a;
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: 0 3px 0 var(--ink);
    color: #fff6e0;
    font: 700 1.1rem/1.2 var(--hand);
  }
  .speaker {
    display: grid;
    gap: 3px;
    width: 28px;
    height: 28px;
    padding: 4px;
    box-sizing: border-box;
    background: #1a2050;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 246, 224, 0.4);
    align-content: center;
  }
  .speaker i {
    height: 1.5px;
    background: rgba(255, 246, 224, 0.5);
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 26px;
  }
  .bars i {
    width: 7px;
    border-radius: 2px;
    background: rgba(255, 246, 224, 0.2);
    transition: background 0.2s;
  }
  .bars i:nth-child(1) {
    height: 30%;
  }
  .bars i:nth-child(2) {
    height: 45%;
  }
  .bars i:nth-child(3) {
    height: 60%;
  }
  .bars i:nth-child(4) {
    height: 80%;
  }
  .bars i:nth-child(5) {
    height: 100%;
  }
  .bars i.on {
    background: #ffd98a;
  }
  .sent {
    align-items: center;
  }
  .sent > div {
    flex: 1;
  }
  .big {
    margin: 0;
    font: 700 1.25rem/1.3 var(--hand);
  }
  .src {
    margin: 2px 0 0;
    font: 400 0.82rem/1.3 var(--read);
    color: var(--ink-soft);
  }
  .note {
    margin: 0;
    max-width: 46%;
    text-align: right;
    font: 400 0.8rem/1.35 var(--read);
    color: var(--ink-soft);
  }
  @keyframes twinkle {
    50% {
      opacity: 0.55;
    }
  }
  @keyframes pulse {
    50% {
      transform: scale(1.25);
    }
  }
  :global(:root[data-motion="reduce"]) .dish *,
  :global(:root[data-motion="reduce"]) .dish {
    animation: none !important;
  }
</style>
