<script lang="ts">
  import type { CompileResult } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import type { SlotSnapshot } from "$lib/convex";
  import LedMatrixPanel from "$lib/device/LedMatrixPanel.svelte";
  import { MXR_DIMENSIONS, render, type RenderHotspot } from "$lib/mxr";

  type Props = {
    compiled: CompileResult | null;
    hovered?: RenderHotspot | null;
    nowMs: number;
    source: string;
    snapshot: SlotSnapshot;
  };

  let {
    compiled,
    hovered = $bindable<RenderHotspot | null>(null),
    nowMs,
    source,
    snapshot,
  }: Props = $props();

  let frame = $derived.by(() => {
    if (!compiled) {
      return {
        framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
        height: MXR_DIMENSIONS.height,
        hotspots: [] as RenderHotspot[],
        mode: "bytecode" as const,
        warnings: ["No compiled program"] as string[],
        width: MXR_DIMENSIONS.width,
      };
    }
    return render({
      bytecode: compiled.bytecode,
      nowMs,
      slotMap: compiled.slotMap,
      slots: snapshot.byIndex,
      source,
      sourceSlots: snapshot.byPath,
    });
  });
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Preview</Card.Title>
      <Card.Description>How the card looks on the panel.</Card.Description>
    </div>
    <div class="flex items-center gap-2">
      <StatusBadge tone="success">{frame.mode}</StatusBadge>
      <StatusBadge class="tabular-nums" tone="warning">{compiled?.slotMap.length ?? 0} slots</StatusBadge>
    </div>
  </Card.Header>

  <Card.Content class="flex flex-col gap-3">
    <LedMatrixPanel
      framebuffer={frame.framebuffer}
      hotspots={frame.hotspots}
      pitch={8}
      title="Preview"
      bind:hovered
    />

    {#if frame.warnings.length > 0}
      <div class="flex flex-col gap-2">
        {#each frame.warnings as warning (warning)}
          <div class="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-500/20">
            {warning}
          </div>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
