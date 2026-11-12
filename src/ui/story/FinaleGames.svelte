<script lang="ts">
  import { untrack } from "svelte";
  import { audio } from "../../audio/audio";
  import { CHAPTERS } from "../../content/chapters";
  import { NAME_WORDS, STAMP } from "../../content/finale";
  import { SPREADS, isComplete } from "../../content/notebook";
  import credits from "../../data/credits.json";
  import factData from "../../data/facts.json";
  import type { Engine } from "../../game/engine";
  import { keepPhoto, readPhotos } from "../photos";
  import { banners } from "../hud/banners.svelte";
  import { settings } from "../settings.svelte";
  import { type LastPage, readLastPage, writeLastPage } from "./last-page";

  /**
   * The Finale's three screens, as story games (see StoryGames.svelte for the
   * protocol: "story:game" in, "story:game-done" out).
   *
   * - photos: Milo's lamp head becomes a little projector and shows the photos
   *   Remi took (or the stamps, if there are no photos yet).
   * - lastpage: the notebook's last page. A group photo, a favorite-discovery
   *   sticker, and a name for the next adventure from word chips. No typing,
   *   and nothing leaves this device.
   * - ending: the closing picture, then the credits roll. Skippable.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  const IDS = ["photos", "lastpage", "ending"];
  let game = $state<{ key: number; id: string } | null>(null);

  $effect(() =>
    engine.bus.on("story:game", (p) => {
      if (!IDS.includes(p.id)) return;
      game = { key: p.key, id: p.id };
      if (p.id === "photos") startShow();
      if (p.id === "lastpage") startPage();
      if (p.id === "ending") startEnding();
      audio.ui("page");
    }),
  );

  function finish(): void {
    if (!game) return;
    const key = game.key;
    game = null;
    audio.ui("tick");
    engine.bus.emit("story:game-done", { key });
  }

  // ---------- photos ----------
  type Slide = { kind: "photo"; src: string } | { kind: "stamp"; lines: [string, string] };
  let slides = $state<Slide[]>([]);
  let slide = $state(0);
  let showTimer = 0;
  function startShow(): void {
    const photos = readPhotos().slice(-8);
    const s = engine.store.value;
    slides = photos.length
      ? photos.map((p) => ({ kind: "photo" as const, src: p.data }))
      : [
          ...(s.stamps.includes("prologue") ? [{ kind: "stamp" as const, lines: ["Left on.", "Still shining."] as [string, string] }] : []),
          ...CHAPTERS.filter((c) => s.stamps.includes(c.id)).map((c) => ({ kind: "stamp" as const, lines: c.stamp })),
        ];
    slide = 0;
    advance();
  }
  function advance(): void {
    window.clearTimeout(showTimer);
    if (!game || game.id !== "photos") return;
    showTimer = window.setTimeout(
      () => {
        if (slide < slides.length - 1) {
          slide += 1;
          engine.bus.emit("sfx", { name: "polaroid-whirr", level: 0.35 });
          advance();
        }
      },
      settings.reducedMotion ? 3200 : 2800,
    );
  }
  const lastSlide = $derived(slide >= slides.length - 1);

  // ---------- last page ----------
  let page = $state<LastPage>({ sticker: null, first: null, second: null, photoAt: null });
  let snapping = $state(false);
  let shot = $state<string | null>(null);
  const stickers = $derived.by(() => {
    const s = engine.store.value;
    return SPREADS.filter((spread) => isComplete(spread, s)).map((spread) => ({ id: spread.id, label: spread.nickname }));
  });
  function startPage(): void {
    page = readLastPage() ?? { sticker: null, first: null, second: null, photoAt: null };
    shot = null;
  }
  async function snap(): Promise<void> {
    if (snapping) return;
    snapping = true;
    engine.bus.emit("sfx", { name: "shutter" });
    try {
      const data = engine.snapshot("image/jpeg", 0.85);
      shot = data;
      await keepPhoto(data);
      page = { ...page, photoAt: readPhotos().at(-1)?.at ?? null };
    } finally {
      snapping = false;
    }
  }
  function donePage(): void {
    writeLastPage(page);
    finish();
  }
  const adventure = $derived(page.first && page.second ? `${page.first} ${page.second}` : null);

  // ---------- ending ----------
  let scene = $state<"picture" | "credits">("picture");
  let roll = $state<HTMLElement | null>(null);
  let endTimer = 0;
  function startEnding(): void {
    scene = "picture";
    window.clearTimeout(endTimer);
    endTimer = window.setTimeout(() => (scene = "credits"), settings.reducedMotion ? 4000 : 7000);
  }
  // The credits scroll by themselves; the wheel or a drag still works.
  $effect(() => {
    if (!game || game.id !== "ending" || scene !== "credits" || !roll || settings.reducedMotion) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      if (!roll) return;
      carry += ((now - last) / 1000) * 34;
      last = now;
      if (carry >= 1) {
        roll.scrollTop += Math.floor(carry);
        carry -= Math.floor(carry);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
  // The four friends in the closing picture: Remi with the backpack, then Nori, Lumi and Theo.
  const FRIENDS = [
    { x: 330, c: "#C8553D", h: 0, skin: "#C98B62", hair: "messy", hc: "#2A2030", pack: true },
    { x: 384, c: "#5E8BB0", h: 6, skin: "#E9B98F", hair: "curls", hc: "#C8743A", pack: false },
    { x: 436, c: "#E0B34A", h: -4, skin: "#8E5A3C", hair: "bun", hc: "#2E2230", pack: false },
    { x: 488, c: "#7FA36B", h: 3, skin: "#F0C9A0", hair: "cap", hc: "#3E5A7A", pack: false },
  ];
  const ENDING_STARS = Array.from({ length: 46 }, (_, i) => {
    const r = (n: number): number => {
      const x = Math.sin(i * 91.7 + n * 17.3) * 43758.5453;
      return x - Math.floor(x);
    };
    return { x: r(1) * 800, y: r(2) * 230, r: 0.8 + r(3) * 1.6, o: 0.35 + r(4) * 0.6, d: r(5) * 4 };
  });

  const sources = [...new Map((factData.facts as { sourceTitle: string; sourceUrl: string; status: string }[]).filter((f) => f.status === "checked").map((f) => [f.sourceTitle, f])).values()];
  const mediaCredits = [...new Set(credits.media.map((m) => m.credit))];
  const dataCredits = (credits as { data?: { name: string; by: string }[] }).data ?? [];

  // ---------- keys and the gamepad: E, Enter, Space, A ----------
  $effect(() => {
    if (!game) return;
    const id = game.id;
    engine.holdStill += 1;
    // Untracked: this effect must not re-run because it changed the count itself.
    untrack(() => (banners.screens += 1));
    const shownAt = performance.now();
    const go = (): void => {
      if (performance.now() - shownAt < 500) return;
      if (id === "photos") {
        if (lastSlide) finish();
        else {
          slide += 1;
          advance();
        }
      } else if (id === "ending") {
        if (scene === "picture") scene = "credits";
        else finish();
      }
    };
    const onDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.code === "KeyE" || ((e.code === "Enter" || e.code === "Space") && !(e.target as Element | null)?.closest?.("button"))) {
        if (id === "lastpage") return;
        e.preventDefault();
        e.stopPropagation();
        go();
      }
    };
    let frame = 0;
    let was = true;
    const poll = (): void => {
      frame = requestAnimationFrame(poll);
      const down = Boolean(navigator.getGamepads?.().find((g) => g)?.buttons[0]?.pressed);
      if (down && !was && id !== "lastpage") go();
      was = down;
    };
    window.addEventListener("keydown", onDown, true);
    frame = requestAnimationFrame(poll);
    return () => {
      engine.holdStill = Math.max(0, engine.holdStill - 1);
      banners.screens = Math.max(0, banners.screens - 1);
      window.removeEventListener("keydown", onDown, true);
      cancelAnimationFrame(frame);
      window.clearTimeout(showTimer);
      window.clearTimeout(endTimer);
    };
  });
</script>

{#if game}
  {#key game.key}
    {#if game.id === "photos"}
      <div class="scrim" aria-hidden="true"></div>
      <div class="show" role="dialog" aria-modal="true" aria-label="Milo's projector">
        <div class="beam" aria-hidden="true"></div>
        <div class="screen">
          {#each slides as s, i (i)}
            {#if i === slide}
              <div class="frame">
                {#if s.kind === "photo"}
                  <img src={s.src} alt={`From the trip, ${i + 1} of ${slides.length}`} />
                {:else}
                  <div class="inkstamp" role="img" aria-label={s.lines.join(" ")}><span>{s.lines[0]}</span><span>{s.lines[1]}</span></div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
        <p class="caption">{slides[0]?.kind === "photo" ? "Your trip, by you." : "No photos yet. Milo shows your stamps instead."}</p>
        <div class="row">
          <p class="dots" aria-hidden="true">{#each slides as _, i (i)}<b class:on={i <= slide}></b>{/each}</p>
          <button
            type="button"
            class="btn amber"
            onclick={() => {
              if (lastSlide) finish();
              else {
                slide += 1;
                advance();
              }
            }}>{lastSlide ? "Got it" : "Next"} <kbd>E</kbd></button
          >
        </div>
      </div>
    {:else if game.id === "lastpage"}
      <div class="scrim" aria-hidden="true"></div>
      <div class="page" role="dialog" aria-modal="true" aria-labelledby="last-page-title">
        <span class="tape" aria-hidden="true"></span>
        <h2 id="last-page-title">What will you discover next?</h2>
        <p class="sub">The last page of Dad's notebook. Fill it in. It stays on this device.</p>
        <section>
          <h3>A group photo</h3>
          <div class="photo-row">
            {#if shot}
              <figure class="polaroid"><img src={shot} alt="Your group in the workshop" /></figure>
            {/if}
            <button type="button" class="btn" onclick={snap} disabled={snapping}>{shot ? "Take another" : "Take a group photo"}</button>
          </div>
        </section>
        <section>
          <h3>Your favorite discovery</h3>
          <div class="chips" role="radiogroup" aria-label="Your favorite discovery">
            {#each stickers as s (s.id)}
              <button type="button" class="chip sticker" role="radio" aria-checked={page.sticker === s.id} onclick={() => (page = { ...page, sticker: s.id })}>{s.label}</button>
            {/each}
          </div>
        </section>
        <section>
          <h3>Name your next adventure</h3>
          <div class="chips" role="radiogroup" aria-label="First word">
            {#each NAME_WORDS[0] as w (w)}
              <button type="button" class="chip" role="radio" aria-checked={page.first === w} onclick={() => (page = { ...page, first: w })}>{w}</button>
            {/each}
          </div>
          <div class="chips" role="radiogroup" aria-label="Second word">
            {#each NAME_WORDS[1] as w (w)}
              <button type="button" class="chip" role="radio" aria-checked={page.second === w} onclick={() => (page = { ...page, second: w })}>{w}</button>
            {/each}
          </div>
          <p class="name" aria-live="polite">{adventure ?? "Pick two words."}</p>
        </section>
        <div class="foot">
          <button type="button" class="btn amber" onclick={donePage}>Done</button>
        </div>
      </div>
    {:else if game.id === "ending"}
      <div class="ending" role="dialog" aria-modal="true" aria-label="The end">
        {#if scene === "picture"}
          <div class="picture">
            <svg viewBox="0 0 800 420" aria-hidden="true">
              {#each ENDING_STARS as s, i (i)}<circle cx={s.x} cy={s.y} r={s.r} fill="#FFF6E0" opacity={s.o} class="end-star" style:animation-delay="{-s.d}s" />{/each}
              <circle cx="96" cy="70" r="20" fill="#FFF6E0" opacity="0.9" />
              <circle cx="104" cy="64" r="18" fill="#0B1030" />
              <defs>
                <radialGradient id="end-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stop-color="#FFD98A" stop-opacity="0.9" />
                  <stop offset="1" stop-color="#FFD98A" stop-opacity="0" />
                </radialGradient>
              </defs>
              <!-- The little world's curve, the workshop with its lamp on, and a dome ahead. -->
              <path d="M-20 420 Q 400 250 820 420 Z" fill="#3E5A44" stroke="#2B2622" stroke-width="4" />
              <g transform="translate(150 286) rotate(-8)">
                <rect x="-62" y="-62" width="124" height="70" fill="#9A4A36" stroke="#2B2622" stroke-width="4" />
                <path d="M-74 -60 L0 -112 L74 -60 Z" fill="#4E6B57" stroke="#2B2622" stroke-width="4" stroke-linejoin="round" />
                <rect x="-20" y="-44" width="40" height="30" fill="#FFD98A" stroke="#2B2622" stroke-width="3" />
                <circle cx="0" cy="-29" r="44" fill="url(#end-glow)" />
              </g>
              <g transform="translate(640 270)">
                <circle r="58" fill="url(#end-glow)" opacity="0.5" />
                <path d="M-44 10 A 44 44 0 0 1 44 10 Z" fill="#CFE3EE" fill-opacity="0.35" stroke="#FFF6E0" stroke-width="4" />
                <rect x="-52" y="8" width="104" height="12" rx="3" fill="#6E4E36" stroke="#2B2622" stroke-width="3" />
              </g>
              <!-- Four friends and Milo, walking to the next dome. -->
              {#each FRIENDS as k, i (i)}
                <g transform="translate({k.x} {300 + k.h})">
                  <g class="walker" style:animation-delay="{-i * 0.18}s">
                    {#if k.pack}<rect x="-19" y="-38" width="12" height="24" rx="4" fill="#7A3B2E" stroke="#2B2622" stroke-width="3" />{/if}
                    <rect x="-13" y="-40" width="26" height="34" rx="9" fill={k.c} stroke="#2B2622" stroke-width="3" />
                    <circle cy="-54" r="15" fill={k.skin} stroke="#2B2622" stroke-width="3" />
                    {#if k.hair === "curls"}
                      {#each [-12, -4, 4, 12] as hx (hx)}<circle cx={hx} cy={-66 + Math.abs(hx) * 0.3} r="7" fill={k.hc} stroke="#2B2622" stroke-width="2.5" />{/each}
                    {:else if k.hair === "bun"}
                      <circle cy="-74" r="7" fill={k.hc} stroke="#2B2622" stroke-width="2.5" />
                      <path d="M-15 -56 Q 0 -78 15 -56" fill={k.hc} stroke="#2B2622" stroke-width="3" />
                    {:else if k.hair === "cap"}
                      <path d="M-15 -58 Q 0 -78 15 -58 Z" fill={k.hc} stroke="#2B2622" stroke-width="3" />
                      <path d="M10 -60 L24 -58" stroke="#2B2622" stroke-width="4" stroke-linecap="round" />
                    {:else}
                      <path d="M-16 -54 Q -14 -76 2 -72 Q 14 -76 16 -54 L 10 -62 L 4 -56 L -2 -63 L -8 -56 Z" fill={k.hc} stroke="#2B2622" stroke-width="2.5" stroke-linejoin="round" />
                    {/if}
                    <path d="M-7 -6 L-9 10 M7 -6 L9 10" stroke="#2B2622" stroke-width="4" stroke-linecap="round" />
                  </g>
                </g>
              {/each}
              <g transform="translate(548 300)"><g class="walker">
                <rect x="-14" y="-30" width="28" height="24" rx="5" fill="#B9B4AA" stroke="#2B2622" stroke-width="3" />
                <circle cx="0" cy="-18" r="5" fill="#E0B34A" stroke="#2B2622" stroke-width="2" />
                <path d="M0 -30 L0 -44 L12 -52" fill="none" stroke="#2B2622" stroke-width="3" stroke-linecap="round" />
                <path d="M8 -58 L22 -50 L12 -40 Z" fill="#5F7F7A" stroke="#2B2622" stroke-width="3" stroke-linejoin="round" />
                <circle cx="16" cy="-46" r="4" fill="#FFD98A" />
                <circle cx="-8" cy="-2" r="6" fill="#6E6A66" stroke="#2B2622" stroke-width="2.5" />
                <circle cx="8" cy="-2" r="6" fill="#6E6A66" stroke="#2B2622" stroke-width="2.5" />
              </g></g>
            </svg>
            <p class="end-line">Remi and friends opened Dad's workshop as a little museum.</p>
            <p class="end-line soft">The lamp stays on.</p>
            <p class="stamp-line" aria-hidden="true">{STAMP[0]} {STAMP[1]}</p>
          </div>
        {:else}
          <div class="roll" bind:this={roll} tabindex="-1">
            <div class="roll-inner">
              <h2>Pieces of Home</h2>
              <p class="roll-sub">For every machine that kept working, and everyone who keeps the light on.</p>
              <h3>The facts came from</h3>
              <ul>{#each sources as s (s.sourceTitle)}<li>{s.sourceTitle}</li>{/each}</ul>
              {#if dataCredits.length}
                <h3>Data</h3>
                <ul>{#each dataCredits as d (d.name)}<li>{d.name}, {d.by}</li>{/each}</ul>
              {/if}
              <h3>Pictures and sounds</h3>
              <ul>{#each mediaCredits as c (c)}<li>{c}</li>{/each}</ul>
              <h3>Letters in</h3>
              <ul>{#each credits.fonts as f (f.name)}<li>{f.name}, {f.by}</li>{/each}</ul>
              <h3>Built with</h3>
              <ul>{#each credits.libraries as l (l.name)}<li>{l.name}</li>{/each}</ul>
              <p class="roll-note">{credits.note}</p>
              <p class="roll-end">Leave the light on for whoever comes next.</p>
            </div>
          </div>
        {/if}
        <div class="end-foot">
          <button type="button" class="btn amber" onclick={() => (scene === "picture" ? (scene = "credits") : finish())}>{scene === "picture" ? "Credits" : "Keep exploring"} <kbd>E</kbd></button>
        </div>
      </div>
    {/if}
  {/key}
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: radial-gradient(ellipse at 50% 45%, rgba(10, 8, 24, 0.5), rgba(6, 4, 14, 0.82));
    animation: dim 0.4s ease both;
  }
  /* ---------- Milo's projector ---------- */
  .show {
    position: fixed;
    z-index: 31;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    padding: 24px;
    pointer-events: none;
  }
  .show > * {
    pointer-events: auto;
  }
  .beam {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 70vw;
    height: 70vh;
    background: conic-gradient(from 20deg at 0% 100%, transparent 0deg, rgba(255, 217, 138, 0.16) 18deg, rgba(255, 217, 138, 0.05) 46deg, transparent 52deg);
    pointer-events: none;
  }
  .screen {
    position: relative;
    width: min(680px, 80vw);
    aspect-ratio: 16 / 10;
    border-radius: 10px;
    background: #fff6e0;
    box-shadow:
      0 0 0 8px rgba(255, 246, 224, 0.15),
      0 0 80px rgba(255, 217, 138, 0.35);
    overflow: hidden;
  }
  .frame {
    position: absolute;
    inset: 10px;
    display: grid;
    place-items: center;
    animation: slide-in 0.7s ease both;
  }
  .frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
    filter: sepia(0.18) saturate(1.05);
  }
  .inkstamp {
    display: grid;
    justify-items: center;
    padding: 18px 30px;
    border: 5px solid var(--clay);
    border-radius: 10px;
    color: var(--clay);
    font: 700 clamp(1.4rem, 3vw, 2.2rem) / 1.2 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    rotate: -6deg;
  }
  .caption {
    margin: 0;
    color: #fff6e0;
    font: 700 1.5rem/1.2 var(--hand);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .dots {
    display: flex;
    gap: 6px;
    margin: 0;
  }
  .dots b {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: rgba(255, 246, 224, 0.3);
  }
  .dots b.on {
    background: #ffd98a;
  }
  /* ---------- The last page ---------- */
  .page {
    position: fixed;
    z-index: 31;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    width: min(720px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    overflow: auto;
    box-sizing: border-box;
    padding: 26px 30px 20px 54px;
    background-color: #fbf4e4;
    background-image:
      linear-gradient(90deg, transparent 34px, rgba(196, 80, 60, 0.42) 34px 35.5px, transparent 35.5px),
      repeating-linear-gradient(180deg, transparent 0 29px, rgba(64, 108, 170, 0.14) 29px 30px),
      var(--grain);
    border-radius: 4px;
    box-shadow:
      0 3px 0 #e2d4b8,
      0 30px 60px -20px rgba(0, 0, 0, 0.75);
    color: var(--ink);
    rotate: 0.4deg;
    animation: drop 0.5s var(--ease-spring) both;
  }
  .tape {
    position: absolute;
    top: -13px;
    left: 50%;
    width: 110px;
    height: 26px;
    margin-left: -55px;
    background: var(--tape);
    box-shadow: inset 0 0 0 1px var(--tape-edge);
    rotate: -2deg;
  }
  .page h2 {
    margin: 0;
    font: 700 2rem/1.1 var(--hand);
  }
  .sub {
    margin: 4px 0 8px;
    font: 400 0.95rem/1.4 var(--read);
    color: var(--ink-soft);
  }
  .page section {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .page h3 {
    margin: 0;
    font: 700 0.78rem/1 var(--label);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--clay-deep);
  }
  .photo-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .polaroid {
    margin: 0;
    padding: 6px 6px 18px;
    background: #fff;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
    rotate: -3deg;
  }
  .polaroid img {
    display: block;
    width: 150px;
    height: 94px;
    object-fit: cover;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    padding: 7px 13px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--paper-light);
    color: var(--ink);
    font: 700 0.95rem/1 var(--read);
    cursor: pointer;
    transition:
      transform 0.15s var(--ease-spring),
      background 0.15s;
  }
  .chip:hover {
    transform: translateY(-1px);
  }
  .chip[aria-checked="true"] {
    background: #f9d79a;
    box-shadow: 0 2px 0 var(--ink);
  }
  .chip:focus-visible {
    outline: 3px solid var(--amber);
    outline-offset: 2px;
  }
  .sticker[aria-checked="true"] {
    background: #c9dcc0;
    rotate: -2deg;
  }
  .name {
    margin: 2px 0 0;
    font: 700 1.6rem/1.2 var(--hand);
    color: var(--ink);
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
  }
  /* ---------- The ending ---------- */
  .ending {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: grid;
    grid-template-rows: 1fr auto;
    background-color: #0b1030;
    background-image:
      radial-gradient(ellipse at 50% 30%, rgba(255, 217, 138, 0.12), transparent 60%),
      var(--grain);
    color: #fff6e0;
    animation: dim 1.2s ease both;
  }
  .picture {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    padding: 24px;
    text-align: center;
  }
  .picture svg {
    width: min(1040px, 94vw);
    height: auto;
  }
  .end-star {
    animation: end-twinkle 3.2s ease-in-out infinite;
  }
  @keyframes end-twinkle {
    50% {
      opacity: 0.15;
    }
  }
  .walker {
    animation: walk 0.9s ease-in-out infinite;
  }
  .end-line {
    margin: 0;
    font: 700 clamp(1.4rem, 2.6vw, 2rem) / 1.25 var(--hand);
    animation: rise 1s ease 0.6s both;
  }
  .end-line.soft {
    font-size: 1.2rem;
    color: rgba(255, 246, 224, 0.75);
    animation-delay: 1.4s;
  }
  .stamp-line {
    margin: 12px 0 0;
    padding: 8px 16px;
    border: 4px solid #e0b34a;
    border-radius: 8px;
    color: #e0b34a;
    font: 700 1rem/1 var(--label);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    rotate: -4deg;
    animation: rise 0.8s var(--ease-spring) 2.2s both;
  }
  .roll {
    overflow: auto;
    padding: 0 24px;
    scrollbar-width: none;
    mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
  }
  .roll-inner {
    max-width: 640px;
    margin: 0 auto;
    padding: 45vh 0 55vh;
    text-align: center;
  }
  .roll h2 {
    margin: 0;
    font: 700 3rem/1 var(--hand);
  }
  .roll-sub {
    margin: 10px 0 30px;
    font: 400 1.1rem/1.4 var(--read);
    color: rgba(255, 246, 224, 0.8);
  }
  .roll h3 {
    margin: 30px 0 10px;
    font: 700 0.8rem/1 var(--label);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #ffd98a;
  }
  .roll ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
    font: 400 1rem/1.35 var(--read);
    color: rgba(255, 246, 224, 0.85);
  }
  .roll-note {
    margin: 40px 0 0;
    font: 400 0.9rem/1.4 var(--read);
    color: rgba(255, 246, 224, 0.65);
  }
  .roll-end {
    margin: 50px 0 0;
    font: 700 1.6rem/1.3 var(--hand);
    color: #ffd98a;
  }
  .end-foot {
    display: flex;
    justify-content: center;
    padding: 16px 0 max(22px, env(safe-area-inset-bottom));
  }
  kbd {
    margin-left: 6px;
    padding: 1px 6px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    font: 700 0.75rem/1.2 var(--read);
  }
  @keyframes dim {
    from {
      opacity: 0;
    }
  }
  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-18px) scale(0.97);
    }
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: scale(1.03);
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @keyframes walk {
    50% {
      transform: translateY(-4px);
    }
  }
  :global(:root[data-motion="reduce"]) .ending *,
  :global(:root[data-motion="reduce"]) .page,
  :global(:root[data-motion="reduce"]) .frame {
    animation: none !important;
  }
</style>
