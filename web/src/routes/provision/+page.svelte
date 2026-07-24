<script lang="ts">
  import { browser } from "$app/environment";

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
  <section class="panel rounded-3xl p-5">
    <div class="flex items-center gap-2">
      <span class={`badge ${bluetoothAvailable ? "badge-green" : "badge-amber"}`}>{bluetoothAvailable ? "web-bluetooth" : "mocked"}</span>
    </div>
    <h2 class="mt-3 text-xl font-semibold text-zinc-50">Provision a panel</h2>
    <p class="mt-1 text-sm text-[color:var(--muted)]">Cloud UI for BLE onboarding, token claim, and first heartbeat checks.</p>

    <div class="mt-4 space-y-3">
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">panel name</span>
        <input bind:value={deviceName} class="mt-2 w-full bg-transparent outline-none" />
      </label>
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Wi-Fi SSID</span>
        <input bind:value={wifiSsid} class="mt-2 w-full bg-transparent outline-none" />
      </label>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" onclick={handleScan}>
        Scan over BLE
      </button>
      <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handleMockProvision}>
        Mock provision
      </button>
    </div>
  </section>

  <section class="panel rounded-3xl p-5">
    <div class="mb-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Provision log</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">All steps stay visible so pairing and token flow are debuggable.</p>
    </div>
    <div class="space-y-2">
      {#each logs as line, index (`${line}-${index}`)}
        <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3 font-mono text-sm text-zinc-100">
          {line}
        </div>
      {/each}
    </div>
  </section>
</div>
