<script lang="ts">
  import { onMount } from "svelte";
  import {
    buildSlotSnapshot,
    cards,
    dashboardStatus,
    getActiveScene,
    primaryDevice,
    rules,
    scenes,
    sources,
    telemetry
  } from "$lib/convex";
  import Health from "$lib/device/Health.svelte";
  import Mirror from "$lib/device/Mirror.svelte";
  import PowerMeter from "$lib/device/PowerMeter.svelte";

  let nowMs = $state(Date.now());

  onMount(() => {
    const timer = window.setInterval(() => {
      nowMs = Date.now();
    }, 1000);
    return () => window.clearInterval(timer);
  });

  let device = $derived($primaryDevice);
  let scene = $derived(device ? getActiveScene(device) : null);
  let activeCard = $derived.by(() => {
    if (!device) {
      return $cards[0] ?? null;
    }
    if (device.pinnedCardId) {
      return $cards.find((card) => card._id === device.pinnedCardId) ?? null;
    }
    const firstCardId = scene?.cardIds[0];
    return $cards.find((card) => card._id === firstCardId) ?? $cards[0] ?? null;
  });
  let snapshot = $derived(
    activeCard
      ? buildSlotSnapshot(activeCard.slotMap, {
          device,
          nowMs,
          sources: $sources,
          telemetry: $telemetry
        })
      : { byIndex: {}, byPath: {} }
  );
  let statusLabel = $derived($dashboardStatus.mode + ($dashboardStatus.lastError ? " / fallback" : ""));
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]">
  <div class="space-y-4">
    <section class="panel rounded-3xl p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class={`badge ${device?.online ? "badge-green" : "badge-red"}`}>{device?.online ? "online" : "offline"}</span>
            <span class="badge badge-amber">{scene?.name ?? "no-scene"}</span>
          </div>
          <h2 class="mt-3 text-xl font-semibold text-zinc-50">{device?.name ?? "Wall Matrix Panel"}</h2>
          <p class="mt-1 text-sm text-[color:var(--muted)]">
            Active scene queue, live mirror, and device runtime telemetry.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">scene cards</p>
            <p class="mt-1 font-mono text-lg text-zinc-100">{scene?.cardIds.length ?? 0}</p>
          </div>
          <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">rules armed</p>
            <p class="mt-1 font-mono text-lg text-zinc-100">{$rules.filter((rule) => rule.enabled).length}</p>
          </div>
          <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sources hot</p>
            <p class="mt-1 font-mono text-lg text-zinc-100">{$sources.length}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Mirror card={activeCard} nowMs={nowMs} snapshot={snapshot} />
      <div class="space-y-4">
        <Health device={device} statusLabel={statusLabel} telemetry={$telemetry} />
        <PowerMeter amps={$telemetry.estAmps} budget={4} label="telemetry draw" />
      </div>
    </div>
  </div>

  <div class="space-y-4">
    <section class="panel rounded-3xl p-4">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Scene queue</h2>
          <p class="mt-1 text-xs text-[color:var(--muted)]">Cards in the currently active scene.</p>
        </div>
        <span class="badge badge-green">{scene?.name ?? "idle"}</span>
      </div>
      <div class="space-y-2">
        {#if scene}
          {#each scene.cardIds as cardId, index (cardId)}
            {@const card = $cards.find((entry) => entry._id === cardId)}
            <a
              class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-3 transition hover:border-lime-400/20 hover:bg-lime-400/8"
              href={card ? `/cards/${card.slug}` : "/cards"}
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="font-medium text-zinc-100">{card?.name ?? cardId}</div>
                  <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{card?.slug ?? "unknown"}</div>
                </div>
                <span class="badge badge-amber">#{index + 1}</span>
              </div>
            </a>
          {/each}
        {:else}
          <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-[color:var(--muted)]">
            No active scene selected.
          </div>
        {/if}
      </div>
    </section>

    <section class="panel rounded-3xl p-4">
      <div class="mb-3">
        <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Source freshness</h2>
        <p class="mt-1 text-xs text-[color:var(--muted)]">Oldest data tends to show up here first.</p>
      </div>
      <div class="space-y-2">
        {#each [...$sources].sort((left, right) => left.fetchedAt - right.fetchedAt).slice(0, 6) as source (source._id)}
          <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="font-medium text-zinc-100">{source.sourceId}</div>
                <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{source.kind}</div>
              </div>
              <span class="badge badge-amber">{Math.max(0, Math.round((nowMs - source.fetchedAt) / 1000))}s</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>
