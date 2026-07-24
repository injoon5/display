<script lang="ts">
  import type { DashboardDevice, DashboardTelemetry } from "$lib/convex";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Card from "$lib/components/ui/card/index.js";

  type Props = {
    device: DashboardDevice | null;
    statusLabel: string;
    telemetry: DashboardTelemetry;
    nowMs?: number;
  };

  let { device, statusLabel, telemetry, nowMs }: Props = $props();

  function minutesAgo(value: number): string {
    const delta = Math.max(0, (nowMs ?? Date.now()) - value);
    if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
    return `${Math.round(delta / 60_000)}m ago`;
  }
</script>

<Card.Root size="sm" class="glass border-0 shadow-none">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Status</Card.Title>
      <Card.Description>Connection and sensors.</Card.Description>
    </div>
    <StatusBadge tone={device?.online ? "success" : "destructive"}>
      {device?.online ? "Online" : "Offline"}
    </StatusBadge>
  </Card.Header>
  <Card.Content class="grid grid-cols-2 gap-2">
    <StatTile label="Connection" value={statusLabel} />
    <StatTile label="Firmware" value={device?.fwVersion ?? "—"} />
    <StatTile label="RSSI" value={`${telemetry.rssi} dBm`} />
    <StatTile label="Memory" value={`${telemetry.heapFree.toLocaleString()} B`} />
    <StatTile label="Light" value={telemetry.lux} />
    <StatTile label="Last seen" value={device ? minutesAgo(device.lastSeen) : "—"} />
  </Card.Content>
</Card.Root>
