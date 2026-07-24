<script lang="ts">
  import { onMount } from "svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import {
    buildSlotSnapshot,
    cards,
    dashboardStatus,
    getActiveScene,
    primaryDevice,
    scenes,
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
    $dashboardStatus.mode === "degraded"
      ? "Limited"
      : $dashboardStatus.mode === "mock"
        ? "Demo"
        : "Live",
  );
  let freshSources = $derived(
    [...$sources].sort((left, right) => left.fetchedAt - right.fetchedAt).slice(0, 5),
  );
</script>

<section class="flex flex-col gap-6" aria-labelledby="device-title">
  <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge tone={device?.online ? "success" : "destructive"}>
          {device?.online ? "Online" : "Offline"}
        </StatusBadge>
        <StatusBadge tone="warning">{scene?.name ?? "No Scene"}</StatusBadge>
      </div>
      <h1 id="device-title" class="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {device?.name ?? "Wall Matrix Panel"}
      </h1>
      <p class="mt-1 max-w-xl text-sm text-muted-foreground text-pretty">
        See what’s on the panel and how it’s doing.
      </p>
    </div>
  </header>

  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
    <div class="device-stage surface overflow-hidden rounded-2xl p-4 md:p-5">
      <Mirror
        card={activeCard}
        cards={$cards}
        device={device}
        nowMs={nowMs}
        scene={scene}
        scenes={$scenes}
        snapshot={snapshot}
        telemetry={$telemetry}
      />
    </div>

    <aside class="flex flex-col gap-4">
      <Health device={device} nowMs={nowMs} statusLabel={statusLabel} telemetry={$telemetry} />
      <PowerMeter amps={$telemetry.estAmps} budget={4} label="Current draw" />

      <section class="glass rounded-2xl p-4" aria-labelledby="queue-title">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="queue-title" class="text-sm font-semibold tracking-tight">Scene Queue</h2>
            <p class="mt-0.5 text-xs text-muted-foreground">Cards in the active scene.</p>
          </div>
          <StatusBadge tone="success">{scene?.name ?? "Idle"}</StatusBadge>
        </div>

        {#if scene && scene.cardIds.length > 0}
          <ol class="flex flex-col gap-1">
            {#each scene.cardIds as cardId, index (cardId)}
              {@const card = $cards.find((entry) => entry._id === cardId)}
              <li>
                <a
                  class="press flex min-h-10 items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover-device:hover:bg-white/5 focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={card ? `/cards/${card.slug}` : "/cards"}
                >
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-medium">{card?.name ?? cardId}</span>
                    <span class="block truncate font-mono text-[11px] text-muted-foreground">
                      {card?.slug ?? "unknown"}
                    </span>
                  </span>
                  <span class="tabular-nums text-xs text-muted-foreground">{index + 1}</span>
                </a>
              </li>
            {/each}
          </ol>
        {:else}
          <Empty.Root class="border-none py-4">
            <Empty.Header>
              <Empty.Title>No active scene</Empty.Title>
              <Empty.Description>Choose a scene to fill this queue.</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}
      </section>

      <section class="glass rounded-2xl p-4" aria-labelledby="sources-title">
        <div class="mb-3">
          <h2 id="sources-title" class="text-sm font-semibold tracking-tight">Sources</h2>
          <p class="mt-0.5 text-xs text-muted-foreground">How recently each source updated.</p>
        </div>
        <ul class="flex flex-col gap-1">
          {#each freshSources as source (source._id)}
            <li
              class="flex min-h-10 items-center justify-between gap-3 rounded-xl px-2.5 py-2"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{source.sourceId}</span>
                <span class="block truncate font-mono text-[11px] text-muted-foreground">
                  {source.kind}
                </span>
              </span>
              <span class="tabular-nums text-xs text-muted-foreground">
                {Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000))}s
              </span>
            </li>
          {:else}
            <li class="px-2.5 py-3 text-sm text-muted-foreground">No sources yet.</li>
          {/each}
        </ul>
      </section>
    </aside>
  </div>
</section>
