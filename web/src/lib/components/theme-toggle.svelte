<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { mode, toggleMode } from "mode-watcher";

  let isDark = $derived(mode.current === "dark");
  let label = $derived(isDark ? "Switch to light theme" : "Switch to dark theme");
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button {...props} aria-label={label} onclick={toggleMode} size="icon-sm" variant="ghost">
        <!-- Both icons stay mounted and cross-fade, so the swap animates in and
             out without a motion library. -->
        <span class="relative grid size-4 place-items-center" aria-hidden="true">
          <SunIcon
            class="absolute transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] {isDark
              ? 'scale-25 opacity-0 blur-[4px]'
              : 'scale-100 opacity-100 blur-0'}"
          />
          <MoonIcon
            class="absolute transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] {isDark
              ? 'scale-100 opacity-100 blur-0'
              : 'scale-25 opacity-0 blur-[4px]'}"
          />
        </span>
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content side="bottom">{label}</Tooltip.Content>
</Tooltip.Root>
