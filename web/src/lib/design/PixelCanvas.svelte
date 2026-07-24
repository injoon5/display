<script lang="ts">
  import {
    blitLedMatrix,
    locateHotspot,
    matrixPixelFromEvent,
    type RenderHotspot,
  } from "$lib/mxr";

  type Props = {
    brightness?: number;
    class?: string;
    framebuffer: Uint16Array;
    glow?: boolean;
    hotspots?: RenderHotspot[];
    hovered?: RenderHotspot | null;
    pitch?: number;
    title?: string;
  };

  let {
    brightness = 100,
    class: className = "",
    framebuffer,
    glow = true,
    hotspots = [],
    hovered = $bindable<RenderHotspot | null>(null),
    pitch = 10,
    title = "Matrix framebuffer",
  }: Props = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!canvas) return;
    blitLedMatrix(canvas, framebuffer, { brightness, fill: 0.58, glow, pitch });
  });

  function handleMove(event: MouseEvent): void {
    if (!(event.currentTarget instanceof HTMLElement)) {
      hovered = null;
      return;
    }
    const pixel = matrixPixelFromEvent(event, event.currentTarget, pitch);
    hovered = pixel ? locateHotspot(hotspots, pixel.x, pixel.y) : null;
  }

  function handleLeave(): void {
    hovered = null;
  }
</script>

<div
  aria-label={title}
  class={`relative inline-flex overflow-hidden bg-black ${className}`}
  onmousemove={handleMove}
  onmouseleave={handleLeave}
  role="img"
>
  <canvas
    bind:this={canvas}
    aria-label={title}
    class="block"
    height={32 * pitch}
    width={64 * pitch}
  ></canvas>
  {#if hovered}
    <div
      class="pointer-events-none absolute rounded-[1px] border border-amber-300/70 bg-amber-300/15 shadow-[0_0_12px_rgba(251,191,36,0.35)]"
      style={`left:${(hovered.x / 64) * 100}%;top:${(hovered.y / 32) * 100}%;width:${(Math.max(1, hovered.w) / 64) * 100}%;height:${(Math.max(1, hovered.h) / 32) * 100}%;`}
    ></div>
  {/if}
</div>
