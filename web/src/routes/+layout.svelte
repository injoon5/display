<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import { dashboardStatus, primaryDevice } from "$lib/convex";
  import { modeLabel } from "$lib/mode-label";
  import { ModeWatcher } from "mode-watcher";
  import BoxIcon from "@lucide/svelte/icons/box";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import RadioIcon from "@lucide/svelte/icons/radio";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import WorkflowIcon from "@lucide/svelte/icons/workflow";
  import type { Component } from "svelte";

  let { children } = $props();

  const nav: Array<{ href: string; label: string; icon: Component }> = [
    { href: "/", label: "Device", icon: MonitorIcon },
    { href: "/cards", label: "Cards", icon: LayersIcon },
    { href: "/scenes", label: "Scenes", icon: BoxIcon },
    { href: "/rules", label: "Rules", icon: WorkflowIcon },
    { href: "/sources", label: "Sources", icon: RadioIcon },
    { href: "/firmware", label: "Firmware", icon: CpuIcon },
    { href: "/provision", label: "Set Up", icon: ShieldIcon },
  ];

  let status = $derived($dashboardStatus);
  let device = $derived($primaryDevice);

  function isActive(href: string): boolean {
    if (href === "/") return page.url.pathname === "/";
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }

  function modeTone(mode: string): "success" | "warning" | "destructive" | "secondary" {
    switch (mode) {
      case "live":
        return "success";
      case "degraded":
        return "warning";
      case "mock":
        return "secondary";
      default:
        return "destructive";
    }
  }
</script>

<ModeWatcher defaultMode="dark" track={false} />
<Toaster richColors position="top-right" />

<Sidebar.Provider>
  <Sidebar.Root collapsible="icon" variant="inset">
    <Sidebar.Header class="gap-3 px-3 py-3">
      <div class="flex items-center gap-2 px-1">
        <div class="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <MonitorIcon class="size-4" />
        </div>
        <div class="min-w-0 group-data-[collapsible=icon]:hidden">
          <p class="truncate text-sm font-semibold tracking-tight">Wall Matrix</p>
          <p class="truncate text-xs text-muted-foreground">Control</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5 px-1 group-data-[collapsible=icon]:hidden">
        <StatusBadge tone="secondary">Panel</StatusBadge>
        <StatusBadge tone={modeTone(status.mode)}>{modeLabel(status.mode)}</StatusBadge>
      </div>
    </Sidebar.Header>

    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel>Menu</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each nav as item (item.href)}
              {@const Icon = item.icon}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  isActive={isActive(item.href)}
                  tooltipContent={item.label}
                >
                  {#snippet child({ props })}
                    <a href={item.href} {...props}>
                      <Icon />
                      <span>{item.label}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer class="gap-2 px-3 pb-3 group-data-[collapsible=icon]:hidden">
      <StatTile label="Panel" value={device?.name ?? "No panel"} />
      <div class="grid grid-cols-2 gap-2">
        <StatTile label="Firmware" value={device?.fwVersion ?? "—"} />
        <StatTile label="Program" value={`v${device?.programVersion ?? 0}`} />
      </div>
    </Sidebar.Footer>
    <Sidebar.Rail />
  </Sidebar.Root>

  <Sidebar.Inset>
    <header
      class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md supports-backdrop-filter:bg-background/70"
    >
      <Sidebar.Trigger class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]" />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-sm font-semibold tracking-tight text-balance">
          Wall Matrix
        </h1>
        <p class="truncate text-xs text-muted-foreground">
          Cards, scenes, rules, and sources
        </p>
      </div>
      <Button
        href="/cards"
        size="sm"
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
      >
        Open Cards
      </Button>
    </header>

    <div class="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {@render children?.()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
