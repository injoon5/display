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
    title = "LED Panel",
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

<!-- The rendered matrix is one image to assistive tech; the canvas itself carries
     no accessible content, so the label lives on the wrapper. -->
<div
  aria-label={title}
  class={`relative inline-flex overflow-hidden bg-black ${className}`}
  onmousemove={handleMove}
  onmouseleave={handleLeave}
  role="img"
>
  <canvas
    bind:this={canvas}
    aria-hidden="true"
    class="block"
    height={32 * pitch}
    width={64 * pitch}
  ></canvas>
  {#if hovered}
    <!-- The matrix is always black hardware, so this highlight is a fixed bright
         amber rather than a theme token that would vanish in light mode. -->
    <div
      class="pointer-events-none absolute rounded-[1px] bg-[oklch(0.85_0.15_80/0.18)] ring-1 ring-[oklch(0.85_0.15_80/0.7)]"
      style={`left:${(hovered.x / 64) * 100}%;top:${(hovered.y / 32) * 100}%;width:${(Math.max(1, hovered.w) / 64) * 100}%;height:${(Math.max(1, hovered.h) / 32) * 100}%;`}
    ></div>
  {/if}
</div>
