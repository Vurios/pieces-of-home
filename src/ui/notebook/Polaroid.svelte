<script lang="ts">
  import type { NotebookImage } from "../../content/notebook";
  import { t } from "../settings.svelte";

  /** A real NASA photo, taped in like a polaroid, with a museum label and its exact credit line. */
  interface Props {
    image: NotebookImage;
    tilt?: number;
  }
  let { image, tilt = -2 }: Props = $props();
</script>

<figure class="polaroid" style:--tilt={`${tilt}deg`}>
  <span class="tape" aria-hidden="true"></span>
  <img src={image.file} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
  <figcaption class="label">
    <span class="credit">{t("notebook.photoBy")}: {image.credit}</span>
    <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{t("notebook.source")}</a>
  </figcaption>
</figure>

<style>
  .polaroid {
    position: relative;
    margin: 0;
    padding: 9px 9px 0;
    background: #fffdf7;
    box-shadow:
      0 1px 0 rgba(0, 0, 0, 0.08),
      2px 6px 12px -4px rgba(30, 20, 10, 0.45);
    transform: rotate(var(--tilt));
    transition: transform 0.25s var(--ease-spring);
  }
  .polaroid:hover {
    transform: rotate(calc(var(--tilt) * 0.4)) translateY(-2px);
  }
  .tape {
    position: absolute;
    top: -10px;
    left: 50%;
    width: 72px;
    height: 20px;
    margin-left: -36px;
    transform: rotate(3deg);
    background: repeating-linear-gradient(45deg, rgba(127, 163, 122, 0.62) 0 6px, rgba(150, 184, 144, 0.62) 6px 12px);
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: auto;
    max-height: 210px;
    object-fit: cover;
    background: #2b2622;
  }
  .label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 2px 4px;
    font: 500 0.72rem/1.2 var(--label);
    color: var(--ink-soft);
  }
  .credit {
    letter-spacing: 0.01em;
  }
  a {
    flex: none;
    font-weight: 700;
    color: var(--ink);
    text-decoration-color: var(--amber);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
    padding: 8px 2px;
  }
</style>
