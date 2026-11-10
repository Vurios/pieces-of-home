<script lang="ts">
  import type { InputDevice, PromptInfo } from "../game/core/events";
  import type { TouchStick } from "../game/core/input";
  import type { Engine } from "../game/engine";

  /**
   * The in-world HUD for Phase 02: the interact prompt and touch controls.
   * Phase 03 replaces the look with the full notebook HUD.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

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

  const keyName = $derived(device === "gamepad" ? "X" : "E");
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
</script>

{#if prompt}
  <div class="prompt" class:touch={touchCapable} role="status" aria-live="polite">
    {#if device === "touch"}
      <span class="tap" aria-hidden="true"></span>
    {:else}
      <kbd>{keyName}</kbd>
    {/if}
    <span class="label">{prompt.kind === "hold" ? `Hold to ${prompt.label.toLowerCase()}` : prompt.label}</span>
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
      aria-label={prompt ? prompt.label : "Use"}
      onpointerdown={(e) => press("interact", true, e)}
      onpointerup={(e) => press("interact", false, e)}
      onpointercancel={(e) => press("interact", false, e)}
      onpointerleave={(e) => press("interact", false, e)}>Use</button
    >
    <button
      type="button"
      class="round jump"
      aria-label="Jump"
      onpointerdown={(e) => press("jump", true, e)}
      onpointerup={(e) => press("jump", false, e)}
      onpointercancel={(e) => press("jump", false, e)}
      onpointerleave={(e) => press("jump", false, e)}>Jump</button
    >
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom));
    transform: translateX(-50%) rotate(-1deg);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px 8px 10px;
    background: #f4ecdd;
    color: #2b2622;
    border: 2px solid #2b2622;
    border-radius: 6px 12px 5px 11px;
    box-shadow: 3px 4px 0 rgba(43, 38, 34, 0.32);
    font: 600 17px/1.2 "Segoe Print", "Bradley Hand", "Comic Sans MS", ui-rounded, system-ui, sans-serif;
    pointer-events: none;
    animation: pop 0.28s cubic-bezier(0.3, 1.6, 0.5, 1);
    white-space: nowrap;
  }
  /* On touch screens the prompt sits above the thumb buttons. */
  .prompt.touch {
    bottom: calc(118px + env(safe-area-inset-bottom));
  }
  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 30px;
    height: 30px;
    padding: 0 6px;
    border: 2px solid #2b2622;
    border-bottom-width: 4px;
    border-radius: 6px 7px 5px 6px;
    background: #fff9ee;
    font: 700 16px/1 ui-rounded, system-ui, sans-serif;
  }
  .tap {
    width: 26px;
    height: 26px;
    border: 2px solid #2b2622;
    border-radius: 50%;
    background: radial-gradient(circle, #f2a541 0 35%, transparent 36%);
  }
  .meter {
    width: 64px;
    height: 10px;
    border: 2px solid #2b2622;
    border-radius: 6px;
    overflow: hidden;
    background: #fff9ee;
  }
  .meter span {
    display: block;
    height: 100%;
    background: #f2a541;
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
    border: 2px solid #2b2622;
    background: #f4ecdd;
    box-shadow: 2px 3px 0 rgba(43, 38, 34, 0.35);
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
    border: 2px solid #2b2622;
    background: #f4ecdd;
    color: #2b2622;
    box-shadow: 3px 4px 0 rgba(43, 38, 34, 0.35);
    font: 700 15px/1 "Segoe Print", "Bradley Hand", "Comic Sans MS", ui-rounded, system-ui, sans-serif;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .round:active {
    transform: translateY(2px);
    box-shadow: 1px 2px 0 rgba(43, 38, 34, 0.35);
  }
  .act {
    width: 76px;
    height: 76px;
    background: #f2a541;
  }
  @keyframes pop {
    from {
      transform: translateX(-50%) rotate(-1deg) scale(0.85);
    }
    to {
      transform: translateX(-50%) rotate(-1deg) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .prompt {
      animation: none;
    }
  }
</style>
