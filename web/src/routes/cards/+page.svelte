<script lang="ts">
  import { resolve } from "$app/paths";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { cards, resetMockState } from "$lib/convex";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import { toast } from "svelte-sonner";

  function handleReset(): void {
    resetMockState();
    toast.success("Sample data reset.");
  }
</script>

<div class="flex flex-wrap items-end justify-between gap-3">
  <div class="min-w-0">
    <h2 class="text-sm font-semibold tracking-tight">All cards</h2>
    <p class="mt-0.5 text-xs text-muted-foreground">
      {$cards.length}
      {$cards.length === 1 ? "card" : "cards"} · open one to edit and publish it.
    </p>
  </div>
  <Button onclick={handleReset} size="sm" variant="outline">Reset data</Button>
</div>

{#if $cards.length === 0}
  <Empty.Root class="surface">
    <Empty.Header>
      <Empty.Media variant="icon">
        <LayersIcon />
      </Empty.Media>
      <Empty.Title>No cards yet</Empty.Title>
      <Empty.Description>Load sample data to see your first cards.</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="surface overflow-hidden">
    <Table.Root>
      <Table.Header>
        <Table.Row class="hover:bg-transparent">
          <Table.Head class="pl-4">Name</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="text-right">Slots</Table.Head>
          <Table.Head class="text-right">Amps</Table.Head>
          <Table.Head class="text-right">Priority</Table.Head>
          <Table.Head>Sources</Table.Head>
          <Table.Head class="w-[1%] pr-3 text-right">
            <span class="sr-only">Open</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each $cards as card (card._id)}
          <Table.Row class="group last:border-b-0">
            <Table.Cell class="py-2.5 pl-4">
              <a
                class="rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 hover-device:hover:underline"
                href={resolve("/cards/[slug]", { slug: card.slug })}
              >
                {card.name}
              </a>
              <p class="mt-0.5 font-mono text-xs text-muted-foreground">{card.slug}</p>
            </Table.Cell>
            <Table.Cell>
              <StatusBadge tone={card.enabled ? "neutral" : "warning"}>
                {card.enabled ? "Enabled" : "Disabled"}
              </StatusBadge>
            </Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.slotMap.length}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.estimatedAmps.toFixed(2)}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">{card.priority}</Table.Cell>
            <Table.Cell>
              <div class="flex flex-wrap gap-1.5">
                {#each card.sourceRefs as sourceId (sourceId)}
                  <StatusBadge tone="mono">{sourceId}</StatusBadge>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/each}
              </div>
            </Table.Cell>
            <Table.Cell class="pr-3 text-right">
              <Button
                aria-label="Open {card.name}"
                href={resolve("/cards/[slug]", { slug: card.slug })}
                size="icon-sm"
                variant="ghost"
              >
                <ChevronRightIcon
                  class="text-muted-foreground transition-transform duration-150 ease-[var(--ease-out)] group-hover:translate-x-0.5"
                />
              </Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
