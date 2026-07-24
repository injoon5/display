<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import { dashboardStatus, primaryDevice } from "$lib/convex";
  import { modeLabel } from "$lib/mode-label";
  import { routeChrome } from "$lib/route-chrome";
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
    { href: "/", label: "Panel", icon: MonitorIcon },
    { href: "/cards", label: "Cards", icon: LayersIcon },
    { href: "/scenes", label: "Scenes", icon: BoxIcon },
    { href: "/rules", label: "Rules", icon: WorkflowIcon },
    { href: "/sources", label: "Sources", icon: RadioIcon },
    { href: "/firmware", label: "Firmware", icon: CpuIcon },
    { href: "/provision", label: "Set Up", icon: ShieldIcon },
  ];

  let status = $derived($dashboardStatus);
  let device = $derived($primaryDevice);
  let chrome = $derived(routeChrome(page.url.pathname));

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

<svelte:head>
  <title>{chrome.title} · Wall Matrix</title>
</svelte:head>

<ModeWatcher defaultMode="dark" track={false} />
<Toaster richColors position="top-right" />

<a class="skip-link" href="#main">Skip to content</a>

<Sidebar.Provider>
  <Sidebar.Root
    class="border-sidebar-border/60 bg-sidebar/80 backdrop-blur-xl"
    collapsible="icon"
    variant="inset"
  >
    <Sidebar.Header class="gap-3 px-3 py-3">
      <div class="flex items-center gap-2.5 px-1">
        <div
          class="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_1px_0_oklch(1_0_0/0.12)_inset]"
        >
          <MonitorIcon class="size-4" aria-hidden="true" />
        </div>
        <div class="min-w-0 group-data-[collapsible=icon]:hidden">
          <p class="truncate text-sm font-semibold tracking-tight">Wall Matrix</p>
          <p class="truncate text-xs text-muted-foreground">
            {device?.name ?? "No panel"}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5 px-1 group-data-[collapsible=icon]:hidden">
        <StatusBadge tone={device?.online ? "success" : "destructive"}>
          {device?.online ? "Online" : "Offline"}
        </StatusBadge>
        <StatusBadge tone={modeTone(status.mode)}>{modeLabel(status.mode)}</StatusBadge>
      </div>
    </Sidebar.Header>

    <Sidebar.Content>
      <Sidebar.Group>
        <Sidebar.GroupLabel class="text-muted-foreground/80">Control</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <nav aria-label="Primary">
            <Sidebar.Menu>
              {#each nav as item (item.href)}
                {@const Icon = item.icon}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    class="min-h-10"
                    isActive={isActive(item.href)}
                    tooltipContent={item.label}
                  >
                    {#snippet child({ props })}
                      <a href={item.href} {...props}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </a>
                    {/snippet}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            </Sidebar.Menu>
          </nav>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    </Sidebar.Content>

    <Sidebar.Footer class="gap-2 px-3 pb-3 group-data-[collapsible=icon]:hidden">
      <StatTile label="Firmware" value={device?.fwVersion ?? "—"} />
      <StatTile label="Program" value={`v${device?.programVersion ?? 0}`} />
    </Sidebar.Footer>
    <Sidebar.Rail />
  </Sidebar.Root>

  <Sidebar.Inset id="main" class="bg-transparent">
    <header
      class="sticky top-0 z-20 flex h-14 items-center gap-3 bg-background/55 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/45 shadow-[0_1px_0_oklch(1_0_0/0.06)]"
    >
      <Sidebar.Trigger class="press" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold tracking-tight text-balance">{chrome.title}</p>
        <p class="truncate text-xs text-muted-foreground text-pretty">{chrome.subtitle}</p>
      </div>
      {#if device}
        <StatusBadge tone={device.online ? "success" : "destructive"} class="hidden sm:inline-flex">
          {device.online ? "Online" : "Offline"}
        </StatusBadge>
      {/if}
    </header>

    <div class="flex flex-1 flex-col gap-5 p-4 md:p-6">
      {@render children?.()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
