<script lang="ts">
  import RecordPicker from "$lib/components/record-picker.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { sources, writeSource, type DashboardSource } from "$lib/convex";
  import RadioIcon from "@lucide/svelte/icons/radio";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { toast } from "svelte-sonner";

  let selectedSourceId = $state<string | null>(null);
  let draftJson = $state("{}");
  let lastLoaded = $state<string | null>(null);
  let busy = $state(false);

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
  let jsonError = $derived.by(() => {
    try {
      const parsed: unknown = JSON.parse(draftJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "Source data must be a JSON object.";
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON.";
    }
  });

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
    if (!selected || busy) {
      return;
    }
    if (jsonError) {
      toast.error(jsonError);
      return;
    }
    busy = true;
    try {
      const parsed = JSON.parse(draftJson) as Record<string, unknown>;
      await writeSource({
        data: parsed,
        intervalMs: selected.intervalMs,
        kind: selected.kind,
        origin: selected.origin,
        sourceId: selected.sourceId,
      });
      toast.success(`Saved data for ${selected.sourceId}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save source data.");
    } finally {
      busy = false;
    }
  }

  async function handleTestFetch(): Promise<void> {
    if (!selected || busy) {
      return;
    }
    busy = true;
    try {
      const nextPayload = bumpDemoPayload(selected);
      draftJson = JSON.stringify(nextPayload, null, 2);
      await writeSource({
        data: nextPayload,
        intervalMs: selected.intervalMs,
        kind: selected.kind,
        origin: selected.origin,
        sourceId: selected.sourceId,
      });
      toast.success(`Refreshed ${selected.sourceId}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t refresh source.");
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(260px,20rem)_minmax(0,1fr)]">
  <RecordPicker
    items={$sources}
    selectedId={selectedSourceId}
    getId={(source: DashboardSource) => source.sourceId}
    onselect={(id) => (selectedSourceId = id)}
    title="All sources"
    description="Select a source to inspect."
    emptyTitle="No sources"
    emptyDescription="Load sample data to populate sources."
    icon={RadioIcon}
  >
    {#snippet row(source: DashboardSource)}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{source.sourceId}</span>
        <span class="block truncate font-mono text-[11px] text-muted-foreground">
          {source.kind}
        </span>
      </span>
      <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
        {source.intervalMs / 1000}s
      </span>
    {/snippet}
  </RecordPicker>

  <Card.Root>
    {#if selected}
      <Card.Header>
        <Card.Title class="text-base" level={2}>{selected.sourceId}</Card.Title>
        <Card.Description>
          Origin {selected.origin} · refreshes every
          <span class="tabular-nums">{selected.intervalMs / 1000}</span>s
        </Card.Description>
        <Card.Action class="flex gap-2">
          <Button disabled={busy} onclick={handleTestFetch} variant="secondary">
            {#if busy}
              <Spinner aria-label="" />
            {:else}
              <RefreshCwIcon />
            {/if}
            Refresh
          </Button>
          <Button disabled={busy || jsonError !== null} onclick={handleWrite}>Save</Button>
        </Card.Action>
      </Card.Header>

      <Card.Content class="@container/panel grid items-start gap-4 @2xl/panel:grid-cols-[minmax(0,1fr)_17rem]">
        <div class="flex flex-col gap-1.5">
          <Label for="source-payload">Data</Label>
          <Textarea
            id="source-payload"
            aria-describedby={jsonError ? "source-payload-error" : undefined}
            aria-invalid={jsonError !== null}
            class="min-h-[26rem] font-mono text-sm"
            bind:value={draftJson}
          />
          <p
            id="source-payload-error"
            class="min-h-4 text-xs text-destructive"
            role="status"
            aria-live="polite"
          >
            {jsonError ?? ""}
          </p>
        </div>

        <div class="flex flex-col gap-4">
          <section class="panel-inset p-3" aria-labelledby="source-health">
            <div class="mb-2 flex items-center justify-between gap-3">
              <h3 id="source-health" class="text-sm font-semibold tracking-tight">Health</h3>
              <StatusBadge
                tone={selected.circuitOpenUntil
                  ? "warning"
                  : selected.consecutiveFailures > 0
                    ? "warning"
                    : "success"}
              >
                {selected.circuitOpenUntil ? "Paused" : "Active"}
              </StatusBadge>
            </div>
            <div class="grid gap-2">
              <StatTile label="Consecutive failures" value={selected.consecutiveFailures} />
              <StatTile
                label="Last updated"
                value={new Date(selected.fetchedAt).toLocaleTimeString()}
              />
            </div>
          </section>

          <section class="panel-inset p-3" aria-labelledby="source-config">
            <h3 id="source-config" class="mb-2 text-sm font-semibold tracking-tight">Config</h3>
            <pre
              class="overflow-x-auto rounded-md bg-background/50 p-2.5 font-mono text-xs">{JSON.stringify(
                selected.config,
                null,
                2,
              )}</pre>
          </section>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-16">
        <Empty.Header>
          <Empty.Media variant="icon">
            <RadioIcon />
          </Empty.Media>
          <Empty.Title>No source selected</Empty.Title>
          <Empty.Description>Pick a source from the list to view its data.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
