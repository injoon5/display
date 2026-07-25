<script lang="ts">
  import type { SlotMapEntry } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import type { SlotSnapshot } from "$lib/convex";
  import type { RenderHotspot } from "$lib/mxr";

  type Props = {
    hovered: RenderHotspot | null;
    slotMap: SlotMapEntry[];
    snapshot: SlotSnapshot;
  };

  let { hovered, slotMap, snapshot }: Props = $props();

  function formatValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return "null";
    }
    return JSON.stringify(value);
  }
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title level={2}>Slots</Card.Title>
    <Card.Description>Hover the preview to inspect a value.</Card.Description>
    <Card.Action>
      <StatusBadge tone="neutral">{slotMap.length} slots</StatusBadge>
    </Card.Action>
  </Card.Header>

  <Card.Content class="flex flex-col gap-3">
    {#if hovered}
      <div class="rounded-md bg-inspect-surface p-3 ring-1 ring-inspect-border ring-inset">
        <div class="flex items-center justify-between gap-3">
          <code class="min-w-0 truncate font-mono text-sm text-inspect">{hovered.path}</code>
          <span class="shrink-0 font-mono text-[11px] text-muted-foreground">
            {hovered.sourceId}
          </span>
        </div>
        <p class="mt-2 text-sm">{formatValue(hovered.value)}</p>
      </div>
    {/if}

    <div class="max-h-[26rem] overflow-y-auto overscroll-contain">
      <ul class="flex flex-col gap-1.5 pr-2">
        {#each slotMap as entry (entry.path)}
          {@const slot = snapshot.byIndex[entry.index]}
          {@const active = hovered?.path === entry.path}
          <li
            class="rounded-md px-3 py-2 ring-1 ring-inset transition-colors duration-150 ease-[var(--ease-out)] {active
              ? 'bg-inspect-surface ring-inspect-border'
              : 'bg-foreground/[0.035] ring-border/70'}"
          >
            <div class="flex items-center justify-between gap-3">
              <code class="min-w-0 truncate font-mono text-xs">{entry.path}</code>
              <span class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                #{entry.index}
              </span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-3">
              <span class="min-w-0 truncate text-sm tabular-nums">{formatValue(slot?.value)}</span>
              <span class="shrink-0 text-[11px] font-medium text-muted-foreground">
                {entry.type}
              </span>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  </Card.Content>
</Card.Root>
