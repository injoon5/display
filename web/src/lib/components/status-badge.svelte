<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { cn } from "$lib/utils.js";
  import type { ComponentProps } from "svelte";

  type Tone = "default" | "secondary" | "outline" | "destructive" | "success" | "warning";

  type Props = {
    tone?: Tone;
    class?: string;
    children?: import("svelte").Snippet;
  } & Omit<ComponentProps<typeof Badge>, "variant" | "children" | "class">;

  let { tone = "secondary", class: className, children, ...rest }: Props = $props();

  const variant = $derived.by((): ComponentProps<typeof Badge>["variant"] => {
    switch (tone) {
      case "success":
        return "secondary";
      case "warning":
        return "outline";
      case "destructive":
        return "destructive";
      case "default":
        return "default";
      case "outline":
        return "outline";
      case "secondary":
        return "secondary";
      default: {
        const _exhaustive: never = tone;
        return _exhaustive;
      }
    }
  });

  const toneClass = $derived.by(() => {
    switch (tone) {
      case "success":
        return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
      case "warning":
        return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200";
      default:
        return "";
    }
  });
</script>

<Badge variant={variant} class={cn("tabular-nums", toneClass, className)} {...rest}>
  {@render children?.()}
</Badge>
