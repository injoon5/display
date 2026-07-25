<script lang="ts">
  import type { SlotMapEntry } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { SlotSnapshot } from "$lib/convex";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import XIcon from "@lucide/svelte/icons/x";

  type Props = {
    nowMs?: number;
    overrides?: Record<string, unknown>;
    slotMap: SlotMapEntry[];
    snapshot: SlotSnapshot;
  };

  let {
    nowMs = $bindable<number>(Date.now()),
    overrides = $bindable<Record<string, unknown>>({}),
    slotMap,
    snapshot,
  }: Props = $props();

  const baseNow = Date.now();
  let manualPath = $state("");
  let manualValue = $state('"demo"');
  let scrubMinutes = $state(Math.round((nowMs - baseNow) / 60_000));

  $effect(() => {
    nowMs = baseNow + scrubMinutes * 60_000;
  });

  function setOverride(path: string, value: unknown): void {
    overrides = { ...overrides, [path]: value };
  }

  function clearOverride(path: string): void {
    const next = { ...overrides };
    delete next[path];
    overrides = next;
  }

  function addManualOverride(): void {
    if (!manualPath.trim()) {
      return;
    }
    try {
      setOverride(manualPath.trim(), JSON.parse(manualValue));
    } catch {
      setOverride(manualPath.trim(), manualValue);
    }
  }

  function resetClock(): void {
    scrubMinutes = 0;
  }

  function asText(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (value === null || value === undefined) {
      return "";
    }
    return JSON.stringify(value);
  }

  let kstLabel = $derived(
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Seoul",
    }).format(nowMs),
  );

  let overrideCount = $derived(Object.keys(overrides).length);
  let offsetLabel = $derived(`${scrubMinutes > 0 ? "+" : ""}${scrubMinutes}m`);
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title level={2}>Simulate</Card.Title>
    <Card.Description>Try different values and times without touching the panel.</Card.Description>
    <Card.Action>
      <StatusBadge tone={overrideCount > 0 ? "warning" : "neutral"}>
        {overrideCount}
        {overrideCount === 1 ? "override" : "overrides"}
      </StatusBadge>
    </Card.Action>
  </Card.Header>

  <Card.Content class="flex flex-col gap-4">
    <div class="panel-inset p-3">
      <div class="mb-2 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-muted-foreground">Panel time (Seoul)</p>
          <p class="mt-1 truncate font-mono text-sm tabular-nums">{kstLabel}</p>
        </div>
        <Button disabled={scrubMinutes === 0} onclick={resetClock} size="sm" variant="outline">
          <RotateCcwIcon />
          Now
        </Button>
      </div>
      <Label class="sr-only" for="simulate-clock">Time offset in minutes</Label>
      <input
        id="simulate-clock"
        bind:value={scrubMinutes}
        class="h-6 w-full accent-foreground"
        max="720"
        min="-720"
        step="15"
        type="range"
      />
      <div class="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>−12h</span>
        <span class="font-medium text-foreground">{offsetLabel}</span>
        <span>+12h</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label for="override-path">Path</Label>
        <Input id="override-path" bind:value={manualPath} class="font-mono" placeholder="air.pm25" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label for="override-value">Value</Label>
        <Input
          id="override-value"
          bind:value={manualValue}
          class="font-mono"
          placeholder="JSON value"
        />
      </div>
      <Button
        class="w-full sm:w-auto"
        disabled={!manualPath.trim()}
        onclick={addManualOverride}
        size="sm"
        variant="secondary"
      >
        Add
      </Button>
    </div>

    <div class="flex max-h-[28rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-2">
      {#each slotMap as entry (entry.path)}
        {@const slot = snapshot.byPath[entry.path]}
        {@const overridden = entry.path in overrides}
        <div
          class="rounded-md px-3 py-2.5 ring-1 ring-inset {overridden
            ? 'bg-warning-surface ring-warning-border'
            : 'bg-foreground/[0.035] ring-border/70'}"
        >
          <div class="flex items-center justify-between gap-3">
            <code class="min-w-0 truncate font-mono text-xs">{entry.path}</code>
            <span class="shrink-0 text-[11px] font-medium text-muted-foreground">{entry.type}</span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            {#if entry.type === "boolean"}
              <Label class="flex min-h-9 flex-1 items-center gap-2.5 text-sm">
                <Checkbox
                  checked={Boolean(overridden ? overrides[entry.path] : slot?.value)}
                  onCheckedChange={(checked) => setOverride(entry.path, checked)}
                />
                On
              </Label>
            {:else if entry.type === "number"}
              <Input
                aria-label="Value for {entry.path}"
                class="flex-1 font-mono tabular-nums"
                onchange={(event) =>
                  setOverride(entry.path, Number((event.currentTarget as HTMLInputElement).value))}
                type="number"
                value={String(overridden ? overrides[entry.path] : (slot?.value ?? 0))}
              />
            {:else}
              <Input
                aria-label="Value for {entry.path}"
                class="flex-1 font-mono"
                onchange={(event) =>
                  setOverride(entry.path, (event.currentTarget as HTMLInputElement).value)}
                type="text"
                value={asText(overridden ? overrides[entry.path] : slot?.value)}
              />
            {/if}
            <Button
              aria-label="Clear the override on {entry.path}"
              disabled={!overridden}
              onclick={() => clearOverride(entry.path)}
              size="icon-sm"
              variant="ghost"
            >
              <XIcon />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
