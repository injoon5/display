<script lang="ts">
  import { compile } from "$lib/compiler";
  import {
    buildSlotSnapshot,
    cards,
    deployCard,
    primaryDevice,
    saveCard,
    sources,
    telemetry
  } from "$lib/convex";
  import Mirror from "$lib/device/Mirror.svelte";
  import IconLibrary from "$lib/design/IconLibrary.svelte";
  import CardEditor from "$lib/editor/CardEditor.svelte";
  import Diagnostics from "$lib/editor/Diagnostics.svelte";
  import Preview from "$lib/editor/Preview.svelte";
  import SimulatePanel from "$lib/editor/SimulatePanel.svelte";
  import SlotInspector from "$lib/editor/SlotInspector.svelte";
  import type { RenderHotspot } from "$lib/mxr";

  type Props = {
    params: { slug: string };
  };

  let { params }: Props = $props();

  let card = $derived($cards.find((entry) => entry.slug === params.slug) ?? null);
  let source = $state("");
  let name = $state("");
  let slug = $state("");
  let priority = $state(50);
  let dwellMs = $state(10_000);
  let enabled = $state(true);
  let nowMs = $state(Date.now());
  let overrides = $state<Record<string, unknown>>({});
  let hovered = $state<RenderHotspot | null>(null);
  let lastLoadedCardId = $state<string | null>(null);
  let actionMessage = $state<string | null>(null);

  $effect(() => {
    if (!card || card._id === lastLoadedCardId) {
      return;
    }
    source = card.source;
    name = card.name;
    slug = card.slug;
    priority = card.priority;
    dwellMs = card.dwellMs;
    enabled = card.enabled;
    overrides = {};
    lastLoadedCardId = card._id;
  });

  let compiled = $derived.by(() => {
    try {
      return compile(source);
    } catch {
      return null;
    }
  });

  let snapshot = $derived(
    buildSlotSnapshot(compiled?.slotMap ?? [], {
      device: $primaryDevice,
      nowMs,
      overrides,
      sources: $sources,
      telemetry: $telemetry
    })
  );

  async function handleSave(): Promise<void> {
    actionMessage = null;
    const saved = await saveCard({
      cardId: card?._id,
      dwellMs,
      enabled,
      estimatedAmps: compiled?.estimatedAmps ?? card?.estimatedAmps ?? 0.8,
      name,
      priority,
      slug,
      source
    });
    actionMessage = `Saved ${saved.slug}`;
  }

  async function handleDeploy(): Promise<void> {
    actionMessage = null;
    if (!card || !$primaryDevice) {
      actionMessage = "Need a card and a device before deploy.";
      return;
    }
    const deployed = await deployCard([card._id], $primaryDevice._id);
    actionMessage = `Deployed ${card.slug} (${deployed.etag})`;
  }
</script>

{#if !card}
  <section class="panel rounded-3xl p-6">
    <h2 class="text-xl font-semibold text-zinc-50">Card not found</h2>
    <p class="mt-2 text-sm text-[color:var(--muted)]">Choose a card from the catalogue to open the live editor.</p>
    <a class="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-100" href="/cards">
      Back to cards
    </a>
  </section>
{:else}
  <section class="panel rounded-3xl p-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="badge badge-green">editor</span>
          <span class="badge badge-amber">{card.slug}</span>
        </div>
        <h2 class="mt-3 text-xl font-semibold text-zinc-50">{card.name}</h2>
        <p class="mt-1 text-sm text-[color:var(--muted)]">
          Svelte 5 live preview loop: state → compile → render → framebuffer.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">name</span>
          <input bind:value={name} class="mt-2 w-full bg-transparent outline-none" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">slug</span>
          <input bind:value={slug} class="mt-2 w-full bg-transparent font-mono outline-none" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</span>
          <input bind:value={priority} class="mt-2 w-full bg-transparent font-mono outline-none" type="number" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">dwell ms</span>
          <input bind:value={dwellMs} class="mt-2 w-full bg-transparent font-mono outline-none" type="number" />
        </label>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <label class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100">
        <input bind:checked={enabled} class="accent-lime-400" type="checkbox" />
        enabled
      </label>
      <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handleSave}>
        Save card
      </button>
      <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" onclick={handleDeploy}>
        Deploy to device
      </button>
      {#if actionMessage}
        <span class="text-sm text-zinc-200">{actionMessage}</span>
      {/if}
    </div>
  </section>

  <div class="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_520px]">
    <div class="space-y-4">
      <CardEditor bind:value={source} filename={`${slug}.card`} label="Card editor" />
      <Diagnostics compiled={compiled} />
    </div>

    <div class="space-y-4">
      <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">
        <Preview bind:hovered {compiled} {nowMs} {source} snapshot={snapshot} />
        <Mirror card={card} {nowMs} snapshot={snapshot} />
      </div>
      <SlotInspector hovered={hovered} slotMap={compiled?.slotMap ?? []} snapshot={snapshot} />
      <SimulatePanel bind:nowMs bind:overrides slotMap={compiled?.slotMap ?? []} snapshot={snapshot} />
      <IconLibrary />
    </div>
  </div>
{/if}
