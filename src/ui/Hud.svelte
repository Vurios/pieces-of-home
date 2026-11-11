<script lang="ts">
  import type { InputDevice, PromptInfo } from "../game/core/events";
  import type { TouchStick } from "../game/core/input";
  import type { Engine } from "../game/engine";
  import Icon, { type IconName } from "./Icon.svelte";
  import { t } from "./settings.svelte";

  /**
   * The play HUD: small panes of dusk glass at the edge (Notebook, Photo,
   * Emote, Settings and Hint), the use prompt with the right key, tap or
   * button glyph, and the touch stick and buttons.
   */
  interface Props {
    engine: Engine;
    hidden: boolean;
    onnotebook: () => void;
    onphoto: () => void;
    onemote: () => void;
    onsettings: () => void;
    onhint: () => void;
  }
  let { engine, hidden, onnotebook, onphoto, onemote, onsettings, onhint }: Props = $props();

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
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  type Stamp = { id: string; icon: IconName; label: string; key: string; act: () => void };
  const stamps = $derived<Stamp[]>([
    { id: "notebook", icon: "book", label: t("hud.notebook"), key: "N", act: onnotebook },
    { id: "photo", icon: "camera", label: t("hud.photo"), key: "C", act: onphoto },
    { id: "emote", icon: "smile", label: t("hud.emote"), key: "G", act: onemote },
    { id: "settings", icon: "gear", label: t("hud.settings"), key: "Esc", act: onsettings },
  ]);

  function onkey(event: KeyboardEvent): void {
    if (hidden || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
    if (event.code === "KeyN") onnotebook();
    else if (event.code === "KeyC") onphoto();
    else if (event.code === "KeyG") onemote();
    else if (event.code === "KeyH") onhint();
    else if (event.key === "Escape") onsettings();
  }
</script>

<svelte:window onkeydown={onkey} />

{#if !hidden}
  <nav class="tools" aria-label="Game">
    {#each stamps as s (s.id)}
      <button type="button" class="tool" onclick={s.act} aria-keyshortcuts={s.key === "Esc" ? "Escape" : s.key}>
        <Icon name={s.icon} size={22} />
        <span class="label">{s.label}</span>
        {#if !touchCapable}<span class="key" aria-hidden="true">{device === "gamepad" ? PAD[s.id]!.glyph : s.key}</span>{/if}
      </button>
    {/each}
    <button type="button" class="tool hint" onclick={onhint} aria-keyshortcuts="H">
      <Icon name="question" size={22} />
      <span class="label">{t("hud.hint")}</span>
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
      <span class="text">{prompt.kind === "hold" ? `${t("hud.hold")} ${prompt.label.toLowerCase()}` : prompt.label}</span>
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
  /* Tools: small panes of dusk glass, an icon, a word and the key that opens it. */
  .tools {
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    right: max(16px, env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 150px;
    height: 46px;
    padding: 0 8px 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 999px;
    background: rgba(24, 22, 48, 0.62);
    box-shadow: 0 12px 24px -14px rgba(0, 0, 0, 0.6);
    -webkit-backdrop-filter: blur(12px) saturate(1.1);
    backdrop-filter: blur(12px) saturate(1.1);
    color: #fbf3e4;
    font: 600 0.95rem/1 var(--read);
    cursor: pointer;
    transition:
      background 0.15s,
      color 0.15s,
      transform 0.18s var(--ease-spring);
  }
  .tool :global(.icon) {
    color: rgba(251, 243, 228, 0.78);
  }
  .tool:hover {
    background: rgba(40, 36, 76, 0.78);
    color: #ffd79a;
    transform: translateX(-3px);
  }
  .tool:hover :global(.icon) {
    color: #ffd79a;
  }
  .tool:active {
    transform: scale(0.96);
  }
  .tool:focus-visible {
    outline: 3px solid #ffd79a;
    outline-offset: 3px;
  }
  .label {
    flex: 1;
    text-align: left;
  }
  .key {
    display: grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(251, 243, 228, 0.85);
    font: 700 0.74rem/1 var(--read);
  }
  .hint {
    margin-top: 4px;
    background: rgba(242, 165, 65, 0.2);
    border-color: rgba(242, 165, 65, 0.45);
  }
  .hint :global(.icon) {
    color: #ffd79a;
  }

  /* The use prompt, low and centered. */
  .prompt {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 20px 7px 7px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    background: rgba(24, 22, 48, 0.78);
    box-shadow: 0 16px 30px -14px rgba(0, 0, 0, 0.7);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    color: #fff7ea;
    font: 600 1.08rem/1.2 var(--read);
    pointer-events: none;
    white-space: nowrap;
    animation: pop 0.32s var(--ease-spring);
  }
  .prompt.touch {
    bottom: calc(118px + env(safe-area-inset-bottom));
  }
  .cap,
  .glyph {
    display: grid;
    place-items: center;
    min-width: 38px;
    height: 38px;
    padding: 0 9px;
    border-radius: 12px;
    background: linear-gradient(180deg, #f8bb62, #ee9b33);
    box-shadow:
      inset 0 -3px 0 rgba(120, 60, 8, 0.35),
      0 2px 0 rgba(0, 0, 0, 0.35);
    color: #2b1a08;
    font: 700 1rem/1 var(--read);
  }
  .pad {
    border-radius: 50%;
    background: linear-gradient(180deg, #6b95d6, #3f6fb2);
    color: #fff;
  }
  .meter {
    width: 72px;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.18);
  }
  .meter span {
    display: block;
    height: 100%;
    background: #f2a541;
  }

  /* Touch: a soft ring for the stick, and two round buttons. */
  .stick {
    position: fixed;
    width: 112px;
    height: 112px;
    margin: -56px 0 0 -56px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-radius: 50%;
    background: rgba(24, 22, 48, 0.25);
    pointer-events: none;
    display: grid;
    place-items: center;
  }
  .stick span {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(251, 243, 228, 0.92);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
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
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(24, 22, 48, 0.62);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    color: #fbf3e4;
    box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.6);
    font: 700 1rem/1 var(--read);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .round:active {
    transform: scale(0.94);
  }
  .act {
    width: 78px;
    height: 78px;
    border-color: rgba(140, 70, 10, 0.5);
    background: linear-gradient(180deg, #f8bb62, #ee9b33);
    color: #2b1a08;
  }
  @keyframes pop {
    from {
      transform: scale(0.88);
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .prompt {
    animation: none;
  }
  @media (max-width: 640px) {
    .tools {
      top: max(12px, env(safe-area-inset-top));
      right: 12px;
      left: 12px;
      flex-direction: row;
      justify-content: flex-end;
      gap: 6px;
    }
    .tool {
      flex-direction: column;
      justify-content: center;
      gap: 3px;
      min-width: 0;
      width: 62px;
      height: 50px;
      padding: 0;
      border-radius: 14px;
      font-size: 0.66rem;
    }
    .tool .label {
      flex: none;
      text-align: center;
    }
    .tool:hover {
      transform: none;
    }
    .hint {
      margin-top: 0;
    }
  }
</style>
