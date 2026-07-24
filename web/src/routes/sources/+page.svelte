<script lang="ts">
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
  <section class="panel rounded-3xl p-4">
    <div class="mb-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Sources</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Probe providers, inspect raw payloads, and poke test values.</p>
    </div>
    <div class="space-y-2">
      {#each $sources as source (source._id)}
        <button
          class={`w-full rounded-2xl border px-3 py-3 text-left ${selectedSourceId === source.sourceId ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`}
          onclick={() => (selectedSourceId = source.sourceId)}
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-zinc-100">{source.sourceId}</div>
              <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{source.kind}</div>
            </div>
            <span class="badge badge-amber">{source.intervalMs / 1000}s</span>
          </div>
        </button>
      {/each}
    </div>
  </section>

  <section class="panel rounded-3xl p-5">
    {#if selected}
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-zinc-50">{selected.sourceId}</h2>
          <p class="mt-1 text-sm text-[color:var(--muted)]">Origin {selected.origin} · interval {selected.intervalMs / 1000}s</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" onclick={handleTestFetch}>
            Test fetch
          </button>
          <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handleWrite}>
            Write source
          </button>
        </div>
      </div>

      {#if message}
        <div class="mt-4 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-200">{message}</div>
      {/if}

      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <label class="rounded-2xl border border-white/5 bg-black/20 p-3">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">raw payload</span>
          <textarea bind:value={draftJson} class="mt-3 min-h-[28rem] w-full bg-transparent font-mono text-sm outline-none"></textarea>
        </label>

        <div class="space-y-3">
          <div class="rounded-2xl border border-white/5 bg-black/20 p-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Config</div>
            <pre class="mt-3 overflow-auto font-mono text-xs text-zinc-100">{JSON.stringify(selected.config, null, 2)}</pre>
          </div>
          <div class="rounded-2xl border border-white/5 bg-black/20 p-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Health</div>
            <dl class="mt-3 space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-[color:var(--muted)]">Failures</dt>
                <dd class="font-mono text-zinc-100">{selected.consecutiveFailures}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[color:var(--muted)]">Fetched at</dt>
                <dd class="font-mono text-zinc-100">{new Date(selected.fetchedAt).toLocaleTimeString()}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-[color:var(--muted)]">Circuit</dt>
                <dd class="font-mono text-zinc-100">{selected.circuitOpenUntil ? "open" : "closed"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    {/if}
  </section>
</div>
