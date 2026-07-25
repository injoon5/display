<script lang="ts" module>
  /**
   * Status tones carry meaning, so they are deliberately few:
   * - `success` / `warning` / `destructive` describe health, and render a dot so
   *   the state never depends on colour alone.
   * - `neutral` / `outline` / `mono` are for metadata (names, slugs, counts) and
   *   must stay colourless — a green "weather" chip reads as an alarm.
   */
  export type BadgeTone = "neutral" | "outline" | "mono" | "success" | "warning" | "destructive";
</script>

<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { cn } from "$lib/utils.js";
  import type { ComponentProps } from "svelte";

  type Props = {
    tone?: BadgeTone;
    class?: string;
    children?: import("svelte").Snippet;
  } & Omit<ComponentProps<typeof Badge>, "variant" | "children" | "class">;

  let { tone = "neutral", class: className, children, ...rest }: Props = $props();

  const isStatus = $derived(tone === "success" || tone === "warning" || tone === "destructive");

  const variant = $derived.by((): ComponentProps<typeof Badge>["variant"] =>
    tone === "outline" || tone === "mono" ? "outline" : "secondary",
  );

  const toneClass = $derived.by(() => {
    switch (tone) {
      case "success":
        return "bg-success-surface text-success ring-1 ring-success-border ring-inset";
      case "warning":
        return "bg-warning-surface text-warning ring-1 ring-warning-border ring-inset";
      case "destructive":
        return "bg-destructive-surface text-destructive ring-1 ring-destructive-border ring-inset";
      case "mono":
        return "font-mono text-[11px] tracking-tight text-muted-foreground";
      default:
        return "";
    }
  });
</script>

<Badge {variant} class={cn("tabular-nums", toneClass, className)} {...rest}>
  {#if isStatus}
    <span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</Badge>
