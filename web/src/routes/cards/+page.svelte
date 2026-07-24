<script lang="ts">
  import { cards, dashboardStatus, resetMockState, seedLiveDemo } from "$lib/convex";

  let actionMessage = $state<string | null>(null);

  async function handleSeed(): Promise<void> {
    actionMessage = null;
    try {
      await seedLiveDemo();
      actionMessage = "Seeded dashboard data.";
    } catch (error) {
      actionMessage = error instanceof Error ? error.message : "Seed failed";
    }
  }

  function handleReset(): void {
    resetMockState();
    actionMessage = "Reset local mock store.";
  }

  let status = $derived($dashboardStatus);
</script>

<section class="panel rounded-3xl p-5">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div>
      <div class="flex items-center gap-2">
        <span class="badge badge-green">cards</span>
        <span class={`badge ${status.mode === "live" ? "badge-green" : "badge-amber"}`}>{status.mode}</span>
      </div>
      <h2 class="mt-3 text-xl font-semibold text-zinc-50">Card catalogue</h2>
      <p class="mt-1 text-sm text-[color:var(--muted)]">
        Seed set: bus-402, weather, air, clock, clock-dim, indoor, calendar-next, self-status.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" onclick={handleSeed}>
        Seed demo
      </button>
      <button class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200" onclick={handleReset}>
        Reset mock
      </button>
    </div>
  </div>

  {#if actionMessage}
    <div class="mt-4 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-200">
      {actionMessage}
    </div>
  {/if}
</section>

<div class="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
  {#each $cards as card (card._id)}
    <a class="panel rounded-3xl p-4 transition hover:border-lime-400/20 hover:bg-lime-400/6" href={`/cards/${card.slug}`}>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-zinc-50">{card.name}</h3>
          <p class="mt-1 font-mono text-xs text-[color:var(--muted)]">{card.slug}</p>
        </div>
        <span class={`badge ${card.enabled ? "badge-green" : "badge-red"}`}>{card.enabled ? "enabled" : "disabled"}</span>
      </div>

      <dl class="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2">
          <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">slots</dt>
          <dd class="mt-1 font-mono text-zinc-100">{card.slotMap.length}</dd>
        </div>
        <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2">
          <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">amps</dt>
          <dd class="mt-1 font-mono text-zinc-100">{card.estimatedAmps.toFixed(2)}</dd>
        </div>
        <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2">
          <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</dt>
          <dd class="mt-1 font-mono text-zinc-100">{card.priority}</dd>
        </div>
      </dl>

      <div class="mt-4 flex flex-wrap gap-2">
        {#each card.sourceRefs as sourceId}
          <span class="badge badge-amber">{sourceId}</span>
        {/each}
      </div>
    </a>
  {/each}
</div>
