<script lang="ts">
  import { resolve } from "$app/paths";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { cards, dashboardStatus, resetMockState, seedLiveDemo } from "$lib/convex";

  let actionMessage = $state<string | null>(null);

  async function handleSeed(): Promise<void> {
    actionMessage = null;
    try {
      await seedLiveDemo();
      actionMessage = "Seeded dashboard data.";
    } catch (error) {
      actionMessage = error instanceof Error ? error.message : "Seed failed";
    }
  }

  function handleReset(): void {
    resetMockState();
    actionMessage = "Reset local mock store.";
  }

  let status = $derived($dashboardStatus);
</script>

<Card.Root class="shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_40px_rgba(0,0,0,0.28)]">
  <Card.Header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <StatusBadge tone="success">cards</StatusBadge>
        <StatusBadge tone={status.mode === "live" ? "success" : "warning"}>{status.mode}</StatusBadge>
      </div>
      <Card.Title class="text-xl">Card catalogue</Card.Title>
      <Card.Description>
        Seed set: bus-402, weather, air, clock, clock-dim, indoor, calendar-next, self-status.
      </Card.Description>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        onclick={handleSeed}
        variant="secondary"
      >
        Seed demo
      </Button>
      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        onclick={handleReset}
        variant="outline"
      >
        Reset mock
      </Button>
    </div>
  </Card.Header>
  {#if actionMessage}
    <Card.Content>
      <Alert.Root>
        <Alert.Description>{actionMessage}</Alert.Description>
      </Alert.Root>
    </Card.Content>
  {/if}
</Card.Root>

{#if $cards.length === 0}
  <Empty.Root class="mt-4">
    <Empty.Header>
      <Empty.Title>No cards yet</Empty.Title>
      <Empty.Description>Seed the demo catalogue to populate card definitions.</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
    {#each $cards as card (card._id)}
      <a
        class="rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] hover:bg-muted/50 hover:ring-foreground/20 active:scale-[0.99]"
        href={resolve("/cards/[slug]", { slug: card.slug })}
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold">{card.name}</h3>
            <p class="mt-1 font-mono text-xs text-muted-foreground">{card.slug}</p>
          </div>
          <StatusBadge tone={card.enabled ? "success" : "destructive"}>
            {card.enabled ? "enabled" : "disabled"}
          </StatusBadge>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-3">
          <StatTile label="slots" value={card.slotMap.length} />
          <StatTile label="amps" value={card.estimatedAmps.toFixed(2)} />
          <StatTile label="priority" value={card.priority} />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          {#each card.sourceRefs as sourceId (sourceId)}
            <StatusBadge tone="warning">{sourceId}</StatusBadge>
          {/each}
        </div>
      </a>
    {/each}
  </div>
{/if}
