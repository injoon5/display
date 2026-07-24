<script lang="ts">
  import type { SlotMapEntry } from "$lib/compiler";
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
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-4 flex items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Simulate panel</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Override source paths, scrub time, and force card re-renders.</p>
    </div>
    <span class="badge badge-green">{Object.keys(overrides).length} overrides</span>
  </div>

  <div class="mb-4 rounded-xl border border-white/5 bg-black/20 p-3">
    <div class="mb-2 flex items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Time scrubber</p>
        <p class="mt-1 font-mono text-sm text-zinc-100">{kstLabel}</p>
      </div>
      <button class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200" onclick={resetClock}>
        Reset
      </button>
    </div>
    <input
      bind:value={scrubMinutes}
      class="w-full accent-lime-400"
      max="720"
      min="-720"
      step="15"
      type="range"
    />
    <div class="mt-2 flex justify-between text-[11px] text-[color:var(--muted)]">
      <span>-12h</span>
      <span>{scrubMinutes > 0 ? "+" : ""}{scrubMinutes}m</span>
      <span>+12h</span>
    </div>
  </div>

  <div class="mb-4 grid gap-2 md:grid-cols-[1.1fr_1fr_auto]">
    <input
      bind:value={manualPath}
      class="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm outline-none"
      placeholder="path, e.g. air.pm25"
    />
    <input
      bind:value={manualValue}
      class="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm outline-none"
      placeholder="JSON value"
    />
    <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" onclick={addManualOverride}>
      Override
    </button>
  </div>

  <div class="max-h-[28rem] space-y-2 overflow-auto pr-1">
    {#each slotMap as entry (entry.path)}
      {@const slot = snapshot.byPath[entry.path]}
      {@const overridden = entry.path in overrides}
      <div class={`rounded-xl border p-3 ${overridden ? "border-amber-500/25 bg-amber-500/8" : "border-white/5 bg-black/15"}`}>
        <div class="flex items-center justify-between gap-3">
          <code class="font-mono text-xs text-zinc-200">{entry.path}</code>
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{entry.type}</span>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          {#if entry.type === "boolean"}
            <label class="inline-flex items-center gap-2 text-sm text-zinc-100">
              <input
                checked={Boolean(overridden ? overrides[entry.path] : slot?.value)}
                class="accent-lime-400"
                onchange={(event) => setOverride(entry.path, (event.currentTarget as HTMLInputElement).checked)}
                type="checkbox"
              />
              active
            </label>
          {:else if entry.type === "number"}
            <input
              class="min-w-[8rem] rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-sm outline-none"
              onchange={(event) => setOverride(entry.path, Number((event.currentTarget as HTMLInputElement).value))}
              type="number"
              value={String(overridden ? overrides[entry.path] : slot?.value ?? 0)}
            />
          {:else}
            <input
              class="min-w-[14rem] rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-sm outline-none"
              onchange={(event) => setOverride(entry.path, (event.currentTarget as HTMLInputElement).value)}
              type="text"
              value={asText(overridden ? overrides[entry.path] : slot?.value)}
            />
          {/if}
          <button class="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-300" onclick={() => clearOverride(entry.path)}>
            Clear
          </button>
        </div>
      </div>
    {/each}
  </div>
</section>
