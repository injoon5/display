<script lang="ts">
  import { resolve } from "$app/paths";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { cards, dashboardStatus, resetMockState, seedLiveDemo } from "$lib/convex";
  import { modeLabel } from "$lib/mode-label";

  let actionMessage = $state<string | null>(null);

  async function handleSeed(): Promise<void> {
    actionMessage = null;
    try {
      await seedLiveDemo();
      actionMessage = "Sample data loaded.";
    } catch {
      actionMessage = "Couldn’t load sample data.";
    }
  }

  function handleReset(): void {
    resetMockState();
    actionMessage = "Data reset.";
  }

  let status = $derived($dashboardStatus);

  function modeTone(mode: string): "success" | "warning" | "secondary" {
    switch (mode) {
      case "live":
        return "success";
      case "degraded":
        return "warning";
      case "mock":
        return "secondary";
      default:
        return "warning";
    }
  }
</script>

<header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <StatusBadge tone={modeTone(status.mode)}>{modeLabel(status.mode)}</StatusBadge>
    </div>
    <h1 class="text-xl font-semibold tracking-tight">Cards</h1>
    <p class="text-sm text-muted-foreground">
      Layouts that can appear on your panel.
    </p>
  </div>
  <div class="flex flex-wrap gap-2">
    <Button
      class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
      onclick={handleSeed}
      variant="secondary"
    >
      Load Sample Data
    </Button>
    <Button
      class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
      onclick={handleReset}
      variant="outline"
    >
      Reset
    </Button>
  </div>
</header>

{#if actionMessage}
  <Alert.Root class="mt-4">
    <Alert.Description>{actionMessage}</Alert.Description>
  </Alert.Root>
{/if}

{#if $cards.length === 0}
  <Empty.Root class="mt-4">
    <Empty.Header>
      <Empty.Title>No cards yet</Empty.Title>
      <Empty.Description>Load sample data to see your first cards.</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="mt-4 overflow-hidden rounded-xl border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="text-right">Slots</Table.Head>
          <Table.Head class="text-right">Amps</Table.Head>
          <Table.Head class="text-right">Priority</Table.Head>
          <Table.Head>Sources</Table.Head>
          <Table.Head class="text-right">
            <span class="sr-only">Open</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each $cards as card (card._id)}
          <Table.Row>
            <Table.Cell>
              <a
                class="font-medium hover:underline"
                href={resolve("/cards/[slug]", { slug: card.slug })}
              >
                {card.name}
              </a>
              <p class="mt-0.5 font-mono text-xs text-muted-foreground">{card.slug}</p>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge tone={card.enabled ? "success" : "destructive"}>
                {card.enabled ? "Enabled" : "Disabled"}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.slotMap.length}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.estimatedAmps.toFixed(2)}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.priority}</Table.Cell>
            <Table.Cell>
              <div class="flex flex-wrap gap-1.5">
                {#each card.sourceRefs as sourceId (sourceId)}
                  <StatusBadge tone="warning">{sourceId}</StatusBadge>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/each}
              </div>
            </Table.Cell>
            <Table.Cell class="text-right">
              <Button
                href={resolve("/cards/[slug]", { slug: card.slug })}
                size="sm"
                variant="ghost"
              >
                Open
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
