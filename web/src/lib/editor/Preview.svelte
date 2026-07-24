<script lang="ts">
  import type { CompileResult } from "$lib/compiler";
  import type { SlotSnapshot } from "$lib/convex";
  import PixelCanvas from "$lib/design/PixelCanvas.svelte";
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
    snapshot
  }: Props = $props();

  let frame = $derived.by(() => {
    if (!compiled) {
      return {
        framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
        height: MXR_DIMENSIONS.height,
        hotspots: [],
        mode: "bytecode" as const,
        warnings: ["No compiled program"],
        width: MXR_DIMENSIONS.width
      };
    }
    return render({
      bytecode: compiled.bytecode,
      nowMs,
      slotMap: compiled.slotMap,
      slots: snapshot.byIndex,
      source,
      sourceSlots: snapshot.byPath
    });
  });
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3 flex items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Live preview</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">64×32 framebuffer with 8× nearest-neighbour upscale.</p>
    </div>
    <div class="flex items-center gap-2">
      <span class="badge badge-green">{frame.mode}</span>
      <span class="badge badge-amber">{compiled?.slotMap.length ?? 0} slots</span>
    </div>
  </div>

  <PixelCanvas framebuffer={frame.framebuffer} hotspots={frame.hotspots} bind:hovered scale={8} title="Live card preview" />

  {#if frame.warnings.length > 0}
    <div class="mt-3 space-y-2">
      {#each frame.warnings as warning}
        <div class="rounded-xl border border-amber-500/15 bg-amber-500/7 px-3 py-2 text-xs text-amber-100">
          {warning}
        </div>
      {/each}
    </div>
  {/if}
</section>
