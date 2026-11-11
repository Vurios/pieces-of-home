<script lang="ts">
  import { audio } from "../../audio/audio";
  import { settings } from "../settings.svelte";

  /**
   * The Looking Lamp countdown before a trip into a dome: "3, 2, 1", with a
   * tick for each and the lamp light swelling, like a launch. Then the iris
   * closes. Under reduced motion it is one quick beat.
   */
  interface Props {
    place: string;
    ondone: () => void;
  }
  let { place, ondone }: Props = $props();
  let count = $state(3);

  $effect(() => {
    const quick = settings.reducedMotion;
    audio.play("tick");
    if (quick) {
      const t = window.setTimeout(ondone, 350);
      return () => window.clearTimeout(t);
    }
    const timers = [1, 2].map((i) =>
      window.setTimeout(() => {
        count = 3 - i;
        audio.play("tick");
      }, i * 650),
    );
    timers.push(
      window.setTimeout(() => {
        audio.play("corner-sparkle", { level: 0.6 });
        ondone();
      }, 1950),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  });
</script>

<div class="countdown" aria-live="assertive">
  <p class="where">Into {place}</p>
  {#key count}<p class="n">{count}</p>{/key}
</div>

<style>
  .countdown {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    pointer-events: none;
    background: radial-gradient(circle at 50% 48%, rgba(255, 214, 140, 0.32), rgba(255, 190, 110, 0.08) 38%, transparent 62%);
    animation: swell 2s ease-in forwards;
    z-index: 40;
  }
  .where {
    margin: 0;
    font: 700 1rem/1 var(--label);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #fff4dc;
    text-shadow: 0 2px 10px rgba(80, 40, 0, 0.6);
  }
  .n {
    margin: 0;
    font: 700 7rem/1 var(--hand);
    color: #fff8e8;
    text-shadow: 0 0 30px rgba(255, 190, 100, 0.9), 0 4px 0 rgba(120, 60, 10, 0.5);
    animation: pop 0.6s var(--ease-spring);
  }
  @keyframes pop {
    from {
      transform: scale(1.6);
      opacity: 0;
    }
  }
  @keyframes swell {
    to {
      background-color: rgba(255, 220, 160, 0.25);
    }
  }
</style>
