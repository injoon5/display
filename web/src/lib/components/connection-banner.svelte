<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { dashboardStatus, seedLiveDemo } from "$lib/convex";

  let busy = $state(false);
  let status = $derived($dashboardStatus);
  let degraded = $derived(status.mode === "degraded");
</script>

{#if status.mode !== "live"}
  <div
    class="glass flex flex-col gap-2 rounded-xl px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    role="status"
  >
    <span
      class="relative flex size-2 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <span
        class="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping"
        class:bg-amber-400={!degraded}
        class:bg-destructive={degraded}
      ></span>
      <span
        class="relative inline-flex size-2 rounded-full"
        class:bg-amber-400={!degraded}
        class:bg-destructive={degraded}
      ></span>
    </span>

    <p class="min-w-0 flex-1 text-sm text-pretty">
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
      class="press shrink-0"
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
      {busy ? "Loading…" : "Load sample data"}
    </Button>
  </div>
{/if}
