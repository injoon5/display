<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { dashboardStatus, seedLiveDemo } from "$lib/convex";
  import CloudOffIcon from "@lucide/svelte/icons/cloud-off";
  import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";

  let busy = $state(false);
  let status = $derived($dashboardStatus);
  let degraded = $derived(status.mode === "degraded");
</script>

{#if status.mode !== "live"}
  <!-- An icon plus a label carries the state, so it never rests on colour alone. -->
  <div
    class="glass flex flex-col gap-2.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    role="status"
    aria-live="polite"
  >
    <span
      class="flex size-7 shrink-0 items-center justify-center rounded-md {degraded
        ? 'bg-destructive-surface text-destructive'
        : 'bg-warning-surface text-warning'}"
      aria-hidden="true"
    >
      {#if degraded}
        <CloudOffIcon class="size-4" />
      {:else}
        <FlaskConicalIcon class="size-4" />
      {/if}
    </span>

    <p class="min-w-0 flex-1 text-sm">
      <span class="font-medium">{degraded ? "Live backend unreachable" : "Demo mode"}</span>
      <span class="text-muted-foreground">
        · {#if degraded}
          {status.lastError ?? "Showing local sample data."}
        {:else}
          Local sample data until a panel connects.
        {/if}
      </span>
    </p>

    <Button
      class="w-full shrink-0 sm:w-auto"
      disabled={busy}
      size="sm"
      variant="secondary"
      onclick={async () => {
        busy = true;
        try {
          await seedLiveDemo();
        } finally {
          busy = false;
        }
      }}
    >
      {#if busy}
        <Spinner aria-label="" />
      {/if}
      {busy ? "Loading…" : "Load sample data"}
    </Button>
  </div>
{/if}
