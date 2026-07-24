<script lang="ts">
  import { onMount } from "svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import {
    buildSlotSnapshot,
    cards,
    dashboardStatus,
    getActiveScene,
    primaryDevice,
    rules,
    sources,
    telemetry,
  } from "$lib/convex";
  import Health from "$lib/device/Health.svelte";
  import Mirror from "$lib/device/Mirror.svelte";
  import PowerMeter from "$lib/device/PowerMeter.svelte";

  let nowMs = $state(Date.now());

  onMount(() => {
    const timer = window.setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => window.clearInterval(timer);
  });

  let device = $derived($primaryDevice);
  let scene = $derived(device ? getActiveScene(device) : null);
  let activeCard = $derived.by(() => {
    if (!device) return $cards[0] ?? null;
    if (device.pinnedCardId) return $cards.find((card) => card._id === device.pinnedCardId) ?? null;
    const firstCardId = scene?.cardIds[0];
    return $cards.find((card) => card._id === firstCardId) ?? $cards[0] ?? null;
  });
  let snapshot = $derived(
    activeCard
      ? buildSlotSnapshot(activeCard.slotMap, {
          device,
          nowMs,
          sources: $sources,
          telemetry: $telemetry,
        })
      : { byIndex: {}, byPath: {} },
  );
  let statusLabel = $derived(
    $dashboardStatus.mode + ($dashboardStatus.lastError ? " / fallback" : ""),
  );
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
  <div class="flex flex-col gap-4">
    <Card.Root class="shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_40px_rgba(0,0,0,0.28)]">
      <Card.Header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge tone={device?.online ? "success" : "destructive"}>
              {device?.online ? "online" : "offline"}
            </StatusBadge>
            <StatusBadge tone="warning">{scene?.name ?? "no-scene"}</StatusBadge>
          </div>
          <Card.Title class="text-xl">{device?.name ?? "Wall Matrix Panel"}</Card.Title>
          <Card.Description>
            Active scene queue, live mirror, and device runtime telemetry.
          </Card.Description>
        </div>
        <div class="grid w-full gap-2 sm:max-w-md sm:grid-cols-3">
          <StatTile label="Scene cards" value={scene?.cardIds.length ?? 0} />
          <StatTile label="Rules armed" value={$rules.filter((rule) => rule.enabled).length} />
          <StatTile label="Sources hot" value={$sources.length} />
        </div>
      </Card.Header>
    </Card.Root>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Mirror card={activeCard} nowMs={nowMs} snapshot={snapshot} />
      <div class="flex flex-col gap-4">
        <Health device={device} statusLabel={statusLabel} telemetry={$telemetry} />
        <PowerMeter amps={$telemetry.estAmps} budget={4} label="telemetry draw" />
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <Card.Root>
      <Card.Header class="flex-row items-start justify-between gap-3">
        <div>
          <Card.Title>Scene queue</Card.Title>
          <Card.Description>Cards in the currently active scene.</Card.Description>
        </div>
        <StatusBadge tone="success">{scene?.name ?? "idle"}</StatusBadge>
      </Card.Header>
      <Card.Content class="flex flex-col gap-2">
        {#if scene}
          {#each scene.cardIds as cardId, index (cardId)}
            {@const card = $cards.find((entry) => entry._id === cardId)}
            <a
              class="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/10 transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-muted/50 hover:ring-foreground/20 active:scale-[0.99]"
              href={card ? `/cards/${card.slug}` : "/cards"}
            >
              <div class="min-w-0">
                <div class="truncate font-medium">{card?.name ?? cardId}</div>
                <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {card?.slug ?? "unknown"}
                </div>
              </div>
              <StatusBadge tone="warning">#{index + 1}</StatusBadge>
            </a>
          {/each}
        {:else}
          <Empty.Root class="border-none py-6">
            <Empty.Header>
              <Empty.Title>No active scene</Empty.Title>
              <Empty.Description>Select a scene to populate the queue.</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Source freshness</Card.Title>
        <Card.Description>Oldest data tends to show up here first.</Card.Description>
      </Card.Header>
      <Card.Content class="flex flex-col gap-2">
        {#each [...$sources].sort((left, right) => left.fetchedAt - right.fetchedAt).slice(0, 6) as source (source._id)}
          <div class="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5 ring-1 ring-foreground/10">
            <div class="min-w-0">
              <div class="truncate font-medium">{source.sourceId}</div>
              <div class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{source.kind}</div>
            </div>
            <StatusBadge tone="warning" class="tabular">
              {Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000))}s
            </StatusBadge>
          </div>
        {/each}
      </Card.Content>
    </Card.Root>
  </div>
</div>
