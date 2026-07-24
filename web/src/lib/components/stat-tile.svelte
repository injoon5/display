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
  class="rounded-[calc(var(--radius-lg)-2px)] bg-white/5 px-3 py-2.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] ring-1 ring-white/10"
>
  <p class="text-[11px] font-medium tracking-wide text-muted-foreground">{label}</p>
  <p class="mt-1 text-sm font-medium tabular-nums text-foreground">{value}</p>
  {#if hint}
    <p class="mt-1 text-xs text-muted-foreground">{hint}</p>
  {/if}
  {@render children?.()}
</div>
