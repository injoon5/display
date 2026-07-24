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
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title class="tracking-[0.18em] uppercase">Slot inspector</Card.Title>
      <Card.Description>Hover the preview to inspect bound values and freshness.</Card.Description>
    </div>
    <StatusBadge class="tabular-nums" tone="warning">{slotMap.length} slots</StatusBadge>
  </Card.Header>

  <Card.Content class="flex flex-col gap-3">
    {#if hovered}
      <div class="rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/25">
        <div class="flex items-center justify-between gap-3">
          <code class="font-mono text-sm text-amber-100">{hovered.path}</code>
          <span class="font-mono text-[11px] text-amber-200/70">{hovered.sourceId}</span>
        </div>
        <p class="mt-2 text-sm">{formatValue(hovered.value)}</p>
      </div>
    {/if}

    <div class="flex max-h-[26rem] flex-col gap-2 overflow-auto pr-1">
      {#each slotMap as entry (entry.path)}
        {@const slot = snapshot.byIndex[entry.index]}
        <div
          class={[
            "rounded-lg px-3 py-2 ring-1",
            hovered?.path === entry.path
              ? "bg-amber-500/10 ring-amber-500/35"
              : "bg-muted/40 ring-foreground/10"
          ]}
        >
          <div class="flex items-center justify-between gap-3">
            <code class="font-mono text-xs">{entry.path}</code>
            <span class="font-mono text-[11px] tabular-nums text-muted-foreground">#{entry.index}</span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-3">
            <span class="text-sm tabular-nums">{formatValue(slot?.value)}</span>
            <span class="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase"
              >{entry.type}</span
            >
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
