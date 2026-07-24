<script lang="ts">
  import { onMount } from "svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import {
    buildSlotSnapshot,
    cards,
    dashboardStatus,
    getActiveScene,
    primaryDevice,
    rules,
    scenes,
    sources,
    telemetry,
  } from "$lib/convex";
  import Health from "$lib/device/Health.svelte";
  import Mirror from "$lib/device/Mirror.svelte";
  import PowerMeter from "$lib/device/PowerMeter.svelte";
  import { modeLabel } from "$lib/mode-label";

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
    modeLabel($dashboardStatus.mode) + ($dashboardStatus.lastError ? " · Limited" : ""),
  );
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
  <div class="flex flex-col gap-4">
    <Card.Root class="shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_40px_rgba(0,0,0,0.28)]">
      <Card.Header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge tone={device?.online ? "success" : "destructive"}>
              {device?.online ? "Online" : "Offline"}
            </StatusBadge>
            <StatusBadge tone="warning">{scene?.name ?? "No Scene"}</StatusBadge>
          </div>
          <Card.Title class="text-xl">{device?.name ?? "Wall Matrix Panel"}</Card.Title>
          <Card.Description>
            See what’s on the panel and how it’s doing.
          </Card.Description>
        </div>
        <div class="grid w-full gap-2 sm:max-w-md sm:grid-cols-3">
          <StatTile label="Cards" value={scene?.cardIds.length ?? 0} />
          <StatTile label="Rules" value={$rules.filter((rule) => rule.enabled).length} />
          <StatTile label="Sources" value={$sources.length} />
        </div>
      </Card.Header>
    </Card.Root>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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
      <div class="flex flex-col gap-4">
        <Health device={device} statusLabel={statusLabel} telemetry={$telemetry} />
        <PowerMeter amps={$telemetry.estAmps} budget={4} label="Current draw" />
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <Card.Root>
      <Card.Header class="flex-row items-start justify-between gap-3">
        <div>
          <Card.Title>Scene Queue</Card.Title>
          <Card.Description>Cards in the active scene.</Card.Description>
        </div>
        <StatusBadge tone="success">{scene?.name ?? "Idle"}</StatusBadge>
      </Card.Header>
      <Card.Content>
        {#if scene}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-10">#</Table.Head>
                <Table.Head>Name</Table.Head>
                <Table.Head>Slug</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each scene.cardIds as cardId, index (cardId)}
                {@const card = $cards.find((entry) => entry._id === cardId)}
                <Table.Row>
                  <Table.Cell class="tabular-nums text-muted-foreground">{index + 1}</Table.Cell>
                  <Table.Cell class="max-w-[9rem] truncate font-medium">
                    <a
                      class="hover:underline"
                      href={card ? `/cards/${card.slug}` : "/cards"}
                    >
                      {card?.name ?? cardId}
                    </a>
                  </Table.Cell>
                  <Table.Cell class="max-w-[7rem] truncate font-mono text-[11px] text-muted-foreground">
                    {card?.slug ?? "unknown"}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {:else}
          <Empty.Root class="border-none py-6">
            <Empty.Header>
              <Empty.Title>No active scene</Empty.Title>
              <Empty.Description>Choose a scene to fill this queue.</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>Sources</Card.Title>
        <Card.Description>How recently each source updated.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Source</Table.Head>
              <Table.Head>Type</Table.Head>
              <Table.Head class="text-right">Age</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each [...$sources].sort((left, right) => left.fetchedAt - right.fetchedAt).slice(0, 6) as source (source._id)}
              <Table.Row>
                <Table.Cell class="max-w-[8rem] truncate font-medium">{source.sourceId}</Table.Cell>
                <Table.Cell class="max-w-[6rem] truncate font-mono text-[11px] text-muted-foreground">
                  {source.kind}
                </Table.Cell>
                <Table.Cell class="text-right tabular-nums text-muted-foreground">
                  {Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000))}s
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  </div>
</div>
