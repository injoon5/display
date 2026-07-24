<script lang="ts">
  import { blitFramebuffer, locateHotspot, type RenderHotspot } from "$lib/mxr";

  type Props = {
    class?: string;
    framebuffer: Uint16Array;
    hotspots?: RenderHotspot[];
    hovered?: RenderHotspot | null;
    scale?: number;
    title?: string;
  };

  let {
    class: className = "",
    framebuffer,
    hotspots = [],
    hovered = $bindable<RenderHotspot | null>(null),
    scale = 8,
    title = "Matrix framebuffer"
  }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!canvas) {
      return;
    }
    blitFramebuffer(canvas, framebuffer, scale);
  });

  function handleMove(event: MouseEvent): void {
    const bounds = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null;
    if (!bounds) {
      hovered = null;
      return;
    }
    const x = Math.floor((event.clientX - bounds.left) / scale);
    const y = Math.floor((event.clientY - bounds.top) / scale);
    hovered = locateHotspot(hotspots, x, y);
  }

  function handleLeave(): void {
    hovered = null;
  }
</script>

<div
  aria-label={title}
  class={`relative inline-flex rounded-2xl border border-[color:var(--line)] bg-black/60 p-2 ${className}`}
  onmousemove={handleMove}
  onmouseleave={handleLeave}
  role="img"
>
  <canvas bind:this={canvas} aria-label={title} class="block rounded-lg bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)]" height="256" width="512"></canvas>
  {#if hovered}
    <div
      class="pointer-events-none absolute rounded-md border border-amber-400/60 bg-amber-400/10"
      style={`left:${hovered.x * scale + 8}px;top:${hovered.y * scale + 8}px;width:${Math.max(1, hovered.w) * scale}px;height:${Math.max(1, hovered.h) * scale}px;`}
    ></div>
  {/if}
</div>
