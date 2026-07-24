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
  let lastAction = $state<string | null>(null);
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
      lastAction = label;
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
    if (!device) return;
    await runAction(`Brightness set to ${value}%`, async () => {
      await simulateTelemetry({ brightness: value, deviceId: device._id });
    });
  }

  async function handlePresence(kind: "room" | "bed", value: boolean): Promise<void> {
    if (!device) return;
    await runAction(`${kind === "room" ? "Room" : "Bed"} ${value ? "occupied" : "empty"}`, async () => {
      await simulateTelemetry({
        deviceId: device._id,
        ...(kind === "room" ? { presenceRoom: value } : { presenceBed: value }),
      });
    });
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 class="text-sm font-semibold tracking-tight">Live View</h2>
      <p class="mt-0.5 text-xs text-muted-foreground">
        Double-click to advance. Click a hotspot to pin.
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <StatusBadge tone="warning">{card?.slug ?? "No Card"}</StatusBadge>
      {#if device?.pinnedCardId}
        <StatusBadge tone="success">Pinned</StatusBadge>
      {/if}
    </div>
  </div>

  <LedMatrixPanel
    brightness={telemetry.brightness}
    framebuffer={frame.framebuffer}
    hotspots={frame.hotspots}
    online={device?.online ?? false}
    pitch={pitch}
    ondoubletap={() => void handleDoubleTap()}
    onhotspot={(hotspot) => void handleHotspot(hotspot)}
  />

  <div class="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
    <div class="glass flex min-h-10 flex-wrap items-center gap-2 rounded-xl px-3 py-2">
      <Button
        disabled={!device || busy !== null}
        variant="secondary"
        onclick={() => void handleDoubleTap()}
      >
        Next Card
      </Button>
      <Button
        disabled={!device?.pinnedCardId || busy !== null}
        variant="outline"
        onclick={() =>
          void runAction("Unpin", async () => {
            if (!device) return;
            await unpinCard(device._id);
          })}
      >
        Unpin
      </Button>
      {#if lastAction}
        <p class="w-full font-mono text-[11px] text-muted-foreground">Last: {lastAction}</p>
      {/if}
    </div>

    <div class="glass flex min-h-10 flex-col justify-center gap-1.5 rounded-xl px-3 py-2">
      <div class="flex items-center justify-between gap-3">
        <Label for="mirror-brightness" class="text-xs font-medium text-muted-foreground">
          Brightness
        </Label>
        <span class="tabular-nums text-xs text-muted-foreground">
          {telemetry.brightness}% · lux {telemetry.lux}
        </span>
      </div>
      <input
        id="mirror-brightness"
        aria-label="Brightness"
        class="press h-10 w-full accent-foreground"
        disabled={!device || busy !== null}
        max="100"
        min="0"
        type="range"
        value={telemetry.brightness}
        onchange={(event) => {
          const value = Number((event.currentTarget as HTMLInputElement).value);
          void handleBrightness(value);
        }}
      />
    </div>
  </div>

  <div role="toolbar" aria-label="Quick Pins" class="flex flex-wrap gap-2">
    {#each HOMEKIT_SWITCHES as item (item.slug)}
      <Button
        disabled={!device || !cardBySlug(item.slug) || busy !== null}
        variant={card?.slug === item.slug ? "default" : "outline"}
        onclick={() =>
          void runAction(`Pinned ${item.label}`, async () => {
            await pinSlug(item.slug, 60_000);
          })}
      >
        {item.label}
      </Button>
    {/each}
  </div>

  <details class="glass group rounded-xl">
    <summary
      class="press flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium tracking-tight marker:content-none [&::-webkit-details-marker]:hidden"
    >
      <span>More Controls</span>
      <span
        class="text-xs text-muted-foreground transition-transform duration-150 group-open:rotate-180"
        aria-hidden="true">▾</span
      >
    </summary>

    <div class="flex flex-col gap-4 border-t border-white/5 px-3 py-3">
      <div class="flex flex-col gap-2">
        <div class="text-xs font-medium text-muted-foreground">Scenes</div>
        <div class="flex flex-wrap gap-2">
          {#each scenes as entry (entry._id)}
            <Button
              disabled={!device || busy !== null}
              variant={scene?._id === entry._id ? "default" : "outline"}
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
        <div class="text-xs font-medium text-muted-foreground">Presence</div>
        <div class="flex flex-wrap gap-2">
          <Button
            disabled={!device || busy !== null}
            variant={telemetry.presenceRoom ? "default" : "outline"}
            onclick={() => void handlePresence("room", !telemetry.presenceRoom)}
          >
            Room {telemetry.presenceRoom ? "Occupied" : "Empty"}
          </Button>
          <Button
            disabled={!device || busy !== null}
            variant={telemetry.presenceBed ? "default" : "outline"}
            onclick={() => void handlePresence("bed", !telemetry.presenceBed)}
          >
            Bed {telemetry.presenceBed ? "Occupied" : "Empty"}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-xs font-medium text-muted-foreground">Message</div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div class="grid w-full gap-1.5">
            <Label for="poke-message">Message</Label>
            <Input
              id="poke-message"
              bind:value={pokeMessage}
              class="min-h-10"
              maxlength={48}
              placeholder="Message"
            />
          </div>
          <Button
            disabled={!device || !pokeMessage.trim() || busy !== null}
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
    </div>
  </details>
</div>
