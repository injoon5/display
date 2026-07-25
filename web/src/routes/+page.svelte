<script lang="ts">
  import { onMount } from "svelte";
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
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import LayersIcon from "@lucide/svelte/icons/layers";

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
    [...$sources].sort((left, right) => right.fetchedAt - left.fetchedAt).slice(0, 5),
  );

  function secondsAgo(fetchedAt: number): number {
    return Math.max(0, Math.round((nowMs - fetchedAt) / 1000));
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
  <div class="surface overflow-hidden p-4 md:p-5">
    <Mirror
      card={activeCard}
      cards={$cards}
      {device}
      {nowMs}
      {scene}
      scenes={$scenes}
      {snapshot}
      telemetry={$telemetry}
    />
  </div>

  <aside class="flex flex-col gap-4" aria-label="Panel health">
    <Health {device} {nowMs} {statusLabel} telemetry={$telemetry} />
    <PowerMeter amps={$telemetry.estAmps} budget={4} label="Current draw" />
  </aside>
</div>

<div class="grid gap-5 md:grid-cols-2">
  <section class="glass p-4" aria-labelledby="queue-title">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 id="queue-title" class="text-sm font-semibold tracking-tight">Scene queue</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">
          {scene ? `Cards in ${scene.name}` : "No scene is active."}
        </p>
      </div>
    </div>

    {#if scene && scene.cardIds.length > 0}
      <ol class="-mx-1 flex flex-col">
        {#each scene.cardIds as cardId, index (cardId)}
          {@const card = $cards.find((entry) => entry._id === cardId)}
          <li>
            <a
              class="press group flex min-h-10 items-center gap-3 rounded-md px-2 py-2 outline-none transition-[background-color] duration-150 ease-[var(--ease-out)] hover-device:hover:bg-foreground/[0.045] focus-visible:ring-3 focus-visible:ring-ring/50"
              href={card ? `/cards/${card.slug}` : "/cards"}
            >
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-sm bg-foreground/[0.06] text-[11px] font-medium tabular-nums text-muted-foreground"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{card?.name ?? cardId}</span>
                <span class="block truncate font-mono text-[11px] text-muted-foreground">
                  {card?.slug ?? "unknown"}
                </span>
              </span>
              <ChevronRightIcon
                class="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 ease-[var(--ease-out)] group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </a>
          </li>
        {/each}
      </ol>
    {:else}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Media variant="icon">
            <LayersIcon />
          </Empty.Media>
          <Empty.Title>No active scene</Empty.Title>
          <Empty.Description>Activate a scene to fill this queue.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </section>

  <section class="glass p-4" aria-labelledby="sources-title">
    <div class="mb-3">
      <h2 id="sources-title" class="text-sm font-semibold tracking-tight">Sources</h2>
      <p class="mt-0.5 text-xs text-muted-foreground">How recently each source updated.</p>
    </div>
    <ul class="-mx-1 flex flex-col">
      {#each freshSources as source (source._id)}
        <li class="flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-2">
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">{source.sourceId}</span>
            <span class="block truncate font-mono text-[11px] text-muted-foreground">
              {source.kind}
            </span>
          </span>
          <time
            class="shrink-0 text-xs tabular-nums text-muted-foreground"
            datetime={new Date(source.fetchedAt).toISOString()}
          >
            {secondsAgo(source.fetchedAt)}s ago
          </time>
        </li>
      {:else}
        <li class="px-2 py-3 text-sm text-muted-foreground">No sources yet.</li>
      {/each}
    </ul>
  </section>
</div>
