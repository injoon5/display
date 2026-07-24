<script lang="ts">
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { sources, writeSource, type DashboardSource } from "$lib/convex";

  let selectedSourceId = $state<string | null>(null);
  let draftJson = $state("{}");
  let lastLoaded = $state<string | null>(null);
  let message = $state<string | null>(null);

  $effect(() => {
    if (!selectedSourceId && $sources[0]) {
      selectedSourceId = $sources[0].sourceId;
    }
    const selected = $sources.find((source) => source.sourceId === selectedSourceId) ?? null;
    if (!selected || selected.sourceId === lastLoaded) {
      return;
    }
    draftJson = JSON.stringify(selected.data, null, 2);
    lastLoaded = selected.sourceId;
  });

  let selected = $derived($sources.find((source) => source.sourceId === selectedSourceId) ?? null);

  function bumpDemoPayload(source: DashboardSource): Record<string, unknown> {
    switch (source.sourceId) {
      case "bus":
        return { ...source.data, eta_min: Math.max(1, Number(source.data.eta_min ?? 5) - 1) };
      case "air":
        return { ...source.data, pm25: Number(source.data.pm25 ?? 18) + 5 };
      case "wx":
        return { ...source.data, tempC: Number(source.data.tempC ?? 27) + 0.3 };
      default:
        return { ...source.data };
    }
  }

  async function handleWrite(): Promise<void> {
    if (!selected) {
      return;
    }
    const parsed = JSON.parse(draftJson) as Record<string, unknown>;
    await writeSource({
      data: parsed,
      intervalMs: selected.intervalMs,
      kind: selected.kind,
      origin: selected.origin,
      sourceId: selected.sourceId
    });
    message = `Saved data for ${selected.sourceId}.`;
  }

  async function handleTestFetch(): Promise<void> {
    if (!selected) {
      return;
    }
    const nextPayload = bumpDemoPayload(selected);
    draftJson = JSON.stringify(nextPayload, null, 2);
    await writeSource({
      data: nextPayload,
      intervalMs: selected.intervalMs,
      kind: selected.kind,
      origin: selected.origin,
      sourceId: selected.sourceId
    });
    message = `Refreshed ${selected.sourceId}.`;
  }
</script>

<header class="mb-4 flex flex-col gap-1">
  <h1 class="text-xl font-semibold tracking-tight">Sources</h1>
  <p class="text-sm text-muted-foreground">View and update the data each card reads.</p>
</header>

<div class="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
  <section class="overflow-hidden rounded-xl border bg-card/40">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold">All sources</h2>
      <p class="mt-1 text-sm text-muted-foreground">Select a source to inspect.</p>
    </div>
    {#if $sources.length === 0}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Title>No sources</Empty.Title>
          <Empty.Description>Load sample data to populate sources.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Source</Table.Head>
            <Table.Head>Kind</Table.Head>
            <Table.Head class="text-right">Interval</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each $sources as source (source._id)}
            <Table.Row
              class="cursor-pointer"
              data-state={selectedSourceId === source.sourceId ? "selected" : undefined}
              aria-selected={selectedSourceId === source.sourceId}
              onclick={() => (selectedSourceId = source.sourceId)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectedSourceId = source.sourceId;
                }
              }}
              tabindex={0}
            >
              <Table.Cell class="font-medium">{source.sourceId}</Table.Cell>
              <Table.Cell class="font-mono text-xs text-muted-foreground">{source.kind}</Table.Cell>
              <Table.Cell class="text-right tabular-nums">{source.intervalMs / 1000}s</Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </section>

  <Card.Root>
    {#if selected}
      <Card.Header class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="flex flex-col gap-1.5">
          <Card.Title class="text-xl">{selected.sourceId}</Card.Title>
          <Card.Description>
            Origin {selected.origin} · interval
            <span class="tabular-nums">{selected.intervalMs / 1000}</span>s
          </Card.Description>
        </div>
        <div class="flex gap-2">
          <Button
            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
            onclick={handleTestFetch}
            variant="secondary"
          >
            Refresh
          </Button>
          <Button
            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
            onclick={handleWrite}
          >
            Save
          </Button>
        </div>
      </Card.Header>

      <Card.Content class="flex flex-col gap-4">
        {#if message}
          <Alert.Root>
            <Alert.Description>{message}</Alert.Description>
          </Alert.Root>
        {/if}

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div class="flex flex-col gap-1.5">
            <Label for="source-payload">Data</Label>
            <Textarea
              id="source-payload"
              class="min-h-[28rem] font-mono text-sm"
              bind:value={draftJson}
            />
          </div>

          <div class="flex flex-col gap-3">
            <div class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm font-semibold text-muted-foreground">Config</p>
              <pre class="mt-3 overflow-auto font-mono text-xs">{JSON.stringify(selected.config, null, 2)}</pre>
            </div>
            <Separator />
            <div class="rounded-lg border bg-muted/20 p-3">
              <p class="text-sm font-semibold text-muted-foreground">Health</p>
              <div class="mt-3 grid gap-2">
                <StatTile label="Failures" value={selected.consecutiveFailures} />
                <StatTile label="Last updated" value={new Date(selected.fetchedAt).toLocaleTimeString()} />
                <StatTile label="Status" value={selected.circuitOpenUntil ? "Paused" : "Active"} />
              </div>
            </div>
          </div>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-12">
        <Empty.Header>
          <Empty.Title>Select a source to view its data.</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
