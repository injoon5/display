<script lang="ts">
  import { compile } from "$lib/compiler";
  import type { DashboardCard, SlotSnapshot } from "$lib/convex";
  import PixelCanvas from "$lib/design/PixelCanvas.svelte";
  import { MXR_DIMENSIONS, render } from "$lib/mxr";
  import { onMount } from "svelte";

  type Props = {
    card: DashboardCard | null;
    nowMs: number;
    snapshot: SlotSnapshot;
  };

  let { card, nowMs, snapshot }: Props = $props();
  let mirrorNow = $state(Date.now());

  $effect(() => {
    mirrorNow = nowMs;
  });

  onMount(() => {
    const timer = window.setInterval(() => {
      mirrorNow = Date.now();
    }, 500);
    return () => window.clearInterval(timer);
  });

  let compiled = $derived.by(() => {
    if (!card) {
      return null;
    }
    return compile(card.source);
  });

  let frame = $derived.by(() => {
    if (!compiled || !card) {
      return {
        framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
        height: MXR_DIMENSIONS.height,
        hotspots: [],
        mode: "bytecode" as const,
        warnings: [],
        width: MXR_DIMENSIONS.width
      };
    }
    return render({
      bytecode: compiled.bytecode,
      nowMs: mirrorNow,
      slotMap: compiled.slotMap,
      slots: snapshot.byIndex,
      source: card.source,
      sourceSlots: snapshot.byPath
    });
  });
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Device mirror</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">2 fps local mirror of the currently selected frame.</p>
    </div>
    <span class="badge badge-amber">{card?.slug ?? "no-card"}</span>
  </div>
  <PixelCanvas framebuffer={frame.framebuffer} hotspots={[]} scale={8} title="Device mirror framebuffer" />
</section>
