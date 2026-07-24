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

<div
  class="rounded-[calc(var(--radius-lg)-3px)] bg-foreground/[0.04] px-3 py-2.5 ring-1 ring-border/70 dark:bg-white/5 dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] dark:ring-white/10"
>
  <p class="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</p>
  <p class="mt-1 text-sm font-medium tabular-nums text-foreground">{value}</p>
  {#if hint}
    <p class="mt-1 text-xs text-muted-foreground">{hint}</p>
  {/if}
  {@render children?.()}
</div>
