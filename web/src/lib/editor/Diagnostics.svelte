<script lang="ts">
  import type { CompileResult } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";

  type Props = {
    compiled: CompileResult | null;
  };

  let { compiled }: Props = $props();

  let diagnostics = $derived(compiled?.diagnostics ?? []);
  let hasErrors = $derived(diagnostics.some((entry) => entry.severity === "error"));
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title class="tracking-[0.18em] uppercase">Diagnostics</Card.Title>
      <Card.Description>Compiler output, layout validation, and slot pressure.</Card.Description>
    </div>
    <StatusBadge class="tabular-nums" tone={hasErrors ? "destructive" : "success"}>
      {diagnostics.length} entries
    </StatusBadge>
  </Card.Header>

  <Card.Content class="flex flex-col gap-2">
    {#if diagnostics.length === 0}
      <div class="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/20">
        No diagnostics. This card compiles cleanly.
      </div>
    {:else}
      {#each diagnostics as entry, index (`${entry.code}-${index}`)}
        <div class="rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/10">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <StatusBadge tone={entry.severity === "error" ? "destructive" : "warning"}>
                {entry.severity}
              </StatusBadge>
              <code class="font-mono text-xs text-muted-foreground">{entry.code}</code>
            </div>
            {#if entry.span}
              <span class="font-mono text-[11px] tabular-nums text-muted-foreground">
                L{entry.span.start.line}:C{entry.span.start.column}
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
