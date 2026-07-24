<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";

  type Props = {
    amps: number;
    budget?: number;
    label?: string;
  };

  let { amps, budget = 4, label = "Draw" }: Props = $props();

  let percent = $derived(Math.min(100, Math.max(0, (amps / budget) * 100)));
  let tone = $derived.by((): "success" | "warning" | "destructive" => {
    if (percent > 85) return "destructive";
    if (percent > 60) return "warning";
    return "success";
  });
  let barClass = $derived.by(() => {
    switch (tone) {
      case "destructive":
        return "bg-destructive";
      case "warning":
        return "bg-amber-400";
      case "success":
        return "bg-emerald-400";
      default: {
        const _exhaustive: never = tone;
        return _exhaustive;
      }
    }
  });
</script>

<Card.Root size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3">
    <div>
      <Card.Title>Power</Card.Title>
      <Card.Description>Estimated current against your budget.</Card.Description>
    </div>
    <StatusBadge tone={tone} class="tabular">{amps.toFixed(2)} A</StatusBadge>
  </Card.Header>
  <Card.Content>
    <div class="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div class="mb-2 flex items-end justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span class="tabular">{budget.toFixed(1)} A limit</span>
      </div>
      <div class="h-3 rounded-full bg-background/60 p-0.5 ring-1 ring-foreground/10">
        <div
          class={`h-full rounded-full transition-[width] duration-200 ease-[var(--ease-out)] ${barClass}`}
          style={`width:${percent}%`}
        ></div>
      </div>
    </div>
  </Card.Content>
</Card.Root>
