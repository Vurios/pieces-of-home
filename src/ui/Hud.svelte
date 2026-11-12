<script lang="ts">
  import type { InputDevice, PromptInfo } from "../game/core/events";
  import type { TouchStick } from "../game/core/input";
  import type { Engine } from "../game/engine";
  import Icon, { type IconName } from "./Icon.svelte";
  import { t } from "./settings.svelte";

  /**
   * The play HUD: a column of postage stamps at the edge (Notebook, Photo,
   * Emote, Settings and Hint), the use prompt on a paper tag with the right
   * key, tap or button glyph, and the touch stick and buttons.
   */
  interface Props {
    engine: Engine;
    hidden: boolean;
    onnotebook: () => void;
    onphoto: () => void;
    onemote: () => void;
    onsettings: () => void;
    onhint: () => void;
    onmap: () => void;
  }
  let { engine, hidden, onnotebook, onphoto, onemote, onsettings, onhint, onmap }: Props = $props();

  let prompt = $state<PromptInfo | null>(null);
  let device = $state<InputDevice>("keyboard");
  let stick = $state({ active: false, originX: 0, originY: 0, x: 0, y: 0 });
  let touchCapable = $state(false);

  $effect(() => {
    touchCapable = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    if (touchCapable) device = "touch";
    const offPrompt = engine.bus.on("prompt:change", (next) => (prompt = next));
    const offDevice = engine.bus.on("input:device", ({ device: next }) => (device = next));
    const offStick = engine.input.onStick((s: TouchStick) => (stick = { ...s }));
    return () => {
      offPrompt();
      offDevice();
      offStick();
    };
  });

  const keyName = $derived.by(() => {
    const code = engine.input.bindings.interact[0] ?? "KeyE";
    return code.startsWith("Key") ? code.slice(3) : code;
  });
  const knob = $derived.by(() => {
    const dx = stick.x - stick.originX;
    const dy = stick.y - stick.originY;
    const distance = Math.hypot(dx, dy);
    const limit = 46;
    const k = distance > limit ? limit / distance : 1;
    return { x: dx * k, y: dy * k };
  });

  function press(action: "jump" | "interact", down: boolean, event: PointerEvent): void {
    event.preventDefault();
    engine.input.setVirtual(action, down);
  }

  // Gamepad, standard mapping: View opens the notebook, LB takes a photo, Y opens emotes, Menu opens settings.
  const PAD: Record<string, { index: number; glyph: string }> = {
    notebook: { index: 8, glyph: "View" },
    photo: { index: 4, glyph: "LB" },
    emote: { index: 3, glyph: "Y" },
    settings: { index: 9, glyph: "Menu" },
  };

  $effect(() => {
    let frame = 0;
    const was = new Map<number, boolean>();
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = [...pads].find((p) => p && p.connected);
      if (!pad) return;
      for (const s of stamps) {
        const index = PAD[s.id]!.index;
        const down = Boolean(pad.buttons[index]?.pressed);
        if (down && !was.get(index) && !hidden) s.act();
        was.set(index, down);
      }
      // LT opens Dad's map.
      const map = Boolean(pad.buttons[6]?.pressed);
      if (map && !was.get(6) && !hidden) onmap();
      was.set(6, map);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  type Stamp = { id: string; icon: IconName; label: string; key: string; tint: string; tilt: number; act: () => void };
  const stamps = $derived<Stamp[]>([
    { id: "notebook", icon: "book", label: t("hud.notebook"), key: "N", tint: "#c9dcc0", tilt: -2, act: onnotebook },
    { id: "photo", icon: "camera", label: t("hud.photo"), key: "C", tint: "#c3d7e6", tilt: 1.5, act: onphoto },
    { id: "emote", icon: "smile", label: t("hud.emote"), key: "G", tint: "#f3cabd", tilt: -1, act: onemote },
    { id: "settings", icon: "gear", label: t("hud.settings"), key: "Esc", tint: "#e6dcc4", tilt: 2, act: onsettings },
  ]);

  function onkey(event: KeyboardEvent): void {
    if (hidden || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
    if (event.code === "KeyN") onnotebook();
    else if (event.code === "KeyC") onphoto();
    else if (event.code === "KeyG") onemote();
    else if (event.code === "KeyH") onhint();
    else if (event.code === "KeyM") onmap();
    else if (event.key === "Escape") onsettings();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if !hidden}
  <nav class="tools" aria-label="Game">
    {#each stamps as s (s.id)}
      <button type="button" class="tool" style:--tint={s.tint} style:--tilt={s.tilt + "deg"} onclick={s.act} aria-keyshortcuts={s.key === "Esc" ? "Escape" : s.key}>
        <span class="stamp">
          <span class="art"><Icon name={s.icon} size={24} /></span>
          <span class="label">{s.label}</span>
        </span>
        {#if !touchCapable}<span class="key" aria-hidden="true">{device === "gamepad" ? PAD[s.id]!.glyph : s.key}</span>{/if}
      </button>
    {/each}
    <button type="button" class="tool hint" style:--tint="#f6c46e" style:--tilt="-1.5deg" onclick={onhint} aria-keyshortcuts="H">
      <span class="stamp">
        <span class="art"><Icon name="question" size={24} /></span>
        <span class="label">{t("hud.hint")}</span>
      </span>
      {#if !touchCapable && device !== "gamepad"}<span class="key" aria-hidden="true">H</span>{/if}
    </button>
  </nav>

  {#if prompt}
    <div class="prompt" class:touch={touchCapable} role="status" aria-live="polite">
      {#if device === "touch"}
        <span class="glyph tap"><Icon name="tap" size={24} /></span>
      {:else if device === "gamepad"}
        <span class="glyph pad" aria-label="X button">X</span>
      {:else}
        <kbd class="cap">{keyName}</kbd>
      {/if}
      <span class="text">{prompt.kind === "hold" ? `${t("hud.hold")} ${prompt.label.charAt(0).toLowerCase()}${prompt.label.slice(1)}` : prompt.label}</span>
      {#if prompt.kind === "hold"}
        <span class="meter" aria-hidden="true"><span style:width={`${Math.round(prompt.progress * 100)}%`}></span></span>
      {/if}
    </div>
  {/if}

  {#if stick.active}
    <div class="stick" style:left={`${stick.originX}px`} style:top={`${stick.originY}px`} aria-hidden="true">
      <span style:transform={`translate(${knob.x}px, ${knob.y}px)`}></span>
    </div>
  {/if}

  {#if touchCapable}
    <div class="buttons">
      <button
        type="button"
        class="round act"
        aria-label={prompt ? prompt.label : t("hud.use")}
        onpointerdown={(e) => press("interact", true, e)}
        onpointerup={(e) => press("interact", false, e)}
        onpointercancel={(e) => press("interact", false, e)}
        onpointerleave={(e) => press("interact", false, e)}>{t("hud.use")}</button
      >
      <button
        type="button"
        class="round jump"
        aria-label={t("hud.jump")}
        onpointerdown={(e) => press("jump", true, e)}
        onpointerup={(e) => press("jump", false, e)}
        onpointercancel={(e) => press("jump", false, e)}
        onpointerleave={(e) => press("jump", false, e)}>{t("hud.jump")}</button
      >
    </div>
  {/if}
{/if}

<style>
  /* Tools: postage stamps stuck along the edge, each with its own colour. */
  .tools {
    position: fixed;
    top: max(18px, env(safe-area-inset-top));
    right: max(18px, env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .tool {
    position: relative;
    display: block;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    filter: drop-shadow(0 2px 0 rgba(43, 38, 34, 0.55)) drop-shadow(0 8px 10px rgba(10, 6, 20, 0.35));
    transform: rotate(var(--tilt));
    transition: transform 0.22s var(--ease-spring);
  }
  /* The stamp itself: perforated edges cut with a mask, a coloured picture, a white border. */
  .stamp {
    --r: 3.5px;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 4px;
    width: 78px;
    height: 80px;
    box-sizing: border-box;
    padding: 9px;
    background: #fffaf0;
    -webkit-mask:
      radial-gradient(var(--r), #0000 97%, #000) round calc(-1.5 * var(--r)) calc(-1.5 * var(--r)) / calc(3 * var(--r)) calc(3 * var(--r)),
      linear-gradient(#000 0 0) no-repeat 50% / calc(100% - 3 * var(--r)) calc(100% - 3 * var(--r));
    mask:
      radial-gradient(var(--r), #0000 97%, #000) round calc(-1.5 * var(--r)) calc(-1.5 * var(--r)) / calc(3 * var(--r)) calc(3 * var(--r)),
      linear-gradient(#000 0 0) no-repeat 50% / calc(100% - 3 * var(--r)) calc(100% - 3 * var(--r));
  }
  .art {
    display: grid;
    place-items: center;
    width: 100%;
    height: 38px;
    box-sizing: border-box;
    background-color: var(--tint);
    background-image: var(--grain);
    border: 1.6px solid rgba(43, 38, 34, 0.75);
    color: var(--ink);
  }
  .art :global(.icon) {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .label {
    font: 700 0.58rem/1 var(--label);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink);
    white-space: nowrap;
  }
  .tool:hover {
    transform: rotate(0deg) translateY(-3px) scale(1.06);
  }
  .tool:active {
    transform: rotate(0deg) scale(0.94);
  }
  .tool:focus-visible {
    outline: 3px solid #fffaf0;
    outline-offset: 4px;
    border-radius: 4px;
  }
  /* The key that opens it, like a round sticker on the corner. */
  .key {
    position: absolute;
    left: -11px;
    bottom: -7px;
    display: grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 5px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fffaf0;
    color: var(--ink);
    font: 700 0.68rem/1 var(--read);
  }


  /* The use prompt: a paper tag low and centered, with a drawn key cap. */
  .prompt {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 20px 7px 8px;
    border: var(--outline);
    border-radius: var(--wobbly);
    background-color: #fffaf0;
    background-image: var(--grain);
    box-shadow: var(--lift), 0 16px 26px -14px rgba(10, 6, 20, 0.7);
    color: var(--ink);
    font: 700 1.25rem/1.15 var(--hand);
    pointer-events: none;
    white-space: nowrap;
    animation: pop 0.36s var(--ease-spring);
  }
  :global(:root[data-font="dyslexic"]) .prompt {
    font: 700 1.05rem/1.2 var(--read);
  }
  .prompt.touch {
    bottom: calc(118px + env(safe-area-inset-bottom));
  }
  .cap,
  .glyph {
    display: grid;
    place-items: center;
    min-width: 40px;
    height: 40px;
    box-sizing: border-box;
    padding: 0 9px;
    border: 2.2px solid var(--ink);
    border-bottom-width: 5px;
    border-radius: 10px 9px 11px 8px;
    background: #f4b04e;
    color: var(--ink);
    font: 700 1.05rem/1 var(--read);
    animation: tap-key 1.6s ease-in-out infinite;
  }
  @keyframes tap-key {
    0%,
    70%,
    100% {
      transform: translateY(0);
    }
    80% {
      transform: translateY(2px);
    }
  }
  .pad {
    border-radius: 50%;
    border-bottom-width: 2.2px;
    background: #8fb3e3;
  }
  .tap {
    background: #fffaf0;
  }
  .meter {
    width: 76px;
    height: 12px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 6px;
    overflow: hidden;
    background: #efe6d4;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--amber);
  }

  /* Touch: a pencilled ring for the stick, and two round paper buttons. */
  .stick {
    position: fixed;
    width: 112px;
    height: 112px;
    margin: -56px 0 0 -56px;
    box-sizing: border-box;
    border: 3px dashed rgba(255, 250, 240, 0.7);
    border-radius: 50%;
    background: rgba(255, 250, 240, 0.12);
    pointer-events: none;
    display: grid;
    place-items: center;
  }
  .stick span {
    width: 50px;
    height: 50px;
    box-sizing: border-box;
    border: 2.4px solid var(--ink);
    border-radius: 50%;
    background: #fffaf0;
    box-shadow: var(--lift);
  }
  .buttons {
    position: fixed;
    right: max(16px, env(safe-area-inset-right));
    bottom: max(24px, env(safe-area-inset-bottom));
    display: grid;
    grid-template-columns: auto auto;
    align-items: end;
    gap: 14px;
  }
  .round {
    width: 66px;
    height: 66px;
    border: var(--outline);
    border-radius: 50% 47% 52% 48%;
    background-color: #fffaf0;
    background-image: var(--grain);
    color: var(--ink);
    box-shadow: var(--lift);
    font: 700 1.1rem/1 var(--hand);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .round:active {
    transform: translateY(2px);
    box-shadow: var(--lift-lo);
  }
  .act {
    width: 78px;
    height: 78px;
    background-color: #f4b04e;
    font-size: 1.25rem;
  }
  @keyframes pop {
    from {
      transform: scale(0.8) rotate(-3deg);
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .prompt,
  :global(:root[data-motion="reduce"]) .cap,
  :global(:root[data-motion="reduce"]) .glyph,
  :global(:root[data-motion="reduce"]) .hint .art {
    animation: none;
  }
  @media (max-width: 640px) {
    .tools {
      top: max(10px, env(safe-area-inset-top));
      right: 10px;
      left: 10px;
      flex-direction: row;
      justify-content: flex-end;
      gap: 8px;
    }
    .stamp {
      --r: 3px;
      width: 56px;
      height: 62px;
      padding: 7px;
    }
    .art {
      height: 30px;
    }
    .art :global(.icon) {
      width: 20px;
      height: 20px;
    }
    .label {
      font-size: 0.5rem;
    }
  }
</style>
