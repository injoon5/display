<script lang="ts">
  import { resolve } from "$app/paths";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { cards, resetMockState } from "$lib/convex";

  let actionMessage = $state<string | null>(null);

  function handleReset(): void {
    resetMockState();
    actionMessage = "Data reset.";
  }
</script>

<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div class="flex flex-col gap-1">
    <h1 class="text-xl font-semibold tracking-tight text-balance">Cards</h1>
    <p class="text-sm text-muted-foreground text-pretty">
      Layouts that can appear on your panel.
    </p>
  </div>
  <div class="flex flex-wrap gap-2">
    <Button class="press" onclick={handleReset} size="sm" variant="outline">Reset data</Button>
  </div>
</header>

{#if actionMessage}
  <Alert.Root>
    <Alert.Description>{actionMessage}</Alert.Description>
  </Alert.Root>
{/if}

{#if $cards.length === 0}
  <Empty.Root>
    <Empty.Header>
      <Empty.Title>No cards yet</Empty.Title>
      <Empty.Description>Load sample data to see your first cards.</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="overflow-hidden rounded-xl border bg-card/40">
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
