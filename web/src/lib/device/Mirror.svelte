<script lang="ts">
  import { compile } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
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
    if (!card) return null;
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
        width: MXR_DIMENSIONS.width,
      };
    }
    return render({
      bytecode: compiled.bytecode,
      nowMs: mirrorNow,
      slotMap: compiled.slotMap,
      slots: snapshot.byIndex,
      source: card.source,
      sourceSlots: snapshot.byPath,
    });
  });
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Device mirror</Card.Title>
      <Card.Description>Local mirror of the currently selected frame.</Card.Description>
    </div>
    <StatusBadge tone="warning">{card?.slug ?? "no-card"}</StatusBadge>
  </Card.Header>
  <Card.Content>
    <div class="overflow-hidden rounded-lg ring-1 ring-foreground/10 outline outline-1 outline-white/10">
      <PixelCanvas
        framebuffer={frame.framebuffer}
        hotspots={[]}
        scale={8}
        title="Device mirror framebuffer"
      />
    </div>
  </Card.Content>
</Card.Root>
