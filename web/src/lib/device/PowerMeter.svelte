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
        return "bg-warning";
      case "success":
        return "bg-success";
      default: {
        const _exhaustive: never = tone;
        return _exhaustive;
      }
    }
  });
  let headroom = $derived(Math.max(0, budget - amps));
</script>

<Card.Root size="sm">
  <Card.Header>
    <Card.Title level={2}>Power</Card.Title>
    <Card.Description>Estimated draw vs budget.</Card.Description>
    <Card.Action>
      <StatusBadge {tone}>{amps.toFixed(2)} A</StatusBadge>
    </Card.Action>
  </Card.Header>
  <Card.Content class="flex flex-col gap-2">
    <div class="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
      <span>{label}</span>
      <span class="tabular-nums">{budget.toFixed(1)} A budget</span>
    </div>
    <!-- role="meter" so the value is announced, and the fill is scaled rather
         than re-laid-out on every telemetry tick. -->
    <div
      class="h-2 overflow-hidden rounded-full bg-foreground/10"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={budget}
      aria-valuenow={Number(amps.toFixed(2))}
      aria-valuetext="{amps.toFixed(2)} A of {budget.toFixed(1)} A"
    >
      <div
        class="h-full w-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out)] {barClass}"
        style="transform: scaleX({percent / 100})"
      ></div>
    </div>
    <p class="text-xs tabular-nums text-muted-foreground">
      {headroom.toFixed(2)} A headroom
    </p>
  </Card.Content>
</Card.Root>
