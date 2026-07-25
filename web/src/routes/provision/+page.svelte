<script lang="ts">
  import { browser } from "$app/environment";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { registerDevice } from "$lib/dashboard/repository";
  import BluetoothIcon from "@lucide/svelte/icons/bluetooth";
  import ListIcon from "@lucide/svelte/icons/list";

  type BluetoothNavigator = Navigator & {
    bluetooth?: {
      requestDevice(options: {
        acceptAllDevices: boolean;
        optionalServices?: string[];
      }): Promise<{ id: string; name?: string | null }>;
    };
  };

  type LogEntry = { at: number; text: string };

  let logs = $state<LogEntry[]>([
    { at: Date.now(), text: "Scan for a panel, connect it to Wi‑Fi, then claim it." },
  ]);
  let wifiSsid = $state("MyBedroomWiFi");
  let deviceName = $state("Wall Matrix Panel");
  let deviceToken = $state("dev-token-matrix-panel-demo");
  let busy = $state(false);
  let bluetoothAvailable = $derived(browser && "bluetooth" in navigator);

  function log(...lines: string[]): void {
    const at = Date.now();
    logs = [...lines.map((text) => ({ at, text })), ...logs];
  }

  function timeOf(at: number): string {
    return new Date(at).toLocaleTimeString();
  }

  async function handleScan(): Promise<void> {
    const bluetooth = browser ? (navigator as BluetoothNavigator).bluetooth : undefined;
    if (!bluetooth) {
      log("Bluetooth isn’t available in this browser. Continuing in demo mode.");
      return;
    }
    try {
      const picked = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"],
      });
      log(`Selected ${picked.name ?? picked.id}.`);
    } catch (error) {
      log(error instanceof Error ? error.message : "Scan cancelled.");
    }
  }

  async function handleProvision(): Promise<void> {
    if (busy) return;
    busy = true;
    log(`Joining ${wifiSsid}…`, `Registering “${deviceName}” with token ${deviceToken.slice(0, 8)}…`);
    try {
      const device = await registerDevice({
        fwChannel: "dev",
        fwVersion: "1.4.2-dev",
        name: deviceName,
        token: deviceToken,
      });
      log(`Claimed ${device.name} (${device._id}). The panel is online and ready to sync.`);
    } catch (error) {
      log(error instanceof Error ? error.message : "Provision failed.");
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(320px,26rem)_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base" level={2}>Panel details</Card.Title>
      <Card.Description>Name the panel, set Wi‑Fi, and claim it with a device token.</Card.Description>
      <Card.Action>
        <StatusBadge tone={bluetoothAvailable ? "success" : "neutral"}>
          {bluetoothAvailable ? "Bluetooth ready" : "Demo mode"}
        </StatusBadge>
      </Card.Action>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="provision-name">Name</Label>
        <Input id="provision-name" autocomplete="off" bind:value={deviceName} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="provision-ssid">Wi‑Fi network</Label>
        <Input id="provision-ssid" autocomplete="off" bind:value={wifiSsid} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="provision-token">Device token</Label>
        <Input id="provision-token" class="font-mono" autocomplete="off" bind:value={deviceToken} />
        <p class="text-xs text-muted-foreground">
          Printed on the panel, or reuse the token of a panel you are reclaiming.
        </p>
      </div>
    </Card.Content>
    <Card.Footer class="justify-end gap-2">
      <Button onclick={handleScan} variant="secondary">
        <BluetoothIcon />
        Scan
      </Button>
      <Button disabled={busy} onclick={handleProvision}>
        {#if busy}
          <Spinner aria-label="" />
        {/if}
        {busy ? "Claiming…" : "Claim panel"}
      </Button>
    </Card.Footer>
  </Card.Root>

  <section class="surface overflow-hidden" aria-labelledby="provision-activity">
    <div class="px-4 py-3">
      <h2 id="provision-activity" class="text-sm font-semibold tracking-tight">Activity</h2>
      <p class="mt-0.5 text-xs text-muted-foreground">Steps appear here as setup progresses.</p>
    </div>
    <div class="px-2 pb-2" role="log" aria-live="polite" aria-labelledby="provision-activity">
      {#if logs.length === 0}
        <Empty.Root class="border-none py-10">
          <Empty.Header>
            <Empty.Media variant="icon">
              <ListIcon />
            </Empty.Media>
            <Empty.Title>No activity yet</Empty.Title>
            <Empty.Description>Scan or claim a panel to see steps here.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <ul class="flex flex-col">
          {#each logs as entry, index (`${entry.at}-${index}-${entry.text}`)}
            <li class="flex items-baseline gap-3 rounded-md px-2 py-1.5 text-sm">
              <time
                class="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                datetime={new Date(entry.at).toISOString()}
              >
                {timeOf(entry.at)}
              </time>
              <span class="min-w-0 text-muted-foreground">{entry.text}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</div>
