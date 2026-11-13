<script lang="ts">
  import { KID_NAMES } from "../../content/story";
  import { KID_PALETTES, type KidId } from "../../game/actors/character";
  import type { Engine } from "../../game/engine";

  /**
   * Name tags over co-op friends: only the kid's name, never a username
   * (Game Bible 8). A small paper tag in the kid's shirt color.
   */
  interface Props {
    engine: Engine;
    hidden: boolean;
  }
  let { engine, hidden }: Props = $props();

  let tags = $state<{ seat: number; kid: KidId; x: number; y: number }[]>([]);

  $effect(() => {
    if (hidden) {
      tags = [];
      return;
    }
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const next: { seat: number; kid: KidId; x: number; y: number }[] = [];
      for (const f of engine.crew.list) {
        const head = engine.crew.head(f.seat);
        if (!head) continue;
        head.addScaledVector(head.clone().normalize(), 0.42);
        const p = engine.project(head);
        if (p.visible) next.push({ seat: f.seat, kid: f.kid, x: Math.round(p.x), y: Math.round(p.y) });
      }
      const same = next.length === tags.length && next.every((n, i) => n.seat === tags[i]!.seat && n.kid === tags[i]!.kid && Math.abs(n.x - tags[i]!.x) < 1 && Math.abs(n.y - tags[i]!.y) < 1);
      if (!same) tags = next;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="tags" aria-hidden="true">
  {#each tags as tag (tag.seat)}
    <span class="friend-tag" data-kid={tag.kid} style:left={`${tag.x}px`} style:top={`${tag.y}px`} style:--kid={KID_PALETTES[tag.kid].top}>{KID_NAMES[tag.kid]}</span>
  {/each}
</div>

<style>
  .tags {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 4;
  }
  .friend-tag {
    position: absolute;
    transform: translate(-50%, -100%) rotate(-2deg);
    padding: 3px 10px 3px 8px;
    border: 2px solid var(--ink, #2b2622);
    border-left: 8px solid var(--kid);
    border-radius: 3px 5px 4px 3px;
    background: #fffaf0;
    box-shadow: 0 2px 0 rgba(43, 38, 34, 0.35);
    color: var(--ink, #2b2622);
    font: 700 0.95rem/1.1 var(--hand);
    white-space: nowrap;
  }
</style>
