<script lang="ts">
  import { cards, rules, saveRule, scenes } from "$lib/convex";

  let selectedRuleId = $state<string | null>(null);
  let draftName = $state("");
  let draftCondition = $state("");
  let draftPriority = $state(50);
  let draftEnabled = $state(true);
  let actionKind = $state("pin");
  let actionCardId = $state("");
  let actionSceneId = $state("");
  let actionDurationMs = $state(60_000);
  let lastLoaded = $state<string | null>(null);
  let message = $state<string | null>(null);

  $effect(() => {
    if (!selectedRuleId && $rules[0]) {
      selectedRuleId = $rules[0]._id;
    }
    const selected = $rules.find((rule) => rule._id === selectedRuleId) ?? null;
    if (!selected || selected._id === lastLoaded) {
      return;
    }
    draftName = selected.name;
    draftCondition = selected.condition;
    draftPriority = selected.priority;
    draftEnabled = selected.enabled;
    actionKind = selected.action.kind;
    actionCardId = selected.action.cardId ?? "";
    actionSceneId = selected.action.sceneId ?? "";
    actionDurationMs = selected.action.durationMs ?? 60_000;
    lastLoaded = selected._id;
  });

  let selectedRule = $derived($rules.find((rule) => rule._id === selectedRuleId) ?? null);

  async function handleSave(): Promise<void> {
    if (!selectedRule) {
      return;
    }
    await saveRule({
      action: {
        cardId: actionCardId || undefined,
        durationMs: actionDurationMs,
        kind: actionKind,
        sceneId: actionSceneId || undefined
      },
      condition: draftCondition,
      enabled: draftEnabled,
      name: draftName,
      priority: draftPriority,
      ruleId: selectedRule._id
    });
    message = `Saved rule ${draftName}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
  <section class="panel rounded-3xl p-4">
    <div class="mb-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Rules</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Alarm logic, scene switching, and interrupt pins.</p>
    </div>
    <div class="space-y-2">
      {#each $rules as rule (rule._id)}
        <button
          class={`w-full rounded-2xl border px-3 py-3 text-left ${selectedRuleId === rule._id ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`}
          onclick={() => (selectedRuleId = rule._id)}
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium text-zinc-100">{rule.name}</div>
              <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{rule.action.kind}</div>
            </div>
            <span class="badge badge-amber">{rule.priority}</span>
          </div>
        </button>
      {/each}
    </div>
  </section>

  <section class="panel rounded-3xl p-5">
    {#if selectedRule}
      <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 class="text-xl font-semibold text-zinc-50">Rule editor</h2>
          <p class="mt-1 text-sm text-[color:var(--muted)]">Conditions use the same source paths the cards bind to.</p>
        </div>
        <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handleSave}>
          Save rule
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
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</span>
          <input bind:value={draftPriority} class="mt-2 w-full bg-transparent font-mono outline-none" type="number" />
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">action</span>
          <select bind:value={actionKind} class="mt-2 w-full bg-transparent outline-none">
            <option value="pin">pin</option>
            <option value="interrupt">interrupt</option>
            <option value="scene">scene</option>
            <option value="sleep">sleep</option>
          </select>
        </label>
      </div>

      <label class="mt-4 block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">condition</span>
        <input bind:value={draftCondition} class="mt-2 w-full bg-transparent font-mono outline-none" />
      </label>

      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">target card</span>
          <select bind:value={actionCardId} class="mt-2 w-full bg-transparent outline-none">
            <option value="">none</option>
            {#each $cards as card (card._id)}
              <option value={card._id}>{card.name}</option>
            {/each}
          </select>
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">target scene</span>
          <select bind:value={actionSceneId} class="mt-2 w-full bg-transparent outline-none">
            <option value="">none</option>
            {#each $scenes as scene (scene._id)}
              <option value={scene._id}>{scene.name}</option>
            {/each}
          </select>
        </label>
        <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">duration ms</span>
          <input bind:value={actionDurationMs} class="mt-2 w-full bg-transparent font-mono outline-none" type="number" />
        </label>
      </div>

      <label class="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100">
        <input bind:checked={draftEnabled} class="accent-lime-400" type="checkbox" />
        enabled
      </label>
    {/if}
  </section>
</div>
