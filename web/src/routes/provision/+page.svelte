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
    "Bluetooth is ready when available, or setup runs in demo mode.",
    "Scan for a panel, connect to Wi‑Fi, then claim it."
  ]);
  let wifiSsid = $state("MyBedroomWiFi");
  let deviceName = $state("Wall Matrix Panel");
  let bluetoothAvailable = $derived(browser && "bluetooth" in navigator);

  async function handleScan(): Promise<void> {
    if (!bluetoothAvailable) {
      logs = ["Bluetooth isn’t available in this browser. Continuing in demo mode.", ...logs];
      return;
    }
    try {
      const bluetooth = (navigator as BluetoothNavigator).bluetooth;
      if (!bluetooth) {
        logs = ["Bluetooth isn’t available in this browser. Continuing in demo mode.", ...logs];
        return;
      }
      const picked = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"]
      });
      logs = [`Selected ${picked.name ?? picked.id}.`, ...logs];
    } catch (error) {
      logs = [
        error instanceof Error ? error.message : "Scan cancelled.",
        ...logs
      ];
    }
  }

  function handleMockProvision(): void {
    logs = [
      `Set up ${deviceName} on ${wifiSsid} and claimed a device token.`,
      ...logs
    ];
  }
</script>

<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header class="flex flex-col gap-2">
      <StatusBadge tone={bluetoothAvailable ? "success" : "warning"}>
        {bluetoothAvailable ? "Bluetooth Ready" : "Demo"}
      </StatusBadge>
      <Card.Title class="text-xl">Set Up Panel</Card.Title>
      <Card.Description>
        Connect a panel to Wi‑Fi and claim it.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="provision-name">Name</Label>
        <Input id="provision-name" bind:value={deviceName} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="provision-ssid">Wi‑Fi SSID</Label>
        <Input id="provision-ssid" bind:value={wifiSsid} />
      </div>

      <div class="flex flex-wrap gap-2">
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleScan}
          variant="secondary"
        >
          Scan
        </Button>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleMockProvision}
        >
          Set Up
        </Button>
      </div>
    </Card.Content>
  </Card.Root>

  <section class="overflow-hidden rounded-xl border bg-card/40">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold">Activity</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Steps appear here as setup progresses.
      </p>
    </div>
    <div class="px-4 py-3">
      {#if logs.length === 0}
        <Empty.Root class="border-none py-6">
          <Empty.Header>
            <Empty.Title>No activity yet</Empty.Title>
            <Empty.Description>Scan or set up a panel to see steps here.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <ul class="flex flex-col gap-2 text-sm">
          {#each logs as line, index (`${line}-${index}`)}
            <li class="border-b border-border/60 pb-2 text-muted-foreground last:border-b-0 last:pb-0">
              {line}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</div>
