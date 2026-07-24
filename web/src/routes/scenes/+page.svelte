<script lang="ts">
  import { cards, saveScene, scenes } from "$lib/convex";

  let selectedSceneId = $state<string | null>(null);
  let draftName = $state("");
  let draftSchedule = $state("");
  let draftBrightness = $state(100);
  let draftEnabled = $state(true);
  let draftCards = $state<string[]>([]);
  let lastLoaded = $state<string | null>(null);
  let message = $state<string | null>(null);

  $effect(() => {
    if (!selectedSceneId && $scenes[0]) {
      selectedSceneId = $scenes[0]._id;
    }
    const selected = $scenes.find((scene) => scene._id === selectedSceneId) ?? null;
    if (!selected || selected._id === lastLoaded) {
      return;
    }
    draftName = selected.name;
    draftSchedule = selected.schedule ?? "";
    draftBrightness = selected.brightnessCeiling ?? 100;
    draftEnabled = selected.enabled;
    draftCards = [...selected.cardIds];
    lastLoaded = selected._id;
  });

  let selectedScene = $derived($scenes.find((scene) => scene._id === selectedSceneId) ?? null);

  function move(index: number, delta: number): void {
    const next = [...draftCards];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const [item] = next.splice(index, 1);
    if (!item) {
      return;
    }
    next.splice(target, 0, item);
    draftCards = next;
  }

  function addCard(cardId: string): void {
    if (draftCards.includes(cardId)) {
      return;
    }
    draftCards = [...draftCards, cardId];
  }

  function removeCard(cardId: string): void {
    draftCards = draftCards.filter((id) => id !== cardId);
  }

  async function handleSave(): Promise<void> {
    if (!selectedScene) {
      return;
    }
    await saveScene({
      brightnessCeiling: draftBrightness,
      cardIds: draftCards,
      enabled: draftEnabled,
      homekitIdentifier: selectedScene.homekitIdentifier,
      name: draftName,
      sceneId: selectedScene._id,
      schedule: draftSchedule || undefined
    });
    message = `Saved scene ${draftName}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
  <section class="panel rounded-3xl p-4">
    <div class="mb-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Scenes</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Playlist builder for scheduled card queues.</p>
    </div>
    <div class="space-y-2">
      {#each $scenes as scene (scene._id)}
        <button
          class={`w-full rounded-2xl border px-3 py-3 text-left ${selectedSceneId === scene._id ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`}
          onclick={() => (selectedSceneId = scene._id)}
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-zinc-100">{scene.name}</div>
              <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{scene.schedule ?? "manual"}</div>
            </div>
            <span class="badge badge-amber">{scene.cardIds.length}</span>
          </div>
        </button>
      {/each}
    </div>
  </section>

  <section class="panel rounded-3xl p-5">
    {#if selectedScene}
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-zinc-50">Scene builder</h2>
          <p class="mt-1 text-sm text-[color:var(--muted)]">Reorder cards and tune the schedule window.</p>
        </div>
        <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handleSave}>
          Save scene
        </button>
      </div>

      {#if message}
        <div class="mt-4 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-200">{message}</div>
      {/if}

      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">name</span>
          <input bind:value={draftName} class="mt-2 w-full bg-transparent outline-none" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">schedule</span>
          <input bind:value={draftSchedule} class="mt-2 w-full bg-transparent font-mono outline-none" placeholder="weekday 06:30-09:30" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">brightness</span>
          <input bind:value={draftBrightness} class="mt-2 w-full bg-transparent font-mono outline-none" max="100" min="1" type="number" />
        </label>
      </div>

      <label class="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100">
        <input bind:checked={draftEnabled} class="accent-lime-400" type="checkbox" />
        enabled
      </label>

      <div class="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="space-y-2">
          <h3 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Queue</h3>
          {#each draftCards as cardId, index (cardId)}
            {@const card = $cards.find((entry) => entry._id === cardId)}
            <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="font-medium text-zinc-100">{card?.name ?? cardId}</div>
                  <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{card?.slug ?? "unknown"}</div>
                </div>
                <div class="flex gap-2">
                  <button class="rounded-lg border border-white/10 px-2 py-1 text-xs" onclick={() => move(index, -1)}>up</button>
                  <button class="rounded-lg border border-white/10 px-2 py-1 text-xs" onclick={() => move(index, 1)}>down</button>
                  <button class="rounded-lg border border-red-400/20 px-2 py-1 text-xs text-red-200" onclick={() => removeCard(cardId)}>
                    remove
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="space-y-2">
          <h3 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Available cards</h3>
          {#each $cards as card (card._id)}
            <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="font-medium text-zinc-100">{card.name}</div>
                  <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{card.slug}</div>
                </div>
                <button class="rounded-lg border border-lime-400/20 px-2 py-1 text-xs text-lime-100" onclick={() => addCard(card._id)}>
                  add
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</div>
