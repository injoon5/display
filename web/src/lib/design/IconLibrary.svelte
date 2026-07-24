<script lang="ts">
  const icons = [
    { name: "cloud", tint: "text-sky-300" },
    { name: "bus", tint: "text-amber-300" },
    { name: "calendar", tint: "text-lime-300" },
    { name: "air", tint: "text-emerald-300" },
    { name: "clock", tint: "text-zinc-200" },
    { name: "alert", tint: "text-red-300" }
  ];
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3">
    <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Icon library</h2>
    <p class="mt-1 text-xs text-[color:var(--muted)]">Stub palette until libmxr asset bundles are wired into wasm.</p>
  </div>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {#each icons as icon}
      <div class="rounded-xl border border-white/5 bg-black/20 p-3">
        <div class={`mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/25 font-mono text-xs uppercase ${icon.tint}`}>
          {icon.name.slice(0, 2)}
        </div>
        <div class="font-mono text-xs text-zinc-100">{icon.name}</div>
      </div>
    {/each}
  </div>
</section>
