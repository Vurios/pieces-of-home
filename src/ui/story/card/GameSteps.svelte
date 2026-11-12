<script lang="ts">
  /** Numbered steps along the bottom of a game card. The first one not done yet is lit. */
  interface Props {
    steps: readonly { label: string; done: boolean }[];
  }
  let { steps }: Props = $props();
  const now = $derived(steps.findIndex((s) => !s.done));
</script>

<ol class="gc-steps">
  {#each steps as step, i (i)}
    <li class:done={step.done} class:now={i === now}><b>{i + 1}</b>{step.label}</li>
  {/each}
</ol>
