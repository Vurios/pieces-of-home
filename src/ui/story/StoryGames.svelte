<script lang="ts">
  import { audio } from "../../audio/audio";
  import { fact } from "../../content/facts";
  import type { Engine } from "../../game/engine";
  import CardHead from "./card/CardHead.svelte";
  import GameAsk from "./card/GameAsk.svelte";
  import GameSteps from "./card/GameSteps.svelte";

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
      // The Finale's games have their own screens (DishGame, FinaleGames).
      if (!["blueberries", "telemetry", "calls"].includes(p.id)) return;
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
  const berryFact = fact("opp-blueberries");
  const lastFact = fact("opp-last-contact");
</script>

{#if game}
  <div class="gc-scrim"></div>
  {#key game.key}
    <div class="game {game.id} gc gc-mars" role="dialog" aria-label={game.id === "blueberries" ? "The rock grinder" : game.id === "calls" ? "Call the rover" : "The rover's last report"}>
      {#if game.id === "blueberries"}
        <CardHead kicker="The rover's rock grinder" title="What is hiding in the rock?" stamp="Model">
          {#snippet badge()}
            <svg viewBox="-22 -22 44 44">
              <circle r="15" fill="#B97A52" stroke="#2B2622" stroke-width="2.2" />
              <circle r="9" fill="#7E4A34" stroke="#5E3424" stroke-width="1.6" />
              <circle cx="-3" cy="-2" r="2.6" fill="#4A4658" />
              <circle cx="3.5" cy="2.5" r="2.2" fill="#4A4658" />
              <path d="M10 -16 L18 -8 M14 -18 L20 -12" stroke="#8E8B86" stroke-width="2.6" stroke-linecap="round" />
            </svg>
          {/snippet}
        </CardHead>
        <div class="gc-body">
          <GameAsk text={!ground ? "Hold the button to grind a little circle into the rock." : allFound ? "You found them all!" : "Look inside. Tap the little round blueberries."} tone={allFound ? "good" : null} />
          <div class="gc-split">
            <div class="gc-stage scope">
              <svg class="lens" viewBox="0 0 300 300" aria-hidden={!ground}>
                <defs>
                  <clipPath id="lens-clip"><circle cx="150" cy="150" r="138" /></clipPath>
                  <radialGradient id="berry-shine" cx="0.35" cy="0.35" r="0.7">
                    <stop offset="0" stop-color="#8C8AA0" />
                    <stop offset="0.45" stop-color="#4A4658" />
                    <stop offset="1" stop-color="#2A2632" />
                  </radialGradient>
                  <radialGradient id="lens-edge" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0.78" stop-color="#000" stop-opacity="0" />
                    <stop offset="1" stop-color="#1E120C" stop-opacity="0.55" />
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
                  {#if grinding}
                    {#each [0, 1, 2, 3, 4, 5] as i (i)}<circle class="chip-fly" cx={158 + Math.cos(i) * 60 * grind} cy={150 + Math.sin(i * 1.7) * 60 * grind} r="3" fill="#D9A27A" style:animation-delay="{i * 0.08}s" />{/each}
                  {/if}
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
                  <circle cx="150" cy="150" r="138" fill="url(#lens-edge)" pointer-events="none" />
                </g>
                <circle cx="150" cy="150" r="141" fill="none" stroke="#C9A24E" stroke-width="8" />
                <circle cx="150" cy="150" r="145" fill="none" stroke="#2B2622" stroke-width="2.5" />
                <circle cx="150" cy="150" r="137" fill="none" stroke="#2B2622" stroke-width="2" />
                <circle cx="150" cy="150" r="128" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" stroke-dasharray="60 400" transform="rotate(-140 150 150)" pointer-events="none" />
              </svg>
            </div>
            <div class="gc-side">
              <div class="gc-group">
                <p class="gc-label">Blueberries found</p>
                <p class="berries" aria-label="Blueberries found">{#each found as f, i (i)}<b class:on={f}></b>{/each}</p>
              </div>
              <div class="gc-group">
                <p class="gc-label">What are they?</p>
                <p class="gc-hint side-note">{berryFact.kid}</p>
              </div>
            </div>
          </div>
          <div class="gc-foot">
            <GameSteps steps={[{ label: "Grind the rock", done: ground }, { label: "Find the blueberries", done: allFound }]} />
            {#if !ground}
              <div class="gc-actions">
                <button type="button" class="btn amber hold" onpointerdown={() => (grinding = true)} onpointerup={() => (grinding = false)} onpointerleave={() => (grinding = false)}>
                  <span class="fill" style="width: {grind * 100}%"></span>
                  <span class="label">Hold to grind <kbd>E</kbd></span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      {:else if game.id === "telemetry"}
        <CardHead kicker="The rover's last report" title="What the rover could feel">
          {#snippet badge()}
            <svg viewBox="-22 -22 44 44">
              <path d="M-16 6 A16 16 0 0 1 16 6" fill="none" stroke="#E4D7BE" stroke-width="6" />
              <path d="M-16 6 A16 16 0 0 1 -11 -5" fill="none" stroke="#C0573E" stroke-width="6" />
              <path d="M0 6 L-12 -2" stroke="#2B2622" stroke-width="2.6" stroke-linecap="round" />
              <circle cy="6" r="3.4" fill="#2B2622" />
            </svg>
          {/snippet}
        </CardHead>
        <div class="gc-body">
          <GameAsk text="It sent its last report home. Then it went quiet." />
          <div class="gc-stage panel">
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
            {#each ["tl", "tr", "bl", "br"] as corner (corner)}<i class="screw {corner}"></i>{/each}
          </div>
          <div class="gc-foot">
            <p class="gc-hint">{lastFact.kid}</p>
            <div class="gc-actions"><button type="button" class="btn amber got" onclick={() => finish()}>Got it <kbd>E</kbd></button></div>
          </div>
        </div>
      {:else if game.id === "calls"}
        <CardHead kicker="Call the rover" title="Send a call across the storm">
          {#snippet badge()}
            <svg viewBox="-22 -22 44 44">
              <path d="M-15 2 A15 15 0 0 0 11 -10 Z" fill="#ECE5D7" stroke="#2B2622" stroke-width="2.2" stroke-linejoin="round" />
              <path d="M-4 6 L-8 17 H5 L1 6" fill="#8E8B86" stroke="#2B2622" stroke-width="2" stroke-linejoin="round" />
              <path d="M8 -16 q 5 3 5 8 M12 -20 q 8 4 8 13" fill="none" stroke="#5C7393" stroke-width="2.4" stroke-linecap="round" />
            </svg>
          {/snippet}
        </CardHead>
        <div class="gc-body">
          <GameAsk text={calls === 0 ? "Send a call across the storm." : listening ? "Listening..." : calls >= CALLS ? "Still no answer. It is resting now." : "No answer yet. Try again?"} />
          <div class="gc-stage storm">
            <svg class="radio" viewBox="0 0 560 220" aria-hidden="true">
              <defs>
                <linearGradient id="storm-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#6E4632" />
                  <stop offset="1" stop-color="#B07A52" />
                </linearGradient>
              </defs>
              <rect width="560" height="220" fill="url(#storm-sky)" />
              <!-- The dust storm, rolling between us and the rover. -->
              {#each [0, 1, 2] as i (i)}<ellipse class="cloud" cx={250 + i * 90} cy={80 + i * 18} rx="130" ry="46" fill="#C08452" opacity={0.28 - i * 0.05} style:animation-delay="{i * -2}s" />{/each}
              <path d="M0 184 Q140 168 280 182 T560 176 V220 H0 Z" fill="#8E5A3A" />
              <path d="M0 196 Q160 186 320 196 T560 192 V220 H0 Z" fill="#7A4A30" />
              <!-- Our dish on the left. -->
              <g transform="translate(70 184)">
                <path d="M-22 0 L0 -44 L22 0 Z" fill="#8C8173" stroke="#2B2622" stroke-width="2.5" stroke-linejoin="round" />
                <path d="M-40 -60 q 40 40 80 0" fill="#E9E3D6" stroke="#2B2622" stroke-width="3" transform="rotate(-25 0 -50)" />
                <line x1="0" y1="-48" x2="18" y2="-70" stroke="#2B2622" stroke-width="3" />
                <circle cx="19" cy="-72" r="4" fill="#C8553D" stroke="#2B2622" stroke-width="1.5" />
              </g>
              {#each rings as born (born)}
                <path class="wave" d="M 0 -34 a 34 34 0 0 1 0 68" fill="none" stroke="#FFF2D6" stroke-width="4" stroke-linecap="round" />
              {/each}
              <!-- The dusty rover, far away and asleep. -->
              <g transform="translate(470 172)" opacity="0.78">
                <rect x="-28" y="-14" width="56" height="16" rx="3" fill="#B8714A" stroke="#5E3424" stroke-width="1.5" />
                <rect x="-38" y="-21" width="76" height="7" rx="2" fill="#9A5B3A" />
                <circle cx="-22" cy="6" r="7.5" fill="#7A4A36" /><circle cx="0" cy="6" r="7.5" fill="#7A4A36" /><circle cx="22" cy="6" r="7.5" fill="#7A4A36" />
                <line x1="14" y1="-21" x2="14" y2="-44" stroke="#9A5B3A" stroke-width="3" />
                <rect x="4" y="-50" width="22" height="8" rx="2" fill="#9A5B3A" />
                <text x="34" y="-40" class="zzz">z z</text>
              </g>
              {#each Array.from({ length: 34 }, (_, i) => i) as i (i)}
                <circle class="mote" cx={130 + ((i * 97) % 300)} cy={20 + ((i * 53) % 160)} r={2 + (i % 3)} fill="#E0B088" opacity="0.7" style="animation-delay: {(i % 7) * -0.6}s" />
              {/each}
            </svg>
          </div>
          <div class="gc-foot">
            <div class="sent-calls">
              <span class="gc-label">Calls sent</span>
              <p class="dots" aria-label="Calls sent">{#each Array.from({ length: CALLS }, (_, i) => i) as i (i)}<b class:on={calls > i}></b>{/each}</p>
            </div>
            <div class="gc-actions"><button type="button" class="btn amber" disabled={listening || calls >= CALLS} onclick={call}>Send a call <kbd>E</kbd></button></div>
          </div>
        </div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .game.blueberries {
    --gc-w: 760px;
  }
  .game.telemetry {
    --gc-w: 700px;
  }
  .game.calls {
    --gc-w: 760px;
  }
  .scope {
    display: grid;
    place-items: center;
    padding: 14px;
    background: radial-gradient(circle at 50% 45%, #4a3a32, #241a16 75%);
  }
  .lens {
    display: block;
    width: min(320px, 70vw);
    filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.5));
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
  .chip-fly {
    transform-box: fill-box;
    transform-origin: center;
    animation: chip 0.5s ease-out infinite;
  }
  @keyframes chip {
    to {
      transform: translate(10px, -14px) scale(0.3);
      opacity: 0;
    }
  }
  .berries {
    display: flex;
    gap: 8px;
    margin: 0;
  }
  .berries b {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px dashed var(--pencil);
  }
  .berries b.on {
    background: radial-gradient(circle at 35% 35%, #8c8aa0, #4a4658 45%, #2a2632);
    border: 2px solid var(--ink);
    animation: pop 0.4s var(--ease-spring);
  }
  .side-note {
    margin: 0;
  }
  .hold {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    user-select: none;
    touch-action: none;
  }
  .hold .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: rgba(184, 102, 28, 0.35);
  }
  .hold .label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .btn:disabled {
    opacity: 0.55;
  }
  .panel {
    padding: 22px 22px 16px;
    background: linear-gradient(#e9e1d2, #d8ccb7);
  }
  .screw {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #d8d2c6, #8e8b86);
    border: 1.5px solid var(--ink);
  }
  .screw.tl,
  .screw.tr {
    top: 8px;
  }
  .screw.bl,
  .screw.br {
    bottom: 8px;
  }
  .screw.tl,
  .screw.bl {
    left: 8px;
  }
  .screw.tr,
  .screw.br {
    right: 8px;
  }
  .dials {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .dial {
    margin: 0;
    padding: 10px 10px 8px;
    background: #fbf6ec;
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: inset 0 3px 0 rgba(43, 38, 34, 0.12);
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
    font: 700 1.3rem/1.2 var(--hand);
    color: var(--clay-deep);
  }
  .storm {
    background: #6e4632;
  }
  .zzz {
    fill: #fff2d6;
    font: 700 14px/1 var(--hand);
    opacity: 0.8;
  }
  .cloud {
    animation: roll 9s ease-in-out infinite alternate;
  }
  @keyframes roll {
    to {
      transform: translateX(-40px);
    }
  }
  .wave {
    transform: translate(90px, 128px);
    animation: wave 2s var(--ease-out) forwards;
  }
  .mote {
    animation: drift 3.5s linear infinite;
  }
  @keyframes wave {
    from {
      transform: translate(90px, 128px) scale(0.6);
      opacity: 1;
    }
    to {
      transform: translate(420px, 128px) scale(1.7);
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
  .sent-calls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sent-calls .gc-label {
    margin: 0;
  }
  .dots {
    margin: 0;
    display: flex;
    gap: 7px;
  }
  .dots b {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--pencil);
  }
  .dots b.on {
    background: var(--sky);
    border-color: var(--ink);
  }
  @keyframes pop {
    from {
      transform: scale(0.6);
    }
  }
  :global(:root[data-motion="reduce"]) .mote,
  :global(:root[data-motion="reduce"]) .cloud,
  :global(:root[data-motion="reduce"]) .chip-fly,
  :global(:root[data-motion="reduce"]) .needle {
    animation: none;
    transition: none;
  }
</style>
