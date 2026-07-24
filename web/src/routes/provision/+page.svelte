<script lang="ts">
  import { browser } from "$app/environment";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";

  type BluetoothNavigator = Navigator & {
    bluetooth?: {
      requestDevice(options: {
        acceptAllDevices: boolean;
        optionalServices?: string[];
      }): Promise<{ id: string; name?: string | null }>;
    };
  };

  let logs = $state<string[]>([
    "BLE provisioning is safe to mock when Web Bluetooth is unavailable.",
    "Expected flow: scan -> select panel -> send Wi-Fi creds -> claim token -> verify heartbeat."
  ]);
  let wifiSsid = $state("MyBedroomWiFi");
  let deviceName = $state("Wall Matrix Panel");
  let bluetoothAvailable = $derived(browser && "bluetooth" in navigator);

  async function handleScan(): Promise<void> {
    if (!bluetoothAvailable) {
      logs = [`[mock] BLE unavailable in this browser`, ...logs];
      return;
    }
    try {
      const bluetooth = (navigator as BluetoothNavigator).bluetooth;
      if (!bluetooth) {
        logs = [`[mock] BLE unavailable in this browser`, ...logs];
        return;
      }
      const picked = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"]
      });
      logs = [`[ble] selected ${picked.name ?? picked.id}`, ...logs];
    } catch (error) {
      logs = [`[ble] ${error instanceof Error ? error.message : "scan cancelled"}`, ...logs];
    }
  }

  function handleMockProvision(): void {
    logs = [
      `[mock] provisioned ${deviceName} onto ${wifiSsid} and wrote fresh device token`,
      ...logs
    ];
  }
</script>

<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header class="flex flex-col gap-2">
      <StatusBadge tone={bluetoothAvailable ? "success" : "warning"}>
        {bluetoothAvailable ? "web-bluetooth" : "mocked"}
      </StatusBadge>
      <Card.Title class="text-xl">Provision a panel</Card.Title>
      <Card.Description>
        Cloud UI for BLE onboarding, token claim, and first heartbeat checks.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="provision-name">panel name</Label>
        <Input id="provision-name" bind:value={deviceName} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="provision-ssid">Wi-Fi SSID</Label>
        <Input id="provision-ssid" bind:value={wifiSsid} />
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleScan}
          variant="secondary"
        >
          Scan over BLE
        </Button>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleMockProvision}
        >
          Mock provision
        </Button>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm tracking-[0.18em] uppercase">Provision log</Card.Title>
      <Card.Description>All steps stay visible so pairing and token flow are debuggable.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-2">
      {#each logs as line, index (`${line}-${index}`)}
        <div class="rounded-lg bg-muted/30 px-3 py-3 font-mono text-sm ring-1 ring-foreground/10">
          {line}
        </div>
      {:else}
        <Empty.Root class="border-none py-6">
          <Empty.Header>
            <Empty.Title>No log entries</Empty.Title>
            <Empty.Description>Scan or mock provision to see steps here.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
