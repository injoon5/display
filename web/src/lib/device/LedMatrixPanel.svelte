<script lang="ts">
  import PixelCanvas from "$lib/design/PixelCanvas.svelte";
  import { locateHotspot, matrixPixelFromEvent, type RenderHotspot } from "$lib/mxr";

  type Props = {
    brightness?: number;
    framebuffer: Uint16Array;
    hotspots?: RenderHotspot[];
    hovered?: RenderHotspot | null;
    online?: boolean;
    pitch?: number;
    title?: string;
    ondoubletap?: () => void;
    onhotspot?: (hotspot: RenderHotspot) => void;
  };

  let {
    brightness = 100,
    framebuffer,
    hotspots = [],
    hovered = $bindable<RenderHotspot | null>(null),
    online = true,
    pitch = 10,
    title = "LED Panel",
    ondoubletap,
    onhotspot,
  }: Props = $props();

  function handleClick(event: MouseEvent): void {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const pixel = matrixPixelFromEvent(event, event.currentTarget, pitch);
    const hotspot = pixel ? locateHotspot(hotspots, pixel.x, pixel.y) : null;
    if (hotspot) onhotspot?.(hotspot);
  }

  function handleDoubleClick(): void {
    ondoubletap?.();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      ondoubletap?.();
    }
  }
</script>

<div class="led-rig w-full max-w-full">
  <div class="led-bezel">
    <div class="led-face">
      <div class="led-mask">
        <button
          aria-label="{title}. Press to advance to the next card. Click a hotspot to pin it."
          class="led-surface"
          data-hotspots={hotspots.length > 0}
          onclick={handleClick}
          ondblclick={handleDoubleClick}
          onkeydown={handleKeydown}
          type="button"
        >
          <PixelCanvas
            {brightness}
            {framebuffer}
            {hotspots}
            {pitch}
            bind:hovered
            class="pointer-events-none"
            title={title}
          />
        </button>
      </div>

      <aside class="controller" aria-hidden="true">
        <div class="controller-label">Matrix Portal S3</div>
        <div class="status-row">
          <span class="status-led" class:on={online} data-tone="power" title="5V"></span>
          <span class="status-led" class:on={online} data-tone="link" title="Wi-Fi"></span>
          <span class="status-led" class:on={brightness > 0} data-tone="hub" title="HUB75"></span>
        </div>
        <div class="ribbon">
          <div class="ribbon-pins"></div>
          <div class="ribbon-cable"></div>
        </div>
        <div class="usb-port"></div>
      </aside>
    </div>
  </div>

  <div class="mt-2 h-4 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
    {#if hovered}
      {hovered.path}{#if hovered.value !== undefined}
        · {typeof hovered.value === "object" ? JSON.stringify(hovered.value) : String(hovered.value)}{/if}
    {/if}
  </div>
</div>

<style>
  .led-rig {
    container-type: inline-size;
  }

  /* Bezel radius = mask radius + bezel padding, so the corners stay concentric. */
  .led-bezel {
    border-radius: 18px;
    background:
      linear-gradient(160deg, #3a3a3c 0%, #1c1c1e 42%, #0f0f10 100%);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.14) inset,
      0 -2px 0 rgba(0, 0, 0, 0.55) inset,
      0 18px 40px rgba(0, 0, 0, 0.45);
    padding: 14px 14px 12px;
  }

  .led-face {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 72px;
    gap: 10px;
    align-items: stretch;
  }

  .led-mask {
    border-radius: 4px;
    background: #050505;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 0 0 3px #111,
      inset 0 0 24px rgba(0, 0, 0, 0.85);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 0;
  }

  .led-surface {
    display: block;
    padding: 0;
    margin: 0;
    border: 0;
    background: transparent;
    cursor: default;
    line-height: 0;
    max-width: 100%;
    outline: none;
  }

  .led-surface[data-hotspots="true"] {
    cursor: crosshair;
  }

  /* The panel is the primary control on the page — keyboard focus has to be
     visible on it, and the ring sits inside the mask so it is never clipped. */
  .led-surface:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -3px;
  }

  .led-surface :global(canvas) {
    max-width: 100%;
    height: auto;
  }

  .controller {
    border-radius: 4px;
    background:
      linear-gradient(180deg, #1f4f8a 0%, #163a66 55%, #102844 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
    padding: 8px 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .controller-label {
    color: rgba(255, 255, 255, 0.72);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }

  .status-row {
    display: flex;
    gap: 5px;
  }

  .status-led {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #1a1a1a;
    box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.8);
  }

  .status-led.on[data-tone="power"] {
    background: #34d399;
    box-shadow: 0 0 8px rgba(52, 211, 153, 0.85);
  }

  .status-led.on[data-tone="link"] {
    background: #60a5fa;
    box-shadow: 0 0 8px rgba(96, 165, 250, 0.85);
  }

  .status-led.on[data-tone="hub"] {
    background: #fbbf24;
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.75);
  }

  .ribbon {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .ribbon-pins {
    width: 100%;
    height: 8px;
    border-radius: 1px;
    background:
      repeating-linear-gradient(
        90deg,
        #d4d4d8 0 2px,
        #27272a 2px 3px
      );
  }

  .ribbon-cable {
    width: 70%;
    height: 18px;
    border-radius: 0 0 2px 2px;
    background: linear-gradient(90deg, #7f1d1d, #b91c1c 40%, #7f1d1d);
    opacity: 0.9;
  }

  .usb-port {
    height: 6px;
    border-radius: 1px;
    background: #0a0a0a;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  @container (max-width: 520px) {
    .led-face {
      grid-template-columns: 1fr;
    }

    .controller {
      flex-direction: row;
      align-items: center;
      gap: 12px;
      padding: 8px 10px;
    }

    .ribbon {
      margin-top: 0;
      flex-direction: row;
    }

    .ribbon-cable {
      width: 36px;
      height: 10px;
      border-radius: 2px;
    }
  }
</style>
