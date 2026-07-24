<script lang="ts">
  import type { SlotMapEntry } from "$lib/compiler";
  import type { RenderHotspot } from "$lib/mxr";
  import type { SlotSnapshot } from "$lib/convex";

  type Props = {
    hovered: RenderHotspot | null;
    slotMap: SlotMapEntry[];
    snapshot: SlotSnapshot;
  };

  let { hovered, slotMap, snapshot }: Props = $props();

  function formatValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return "null";
    }
    return JSON.stringify(value);
  }
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Slot inspector</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Hover the preview to inspect bound values and freshness.</p>
    </div>
    <span class="badge badge-amber">{slotMap.length} slots</span>
  </div>

  {#if hovered}
    <div class="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
      <div class="flex items-center justify-between gap-3">
        <code class="font-mono text-sm text-amber-100">{hovered.path}</code>
        <span class="font-mono text-[11px] text-amber-200/70">{hovered.sourceId}</span>
      </div>
      <p class="mt-2 text-sm text-zinc-100">{formatValue(hovered.value)}</p>
    </div>
  {/if}

  <div class="max-h-[26rem] space-y-2 overflow-auto pr-1">
    {#each slotMap as entry (entry.path)}
      {@const slot = snapshot.byIndex[entry.index]}
      <div class={`rounded-xl border px-3 py-2 ${hovered?.path === entry.path ? "border-amber-500/35 bg-amber-500/8" : "border-white/5 bg-black/15"}`}>
        <div class="flex items-center justify-between gap-3">
          <code class="font-mono text-xs text-zinc-200">{entry.path}</code>
          <span class="font-mono text-[11px] text-[color:var(--muted)]">#{entry.index}</span>
        </div>
        <div class="mt-1 flex items-center justify-between gap-3">
          <span class="text-sm text-zinc-100">{formatValue(slot?.value)}</span>
          <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">{entry.type}</span>
        </div>
      </div>
    {/each}
  </div>
</section>
