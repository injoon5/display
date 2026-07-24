<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    label: string;
    value: string | number;
    hint?: string;
    children?: Snippet;
  };

  let { label, value, hint, children }: Props = $props();
</script>

<div class="rounded-lg bg-muted/40 px-3 py-2.5 ring-1 ring-foreground/10">
  <p class="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
  <p class="mt-1 font-mono text-sm tabular text-foreground">{value}</p>
  {#if hint}
    <p class="mt-1 text-xs text-muted-foreground">{hint}</p>
  {/if}
  {@render children?.()}
</div>
