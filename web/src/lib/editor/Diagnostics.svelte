<script lang="ts">
  import type { CompileResult } from "$lib/compiler";

  type Props = {
    compiled: CompileResult | null;
  };

  let { compiled }: Props = $props();

  let diagnostics = $derived(compiled?.diagnostics ?? []);
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Diagnostics</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Compiler output, layout validation, and slot pressure.</p>
    </div>
    <span class={`badge ${diagnostics.some((entry) => entry.severity === "error") ? "badge-red" : "badge-green"}`}>
      {diagnostics.length} entries
    </span>
  </div>

  {#if diagnostics.length === 0}
    <div class="rounded-xl border border-emerald-500/15 bg-emerald-500/8 px-3 py-2 text-sm text-emerald-200">
      No diagnostics. This card compiles cleanly.
    </div>
  {:else}
    <div class="space-y-2">
      {#each diagnostics as entry, index (`${entry.code}-${index}`)}
        <div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class={`badge ${entry.severity === "error" ? "badge-red" : "badge-amber"}`}>{entry.severity}</span>
              <code class="font-mono text-xs text-zinc-300">{entry.code}</code>
            </div>
            {#if entry.span}
              <span class="font-mono text-[11px] text-[color:var(--muted)]">
                L{entry.span.start.line}:C{entry.span.start.column}
              </span>
            {/if}
          </div>
          <p class="mt-2 text-sm text-zinc-100">{entry.message}</p>
          {#if entry.hint}
            <p class="mt-1 text-xs text-[color:var(--muted)]">{entry.hint}</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
