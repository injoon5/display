<script lang="ts">
  import type { CompileResult } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import type { SlotSnapshot } from "$lib/convex";
  import LedMatrixPanel from "$lib/device/LedMatrixPanel.svelte";
  import { initMxrWasm, MXR_DIMENSIONS, render, type RenderHotspot } from "$lib/mxr";
  import { onMount } from "svelte";

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

  // Bumped when WASM finishes loading so $derived re-renders with libmxr.
  let wasmEpoch = $state(0);

  onMount(() => {
    void initMxrWasm().then(() => {
      wasmEpoch += 1;
    });
  });

  let frame = $derived.by(() => {
    void wasmEpoch;
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
  <Card.Header>
    <Card.Title level={2}>Preview</Card.Title>
    <Card.Description>How the card looks on the panel.</Card.Description>
    <Card.Action class="flex items-center gap-2">
      <StatusBadge tone="mono">{frame.mode}</StatusBadge>
      <StatusBadge tone="neutral">{compiled?.slotMap.length ?? 0} slots</StatusBadge>
    </Card.Action>
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
      <ul class="flex flex-col gap-2">
        {#each frame.warnings as warning (warning)}
          <li
            class="rounded-md bg-warning-surface px-3 py-2 text-xs text-warning ring-1 ring-warning-border ring-inset"
          >
            {warning}
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Content>
</Card.Root>
