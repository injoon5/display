<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { sources, writeSource, type DashboardSource } from "$lib/convex";
  import { cn } from "$lib/utils.js";

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
    message = `Updated ${selected.sourceId}`;
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
    message = `Simulated fetch for ${selected.sourceId}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm tracking-[0.18em] uppercase">Sources</Card.Title>
      <Card.Description>Probe providers, inspect raw payloads, and poke test values.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-2">
      {#each $sources as source (source._id)}
        <button
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 ease-[var(--ease-out)] hover:bg-muted/50",
            selectedSourceId === source.sourceId ? "bg-muted/50 ring-foreground/20" : "bg-muted/30"
          )}
          onclick={() => (selectedSourceId = source.sourceId)}
          type="button"
        >
          <div class="min-w-0">
            <div class="truncate font-medium">{source.sourceId}</div>
            <div class="mt-1 font-mono text-[11px] text-muted-foreground">{source.kind}</div>
          </div>
          <StatusBadge class="tabular-nums" tone="warning">{source.intervalMs / 1000}s</StatusBadge>
        </button>
      {:else}
        <Empty.Root class="border-none py-6">
          <Empty.Header>
            <Empty.Title>No sources</Empty.Title>
            <Empty.Description>Seed demo data to populate providers.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Card.Content>
  </Card.Root>

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
            Test fetch
          </Button>
          <Button
            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
            onclick={handleWrite}
          >
            Write source
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
            <Label for="source-payload">raw payload</Label>
            <Textarea
              id="source-payload"
              class="min-h-[28rem] font-mono text-sm"
              bind:value={draftJson}
            />
          </div>

          <div class="flex flex-col gap-3">
            <div class="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
              <p class="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Config</p>
              <pre class="mt-3 overflow-auto font-mono text-xs">{JSON.stringify(selected.config, null, 2)}</pre>
            </div>
            <Separator />
            <div class="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
              <p class="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Health</p>
              <div class="mt-3 grid gap-2">
                <StatTile label="Failures" value={selected.consecutiveFailures} />
                <StatTile label="Fetched at" value={new Date(selected.fetchedAt).toLocaleTimeString()} />
                <StatTile label="Circuit" value={selected.circuitOpenUntil ? "open" : "closed"} />
              </div>
            </div>
          </div>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-12">
        <Empty.Header>
          <Empty.Title>Select a source</Empty.Title>
          <Empty.Description>Pick a provider to inspect and poke payloads.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
