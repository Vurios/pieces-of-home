<script lang="ts">
  import { Vector3 } from "three";
  import { audio } from "../../audio/audio";
  import type { Engine } from "../../game/engine";
  import { KID_NAMES } from "../../content/story";
  import type { StringKey } from "../../content/strings";
  import Icon, { type IconName } from "../Icon.svelte";
  import { settings, t } from "../settings.svelte";

  /**
   * Speech: paper bubbles over whoever is talking, with a handwritten name,
   * typed-on text and the speaker's gibberish voice. When the speaker is off screen
   * (or bubbles are off), the line shows in the caption bar instead.
   * Emotes pop a small icon bubble over the player. In a co-op room, a
   * friend's emotes and phrases ride on that friend's head.
   */
  interface Props {
    engine: Engine;
  }
  let { engine }: Props = $props();

  interface Line {
    key: number;
    speaker: string;
    name: string;
    text: string;
    at: Vector3 | null;
    shown: number;
    age: number;
    life: number;
    recording: boolean;
    icon: IconName | null;
    /** Follows a head as it moves: "me" for the local player, a seat for a friend. */
    follow: "me" | number | null;
    x: number;
    y: number;
    onScreen: boolean;
  }

  let lines = $state<Line[]>([]);
  let counter = 0;

  $effect(() => {
    const offSay = engine.bus.on("say", (p) => {
      const life = Math.max(2.8, p.text.length * 0.065 + 1.8);
      // The voice: babble that lasts as long as the typing, Dad's hum or his recording.
      // A mission recording plays its own sound; no babble over it.
      if (!(p.recording && p.speaker === "radio")) audio.speak(p.speaker, p.text, p.line);
      // One line per speaker at a time.
      lines = [
        ...lines.filter((l) => l.speaker !== p.speaker),
        { key: counter++, speaker: p.speaker, name: p.name, text: p.text, at: p.at ? new Vector3(...p.at) : null, shown: 0, age: 0, life, recording: p.recording ?? false, icon: null, follow: null, x: 0, y: 0, onScreen: false },
      ];
    });
    const offEmote = engine.bus.on("emote", ({ id, seat }) => {
      const icon = (["wave", "heart", "star", "look", "question", "yay"] as const).find((name) => name === id) ?? null;
      if (!icon) return;
      const speaker = `emote-${seat ?? "me"}`;
      lines = [...lines.filter((l) => l.speaker !== speaker), { key: counter++, speaker, name: "", text: "", at: null, shown: 0, age: 0, life: 2.2, recording: false, icon, follow: seat ?? "me", x: 0, y: 0, onScreen: false }];
    });
    // Preset phrases, said by whichever kid the player (or a friend) plays.
    const offPhrase = engine.bus.on("phrase", ({ id, seat }) => {
      const kid = seat === undefined ? engine.playerKid : (engine.crew.list.find((f) => f.seat === seat)?.kid ?? null);
      if (!kid) return;
      const text = t(`phrase.${id}` as StringKey);
      const speaker = `phrase-${seat ?? "me"}`;
      audio.speak(kid, text);
      lines = [
        ...lines.filter((l) => l.speaker !== speaker),
        { key: counter++, speaker, name: KID_NAMES[kid], text, at: null, shown: 0, age: 0, life: Math.max(2.8, text.length * 0.065 + 1.8), recording: false, icon: null, follow: seat ?? "me", x: 0, y: 0, onScreen: false },
      ];
    });
    let last = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      // Wall-clock time, so a slow device does not keep a line up for longer.
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (lines.length === 0) return;
      const reduce = settings.reducedMotion;
      lines = lines
        .map((line) => {
          const shown = reduce ? line.text.length : Math.min(line.text.length, line.shown + dt * 42);
          const at = line.follow === "me" ? engine.playerHead() : typeof line.follow === "number" ? engine.crew.head(line.follow) : line.at;
          const p = at ? engine.project(at) : { x: 0, y: 0, visible: false };
          return { ...line, shown, age: line.age + dt, x: p.x, y: p.y, onScreen: p.visible };
        })
        .filter((line) => line.age < line.life);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      offSay();
      offEmote();
      offPhrase();
      cancelAnimationFrame(frame);
    };
  });

  const bubbles = $derived(lines.filter((l) => l.onScreen && (settings.value.bubbles || l.icon)));
  const captions = $derived(settings.value.subtitles ? lines.filter((l) => !l.icon && (!l.onScreen || !settings.value.bubbles)) : []);
</script>

{#each bubbles as line (line.key)}
  <div class="bubble" class:emote={line.icon} style:left={`${line.x}px`} style:top={`${line.y}px`} aria-hidden="true">
    {#if line.icon}
      <Icon name={line.icon} size={34} />
    {:else}
      <span class="name">{line.name}{#if line.recording}<span class="rec">{t("caption.recording")}</span>{/if}</span>
      <span class="text">{line.text.slice(0, Math.floor(line.shown))}<span class="rest">{line.text.slice(Math.floor(line.shown))}</span></span>
    {/if}
  </div>
{/each}

<div class="captions" aria-live="polite">
  {#each captions as line (line.key)}
    <p class="caption"><span class="who">{line.name}{line.recording ? ` (${t("caption.recording")})` : ""}:</span> {line.text}</p>
  {/each}
</div>
<!-- Screen readers hear every line once, in full, whether it is a bubble or a caption. -->
<div class="sr-only" aria-live="polite">
  {#each bubbles as line (line.key)}{#if !line.icon}<p>{line.name}: {line.text}</p>{/if}{/each}
</div>

<style>
  .bubble {
    position: fixed;
    max-width: min(320px, 70vw);
    transform: translate(-50%, calc(-100% - 18px)) rotate(-1deg);
    padding: 8px 14px 10px;
    background: var(--paper-light);
    color: var(--ink);
    border: 2.5px solid var(--ink);
    border-radius: 18px 22px 16px 20px / 20px 16px 22px 18px;
    box-shadow: 3px 4px 0 var(--shadow);
    animation: bubble-in 0.3s var(--ease-spring);
    pointer-events: none;
  }
  .bubble::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -13px;
    width: 18px;
    height: 18px;
    margin-left: -9px;
    background: var(--paper-light);
    border-right: 2.5px solid var(--ink);
    border-bottom: 2.5px solid var(--ink);
    transform: rotate(45deg) skew(8deg, 8deg);
  }
  .bubble.emote {
    padding: 6px;
    border-radius: 50%;
    color: var(--clay-deep);
  }
  .name {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font: 700 1rem/1 var(--hand);
    color: var(--clay-deep);
    margin-bottom: 2px;
  }
  .rec {
    font: 700 0.6rem/1 var(--label);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
    border: 1.5px solid var(--ink-soft);
    padding: 2px 4px;
    border-radius: 3px;
  }
  .text {
    display: block;
    font: 1.02rem/1.35 var(--read);
  }
  /* The untyped rest keeps its space, so the bubble never jumps in size. */
  .rest {
    visibility: hidden;
  }
  .captions {
    position: fixed;
    left: 50%;
    /* Above the tip card when one is up (Guide sets --tip-top), else just over the prompt. */
    bottom: max(96px, calc(env(safe-area-inset-bottom) + 96px), calc(var(--tip-top, 0px) + 116px));
    transform: translateX(-50%);
    width: min(720px, calc(100vw - 32px));
    display: grid;
    gap: 6px;
    pointer-events: none;
  }
  .caption {
    margin: 0;
    padding: 6px 14px;
    background: rgba(28, 22, 20, 0.82);
    color: #fbf6ea;
    border-radius: 6px;
    font: 1.05rem/1.4 var(--read);
    text-align: center;
  }
  .who {
    font-weight: 700;
    color: #ffd38a;
  }
  @keyframes bubble-in {
    from {
      transform: translate(-50%, calc(-100% - 8px)) rotate(-1deg) scale(0.6);
      opacity: 0;
    }
  }
  :global(:root[data-motion="reduce"]) .bubble {
    animation: none;
  }
</style>
