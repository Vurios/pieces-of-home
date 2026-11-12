<script lang="ts">
  import { audio } from "../../audio/audio";
  import type { Engine } from "../../game/engine";

  /**
   * Small games inside a chapter's story (Chapter 3). The story director asks
   * for one with "story:game" and waits for "story:game-done".
   *
   * - blueberries: grind a patch of rock, then find the little round
   *   "blueberries" inside it.
   * - telemetry: the rover's last report as two gauges. No numbers: only
   *   "very low power" and "very dark sky".
   * - calls: send calls to the sleeping rover. No answer comes.
   *
   * Everything works with a mouse, a touch, the keyboard (E, Enter, Space)
   * and a gamepad's A button. Copy: grade 3 to 5, no em dashes.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  let game = $state<{ key: number; id: string } | null>(null);
  let finishing = false;

  $effect(() =>
    engine.bus.on("story:game", (p) => {
      game = { key: p.key, id: p.id };
      finishing = false;
      reset();
      audio.ui("page");
    }),
  );

  function finish(delay = 0): void {
    if (!game || finishing) return;
    finishing = true;
    const key = game.key;
    window.setTimeout(() => {
      game = null;
      audio.ui("tick");
      engine.bus.emit("story:game-done", { key });
    }, delay);
  }

  const sfx = (name: string): void => engine.bus.emit("sfx", { name });

  // ---- The rock grinder and the blueberries ----
  const BERRIES = [
    { x: 118, y: 126, r: 11 },
    { x: 176, y: 108, r: 9 },
    { x: 196, y: 168, r: 12 },
    { x: 132, y: 190, r: 8 },
    { x: 160, y: 150, r: 10 },
  ];
  let grind = $state(0);
  let grinding = $state(false);
  let found = $state<boolean[]>([]);
  const ground = $derived(grind >= 1);
  const allFound = $derived(found.length > 0 && found.every(Boolean));
  let berryButtons = $state<(SVGGElement | null)[]>([]);

  // ---- The calls ----
  const CALLS = 5;
  let calls = $state(0);
  let listening = $state(false);
  let rings = $state<number[]>([]);

  // ---- The report ----
  let needles = $state(false);

  function reset(): void {
    grind = 0;
    grinding = false;
    found = BERRIES.map(() => false);
    calls = 0;
    listening = false;
    rings = [];
    needles = false;
    window.setTimeout(() => (needles = true), 200);
  }

  function findBerry(i: number): void {
    if (!ground || found[i]) return;
    found[i] = true;
    sfx("microscope-focus");
    if (found.every(Boolean)) finish(1600);
    else berryButtons[found.findIndex((f) => !f)]?.focus({ preventScroll: true });
  }

  function findNext(): void {
    const i = found.findIndex((f) => !f);
    if (i >= 0) findBerry(i);
  }

  function call(): void {
    if (listening || calls >= CALLS) return;
    calls += 1;
    listening = true;
    sfx("call-blip");
    window.setTimeout(() => sfx("call-blip"), 180);
    rings = [...rings, performance.now()];
    window.setTimeout(() => {
      listening = false;
      if (calls >= CALLS) finish(900);
    }, 2100);
  }

  /** The one button for each game: E, Enter, Space, a click or the gamepad's A. */
  function press(down: boolean): void {
    if (!game) return;
    if (game.id === "blueberries") {
      if (!ground) grinding = down;
      else if (down) findNext();
    } else if (down && game.id === "calls") call();
    else if (down && game.id === "telemetry") finish();
  }

  // Grinding fills while the button is held.
  $effect(() => {
    if (!game || game.id !== "blueberries" || ground) return;
    let frame = 0;
    let last = performance.now();
    let buzz = 0;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!grinding) return;
      grind = Math.min(1, grind + dt / 1.6);
      buzz -= dt;
      if (buzz <= 0) {
        sfx("servo");
        buzz = 0.35;
      }
      if (grind >= 1) {
        grinding = false;
        sfx("microscope-focus");
        window.setTimeout(() => berryButtons[0]?.focus({ preventScroll: true }), 50);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // Keys and the gamepad.
  $effect(() => {
    if (!game) return;
    const shownAt = performance.now();
    const ready = (): boolean => performance.now() - shownAt > 450;
    const isKey = (e: KeyboardEvent): boolean => e.code === "KeyE" || e.code === "Enter" || e.code === "Space";
    const onDown = (e: KeyboardEvent): void => {
      if (!isKey(e) || !ready()) return;
      // A focused blueberry answers its own Enter and Space.
      if (e.code !== "KeyE" && (e.target as Element | null)?.closest?.(".berry")) return;
      e.preventDefault();
      if (e.repeat) return;
      press(true);
    };
    const onUp = (e: KeyboardEvent): void => {
      if (isKey(e)) press(false);
    };
    let frame = 0;
    let wasDown = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g);
      const down = Boolean(pad?.buttons[0]?.pressed);
      if (down !== wasDown && ready()) press(down);
      wasDown = down;
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      cancelAnimationFrame(frame);
    };
  });

  /** A dial's needle angle: 0 is empty (far left), 1 is full (far right). */
  const needle = (value: number): number => -90 + value * 180;
</script>

{#if game}
  {#key game.key}
    <div class="game {game.id}" role="dialog" aria-live="polite" aria-label={game.id === "blueberries" ? "The rock grinder" : game.id === "calls" ? "Call the rover" : "The rover's last report"}>
      {#if game.id === "blueberries"}
        <p class="from"><span class="pin" aria-hidden="true"></span>Rock grinder</p>
        <p class="ask">{!ground ? "Hold to grind a little circle into the rock." : allFound ? "You found them all!" : "Look inside. Find the little round blueberries."}</p>
        <svg class="lens" viewBox="0 0 300 300" aria-hidden={!ground}>
          <defs>
            <clipPath id="lens-clip"><circle cx="150" cy="150" r="138" /></clipPath>
            <radialGradient id="berry-shine" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stop-color="#8C8AA0" />
              <stop offset="0.45" stop-color="#4A4658" />
              <stop offset="1" stop-color="#2A2632" />
            </radialGradient>
          </defs>
          <g clip-path="url(#lens-clip)">
            <!-- The rock face in stripes: layers laid down long ago. -->
            {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
              <rect x="0" y={i * 26 - 4} width="300" height="27" fill={i % 3 === 0 ? "#B97A52" : i % 3 === 1 ? "#A4643F" : "#C88B5E"} transform="rotate(-8 150 150)" />
            {/each}
            {#each Array.from({ length: 40 }, (_, i) => i) as i (i)}
              <circle cx={(i * 73) % 300} cy={(i * 131) % 300} r={1 + (i % 3)} fill="#7A4630" opacity="0.45" />
            {/each}
            <!-- The grinder's circle: fresh, darker rock where the dust is scraped off. -->
            <circle cx="158" cy="150" r={96 * Math.min(1, grind * 1.05)} fill="#7E4A34" />
            <circle cx="158" cy="150" r={96 * Math.min(1, grind * 1.05)} fill="none" stroke="#5E3424" stroke-width="5" opacity={grind > 0 ? 0.8 : 0} />
            {#if ground}
              {#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
                <path d="M {80 + i * 18} {70 + (i % 3) * 8} q 20 6 40 0" stroke="#6A3A28" stroke-width="2" fill="none" opacity="0.6" />
              {/each}
              {#each BERRIES as berry, i (i)}
                <g
                  class="berry"
                  class:found={found[i]}
                  role="button"
                  tabindex="0"
                  aria-label={found[i] ? "Found a blueberry" : "A little round stone"}
                  bind:this={berryButtons[i]}
                  onclick={() => findBerry(i)}
                  onkeydown={(e) => {
                    if (e.code === "Enter" || e.code === "Space") {
                      e.preventDefault();
                      e.stopPropagation();
                      findBerry(i);
                    }
                  }}
                >
                  <circle cx={berry.x} cy={berry.y} r={berry.r + 14} fill="transparent" />
                  <circle cx={berry.x} cy={berry.y} r={berry.r} fill="url(#berry-shine)" />
                  <circle class="ring" cx={berry.x} cy={berry.y} r={berry.r + 7} fill="none" />
                </g>
              {/each}
            {/if}
          </g>
          <circle cx="150" cy="150" r="138" fill="none" stroke="#2B2622" stroke-width="7" />
          <circle cx="150" cy="150" r="128" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-dasharray="60 400" transform="rotate(-140 150 150)" />
        </svg>
        <div class="row">
          <p class="dots" aria-label="Blueberries found">{#each found as f, i (i)}<b class:on={f}></b>{/each}</p>
          {#if !ground}
            <button
              type="button"
              class="btn amber"
              onpointerdown={() => (grinding = true)}
              onpointerup={() => (grinding = false)}
              onpointerleave={() => (grinding = false)}
            >
              <span class="fill" style="width: {grind * 100}%"></span>
              <span class="label">Hold to grind <kbd>E</kbd></span>
            </button>
          {/if}
        </div>
      {:else if game.id === "telemetry"}
        <p class="from"><span class="pin" aria-hidden="true"></span>The rover's last report</p>
        <p class="ask">The rover sent home what it could feel. Then it went quiet.</p>
        <div class="dials">
          {#each [{ label: "Power", word: "Very low", value: 0.06 }, { label: "Sunlight", word: "Very dark sky", value: 0.04 }] as dial (dial.label)}
            <figure class="dial">
              <svg viewBox="0 0 200 120" aria-hidden="true">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E4D7BE" stroke-width="18" stroke-linecap="round" />
                <path d="M 20 100 A 80 80 0 0 1 52 37" fill="none" stroke="#C0573E" stroke-width="18" stroke-linecap="round" />
                {#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
                  <line x1="100" y1="34" x2="100" y2="44" stroke="#62574D" stroke-width="2" transform="rotate({-80 + i * 20} 100 100)" />
                {/each}
                <g class="needle" style="transform: rotate({needle(needles ? dial.value : 0.92)}deg)">
                  <line x1="100" y1="100" x2="100" y2="32" stroke="#2B2622" stroke-width="4" stroke-linecap="round" />
                </g>
                <circle cx="100" cy="100" r="9" fill="#2B2622" />
                {#if dial.label === "Sunlight"}
                  <circle cx="168" cy="26" r="11" fill="#F2A541" opacity="0.25" />
                  <circle cx="168" cy="26" r="16" fill="#8E6A4E" opacity="0.45" />
                {:else}
                  <rect x="156" y="16" width="26" height="14" rx="3" fill="none" stroke="#62574D" stroke-width="2.5" />
                  <rect x="182" y="20" width="4" height="6" fill="#62574D" />
                  <rect x="159" y="19" width="4" height="8" fill="#C0573E" />
                {/if}
              </svg>
              <figcaption><span>{dial.label}</span><strong>{dial.word}</strong></figcaption>
            </figure>
          {/each}
        </div>
        <button type="button" class="btn amber got" onclick={() => finish()}>Got it <kbd>E</kbd></button>
      {:else if game.id === "calls"}
        <p class="from"><span class="pin" aria-hidden="true"></span>Call the rover</p>
        <p class="ask">{calls === 0 ? "Send a call across the storm." : listening ? "Listening..." : calls >= CALLS ? "Still no answer." : "No answer yet. Try again?"}</p>
        <svg class="radio" viewBox="0 0 420 150" aria-hidden="true">
          <!-- Our dish on the left, the dusty rover far away on the right. -->
          <path d="M 30 120 l 22 -40 l 22 40 z" fill="#8C8173" />
          <path d="M 18 70 q 34 34 68 0" fill="#E9E3D6" stroke="#2B2622" stroke-width="3" transform="rotate(-25 52 70)" />
          <line x1="52" y1="74" x2="66" y2="56" stroke="#2B2622" stroke-width="3" />
          {#each rings as born (born)}
            <path class="wave" d="M 0 -30 a 30 30 0 0 1 0 60" fill="none" stroke="#5C7393" stroke-width="4" stroke-linecap="round" />
          {/each}
          <g transform="translate(350 96)" opacity="0.75">
            <rect x="-26" y="-14" width="52" height="16" rx="3" fill="#B8714A" />
            <rect x="-34" y="-20" width="68" height="7" rx="2" fill="#9A5B3A" />
            <circle cx="-20" cy="6" r="7" fill="#7A4A36" /><circle cx="0" cy="6" r="7" fill="#7A4A36" /><circle cx="20" cy="6" r="7" fill="#7A4A36" />
            <line x1="12" y1="-20" x2="12" y2="-42" stroke="#9A5B3A" stroke-width="3" />
            <rect x="2" y="-48" width="20" height="8" rx="2" fill="#9A5B3A" />
          </g>
          {#each Array.from({ length: 26 }, (_, i) => i) as i (i)}
            <circle class="mote" cx={110 + ((i * 97) % 220)} cy={20 + ((i * 53) % 110)} r={2 + (i % 3)} fill="#A8714C" style="animation-delay: {(i % 7) * -0.6}s" />
          {/each}
        </svg>
        <div class="row">
          <p class="dots" aria-label="Calls sent">{#each Array.from({ length: CALLS }, (_, i) => i) as i (i)}<b class:on={calls > i}></b>{/each}</p>
          <button type="button" class="btn amber" disabled={listening || calls >= CALLS} onclick={call}>Send a call <kbd>E</kbd></button>
        </div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .game {
    position: fixed;
    left: 50%;
    top: 50%;
    width: min(520px, calc(100vw - 32px));
    padding: 22px 28px 20px;
    transform: translate(-50%, -50%) rotate(-0.6deg);
    color: var(--ink);
    background: var(--grain), var(--card);
    border-top: 6px solid var(--clay);
    box-shadow: var(--shadow-card);
    animation: drop 0.5s var(--ease-spring);
    z-index: 30;
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
  .pin {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--clay);
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.25);
  }
  .ask {
    margin: 0 0 12px;
    font: 400 1.15rem/1.4 var(--read);
    min-height: 1.6em;
  }
  .lens {
    display: block;
    width: min(300px, 70vw);
    margin: 0 auto;
    filter: drop-shadow(0 8px 10px rgba(14, 8, 4, 0.35));
  }
  .berry {
    cursor: pointer;
    outline: none;
  }
  .berry .ring {
    stroke: var(--amber);
    stroke-width: 4;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .berry:hover .ring,
  .berry:focus-visible .ring {
    opacity: 0.6;
    stroke-dasharray: 6 5;
  }
  .berry.found .ring {
    opacity: 1;
    stroke: #fff4d6;
    stroke-dasharray: none;
    animation: pop 0.4s var(--ease-spring);
    transform-box: fill-box;
    transform-origin: center;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 14px;
  }
  .dots {
    margin: 0;
    display: flex;
    gap: 7px;
  }
  .dots b {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--pencil);
  }
  .dots b.on {
    background: #4a4658;
    border-color: var(--ink);
  }
  .calls .dots b.on {
    background: var(--sky);
  }
  .btn {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    user-select: none;
    touch-action: none;
  }
  .btn .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: rgba(184, 102, 28, 0.35);
  }
  .btn .label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .btn:disabled {
    opacity: 0.55;
  }
  .got {
    display: flex;
    margin: 14px 0 0 auto;
  }
  kbd {
    font: 700 0.8rem/1 var(--label);
    padding: 3px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    opacity: 0.7;
  }
  .dials {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .dial {
    margin: 0;
    padding: 10px 10px 8px;
    background: var(--card-sunk);
    border-radius: var(--radius);
  }
  .dial svg {
    display: block;
    width: 100%;
  }
  .needle {
    transform-origin: 100px 100px;
    transition: transform 2.4s cubic-bezier(0.5, 0, 0.3, 1);
  }
  figcaption {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  figcaption span {
    font: 700 0.75rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  figcaption strong {
    font: 700 1.25rem/1.2 var(--hand);
    color: var(--clay-deep);
  }
  .radio {
    display: block;
    width: 100%;
    background: linear-gradient(#5a3a2a, #7a5038);
    border-radius: var(--radius);
  }
  .wave {
    transform: translate(70px, 64px);
    animation: wave 2s var(--ease-out) forwards;
  }
  .mote {
    animation: drift 3.5s linear infinite;
  }
  @keyframes wave {
    from {
      transform: translate(70px, 64px) scale(0.6);
      opacity: 1;
    }
    to {
      transform: translate(300px, 64px) scale(1.6);
      opacity: 0;
    }
  }
  @keyframes drift {
    from {
      transform: translateX(14px);
    }
    to {
      transform: translateX(-14px);
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
    }
  }
  @keyframes drop {
    from {
      opacity: 0;
      translate: 0 30px;
    }
  }
  :global(:root[data-motion="reduce"]) .game,
  :global(:root[data-motion="reduce"]) .mote,
  :global(:root[data-motion="reduce"]) .needle {
    animation: none;
    transition: none;
  }
</style>
