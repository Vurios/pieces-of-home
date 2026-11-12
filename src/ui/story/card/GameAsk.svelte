<script lang="ts">
  /**
   * What to do now, said by Remi: a speech line with a tiny drawn face.
   * The tone tints the line after a try: green when it worked, warm when it did not yet.
   */
  interface Props {
    text: string;
    tone?: "good" | "oops" | null;
  }
  let { text, tone = null }: Props = $props();
</script>

<p class="gc-ask" class:good={tone === "good"} class:oops={tone === "oops"} aria-live="polite">
  <span class="gc-who" aria-hidden="true">
    <svg viewBox="-12 -12 24 24">
      <circle r="9.5" fill="#C68E64" stroke="#2B2622" stroke-width="1.6" />
      <path d="M-9.4 -1.5 C-9.5 -9 -3 -11 1 -10.6 C6 -10.2 9.8 -6.5 9.4 -1 C7 -4.6 3.5 -5.6 0.5 -4.6 C-2.6 -6 -6.6 -4.8 -9.4 -1.5 Z" fill="#3A2A22" />
      <circle cx="-3.4" cy="0.8" r="1.2" fill="#2B2622" />
      <circle cx="3.4" cy="0.8" r="1.2" fill="#2B2622" />
      <path d={tone === "oops" ? "M-2.6 5.6 Q0 4 2.6 5.6" : "M-3 4 Q0 6.8 3 4"} fill="none" stroke="#2B2622" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="-6" cy="3.6" r="1.6" fill="#E07A5F" opacity="0.45" />
      <circle cx="6" cy="3.6" r="1.6" fill="#E07A5F" opacity="0.45" />
    </svg>
  </span>
  <span>{text}</span>
</p>
