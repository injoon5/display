<script lang="ts">
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { dashboardStatus, seedLiveDemo } from "$lib/convex";
  import { modeLabel } from "$lib/mode-label";

  let busy = $state(false);
  let message = $state<string | null>(null);
  let status = $derived($dashboardStatus);

  async function handleSeed(): Promise<void> {
    busy = true;
    message = null;
    try {
      await seedLiveDemo();
      message = "Sample data loaded.";
    } catch (error) {
      message = error instanceof Error ? error.message : "Couldn’t load sample data.";
    } finally {
      busy = false;
    }
  }
</script>

{#if status.mode !== "live"}
  <Alert.Root class="mb-1" variant={status.mode === "degraded" ? "destructive" : "default"}>
    <Alert.Title>
      {status.mode === "degraded" ? "Convex limited" : modeLabel(status.mode)}
    </Alert.Title>
    <Alert.Description class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {#if status.mode === "degraded"}
          {status.lastError ?? "Live backend is unreachable. Showing local demo data."}
        {:else}
          Local browser data until Convex is ready. Load sample data anytime.
        {/if}
      </span>
      <Button disabled={busy} onclick={handleSeed} size="sm" variant="secondary">
        {busy ? "Loading…" : "Load Sample Data"}
      </Button>
    </Alert.Description>
  </Alert.Root>
{/if}

{#if message}
  <Alert.Root class="mb-1">
    <Alert.Description>{message}</Alert.Description>
  </Alert.Root>
{/if}
