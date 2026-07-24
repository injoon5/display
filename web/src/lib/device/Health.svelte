<script lang="ts">
  import type { DashboardDevice, DashboardTelemetry } from "$lib/convex";

  type Props = {
    device: DashboardDevice | null;
    statusLabel: string;
    telemetry: DashboardTelemetry;
  };

  let { device, statusLabel, telemetry }: Props = $props();

  function minutesAgo(value: number): string {
    const delta = Math.max(0, Date.now() - value);
    if (delta < 60_000) {
      return `${Math.round(delta / 1000)}s ago`;
    }
    return `${Math.round(delta / 60_000)}m ago`;
  }
</script>

<section class="panel rounded-2xl p-4">
  <div class="mb-4 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Device health</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Link state, firmware, sensors, and runtime headroom.</p>
    </div>
    <span class={`badge ${device?.online ? "badge-green" : "badge-red"}`}>{device?.online ? "online" : "offline"}</span>
  </div>

  <dl class="grid grid-cols-2 gap-3 text-sm">
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Convex mode</dt>
      <dd class="mt-1 font-mono text-zinc-100">{statusLabel}</dd>
    </div>
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Firmware</dt>
      <dd class="mt-1 font-mono text-zinc-100">{device?.fwVersion ?? "n/a"}</dd>
    </div>
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">RSSI</dt>
      <dd class="mt-1 font-mono text-zinc-100">{telemetry.rssi} dBm</dd>
    </div>
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Heap free</dt>
      <dd class="mt-1 font-mono text-zinc-100">{telemetry.heapFree.toLocaleString()} B</dd>
    </div>
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Ambient lux</dt>
      <dd class="mt-1 font-mono text-zinc-100">{telemetry.lux}</dd>
    </div>
    <div class="rounded-xl border border-white/5 bg-black/20 p-3">
      <dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Last heartbeat</dt>
      <dd class="mt-1 font-mono text-zinc-100">{device ? minutesAgo(device.lastSeen) : "n/a"}</dd>
    </div>
  </dl>
</section>
