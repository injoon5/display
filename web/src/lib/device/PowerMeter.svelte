<script lang="ts">
  type Props = {
    amps: number;
    budget?: number;
    label?: string;
  };

  let { amps, budget = 4, label = "draw" }: Props = $props();

  let percent = $derived(Math.min(100, Math.max(0, (amps / budget) * 100)));
  let state = $derived(percent > 85 ? "red" : percent > 60 ? "amber" : "green");
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-3 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Power meter</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Estimated panel current versus supply headroom.</p>
    </div>
    <span class={`badge ${state === "red" ? "badge-red" : state === "amber" ? "badge-amber" : "badge-green"}`}>
      {amps.toFixed(2)} A
    </span>
  </div>

  <div class="rounded-xl border border-white/5 bg-black/20 p-3">
    <div class="mb-2 flex items-end justify-between text-xs text-[color:var(--muted)]">
      <span>{label}</span>
      <span>{budget.toFixed(1)} A budget</span>
    </div>
    <div class="h-4 rounded-full bg-white/5 p-1">
      <div
        class={`h-full rounded-full ${state === "red" ? "bg-red-400" : state === "amber" ? "bg-amber-400" : "bg-lime-400"}`}
        style={`width:${percent}%`}
      ></div>
    </div>
  </div>
</section>
