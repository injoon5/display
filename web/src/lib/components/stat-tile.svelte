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

<!-- Sits inside a 16px-radius card with 16px padding, so 8px keeps the corners
     reading as concentric rather than pinched. -->
<div class="min-w-0 rounded-md bg-foreground/[0.035] px-3 py-2.5 ring-1 ring-border/70 ring-inset">
  <p class="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
  <p class="mt-1 truncate text-sm font-medium tabular-nums" title={String(value)}>{value}</p>
  {#if hint}
    <p class="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
  {/if}
  {@render children?.()}
</div>
