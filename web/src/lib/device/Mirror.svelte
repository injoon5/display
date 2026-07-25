<script lang="ts">
  import { compile } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import {
    activateScene,
    pinCard,
    poke,
    simulateTelemetry,
    unpinCard,
    type DashboardCard,
    type DashboardDevice,
    type DashboardScene,
    type DashboardTelemetry,
    type SlotSnapshot,
  } from "$lib/convex";
  import LedMatrixPanel from "$lib/device/LedMatrixPanel.svelte";
  import { initMxrWasm, MXR_DIMENSIONS, render, type RenderHotspot } from "$lib/mxr";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";

  type Props = {
    card: DashboardCard | null;
    cards: DashboardCard[];
    device: DashboardDevice | null;
    nowMs: number;
    scene: DashboardScene | null;
    scenes: DashboardScene[];
    snapshot: SlotSnapshot;
    telemetry: DashboardTelemetry;
  };

  let { card, cards, device, nowMs, scene, scenes, snapshot, telemetry }: Props = $props();

  let mirrorNow = $state(Date.now());
  let pokeMessage = $state("hey — look at the wall");
  let busy = $state<string | null>(null);
  let wasmEpoch = $state(0);

  const HOMEKIT_SWITCHES = [
    { label: "Bus 402", slug: "bus-402" },
    { label: "Weather", slug: "weather" },
    { label: "Clock", slug: "clock" },
    { label: "Indoor", slug: "indoor" },
    { label: "Air", slug: "air" },
    { label: "Calendar", slug: "calendar-next" },
  ] as const;

  let pitch = $state(10);

  // Local echo so the slider tracks the pointer 1:1; the device only hears about
  // it on release.
  let brightnessDraft = $state<number | null>(null);
  let brightnessValue = $derived(brightnessDraft ?? telemetry.brightness);

  $effect(() => {
    mirrorNow = nowMs;
  });

  onMount(() => {
    void initMxrWasm().then(() => {
      wasmEpoch += 1;
    });
    const syncPitch = () => {
      pitch = window.innerWidth < 720 ? 7 : 10;
    };
    syncPitch();
    window.addEventListener("resize", syncPitch);
    const timer = window.setInterval(() => {
      mirrorNow = Date.now();
    }, 500);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", syncPitch);
    };
  });

  let compiled = $derived.by(() => {
    if (!card) return null;
    return compile(card.source);
  });

  let frame = $derived.by(() => {
    void wasmEpoch;
    if (!compiled || !card) {
      return {
        framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
        height: MXR_DIMENSIONS.height,
        hotspots: [] as RenderHotspot[],
        mode: "bytecode" as const,
        warnings: [] as string[],
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

  async function runAction(label: string, action: () => Promise<void>): Promise<void> {
    if (!device) {
      toast.error("No panel connected");
      return;
    }
    busy = label;
    try {
      await action();
      toast.success(label);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      busy = null;
    }
  }

  function cardBySlug(slug: string): DashboardCard | null {
    return cards.find((entry) => entry.slug === slug) ?? null;
  }

  function resolveHotspotCard(hotspot: RenderHotspot): DashboardCard | null {
    const bySource = cards.find((entry) => entry.sourceRefs.includes(hotspot.sourceId));
    if (bySource) return bySource;
    return (
      cards.find(
        (entry) =>
          entry.slug === hotspot.sourceId ||
          entry.slug.includes(hotspot.sourceId) ||
          hotspot.path.includes(entry.slug),
      ) ?? null
    );
  }

  async function pinSlug(slug: string, durationMs = 60_000): Promise<void> {
    if (!device) return;
    const target = cardBySlug(slug);
    if (!target) throw new Error(`Card ${slug} not found`);
    await pinCard({ cardId: target._id, deviceId: device._id, durationMs });
  }

  async function handleDoubleTap(): Promise<void> {
    if (!device || !scene) {
      toast.message("Nothing to advance yet");
      return;
    }

    const queue = scene.cardIds
      .map((id) => cards.find((entry) => entry._id === id))
      .filter((entry): entry is DashboardCard => Boolean(entry));
    if (queue.length === 0) return;

    const currentId = device.pinnedCardId ?? card?._id ?? queue[0]?._id;
    const currentIndex = Math.max(
      0,
      queue.findIndex((entry) => entry._id === currentId),
    );
    const next = queue[(currentIndex + 1) % queue.length];
    if (!next) return;

    await runAction(`Next: ${next.slug}`, async () => {
      await pinCard({ cardId: next._id, deviceId: device._id, durationMs: 30_000 });
    });
  }

  async function handleHotspot(hotspot: RenderHotspot): Promise<void> {
    const related = resolveHotspotCard(hotspot);
    if (!device || !related) {
      toast.message(`Pinned area: ${hotspot.path}`);
      return;
    }
    await runAction(`Pinned ${related.slug}`, async () => {
      await pinCard({ cardId: related._id, deviceId: device._id, durationMs: 60_000 });
    });
  }

  async function handleBrightness(value: number): Promise<void> {
    if (!device) {
      brightnessDraft = null;
      return;
    }
    try {
      await runAction(`Brightness set to ${value}%`, async () => {
        await simulateTelemetry({ brightness: value, deviceId: device._id });
      });
    } finally {
      brightnessDraft = null;
    }
  }

  async function handlePresence(value: boolean): Promise<void> {
    if (!device) return;
    await runAction(`Room ${value ? "occupied" : "empty"}`, async () => {
      await simulateTelemetry({
        deviceId: device._id,
        presenceRoom: value,
      });
    });
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
    <div class="min-w-0">
      <h2 class="truncate text-sm font-semibold tracking-tight">
        {device?.name ?? "Wall Matrix Panel"}
      </h2>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Double-click the panel to advance. Click a hotspot to pin it.
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-end gap-1.5">
      <StatusBadge tone="neutral">{scene?.name ?? "No scene"}</StatusBadge>
      <StatusBadge tone="mono">{card?.slug ?? "no card"}</StatusBadge>
      {#if device?.pinnedCardId}
        <StatusBadge tone="warning">Pinned</StatusBadge>
      {/if}
    </div>
  </div>

  <LedMatrixPanel
    brightness={brightnessValue}
    framebuffer={frame.framebuffer}
    hotspots={frame.hotspots}
    online={device?.online ?? false}
    {pitch}
    ondoubletap={() => void handleDoubleTap()}
    onhotspot={(hotspot) => void handleHotspot(hotspot)}
  />

  <div class="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
    <div class="panel-inset flex flex-wrap items-center gap-2 p-2">
      <Button
        disabled={!device || busy !== null}
        size="sm"
        variant="secondary"
        onclick={() => void handleDoubleTap()}
      >
        Next card
      </Button>
      <Button
        disabled={!device?.pinnedCardId || busy !== null}
        size="sm"
        variant="outline"
        onclick={() =>
          void runAction("Unpin", async () => {
            if (!device) return;
            await unpinCard(device._id);
          })}
      >
        Unpin
      </Button>
    </div>

    <div class="panel-inset flex flex-col justify-center gap-1.5 px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <Label for="mirror-brightness" class="text-xs font-medium text-muted-foreground">
          Brightness
        </Label>
        <span class="text-xs tabular-nums text-muted-foreground">
          {brightnessValue}% · {telemetry.lux} lux
        </span>
      </div>
      <input
        id="mirror-brightness"
        class="h-6 w-full accent-foreground"
        disabled={!device || busy !== null}
        max="100"
        min="0"
        type="range"
        value={brightnessValue}
        oninput={(event) => {
          brightnessDraft = Number(event.currentTarget.value);
        }}
        onchange={(event) => {
          void handleBrightness(Number(event.currentTarget.value));
        }}
      />
    </div>
  </div>

  <div class="flex flex-wrap gap-2" role="group" aria-label="Quick pins">
    {#each HOMEKIT_SWITCHES as item (item.slug)}
      {@const active = card?.slug === item.slug}
      <Button
        aria-pressed={active}
        disabled={!device || !cardBySlug(item.slug) || busy !== null}
        size="sm"
        variant={active ? "default" : "outline"}
        onclick={() =>
          void runAction(`Pinned ${item.label}`, async () => {
            await pinSlug(item.slug, 60_000);
          })}
      >
        {item.label}
      </Button>
    {/each}
  </div>

  <details class="panel-inset group">
    <summary
      class="press flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium tracking-tight outline-none marker:content-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
    >
      <span>More controls</span>
      <ChevronDownIcon
        class="size-4 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>

    <div class="flex flex-col gap-4 border-t border-border px-3 py-3">
      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-muted-foreground">Scenes</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Scenes">
          {#each scenes as entry (entry._id)}
            {@const active = scene?._id === entry._id}
            <Button
              aria-pressed={active}
              disabled={!device || busy !== null}
              size="sm"
              variant={active ? "default" : "outline"}
              onclick={() =>
                void runAction(`Scene ${entry.name}`, async () => {
                  if (!device) return;
                  await activateScene({ deviceId: device._id, sceneId: entry._id });
                })}
            >
              {entry.name}
            </Button>
          {/each}
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-muted-foreground">Presence</p>
        <div>
          <Button
            aria-pressed={telemetry.presenceRoom}
            disabled={!device || busy !== null}
            size="sm"
            variant={telemetry.presenceRoom ? "default" : "outline"}
            onclick={() => void handlePresence(!telemetry.presenceRoom)}
          >
            Room {telemetry.presenceRoom ? "occupied" : "empty"}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div class="flex w-full flex-col gap-1.5">
          <Label for="poke-message">Message</Label>
          <Input
            id="poke-message"
            bind:value={pokeMessage}
            maxlength={48}
            placeholder="Show a message on the panel"
          />
        </div>
        <Button
          class="w-full sm:w-auto"
          disabled={!device || !pokeMessage.trim() || busy !== null}
          size="sm"
          onclick={() =>
            void runAction("Message sent", async () => {
              if (!device) return;
              await poke({
                deviceId: device._id,
                durationMs: 10_000,
                message: pokeMessage,
              });
            })}
        >
          Send
        </Button>
      </div>
    </div>
  </details>
</div>
