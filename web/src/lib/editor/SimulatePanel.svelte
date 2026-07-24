<script lang="ts">
  import type { SlotMapEntry } from "$lib/compiler";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import type { SlotSnapshot } from "$lib/convex";

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
    snapshot
  }: Props = $props();

  const baseNow = Date.now();
  let manualPath = $state("");
  let manualValue = $state("\"demo\"");
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
      timeZone: "Asia/Seoul"
    }).format(nowMs)
  );

  let overrideCount = $derived(Object.keys(overrides).length);
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Simulate</Card.Title>
      <Card.Description>Try different values and times.</Card.Description>
    </div>
    <StatusBadge class="tabular-nums" tone="success">{overrideCount} overrides</StatusBadge>
  </Card.Header>

  <Card.Content class="flex flex-col gap-4">
    <div class="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div class="mb-2 flex items-center justify-between gap-3">
        <div>
          <p class="text-[11px] font-medium text-muted-foreground">Time</p>
          <p class="mt-1 font-mono text-sm tabular-nums">{kstLabel}</p>
        </div>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={resetClock}
          size="sm"
          variant="outline"
        >
          Reset
        </Button>
      </div>
      <input
        bind:value={scrubMinutes}
        class="w-full accent-lime-400"
        max="720"
        min="-720"
        step="15"
        type="range"
      />
      <div class="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>-12h</span>
        <span>{scrubMinutes > 0 ? "+" : ""}{scrubMinutes}m</span>
        <span>+12h</span>
      </div>
    </div>

    <div class="grid gap-2 md:grid-cols-[1.1fr_1fr_auto]">
      <Input bind:value={manualPath} class="font-mono" placeholder="path, e.g. air.pm25" />
      <Input bind:value={manualValue} class="font-mono" placeholder="JSON value" />
      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        onclick={addManualOverride}
        variant="secondary"
      >
        Add
      </Button>
    </div>

    <div class="flex max-h-[28rem] flex-col gap-2 overflow-auto pr-1">
      {#each slotMap as entry (entry.path)}
        {@const slot = snapshot.byPath[entry.path]}
        {@const overridden = entry.path in overrides}
        <div
          class={[
            "rounded-lg p-3 ring-1",
            overridden
              ? "bg-amber-500/10 ring-amber-500/25"
              : "bg-muted/40 ring-foreground/10"
          ]}
        >
          <div class="flex items-center justify-between gap-3">
            <code class="font-mono text-xs">{entry.path}</code>
            <span class="text-[11px] font-medium text-muted-foreground">{entry.type}</span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            {#if entry.type === "boolean"}
              <label class="inline-flex items-center gap-2 text-sm">
                <input
                  checked={Boolean(overridden ? overrides[entry.path] : slot?.value)}
                  class="accent-lime-400"
                  onchange={(event) =>
                    setOverride(entry.path, (event.currentTarget as HTMLInputElement).checked)}
                  type="checkbox"
                />
                On
              </label>
            {:else if entry.type === "number"}
              <Input
                class="min-w-[8rem] font-mono tabular-nums"
                onchange={(event) =>
                  setOverride(entry.path, Number((event.currentTarget as HTMLInputElement).value))}
                type="number"
                value={String(overridden ? overrides[entry.path] : (slot?.value ?? 0))}
              />
            {:else}
              <Input
                class="min-w-[14rem] font-mono"
                onchange={(event) =>
                  setOverride(entry.path, (event.currentTarget as HTMLInputElement).value)}
                type="text"
                value={asText(overridden ? overrides[entry.path] : slot?.value)}
              />
            {/if}
            <Button
              class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
              onclick={() => clearOverride(entry.path)}
              size="sm"
              variant="outline"
            >
              Clear
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
