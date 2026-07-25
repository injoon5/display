<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";

  // Placeholder chips until the real icon sheet is wired up (see docs/roadmap.md).
  // They stay neutral on purpose: a colour here would imply a meaning the icons
  // do not have.
  const icons = ["cloud", "bus", "calendar", "air", "clock", "alert"];
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title level={2}>Icons</Card.Title>
    <Card.Description>Icon names available to cards.</Card.Description>
  </Card.Header>

  <Card.Content>
    <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {#each icons as icon (icon)}
        <li
          class="flex items-center gap-2.5 rounded-md bg-foreground/[0.035] p-2 ring-1 ring-border/70 ring-inset"
        >
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-sm bg-foreground/[0.06] font-mono text-[11px] text-muted-foreground uppercase"
            aria-hidden="true"
          >
            {icon.slice(0, 2)}
          </span>
          <span class="min-w-0 truncate font-mono text-xs">{icon}</span>
        </li>
      {/each}
    </ul>
  </Card.Content>
</Card.Root>
