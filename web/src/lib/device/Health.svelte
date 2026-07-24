<script lang="ts">
  import type { DashboardDevice, DashboardTelemetry } from "$lib/convex";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Card from "$lib/components/ui/card/index.js";

  type Props = {
    device: DashboardDevice | null;
    statusLabel: string;
    telemetry: DashboardTelemetry;
  };

  let { device, statusLabel, telemetry }: Props = $props();

  function minutesAgo(value: number): string {
    const delta = Math.max(0, Date.now() - value);
    if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
    return `${Math.round(delta / 60_000)}m ago`;
  }
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Device health</Card.Title>
      <Card.Description>Link state, firmware, sensors, and runtime headroom.</Card.Description>
    </div>
    <StatusBadge tone={device?.online ? "success" : "destructive"}>
      {device?.online ? "online" : "offline"}
    </StatusBadge>
  </Card.Header>
  <Card.Content class="grid grid-cols-2 gap-2">
    <StatTile label="Convex mode" value={statusLabel} />
    <StatTile label="Firmware" value={device?.fwVersion ?? "n/a"} />
    <StatTile label="RSSI" value={`${telemetry.rssi} dBm`} />
    <StatTile label="Heap free" value={`${telemetry.heapFree.toLocaleString()} B`} />
    <StatTile label="Ambient lux" value={telemetry.lux} />
    <StatTile label="Last heartbeat" value={device ? minutesAgo(device.lastSeen) : "n/a"} />
  </Card.Content>
</Card.Root>
