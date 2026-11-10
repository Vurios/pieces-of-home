<script lang="ts">
  import type { InputDevice, PromptInfo } from "../game/core/events";
  import type { TouchStick } from "../game/core/input";
  import type { Engine } from "../game/engine";
  import Icon, { type IconName } from "./Icon.svelte";
  import { t } from "./settings.svelte";

  /**
   * The play HUD: ink-stamp buttons at the edge (Notebook, Photo, Emote,
   * Settings, and Hint as a pencil mark), the interact prompt with the right
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
  <nav class="stamps" aria-label="Game">
    {#each stamps as s, i (s.id)}
      <button type="button" class="stamp" style:--tilt={`${[-2, 1.5, -1, 2][i]}deg`} onclick={s.act} aria-keyshortcuts={s.key === "Esc" ? "Escape" : s.key}>
        <Icon name={s.icon} size={30} />
        <span class="label">{s.label}</span>
        {#if !touchCapable}<span class="key" aria-hidden="true">{device === "gamepad" ? PAD[s.id]!.glyph : s.key}</span>{/if}
      </button>
    {/each}
    <button type="button" class="hint" onclick={onhint} aria-keyshortcuts="H">
      <Icon name="pencil" size={24} />
      <span>{t("hud.hint")}</span>
    </button>
  </nav>

  {#if prompt}
    <div class="prompt" class:touch={touchCapable} role="status" aria-live="polite">
      {#if device === "touch"}
        <span class="glyph tap"><Icon name="tap" size={26} /></span>
      {:else if device === "gamepad"}
        <span class="glyph pad" aria-label="X button">X</span>
      {:else}
        <kbd class="keycap">{keyName}</kbd>
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
  .stamps {
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    right: max(16px, env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }
  /* An ink stamp on a scrap of paper. */
  .stamp {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 2px;
    width: 82px;
    padding: 8px 4px 6px;
    color: var(--clay-deep);
    background: var(--paper-light);
    border: 2.5px solid var(--clay-deep);
    outline: 1.5px solid var(--clay-deep);
    outline-offset: -6px;
    border-radius: 6px 9px 7px 8px;
    box-shadow: 2px 3px 0 var(--shadow);
    transform: rotate(var(--tilt));
    cursor: pointer;
    transition:
      transform 0.16s var(--ease-spring),
      box-shadow 0.14s;
  }
  .stamp:hover {
    transform: rotate(var(--tilt)) translateY(-2px);
    box-shadow: 3px 5px 0 var(--shadow);
  }
  .stamp:active {
    transform: rotate(var(--tilt)) translateY(2px) scale(0.96);
    box-shadow: 0 1px 0 var(--shadow);
  }
  .stamp:focus-visible {
    outline: 3px dashed var(--ink);
    outline-offset: 4px;
  }
  .label {
    font: 700 0.66rem/1 var(--label);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .key {
    position: absolute;
    left: -10px;
    top: -8px;
    min-width: 20px;
    padding: 2px 4px;
    font: 700 0.62rem/1 var(--label);
    color: var(--ink);
    background: var(--paper-light);
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    box-shadow: 0 2px 0 var(--ink);
  }
  /* Hint is a pencil mark, quieter than the stamps. */
  .hint {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    padding: 4px 10px;
    font: 700 1rem var(--hand);
    color: var(--paper-light);
    background: rgba(43, 38, 34, 0.45);
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .hint:hover {
    background: rgba(43, 38, 34, 0.7);
  }
  .prompt {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    transform: translateX(-50%) rotate(-1deg);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px 8px 10px;
    background: var(--paper-light);
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 6px 12px 5px 11px;
    box-shadow: 3px 4px 0 var(--shadow);
    font: 700 1.1rem/1.2 var(--hand);
    pointer-events: none;
    animation: pop 0.28s var(--ease-spring);
    white-space: nowrap;
  }
  .prompt.touch {
    bottom: calc(118px + env(safe-area-inset-bottom));
  }
  .glyph {
    display: grid;
    place-items: center;
  }
  .pad {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #3f6fb2;
    color: #fff;
    font: 700 0.95rem var(--label);
    border: 2px solid var(--ink);
  }
  .meter {
    width: 64px;
    height: 10px;
    border: 2px solid var(--ink);
    border-radius: 6px;
    overflow: hidden;
    background: var(--paper-light);
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--amber);
  }
  .stick {
    position: fixed;
    width: 112px;
    height: 112px;
    margin: -56px 0 0 -56px;
    border: 2px dashed rgba(43, 38, 34, 0.55);
    border-radius: 50%;
    background: rgba(244, 236, 221, 0.18);
    pointer-events: none;
    display: grid;
    place-items: center;
  }
  .stick span {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    background: var(--paper);
    box-shadow: 2px 3px 0 var(--shadow);
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
    border: 2px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    box-shadow: 3px 4px 0 var(--shadow);
    font: 700 1rem/1 var(--hand);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .round:active {
    transform: translateY(2px);
    box-shadow: 1px 2px 0 var(--shadow);
  }
  .act {
    width: 76px;
    height: 76px;
    background: var(--amber);
  }
  @keyframes pop {
    from {
      transform: translateX(-50%) rotate(-1deg) scale(0.85);
    }
    to {
      transform: translateX(-50%) rotate(-1deg) scale(1);
    }
  }
  :global(:root[data-motion="reduce"]) .prompt {
    animation: none;
  }
  @media (max-width: 640px) {
    .stamps {
      flex-direction: row-reverse;
      align-items: flex-start;
      gap: 8px;
    }
    .stamp {
      width: 58px;
      padding: 6px 2px 5px;
    }
  }
</style>
