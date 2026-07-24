<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";

  const icons = [
    { name: "cloud", tint: "text-sky-300" },
    { name: "bus", tint: "text-amber-300" },
    { name: "calendar", tint: "text-lime-300" },
    { name: "air", tint: "text-emerald-300" },
    { name: "clock", tint: "text-zinc-200" },
    { name: "alert", tint: "text-red-300" }
  ];
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title class="tracking-[0.18em] uppercase">Icon library</Card.Title>
    <Card.Description>Stub palette until libmxr asset bundles are wired into wasm.</Card.Description>
  </Card.Header>

  <Card.Content>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {#each icons as icon (icon.name)}
        <div class="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
          <div
            class={[
              "mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40 font-mono text-xs uppercase ring-1 ring-foreground/10",
              icon.tint
            ]}
          >
            {icon.name.slice(0, 2)}
          </div>
          <div class="font-mono text-xs">{icon.name}</div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
