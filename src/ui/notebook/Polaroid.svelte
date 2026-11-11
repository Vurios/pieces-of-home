<script lang="ts">
  import type { NotebookImage } from "../../content/notebook";
  import { t } from "../settings.svelte";

  /**
   * A real NASA photo, printed with a white border and held on the page with
   * two strips of paper tape. The exact credit line sits under it like a
   * museum label, with a link to where the picture comes from.
   */
  interface Props {
    image: NotebookImage;
    tilt?: number;
    tape?: "amber" | "sage" | "sky";
    /** Two strips on the top corners, or one across the middle when photos sit side by side. */
    strips?: "corners" | "middle";
  }
  let { image, tilt = -2, tape = "amber", strips = "corners" }: Props = $props();
</script>

<figure class="photo tape-{tape}" style:--tilt={`${tilt}deg`}>
  {#if strips === "corners"}
    <span class="tape a" aria-hidden="true"></span>
    <span class="tape b" aria-hidden="true"></span>
  {:else}
    <span class="tape mid" aria-hidden="true"></span>
  {/if}
  <span class="print">
    <img src={image.file} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
  </span>
  <figcaption>
    <span class="credit">{t("notebook.photoBy")}: {image.credit}</span>
    <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t("notebook.source")}: ${image.title}`}>{t("notebook.source")}</a>
  </figcaption>
</figure>

<style>
  .photo {
    position: relative;
    margin: 0;
    padding: 8px 8px 0;
    background: #fffdf8;
    box-shadow:
      0 0 0 1px rgba(80, 60, 30, 0.08),
      0 2px 3px rgba(46, 30, 12, 0.12),
      0 14px 22px -14px rgba(46, 30, 12, 0.55);
    transform: rotate(var(--tilt));
    transition:
      transform 0.3s var(--ease-out),
      box-shadow 0.3s var(--ease-out);
  }
  .photo:hover {
    transform: rotate(calc(var(--tilt) * 0.5)) translateY(-3px);
    box-shadow:
      0 0 0 1px rgba(80, 60, 30, 0.08),
      0 4px 6px rgba(46, 30, 12, 0.12),
      0 22px 30px -16px rgba(46, 30, 12, 0.6);
  }
  .print {
    display: block;
    overflow: hidden;
    background: #1d1a17;
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    transition: transform 0.5s var(--ease-out);
  }
  .photo:hover img {
    transform: scale(1.025);
  }
  /* Paper tape with torn ends, a little see-through. */
  .tape {
    position: absolute;
    top: -9px;
    z-index: 1;
    width: 58px;
    height: 19px;
    background: var(--tape);
    clip-path: polygon(4% 0, 96% 0, 100% 18%, 95% 36%, 100% 54%, 96% 72%, 100% 90%, 96% 100%, 4% 100%, 0 82%, 5% 64%, 0 46%, 4% 28%, 0 10%);
    mix-blend-mode: multiply;
  }
  .tape.a {
    left: -14px;
    transform: rotate(-32deg);
  }
  .tape.b {
    right: -14px;
    transform: rotate(31deg);
  }
  .tape.mid {
    top: -11px;
    left: 50%;
    width: 74px;
    margin-left: -37px;
    transform: rotate(calc(var(--tilt) * -1.4));
  }
  .tape-amber {
    --tape: linear-gradient(90deg, rgba(242, 178, 92, 0.62), rgba(236, 190, 120, 0.7));
  }
  .tape-sage {
    --tape: linear-gradient(90deg, rgba(150, 186, 140, 0.62), rgba(170, 198, 160, 0.7));
  }
  .tape-sky {
    --tape: linear-gradient(90deg, rgba(150, 176, 210, 0.6), rgba(170, 192, 220, 0.7));
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 4px 2px 3px;
    font: 500 0.74rem/1.25 var(--read);
    color: var(--ink-soft);
  }
  a {
    flex: none;
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    font-weight: 700;
    color: #8f4c10;
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 3px;
  }
  :global(:root[data-motion="reduce"]) .photo,
  :global(:root[data-motion="reduce"]) img {
    transition: none;
  }
</style>
