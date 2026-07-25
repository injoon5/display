<script lang="ts">
  import type { CompileResult } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";

  type Props = {
    compiled: CompileResult | null;
  };

  let { compiled }: Props = $props();

  let diagnostics = $derived(compiled?.diagnostics ?? []);
  let errorCount = $derived(diagnostics.filter((entry) => entry.severity === "error").length);
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title level={2}>Diagnostics</Card.Title>
    <Card.Description>Issues found while building this card.</Card.Description>
    <Card.Action>
      <StatusBadge
        tone={errorCount > 0 ? "destructive" : diagnostics.length > 0 ? "warning" : "success"}
      >
        {diagnostics.length}
        {diagnostics.length === 1 ? "issue" : "issues"}
      </StatusBadge>
    </Card.Action>
  </Card.Header>

  <Card.Content class="flex flex-col gap-2">
    {#if diagnostics.length === 0}
      <p
        class="flex items-center gap-2 rounded-md bg-success-surface px-3 py-2 text-sm text-success ring-1 ring-success-border ring-inset"
      >
        <CircleCheckIcon class="size-4 shrink-0" aria-hidden="true" />
        No issues. This card is ready to publish.
      </p>
    {:else}
      {#each diagnostics as entry, index (`${entry.code}-${index}`)}
        <div
          class="rounded-md px-3 py-2 ring-1 ring-inset {entry.severity === 'error'
            ? 'bg-destructive-surface ring-destructive-border'
            : 'bg-warning-surface ring-warning-border'}"
        >
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div class="flex items-center gap-2">
              <StatusBadge tone={entry.severity === "error" ? "destructive" : "warning"}>
                {entry.severity}
              </StatusBadge>
              <code class="font-mono text-xs text-muted-foreground">{entry.code}</code>
            </div>
            {#if entry.span}
              <span class="font-mono text-[11px] tabular-nums text-muted-foreground">
                line {entry.span.start.line}, col {entry.span.start.column}
              </span>
            {/if}
          </div>
          <p class="mt-2 text-sm">{entry.message}</p>
          {#if entry.hint}
            <p class="mt-1 text-xs text-muted-foreground">{entry.hint}</p>
          {/if}
        </div>
      {/each}
    {/if}
  </Card.Content>
</Card.Root>
